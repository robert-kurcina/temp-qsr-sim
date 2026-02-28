/**
 * Terrain Module
 * 
 * Terrain placement, validation, and fitness checking.
 * 
 * @example
 * ```typescript
 * import { TerrainPlacementService, TerrainFitness } from './terrain';
 * 
 * // Place terrain
 * const result = TerrainPlacementService.placeTerrain({
 *   mode: 'balanced',
 *   density: 50,
 *   battlefieldSize: 48,
 *   seed: 12345,
 * });
 * 
 * // Validate fitness
 * const fitness = TerrainFitness.validateTerrainFitness(
 *   result.terrain,
 *   48,  // battlefield size
 *   0.5  // min spacing
 * );
 * ```
 */

export * from './Terrain';
export * from './TerrainElement';
export * from './TerrainFitness';
export * from './TerrainPlacement';
