export interface Coordinate {
  x: number;
  y: number;
}

export enum TerrainType {
  Impassable = 'Impassable',
  Rough = 'Rough',
  Difficult = 'Difficult',
  Clear = 'Clear',
}

export abstract class Terrain {
  constructor(public position: Coordinate, public type: TerrainType) {}

  abstract getFootprint(): Coordinate[];
}

export class CircularTerrain extends Terrain {
  constructor(position: Coordinate, type: TerrainType, public radius: number) {
    super(position, type);
  }

  getFootprint(): Coordinate[] {
    // For simplicity, we'll represent the circle as a series of points.
    // A more accurate collision detection would be needed for a real implementation.
    const points: Coordinate[] = [];
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      points.push({
        x: this.position.x + this.radius * Math.cos(angle),
        y: this.position.y + this.radius * Math.sin(angle),
      });
    }
    return points;
  }
}

export class RectangularTerrain extends Terrain {
  constructor(position: Coordinate, type: TerrainType, public width: number, public height: number) {
    super(position, type);
  }

  getFootprint(): Coordinate[] {
    return [
      { x: this.position.x - this.width / 2, y: this.position.y - this.height / 2 },
      { x: this.position.x + this.width / 2, y: this.position.y - this.height / 2 },
      { x: this.position.x + this.width / 2, y: this.position.y + this.height / 2 },
      { x: this.position.x - this.width / 2, y: this.position.y + this.height / 2 },
    ];
  }
}

export class EllipticalTerrain extends Terrain {
  constructor(position: Coordinate, type: TerrainType, public radiusX: number, public radiusY: number) {
    super(position, type);
  }

  getFootprint(): Coordinate[] {
    const points: Coordinate[] = [];
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      points.push({
        x: this.position.x + this.radiusX * Math.cos(angle),
        y: this.position.y + this.radiusY * Math.sin(angle),
      });
    }
    return points;
  }
}
