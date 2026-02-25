import { Terrain, Coordinate } from '../spatial';

export interface Occupant {
  position: Coordinate;
  baseDiameter: number;
}

export class OccupancyField {
  public occupants: Occupant[] = [];
  public terrain: Terrain[] = [];

  constructor(public width: number, public height: number) {}

  public addOccupant(occupant: Occupant): void {
    this.occupants.push(occupant);
  }

  public addTerrain(terrain: Terrain): void {
    this.terrain.push(terrain);
  }

  public isOccupied(position: Coordinate): boolean {
    // This is a simplified check. A more robust implementation would use a proper collision detection algorithm.
    for (const occupant of this.occupants) {
      const distance = Math.sqrt(Math.pow(occupant.position.x - position.x, 2) + Math.pow(occupant.position.y - position.y, 2));
      if (distance < occupant.baseDiameter / 2) {
        return true;
      }
    }

    for (const t of this.terrain) {
      const footprint = t.getFootprint();
      // This is a placeholder for a point-in-polygon check.
      if (footprint.length > 0) {
        // A simple bounding box check for now
        const xs = footprint.map(p => p.x);
        const ys = footprint.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        if (position.x >= minX && position.x <= maxX && position.y >= minY && position.y <= maxY) {
          return true;
        }
      }
    }

    return false;
  }
}
