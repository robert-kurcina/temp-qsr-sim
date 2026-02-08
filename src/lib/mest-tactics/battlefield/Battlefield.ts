import { Delaunay } from 'd3-delaunay';
import { Grid } from './Grid';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './Terrain';

/**
 * Checks if two line segments intersect.
 * @param p1 Start of line 1
 * @param q1 End of line 1
 * @param p2 Start of line 2
 * @param q2 End of line 2
 * @returns True if the lines intersect, false otherwise.
 */
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
    this.generateNavigationMesh(); // Regenerate mesh when terrain changes
  }

  placeCharacter(characterId: string, position: Position): boolean {
    return this.grid.setOccupant(position, characterId);
  }

  moveCharacter(characterId: string, from: Position, to: Position): boolean {
    const fromCell = this.grid.getCell(from);
    if (fromCell && fromCell.occupantId === characterId) {
      if (this.grid.setOccupant(to, characterId)) {
        fromCell.occupantId = null;
        return true;
      }
    }
    return false;
  }

  public hasLineOfSight(start: Position, end: Position): boolean {
    for (const feature of this.terrain) {
      if (feature.type === TerrainType.Obstacle) {
        for (let i = 0, j = feature.vertices.length - 1; i < feature.vertices.length; j = i++) {
          const p1 = feature.vertices[j];
          const p2 = feature.vertices[i];
          if (segmentsIntersect(start, end, p1, p2)) {
            return false; // LOS is blocked by an obstacle
          }
        }
      }
    }
    return true; // No obstacles block LOS
  }

  public generateNavigationMesh(): void {
    const points: Position[] = [];

    // Add battlefield corners
    points.push({ x: 0, y: 0 });
    points.push({ x: this.width, y: 0 });
    points.push({ x: 0, y: this.height });
    points.push({ x: this.width, y: this.height });

    // Add vertices from all terrain features that are not obstacles
    this.terrain.forEach(feature => {
      if (feature.type !== TerrainType.Obstacle) {
        points.push(...feature.vertices);
      }
    });

    // Create the Delaunay triangulation from the points
    this.navigationMesh = Delaunay.from(points, p => p.x, p => p.y);
  }

  // A getter to expose the mesh for pathfinding
  getNavMesh(): Delaunay<Position> | null {
      return this.navigationMesh;
  }
}
