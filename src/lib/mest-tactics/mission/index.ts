/**
 * Mission System
 *
 * Mission configuration, assembly building, and side management.
 */

// Assembly Builder
export {
  buildAssembly,
  buildProfile,
  type AssemblyRoster,
  type BuildProfileOptions,
  type AssemblyConfig,
} from './assembly-builder';

// Mission Side
export {
  MissionSide,
  SideMember as MissionSideMember,
  ModelSlot,
  createMissionSide,
  createKeyScore,
  type KeyScore,
  type KeyScoresBreakdown,
} from './MissionSide';

// Mission Side Builder
export {
  buildMissionSide,
  type MissionSideBuildOptions as BuildMissionSideOptions,
} from './MissionSideBuilder';

// Game Size
export { GameSize } from './assembly-builder';
export {
  CANONICAL_GAME_SIZE_ORDER,
  type CanonicalGameSize,
  type CanonicalGameSizeRow,
  CANONICAL_GAME_SIZES,
} from './game-size-canonical';

// Objective Markers
export {
  ObjectiveMarkerManager,
  ObjectiveMarker,
  type ObjectiveMarkerConfig,
} from './objective-markers';

// Mission Scoring - Note: types are in missions/
// MissionScoring class was removed - using functions instead
export {
  // MissionScoring, // Removed - using functions from mission-scoring.ts
  // type ScoringContext, // Not exported from mission-scoring
  // type VictoryCondition, // Not exported from mission-scoring
} from '../missions/mission-scoring';

// Deployment
export {
  DeploymentState as DeploymentSystem,
  type DeploymentConfig,
  type DeploymentZone,
} from './deployment-system';

// Balance Validator
export {
  BalanceValidator,
  // type BalanceReport, // Not exported
} from './balance-validator';

// BP Validator
export {
  // BPValidator, // Not exported
  type BPValidationResult,
} from './bp-validator';

// Special Rules
export {
  SpecialRuleHandler as SpecialRulesManager,
  // type SpecialRule, // Not exported
} from './special-rules';

// Victory Conditions
export {
  VictoryCondition,
  // type VictoryCheckResult, // Not exported
} from './victory-conditions';

// Reinforcements
export {
  // ReinforcementsSystem, // Not exported
  type ReinforcementGroupConfig as ReinforcementConfig,
  // type ReinforcementWave, // Not exported
} from './reinforcements-system';

// VIP System
export {
  // VIPSystem, // Not exported
  VIP as VIPConfig,
} from './vip-system';

// POI Zone Control
export {
  // POIZoneControl, // Not exported
  type POIConfig,
  // type POIZone, // Not exported
} from './poi-zone-control';

// Zone Factory
export {
  ZoneFactory,
  // type ZoneConfig, // Not exported from zone-factory.ts
} from './zone-factory';

// Scoring Rules
export {
  ScoringRule as ScoringRules,
  // type ScoringModifier, // Not exported
} from './scoring-rules';

// Heuristic Scorer
export {
  // HeuristicScorer, // Not exported
  // type HeuristicScore, // Not exported
} from './heuristic-scorer';

// Side Spatial Binding
export {
  SideSpatialBinding,
} from './side-spatial-binding';

// Predicted Scoring - Note: PredictedScoring is part of MissionSide.ts
// export {
//   PredictedScoring,
//   type PredictionConfig,
// } from '../missions/predicted-scoring';

// Mission Event Hooks
export {
  MissionEventHooks,
  type MissionEvent,
} from '../missions/mission-event-hooks';

// Objective Marker Keys
export {
  // ObjectiveMarkerKeys, // Not exported
  // type KeyConfig, // Not exported
} from '../missions/mission-keys';

// Mission Objectives
export {
  // MissionObjectives, // Not exported
  // type ObjectiveConfig, // Not exported
} from '../missions/mission-objectives';

// Deployment Exporter
export {
  writeDeploymentExport as DeploymentExporter,
  type DeploymentExport,
} from './DeploymentExporter';
