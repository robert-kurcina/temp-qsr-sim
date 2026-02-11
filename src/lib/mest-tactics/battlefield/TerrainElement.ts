import { gameData } from '../../data';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './Terrain';

export type TerrainShape = 'circle' | 'ellipse' | 'rectangle';

export interface TerrainElementInfo {
  category: string;
  distribution: number;
  color: string;
  shape: TerrainShape;
  dimensions: Record<string, number>;
  movement: string;
  los: string;
  initialMovement?: string;
  dimensionsNote?: string;
}

export class TerrainElement {
  public info: TerrainElementInfo;

  constructor(
    public name: string,
    public position: Position,
    public rotationDegrees: number = 0
  ) {
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

  private rotateVertices(vertices: Position[]): Position[] {
    if (!this.rotationDegrees) return vertices;
    const angle = (this.rotationDegrees * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return vertices.map(vertex => {
      const dx = vertex.x - this.position.x;
      const dy = vertex.y - this.position.y;
      return {
        x: this.position.x + dx * cos - dy * sin,
        y: this.position.y + dx * sin + dy * cos,
      };
    });
  }

  private resolveDimension(
    dimensions: Record<string, number>,
    primary: string,
    fallback?: string
  ): number {
    const value = dimensions[primary] ?? (fallback ? dimensions[fallback] : undefined);
    if (!value) {
      const suffix = fallback ? `/${fallback}` : '';
      throw new Error(`Terrain "${this.name}" missing ${primary}${suffix}.`);
    }
    return value;
  }

  public getArea(): number {
    const { shape, dimensions } = this.info;
    if (shape === 'circle') {
      const diameter = this.resolveDimension(dimensions, 'diameter');
      const radius = diameter / 2;
      return Math.PI * radius * radius;
    }
    if (shape === 'ellipse') {
      const width = this.resolveDimension(dimensions, 'width');
      const length = this.resolveDimension(dimensions, 'length', 'height');
      return Math.PI * (width / 2) * (length / 2);
    }
    const width = this.resolveDimension(dimensions, 'width');
    const length = this.resolveDimension(dimensions, 'length', 'height');
    return width * length;
  }

  public getBoundingRadius(): number {
    const { shape, dimensions } = this.info;
    if (shape === 'circle') {
      const diameter = this.resolveDimension(dimensions, 'diameter');
      return diameter / 2;
    }
    if (shape === 'ellipse') {
      const width = this.resolveDimension(dimensions, 'width');
      const length = this.resolveDimension(dimensions, 'length', 'height');
      return Math.max(width, length) / 2;
    }
    const width = this.resolveDimension(dimensions, 'width');
    const length = this.resolveDimension(dimensions, 'length', 'height');
    return Math.sqrt((width / 2) ** 2 + (length / 2) ** 2);
  }

  public toFeature(): TerrainFeature {
    const type = this.resolveTerrainType();
    const { shape, dimensions } = this.info;

    let vertices: Position[];
    if (shape === 'circle') {
      const diameter = this.resolveDimension(dimensions, 'diameter');
      vertices = this.circleVertices(diameter / 2);
    } else if (shape === 'ellipse') {
      const width = this.resolveDimension(dimensions, 'width');
      const length = this.resolveDimension(dimensions, 'length', 'height');
      vertices = this.ellipseVertices(width / 2, length / 2);
    } else {
      const width = this.resolveDimension(dimensions, 'width');
      const length = this.resolveDimension(dimensions, 'length', 'height');
      vertices = this.rectangleVertices(width, length);
    }

    vertices = this.rotateVertices(vertices);

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
        rotationDegrees: this.rotationDegrees,
        category: this.info.category,
        distribution: this.info.distribution,
        color: this.info.color,
        initialMovement: this.info.initialMovement,
        layer: this.info.category === 'area' ? 'area' : (this.info.los === 'Blocking' ? 'blocking' : 'terrain'),
      },
    };
  }
}
