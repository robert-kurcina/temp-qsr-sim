import pathfinding from 'pathfinding';
import { Battlefield } from '../Battlefield';
import { Position } from '../Position';
import { TerrainType } from '../terrain/Terrain';
import { pointInPolygon } from '../terrain/BattlefieldUtils';

const { AStarFinder, Grid: PFGrid } = pathfinding as {
  AStarFinder: new (options: { diagonalMovement: number; heuristic: (dx: number, dy: number) => number }) => any;
  Grid: typeof import('pathfinding').Grid;
};

export class Pathfinder {
  private battlefield: Battlefield;
  private finder: any;

  constructor(battlefield: Battlefield) {
    this.battlefield = battlefield;
    // Allow diagonal movement, but penalize it slightly to prefer straight lines
    this.finder = new AStarFinder({
      diagonalMovement: 2, // 2 is DiagonalMovement.OnlyWhenNoObstacles
      heuristic: (dx, dy) => Math.hypot(dx, dy) // Use Euclidean distance
    });
  }

  public findPath(start: Position, end: Position): Position[] {
    const pfGrid = new PFGrid(this.battlefield.width, this.battlefield.height);

    // Mark obstacle cells as unwalkable by checking if the cell center is within a polygon
    for (let y = 0; y < this.battlefield.height; y++) {
      for (let x = 0; x < this.battlefield.width; x++) {
        const currentPoint = { x: x + 0.5, y: y + 0.5 }; // Check cell center
        for (const feature of this.battlefield.terrain) {
          if (feature.type === TerrainType.Obstacle && pointInPolygon(currentPoint, feature.vertices)) {
            pfGrid.setWalkableAt(x, y, false);
            break; // Point is in an obstacle, no need to check other features
          }
        }
      }
    }

    // Mark cells occupied by other characters as unwalkable
    for (let y = 0; y < this.battlefield.height; y++) {
        for (let x = 0; x < this.battlefield.width; x++) {
            const cell = this.battlefield.grid.getCell({ x, y });
            // Make sure the start and end points of the path are considered walkable
            const isStart = x === start.x && y === start.y;
            const isEnd = x === end.x && y === end.y;
            if (cell?.isOccupied() && !isStart && !isEnd) {
                pfGrid.setWalkableAt(x, y, false);
            }
        }
    }

    const gridBackup = pfGrid.clone();
    const path = this.finder.findPath(start.x, start.y, end.x, end.y, gridBackup);

    // Convert path from [x, y] arrays to Position objects
    return path.map((p: any) => ({ x: p[0], y: p[1] }));
  }
}
