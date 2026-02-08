import { Character } from '../character/Character';
import { Delaunay } from 'd3-delaunay';
import { Grid } from './Grid';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './Terrain';

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
  private navigationMesh: Delaunay<Position> | null = null;

  constructor(public width: number, public height: number) {
    this.grid = new Grid(width, height);
  }

  addTerrain(feature: TerrainFeature): void {
    this.terrain.push(feature);
    this.generateNavigationMesh();
  }

  placeCharacter(character: Character): boolean {
    if (this.grid.setOccupant(character.position, character)) {
        return true;
    }
    return false;
  }

  moveCharacter(character: Character, to: Position): boolean {
    const fromCell = this.grid.getCell(character.position);
    if (fromCell && fromCell.occupant?.id === character.id) {
        if (this.grid.setOccupant(to, character)) {
            fromCell.occupant = null;
            character.move(to);
            return true;
        }
    }
    return false;
  }

  getCharacterAt(position: Position): Character | null {
    return this.grid.getCell(position)?.occupant || null;
  }

  public hasLineOfSight(start: Position, end: Position): boolean {
    for (const feature of this.terrain) {
      if (feature.type === TerrainType.Obstacle) {
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
      if (feature.type !== TerrainType.Obstacle) {
        points.push(...feature.vertices);
      }
    });

    this.navigationMesh = Delaunay.from(points, p => p.x, p => p.y);
  }

  getNavMesh(): Delaunay<Position> | null {
      return this.navigationMesh;
  }
}
