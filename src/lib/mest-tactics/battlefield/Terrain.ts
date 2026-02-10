import { Position } from './Position';

export enum TerrainType {
  Clear = 'Clear',
  Rough = 'Rough',
  Difficult = 'Difficult',
  Impassable = 'Impassable',
  Obstacle = 'Obstacle', // Blocks LOS and movement
}

export interface TerrainFeature {
  id: string;
  type: TerrainType;
  vertices: Position[]; // A polygon representing the terrain area
  meta?: {
    name: string;
    movement: string;
    los: string;
    shape: string;
    dimensions: Record<string, number>;
  };
}
