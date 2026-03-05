/**
 * Battlefield System
 *
 * Terrain, LOS, pathfinding, and spatial rules.
 */

// Core
export { Battlefield, type BattlefieldOpennessStats } from './Battlefield';
export { Position } from './Position';

// Spatial
export { SpatialRules, type SpatialModel } from './spatial/spatial-rules';
export { EngagementManager, type EngagementPair, type EngagementQueryResult, type MeleeReachResult, createEngagementManager } from './spatial/engagement-manager';
export { ModelRegistry, MeasurementUtils } from './spatial/model-registry';
export { getBaseDiameterFromSiz } from './spatial/size-utils';

// Pathfinding
export { Pathfinder } from './pathfinding/Pathfinder';
export { PathfindingEngine } from './pathfinding/PathfindingEngine';
export { ConstrainedNavMesh } from './pathfinding/ConstrainedNavMesh';
export { Grid } from './pathfinding/Grid';
export { Cell } from './pathfinding/Cell';
export { OccupancyField } from './pathfinding/OccupancyField';

// LOS
export { LOSValidator } from './los/los-validator';
export { LOSOperations } from './los/LOSOperations';
export { LOFOperations } from './los/LOFOperations';

// Terrain
export { TerrainType, type TerrainFeature } from './terrain/Terrain';
export { TerrainElement } from './terrain/TerrainElement';
export { MoveValidator, type MovementValidationResult } from './terrain/move-validator';

// Rendering
export { SvgRenderer } from './rendering/SvgRenderer';
export { BattlefieldFactory, type BattlefieldFactoryConfig, type DeploymentZoneConfig } from './rendering/BattlefieldFactory';

// Validation
export {
  buildRangedActionContext,
  buildCloseCombatActionContext,
  resolveFriendlyFire,
  resolveChargeSnapPosition,
  type ActionContextInput,
  type CloseCombatContextInput,
} from './validation/action-context';
