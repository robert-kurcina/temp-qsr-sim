import { gameData } from '../../data';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './Terrain';

export type TerrainShape = 'circle' | 'ellipse' | 'rectangle';

export interface TerrainElementInfo {
  shape: TerrainShape;
  dimensions: Record<string, number>;
  movement: string;
  los: string;
  initialMovement?: string;
  dimensionsNote?: string;
}

export class TerrainElement {
  public info: TerrainElementInfo;

  constructor(public name: string, public position: Position) {
    const info = (gameData.terrain_info as Record<string, TerrainElementInfo>)[name];
    if (!info) {
      throw new Error(`Unknown terrain element: ${name}`);
    }
    this.info = info;
  }

  private resolveTerrainType(): TerrainType {
    if (this.info.los === 'Blocking') return TerrainType.Obstacle;
    if (this.info.movement === 'Impassable') return TerrainType.Impassable;
    if (this.info.movement === 'Difficult') return TerrainType.Difficult;
    if (this.info.movement === 'Rough') return TerrainType.Rough;
    return TerrainType.Clear;
  }

  private circleVertices(radius: number, segments: number = 16): Position[] {
    const points: Position[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      points.push({
        x: this.position.x + radius * Math.cos(angle),
        y: this.position.y + radius * Math.sin(angle),
      });
    }
    return points;
  }

  private ellipseVertices(radiusX: number, radiusY: number, segments: number = 16): Position[] {
    const points: Position[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      points.push({
        x: this.position.x + radiusX * Math.cos(angle),
        y: this.position.y + radiusY * Math.sin(angle),
      });
    }
    return points;
  }

  private rectangleVertices(width: number, height: number): Position[] {
    return [
      { x: this.position.x - width / 2, y: this.position.y - height / 2 },
      { x: this.position.x + width / 2, y: this.position.y - height / 2 },
      { x: this.position.x + width / 2, y: this.position.y + height / 2 },
      { x: this.position.x - width / 2, y: this.position.y + height / 2 },
    ];
  }

  public toFeature(): TerrainFeature {
    const type = this.resolveTerrainType();
    const { shape, dimensions } = this.info;

    let vertices: Position[];
    if (shape === 'circle') {
      const diameter = dimensions.diameter;
      if (!diameter) throw new Error(`Terrain "${this.name}" missing diameter.`);
      vertices = this.circleVertices(diameter / 2);
    } else if (shape === 'ellipse') {
      const width = dimensions.width;
      const height = dimensions.height;
      if (!width || !height) throw new Error(`Terrain "${this.name}" missing width/height.`);
      vertices = this.ellipseVertices(width / 2, height / 2);
    } else {
      const width = dimensions.width;
      const height = dimensions.height;
      if (!width || !height) throw new Error(`Terrain "${this.name}" missing width/height.`);
      vertices = this.rectangleVertices(width, height);
    }

    return {
      id: this.name,
      type,
      vertices,
      meta: {
        name: this.name,
        movement: this.info.movement,
        los: this.info.los,
        shape: this.info.shape,
        dimensions: this.info.dimensions,
      },
    };
  }
}
