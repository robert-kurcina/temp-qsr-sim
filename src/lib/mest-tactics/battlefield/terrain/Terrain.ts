import { Position } from '../Position';

export enum TerrainType {
  Clear = 'Clear',
  Rough = 'Rough',
  Difficult = 'Difficult',
  Impassable = 'Impassable',
  Obstacle = 'Obstacle', // Blocks LOS and movement
  // Backward compatibility alias
  Blocking = 'Obstacle',
}

export interface TerrainFeature {
  id: string;
  type: TerrainType | `${TerrainType}`;
  vertices: Position[]; // A polygon representing the terrain area
  meta?: {
    name?: string;
    movement?: string;
    los?: string;
    shape?: string;
    dimensions?: Record<string, number>;
    rotationDegrees?: number;
    category?: string;
    distribution?: number;
    color?: string;
    layer?: string;
    initialMovement?: string;
    height?: number; // Backward compatibility
  };
  // Backward compatibility properties
  movement?: string;
  los?: string;
  bounds?: { x: number; y: number; width: number; height: number }; // For scatter calculations
  elevation?: number; // For slope/height calculations
}
