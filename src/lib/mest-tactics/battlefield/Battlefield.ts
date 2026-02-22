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

export class Battlefield {
  public grid: Grid;
  public terrain: TerrainFeature[] = [];
  public opennessStats?: BattlefieldOpennessStats;
  private navigationMesh: Delaunay<Position> | null = null;
  private constrainedNavMesh: ConstrainedNavMesh | null = null;
  private characterPositions: Map<string, Position> = new Map();
  private characterRegistry: Map<string, Character> = new Map();

  constructor(public width: number, public height: number) {
    this.grid = new Grid(width, height);
  }

  addTerrain(feature: TerrainFeature, deferNavMesh = false): void {
    this.terrain.push(feature);
    if (!deferNavMesh) {
      this.finalizeTerrain();
    }
  }

  removeTerrain(feature: TerrainFeature, deferNavMesh = false): void {
    const index = this.terrain.lastIndexOf(feature);
    if (index >= 0) {
      this.terrain.splice(index, 1);
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

  public hasLineOfSight(start: Position, end: Position): boolean {
    for (const feature of this.terrain) {
      const los = feature.meta?.los ?? 'Clear';
      if (feature.type === TerrainType.Obstacle || los === 'Blocking') {
        for (let i = 0, j = feature.vertices.length - 1; i < feature.vertices.length; j = i++) {
          const p1 = feature.vertices[j];
          const p2 = feature.vertices[i];
          if (segmentsIntersect(start, end, p1, p2)) {
            return false;
          }
        }
      }
    }
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
    this.generateNavigationMesh();
    this.constrainedNavMesh = ConstrainedNavMesh.build(this);
  }

  getNavMesh(): Delaunay<Position> | null {
      return this.navigationMesh;
  }

  getConstrainedNavMesh(): ConstrainedNavMesh | null {
    return this.constrainedNavMesh;
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
