import { gameData } from '../../../data';
import { Position } from '../Position';
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

/**
 * Terrain height data per OVR-003 (2D placeholder until 3D implementation)
 * QSR Reference: rules-overrides.md OVR-003
 */
export interface TerrainHeightData {
  height: number;  // MU
  largeHeight?: number;  // MU for Large variant
  climbHandsRequired?: '1H' | '2H' | 'none';
  canStandAtop: boolean;
  canJumpDown: boolean;
  isEnterable: boolean;
}

/**
 * Terrain height lookup table per OVR-003
 */
export const TERRAIN_HEIGHTS: Record<string, TerrainHeightData> = {
  // Walls: 1.0 MU (1.5 MU Large), [2H] up/[1H] down, can stand atop, can jump down
  'wall': { height: 1.0, largeHeight: 1.5, climbHandsRequired: '2H', canStandAtop: true, canJumpDown: true, isEnterable: true },
  'wall-large': { height: 1.5, climbHandsRequired: '2H', canStandAtop: true, canJumpDown: true, isEnterable: true },
  
  // Buildings: 3.0 MU (4.0 MU Large), cannot enter/climb (3D required)
  'building': { height: 3.0, largeHeight: 4.0, climbHandsRequired: 'none', canStandAtop: false, canJumpDown: false, isEnterable: false },
  'building-large': { height: 4.0, climbHandsRequired: 'none', canStandAtop: false, canJumpDown: false, isEnterable: false },
  
  // Trees: 6.0 MU, cannot enter/climb
  'tree': { height: 6.0, climbHandsRequired: 'none', canStandAtop: false, canJumpDown: false, isEnterable: false },
  
  // Shrubs: 0.5 MU, can stand atop, move down only (no jump)
  'shrub': { height: 0.5, climbHandsRequired: 'none', canStandAtop: true, canJumpDown: false, isEnterable: true },
  
  // Rocky: 0.5 MU, can stand atop, climb without Hands, no jump down/across
  'rocky': { height: 0.5, climbHandsRequired: 'none', canStandAtop: true, canJumpDown: false, isEnterable: true },
};

export class TerrainElement {
  public info: TerrainElementInfo;
  public isLarge: boolean;

  constructor(
    public name: string,
    public position: Position,
    public rotationDegrees: number = 0,
    isLarge: boolean = false
  ) {
    const info = (gameData.terrain_info as Record<string, TerrainElementInfo>)[name];
    if (!info) {
      throw new Error(`Unknown terrain element: ${name}`);
    }
    this.info = info;
    this.isLarge = isLarge;
  }

  private resolveHeightDataKey(): string {
    const normalized = this.name.toLowerCase().trim();

    if (normalized.includes('building')) {
      return this.isLarge || normalized.includes('large') ? 'building-large' : 'building';
    }
    if (normalized.includes('wall')) {
      return this.isLarge || normalized.includes('large') ? 'wall-large' : 'wall';
    }
    if (normalized.includes('rock')) {
      return 'rocky';
    }
    if (normalized.includes('shrub') || normalized.includes('bush')) {
      return 'shrub';
    }
    if (normalized.includes('tree')) {
      return 'tree';
    }

    return normalized;
  }

  private getHeightData(): TerrainHeightData | undefined {
    return TERRAIN_HEIGHTS[this.resolveHeightDataKey()];
  }

  /**
   * Get terrain height per OVR-003 (2D placeholder)
   * QSR Reference: rules-overrides.md OVR-003
   */
  getHeight(): number {
    const heightData = this.getHeightData();
    if (!heightData) return 0;
    
    // Use large height if this is a large terrain element
    if (this.isLarge && heightData.largeHeight) {
      return heightData.largeHeight;
    }
    
    return heightData.height;
  }

  /**
   * Get climb hand requirements per OVR-003
   * QSR Reference: rules-overrides.md OVR-003
   */
  getClimbHandRequirement(goingUp: boolean): number {
    const heightData = this.getHeightData();
    if (!heightData || !heightData.climbHandsRequired) return 0;
    
    if (goingUp && heightData.climbHandsRequired === '2H') return 2;
    if (!goingUp && heightData.climbHandsRequired === '1H') return 1;
    if (heightData.climbHandsRequired === 'none') return 0;
    
    // Default: 2H up, 1H down
    return goingUp ? 2 : 1;
  }

  /**
   * Check if model can stand atop this terrain per OVR-003
   * QSR Reference: rules-overrides.md OVR-003
   */
  canStandAtop(): boolean {
    const heightData = this.getHeightData();
    return heightData?.canStandAtop ?? false;
  }

  /**
   * Check if model can jump down from this terrain per OVR-003
   * QSR Reference: rules-overrides.md OVR-003
   */
  canJumpDown(): boolean {
    const heightData = this.getHeightData();
    if (!heightData?.canJumpDown) return false;
    
    // Minimum 1.0 MU height required for jump down
    return this.getHeight() >= 1.0;
  }

  /**
   * Check if model can enter this terrain per OVR-003
   * QSR Reference: rules-overrides.md OVR-003
   */
  isEnterable(): boolean {
    const heightData = this.getHeightData();
    return heightData?.isEnterable ?? true;
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
