import { Character } from '../core/Character';
import { Delaunay } from 'd3-delaunay';
import { Grid } from './pathfinding/Grid';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './terrain/Terrain';
import { TerrainElement } from './terrain/TerrainElement';
import { ConstrainedNavMesh } from './pathfinding/ConstrainedNavMesh';
import { AreaTerrainLayer } from './terrain/AreaTerrainLayer';
import { getBaseDiameterFromSiz } from './spatial/size-utils';
import { SpatialRules } from './spatial/spatial-rules';
import { segmentsIntersect, pointInPolygon } from './terrain/BattlefieldUtils';

const LOS_KEY_SCALE = 100;
const MAX_LOS_CACHE_ENTRIES = 25000;

export class Battlefield {
  public grid: Grid;
  public terrain: TerrainFeature[] = [];
  public opennessStats?: BattlefieldOpennessStats;
  /** Area terrain layer for rough patches */
  public areaTerrain: AreaTerrainLayer;
  private navigationMesh: Delaunay<Position> | null = null;
  private constrainedNavMesh: ConstrainedNavMesh | null = null;
  private characterPositions: Map<string, Position> = new Map();
  private characterRegistry: Map<string, Character> = new Map();
  private terrainVersion = 0;
  private losCache = new Map<string, boolean>();
  private losCacheHits = 0;
  private losCacheMisses = 0;

  constructor(public width: number, public height: number, terrain: TerrainFeature[] = []) {
    this.grid = new Grid(width, height);
    this.areaTerrain = new AreaTerrainLayer({
      width,
      height,
      cellResolution: 0.5,
      maxOverlapRatio: 0.20,
    });
    if (terrain.length > 0) {
      this.terrain = [...terrain];
      this.invalidateTerrainDerivedState();
      this.finalizeTerrain();
    }
  }

  private invalidateTerrainDerivedState(): void {
    this.terrainVersion += 1;
    this.navigationMesh = null;
    this.constrainedNavMesh = null;
    this.losCache.clear();
  }

  addTerrain(feature: TerrainFeature, deferNavMesh = false): void {
    this.terrain.push(feature);
    this.invalidateTerrainDerivedState();
    if (!deferNavMesh) {
      this.finalizeTerrain();
    }
  }

  removeTerrain(feature: TerrainFeature, deferNavMesh = false): void {
    const index = this.terrain.lastIndexOf(feature);
    if (index >= 0) {
      this.terrain.splice(index, 1);
      this.invalidateTerrainDerivedState();
      if (!deferNavMesh) {
        this.finalizeTerrain();
      }
    }
  }

  addTerrainElement(element: TerrainElement, deferNavMesh = false): void {
    this.addTerrain(element.toFeature(), deferNavMesh);
  }

  /**
   * Place area terrain (rough patch) with overlap checking
   * 
   * @param typeName - Patch type name
   * @param position - Center position
   * @param rotation - Rotation in degrees (optional)
   * @param deferNavMesh - Defer navigation mesh update (default: true for area terrain)
   * @returns True if placement successful
   */
  placeAreaTerrain(
    typeName: 'Small Rough Patch' | 'Medium Rough Patch' | 'Large Rough Patch',
    position: Position,
    rotation: number = 0,
    deferNavMesh: boolean = true
  ): boolean {
    const placed = this.areaTerrain.tryPlace(typeName, position, rotation);
    
    if (placed) {
      // Add to terrain list for rendering and LOS checks
      const patch = this.areaTerrain.getPatches().pop();
      if (patch) {
        this.terrain.push(patch.feature);
        this.invalidateTerrainDerivedState();
        if (!deferNavMesh) {
          this.finalizeTerrain();
        }
      }
    }
    
    return placed;
  }

  /**
   * Get movement cost at position (includes area terrain)
   */
  getMovementCostAt(position: Position): number {
    return this.areaTerrain.getMovementCost(position);
  }

  /**
   * Check if position is covered by area terrain
   */
  isAreaTerrainCovered(position: Position): boolean {
    return this.areaTerrain.isCovered(position);
  }

  placeCharacter(character: Character, position: Position): boolean {
    if (this.grid.setOccupant(position, character)) {
        this.characterPositions.set(character.id, position);
        this.characterRegistry.set(character.id, character);
        return true;
    }
    return false;
  }

  moveCharacter(character: Character, to: Position): boolean {
    const from = this.characterPositions.get(character.id);
    if (!from) {
        return false;
    }

    const fromCell = this.grid.getCell(from);
    if (fromCell && fromCell.occupant?.id === character.id) {
      if (this.grid.setOccupant(to, character)) {
            fromCell.occupant = null;
            this.characterPositions.set(character.id, to);
            this.characterRegistry.set(character.id, character);
            return true;
        }
    }
    return false;
  }

  isWithinBounds(position: Position, baseDiameter = 0): boolean {
    const radius = baseDiameter / 2;
    return (
      position.x - radius >= 0 &&
      position.x + radius <= this.width &&
      position.y - radius >= 0 &&
      position.y + radius <= this.height
    );
  }

  removeCharacter(character: Character): boolean {
    const from = this.characterPositions.get(character.id);
    if (!from) return false;

    const fromCell = this.grid.getCell(from);
    if (fromCell && fromCell.occupant?.id === character.id) {
      fromCell.occupant = null;
    }

    this.characterPositions.delete(character.id);
    this.characterRegistry.delete(character.id);
    return true;
  }

  getCharacterPosition(character: Character): Position | undefined {
    return this.characterPositions.get(character.id);
  }

  getCharacterAt(position: Position): Character | null {
    return this.grid.getCell(position)?.occupant || null;
  }

  getCharacterById(id: string): Character | null {
    return this.characterRegistry.get(id) ?? null;
  }

  /**
   * QSR: Check if a model can occupy a position (fit within the area)
   * @param position - The position to check
   * @param baseDiameter - The model's base diameter in MU
   * @returns True if the model can rest at this position
   */
  canOccupy(position: Position, baseDiameter: number, excludeCharacterId?: string): boolean {
    const radius = baseDiameter / 2;
    
    // Check if position is within battlefield bounds (with radius buffer)
    if (position.x - radius < 0 || position.x + radius > this.width ||
        position.y - radius < 0 || position.y + radius > this.height) {
      return false;
    }
    
    // Check terrain doesn't block full footprint
    // Use PathfindingEngine's isWalkable logic
    for (const feature of this.terrain) {
      if (!this.isMovementBlocking(feature)) continue;
      const distance = this.distancePointToPolygon(position, feature.vertices);
      if (distance <= radius) {
        return false; // Terrain blocks the footprint
      }
    }
    
    // Check no other model occupies this space
    for (const [id, modelPos] of this.characterPositions.entries()) {
      if (excludeCharacterId && id === excludeCharacterId) continue;
      const model = this.characterRegistry.get(id);
      if (!model || model.state.isKOd || model.state.isEliminated) continue;
      
      const modelSiz = model.finalAttributes?.siz ?? model.attributes?.siz ?? 3;
      const modelRadius = getBaseDiameterFromSiz(modelSiz) / 2;
      const distance = Math.sqrt(
        Math.pow(position.x - modelPos.x, 2) + 
        Math.pow(position.y - modelPos.y, 2)
      );
      
      // Models can't overlap (sum of radii)
      if (distance < radius + modelRadius) {
        return false;
      }
    }
    
    return true;
  }
  
  private isMovementBlocking(feature: TerrainFeature): boolean {
    if (feature.meta?.category === 'area' || feature.meta?.layer === 'area') {
      return false;
    }
    if (feature.type === TerrainType.Obstacle || feature.type === TerrainType.Impassable) {
      return true;
    }
    // initialMovement: "Impassable" means models cannot START their movement in this terrain,
    // but they CAN enter it. Only truly blocking terrain (trees, buildings, walls) should block movement.
    // Check terrain category for blocking types per QSR rules-overrides.md OVR-003
    const category = feature.meta?.category;
    if (category === 'tree' || category === 'building' || category === 'wall') {
      return true; // Cannot enter these terrain types
    }
    // Shrubs, rocky terrain, etc. can be entered (just cost more movement)
    return false;
  }
  
  private distancePointToPolygon(point: Position, polygon: Position[]): number {
    if (polygon.length < 3) return Infinity;
    
    let minDistance = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const distance = this.distancePointToSegment(point, a, b);
      minDistance = Math.min(minDistance, distance);
    }
    
    // Check if point is inside polygon
    if (this.pointInPolygon(point, polygon)) {
      return 0;
    }
    
    return minDistance;
  }
  
  private distancePointToSegment(point: Position, a: Position, b: Position): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      return Math.sqrt((point.x - a.x) ** 2 + (point.y - a.y) ** 2);
    }
    
    let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    
    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
  }
  
  private pointInPolygon(point: Position, polygon: Position[]): boolean {
    if (polygon.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersects = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) {
        inside = !inside;
      }
    }
    return inside;
  }

  getModelBlockers(excludeIds: string[] = []): { id: string; position: Position; baseDiameter: number; siz: number; isKOd: boolean; isDistracted: boolean; isPanicked: boolean }[] {
    const excluded = new Set(excludeIds);
    const blockers: { id: string; position: Position; baseDiameter: number; siz: number; isKOd: boolean; isDistracted: boolean; isPanicked: boolean }[] = [];
    for (const [id, character] of this.characterRegistry.entries()) {
      if (excluded.has(id)) continue;
      const position = this.characterPositions.get(id);
      if (!position) continue;
      const siz = character.finalAttributes?.siz ?? character.attributes?.siz ?? 3;
      blockers.push({
        id,
        position,
        baseDiameter: getBaseDiameterFromSiz(siz),
        siz,
        isKOd: character.state?.isKOd ?? false,
        isDistracted: character.state?.isDistracted ?? false,
        isPanicked: character.state?.isPanicked ?? false,
      });
    }
    return blockers;
  }

  /**
   * Check if a character is engaged (in base contact) with any opposing model
   */
  isEngaged(character: Character): boolean {
    const pos = this.characterPositions.get(character.id);
    if (!pos) return false;
    
    const siz = character.finalAttributes?.siz ?? character.attributes?.siz ?? 3;
    const baseDiameter = getBaseDiameterFromSiz(siz);
    const model = {
      id: character.id,
      position: pos,
      baseDiameter,
      siz,
    };
    
    // Check against all other characters
    for (const [otherId, otherChar] of this.characterRegistry.entries()) {
      if (otherId === character.id) continue;
      const otherPos = this.characterPositions.get(otherId);
      if (!otherPos) continue;
      
      const otherSiz = otherChar.finalAttributes?.siz ?? otherChar.attributes?.siz ?? 3;
      const otherBaseDiameter = getBaseDiameterFromSiz(otherSiz);
      const otherModel = {
        id: otherId,
        position: otherPos,
        baseDiameter: otherBaseDiameter,
        siz: otherSiz,
      };
      
      if (SpatialRules.isEngaged(model, otherModel)) {
        return true;
      }
    }
    
    return false;
  }

  private losCacheKey(start: Position, end: Position): string {
    const sx = Math.round(start.x * LOS_KEY_SCALE);
    const sy = Math.round(start.y * LOS_KEY_SCALE);
    const ex = Math.round(end.x * LOS_KEY_SCALE);
    const ey = Math.round(end.y * LOS_KEY_SCALE);
    const a = `${sx},${sy}`;
    const b = `${ex},${ey}`;
    return a <= b
      ? `${this.terrainVersion}:${a}|${b}`
      : `${this.terrainVersion}:${b}|${a}`;
  }

  private setLosCache(key: string, value: boolean): void {
    this.losCache.set(key, value);
    if (this.losCache.size > MAX_LOS_CACHE_ENTRIES) {
      const oldest = this.losCache.keys().next().value;
      if (oldest !== undefined) {
        this.losCache.delete(oldest);
      }
    }
  }

  public hasLineOfSight(start: Position, end: Position): boolean {
    const cacheKey = this.losCacheKey(start, end);
    const cached = this.losCache.get(cacheKey);
    if (cached !== undefined) {
      this.losCacheHits += 1;
      return cached;
    }
    this.losCacheMisses += 1;

    for (const feature of this.terrain) {
      const los = feature.meta?.los ?? 'Clear';
      if (feature.type === TerrainType.Obstacle || los === 'Blocking') {
        for (let i = 0, j = feature.vertices.length - 1; i < feature.vertices.length; j = i++) {
          const p1 = feature.vertices[j];
          const p2 = feature.vertices[i];
          if (segmentsIntersect(start, end, p1, p2)) {
            this.setLosCache(cacheKey, false);
            return false;
          }
        }
      }
    }
    this.setLosCache(cacheKey, true);
    return true;
  }

  public generateNavigationMesh(): void {
    const points: Position[] = [];
    points.push({ x: 0, y: 0 });
    points.push({ x: this.width, y: 0 });
    points.push({ x: 0, y: this.height });
    points.push({ x: this.width, y: this.height });

    this.terrain.forEach(feature => {
      points.push(...feature.vertices);
    });

    this.navigationMesh = Delaunay.from(points, p => p.x, p => p.y);
  }

  public finalizeTerrain(): void {
    this.losCache.clear();
    this.generateNavigationMesh();
    this.constrainedNavMesh = ConstrainedNavMesh.build(this);
  }

  getTerrainVersion(): number {
    return this.terrainVersion;
  }

  getLosCacheStats(): BattlefieldLosCacheStats {
    return {
      terrainVersion: this.terrainVersion,
      size: this.losCache.size,
      maxSize: MAX_LOS_CACHE_ENTRIES,
      hits: this.losCacheHits,
      misses: this.losCacheMisses,
    };
  }

  getNavMesh(): Delaunay<Position> | null {
      return this.navigationMesh;
  }

  getConstrainedNavMesh(): ConstrainedNavMesh | null {
    return this.constrainedNavMesh;
  }

  getTerrainAt(position: Position): TerrainFeature {
    const containing = this.terrain.filter(feature => pointInPolygon(position, feature.vertices));
    if (containing.length === 0) {
      return {
        id: 'clear',
        type: TerrainType.Clear,
        vertices: [],
      };
    }

    const priority: Record<TerrainType, number> = {
      [TerrainType.Clear]: 0,
      [TerrainType.Rough]: 1,
      [TerrainType.Difficult]: 2,
      [TerrainType.Impassable]: 3,
      [TerrainType.Obstacle]: 4,
    };

    return containing.reduce((best, current) =>
      (priority[current.type] > priority[best.type] ? current : best)
    );
  }
}

export interface BattlefieldOpennessStats {
  chunkSize: number;
  losThreshold: number;
  totalChunks: number;
  totalPairs: number;
  longLosPairs: number;
  longLosPairRatio: number;
  meanChunkLongLosRatio: number;
}

export interface BattlefieldLosCacheStats {
  terrainVersion: number;
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
}
