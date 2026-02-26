import { Character } from '../core/Character';
import { Delaunay } from 'd3-delaunay';
import { Grid } from './pathfinding/Grid';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './terrain/Terrain';
import { TerrainElement } from './TerrainElement';
import { ConstrainedNavMesh } from './pathfinding/ConstrainedNavMesh';
import { getBaseDiameterFromSiz } from './spatial/size-utils';

function segmentsIntersect(p1: Position, q1: Position, p2: Position, q2: Position): boolean {
    function orientation(p: Position, q: Position, r: Position): number {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (val === 0) return 0; // Collinear
        return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
    }

    function onSegment(p: Position, q: Position, r: Position): boolean {
        return (
            q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
            q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y)
        );
    }

    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
}

function pointOnSegment(point: Position, a: Position, b: Position): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > 1e-9) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < 0) return false;
  const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= squaredLength;
}

function pointInPolygon(point: Position, polygon: Position[]): boolean {
  if (polygon.length < 3) return false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (pointOnSegment(point, polygon[j], polygon[i])) {
      return true;
    }
  }

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

const LOS_KEY_SCALE = 100;
const MAX_LOS_CACHE_ENTRIES = 25000;

export class Battlefield {
  public grid: Grid;
  public terrain: TerrainFeature[] = [];
  public opennessStats?: BattlefieldOpennessStats;
  private navigationMesh: Delaunay<Position> | null = null;
  private constrainedNavMesh: ConstrainedNavMesh | null = null;
  private characterPositions: Map<string, Position> = new Map();
  private characterRegistry: Map<string, Character> = new Map();
  private terrainVersion = 0;
  private losCache = new Map<string, boolean>();
  private losCacheHits = 0;
  private losCacheMisses = 0;

  constructor(public width: number, public height: number) {
    this.grid = new Grid(width, height);
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

  getCharacterPosition(character: Character): Position | undefined {
    return this.characterPositions.get(character.id);
  }

  getCharacterAt(position: Position): Character | null {
    return this.grid.getCell(position)?.occupant || null;
  }

  getCharacterById(id: string): Character | null {
    return this.characterRegistry.get(id) ?? null;
  }

  getModelBlockers(excludeIds: string[] = []): { id: string; position: Position; baseDiameter: number; siz: number; isKOd: boolean }[] {
    const excluded = new Set(excludeIds);
    const blockers: { id: string; position: Position; baseDiameter: number; siz: number; isKOd: boolean }[] = [];
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
      });
    }
    return blockers;
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
