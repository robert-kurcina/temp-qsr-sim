import { Position } from './Position';

export enum TerrainType {
  Clear = 'Clear',
  Rough = 'Rough',
  Obstacle = 'Obstacle', // Blocks LOS and movement
}

export interface TerrainFeature {
  id: string;
  type: TerrainType;
  vertices: Position[]; // A polygon representing the terrain area
}
