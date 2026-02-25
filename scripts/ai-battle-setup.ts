/**
 * AI Battle Setup CLI
 * 
 * Interactive command-line tool for setting up and running AI-only game sessions.
 * Prompts for mission selection, game size, AI configuration, and tactical doctrines.
 * 
 * Usage:
 *   npm run ai-battle                    # Quick battle with defaults
 *   npm run ai-battle -- -i              # Interactive setup
 *   npm run ai-battle -- -r <report.json># Render JSON battle report
 *   npm run ai-battle -- -v VERY_LARGE 50 3 424242 # Validation batch
 *   npm run ai-battle -- VERY_LARGE 50   # Quick battle with size and density
 */

import * as readline from 'readline';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Character } from '../src/lib/mest-tactics/core/Character';
import type { Item } from '../src/lib/mest-tactics/core/Item';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { GameManager } from '../src/lib/mest-tactics/engine/GameManager';
import { Position } from '../src/lib/mest-tactics/battlefield/Position';
import { SpatialRules } from '../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../src/lib/mest-tactics/battlefield/spatial/size-utils';
import { buildAssembly, buildProfile, GameSize } from '../src/lib/mest-tactics/mission/assembly-builder';
import { MissionSide, ModelSlotStatus } from '../src/lib/mest-tactics/mission/MissionSide';
import { ObjectiveMarkerKind, ObjectiveMarkerManager } from '../src/lib/mest-tactics/mission/objective-markers';
import {
  createMissionRuntimeAdapter,
  MissionRuntimeAdapter,
  MissionRuntimeUpdate,
} from '../src/lib/mest-tactics/missions/mission-runtime-adapter';
import { MissionModel } from '../src/lib/mest-tactics/missions/mission-keys';
import {
  TacticalDoctrine,
  TACTICAL_DOCTRINE_INFO,
  getDoctrinesByEngagement,
  deriveDoctrineAIPressure,
  getDoctrineComponents,
  EngagementStyle,
  PlanningPriority,
  AggressionLevel,
} from '../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { CharacterAI, DEFAULT_CHARACTER_AI_CONFIG } from '../src/lib/mest-tactics/ai/core/CharacterAI';
import { AIContext, AIControllerConfig, CharacterKnowledge } from '../src/lib/mest-tactics/ai/core/AIController';
import { attemptHide, attemptDetect } from '../src/lib/mest-tactics/status/concealment';
import { LOFOperations } from '../src/lib/mest-tactics/battlefield/los/LOFOperations';
import { PathfindingEngine } from '../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import {
  applyBonusAction,
  type BonusActionOption,
  type BonusActionOutcome,
  type BonusActionSelection,
  type BonusActionType,
} from '../src/lib/mest-tactics/actions/bonus-actions';
import type { PassiveEvent, PassiveOption, PassiveOptionType } from '../src/lib/mest-tactics/status/passive-options';
import type { TestContext } from '../src/lib/mest-tactics/utils/TestContext';
import {
  LightingCondition,
  evaluateRangeWithVisibility,
  getVisibilityOrForLighting,
  parseWeaponOptimalRangeMu,
} from '../src/lib/mest-tactics/utils/visibility';

// ============================================================================
// Configuration
// ============================================================================

interface GameConfig {
  missionId: string;
  missionName: string;
  gameSize: GameSize;
  battlefieldSize: number;
  maxTurns: number;
  endGameTurn: number;
  sides: SideConfig[];
  densityRatio: number;
  lighting: LightingCondition;
  visibilityOrMu: number;
  maxOrm: number;
  allowConcentrateRangeExtension: boolean;
  perCharacterFovLos: boolean;
  verbose: boolean;
  seed?: number;
}

interface SideConfig {
  name: string;
  bp: number;
  modelCount: number;
  tacticalDoctrine: TacticalDoctrine;
  loadoutProfile?: 'default' | 'melee_only';
  assemblyName: string;
  aggression: number;
  caution: number;
}

interface BattleStats {
  totalActions: number;
  moves: number;
  closeCombats: number;
  rangedCombats: number;
  disengages: number;
  waits: number;
  waitMaintained: number;
  waitUpkeepPaid: number;
  detects: number;
  hides: number;
  reacts: number;
  eliminations: number;
  kos: number;
  turnsCompleted: number;
  losChecks: number;
  lofChecks: number;
  totalPathLength: number;
  modelsMoved: number;
}

interface BattleLogEntry {
  turn: number;
  round: number;
  modelId: string;
  side: string;
  model: string;
  action: string;
  detail?: string;
  result?: string;
}

interface ModelUsageStats {
  modelId: string;
  modelName: string;
  side: string;
  pathLength: number;
  moveActions: number;
  waitAttempts: number;
  waitSuccesses: number;
  detectAttempts: number;
  detectSuccesses: number;
  hideAttempts: number;
  hideSuccesses: number;
  reactAttempts: number;
  reactSuccesses: number;
}

interface UsageMetrics {
  modelCount: number;
  modelsMoved: number;
  modelsUsedWait: number;
  modelsUsedDetect: number;
  modelsUsedHide: number;
  modelsUsedReact: number;
  totalPathLength: number;
  averagePathLengthPerMovedModel: number;
  averagePathLengthPerModel: number;
  topPathModels: ModelUsageStats[];
  modelUsage: ModelUsageStats[];
}

interface CharacterSection {
  id: string;
  name: string;
  profile: {
    name: string;
    archetype: string;
    attributes: Record<string, number>;
    finalAttributes: Record<string, number>;
    totalBp?: number;
    burdenTotal?: number;
    equipment: Array<{
      name: string;
      classification?: string;
      traits?: string[];
    }>;
  };
  startPosition?: Position;
  endPosition?: Position;
  state: ModelStateAudit;
}

interface AssemblySection {
  name: string;
  totalBP: number;
  characters: CharacterSection[];
}

interface SideSection {
  name: string;
  assemblies: AssemblySection[];
}

interface BattlefieldLayoutSection {
  widthMu: number;
  heightMu: number;
  densityRatio: number;
  terrainFeatures: Array<{
    id: string;
    type: string;
    metaName?: string;
    movement?: string;
    los?: string;
    rotationDegrees?: number;
    vertices: Position[];
  }>;
  deployments: Array<{
    characterId: string;
    characterName: string;
    sideName: string;
    assemblyName: string;
    startPosition?: Position;
    endPosition?: Position;
  }>;
}

interface NestedSections {
  sides: SideSection[];
  battlefieldLayout: BattlefieldLayoutSection;
}

interface RuleTypeBreakdown {
  [type: string]: number;
}

interface BonusActionMetrics {
  opportunities: number;
  optionsOffered: number;
  optionsAvailable: number;
  offeredByType: RuleTypeBreakdown;
  availableByType: RuleTypeBreakdown;
  executed: number;
  executedByType: RuleTypeBreakdown;
}

interface PassiveOptionMetrics {
  opportunities: number;
  optionsOffered: number;
  optionsAvailable: number;
  offeredByType: RuleTypeBreakdown;
  availableByType: RuleTypeBreakdown;
  used: number;
  usedByType: RuleTypeBreakdown;
}

interface SituationalModifierMetrics {
  testsObserved: number;
  modifiedTests: number;
  modifiersApplied: number;
  byType: RuleTypeBreakdown;
}

interface AdvancedRuleMetrics {
  bonusActions: BonusActionMetrics;
  passiveOptions: PassiveOptionMetrics;
  situationalModifiers: SituationalModifierMetrics;
}

interface ModelStateAudit {
  wounds: number;
  delayTokens: number;
  fearTokens: number;
  isKOd: boolean;
  isEliminated: boolean;
  isHidden: boolean;
  isWaiting: boolean;
  isAttentive: boolean;
  isOrdered: boolean;
}

interface OpposedTestAudit {
  pass: boolean;
  score?: number;
  participant1Score?: number;
  participant2Score?: number;
  p1Rolls?: number[];
  p2Rolls?: number[];
  finalPools?: Record<string, unknown>;
}

interface AuditVector {
  kind: 'movement' | 'los' | 'lof';
  from: Position;
  to: Position;
  distanceMu: number;
  widthMu?: number;
  sampleStepMu?: number;
  sampledPoints?: Position[];
}

interface ModelEffectAudit {
  modelId: string;
  modelName: string;
  side?: string;
  relation: 'self' | 'target' | 'opponent' | 'ally' | 'reactor';
  before: ModelStateAudit;
  after: ModelStateAudit;
  changed: string[];
}

interface ActionStepAudit {
  sequence: number;
  actionType: string;
  decisionReason?: string;
  resultCode: string;
  success: boolean;
  apBefore: number;
  apAfter: number;
  apSpent: number;
  actorPositionBefore?: Position;
  actorPositionAfter?: Position;
  actorStateBefore: ModelStateAudit;
  actorStateAfter: ModelStateAudit;
  vectors: AuditVector[];
  targets: Array<{
    modelId: string;
    modelName: string;
    side?: string;
    relation: 'enemy' | 'ally' | 'self';
  }>;
  affectedModels: ModelEffectAudit[];
  interactions: Array<{
    kind: 'action' | 'react' | 'opportunity_attack' | 'status' | 'opposed_test';
    sourceModelId: string;
    targetModelId?: string;
    success?: boolean;
    detail?: string;
  }>;
  opposedTest?: OpposedTestAudit;
  rangeCheck?: {
    distanceMu: number;
    weaponOrMu: number;
    visibilityOrMu: number;
    orm: number;
    effectiveOrMu: number;
    concentratedOrm: number;
    concentratedOrMu: number;
    requiresConcentrate: boolean;
  };
  details?: Record<string, unknown>;
}

interface ActivationAudit {
  activationSequence: number;
  turn: number;
  sideIndex: number;
  sideName: string;
  modelId: string;
  modelName: string;
  initiative: number;
  apStart: number;
  apEnd: number;
  waitAtStart: boolean;
  waitMaintained: boolean;
  waitUpkeepPaid: boolean;
  delayTokensAtStart: number;
  delayTokensAfterUpkeep: number;
  steps: ActionStepAudit[];
  skippedReason?: string;
}

interface TurnAudit {
  turn: number;
  activations: ActivationAudit[];
  sideSummaries: Array<{
    sideName: string;
    activeModelsStart: number;
    activeModelsEnd: number;
  }>;
}

interface BattleAuditTrace {
  version: '1.0';
  session: {
    missionId: string;
    missionName: string;
    seed?: number;
    lighting: LightingCondition;
    visibilityOrMu: number;
    maxOrm: number;
    allowConcentrateRangeExtension: boolean;
    perCharacterFovLos: boolean;
  };
  battlefield: {
    widthMu: number;
    heightMu: number;
    movementSampleStepMu: number;
    lofWidthMu: number;
  };
  turns: TurnAudit[];
}

interface ReactAuditResult {
  executed: boolean;
  reactor?: Character;
  resultCode?: string;
  vector?: AuditVector;
  opposedTest?: OpposedTestAudit;
  details?: Record<string, unknown>;
  rawResult?: unknown;
}

export interface BattleReport {
  config: GameConfig;
  winner: string;
  finalCounts: Array<{ name: string; remaining: number }>;
  stats: BattleStats;
  missionRuntime?: {
    vpBySide: Record<string, number>;
    rpBySide: Record<string, number>;
    immediateWinnerSideId?: string;
  };
  usage?: UsageMetrics;
  nestedSections: NestedSections;
  advancedRules: AdvancedRuleMetrics;
  log: BattleLogEntry[];
  audit?: BattleAuditTrace;
  seed?: number;
}

interface ValidationCoverage {
  movement: boolean;
  pathfinding: boolean;
  rangedCombat: boolean;
  closeCombat: boolean;
  react: boolean;
  wait: boolean;
  detect: boolean;
  los: boolean;
  lof: boolean;
}

interface ValidationAggregateReport {
  missionId: string;
  gameSize: GameSize;
  densityRatio: number;
  tacticalDoctrine: string;
  sideDoctrines: Array<{
    sideName: string;
    tacticalDoctrine: TacticalDoctrine;
    loadoutProfile: 'default' | 'melee_only';
  }>;
  loadoutProfile: 'default' | 'melee_only';
  lighting: LightingCondition;
  visibilityOrMu: number;
  maxOrm: number;
  allowConcentrateRangeExtension: boolean;
  perCharacterFovLos: boolean;
  runs: number;
  baseSeed: number;
  winners: Record<string, number>;
  totals: BattleStats;
  averages: BattleStats;
  advancedRuleTotals: AdvancedRuleMetrics;
  advancedRuleAverages: AdvancedRuleMetrics;
  /** Union of runtime and probe coverage (legacy field). */
  coverage: ValidationCoverage;
  /** Coverage observed in actual battle runs only. */
  runtimeCoverage: ValidationCoverage;
  /** Coverage observed from synthetic mechanic probes only. */
  probeCoverage: ValidationCoverage;
  runReports: Array<{
    run: number;
    seed: number;
    winner: string;
    finalCounts: Array<{ name: string; remaining: number }>;
    stats: BattleStats;
    usage: {
      modelCount: number;
      modelsMoved: number;
      modelsUsedWait: number;
      modelsUsedDetect: number;
      modelsUsedHide: number;
      modelsUsedReact: number;
      totalPathLength: number;
      averagePathLengthPerMovedModel: number;
      averagePathLengthPerModel: number;
      topPathModels: ModelUsageStats[];
    };
    missionRuntime?: {
      vpBySide: Record<string, number>;
      rpBySide: Record<string, number>;
      immediateWinnerSideId?: string;
    };
    nestedSections: NestedSections;
    advancedRules: AdvancedRuleMetrics;
  }>;
  generatedAt: string;
}

const MISSION_NAME_BY_ID: Record<string, string> = {
  QAI_11: 'Elimination',
  QAI_12: 'Convergence',
  QAI_13: 'Assault',
  QAI_14: 'Dominion',
  QAI_15: 'Recovery',
  QAI_16: 'Escort',
  QAI_17: 'Triumvirate',
  QAI_18: 'Stealth',
  QAI_19: 'Defiance',
  QAI_20: 'Breach',
};

const GAME_SIZE_CONFIG: Record<GameSize, {
  name: string;
  modelsPerSide: [number, number];
  bpPerSide: [number, number];
  battlefieldSize: number;
  maxTurns: number;
  endGameTurn: number;
}> = {
  // QSR end-game trigger starts: Small=4, Medium=6, Large=8.
  VERY_SMALL: { name: 'Very Small', modelsPerSide: [2, 4], bpPerSide: [125, 250], battlefieldSize: 18, maxTurns: 10, endGameTurn: 4 },
  SMALL: { name: 'Small', modelsPerSide: [4, 8], bpPerSide: [250, 500], battlefieldSize: 24, maxTurns: 10, endGameTurn: 4 },
  MEDIUM: { name: 'Medium', modelsPerSide: [6, 12], bpPerSide: [500, 750], battlefieldSize: 36, maxTurns: 10, endGameTurn: 6 },
  LARGE: { name: 'Large', modelsPerSide: [8, 16], bpPerSide: [750, 1000], battlefieldSize: 48, maxTurns: 10, endGameTurn: 8 },
  VERY_LARGE: { name: 'Very Large', modelsPerSide: [16, 32], bpPerSide: [1000, 2000], battlefieldSize: 60, maxTurns: 10, endGameTurn: 8 },
};

// Map Tactical Doctrine to AI config
function doctrineToAIConfig(doctrine: TacticalDoctrine): Partial<AIControllerConfig> {
  const pressure = deriveDoctrineAIPressure(doctrine, {
    hasMeleeWeapons: true,
    hasRangedWeapons: true,
  });
  return {
    aggression: pressure.aggression,
    caution: pressure.caution,
  };
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function emptyKnowledge(turn: number): CharacterKnowledge {
  return {
    knownEnemies: new Map(),
    knownTerrain: new Map(),
    lastKnownPositions: new Map(),
    threatZones: [],
    safeZones: [],
    lastUpdated: turn,
  };
}

function createEmptyStats(): BattleStats {
  return {
    totalActions: 0,
    moves: 0,
    closeCombats: 0,
    rangedCombats: 0,
    disengages: 0,
    waits: 0,
    waitMaintained: 0,
    waitUpkeepPaid: 0,
    detects: 0,
    hides: 0,
    reacts: 0,
    eliminations: 0,
    kos: 0,
    turnsCompleted: 0,
    losChecks: 0,
    lofChecks: 0,
    totalPathLength: 0,
    modelsMoved: 0,
  };
}

function createEmptyAdvancedRuleMetrics(): AdvancedRuleMetrics {
  return {
    bonusActions: {
      opportunities: 0,
      optionsOffered: 0,
      optionsAvailable: 0,
      offeredByType: {},
      availableByType: {},
      executed: 0,
      executedByType: {},
    },
    passiveOptions: {
      opportunities: 0,
      optionsOffered: 0,
      optionsAvailable: 0,
      offeredByType: {},
      availableByType: {},
      used: 0,
      usedByType: {},
    },
    situationalModifiers: {
      testsObserved: 0,
      modifiedTests: 0,
      modifiersApplied: 0,
      byType: {},
    },
  };
}

const CONTEXT_MODIFIER_KEYS: Record<string, string> = {
  isCharge: 'charge',
  isDefending: 'defend',
  isOverreach: 'overreach',
  isSudden: 'sudden',
  hasSuddenness: 'suddenness',
  isConcentrating: 'concentrate',
  isFocusing: 'focus',
  isBlindAttack: 'blind_attack',
  assistingModels: 'assisting_models',
  outnumberAdvantage: 'outnumber_advantage',
  hasHighGround: 'high_ground',
  isCornered: 'cornered',
  isFlanked: 'flanked',
  orm: 'distance_orm',
  isPointBlank: 'point_blank',
  hasElevationAdvantage: 'elevation_advantage',
  obscuringModels: 'obscuring_models',
  isLeaning: 'leaning',
  isTargetLeaning: 'target_leaning',
  hasInterveningCover: 'intervening_cover',
  hasDirectCover: 'direct_cover',
  hasHardCover: 'hard_cover',
  isConfined: 'confined',
  blindersThrownPenalty: 'blinders_thrown_penalty',
  reactPenaltyBase: 'react_penalty',
  multipleAttackPenalty: 'multiple_attack_penalty',
  burstBonusBase: 'burst_bonus',
  handPenaltyBase: 'hand_penalty',
  sizeAdvantage: 'size_advantage',
  unarmedPenalty: 'unarmed_penalty',
  acrobaticBonus: 'acrobatic_bonus',
  elevationAdvantage: 'elevation_bonus',
};

function formatPathLeaders(topPathModels: ModelUsageStats[]): string {
  if (topPathModels.length === 0) {
    return '    none';
  }
  return topPathModels
    .map((model, index) => `    ${index + 1}. ${model.modelName} (${model.side}) - ${model.pathLength.toFixed(2)} MU over ${model.moveActions} move(s)`)
    .join('\n');
}

function formatTypeBreakdownLines(
  breakdown: RuleTypeBreakdown,
  indent: string = '    '
): string[] {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return [`${indent}none`];
  }
  return entries.map(([type, count]) => `${indent}${type}: ${count}`);
}

export function formatBattleReportHumanReadable(report: BattleReport): string {
  const fallbackUsage: UsageMetrics = {
    modelCount: report.finalCounts.reduce((sum, side) => sum + side.remaining, 0),
    modelsMoved: report.stats.modelsMoved ?? 0,
    modelsUsedWait: 0,
    modelsUsedDetect: 0,
    modelsUsedHide: 0,
    modelsUsedReact: 0,
    totalPathLength: report.stats.totalPathLength ?? 0,
    averagePathLengthPerMovedModel: 0,
    averagePathLengthPerModel: 0,
    topPathModels: [],
    modelUsage: [],
  };
  const usage = report.usage ?? fallbackUsage;
  const advancedRules = report.advancedRules ?? createEmptyAdvancedRuleMetrics();
  const nestedSections = report.nestedSections ?? {
    sides: [],
    battlefieldLayout: {
      widthMu: report.config.battlefieldSize,
      heightMu: report.config.battlefieldSize,
      densityRatio: report.config.densityRatio,
      terrainFeatures: [],
      deployments: [],
    },
  };
  if (usage.averagePathLengthPerMovedModel === 0 && usage.modelsMoved > 0) {
    usage.averagePathLengthPerMovedModel = usage.totalPathLength / usage.modelsMoved;
  }
  if (usage.averagePathLengthPerModel === 0 && usage.modelCount > 0) {
    usage.averagePathLengthPerModel = usage.totalPathLength / usage.modelCount;
  }

  const lines: string[] = [];
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('📊 BATTLE REPORT');
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`📋 Mission: ${report.config.missionName}`);
  lines.push(`📏 Game Size: ${GAME_SIZE_CONFIG[report.config.gameSize].name}`);
  lines.push(`🗺️  Battlefield: ${report.config.battlefieldSize}×${report.config.battlefieldSize} MU`);
  lines.push(`🌲 Terrain Density: ${report.config.densityRatio}%`);
  lines.push(`💡 Lighting: ${report.config.lighting} (Visibility OR ${report.config.visibilityOrMu} MU)`);
  lines.push(`🎲 Seed: ${report.seed ?? 'n/a'}`);
  lines.push(`⏱️  Turns Completed: ${report.stats.turnsCompleted}/${report.config.maxTurns}`);
  lines.push('');
  lines.push('🏆 RESULT');
  lines.push(`  Winner: ${report.winner}!`);
  if (report.missionRuntime) {
    lines.push('  Mission VP:');
    const vpEntries = Object.entries(report.missionRuntime.vpBySide);
    if (vpEntries.length === 0) {
      lines.push('    none');
    } else {
      vpEntries
        .sort((a, b) => b[1] - a[1])
        .forEach(([sideId, vp]) => lines.push(`    ${sideId}: VP ${vp}, RP ${report.missionRuntime?.rpBySide?.[sideId] ?? 0}`));
    }
    if (report.missionRuntime.immediateWinnerSideId) {
      lines.push(`  Mission Immediate Winner: ${report.missionRuntime.immediateWinnerSideId}`);
    }
  }
  lines.push('  Final Model Counts:');
  report.finalCounts.forEach(fc => {
    lines.push(`    ${fc.name}: ${fc.remaining} remaining`);
  });
  lines.push('');
  lines.push('📈 ACTION TOTALS');
  lines.push(`  Total Actions: ${report.stats.totalActions}`);
  lines.push(`  Moves: ${report.stats.moves}`);
  lines.push(`  Close Combats: ${report.stats.closeCombats}`);
  lines.push(`  Ranged Combats: ${report.stats.rangedCombats}`);
  lines.push(`  Disengages: ${report.stats.disengages}`);
  lines.push(`  Waits: ${report.stats.waits}`);
  lines.push(`  Wait Maintained: ${report.stats.waitMaintained}`);
  lines.push(`  Wait Upkeep Paid: ${report.stats.waitUpkeepPaid}`);
  lines.push(`  Detects: ${report.stats.detects}`);
  lines.push(`  Hides: ${report.stats.hides}`);
  lines.push(`  Reacts: ${report.stats.reacts}`);
  lines.push(`  LOS Checks: ${report.stats.losChecks}`);
  lines.push(`  LOF Checks: ${report.stats.lofChecks}`);
  lines.push(`  Eliminations: ${report.stats.eliminations}`);
  lines.push(`  KO's: ${report.stats.kos}`);
  lines.push('');
  lines.push('📐 MOVEMENT & USAGE');
  lines.push(`  Path Length (total): ${usage.totalPathLength.toFixed(2)} MU`);
  lines.push(`  Path Length (avg per moved model): ${usage.averagePathLengthPerMovedModel.toFixed(2)} MU`);
  lines.push(`  Path Length (avg per model): ${usage.averagePathLengthPerModel.toFixed(2)} MU`);
  lines.push(`  Models that moved: ${usage.modelsMoved}/${usage.modelCount}`);
  lines.push(`  Models that used Hidden: ${usage.modelsUsedHide}/${usage.modelCount}`);
  lines.push(`  Models that used Detect: ${usage.modelsUsedDetect}/${usage.modelCount}`);
  lines.push(`  Models that used Wait: ${usage.modelsUsedWait}/${usage.modelCount}`);
  lines.push(`  Models that used React: ${usage.modelsUsedReact}/${usage.modelCount}`);
  lines.push('  Top Path Length Models:');
  lines.push(formatPathLeaders(usage.topPathModels));
  lines.push('');
  lines.push('⚡ BONUS ACTIONS');
  lines.push(`  Opportunities: ${advancedRules.bonusActions.opportunities}`);
  lines.push(`  Options Offered: ${advancedRules.bonusActions.optionsOffered}`);
  lines.push(`  Options Available: ${advancedRules.bonusActions.optionsAvailable}`);
  lines.push(`  Executed: ${advancedRules.bonusActions.executed}`);
  lines.push('  Available By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.bonusActions.availableByType, '    '));
  lines.push('  Executed By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.bonusActions.executedByType, '    '));
  lines.push('');
  lines.push('🛡️  PASSIVE OPTIONS');
  lines.push(`  Opportunities: ${advancedRules.passiveOptions.opportunities}`);
  lines.push(`  Options Offered: ${advancedRules.passiveOptions.optionsOffered}`);
  lines.push(`  Options Available: ${advancedRules.passiveOptions.optionsAvailable}`);
  lines.push(`  Used: ${advancedRules.passiveOptions.used}`);
  lines.push('  Available By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.passiveOptions.availableByType, '    '));
  lines.push('  Used By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.passiveOptions.usedByType, '    '));
  lines.push('');
  lines.push('🎯 SITUATIONAL MODIFIERS');
  lines.push(`  Tests Observed: ${advancedRules.situationalModifiers.testsObserved}`);
  lines.push(`  Modified Tests: ${advancedRules.situationalModifiers.modifiedTests}`);
  lines.push(`  Modifiers Applied: ${advancedRules.situationalModifiers.modifiersApplied}`);
  const leanUses = (advancedRules.situationalModifiers.byType.leaning ?? 0)
    + (advancedRules.situationalModifiers.byType.detect_lean ?? 0);
  lines.push(`  Lean Uses: ${leanUses}`);
  lines.push('  Breakdown By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.situationalModifiers.byType, '    '));
  lines.push('');
  lines.push('🧱 NESTED SECTIONS');
  lines.push(`  Side Count: ${nestedSections.sides.length}`);
  for (const side of nestedSections.sides) {
    lines.push(`  Side: ${side.name}`);
    for (const assembly of side.assemblies) {
      lines.push(`    Assembly: ${assembly.name} (${assembly.characters.length} characters)`);
      for (const character of assembly.characters) {
        lines.push(`      Character: ${character.name}`);
        lines.push(`        Profile: ${character.profile.archetype}`);
      }
    }
  }
  lines.push('  Battlefield Layout:');
  lines.push(`    Size: ${nestedSections.battlefieldLayout.widthMu}x${nestedSections.battlefieldLayout.heightMu} MU`);
  lines.push(`    Density: ${nestedSections.battlefieldLayout.densityRatio}%`);
  lines.push(`    Terrain Features: ${nestedSections.battlefieldLayout.terrainFeatures.length}`);
  lines.push(`    Deployments: ${nestedSections.battlefieldLayout.deployments.length}`);
  lines.push('');
  lines.push('════════════════════════════════════════════════════════════');
  return lines.join('\n');
}

// ============================================================================
// Interactive Setup
// ============================================================================

class AIBattleSetup {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  private async selectMission(): Promise<{ id: string; name: string }> {
    console.log('\n📋 Select Mission:\n');
    console.log('  1. Elimination (QAI-11) - Last side with models remaining wins');
    
    const choice = await this.question('\nMission choice [1] (default: 1): ');
    return { id: 'QAI_11', name: 'Elimination' };
  }

  private async selectGameSize(): Promise<GameSize> {
    console.log('\n📏 Select Game Size:\n');
    console.log('  1. VERY_SMALL  (2-4 models/side, 125-250 BP, 18×18 MU)');
    console.log('  2. SMALL       (4-8 models/side, 250-500 BP, 24×24 MU)');
    console.log('  3. MEDIUM      (6-12 models/side, 500-750 BP, 36×36 MU)');
    console.log('  4. LARGE       (8-16 models/side, 750-1000 BP, 48×48 MU)');
    console.log('  5. VERY_LARGE  (16-32 models/side, 1000-2000 BP, 60×60 MU)');
    
    const choice = await this.question('\nGame size [1-5] (default: 5): ');
    
    const sizes: Record<string, GameSize> = {
      '1': GameSize.VERY_SMALL,
      '2': GameSize.SMALL,
      '3': GameSize.MEDIUM,
      '4': GameSize.LARGE,
      '5': GameSize.VERY_LARGE,
    };
    
    return sizes[choice] || GameSize.VERY_LARGE;
  }

  private async selectTacticalDoctrine(sideName: string): Promise<TacticalDoctrine> {
    console.log(`\n⚔️  Select Tactical Doctrine for ${sideName}:\n`);
    
    const groups = getDoctrinesByEngagement();
    
    console.log('  Melee-Centric:');
    groups.Melee.forEach((d, i) => {
      const info = TACTICAL_DOCTRINE_INFO[d];
      console.log(`    ${i + 1}. ${info.icon} ${info.name}`);
    });
    
    console.log('\n  Ranged-Centric:');
    groups.Ranged.forEach((d, i) => {
      const info = TACTICAL_DOCTRINE_INFO[d];
      console.log(`    ${i + 10}. ${info.icon} ${info.name}`);
    });
    
    console.log('\n  Balanced:');
    groups.Balanced.forEach((d, i) => {
      const info = TACTICAL_DOCTRINE_INFO[d];
      console.log(`    ${i + 19}. ${info.icon} ${info.name}`);
    });
    
    const choice = await this.question(`\nDoctrine for ${sideName} [1-27] (default: 18 - Operative): `);
    
    const allDoctrines = [...groups.Melee, ...groups.Ranged, ...groups.Balanced];
    const index = parseInt(choice, 10) - 1;
    
    return (index >= 0 && index < allDoctrines.length) ? allDoctrines[index] : TacticalDoctrine.Operative;
  }

  private async configureSides(gameSize: GameSize): Promise<SideConfig[]> {
    const config = GAME_SIZE_CONFIG[gameSize];
    const sides: SideConfig[] = [];
    
    console.log('\n🎖️  Configure Sides:\n');
    
    const sideCountStr = await this.question('Number of sides [2] (default: 2): ');
    const sideCount = parseInt(sideCountStr, 10) || 2;
    
    for (let i = 0; i < sideCount; i++) {
      console.log(`\n--- Side ${i + 1} ---`);
      
      const name = await this.question(`Side name (default: ${['Alpha', 'Bravo', 'Gamma', 'Delta'][i]}): `) || 
                   ['Alpha', 'Bravo', 'Gamma', 'Delta'][i];
      
      const modelCountStr = await this.question(
        `Model count [${config.modelsPerSide[0]}-${config.modelsPerSide[1]}] (default: ${config.modelsPerSide[1]}): `
      );
      let modelCount = parseInt(modelCountStr, 10);
      if (!modelCount || modelCount < config.modelsPerSide[0]) modelCount = config.modelsPerSide[1];
      if (modelCount > config.modelsPerSide[1]) modelCount = config.modelsPerSide[1];
      
      const bpStr = await this.question(
        `Build Points [${config.bpPerSide[0]}-${config.bpPerSide[1]}] (default: ${config.bpPerSide[1]}): `
      );
      let bp = parseInt(bpStr, 10);
      if (!bp || bp < config.bpPerSide[0]) bp = config.bpPerSide[1];
      if (bp > config.bpPerSide[1]) bp = config.bpPerSide[1];
      
      const doctrine = await this.selectTacticalDoctrine(name);
      const aiConfig = doctrineToAIConfig(doctrine);
      
      sides.push({
        name,
        bp,
        modelCount,
        tacticalDoctrine: doctrine,
        assemblyName: `${name} Assembly`,
        aggression: aiConfig.aggression ?? 0.5,
        caution: aiConfig.caution ?? 0.5,
      });
    }
    
    return sides;
  }

  private async configureDensity(): Promise<number> {
    const densityStr = await this.question('\n🌲 Terrain density ratio [0-100] (default: 50): ');
    const density = parseInt(densityStr, 10);
    return Math.max(0, Math.min(100, density || 50));
  }

  private async selectLighting(): Promise<LightingCondition> {
    console.log('\n💡 Select Atmospheric Lighting:\n');
    console.log('  1. Day, Clear          (Visibility OR 16 MU)');
    console.log('  2. Twilight, Overcast  (Visibility OR 8 MU)');
    const choice = await this.question('\nLighting [1-2] (default: 1): ');
    return choice.trim() === '2' ? 'Twilight, Overcast' : 'Day, Clear';
  }

  async runInteractiveSetup(): Promise<GameConfig> {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   MEST Tactics AI Battle Setup        ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    const mission = await this.selectMission();
    const gameSize = await this.selectGameSize();
    const sides = await this.configureSides(gameSize);
    const densityRatio = await this.configureDensity();
    const lighting = await this.selectLighting();
    const visibilityOrMu = getVisibilityOrForLighting(lighting);
    
    const config: GameConfig = {
      missionId: mission.id,
      missionName: mission.name,
      gameSize,
      battlefieldSize: GAME_SIZE_CONFIG[gameSize].battlefieldSize,
      maxTurns: GAME_SIZE_CONFIG[gameSize].maxTurns,
      endGameTurn: GAME_SIZE_CONFIG[gameSize].endGameTurn,
      sides,
      densityRatio,
      lighting,
      visibilityOrMu,
      maxOrm: 3,
      allowConcentrateRangeExtension: true,
      perCharacterFovLos: false,
      verbose: true,
    };
    
    console.log('\n' + '═'.repeat(60));
    console.log('\n📋 Configuration Summary:\n');
    console.log(`  Mission: ${config.missionName} (${config.missionId})`);
    console.log(`  Game Size: ${GAME_SIZE_CONFIG[gameSize].name}`);
    console.log(`  Battlefield: ${config.battlefieldSize}×${config.battlefieldSize} MU`);
    console.log(`  Max Turns: ${config.maxTurns}`);
    console.log(`  Terrain Density: ${config.densityRatio}%`);
    console.log(`  Lighting: ${config.lighting} (Visibility OR ${config.visibilityOrMu} MU)`);
    console.log('\n  Sides:');
    config.sides.forEach((side) => {
      const doctrineInfo = TACTICAL_DOCTRINE_INFO[side.tacticalDoctrine];
      console.log(`    - ${side.name}: ${side.modelCount} models, ${side.bp} BP, ${doctrineInfo.icon} ${doctrineInfo.name}`);
    });
    console.log('\n' + '═'.repeat(60));
    
    const confirm = await this.question('\nStart battle with this configuration? [Y/n]: ');
    
    if (confirm.toLowerCase() === 'n') {
      console.log('\nBattle cancelled.\n');
      this.rl.close();
      process.exit(0);
    }
    
    return config;
  }

  close() {
    this.rl.close();
  }
}

// ============================================================================
// Battle Runner
// ============================================================================

class AIBattleRunner {
  private log: BattleLogEntry[] = [];
  private stats: BattleStats = createEmptyStats();
  private advancedRules: AdvancedRuleMetrics = createEmptyAdvancedRuleMetrics();
  private modelUsageByCharacter = new Map<Character, ModelUsageStats>();
  private sideNameByCharacterId = new Map<string, string>();
  private doctrineByCharacterId = new Map<string, TacticalDoctrine>();
  private missionRuntimeAdapter: MissionRuntimeAdapter | null = null;
  private currentBattlefield: Battlefield | null = null;
  private missionSides: MissionSide[] = [];
  private missionSideIds: string[] = [];
  private missionVpBySide: Record<string, number> = {};
  private missionRpBySide: Record<string, number> = {};
  private missionImmediateWinnerSideId: string | null = null;
  private auditTurns: TurnAudit[] = [];
  private activationSequence = 0;

  private resetRunState() {
    this.log = [];
    this.stats = createEmptyStats();
    this.advancedRules = createEmptyAdvancedRuleMetrics();
    this.modelUsageByCharacter = new Map<Character, ModelUsageStats>();
    this.sideNameByCharacterId = new Map<string, string>();
    this.doctrineByCharacterId = new Map<string, TacticalDoctrine>();
    this.missionRuntimeAdapter = null;
    this.currentBattlefield = null;
    this.missionSides = [];
    this.missionSideIds = [];
    this.missionVpBySide = {};
    this.missionRpBySide = {};
    this.missionImmediateWinnerSideId = null;
    this.auditTurns = [];
    this.activationSequence = 0;
  }

  private initializeModelUsage(
    config: GameConfig,
    sides: Array<{ characters: Character[] }>
  ) {
    this.modelUsageByCharacter = new Map<Character, ModelUsageStats>();
    this.sideNameByCharacterId = new Map<string, string>();
    this.doctrineByCharacterId = new Map<string, TacticalDoctrine>();
    for (let sideIndex = 0; sideIndex < sides.length; sideIndex++) {
      const sideName = config.sides[sideIndex]?.name ?? `Side ${sideIndex + 1}`;
      const doctrine = config.sides[sideIndex]?.tacticalDoctrine ?? TacticalDoctrine.Operative;
      for (const character of sides[sideIndex].characters) {
        this.sideNameByCharacterId.set(character.id, sideName);
        this.doctrineByCharacterId.set(character.id, doctrine);
        this.modelUsageByCharacter.set(character, {
          modelId: character.id,
          modelName: character.profile.name,
          side: sideName,
          pathLength: 0,
          moveActions: 0,
          waitAttempts: 0,
          waitSuccesses: 0,
          detectAttempts: 0,
          detectSuccesses: 0,
          hideAttempts: 0,
          hideSuccesses: 0,
          reactAttempts: 0,
          reactSuccesses: 0,
        });
      }
    }
  }

  private createMissionSides(
    config: GameConfig,
    sides: Array<{ characters: Character[]; totalBP: number }>
  ): MissionSide[] {
    return sides.map((sideRoster, sideIndex) => {
      const sideName = config.sides[sideIndex]?.name ?? `Side ${sideIndex + 1}`;
      return {
        id: sideName,
        name: sideName,
        assemblies: [],
        members: sideRoster.characters.map((character, modelIndex) => ({
          id: character.id,
          character,
          profile: character.profile,
          assembly: {
            name: `${sideName}-assembly`,
            characters: [character.id],
            totalBP: character.profile.totalBp ?? 0,
            totalCharacters: 1,
          },
          portrait: {
            sheet: 'default',
            column: modelIndex,
            row: sideIndex,
            name: `${sideName}-${modelIndex + 1}`,
          } as any,
          position: undefined,
          status: ModelSlotStatus.Ready,
          isVIP: false,
          objectiveMarkers: [],
        })),
        totalBP: sideRoster.totalBP ?? 0,
        deploymentZones: [],
        state: {
          currentTurn: 0,
          activatedModels: new Set<string>(),
          readyModels: new Set<string>(sideRoster.characters.map(character => character.id)),
          woundsThisTurn: 0,
          eliminatedModels: [],
          victoryPoints: 0,
          initiativePoints: 0,
          missionState: {},
        },
        objectiveMarkerManager: new ObjectiveMarkerManager(),
      };
    });
  }

  private buildMissionModels(
    battlefield: Battlefield
  ): MissionModel[] {
    const models: MissionModel[] = [];
    for (const side of this.missionSides) {
      for (const member of side.members) {
        const character = member.character;
        const position = battlefield.getCharacterPosition(character);
        if (!position) continue;
        const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
        models.push({
          id: member.id,
          sideId: side.id,
          position,
          baseDiameter: getBaseDiameterFromSiz(siz),
          bp: member.profile?.totalBp ?? 0,
          isKOd: character.state.isKOd,
          isEliminated: character.state.isEliminated,
          isOrdered: character.state.isOrdered,
          isAttentive: character.state.isAttentive,
        });
      }
    }
    return models;
  }

  private applyMissionRuntimeUpdate(update: MissionRuntimeUpdate | null | undefined): void {
    if (!update) return;
    if (this.missionSideIds.length > 0) {
      for (const sideId of this.missionSideIds) {
        if (this.missionVpBySide[sideId] === undefined) {
          this.missionVpBySide[sideId] = 0;
        }
        if (this.missionRpBySide[sideId] === undefined) {
          this.missionRpBySide[sideId] = 0;
        }
      }
    }
    const delta = update.delta;
    for (const [sideId, vp] of Object.entries(delta.vpBySide ?? {})) {
      this.missionVpBySide[sideId] = (this.missionVpBySide[sideId] ?? 0) + vp;
    }
    for (const [sideId, rp] of Object.entries(delta.rpBySide ?? {})) {
      this.missionRpBySide[sideId] = (this.missionRpBySide[sideId] ?? 0) + rp;
    }
    if (update.immediateWinnerSideId) {
      this.missionImmediateWinnerSideId = update.immediateWinnerSideId;
    }
  }

  private resolveMissionWinnerName(): string | null {
    if (this.missionImmediateWinnerSideId) {
      return this.missionImmediateWinnerSideId;
    }
    const entries = Object.entries(this.missionVpBySide);
    if (entries.length === 0) {
      return null;
    }
    entries.sort((a, b) => b[1] - a[1]);
    if (entries.length > 1 && entries[0][1] === entries[1][1]) {
      return null;
    }
    return entries[0][0];
  }

  private applyMissionStartOverrides(
    config: GameConfig,
    sides: Array<{ characters: Character[] }>,
    gameManager: GameManager
  ): void {
    // Missions with "all defenders start in Wait status at no AP cost".
    const defenderStartsInWait = new Set(['QAI_13', 'QAI_16', 'QAI_18', 'QAI_19', 'QAI_20']);
    if (defenderStartsInWait && defenderStartsInWait.has(config.missionId)) {
      const defenderSide = sides[0];
      if (defenderSide) {
        for (const character of defenderSide.characters) {
          if (character.state.isEliminated || character.state.isKOd) continue;
          gameManager.setWaiting(character);
        }
      }
    }
  }

  private syncMissionRuntimeForAttack(
    attacker: Character | undefined,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ): void {
    if (!this.missionRuntimeAdapter) return;
    const attackerSideId = attacker ? this.sideNameByCharacterId.get(attacker.id) : undefined;
    const woundsAdded = this.extractWoundsAddedFromDamageResolution(damageResolution, targetStateBefore, targetStateAfter);
    this.applyMissionRuntimeUpdate(this.missionRuntimeAdapter.recordAttack(attackerSideId, woundsAdded));
    const becameKOd = !targetStateBefore.isKOd && targetStateAfter.isKOd;
    const becameEliminated = !targetStateBefore.isEliminated && targetStateAfter.isEliminated;

    if (becameKOd || becameEliminated) {
      const targetPosition = this.findCharacterPosition(target);
      if (targetPosition) {
        this.applyMissionRuntimeUpdate(this.missionRuntimeAdapter.onCarrierDown(target.id, targetPosition, becameEliminated));
      }
    }

    if (becameEliminated) {
      this.applyMissionRuntimeUpdate(this.missionRuntimeAdapter.onModelEliminated(target.id, attacker?.id));
    }
  }

  private findCharacterPosition(character: Character): Position | undefined {
    if (this.currentBattlefield) {
      const directPosition = this.currentBattlefield.getCharacterPosition(character);
      if (directPosition) {
        return directPosition;
      }
    }
    for (const side of this.missionSides) {
      const member = side.members.find(candidate => candidate.character.id === character.id || candidate.id === character.id);
      if (member?.position) {
        return member.position;
      }
    }
    return undefined;
  }

  private extractWoundsAddedFromDamageResolution(
    damageResolution: unknown,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit
  ): number {
    if (damageResolution && typeof damageResolution === 'object') {
      const payload = damageResolution as Record<string, unknown>;
      const woundsAdded = payload.woundsAdded;
      const stunWoundsAdded = payload.stunWoundsAdded;
      if (typeof woundsAdded === 'number' || typeof stunWoundsAdded === 'number') {
        return Math.max(0, (Number(woundsAdded) || 0) + (Number(stunWoundsAdded) || 0));
      }
    }
    const delta = (targetStateAfter.wounds ?? 0) - (targetStateBefore.wounds ?? 0);
    return Math.max(0, delta);
  }

  private isAttackDecisionType(type: string): boolean {
    return type === 'close_combat' || type === 'charge' || type === 'ranged_combat';
  }

  private extractDamageResolutionFromStepDetails(details: Record<string, unknown> | undefined): unknown {
    if (!details) return undefined;
    const attackResult = details.attackResult as Record<string, unknown> | undefined;
    if (!attackResult) return undefined;
    const nestedResult = attackResult.result as Record<string, unknown> | undefined;
    return nestedResult?.damageResolution ?? attackResult.damageResolution;
  }

  private extractDamageResolutionFromUnknown(result: unknown): unknown {
    if (!result || typeof result !== 'object') {
      return undefined;
    }
    const payload = result as Record<string, unknown>;
    const nestedResult = payload.result as Record<string, unknown> | undefined;
    return nestedResult?.damageResolution ?? payload.damageResolution;
  }

  private buildAiObjectiveMarkerSnapshot(gameManager: GameManager): AIContext['objectiveMarkers'] {
    return gameManager.getObjectiveMarkers().map(marker => ({
      id: marker.id,
      name: marker.name,
      state: marker.state,
      position: marker.position,
      carriedBy: marker.carriedBy,
      scoringSideId: marker.scoringSideId,
      controlledBy: marker.controlledBy,
      omTypes: [...(marker.omTypes ?? [])],
      switchState: marker.switchState,
      isNeutral: marker.isNeutral,
      interactable: marker.metadata['aiInteractable'] === false ? false : true,
      missionSource: typeof marker.metadata['missionSource'] === 'string'
        ? marker.metadata['missionSource']
        : undefined,
    }));
  }

  private hasOpposingInBaseContact(
    actor: Character,
    opponents: Character[],
    battlefield: Battlefield
  ): boolean {
    const actorModel = this.buildSpatialModelFor(actor, battlefield);
    if (!actorModel) return false;
    for (const opponent of opponents) {
      const opponentModel = this.buildSpatialModelFor(opponent, battlefield);
      if (!opponentModel) continue;
      if (SpatialRules.isEngaged(actorModel, opponentModel)) {
        return true;
      }
    }
    return false;
  }

  private getMarkerKeyIdsInHand(character: Character, gameManager: GameManager): string[] {
    const markers = gameManager.getObjectiveMarkers();
    return markers
      .filter(marker => marker.carriedBy === character.id && marker.omTypes.includes(ObjectiveMarkerKind.Key))
      .map(marker => marker.id);
  }

  private trackPathMovement(character: Character, movedDistance: number) {
    if (!Number.isFinite(movedDistance) || movedDistance <= 0) {
      return;
    }
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    usage.pathLength += movedDistance;
    usage.moveActions += 1;
    this.stats.totalPathLength += movedDistance;
  }

  private trackAttempt(character: Character, action: 'wait' | 'detect' | 'hide' | 'react') {
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    if (action === 'wait') usage.waitAttempts += 1;
    if (action === 'detect') usage.detectAttempts += 1;
    if (action === 'hide') usage.hideAttempts += 1;
    if (action === 'react') usage.reactAttempts += 1;
  }

  private trackSuccess(character: Character, action: 'wait' | 'detect' | 'hide' | 'react') {
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    if (action === 'wait') usage.waitSuccesses += 1;
    if (action === 'detect') usage.detectSuccesses += 1;
    if (action === 'hide') usage.hideSuccesses += 1;
    if (action === 'react') usage.reactSuccesses += 1;
  }

  private incrementTypeBreakdown(breakdown: RuleTypeBreakdown, type: string, amount: number = 1) {
    if (!type || !Number.isFinite(amount) || amount === 0) return;
    breakdown[type] = (breakdown[type] ?? 0) + amount;
  }

  private trackBonusActionOptions(options: BonusActionOption[] | undefined) {
    if (!Array.isArray(options) || options.length === 0) {
      return;
    }
    this.advancedRules.bonusActions.opportunities += 1;
    this.advancedRules.bonusActions.optionsOffered += options.length;
    for (const option of options) {
      this.incrementTypeBreakdown(this.advancedRules.bonusActions.offeredByType, option.type);
      if (option.available) {
        this.advancedRules.bonusActions.optionsAvailable += 1;
        this.incrementTypeBreakdown(this.advancedRules.bonusActions.availableByType, option.type);
      }
    }
  }

  private trackBonusActionOutcome(outcome: BonusActionOutcome | undefined) {
    if (!outcome || !outcome.executed) {
      return;
    }
    const type = outcome.type ?? 'Unknown';
    this.advancedRules.bonusActions.executed += 1;
    this.incrementTypeBreakdown(this.advancedRules.bonusActions.executedByType, type);
  }

  private trackPassiveOptions(options: PassiveOption[] | undefined) {
    if (!Array.isArray(options) || options.length === 0) {
      return;
    }
    this.advancedRules.passiveOptions.opportunities += 1;
    this.advancedRules.passiveOptions.optionsOffered += options.length;
    for (const option of options) {
      this.incrementTypeBreakdown(this.advancedRules.passiveOptions.offeredByType, option.type);
      if (option.available) {
        this.advancedRules.passiveOptions.optionsAvailable += 1;
        this.incrementTypeBreakdown(this.advancedRules.passiveOptions.availableByType, option.type);
      }
    }
  }

  private trackPassiveUsage(type: PassiveOptionType, amount: number = 1) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    this.advancedRules.passiveOptions.used += amount;
    this.incrementTypeBreakdown(this.advancedRules.passiveOptions.usedByType, type, amount);
  }

  private trackSituationalModifiers(
    context: TestContext | Record<string, unknown> | undefined,
    hitTestResult: { finalPools?: Record<string, unknown> } | undefined
  ) {
    const applied = new Set<string>();
    if (context && typeof context === 'object') {
      for (const [key, label] of Object.entries(CONTEXT_MODIFIER_KEYS)) {
        const value = (context as Record<string, unknown>)[key];
        if (typeof value === 'boolean' && value) {
          applied.add(label);
        } else if (typeof value === 'number' && value > 0) {
          applied.add(label);
        }
      }
    }
    const finalPools = hitTestResult?.finalPools;
    if (finalPools && typeof finalPools === 'object') {
      const buckets = [
        ['p1FinalBonus', 'attacker_bonus'],
        ['p1FinalPenalty', 'attacker_penalty'],
        ['p2FinalBonus', 'defender_bonus'],
        ['p2FinalPenalty', 'defender_penalty'],
      ] as const;
      for (const [poolKey, prefix] of buckets) {
        const pool = (finalPools as Record<string, unknown>)[poolKey];
        if (!pool || typeof pool !== 'object') continue;
        for (const dieType of ['base', 'modifier', 'wild']) {
          const value = (pool as Record<string, unknown>)[dieType];
          if (typeof value === 'number' && value > 0) {
            applied.add(`${prefix}_${dieType}`);
          }
        }
      }
    }

    this.advancedRules.situationalModifiers.testsObserved += 1;
    if (applied.size > 0) {
      this.advancedRules.situationalModifiers.modifiedTests += 1;
      this.advancedRules.situationalModifiers.modifiersApplied += applied.size;
      for (const type of applied) {
        this.incrementTypeBreakdown(this.advancedRules.situationalModifiers.byType, type);
      }
    }
  }

  private trackCombatExtras(result: unknown) {
    if (!result || typeof result !== 'object') {
      return;
    }
    const payload = result as {
      bonusActionOptions?: BonusActionOption[];
      bonusActionOutcome?: BonusActionOutcome;
      context?: TestContext;
      result?: { hitTestResult?: { finalPools?: Record<string, unknown> } };
      hitTestResult?: { finalPools?: Record<string, unknown> };
    };
    this.trackBonusActionOptions(payload.bonusActionOptions);
    this.trackBonusActionOutcome(payload.bonusActionOutcome);
    const hitTestResult = payload.result?.hitTestResult ?? payload.hitTestResult;
    if (payload.context || hitTestResult) {
      this.trackSituationalModifiers(payload.context, hitTestResult);
    }
  }

  private inspectPassiveOptions(gameManager: GameManager, event: PassiveEvent): PassiveOption[] {
    const options = gameManager.getPassiveOptions(event);
    this.trackPassiveOptions(options);
    return options;
  }

  private inspectMovePassiveOptions(
    gameManager: GameManager,
    battlefield: Battlefield,
    mover: Character,
    opponents: Character[],
    visibilityOrMu: number,
    moveApSpent: number
  ): { moveConcluded: PassiveOption[]; engagementBroken: PassiveOption[] } {
    const moveConcluded = this.inspectPassiveOptions(gameManager, {
      kind: 'MoveConcluded',
      mover,
      observers: opponents,
      battlefield,
      moveApSpent,
      visibilityOrMu,
    });
    const engagementBroken = this.inspectPassiveOptions(gameManager, {
      kind: 'EngagementBroken',
      mover,
      opponents,
      battlefield,
    });
    return { moveConcluded, engagementBroken };
  }

  private getCharacterItems(character: Character): Item[] {
    const rawItems = [
      ...(character.profile?.equipment ?? []),
      ...(character.profile?.items ?? []),
      ...(character.profile?.inHandItems ?? []),
      ...(character.profile?.stowedItems ?? []),
    ];
    const seen = new Set<string>();
    const deduped: Item[] = [];
    for (const item of rawItems) {
      if (!item) continue;
      const key = `${item.name}|${item.classification}|${item.class}|${item.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  }

  private isRangedWeapon(item: Item): boolean {
    const classification = String(item.classification ?? item.class ?? '').toLowerCase();
    if (
      classification.includes('bow') ||
      classification.includes('thrown') ||
      classification.includes('firearm') ||
      classification.includes('range') ||
      classification.includes('support')
    ) {
      return true;
    }
    return (
      (classification.includes('melee') || classification.includes('natural')) &&
      Array.isArray(item.traits) &&
      item.traits.some(trait => String(trait).toLowerCase().includes('throwable'))
    );
  }

  private isMeleeWeapon(item: Item): boolean {
    const classification = String(item.classification ?? item.class ?? '').toLowerCase();
    return classification.includes('melee') || classification.includes('natural');
  }

  private getLoadoutProfile(character: Character): { hasMeleeWeapons: boolean; hasRangedWeapons: boolean } {
    const items = this.getCharacterItems(character);
    let hasMeleeWeapons = false;
    let hasRangedWeapons = false;
    for (const item of items) {
      if (this.isRangedWeapon(item)) {
        hasRangedWeapons = true;
      } else if (this.isMeleeWeapon(item)) {
        hasMeleeWeapons = true;
      }
      if (hasMeleeWeapons && hasRangedWeapons) {
        break;
      }
    }
    return { hasMeleeWeapons, hasRangedWeapons };
  }

  private applyDoctrineLoadoutConfig(
    aiController: CharacterAI,
    character: Character,
    sideConfig: SideConfig,
    sideIndex: number,
    config: GameConfig
  ) {
    const loadoutProfile = this.getLoadoutProfile(character);
    const pressure = deriveDoctrineAIPressure(sideConfig.tacticalDoctrine, loadoutProfile);
    const doctrineComponents = getDoctrineComponents(sideConfig.tacticalDoctrine);
    const missionRole = this.resolveMissionRole(config.missionId, sideIndex);
    aiController.setConfig({
      aggression: pressure.aggression,
      caution: pressure.caution,
      visibilityOrMu: config.visibilityOrMu,
      maxOrm: config.maxOrm,
      allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
      perCharacterFovLos: config.perCharacterFovLos,
      missionId: config.missionId,
      missionRole,
      doctrineEngagement: doctrineComponents.engagement,
      doctrinePlanning: doctrineComponents.planning,
      doctrineAggression: doctrineComponents.aggression,
    });
  }

  private resolveMissionRole(
    missionId: string,
    sideIndex: number
  ): 'attacker' | 'defender' | 'neutral' {
    const defenderAtIndexZero = new Set(['QAI_13', 'QAI_16', 'QAI_18', 'QAI_19', 'QAI_20']);
    if (!defenderAtIndexZero.has(missionId)) {
      return 'neutral';
    }
    return sideIndex === 0 ? 'defender' : 'attacker';
  }

  private getDoctrineForCharacter(character: Character, fallback: TacticalDoctrine = TacticalDoctrine.Operative): TacticalDoctrine {
    return this.doctrineByCharacterId.get(character.id) ?? fallback;
  }

  private getBonusActionPriority(
    doctrine: TacticalDoctrine,
    isCloseCombat: boolean,
    attacker: Character
  ): BonusActionType[] {
    const components = getDoctrineComponents(doctrine);
    const prioritize = (list: BonusActionType[], preferred: BonusActionType[]): BonusActionType[] => {
      const seen = new Set<BonusActionType>();
      const ordered: BonusActionType[] = [];
      for (const type of preferred) {
        if (!seen.has(type)) {
          seen.add(type);
          ordered.push(type);
        }
      }
      for (const type of list) {
        if (!seen.has(type)) {
          seen.add(type);
          ordered.push(type);
        }
      }
      return ordered;
    };
    let base: BonusActionType[];

    if (components.aggression === AggressionLevel.Aggressive) {
      if (isCloseCombat) {
        base = components.engagement === EngagementStyle.Melee
          ? ['PushBack', 'Circle', 'Reversal', 'PullBack', 'Disengage', 'Reposition', 'Hide', 'Refresh']
          : ['Reposition', 'PushBack', 'Circle', 'Hide', 'Refresh', 'PullBack', 'Disengage', 'Reversal'];
      } else {
        base = components.engagement === EngagementStyle.Ranged
          ? ['Reposition', 'Hide', 'Refresh']
          : ['Reposition', 'Refresh', 'Hide'];
      }
    } else if (components.aggression === AggressionLevel.Defensive) {
      if (isCloseCombat) {
        base = components.engagement === EngagementStyle.Ranged
          ? ['Refresh', 'Disengage', 'PullBack', 'Reposition', 'Hide', 'Circle', 'PushBack', 'Reversal']
          : ['Refresh', 'PullBack', 'Disengage', 'Reposition', 'Hide', 'Circle', 'PushBack', 'Reversal'];
      } else {
        base = ['Refresh', 'Hide', 'Reposition'];
      }
    } else {
      base = isCloseCombat
        ? ['Refresh', 'PushBack', 'Circle', 'Reposition', 'Hide', 'PullBack', 'Disengage', 'Reversal']
        : ['Refresh', 'Reposition', 'Hide'];
    }

    if (attacker.state.delayTokens > 0) {
      base = ['Refresh', ...base];
    }

    if (components.planning === PlanningPriority.KeysToVictory) {
      base = isCloseCombat
        ? prioritize(base, ['Reposition', 'Disengage', 'Refresh', 'Hide'])
        : prioritize(base, ['Reposition', 'Hide', 'Refresh']);
    } else if (components.planning === PlanningPriority.Aggressive) {
      base = isCloseCombat
        ? prioritize(base, ['PushBack', 'Circle', 'Reversal', 'PullBack'])
        : prioritize(base, ['Reposition', 'Refresh', 'Hide']);
    }

    const unique: BonusActionType[] = [];
    for (const type of base) {
      if (!unique.includes(type)) {
        unique.push(type);
      }
    }
    return unique;
  }

  private createBonusSelectionForType(
    type: BonusActionType,
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    opponents: Character[]
  ): BonusActionSelection | undefined {
    if (type === 'Hide') {
      return attacker.state.isHidden ? undefined : { type: 'Hide', opponents };
    }
    if (type === 'Reposition') {
      const relocation = this.findRelocationPosition(attacker, battlefield, target);
      return relocation ? { type: 'Reposition', attackerPosition: relocation } : undefined;
    }
    return { type };
  }

  private shouldUseDefendDeclared(
    doctrine: TacticalDoctrine,
    attackType: 'melee' | 'ranged',
    defender: Character
  ): boolean {
    void doctrine;
    void attackType;
    return defender.state.isAttentive;
  }

  private shouldUseTakeCoverDeclared(doctrine: TacticalDoctrine, defender: Character): boolean {
    const components = getDoctrineComponents(doctrine);
    if (
      components.aggression === AggressionLevel.Aggressive &&
      components.engagement === EngagementStyle.Melee &&
      components.planning === PlanningPriority.Aggressive
    ) {
      const loadout = this.getLoadoutProfile(defender);
      const threatened = defender.state.wounds > 0 || defender.state.delayTokens > 0 || defender.state.fearTokens > 0;
      if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons && !threatened) {
        return false;
      }
    }
    return true;
  }

  private getPassiveResponsePriority(
    doctrine: TacticalDoctrine,
    attackType: 'melee' | 'ranged',
    defender: Character
  ): PassiveOptionType[] {
    const components = getDoctrineComponents(doctrine);
    const loadout = this.getLoadoutProfile(defender);
    const prioritize = (list: PassiveOptionType[], preferred: PassiveOptionType[]): PassiveOptionType[] => {
      const seen = new Set<PassiveOptionType>();
      const ordered: PassiveOptionType[] = [];
      for (const type of preferred) {
        if (!seen.has(type)) {
          seen.add(type);
          ordered.push(type);
        }
      }
      for (const type of list) {
        if (!seen.has(type)) {
          seen.add(type);
          ordered.push(type);
        }
      }
      return ordered;
    };
    let priority: PassiveOptionType[];

    if (attackType === 'melee') {
      if (components.aggression === AggressionLevel.Aggressive && components.engagement === EngagementStyle.Melee) {
        priority = ['CounterStrike', 'CounterAction', 'CounterFire'];
      } else if (components.aggression === AggressionLevel.Defensive) {
        priority = ['CounterAction', 'CounterStrike', 'CounterFire'];
      } else {
        priority = ['CounterAction', 'CounterStrike', 'CounterFire'];
      }
    } else {
      if (components.aggression === AggressionLevel.Defensive || components.engagement === EngagementStyle.Ranged) {
        priority = ['CounterFire', 'CounterAction', 'CounterStrike'];
      } else if (components.aggression === AggressionLevel.Aggressive && components.engagement === EngagementStyle.Melee) {
        priority = ['CounterAction', 'CounterFire', 'CounterStrike'];
      } else {
        priority = ['CounterAction', 'CounterFire', 'CounterStrike'];
      }
    }

    if (components.planning === PlanningPriority.Aggressive) {
      priority = attackType === 'melee'
        ? prioritize(priority, ['CounterStrike', 'CounterAction'])
        : prioritize(priority, ['CounterFire', 'CounterAction']);
    } else if (components.planning === PlanningPriority.KeysToVictory) {
      priority = prioritize(priority, ['CounterAction']);
    }

    if (!loadout.hasMeleeWeapons) {
      priority = priority.filter(type => type !== 'CounterStrike');
    }
    if (!loadout.hasRangedWeapons) {
      priority = priority.filter(type => type !== 'CounterFire');
    }
    return priority;
  }

  private scoreCounterChargeObserver(
    doctrine: TacticalDoctrine,
    observer: Character,
    mover: Character,
    battlefield: Battlefield
  ): number {
    const components = getDoctrineComponents(doctrine);
    const loadout = this.getLoadoutProfile(observer);
    const observerPos = battlefield.getCharacterPosition(observer);
    const moverPos = battlefield.getCharacterPosition(mover);
    const distance = observerPos && moverPos
      ? Math.hypot(observerPos.x - moverPos.x, observerPos.y - moverPos.y)
      : Number.POSITIVE_INFINITY;

    let score = 0;
    if (components.engagement === EngagementStyle.Melee) score += 1.5;
    if (components.engagement === EngagementStyle.Ranged) score -= 0.6;
    if (components.aggression === AggressionLevel.Aggressive) score += 1.2;
    if (components.aggression === AggressionLevel.Defensive) score -= 0.4;
    if (components.planning === PlanningPriority.Aggressive) score += 0.7;
    if (components.planning === PlanningPriority.KeysToVictory) score -= 0.4;
    if (loadout.hasMeleeWeapons) score += 1.0;
    if (!loadout.hasMeleeWeapons) score -= 1.0;
    if (!loadout.hasRangedWeapons) score += 0.3;
    if (distance <= 8) score += 1.0;
    else if (distance >= 14) score -= 0.5;
    return score;
  }

  private buildSpatialModelFor(character: Character, battlefield: Battlefield) {
    const position = battlefield.getCharacterPosition(character);
    if (!position) return null;
    const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
    return {
      id: character.id,
      position,
      baseDiameter: getBaseDiameterFromSiz(siz),
      siz,
    };
  }

  private shouldUseLeanForRanged(attacker: Character, defender: Character, battlefield: Battlefield): boolean {
    if (!attacker.state.isAttentive) return false;
    const attackerModel = this.buildSpatialModelFor(attacker, battlefield);
    const defenderModel = this.buildSpatialModelFor(defender, battlefield);
    if (!attackerModel || !defenderModel) return false;
    const coverFromAttacker = SpatialRules.getCoverResult(battlefield, attackerModel, defenderModel);
    const coverFromDefender = SpatialRules.getCoverResult(battlefield, defenderModel, attackerModel);
    const hasAttackerCover = coverFromDefender.hasLOS && (coverFromDefender.hasDirectCover || coverFromDefender.hasInterveningCover);
    const hasInterveningLaneCover = coverFromAttacker.hasLOS && (coverFromAttacker.hasDirectCover || coverFromAttacker.hasInterveningCover);
    return hasAttackerCover || hasInterveningLaneCover;
  }

  private shouldUseLeanForDetect(attacker: Character, target: Character, battlefield: Battlefield): boolean {
    if (!attacker.state.isAttentive) return false;
    const attackerModel = this.buildSpatialModelFor(attacker, battlefield);
    const targetModel = this.buildSpatialModelFor(target, battlefield);
    if (!attackerModel || !targetModel) return false;
    const coverFromAttacker = SpatialRules.getCoverResult(battlefield, attackerModel, targetModel);
    const coverFromTarget = SpatialRules.getCoverResult(battlefield, targetModel, attackerModel);
    const hasAttackerCover = coverFromTarget.hasLOS && (coverFromTarget.hasDirectCover || coverFromTarget.hasInterveningCover);
    const hasInterveningLaneCover = coverFromAttacker.hasLOS && (coverFromAttacker.hasDirectCover || coverFromAttacker.hasInterveningCover);
    return hasAttackerCover || hasInterveningLaneCover;
  }

  private applyRefreshLocally(character: Character) {
    if (character.state.delayTokens > 0) {
      character.state.delayTokens = Math.max(0, character.state.delayTokens - 1);
    } else if (character.state.isAttentive && character.state.fearTokens > 0) {
      character.state.fearTokens = Math.max(0, character.state.fearTokens - 1);
    }
    character.refreshStatusFlags();
  }

  private findRelocationPosition(
    character: Character,
    battlefield: Battlefield,
    threatSource?: Character
  ): Position | undefined {
    const start = battlefield.getCharacterPosition(character);
    if (!start) return undefined;
    const mov = Math.max(1, character.finalAttributes.mov ?? character.attributes.mov ?? 0);
    const maxDistance = mov;
    const threatPos = threatSource ? battlefield.getCharacterPosition(threatSource) : undefined;
    let best: { score: number; pos: Position } | null = null;

    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dy = -maxDistance; dy <= maxDistance; dy++) {
        const distance = Math.hypot(dx, dy);
        if (distance <= 0 || distance > maxDistance) continue;
        const candidate = { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
        if (candidate.x < 0 || candidate.x >= battlefield.width || candidate.y < 0 || candidate.y >= battlefield.height) continue;
        const occupant = battlefield.getCharacterAt(candidate);
        if (occupant && occupant.id !== character.id) continue;

        let score = -distance * 0.1;
        if (threatPos) {
          const hasLos = battlefield.hasLineOfSight(threatPos, candidate);
          score += hasLos ? 0 : 2;
        }

        if (!best || score > best.score) {
          best = { score, pos: candidate };
        }
      }
    }

    return best?.pos;
  }

  private findTakeCoverPosition(
    defender: Character,
    attacker: Character,
    battlefield: Battlefield
  ): Position | undefined {
    return this.findRelocationPosition(defender, battlefield, attacker);
  }

  private buildAutoBonusActionSelections(
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    opponents: Character[],
    options: BonusActionOption[],
    isCloseCombat: boolean,
    doctrine: TacticalDoctrine
  ): BonusActionSelection[] {
    const available = options.filter(option => option.available);
    if (available.length === 0) return [];
    const byType = new Set<BonusActionType>(available.map(option => option.type));
    const selections: BonusActionSelection[] = [];
    const push = (selection: BonusActionSelection) => {
      if (!selections.some(existing => existing.type === selection.type)) {
        selections.push(selection);
      }
    };

    const prioritizedTypes = this.getBonusActionPriority(doctrine, isCloseCombat, attacker);
    for (const type of prioritizedTypes) {
      if (!byType.has(type)) continue;
      const selection = this.createBonusSelectionForType(type, attacker, target, battlefield, opponents);
      if (selection) {
        push(selection);
      }
    }

    // Add any remaining available options as doctrine-agnostic fallbacks.
    for (const option of available) {
      const selection = this.createBonusSelectionForType(option.type, attacker, target, battlefield, opponents);
      if (selection) {
        push(selection);
      }
    }

    return selections;
  }

  private applyAutoBonusActionIfPossible(params: {
    result: any;
    attacker: Character;
    target: Character;
    battlefield: Battlefield;
    opponents: Character[];
    isCloseCombat: boolean;
    doctrine: TacticalDoctrine;
    isCharge?: boolean;
  }) {
    const { result, attacker, target, battlefield, opponents, isCloseCombat, doctrine, isCharge } = params;
    if (!result || typeof result !== 'object') return;
    const existing = result.bonusActionOutcome as BonusActionOutcome | undefined;
    if (existing?.executed) return;
    const options = Array.isArray(result.bonusActionOptions) ? (result.bonusActionOptions as BonusActionOption[]) : [];
    if (options.length === 0) return;

    const cascadesRaw = result.result?.hitTestResult?.cascades
      ?? result.hitTestResult?.cascades
      ?? 0;
    const cascades = Number.isFinite(cascadesRaw) ? Number(cascadesRaw) : 0;

    const selections = this.buildAutoBonusActionSelections(attacker, target, battlefield, opponents, options, isCloseCombat, doctrine);
    if (selections.length === 0) return;

    for (const selection of selections) {
      const outcome = applyBonusAction(
        {
          battlefield,
          attacker,
          target,
          cascades,
          isCloseCombat,
          isCharge: isCharge ?? false,
          engaged: this.areEngaged(attacker, target, battlefield),
        },
        selection
      );

      if (outcome.refreshApplied) {
        this.applyRefreshLocally(attacker);
      }
      if (outcome.executed) {
        result.bonusActionOutcome = outcome;
        break;
      }
    }
  }

  private executeFailedHitPassiveResponse(params: {
    gameManager: GameManager;
    attacker: Character;
    defender: Character;
    hitTestResult: any;
    attackType: 'melee' | 'ranged';
    options: PassiveOption[];
    doctrine: TacticalDoctrine;
    visibilityOrMu: number;
  }): { type?: PassiveOptionType; result?: unknown } {
    const { gameManager, attacker, defender, hitTestResult, attackType, options, doctrine, visibilityOrMu } = params;
    const available = options.filter(option => option.available);
    if (available.length === 0) {
      return {};
    }

    const hasType = (type: PassiveOptionType) => available.some(option => option.type === type);

    const prioritized = this.getPassiveResponsePriority(doctrine, attackType, defender);
    for (const type of prioritized) {
      if (!hasType(type)) continue;
      if (type === 'CounterStrike' && attackType === 'melee') {
        const weapon = this.pickMeleeWeapon(defender);
        if (weapon) {
          const result = gameManager.executeCounterStrike(defender, attacker, weapon as any, hitTestResult as any);
          if (result.executed) {
            this.trackPassiveUsage('CounterStrike');
            return { type: 'CounterStrike', result };
          }
        }
      }
      if (type === 'CounterFire' && attackType === 'ranged') {
        const weapon = this.pickRangedWeapon(defender) ?? this.pickMeleeWeapon(defender);
        if (weapon) {
          const result = gameManager.executeCounterFire(defender, attacker, weapon as any, hitTestResult as any, { visibilityOrMu });
          if (result.executed) {
            this.trackPassiveUsage('CounterFire');
            return { type: 'CounterFire', result };
          }
        }
      }
      if (type === 'CounterAction') {
        const result = gameManager.executeCounterAction(defender, attacker, hitTestResult as any, { attackType });
        if (result.executed) {
          this.trackPassiveUsage('CounterAction');
          return { type: 'CounterAction', result };
        }
      }
    }

    return {};
  }

  private executeCounterChargeFromMove(
    gameManager: GameManager,
    mover: Character,
    moveOptions: PassiveOption[],
    allEnemies: Character[],
    battlefield: Battlefield,
    visibilityOrMu: number
  ): void {
    const available = moveOptions.filter(option => option.available && option.type === 'CounterCharge');
    if (available.length === 0) return;
    let bestObserver: Character | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const option of available) {
      const observer = allEnemies.find(enemy => enemy.id === option.actorId);
      if (!observer) continue;
      const doctrine = this.getDoctrineForCharacter(observer);
      const score = this.scoreCounterChargeObserver(doctrine, observer, mover, battlefield);
      if (score > bestScore) {
        bestScore = score;
        bestObserver = observer;
      }
    }
    const observer = bestObserver;
    if (!observer) return;
    const result = gameManager.executeCounterCharge(observer, mover, { visibilityOrMu, moveApSpent: 1 });
    if (result.executed) {
      this.trackPassiveUsage('CounterCharge');
    }
  }

  private buildUsageMetrics(): UsageMetrics {
    const usage = Array.from(this.modelUsageByCharacter.values());
    const modelsMoved = usage.filter(model => model.pathLength > 0).length;
    const modelsUsedWait = usage.filter(model => model.waitSuccesses > 0).length;
    const modelsUsedDetect = usage.filter(model => model.detectSuccesses > 0).length;
    const modelsUsedHide = usage.filter(model => model.hideSuccesses > 0).length;
    const modelsUsedReact = usage.filter(model => model.reactSuccesses > 0).length;
    const totalPathLength = usage.reduce((sum, model) => sum + model.pathLength, 0);
    const averagePathLengthPerMovedModel = modelsMoved > 0 ? totalPathLength / modelsMoved : 0;
    const averagePathLengthPerModel = usage.length > 0 ? totalPathLength / usage.length : 0;
    const topPathModels = [...usage]
      .filter(model => model.pathLength > 0)
      .sort((a, b) => b.pathLength - a.pathLength)
      .slice(0, 10);

    this.stats.modelsMoved = modelsMoved;
    this.stats.totalPathLength = totalPathLength;

    return {
      modelCount: usage.length,
      modelsMoved,
      modelsUsedWait,
      modelsUsedDetect,
      modelsUsedHide,
      modelsUsedReact,
      totalPathLength,
      averagePathLengthPerMovedModel,
      averagePathLengthPerModel,
      topPathModels,
      modelUsage: usage,
    };
  }

  private snapshotModelState(character: Character): ModelStateAudit {
    return {
      wounds: character.state.wounds ?? 0,
      delayTokens: character.state.delayTokens ?? 0,
      fearTokens: character.state.fearTokens ?? 0,
      isKOd: Boolean(character.state.isKOd),
      isEliminated: Boolean(character.state.isEliminated),
      isHidden: Boolean(character.state.isHidden),
      isWaiting: Boolean(character.state.isWaiting),
      isAttentive: Boolean(character.state.isAttentive),
      isOrdered: Boolean(character.state.isOrdered),
    };
  }

  private diffModelState(before: ModelStateAudit, after: ModelStateAudit): string[] {
    const changes: string[] = [];
    const keys = Object.keys(before) as Array<keyof ModelStateAudit>;
    for (const key of keys) {
      if (before[key] !== after[key]) {
        changes.push(String(key));
      }
    }
    return changes;
  }

  private createMovementVector(
    start: Position,
    end: Position,
    stepMu: number = 0.5
  ): AuditVector {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const sampledPoints = this.sampleLinePoints(start, end, stepMu);
    return {
      kind: 'movement',
      from: start,
      to: end,
      distanceMu: distance,
      sampleStepMu: stepMu,
      sampledPoints,
    };
  }

  private sampleLinePoints(start: Position, end: Position, stepMu: number = 0.5): Position[] {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (!Number.isFinite(distance) || distance <= 0) {
      return [start];
    }

    const points: Position[] = [start];
    const count = Math.floor(distance / stepMu);
    for (let i = 1; i <= count; i++) {
      const ratio = Math.min(1, (i * stepMu) / distance);
      points.push({
        x: Number((start.x + (end.x - start.x) * ratio).toFixed(3)),
        y: Number((start.y + (end.y - start.y) * ratio).toFixed(3)),
      });
    }
    if (points.length === 0 || points[points.length - 1].x !== end.x || points[points.length - 1].y !== end.y) {
      points.push(end);
    }
    return points;
  }

  private toOpposedTestAudit(rawResult: any): OpposedTestAudit | undefined {
    const hitTest = rawResult?.result?.hitTestResult ?? rawResult?.hitTestResult;
    if (!hitTest || typeof hitTest !== 'object') {
      return undefined;
    }
    return {
      pass: Boolean(hitTest.pass),
      score: typeof hitTest.score === 'number' ? hitTest.score : undefined,
      participant1Score: typeof hitTest.participant1Score === 'number' ? hitTest.participant1Score : undefined,
      participant2Score: typeof hitTest.participant2Score === 'number' ? hitTest.participant2Score : undefined,
      p1Rolls: Array.isArray(hitTest.p1Rolls) ? hitTest.p1Rolls : undefined,
      p2Rolls: Array.isArray(hitTest.p2Rolls) ? hitTest.p2Rolls : undefined,
      finalPools: hitTest.finalPools && typeof hitTest.finalPools === 'object'
        ? hitTest.finalPools as Record<string, unknown>
        : undefined,
    };
  }

  private createModelEffect(
    character: Character,
    relation: ModelEffectAudit['relation'],
    before: ModelStateAudit,
    after: ModelStateAudit
  ): ModelEffectAudit | null {
    const changed = this.diffModelState(before, after);
    if (changed.length === 0) return null;
    return {
      modelId: character.id,
      modelName: character.profile.name,
      side: this.sideNameByCharacterId.get(character.id),
      relation,
      before,
      after,
      changed,
    };
  }

  private createBattleAuditTrace(
    config: GameConfig,
    seed: number | undefined
  ): BattleAuditTrace {
    return {
      version: '1.0',
      session: {
        missionId: config.missionId,
        missionName: config.missionName,
        seed,
        lighting: config.lighting,
        visibilityOrMu: config.visibilityOrMu,
        maxOrm: config.maxOrm,
        allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
        perCharacterFovLos: config.perCharacterFovLos,
      },
      battlefield: {
        widthMu: config.battlefieldSize,
        heightMu: config.battlefieldSize,
        movementSampleStepMu: 0.5,
        lofWidthMu: 1,
      },
      turns: this.auditTurns,
    };
  }

  private describeArchetype(character: Character): string {
    const arch = character.profile.archetype as unknown;
    if (typeof arch === 'string') return arch;
    if (arch && typeof arch === 'object' && !Array.isArray(arch)) {
      const keys = Object.keys(arch as Record<string, unknown>);
      if (keys.length > 0) {
        return keys.join('|');
      }
    }
    return 'Unknown';
  }

  private buildNestedSections(
    config: GameConfig,
    sides: Array<{ characters: Character[]; totalBP: number }>,
    battlefield: Battlefield,
    startPositions: Map<string, Position>
  ): NestedSections {
    const sideSections: SideSection[] = [];

    for (let sideIndex = 0; sideIndex < config.sides.length; sideIndex++) {
      const sideConfig = config.sides[sideIndex];
      const sideRuntime = sides[sideIndex];
      if (!sideConfig || !sideRuntime) continue;
      const assemblyName = sideConfig.assemblyName;
      const characters: CharacterSection[] = sideRuntime.characters.map(character => {
        const equipment = (character.profile.equipment || character.profile.items || [])
          .filter(Boolean)
          .map(item => ({
            name: item?.name ?? 'Unknown Item',
            classification: item?.classification ?? item?.class,
            traits: Array.isArray(item?.traits) ? item.traits : undefined,
          }));
        const endPosition = battlefield.getCharacterPosition(character);
        return {
          id: character.id,
          name: character.profile.name,
          profile: {
            name: character.profile.name,
            archetype: this.describeArchetype(character),
            attributes: { ...(character.attributes as Record<string, number>) },
            finalAttributes: { ...(character.finalAttributes as Record<string, number>) },
            totalBp: character.profile.totalBp,
            burdenTotal: character.profile.burden?.totalBurden,
            equipment,
          },
          startPosition: startPositions.get(character.id),
          endPosition: endPosition ? { x: endPosition.x, y: endPosition.y } : undefined,
          state: this.snapshotModelState(character),
        };
      });

      sideSections.push({
        name: sideConfig.name,
        assemblies: [
          {
            name: assemblyName,
            totalBP: sideRuntime.totalBP,
            characters,
          },
        ],
      });
    }

    const deploymentIndex = new Map<string, { sideName: string; assemblyName: string; characterName: string }>();
    for (const side of sideSections) {
      for (const assembly of side.assemblies) {
        for (const character of assembly.characters) {
          deploymentIndex.set(character.id, {
            sideName: side.name,
            assemblyName: assembly.name,
            characterName: character.name,
          });
        }
      }
    }

    const deployments = Array.from(deploymentIndex.entries()).map(([characterId, metadata]) => {
      const current = sides
        .flatMap(side => side.characters)
        .find(character => character.id === characterId);
      const end = current ? battlefield.getCharacterPosition(current) : undefined;
      return {
        characterId,
        characterName: metadata.characterName,
        sideName: metadata.sideName,
        assemblyName: metadata.assemblyName,
        startPosition: startPositions.get(characterId),
        endPosition: end ? { x: end.x, y: end.y } : undefined,
      };
    });

    const terrainFeatures = battlefield.terrain.map(feature => ({
      id: feature.id,
      type: String(feature.type),
      metaName: feature.meta?.name,
      movement: feature.meta?.movement,
      los: feature.meta?.los,
      rotationDegrees: feature.meta?.rotationDegrees,
      vertices: feature.vertices.map(v => ({ x: v.x, y: v.y })),
    }));

    return {
      sides: sideSections,
      battlefieldLayout: {
        widthMu: battlefield.width,
        heightMu: battlefield.height,
        densityRatio: config.densityRatio,
        terrainFeatures,
        deployments,
      },
    };
  }

  private sanitizeForAudit(
    value: unknown,
    depth: number = 0,
    seen: WeakSet<object> = new WeakSet<object>()
  ): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (depth >= 4) return '[truncated]';

    if (Array.isArray(value)) {
      return value.slice(0, 25).map(item => this.sanitizeForAudit(item, depth + 1, seen));
    }

    if (value instanceof Character) {
      return {
        id: value.id,
        name: value.profile.name,
        side: this.sideNameByCharacterId.get(value.id),
        state: this.snapshotModelState(value),
      };
    }

    if (value instanceof Battlefield) {
      return {
        width: value.width,
        height: value.height,
      };
    }

    if (value instanceof Map) {
      const entries = Array.from(value.entries()).slice(0, 25).map(([k, v]) => [
        this.sanitizeForAudit(k, depth + 1, seen),
        this.sanitizeForAudit(v, depth + 1, seen),
      ]);
      return { mapEntries: entries };
    }

    if (typeof value === 'object') {
      if (seen.has(value as object)) return '[circular]';
      seen.add(value as object);
      const output: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
        if (typeof val === 'function') continue;
        output[key] = this.sanitizeForAudit(val, depth + 1, seen);
      }
      return output;
    }

    return String(value);
  }

  async runBattle(
    config: GameConfig,
    options: { seed?: number; suppressOutput?: boolean } = {}
  ): Promise<BattleReport> {
    this.resetRunState();
    const seed = options.seed ?? config.seed;
    const originalRandom = Math.random;
    if (typeof seed === 'number') {
      Math.random = createSeededRandom(seed);
    }

    try {
      const outputEnabled = !options.suppressOutput;
      const out = (...args: unknown[]) => {
        if (outputEnabled) {
          console.log(...args);
        }
      };
      const verbose = config.verbose && outputEnabled;

      out('\n⚔️  Starting Battle\n');
      out(`Mission: ${config.missionName}`);
      out(`Battlefield: ${config.battlefieldSize}×${config.battlefieldSize} MU`);
      out(`Max Turns: ${config.maxTurns}\n`);

      // Build assemblies
      const sides = await Promise.all(config.sides.map(side => this.createAssembly(side)));
      this.initializeModelUsage(config, sides);

      out('Assemblies built:');
      sides.forEach((side, i) => {
        out(`  ${config.sides[i].name}: ${side.characters.length} models, ${side.totalBP} BP`);
      });
      out();

      // Create battlefield
      const battlefield = this.createBattlefield(config.battlefieldSize, config.densityRatio);
      this.currentBattlefield = battlefield;

      // Deploy models
      sides.forEach((side, i) => {
        this.deployModels(side, battlefield, i, config.battlefieldSize);
      });
      const allCharacters = sides.flatMap(s => s.characters);
      const startPositions = new Map<string, Position>();
      for (const character of allCharacters) {
        const position = battlefield.getCharacterPosition(character);
        if (position) {
          startPositions.set(character.id, { x: position.x, y: position.y });
        }
      }

      out('Models deployed.\n');
      out('─'.repeat(60) + '\n');

      // Create game manager
      const gameManager = new GameManager(allCharacters, battlefield);
      this.missionSides = this.createMissionSides(config, sides);
      this.missionSideIds = this.missionSides.map(side => side.id);
      this.missionVpBySide = Object.fromEntries(this.missionSideIds.map(sideId => [sideId, 0]));
      this.missionRpBySide = Object.fromEntries(this.missionSideIds.map(sideId => [sideId, 0]));
      this.missionRuntimeAdapter = createMissionRuntimeAdapter(config.missionId, this.missionSides);
      gameManager.setMissionRuntimeAdapter(this.missionRuntimeAdapter);
      this.applyMissionStartOverrides(config, sides, gameManager);

      // Create AI controllers
      const aiControllers = new Map<string, CharacterAI>();
      config.sides.forEach((sideConfig, sideIndex) => {
        const sideCharacters = sides[sideIndex].characters;
        sideCharacters.forEach(char => {
          const aiConfig = {
            ...DEFAULT_CHARACTER_AI_CONFIG,
            enablePatterns: false,
            enableGOAP: false,
            ai: {
              ...DEFAULT_CHARACTER_AI_CONFIG.ai,
              aggression: sideConfig.aggression,
              caution: sideConfig.caution,
              visibilityOrMu: config.visibilityOrMu,
              maxOrm: config.maxOrm,
              allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
              perCharacterFovLos: config.perCharacterFovLos,
            },
          };
          aiControllers.set(char.id, new CharacterAI(aiConfig));
        });
      });

      // Run game loop
      let gameOver = false;
      let turn = 0;

      while (!gameOver && turn < config.maxTurns) {
        turn++;
        this.stats.turnsCompleted = turn;
        gameManager.startTurn();
        if (this.missionRuntimeAdapter) {
          const turnStartUpdate = this.missionRuntimeAdapter.onTurnStart(turn, this.buildMissionModels(battlefield));
          this.applyMissionRuntimeUpdate(turnStartUpdate);
        }
        const turnAudit: TurnAudit = {
          turn,
          activations: [],
          sideSummaries: config.sides.map((side, idx) => ({
            sideName: side.name,
            activeModelsStart: sides[idx].characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length,
            activeModelsEnd: 0,
          })),
        };
        this.auditTurns.push(turnAudit);

        if (verbose) {
          out(`\n📍 Turn ${turn}\n`);
        }

        // Process each side
        for (let sideIndex = 0; sideIndex < config.sides.length; sideIndex++) {
          const sideCharacters = sides[sideIndex].characters
            .filter(c => !c.state.isEliminated && !c.state.isKOd)
            .sort((a, b) => (b.finalAttributes?.int ?? b.attributes?.int ?? 0) - (a.finalAttributes?.int ?? a.attributes?.int ?? 0));

          for (const character of sideCharacters) {
            const aiController = aiControllers.get(character.id)!;
            const activationAudit = await this.resolveCharacterTurn(
              character,
              sides,
              battlefield,
              gameManager,
              aiController,
              turn,
              sideIndex,
              { ...config, verbose }
            );
            if (activationAudit) {
              turnAudit.activations.push(activationAudit);
            }
          }
        }

        turnAudit.sideSummaries = turnAudit.sideSummaries.map((summary, idx) => ({
          ...summary,
          activeModelsEnd: sides[idx].characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length,
        }));

        if (this.missionRuntimeAdapter) {
          const turnEndUpdate = this.missionRuntimeAdapter.onTurnEnd(turn, this.buildMissionModels(battlefield));
          this.applyMissionRuntimeUpdate(turnEndUpdate);
        }

        // Check victory conditions
        const remainingPerSide = sides.map((side) =>
          side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length
        );

        if (this.missionImmediateWinnerSideId) {
          gameOver = true;
          if (verbose) {
            out(`\n🏆 Mission immediate winner: ${this.missionImmediateWinnerSideId}\n`);
          }
        }

        const sidesWithModels = remainingPerSide.filter(r => r > 0).length;
        if (!gameOver && sidesWithModels <= 1) {
          gameOver = true;
          if (verbose) {
            out(`\n🏆 Game Over - Only ${sidesWithModels} side(s) with models remaining!\n`);
          }
        } else if (!gameOver && turn >= config.endGameTurn) {
          if (Math.random() < 0.5) {
            gameOver = true;
            if (verbose) {
              out(`\n🎲 End game die roll - Game Over!\n`);
            }
          }
        }

        if (verbose) {
          config.sides.forEach((side, i) => {
            out(`  ${side.name}: ${remainingPerSide[i]}/${sides[i].characters.length} models`);
          });
        }
      }

      if (this.missionRuntimeAdapter) {
        const finalUpdate = this.missionRuntimeAdapter.finalize(this.buildMissionModels(battlefield));
        this.applyMissionRuntimeUpdate(finalUpdate);
      }

      // Generate results
      const finalCounts = sides.map((side) =>
        side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length
      );

      const maxRemaining = Math.max(...finalCounts);
      const winners = config.sides.filter((_, i) => finalCounts[i] === maxRemaining);
      const usage = this.buildUsageMetrics();
      const missionWinner = this.resolveMissionWinnerName();
      const resolvedWinner = missionWinner ?? (
        winners.length === 1 ? winners[0].name : (winners.length === 0 ? 'None' : 'Draw')
      );

      const report: BattleReport = {
        config,
        winner: resolvedWinner,
        finalCounts: config.sides.map((side, i) => ({ name: side.name, remaining: finalCounts[i] })),
        stats: this.stats,
        missionRuntime: {
          vpBySide: { ...this.missionVpBySide },
          rpBySide: { ...this.missionRpBySide },
          immediateWinnerSideId: this.missionImmediateWinnerSideId ?? undefined,
        },
        usage,
        nestedSections: this.buildNestedSections(config, sides, battlefield, startPositions),
        advancedRules: this.advancedRules,
        log: this.log,
        audit: this.createBattleAuditTrace(config, seed),
        seed,
      };

      if (outputEnabled) {
        this.displayReport(report);
      }

      return report;
    } finally {
      if (typeof seed === 'number') {
        Math.random = originalRandom;
      }
    }
  }

  private async createAssembly(sideConfig: SideConfig): Promise<{ characters: Character[]; totalBP: number }> {
    const compositions = sideConfig.loadoutProfile === 'melee_only'
      ? [
          // Melee-only profile: no ranged classifications and no throwable traits.
          { archetypeName: 'Average', weight: 4, items: ['Sword, Broad', 'Shield, Medium'] },
          { archetypeName: 'Militia', weight: 2, items: ['Sword, Broad', 'Shield, Medium'] },
          { archetypeName: 'Veteran', weight: 3, items: ['Sword, Broad', 'Shield, Medium'] },
          { archetypeName: 'Elite', weight: 1, items: ['Sword, Broad', 'Shield, Medium'] },
        ]
      : [
          { archetypeName: 'Average', weight: 3, items: ['Sword, Broad', 'Shield, Medium'] },
          { archetypeName: 'Militia', weight: 2, items: ['Spear, Medium', 'Shield, Medium'] },
          { archetypeName: 'Veteran', weight: 3, items: ['Rifle, Light, Semi/A'] },
          { archetypeName: 'Veteran', weight: 2, items: ['Pistol, Medium, Auto', 'Sword, Broad'] },
          { archetypeName: 'Elite', weight: 1, items: ['Rifle, Light, Semi/A', 'Sword, Broad'] },
        ];

    const profiles = [];
    for (let i = 0; i < sideConfig.modelCount; i++) {
      const totalWeight = compositions.reduce((sum, c) => sum + c.weight, 0);
      let random = Math.random() * totalWeight;
      let selected = compositions[0];
      for (const comp of compositions) {
        random -= comp.weight;
        if (random <= 0) { selected = comp; break; }
      }

      const profile = buildProfile(selected.archetypeName, { itemNames: selected.items });
      // Ensure equipment is set from items
      if (!profile.equipment && profile.items) {
        profile.equipment = profile.items;
      }
      if (Array.isArray(profile.items)) {
        profile.items = profile.items.filter(Boolean);
      }
      if (Array.isArray(profile.equipment)) {
        profile.equipment = profile.equipment.filter(Boolean);
      }
      profiles.push(profile);
    }

    const assembly = buildAssembly(sideConfig.assemblyName, profiles);
    assembly.characters.forEach((character, index) => {
      character.id = `${sideConfig.assemblyName}-${index + 1}-${character.id}`;
    });
    return { characters: assembly.characters, totalBP: assembly.assembly.totalBP };
  }

  private createBattlefield(size: number, densityRatio: number): Battlefield {
    const battlefield = new Battlefield(size, size);

    const terrainTypes = ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks', 'Large Rocks'];
    const terrainCount = Math.floor((size * size * densityRatio) / 10000);

    for (let i = 0; i < terrainCount; i++) {
      const terrainName = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
      const x = Math.floor(2 + Math.random() * (size - 4));
      const y = Math.floor(2 + Math.random() * (size - 4));
      const rotation = Math.floor(Math.random() * 360);

      battlefield.addTerrainElement(new TerrainElement(terrainName, { x, y }, rotation));
    }

    return battlefield;
  }

  private deployModels(assembly: { characters: Character[] }, battlefield: Battlefield, sideIndex: number, size: number) {
    const edgeMargin = 3;
    const deploymentDepth = Math.max(6, Math.floor(size * 0.22));
    const count = assembly.characters.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * (size / deploymentDepth))));
    const rows = Math.max(1, Math.ceil(count / cols));
    const xSpacing = cols > 1 ? (size - edgeMargin * 2 - 1) / (cols - 1) : 0;
    const ySpacing = rows > 1 ? (deploymentDepth - 1) / (rows - 1) : 0;
    const sideStartY = sideIndex === 0
      ? edgeMargin
      : Math.max(edgeMargin, size - edgeMargin - deploymentDepth);

    assembly.characters.forEach((char: Character, i: number) => {
      let x, y;
      const row = Math.floor(i / cols);
      const col = i % cols;

      x = edgeMargin + col * xSpacing;
      y = sideStartY + row * ySpacing;
      const preferred = {
        x: Math.max(0, Math.min(size - 1, Math.round(x))),
        y: Math.max(0, Math.min(size - 1, Math.round(y))),
      };
      const fallbackRadius = Math.max(2, Math.ceil(Math.sqrt(count)));
      const deploymentCell = this.findOpenCellNear(preferred, battlefield, fallbackRadius);
      if (!deploymentCell) {
        throw new Error(`Unable to deploy model ${char.id} at side index ${sideIndex}.`);
      }
      battlefield.placeCharacter(char, deploymentCell);
    });
  }

  private findOpenCellNear(
    preferred: Position,
    battlefield: Battlefield,
    maxRadius: number
  ): Position | null {
    const cx = Math.max(0, Math.min(battlefield.width - 1, Math.round(preferred.x)));
    const cy = Math.max(0, Math.min(battlefield.height - 1, Math.round(preferred.y)));

    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
            continue;
          }
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || x >= battlefield.width || y < 0 || y >= battlefield.height) {
            continue;
          }
          if (!battlefield.getCharacterAt({ x, y })) {
            return { x, y };
          }
        }
      }
    }
    return null;
  }

  private async resolveCharacterTurn(
    character: Character,
    allSides: { characters: Character[] }[],
    battlefield: Battlefield,
    gameManager: GameManager,
    aiController: CharacterAI,
    turn: number,
    sideIndex: number,
    config: GameConfig
  ): Promise<ActivationAudit | null> {
    const sideConfig = config.sides[sideIndex];
    const sideName = sideConfig.name;
    const waitAtStart = character.state.isWaiting;
    const delayTokensAtStart = character.state.delayTokens;
    const enemiesAtStart = allSides
      .flatMap((side, index) => (index === sideIndex ? [] : side.characters))
      .filter(enemy => !enemy.state.isEliminated && !enemy.state.isKOd);
    const freeAtStart = waitAtStart
      ? this.isFreeFromEngagementInTurn(character, enemiesAtStart, battlefield)
      : true;
    const apAfterDelay = Math.max(0, gameManager.apPerActivation - delayTokensAtStart);
    const initialAp = gameManager.beginActivation(character);
    const waitMaintained = waitAtStart && character.state.isWaiting;
    const waitUpkeepPaid = waitAtStart && !freeAtStart && initialAp < apAfterDelay;
    if (waitMaintained) {
      this.stats.waitMaintained++;
    }
    if (waitUpkeepPaid) {
      this.stats.waitUpkeepPaid++;
    }
    const activationAudit: ActivationAudit = {
      activationSequence: ++this.activationSequence,
      turn,
      sideIndex,
      sideName,
      modelId: character.id,
      modelName: character.profile.name,
      initiative: character.finalAttributes.int ?? character.attributes.int ?? 0,
      apStart: initialAp,
      apEnd: initialAp,
      waitAtStart,
      waitMaintained,
      waitUpkeepPaid,
      delayTokensAtStart,
      delayTokensAfterUpkeep: character.state.delayTokens,
      steps: [],
    };
    if (initialAp <= 0) {
      activationAudit.apEnd = 0;
      activationAudit.skippedReason = 'no_ap';
      gameManager.endActivation(character);
      return activationAudit;
    }

    this.applyDoctrineLoadoutConfig(aiController, character, sideConfig, sideIndex, config);

    let lastKnownAp = initialAp;
    try {
      let guard = 0;
      while (gameManager.getApRemaining(character) > 0 && guard < 8) {
        guard++;

        const allies = allSides[sideIndex].characters.filter(c => c.id !== character.id && !c.state.isEliminated && !c.state.isKOd);
        const enemies = allSides.flatMap((side, i) => i !== sideIndex ? side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd) : []);
        if (enemies.length === 0) {
          break;
        }

        const apBefore = gameManager.getApRemaining(character);
        const context: AIContext = {
          character,
          allies,
          enemies,
          battlefield,
          currentTurn: turn,
          currentRound: 1,
          apRemaining: apBefore,
          sideId: sideName,
          objectiveMarkers: this.buildAiObjectiveMarkerSnapshot(gameManager),
          knowledge: emptyKnowledge(turn),
          config: aiController.getConfig(),
        };
        context.knowledge = aiController.updateKnowledge(context);

        const aiResult = await aiController.decideAction(context);
        const decision = aiResult.decision;
        if (!decision || decision.type === 'none') {
          if (activationAudit.steps.length === 0) {
            activationAudit.skippedReason = 'no_valid_action';
          }
          break;
        }

        const startPos = battlefield.getCharacterPosition(character);
        const actorStateBefore = this.snapshotModelState(character);
        const stepVectors: AuditVector[] = [];
        const stepTargets: ActionStepAudit['targets'] = [];
        const stepAffectedModels: ModelEffectAudit[] = [];
        const stepInteractions: ActionStepAudit['interactions'] = [];
        let stepOpposedTest: OpposedTestAudit | undefined;
        let stepRangeCheck: ActionStepAudit['rangeCheck'] | undefined;
        let stepDetails: Record<string, unknown> | undefined;
        let actionExecuted = false;
        let result = '';
        const targetStateBefore = decision.target ? this.snapshotModelState(decision.target) : undefined;
        if (decision.target) {
          const targetSide = this.sideNameByCharacterId.get(decision.target.id);
          stepTargets.push({
            modelId: decision.target.id,
            modelName: decision.target.profile.name,
            side: targetSide,
            relation: decision.target.id === character.id ? 'self' : (targetSide === sideName ? 'ally' : 'enemy'),
          });
        }
        if (!decision.target && decision.markerTargetModelId) {
          const markerTarget = allSides
            .flatMap(side => side.characters)
            .find(candidate => candidate.id === decision.markerTargetModelId);
          if (markerTarget) {
            const targetSide = this.sideNameByCharacterId.get(markerTarget.id);
            stepTargets.push({
              modelId: markerTarget.id,
              modelName: markerTarget.profile.name,
              side: targetSide,
              relation: targetSide === sideName ? 'ally' : 'enemy',
            });
          }
        }

        if (config.verbose) {
          console.log(`  ${character.profile.name} (${sideName}) [AP ${apBefore}]: ${decision.type}${decision.reason ? ` - ${decision.reason}` : ''}`);
        }

        switch (decision.type) {
          case 'hold': {
            const fallback = this.computeFallbackMovePosition(character, enemies, battlefield, config);
            if (fallback && gameManager.spendAp(character, 1)) {
              const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
              const opportunityWeapon = equipment.find(i => i?.classification === 'Melee' || i?.class === 'Melee') || equipment[0];
              const moved = gameManager.executeMove(character, fallback, {
                opponents: enemies,
                allowOpportunityAttack: true,
                opportunityWeapon: opportunityWeapon ?? undefined,
              });
              if (moved.moved) {
                const opportunity = (moved as any)?.opportunityAttack;
                if (opportunity?.attacker) {
                  this.trackPassiveUsage('OpportunityAttack');
                  this.trackCombatExtras(opportunity.result);
                  stepInteractions.push({
                    kind: 'opportunity_attack',
                    sourceModelId: opportunity.attacker.id,
                    targetModelId: character.id,
                    success: Boolean(opportunity.result?.result?.hit ?? opportunity.result?.hit),
                    detail: 'Opportunity attack triggered by movement disengage',
                  });
                  stepOpposedTest = this.toOpposedTestAudit(opportunity.result) ?? stepOpposedTest;
                  const actorStateAfterOpportunity = this.snapshotModelState(character);
                  this.syncMissionRuntimeForAttack(
                    opportunity.attacker,
                    character,
                    actorStateBefore,
                    actorStateAfterOpportunity,
                    this.extractDamageResolutionFromUnknown(opportunity.result)
                  );
                }
                this.stats.moves++;
                actionExecuted = true;
                result = 'move=true:from-hold';
                stepDetails = {
                  source: 'hold_fallback_move',
                  moveResult: this.sanitizeForAudit(moved) as Record<string, unknown>,
                  opportunityAttack: opportunity as Record<string, unknown> | undefined,
                };
                break;
              }
            }

            this.trackAttempt(character, 'wait');
            this.stats.waits++;
            const wait = gameManager.executeWait(character, {
              spendAp: true,
              opponents: enemies,
              visibilityOrMu: config.visibilityOrMu,
              allowRevealReposition: false,
            });
            result = wait.success ? 'wait=true' : `wait=false:${wait.reason ?? 'failed'}`;
            stepDetails = { waitResult: this.sanitizeForAudit(wait) as Record<string, unknown> };
            if (wait.success) {
              this.trackSuccess(character, 'wait');
              actionExecuted = true;
            }
            break;
          }
          case 'wait': {
            this.trackAttempt(character, 'wait');
            this.stats.waits++;
            const wait = gameManager.executeWait(character, {
              spendAp: true,
              opponents: enemies,
              visibilityOrMu: config.visibilityOrMu,
              allowRevealReposition: false,
            });
            result = wait.success ? 'wait=true' : `wait=false:${wait.reason ?? 'failed'}`;
            stepDetails = { waitResult: this.sanitizeForAudit(wait) as Record<string, unknown> };
            if (wait.success) {
              this.trackSuccess(character, 'wait');
              actionExecuted = true;
            }
            break;
          }
          case 'move': {
            if (!gameManager.spendAp(character, 1)) {
              result = 'move=false:not-enough-ap';
              break;
            }
            const destination = decision.position ?? this.computeFallbackMovePosition(character, enemies, battlefield, config);
            if (!destination) {
              result = 'move=false:no-destination';
              break;
            }
            const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
            const opportunityWeapon = equipment.find(i => i?.classification === 'Melee' || i?.class === 'Melee') || equipment[0];
            const moved = gameManager.executeMove(character, destination, {
              opponents: enemies,
              allowOpportunityAttack: true,
              opportunityWeapon: opportunityWeapon ?? undefined,
            });
            if (moved.moved) {
              this.stats.moves++;
              actionExecuted = true;
              result = 'move=true';
              stepDetails = { moveResult: this.sanitizeForAudit(moved) as Record<string, unknown> };
            } else {
              result = `move=false:${moved.reason ?? 'blocked'}`;
              stepDetails = { moveResult: this.sanitizeForAudit(moved) as Record<string, unknown> };
            }

            const opportunity = (moved as any)?.opportunityAttack;
            if (opportunity?.attacker) {
              this.trackPassiveUsage('OpportunityAttack');
              this.trackCombatExtras(opportunity.result);
              stepInteractions.push({
                kind: 'opportunity_attack',
                sourceModelId: opportunity.attacker.id,
                targetModelId: character.id,
                success: Boolean(opportunity.result?.result?.hit ?? opportunity.result?.hit),
                detail: 'Opportunity attack triggered by movement disengage',
              });
              stepOpposedTest = this.toOpposedTestAudit(opportunity.result) ?? stepOpposedTest;
              stepDetails = {
                ...(stepDetails ?? {}),
                opportunityAttack: opportunity as Record<string, unknown>,
              };
              const actorStateAfterOpportunity = this.snapshotModelState(character);
              this.syncMissionRuntimeForAttack(
                opportunity.attacker,
                character,
                actorStateBefore,
                actorStateAfterOpportunity,
                this.extractDamageResolutionFromUnknown(opportunity.result)
              );
            }
            break;
          }
          case 'charge':
          case 'close_combat': {
            if (!decision.target) {
              result = 'close_combat=false:no-target';
              break;
            }

            let movedForEngagement = false;
            const wasEngaged = this.areEngaged(character, decision.target, battlefield);
            if (!wasEngaged) {
              const engagePos = this.computeEngageMovePosition(character, decision.target, battlefield);
              if (engagePos) {
                if (!gameManager.spendAp(character, 1)) {
                  result = 'close_combat=false:not-enough-ap-for-move';
                  break;
                }
                const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
                const opportunityWeapon = equipment.find(i => i?.classification === 'Melee' || i?.class === 'Melee') || equipment[0];
                const moved = gameManager.executeMove(character, engagePos, {
                  opponents: enemies,
                  allowOpportunityAttack: true,
                  opportunityWeapon: opportunityWeapon ?? undefined,
                });
                if (moved.moved) {
                  const opportunity = (moved as any)?.opportunityAttack;
                  if (opportunity?.attacker) {
                    this.trackPassiveUsage('OpportunityAttack');
                    this.trackCombatExtras(opportunity.result);
                    stepInteractions.push({
                      kind: 'opportunity_attack',
                      sourceModelId: opportunity.attacker.id,
                      targetModelId: character.id,
                      success: Boolean(opportunity.result?.result?.hit ?? opportunity.result?.hit),
                      detail: 'Opportunity attack triggered by movement disengage',
                    });
                    stepOpposedTest = this.toOpposedTestAudit(opportunity.result) ?? stepOpposedTest;
                    stepDetails = {
                      ...(stepDetails ?? {}),
                      engageMoveResult: this.sanitizeForAudit(moved) as Record<string, unknown>,
                      opportunityAttack: opportunity as Record<string, unknown>,
                    };
                    const actorStateAfterOpportunity = this.snapshotModelState(character);
                    this.syncMissionRuntimeForAttack(
                      opportunity.attacker,
                      character,
                      actorStateBefore,
                      actorStateAfterOpportunity,
                      this.extractDamageResolutionFromUnknown(opportunity.result)
                    );
                  } else {
                    stepDetails = {
                      ...(stepDetails ?? {}),
                      engageMoveResult: this.sanitizeForAudit(moved) as Record<string, unknown>,
                    };
                  }
                  movedForEngagement = true;
                  actionExecuted = true;
                  this.stats.moves++;
                }
              }
            }

            if (this.areEngaged(character, decision.target, battlefield)) {
              const weapon = this.pickMeleeWeapon(character);
              if (!weapon) {
                result = 'close_combat=false:no-weapon';
                break;
              }
              const attackCost = gameManager.getAttackApCost(character, weapon as any);
              if (!gameManager.spendAp(character, attackCost)) {
                result = `close_combat=false:not-enough-ap(${attackCost})`;
                break;
              }
              const closeExecuted = await this.executeCloseCombat(
                character,
                decision.target,
                battlefield,
                gameManager,
                config,
                turn,
                sideIndex,
                decision.type === 'charge' || movedForEngagement
              );
              actionExecuted = actionExecuted || closeExecuted.executed;
              result = closeExecuted.resultCode;
              if (closeExecuted.executed) {
                this.stats.closeCombats++;
              }
              stepOpposedTest = closeExecuted.opposedTest;
              stepDetails = closeExecuted.details;
            } else if (!actionExecuted) {
              result = 'close_combat=false:not-engaged';
            }
            break;
          }
          case 'ranged_combat': {
            if (!decision.target) {
              result = 'ranged=false:no-target';
              break;
            }
            const ranged = await this.executeRangedCombat(
              character,
              decision.target,
              battlefield,
              gameManager,
              config,
              turn,
              sideIndex
            );
            actionExecuted = ranged.executed;
            result = ranged.result;
            if (ranged.executed) {
              this.stats.rangedCombats++;
            }
            stepOpposedTest = ranged.opposedTest;
            stepRangeCheck = ranged.rangeCheck;
            if (ranged.vectors.length > 0) {
              stepVectors.push(...ranged.vectors);
            }
            stepDetails = ranged.details;
            break;
          }
          case 'disengage': {
            if (!decision.target) {
              result = 'disengage=false:no-target';
              break;
            }
            if (!gameManager.spendAp(character, 1)) {
              result = 'disengage=false:not-enough-ap';
              break;
            }
            this.stats.disengages++;
            const disengage = await this.executeDisengage(character, decision.target, battlefield, gameManager, config, turn, sideIndex);
            actionExecuted = disengage.executed;
            result = disengage.resultCode;
            stepOpposedTest = disengage.opposedTest;
            stepDetails = disengage.details;
            break;
          }
          case 'detect': {
            if (!decision.target) {
              result = 'detect=false:no-target';
              break;
            }
            this.trackAttempt(character, 'detect');
            this.stats.detects++;
            if (!gameManager.spendAp(character, 1)) {
              result = 'detect=false:not-enough-ap';
              break;
            }
            const useLean = this.shouldUseLeanForDetect(character, decision.target, battlefield);
            const detect = attemptDetect(battlefield, character, decision.target, enemies, {
              attackerLeaning: useLean,
            });
            this.trackSituationalModifiers({ isLeaning: useLean }, undefined);
            if (useLean) {
              this.incrementTypeBreakdown(this.advancedRules.situationalModifiers.byType, 'detect_lean');
            }
            result = detect.success ? 'detect=true' : `detect=false:${detect.reason ?? 'failed'}`;
            stepDetails = {
              detectResult: this.sanitizeForAudit(detect) as Record<string, unknown>,
              leanApplied: useLean,
            };
            if (detect.success) {
              this.trackSuccess(character, 'detect');
              actionExecuted = true;
            }
            break;
          }
          case 'hide': {
            this.trackAttempt(character, 'hide');
            this.stats.hides++;
            const hide = attemptHide(battlefield, character, enemies, (amount: number) => gameManager.spendAp(character, amount));
            result = hide.canHide ? 'hide=true' : `hide=false:${hide.reason ?? 'failed'}`;
            stepDetails = { hideResult: this.sanitizeForAudit(hide) as Record<string, unknown> };
            if (hide.canHide) {
              this.trackSuccess(character, 'hide');
              actionExecuted = true;
            }
            break;
          }
          case 'rally': {
            if (!decision.target) {
              result = 'rally=false:no-target';
              break;
            }
            if (!gameManager.spendAp(character, 1)) {
              result = 'rally=false:not-enough-ap';
              break;
            }
            const rally = gameManager.executeRally(character, decision.target);
            result = rally.success ? 'rally=true' : `rally=false:${rally.reason ?? 'failed'}`;
            stepDetails = { rallyResult: this.sanitizeForAudit(rally) as Record<string, unknown> };
            actionExecuted = rally.success;
            break;
          }
          case 'revive': {
            if (!decision.target) {
              result = 'revive=false:no-target';
              break;
            }
            if (!gameManager.spendAp(character, 1)) {
              result = 'revive=false:not-enough-ap';
              break;
            }
            const revive = gameManager.executeRevive(character, decision.target);
            result = revive.success ? 'revive=true' : `revive=false:${revive.reason ?? 'failed'}`;
            stepDetails = { reviveResult: this.sanitizeForAudit(revive) as Record<string, unknown> };
            actionExecuted = revive.success;
            break;
          }
          case 'fiddle': {
            if (decision.markerId && decision.objectiveAction) {
              if (decision.objectiveAction === 'acquire_marker') {
                const acquire = gameManager.executeAcquireObjectiveMarker(character, decision.markerId, sideName, {
                  spendAp: true,
                  opposingInBaseContact: this.hasOpposingInBaseContact(character, enemies, battlefield),
                  isAttentive: character.state.isAttentive,
                  isOrdered: character.state.isOrdered,
                  isAnimal: false,
                  keyIdsInHand: this.getMarkerKeyIdsInHand(character, gameManager),
                });
                actionExecuted = Boolean((acquire as { success?: boolean }).success);
                result = actionExecuted ? 'fiddle=true:acquire_marker' : `fiddle=false:${(acquire as { reason?: string }).reason ?? 'acquire_failed'}`;
                stepDetails = {
                  objectiveAction: decision.objectiveAction,
                  markerId: decision.markerId,
                  objectiveMarkerResult: this.sanitizeForAudit(acquire) as Record<string, unknown>,
                };
                break;
              }
              if (decision.objectiveAction === 'share_marker') {
                if (!decision.markerTargetModelId) {
                  result = 'fiddle=false:no-share-target';
                  break;
                }
                const share = gameManager.executeShareIdeaObjectiveMarker(
                  character,
                  decision.markerId,
                  decision.markerTargetModelId,
                  sideName,
                  { spendAp: true }
                );
                actionExecuted = Boolean((share as { success?: boolean }).success);
                result = actionExecuted ? 'fiddle=true:share_marker' : `fiddle=false:${(share as { reason?: string }).reason ?? 'share_failed'}`;
                stepDetails = {
                  objectiveAction: decision.objectiveAction,
                  markerId: decision.markerId,
                  markerTargetModelId: decision.markerTargetModelId,
                  objectiveMarkerResult: this.sanitizeForAudit(share) as Record<string, unknown>,
                };
                break;
              }
              if (decision.objectiveAction === 'transfer_marker') {
                if (!decision.markerTargetModelId) {
                  result = 'fiddle=false:no-transfer-target';
                  break;
                }
                const transfer = gameManager.executeTransferObjectiveMarker(
                  character,
                  decision.markerId,
                  decision.markerTargetModelId,
                  sideName,
                  { spendAp: true }
                );
                actionExecuted = Boolean((transfer as { success?: boolean }).success);
                result = actionExecuted ? 'fiddle=true:transfer_marker' : `fiddle=false:${(transfer as { reason?: string }).reason ?? 'transfer_failed'}`;
                stepDetails = {
                  objectiveAction: decision.objectiveAction,
                  markerId: decision.markerId,
                  markerTargetModelId: decision.markerTargetModelId,
                  objectiveMarkerResult: this.sanitizeForAudit(transfer) as Record<string, unknown>,
                };
                break;
              }
              if (decision.objectiveAction === 'destroy_marker') {
                const destroy = gameManager.executeDestroyObjectiveMarker(character, decision.markerId, { spendAp: true });
                actionExecuted = Boolean((destroy as { success?: boolean }).success);
                result = actionExecuted ? 'fiddle=true:destroy_marker' : `fiddle=false:${(destroy as { reason?: string }).reason ?? 'destroy_failed'}`;
                stepDetails = {
                  objectiveAction: decision.objectiveAction,
                  markerId: decision.markerId,
                  objectiveMarkerResult: this.sanitizeForAudit(destroy) as Record<string, unknown>,
                };
                break;
              }
            }

            const fiddle = gameManager.executeFiddle(character, {
              spendAp: true,
              attribute: 'int',
              difficulty: 2,
            });
            actionExecuted = fiddle.success;
            result = fiddle.success ? 'fiddle=true' : 'fiddle=false';
            stepDetails = {
              objectiveAction: decision.objectiveAction,
              markerId: decision.markerId,
              fiddleResult: this.sanitizeForAudit(fiddle) as Record<string, unknown>,
            };
            break;
          }
          default:
            result = `${decision.type}=false:unsupported`;
            break;
        }

        this.log.push({
          turn,
          round: 1,
          modelId: character.id,
          side: sideName,
          model: character.profile.name,
          action: decision.type,
          detail: decision.reason,
          result,
        });

        const endPos = battlefield.getCharacterPosition(character);
        if (actionExecuted) {
          this.stats.totalActions++;
          const movedDistance = startPos && endPos ? Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y) : 0;
          this.trackPathMovement(character, movedDistance);
          if (startPos && endPos && movedDistance > 0) {
            stepVectors.push(this.createMovementVector(startPos, endPos, 0.5));
          }
          if (movedDistance > 0) {
            const movePassive = this.inspectMovePassiveOptions(
              gameManager,
              battlefield,
              character,
              enemies,
              config.visibilityOrMu,
              1
            );
            this.executeCounterChargeFromMove(
              gameManager,
              character,
              movePassive.moveConcluded,
              enemies,
              battlefield,
              config.visibilityOrMu
            );
          }
          const trigger = movedDistance > 0 ? 'Move' : 'NonMove';
          const actorStateBeforeReact = this.snapshotModelState(character);
          const reactResult = this.processReacts(character, enemies, gameManager, trigger, movedDistance, config.visibilityOrMu);
          const actorStateAfterReact = this.snapshotModelState(character);
          if (reactResult.executed && reactResult.reactor) {
            this.syncMissionRuntimeForAttack(
              reactResult.reactor,
              character,
              actorStateBeforeReact,
              actorStateAfterReact,
              this.extractDamageResolutionFromUnknown(reactResult.rawResult)
            );
          }
          if (reactResult.executed) {
            this.stats.reacts++;
            this.trackPassiveUsage('React');
            if (reactResult.reactor) {
              this.trackAttempt(reactResult.reactor, 'react');
              this.trackSuccess(reactResult.reactor, 'react');
            }
            stepInteractions.push({
              kind: 'react',
              sourceModelId: reactResult.reactor?.id ?? '',
              targetModelId: character.id,
              success: true,
              detail: reactResult.resultCode,
            });
            if (reactResult.vector) {
              stepVectors.push(reactResult.vector);
            }
            if (reactResult.opposedTest) {
              stepOpposedTest = reactResult.opposedTest;
            }
            if (reactResult.details) {
              stepDetails = {
                ...(stepDetails ?? {}),
                react: reactResult.details,
              };
            }
          }
        }

        const actorStateAfter = this.snapshotModelState(character);
        const actorEffect = this.createModelEffect(character, 'self', actorStateBefore, actorStateAfter);
        if (actorEffect) {
          stepAffectedModels.push(actorEffect);
        }
        if (decision.target && targetStateBefore) {
          const targetStateAfter = this.snapshotModelState(decision.target);
          const targetEffect = this.createModelEffect(decision.target, 'target', targetStateBefore, targetStateAfter);
          if (targetEffect) {
            stepAffectedModels.push(targetEffect);
          }
          if (actionExecuted && this.isAttackDecisionType(decision.type)) {
            const damageResolution = this.extractDamageResolutionFromStepDetails(stepDetails);
            this.syncMissionRuntimeForAttack(
              character,
              decision.target,
              targetStateBefore,
              targetStateAfter,
              damageResolution
            );
          }
        }

        const apAfter = gameManager.getApRemaining(character);
        lastKnownAp = apAfter;
        if (stepOpposedTest) {
          stepInteractions.push({
            kind: 'opposed_test',
            sourceModelId: character.id,
            targetModelId: decision.target?.id,
            success: stepOpposedTest.pass,
            detail: `score=${stepOpposedTest.score ?? 'n/a'}`,
          });
        }
        activationAudit.steps.push({
          sequence: activationAudit.steps.length + 1,
          actionType: decision.type,
          decisionReason: decision.reason,
          resultCode: result,
          success: actionExecuted,
          apBefore,
          apAfter,
          apSpent: Math.max(0, apBefore - apAfter),
          actorPositionBefore: startPos,
          actorPositionAfter: endPos,
          actorStateBefore,
          actorStateAfter,
          vectors: stepVectors,
          targets: stepTargets,
          affectedModels: stepAffectedModels,
          interactions: stepInteractions,
          opposedTest: stepOpposedTest,
          rangeCheck: stepRangeCheck,
          details: stepDetails,
        });

        if (apAfter >= apBefore) {
          const fallback = this.computeFallbackMovePosition(character, enemies, battlefield, config);
          if (fallback && gameManager.spendAp(character, 1)) {
            const fallbackStart = battlefield.getCharacterPosition(character);
            const fallbackStateBefore = this.snapshotModelState(character);
            const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
            const opportunityWeapon = equipment.find(i => i?.classification === 'Melee' || i?.class === 'Melee') || equipment[0];
            const moved = gameManager.executeMove(character, fallback, {
              opponents: enemies,
              allowOpportunityAttack: true,
              opportunityWeapon: opportunityWeapon ?? undefined,
            });
            if (moved.moved) {
              const opportunity = (moved as any)?.opportunityAttack;
              if (opportunity?.attacker) {
                this.trackPassiveUsage('OpportunityAttack');
                this.trackCombatExtras(opportunity.result);
                this.syncMissionRuntimeForAttack(
                  opportunity.attacker,
                  character,
                  fallbackStateBefore,
                  this.snapshotModelState(character),
                  this.extractDamageResolutionFromUnknown(opportunity.result)
                );
              }
              const fallbackEnd = battlefield.getCharacterPosition(character);
              const movedDistance = fallbackStart && fallbackEnd
                ? Math.hypot(fallbackEnd.x - fallbackStart.x, fallbackEnd.y - fallbackStart.y)
                : 0;
              this.stats.moves++;
              this.stats.totalActions++;
              this.trackPathMovement(character, movedDistance);
              if (movedDistance > 0) {
                const movePassive = this.inspectMovePassiveOptions(
                  gameManager,
                  battlefield,
                  character,
                  enemies,
                  config.visibilityOrMu,
                  1
                );
                this.executeCounterChargeFromMove(
                  gameManager,
                  character,
                  movePassive.moveConcluded,
                  enemies,
                  battlefield,
                  config.visibilityOrMu
                );
              }
              this.log.push({
                turn,
                round: 1,
                modelId: character.id,
                side: sideName,
                model: character.profile.name,
                action: 'move',
                detail: 'Fallback advance after stalled decision',
                result: 'move=true:forced',
              });
              const fallbackStateBeforeReact = this.snapshotModelState(character);
              const reactResult = this.processReacts(
                character,
                enemies,
                gameManager,
                movedDistance > 0 ? 'Move' : 'NonMove',
                movedDistance,
                config.visibilityOrMu
              );
              if (reactResult.executed && reactResult.reactor) {
                this.syncMissionRuntimeForAttack(
                  reactResult.reactor,
                  character,
                  fallbackStateBeforeReact,
                  this.snapshotModelState(character),
                  this.extractDamageResolutionFromUnknown(reactResult.rawResult)
                );
              }
              if (reactResult.executed) {
                this.stats.reacts++;
                this.trackPassiveUsage('React');
                if (reactResult.reactor) {
                  this.trackAttempt(reactResult.reactor, 'react');
                  this.trackSuccess(reactResult.reactor, 'react');
                }
              }
              const fallbackStateAfter = this.snapshotModelState(character);
              const fallbackApAfter = gameManager.getApRemaining(character);
              lastKnownAp = fallbackApAfter;
              const fallbackVectors: AuditVector[] = [];
              if (fallbackStart && fallbackEnd && movedDistance > 0) {
                fallbackVectors.push(this.createMovementVector(fallbackStart, fallbackEnd, 0.5));
              }
              if (reactResult.vector) {
                fallbackVectors.push(reactResult.vector);
              }
              const fallbackEffects: ModelEffectAudit[] = [];
              const fallbackSelfEffect = this.createModelEffect(character, 'self', fallbackStateBefore, fallbackStateAfter);
              if (fallbackSelfEffect) {
                fallbackEffects.push(fallbackSelfEffect);
              }
              activationAudit.steps.push({
                sequence: activationAudit.steps.length + 1,
                actionType: 'move',
                decisionReason: 'Fallback advance after stalled decision',
                resultCode: 'move=true:forced',
                success: true,
                apBefore: apAfter,
                apAfter: fallbackApAfter,
                apSpent: Math.max(0, apAfter - fallbackApAfter),
                actorPositionBefore: fallbackStart,
                actorPositionAfter: fallbackEnd,
                actorStateBefore: fallbackStateBefore,
                actorStateAfter: fallbackStateAfter,
                vectors: fallbackVectors,
                targets: [],
                affectedModels: fallbackEffects,
                interactions: reactResult.executed ? [{
                  kind: 'react',
                  sourceModelId: reactResult.reactor?.id ?? '',
                  targetModelId: character.id,
                  success: true,
                  detail: reactResult.resultCode,
                }] : [],
                opposedTest: reactResult.opposedTest,
                details: {
                  moveResult: this.sanitizeForAudit(moved) as Record<string, unknown>,
                  react: reactResult.details,
                },
              });
              continue;
            }
          }
          break;
        }
      }
    } catch (error) {
      if (config.verbose) {
        console.error(`    Error: ${error}`);
      }
    }

    if (activationAudit.steps.length === 0 && !activationAudit.skippedReason) {
      activationAudit.skippedReason = 'no_executed_steps';
    }
    activationAudit.apEnd = lastKnownAp;
    gameManager.endActivation(character);
    return activationAudit;
  }

  private areEngaged(attacker: Character, defender: Character, battlefield: Battlefield): boolean {
    const attackerPos = battlefield.getCharacterPosition(attacker);
    const defenderPos = battlefield.getCharacterPosition(defender);
    if (!attackerPos || !defenderPos) return false;
    const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3;
    const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 3;
    return SpatialRules.isEngaged(
      {
        id: attacker.id,
        position: attackerPos,
        baseDiameter: getBaseDiameterFromSiz(attackerSiz),
        siz: attackerSiz,
      },
      {
        id: defender.id,
        position: defenderPos,
        baseDiameter: getBaseDiameterFromSiz(defenderSiz),
        siz: defenderSiz,
      }
    );
  }

  private isFreeFromEngagementInTurn(
    character: Character,
    enemies: Character[],
    battlefield: Battlefield
  ): boolean {
    return !enemies.some(enemy => this.areEngaged(character, enemy, battlefield));
  }

  private computeEngageMovePosition(
    attacker: Character,
    defender: Character,
    battlefield: Battlefield
  ): Position | null {
    const attackerPos = battlefield.getCharacterPosition(attacker);
    const defenderPos = battlefield.getCharacterPosition(defender);
    if (!attackerPos || !defenderPos) return null;

    const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3;
    const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 3;
    const requiredDistance = (getBaseDiameterFromSiz(attackerSiz) + getBaseDiameterFromSiz(defenderSiz)) / 2;
    const dx = defenderPos.x - attackerPos.x;
    const dy = defenderPos.y - attackerPos.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= requiredDistance || distance === 0) return null;

    const mov = (attacker.finalAttributes.mov ?? attacker.attributes.mov ?? 2) + 2;
    const step = Math.min(mov, distance - requiredDistance);
    if (step <= 0) return null;

    const ratio = step / distance;
    return {
      x: Math.max(0, Math.min(battlefield.width - 1, Math.round(attackerPos.x + dx * ratio))),
      y: Math.max(0, Math.min(battlefield.height - 1, Math.round(attackerPos.y + dy * ratio))),
    };
  }

  private processReacts(
    active: Character,
    opponents: Character[],
    gameManager: GameManager,
    trigger: 'Move' | 'NonMove',
    movedDistance: number,
    visibilityOrMu: number
  ): ReactAuditResult {
    const options = gameManager.getReactOptionsSorted({
      battlefield: gameManager.battlefield!,
      active,
      opponents,
      trigger,
      movedDistance,
      visibilityOrMu,
    });
    const first = options.find(option => option.available && option.type === 'StandardReact');
    if (!first) {
      return { executed: false };
    }

    const equipment = (first.actor.profile.equipment || first.actor.profile.items || []).filter(Boolean);
    const weapon = equipment.find(i =>
      i?.classification === 'Bow' ||
      i?.classification === 'Thrown' ||
      i?.classification === 'Range' ||
      i?.classification === 'Firearm' ||
      i?.classification === 'Support'
    ) || equipment[0];
    if (!weapon) {
      return { executed: false };
    }

    const reactorPos = gameManager.battlefield?.getCharacterPosition(first.actor);
    const activePos = gameManager.battlefield?.getCharacterPosition(active);
    const react = gameManager.executeStandardReact(first.actor, active, weapon, { visibilityOrMu });
    if (!react.executed) {
      return {
        executed: false,
        details: {
          actorId: first.actor.id,
          targetId: active.id,
          reason: 'standard-react-not-executed',
          reactResult: this.sanitizeForAudit(react) as Record<string, unknown>,
        },
      };
    }
    this.trackCombatExtras((react as any).result);
    return {
      executed: true,
      reactor: first.actor,
      resultCode: 'react=true:standard',
      rawResult: (react as any).result ?? react,
      vector: reactorPos && activePos ? {
        kind: 'los',
        from: reactorPos,
        to: activePos,
        distanceMu: Math.hypot(activePos.x - reactorPos.x, activePos.y - reactorPos.y),
      } : undefined,
      opposedTest: this.toOpposedTestAudit((react as any).result),
      details: {
        actorId: first.actor.id,
        actorName: first.actor.profile.name,
        targetId: active.id,
        targetName: active.profile.name,
        weaponName: (weapon as any).name ?? (weapon as any).id ?? 'weapon',
        reactResult: this.sanitizeForAudit(react) as Record<string, unknown>,
      },
    };
  }

  private computeFallbackMovePosition(
    actor: Character,
    enemies: Character[],
    battlefield: Battlefield,
    config: GameConfig
  ): Position | null {
    const actorPos = battlefield.getCharacterPosition(actor);
    if (!actorPos || enemies.length === 0) {
      return null;
    }

    const candidateEnemies = config.perCharacterFovLos
      ? enemies.filter(enemy => this.hasLos(actor, enemy, battlefield))
      : enemies;

    if (candidateEnemies.length === 0) {
      return null;
    }

    let nearestEnemy: Character | null = null;
    let nearestDistance = Infinity;
    for (const enemy of candidateEnemies) {
      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const distance = Math.hypot(enemyPos.x - actorPos.x, enemyPos.y - actorPos.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    }

    if (!nearestEnemy || nearestDistance <= 1) {
      return null;
    }

    const enemyPos = battlefield.getCharacterPosition(nearestEnemy);
    if (!enemyPos) {
      return null;
    }

    const mov = actor.finalAttributes.mov ?? actor.attributes.mov ?? 2;
    const moveAllowance = Math.max(1, mov + 2);
    const engine = new PathfindingEngine(battlefield);
    const path = engine.findPathWithMaxMu(
      actorPos,
      enemyPos,
      {
        movementMetric: 'length',
        useNavMesh: true,
        useHierarchical: true,
        optimizeWithLOS: true,
        footprintDiameter: getBaseDiameterFromSiz(actor.finalAttributes.siz ?? actor.attributes.siz ?? 3),
      },
      moveAllowance
    );

    const desired = path.points[path.points.length - 1] ?? this.computeDirectAdvanceStep(actorPos, enemyPos, moveAllowance);
    if (!desired) {
      return null;
    }

    return this.snapToOpenCell(desired, actor, battlefield) ??
      this.snapToOpenCell(actorPos, actor, battlefield);
  }

  private computeDirectAdvanceStep(
    actorPos: Position,
    enemyPos: Position,
    moveAllowance: number
  ): Position | null {
    const dx = enemyPos.x - actorPos.x;
    const dy = enemyPos.y - actorPos.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0 || moveAllowance <= 0) {
      return null;
    }

    const step = Math.min(moveAllowance, distance);
    const ratio = step / distance;
    return {
      x: actorPos.x + dx * ratio,
      y: actorPos.y + dy * ratio,
    };
  }

  private hasLos(observer: Character, target: Character, battlefield: Battlefield): boolean {
    const observerPos = battlefield.getCharacterPosition(observer);
    const targetPos = battlefield.getCharacterPosition(target);
    if (!observerPos || !targetPos) return false;

    return SpatialRules.hasLineOfSight(
      battlefield,
      {
        id: observer.id,
        position: observerPos,
        baseDiameter: getBaseDiameterFromSiz(observer.finalAttributes.siz ?? observer.attributes.siz ?? 3),
        siz: observer.finalAttributes.siz ?? observer.attributes.siz ?? 3,
      },
      {
        id: target.id,
        position: targetPos,
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? target.attributes.siz ?? 3,
      }
    );
  }

  private snapToOpenCell(position: Position, actor: Character, battlefield: Battlefield): Position | null {
    const actorPos = battlefield.getCharacterPosition(actor);
    if (!actorPos) return null;

    const cx = Math.max(0, Math.min(battlefield.width - 1, Math.round(position.x)));
    const cy = Math.max(0, Math.min(battlefield.height - 1, Math.round(position.y)));

    for (let radius = 0; radius <= 4; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const x = Math.max(0, Math.min(battlefield.width - 1, cx + dx));
          const y = Math.max(0, Math.min(battlefield.height - 1, cy + dy));
          if (x === actorPos.x && y === actorPos.y) continue;
          const occupant = battlefield.getCharacterAt({ x, y });
          if (!occupant || occupant.id === actor.id) {
            return { x, y };
          }
        }
      }
    }

    return null;
  }

  private pickMeleeWeapon(character: Character) {
    const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
    return equipment.find(i => i?.classification === 'Melee') ||
      equipment.find(i => i?.class === 'Melee') ||
      equipment[0] ||
      null;
  }

  private pickRangedWeapon(character: Character) {
    const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
    return equipment.find(i =>
      i?.classification === 'Bow' ||
      i?.classification === 'Thrown' ||
      i?.classification === 'Range' ||
      i?.classification === 'Firearm' ||
      i?.classification === 'Support' ||
      ((i?.classification === 'Melee' || i?.classification === 'Natural' || i?.class === 'Melee' || i?.class === 'Natural') &&
        Array.isArray(i?.traits) &&
        i.traits.some(t => t.toLowerCase().includes('throwable')))
    ) || null;
  }

  private normalizeAttackResult(result: any): {
    hit?: boolean;
    ko: boolean;
    eliminated: boolean;
  } {
    const hit = result?.result?.hit ?? result?.hit;
    const damageResolution = result?.result?.damageResolution ?? result?.damageResolution;
    const ko = Boolean(damageResolution?.defenderState?.isKOd ?? damageResolution?.defenderKOd);
    const eliminated = Boolean(damageResolution?.defenderState?.isEliminated ?? damageResolution?.defenderEliminated);
    return { hit, ko, eliminated };
  }

  private async executeCloseCombat(
    attacker: Character,
    defender: Character,
    battlefield: Battlefield,
    gameManager: GameManager,
    config: GameConfig,
    turn: number,
    sideIndex: number,
    isCharge: boolean
  ): Promise<{
    executed: boolean;
    resultCode: string;
    opposedTest?: OpposedTestAudit;
    details?: Record<string, unknown>;
  }> {
    const weapon = this.pickMeleeWeapon(attacker);

    if (!weapon) {
      if (config.verbose) console.log(`    → No weapon available`);
      return { executed: false, resultCode: 'close_combat=false:no-weapon' };
    }

    try {
      const attackerDoctrine = config.sides[sideIndex]?.tacticalDoctrine ?? this.getDoctrineForCharacter(attacker);
      const defenderDoctrine = this.getDoctrineForCharacter(defender);
      const declaredOptions = this.inspectPassiveOptions(gameManager, {
        kind: 'CloseCombatAttackDeclared',
        attacker,
        defender,
        battlefield,
        weapon: weapon as any,
      });
      const defendAvailable = declaredOptions.some(option => option.type === 'Defend' && option.available);
      const useDefend = defendAvailable && this.shouldUseDefendDeclared(defenderDoctrine, 'melee', defender);
      if (useDefend) {
        this.trackPassiveUsage('Defend');
      }
      const result = gameManager.executeCloseCombatAttack(attacker, defender, weapon, {
        isCharge,
        isDefending: false,
        defend: useDefend,
      });
      const hitTestResult = (result as any)?.hitTestResult ?? (result as any)?.result?.hitTestResult;
      if (hitTestResult && hitTestResult.pass === false) {
        const attackerStateBeforePassive = this.snapshotModelState(attacker);
        const failedOptions = this.inspectPassiveOptions(gameManager, {
          kind: 'HitTestFailed',
          attacker,
          defender,
          battlefield,
          attackType: 'melee',
          hitTestResult,
          visibilityOrMu: config.visibilityOrMu,
        });
        const passiveResponse = this.executeFailedHitPassiveResponse({
          gameManager,
          attacker,
          defender,
          hitTestResult,
          attackType: 'melee',
          options: failedOptions,
          doctrine: defenderDoctrine,
          visibilityOrMu: config.visibilityOrMu,
        });
        if (passiveResponse.result) {
          (result as any).passiveResponse = this.sanitizeForAudit(passiveResponse.result) as Record<string, unknown>;
          const attackerStateAfterPassive = this.snapshotModelState(attacker);
          this.syncMissionRuntimeForAttack(
            defender,
            attacker,
            attackerStateBeforePassive,
            attackerStateAfterPassive,
            this.extractDamageResolutionFromUnknown(passiveResponse.result)
          );
        }
      }
      this.applyAutoBonusActionIfPossible({
        result,
        attacker,
        target: defender,
        battlefield,
        opponents: [defender],
        isCloseCombat: true,
        doctrine: attackerDoctrine,
        isCharge,
      });
      this.trackCombatExtras(result);
      const normalized = this.normalizeAttackResult(result);

      if (config.verbose) {
        const koStatus = normalized.ko ? 'KO' : 'OK';
        const elimStatus = normalized.eliminated ? 'Elim' : 'Active';
        console.log(`    → Hit: ${normalized.hit}, KO: ${koStatus}, Elim: ${elimStatus}`);
      }

      if (normalized.ko) {
        this.stats.kos++;
      }
      if (normalized.eliminated) {
        this.stats.eliminations++;
      }
      return {
        executed: true,
        resultCode: 'close_combat=true',
        opposedTest: this.toOpposedTestAudit(result),
        details: {
          weaponName: (weapon as any).name ?? (weapon as any).id ?? 'weapon',
          normalized,
          attackResult: this.sanitizeForAudit(result) as Record<string, unknown>,
          isCharge,
        },
      };
    } catch (error) {
      if (config.verbose) {
        console.error(`    Combat error: ${error}`);
      }
      return { executed: false, resultCode: 'close_combat=false:error' };
    }
  }

  private async executeRangedCombat(
    attacker: Character,
    defender: Character,
    battlefield: Battlefield,
    gameManager: GameManager,
    config: GameConfig,
    turn: number,
    sideIndex: number
  ): Promise<{
    executed: boolean;
    result: string;
    opposedTest?: OpposedTestAudit;
    rangeCheck?: ActionStepAudit['rangeCheck'];
    vectors: AuditVector[];
    details?: Record<string, unknown>;
  }> {
    const vectors: AuditVector[] = [];
    const weapon = this.pickRangedWeapon(attacker);
    if (!weapon) {
      if (config.verbose) console.log(`    → No ranged weapon available`);
      return { executed: false, result: 'ranged=false:no-weapon', vectors };
    }

    try {
      const attackerDoctrine = config.sides[sideIndex]?.tacticalDoctrine ?? this.getDoctrineForCharacter(attacker);
      const defenderDoctrine = this.getDoctrineForCharacter(defender);
      const attackerPos = battlefield.getCharacterPosition(attacker);
      const defenderPos = battlefield.getCharacterPosition(defender);
      if (!attackerPos || !defenderPos) {
        if (config.verbose) console.log(`    → Invalid positions`);
        return { executed: false, result: 'ranged=false:invalid-position', vectors };
      }

      if (config.perCharacterFovLos && !this.hasLos(attacker, defender, battlefield)) {
        return { executed: false, result: 'ranged=false:no-los', vectors };
      }

      const distance = Math.hypot(attackerPos.x - defenderPos.x, attackerPos.y - defenderPos.y);
      const weaponOrMu = parseWeaponOptimalRangeMu(attacker, weapon as any);
      const rangeCheck = evaluateRangeWithVisibility(distance, weaponOrMu, {
        visibilityOrMu: config.visibilityOrMu,
        maxOrm: config.maxOrm,
        allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
      });
      if (!rangeCheck.inRange) {
        return { executed: false, result: 'ranged=false:out-of-range', vectors };
      }

      const declaredOptions = this.inspectPassiveOptions(gameManager, {
        kind: 'RangedAttackDeclared',
        attacker,
        defender,
        battlefield,
        weapon: weapon as any,
      });
      const defendAvailable = declaredOptions.some(option => option.type === 'Defend' && option.available);
      const canTakeCover = declaredOptions.some(option => option.type === 'TakeCover' && option.available);
      const useDefend = defendAvailable && this.shouldUseDefendDeclared(defenderDoctrine, 'ranged', defender);
      const useTakeCover = canTakeCover && this.shouldUseTakeCoverDeclared(defenderDoctrine, defender);
      const takeCoverPosition = canTakeCover
        ? (useTakeCover ? this.findTakeCoverPosition(defender, attacker, battlefield) : undefined)
        : undefined;
      if (useDefend) {
        this.trackPassiveUsage('Defend');
      }
      if (takeCoverPosition) {
        this.trackPassiveUsage('TakeCover');
      }

      let orm = rangeCheck.orm;
      let context = undefined as ReturnType<GameManager['buildConcentrateContext']> | undefined;
      let usedConcentrate = false;
      if (rangeCheck.requiresConcentrate) {
        if (!gameManager.spendAp(attacker, 1)) {
          return { executed: false, result: 'ranged=false:not-enough-ap-concentrate', vectors };
        }
        orm = rangeCheck.concentratedOrm;
        context = gameManager.buildConcentrateContext('hit');
        usedConcentrate = true;
      }
      const useLean = this.shouldUseLeanForRanged(attacker, defender, battlefield);
      if (useLean) {
        context = { ...(context ?? {}), isLeaning: true };
      }

      const attackCost = gameManager.getAttackApCost(attacker, weapon as any);
      if (!gameManager.spendAp(attacker, attackCost)) {
        return { executed: false, result: `ranged=false:not-enough-ap(${attackCost})`, vectors };
      }

      this.stats.losChecks++;
      battlefield.hasLineOfSight(attackerPos, defenderPos);
      this.stats.lofChecks++;
      LOFOperations.getModelsAlongLOF(
        attackerPos,
        defenderPos,
        battlefield.getModelBlockers([attacker.id, defender.id]).map(model => ({
          id: model.id,
          position: model.position,
          baseDiameter: model.baseDiameter,
        })),
        { lofWidth: 1 }
      );
      vectors.push({
        kind: 'los',
        from: attackerPos,
        to: defenderPos,
        distanceMu: distance,
      });
      vectors.push({
        kind: 'lof',
        from: attackerPos,
        to: defenderPos,
        distanceMu: distance,
        widthMu: 1,
      });

      const result = gameManager.executeRangedAttack(attacker, defender, weapon, {
        orm,
        context,
        optimalRangeMu: rangeCheck.requiresConcentrate ? rangeCheck.concentratedOrMu : rangeCheck.effectiveOrMu,
        defend: useDefend,
        allowTakeCover: Boolean(takeCoverPosition),
        takeCoverPosition,
      });
      const hitTestResult = (result as any)?.result?.hitTestResult ?? (result as any)?.hitTestResult;
      if (hitTestResult && hitTestResult.pass === false) {
        const attackerStateBeforePassive = this.snapshotModelState(attacker);
        const failedOptions = this.inspectPassiveOptions(gameManager, {
          kind: 'HitTestFailed',
          attacker,
          defender,
          battlefield,
          attackType: 'ranged',
          hitTestResult,
          visibilityOrMu: config.visibilityOrMu,
        });
        const passiveResponse = this.executeFailedHitPassiveResponse({
          gameManager,
          attacker,
          defender,
          hitTestResult,
          attackType: 'ranged',
          options: failedOptions,
          doctrine: defenderDoctrine,
          visibilityOrMu: config.visibilityOrMu,
        });
        if (passiveResponse.result) {
          (result as any).passiveResponse = this.sanitizeForAudit(passiveResponse.result) as Record<string, unknown>;
          const attackerStateAfterPassive = this.snapshotModelState(attacker);
          this.syncMissionRuntimeForAttack(
            defender,
            attacker,
            attackerStateBeforePassive,
            attackerStateAfterPassive,
            this.extractDamageResolutionFromUnknown(passiveResponse.result)
          );
        }
      }
      this.applyAutoBonusActionIfPossible({
        result,
        attacker,
        target: defender,
        battlefield,
        opponents: [defender],
        isCloseCombat: false,
        doctrine: attackerDoctrine,
      });
      this.trackCombatExtras(result);
      const normalized = this.normalizeAttackResult(result);
      if (config.verbose) {
        console.log(`    → Hit: ${normalized.hit}, KO: ${normalized.ko}, Elim: ${normalized.eliminated}`);
      }

      if (normalized.ko) {
        this.stats.kos++;
      }
      if (normalized.eliminated) {
        this.stats.eliminations++;
      }
      return {
        executed: true,
        result: `ranged=true:orm=${orm}${rangeCheck.requiresConcentrate ? ':concentrate' : ''}`,
        opposedTest: this.toOpposedTestAudit(result),
        rangeCheck: {
          distanceMu: distance,
          weaponOrMu,
          visibilityOrMu: config.visibilityOrMu,
          orm: rangeCheck.orm,
          effectiveOrMu: rangeCheck.effectiveOrMu,
          concentratedOrm: rangeCheck.concentratedOrm,
          concentratedOrMu: rangeCheck.concentratedOrMu,
          requiresConcentrate: rangeCheck.requiresConcentrate,
        },
        vectors,
        details: {
          weaponName: (weapon as any).name ?? (weapon as any).id ?? 'weapon',
          normalized,
          attackResult: this.sanitizeForAudit(result) as Record<string, unknown>,
          ormUsed: orm,
          usedConcentrate,
          usedLean: useLean,
          usedDefend: useDefend,
          takeCoverApplied: Boolean(takeCoverPosition),
        },
      };
    } catch (error) {
      if (config.verbose) {
        console.error(`    Ranged combat error: ${error}`);
      }
      return { executed: false, result: 'ranged=false:error', vectors };
    }
  }

  private async executeDisengage(
    disengager: Character,
    defender: Character,
    battlefield: Battlefield,
    gameManager: GameManager,
    config: GameConfig,
    turn: number,
    sideIndex: number
  ): Promise<{
    executed: boolean;
    resultCode: string;
    opposedTest?: OpposedTestAudit;
    details?: Record<string, unknown>;
  }> {
    try {
      // Get defender's melee weapon from equipment or items
      const weapon = this.pickMeleeWeapon(defender);
      
      if (!weapon) {
        if (config.verbose) console.log(`    → No weapon for disengage`);
        return { executed: false, resultCode: 'disengage=false:no-weapon' };
      }

      const result = gameManager.executeDisengage(disengager, defender, weapon);
      const disengagerDoctrine = config.sides[sideIndex]?.tacticalDoctrine ?? this.getDoctrineForCharacter(disengager);
      this.applyAutoBonusActionIfPossible({
        result,
        attacker: disengager,
        target: defender,
        battlefield,
        opponents: [defender],
        isCloseCombat: true,
        doctrine: disengagerDoctrine,
      });
      this.trackCombatExtras(result);

      if (config.verbose) {
        const moved = result.pass && 'moved' in result && result.moved ? ', moved' : '';
        console.log(`    → Disengage: ${result.pass ? `Success${moved}` : 'Failed'}`);
      }
      return {
        executed: result.pass,
        resultCode: result.pass ? 'disengage=true' : 'disengage=false',
        opposedTest: this.toOpposedTestAudit(result),
        details: {
          defenderWeaponName: (weapon as any).name ?? (weapon as any).id ?? 'weapon',
          disengageResult: this.sanitizeForAudit(result) as Record<string, unknown>,
        },
      };
    } catch (error) {
      if (config.verbose) {
        console.error(`    Disengage error: ${error}`);
      }
      return { executed: false, resultCode: 'disengage=false:error' };
    }
  }

  private displayReport(report: BattleReport) {
    console.log(`\n${formatBattleReportHumanReadable(report)}\n`);
  }
}

// ============================================================================
// CLI Entry Points
// ============================================================================

async function runInteractive() {
  const setup = new AIBattleSetup();
  const runner = new AIBattleRunner();

  try {
    const config = await setup.runInteractiveSetup();
    setup.close();

    const report = await runner.runBattle(config);
    const reportPath = writeSingleBattleReport(report);
    console.log(`📁 JSON Report: ${reportPath}`);

    console.log('✅ Battle completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Battle failed with error:');
    console.error(error);
    setup.close();
    process.exit(1);
  }
}

async function runQuickBattle(
  gameSize: GameSize = GameSize.VERY_LARGE,
  missionId: string = 'QAI_11',
  densityRatio: number = 50,
  lighting: LightingCondition = 'Day, Clear'
) {
  const visibilityOrMu = getVisibilityOrForLighting(lighting);
  const resolvedMissionId = parseMissionIdArg(missionId, 'QAI_11');
  const config: GameConfig = {
    missionId: resolvedMissionId,
    missionName: MISSION_NAME_BY_ID[resolvedMissionId] ?? resolvedMissionId,
    gameSize,
    battlefieldSize: GAME_SIZE_CONFIG[gameSize].battlefieldSize,
    maxTurns: GAME_SIZE_CONFIG[gameSize].maxTurns,
    endGameTurn: GAME_SIZE_CONFIG[gameSize].endGameTurn,
    sides: [
      {
        name: 'Alpha',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Alpha Assembly',
        aggression: 0.5,
        caution: 0.5,
      },
      {
        name: 'Bravo',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Bravo Assembly',
        aggression: 0.5,
        caution: 0.5,
      },
    ],
    densityRatio,
    lighting,
    visibilityOrMu,
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    verbose: true,
  };

  const runner = new AIBattleRunner();

  try {
    const report = await runner.runBattle(config);
    const reportPath = writeSingleBattleReport(report);
    console.log(`📁 JSON Report: ${reportPath}`);
    console.log('✅ Battle completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Battle failed with error:');
    console.error(error);
    process.exit(1);
  }
}

function accumulateStats(total: BattleStats, add: BattleStats) {
  (Object.keys(total) as Array<keyof BattleStats>).forEach((key) => {
    total[key] += add[key];
  });
}

function divideStats(total: BattleStats, runs: number): BattleStats {
  const avg = createEmptyStats();
  (Object.keys(total) as Array<keyof BattleStats>).forEach((key) => {
    avg[key] = Number((total[key] / runs).toFixed(2));
  });
  return avg;
}

function mergeTypeBreakdown(total: RuleTypeBreakdown, add: RuleTypeBreakdown) {
  for (const [type, count] of Object.entries(add)) {
    total[type] = (total[type] ?? 0) + count;
  }
}

function divideTypeBreakdown(total: RuleTypeBreakdown, runs: number): RuleTypeBreakdown {
  const avg: RuleTypeBreakdown = {};
  for (const [type, count] of Object.entries(total)) {
    avg[type] = Number((count / runs).toFixed(2));
  }
  return avg;
}

function accumulateAdvancedRuleMetrics(total: AdvancedRuleMetrics, add: AdvancedRuleMetrics) {
  total.bonusActions.opportunities += add.bonusActions.opportunities;
  total.bonusActions.optionsOffered += add.bonusActions.optionsOffered;
  total.bonusActions.optionsAvailable += add.bonusActions.optionsAvailable;
  total.bonusActions.executed += add.bonusActions.executed;
  mergeTypeBreakdown(total.bonusActions.offeredByType, add.bonusActions.offeredByType);
  mergeTypeBreakdown(total.bonusActions.availableByType, add.bonusActions.availableByType);
  mergeTypeBreakdown(total.bonusActions.executedByType, add.bonusActions.executedByType);

  total.passiveOptions.opportunities += add.passiveOptions.opportunities;
  total.passiveOptions.optionsOffered += add.passiveOptions.optionsOffered;
  total.passiveOptions.optionsAvailable += add.passiveOptions.optionsAvailable;
  total.passiveOptions.used += add.passiveOptions.used;
  mergeTypeBreakdown(total.passiveOptions.offeredByType, add.passiveOptions.offeredByType);
  mergeTypeBreakdown(total.passiveOptions.availableByType, add.passiveOptions.availableByType);
  mergeTypeBreakdown(total.passiveOptions.usedByType, add.passiveOptions.usedByType);

  total.situationalModifiers.testsObserved += add.situationalModifiers.testsObserved;
  total.situationalModifiers.modifiedTests += add.situationalModifiers.modifiedTests;
  total.situationalModifiers.modifiersApplied += add.situationalModifiers.modifiersApplied;
  mergeTypeBreakdown(total.situationalModifiers.byType, add.situationalModifiers.byType);
}

function divideAdvancedRuleMetrics(total: AdvancedRuleMetrics, runs: number): AdvancedRuleMetrics {
  return {
    bonusActions: {
      opportunities: Number((total.bonusActions.opportunities / runs).toFixed(2)),
      optionsOffered: Number((total.bonusActions.optionsOffered / runs).toFixed(2)),
      optionsAvailable: Number((total.bonusActions.optionsAvailable / runs).toFixed(2)),
      offeredByType: divideTypeBreakdown(total.bonusActions.offeredByType, runs),
      availableByType: divideTypeBreakdown(total.bonusActions.availableByType, runs),
      executed: Number((total.bonusActions.executed / runs).toFixed(2)),
      executedByType: divideTypeBreakdown(total.bonusActions.executedByType, runs),
    },
    passiveOptions: {
      opportunities: Number((total.passiveOptions.opportunities / runs).toFixed(2)),
      optionsOffered: Number((total.passiveOptions.optionsOffered / runs).toFixed(2)),
      optionsAvailable: Number((total.passiveOptions.optionsAvailable / runs).toFixed(2)),
      offeredByType: divideTypeBreakdown(total.passiveOptions.offeredByType, runs),
      availableByType: divideTypeBreakdown(total.passiveOptions.availableByType, runs),
      used: Number((total.passiveOptions.used / runs).toFixed(2)),
      usedByType: divideTypeBreakdown(total.passiveOptions.usedByType, runs),
    },
    situationalModifiers: {
      testsObserved: Number((total.situationalModifiers.testsObserved / runs).toFixed(2)),
      modifiedTests: Number((total.situationalModifiers.modifiedTests / runs).toFixed(2)),
      modifiersApplied: Number((total.situationalModifiers.modifiersApplied / runs).toFixed(2)),
      byType: divideTypeBreakdown(total.situationalModifiers.byType, runs),
    },
  };
}

function emptyCoverage(): ValidationCoverage {
  return {
    movement: false,
    pathfinding: false,
    rangedCombat: false,
    closeCombat: false,
    react: false,
    wait: false,
    detect: false,
    los: false,
    lof: false,
  };
}

function baseCoverageFromStats(stats: BattleStats): ValidationCoverage {
  return {
    movement: stats.moves > 0,
    pathfinding: stats.moves > 0,
    rangedCombat: stats.rangedCombats > 0,
    closeCombat: stats.closeCombats > 0,
    react: stats.reacts > 0,
    wait: stats.waits > 0,
    detect: stats.detects > 0,
    los: stats.losChecks > 0,
    lof: stats.lofChecks > 0,
  };
}

function mergeCoverage(
  coverage: ValidationCoverage,
  patch: Partial<ValidationCoverage>
): ValidationCoverage {
  return {
    movement: coverage.movement || Boolean(patch.movement),
    pathfinding: coverage.pathfinding || Boolean(patch.pathfinding),
    rangedCombat: coverage.rangedCombat || Boolean(patch.rangedCombat),
    closeCombat: coverage.closeCombat || Boolean(patch.closeCombat),
    react: coverage.react || Boolean(patch.react),
    wait: coverage.wait || Boolean(patch.wait),
    detect: coverage.detect || Boolean(patch.detect),
    los: coverage.los || Boolean(patch.los),
    lof: coverage.lof || Boolean(patch.lof),
  };
}

function ensureEquipment(profile: ReturnType<typeof buildProfile>) {
  if (!profile.equipment && profile.items) {
    profile.equipment = profile.items;
  }
  if (Array.isArray(profile.items)) {
    profile.items = profile.items.filter(Boolean);
  }
  if (Array.isArray(profile.equipment)) {
    profile.equipment = profile.equipment.filter(Boolean);
  }
}

function runMechanicProbes(): Partial<ValidationCoverage> {
  try {
    const attackerProfile = buildProfile('Veteran', { itemNames: ['Rifle, Light, Semi/A'] });
    const defenderProfile = buildProfile('Average', { itemNames: ['Sword, Broad'] });
    const reactorProfile = buildProfile('Veteran', { itemNames: ['Rifle, Light, Semi/A'] });
    const activeProfile = buildProfile('Average', { itemNames: ['Sword, Broad'] });
    [attackerProfile, defenderProfile, reactorProfile, activeProfile].forEach(ensureEquipment);

    const assembly = buildAssembly('Probe Assembly', [
      attackerProfile,
      defenderProfile,
      reactorProfile,
      activeProfile,
    ]);
    const [attacker, defender, reactor, active] = assembly.characters;
    if (!attacker || !defender || !reactor || !active) {
      return {};
    }

    const battlefield = new Battlefield(12, 12);
    battlefield.placeCharacter(attacker, { x: 2, y: 2 });
    battlefield.placeCharacter(defender, { x: 8, y: 2 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });
    battlefield.placeCharacter(active, { x: 6, y: 6 });

    const manager = new GameManager([attacker, defender, reactor, active], battlefield);
    const coverage: Partial<ValidationCoverage> = {};

    manager.beginActivation(attacker);
    const moved = manager.executeMove(attacker, { x: 4, y: 2 });
    coverage.movement = moved.moved;
    coverage.pathfinding = moved.moved;
    manager.endActivation(attacker);

    manager.beginActivation(active);
    const waited = manager.executeWait(active, {
      spendAp: true,
      opponents: [attacker, defender, reactor],
      visibilityOrMu: 16,
      allowRevealReposition: false,
    });
    coverage.wait = waited.success;
    manager.endActivation(active);

    defender.state.isHidden = true;
    const detect = manager.attemptDetect(attacker, defender, [defender]);
    coverage.detect = detect.success;

    const attackerPos = battlefield.getCharacterPosition(attacker);
    const defenderPos = battlefield.getCharacterPosition(defender);
    if (attackerPos && defenderPos) {
      coverage.los = battlefield.hasLineOfSight(attackerPos, defenderPos);
      const alongLof = LOFOperations.getModelsAlongLOF(
        attackerPos,
        defenderPos,
        battlefield.getModelBlockers([attacker.id, defender.id]).map(model => ({
          id: model.id,
          position: model.position,
          baseDiameter: model.baseDiameter,
        })),
        { lofWidth: 1 }
      );
      coverage.lof = Array.isArray(alongLof);
    }

    const rangedWeaponPool = (attacker.profile.equipment || attacker.profile.items || []).filter(Boolean);
    const rangedWeapon = rangedWeaponPool.find(i =>
      i?.classification === 'Bow' ||
      i?.classification === 'Thrown' ||
      i?.classification === 'Range' ||
      i?.classification === 'Firearm'
    ) || rangedWeaponPool[0];
    if (rangedWeapon) {
      const ranged = manager.executeRangedAttack(attacker, defender, rangedWeapon, { orm: 4 });
      coverage.rangedCombat = Boolean(ranged.result);
    }

    battlefield.moveCharacter(active, { x: 3, y: 6 });
    reactor.state.isWaiting = true;
    const reactWeapon = (reactor.profile.equipment || reactor.profile.items || [])[0];
    if (reactWeapon) {
      const react = manager.executeStandardReact(reactor, active, reactWeapon);
      coverage.react = react.executed;
    }

    battlefield.moveCharacter(defender, { x: 5, y: 2 });
    const meleeWeapon = (defender.profile.equipment || defender.profile.items || [])[0];
    if (meleeWeapon) {
      const close = manager.executeCloseCombatAttack(attacker, defender, meleeWeapon, {
        isDefending: false,
        isCharge: false,
      });
      coverage.closeCombat = Boolean(close.result);
    }

    return coverage;
  } catch {
    return {};
  }
}

function writeValidationReport(report: ValidationAggregateReport): string {
  const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const missionSlug = String(report.missionId || 'mission')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const outputPath = join(outputDir, `${missionSlug}-validation-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}

function writeSingleBattleReport(report: BattleReport): string {
  const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(outputDir, `battle-report-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}

export function formatBattleReportFromJson(jsonText: string): string {
  return formatBattleReportHumanReadable(JSON.parse(jsonText) as BattleReport);
}

export function formatValidationAggregateReportHumanReadable(report: ValidationAggregateReport): string {
  const advanced = report.advancedRuleTotals ?? createEmptyAdvancedRuleMetrics();
  const lines: string[] = [];
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('📊 VALIDATION REPORT');
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`📋 Mission: ${report.missionId}`);
  lines.push(`📏 Game Size: ${report.gameSize}`);
  lines.push(`🌲 Terrain Density: ${report.densityRatio}%`);
  lines.push(`💡 Lighting: ${report.lighting} (Visibility OR ${report.visibilityOrMu} MU)`);
  lines.push(`⚔️  Doctrine: ${report.tacticalDoctrine}`);
  if (Array.isArray(report.sideDoctrines) && report.sideDoctrines.length > 0) {
    for (const sideDoctrine of report.sideDoctrines) {
      lines.push(`  ${sideDoctrine.sideName}: ${sideDoctrine.tacticalDoctrine}`);
    }
  }
  lines.push(`🧰 Loadout: ${report.loadoutProfile}`);
  lines.push(`🎲 Runs: ${report.runs} (base seed ${report.baseSeed})`);
  lines.push('');
  lines.push('🏆 RESULTS');
  lines.push(`  Winners: ${JSON.stringify(report.winners)}`);
  lines.push(`  Turns Completed: ${report.totals.turnsCompleted}`);
  lines.push(`  Total Actions: ${report.totals.totalActions}`);
  lines.push(`  Moves: ${report.totals.moves}`);
  lines.push(`  Ranged Combats: ${report.totals.rangedCombats}`);
  lines.push(`  Close Combats: ${report.totals.closeCombats}`);
  lines.push(`  Wait Maintained: ${report.totals.waitMaintained}`);
  lines.push(`  Wait Upkeep Paid: ${report.totals.waitUpkeepPaid}`);
  lines.push(`  KO's: ${report.totals.kos}`);
  lines.push(`  Eliminations: ${report.totals.eliminations}`);
  lines.push('');
  lines.push('⚡ BONUS ACTIONS');
  lines.push(`  Opportunities: ${advanced.bonusActions.opportunities}`);
  lines.push(`  Options Offered: ${advanced.bonusActions.optionsOffered}`);
  lines.push(`  Options Available: ${advanced.bonusActions.optionsAvailable}`);
  lines.push(`  Executed: ${advanced.bonusActions.executed}`);
  lines.push('  Available By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.bonusActions.availableByType, '    '));
  lines.push('  Executed By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.bonusActions.executedByType, '    '));
  lines.push('');
  lines.push('🛡️  PASSIVE OPTIONS');
  lines.push(`  Opportunities: ${advanced.passiveOptions.opportunities}`);
  lines.push(`  Options Offered: ${advanced.passiveOptions.optionsOffered}`);
  lines.push(`  Options Available: ${advanced.passiveOptions.optionsAvailable}`);
  lines.push(`  Used: ${advanced.passiveOptions.used}`);
  lines.push('  Available By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.passiveOptions.availableByType, '    '));
  lines.push('  Used By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.passiveOptions.usedByType, '    '));
  lines.push('');
  lines.push('🎯 SITUATIONAL MODIFIERS');
  lines.push(`  Tests Observed: ${advanced.situationalModifiers.testsObserved}`);
  lines.push(`  Modified Tests: ${advanced.situationalModifiers.modifiedTests}`);
  lines.push(`  Modifiers Applied: ${advanced.situationalModifiers.modifiersApplied}`);
  const leanUses = (advanced.situationalModifiers.byType.leaning ?? 0)
    + (advanced.situationalModifiers.byType.detect_lean ?? 0);
  lines.push(`  Lean Uses: ${leanUses}`);
  lines.push('  Breakdown By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.situationalModifiers.byType, '    '));
  if (report.runReports.length > 0) {
    lines.push('');
    lines.push('🧱 NESTED SECTIONS (RUN 1)');
    const nested = report.runReports[0].nestedSections ?? {
      sides: [],
      battlefieldLayout: {
        widthMu: 0,
        heightMu: 0,
        densityRatio: report.densityRatio,
        terrainFeatures: [],
        deployments: [],
      },
    };
    lines.push(`  Side Count: ${nested.sides.length}`);
    for (const side of nested.sides) {
      lines.push(`  Side: ${side.name}`);
      for (const assembly of side.assemblies) {
        lines.push(`    Assembly: ${assembly.name} (${assembly.characters.length} characters)`);
      }
    }
    lines.push('  Battlefield Layout:');
    lines.push(`    Size: ${nested.battlefieldLayout.widthMu}x${nested.battlefieldLayout.heightMu} MU`);
    lines.push(`    Density: ${nested.battlefieldLayout.densityRatio}%`);
    lines.push(`    Terrain Features: ${nested.battlefieldLayout.terrainFeatures.length}`);
    lines.push(`    Deployments: ${nested.battlefieldLayout.deployments.length}`);
  }
  lines.push('');
  lines.push('════════════════════════════════════════════════════════════');
  return lines.join('\n');
}

async function runValidationBatch(
  gameSize: GameSize = GameSize.VERY_LARGE,
  densityRatio: number = 50,
  runs: number = 3,
  baseSeed: number = 424242,
  lighting: LightingCondition = 'Day, Clear',
  sideDoctrines: [TacticalDoctrine, TacticalDoctrine] = [TacticalDoctrine.Operative, TacticalDoctrine.Operative],
  loadoutProfile: 'default' | 'melee_only' = 'default',
  missionId: string = 'QAI_11'
) {
  if (runs < 1) {
    throw new Error('Validation runs must be >= 1.');
  }

  const winners: Record<string, number> = {};
  const totals = createEmptyStats();
  const advancedRuleTotals = createEmptyAdvancedRuleMetrics();
  const runReports: ValidationAggregateReport['runReports'] = [];
  const visibilityOrMu = getVisibilityOrForLighting(lighting);
  const doctrineAlpha = sideDoctrines[0];
  const doctrineBravo = sideDoctrines[1];
  const doctrineConfigAlpha = doctrineToAIConfig(doctrineAlpha);
  const doctrineConfigBravo = doctrineToAIConfig(doctrineBravo);
  const doctrineLabel = doctrineAlpha === doctrineBravo ? doctrineAlpha : `${doctrineAlpha} vs ${doctrineBravo}`;
  const resolvedMissionId = parseMissionIdArg(missionId, 'QAI_11');
  const missionName = MISSION_NAME_BY_ID[resolvedMissionId] ?? resolvedMissionId;
  const baseConfig: GameConfig = {
    missionId: resolvedMissionId,
    missionName,
    gameSize,
    battlefieldSize: GAME_SIZE_CONFIG[gameSize].battlefieldSize,
    maxTurns: GAME_SIZE_CONFIG[gameSize].maxTurns,
    endGameTurn: GAME_SIZE_CONFIG[gameSize].endGameTurn,
    sides: [
      {
        name: 'Alpha',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: doctrineAlpha,
        loadoutProfile,
        assemblyName: 'Alpha Assembly',
        aggression: doctrineConfigAlpha.aggression ?? 0.5,
        caution: doctrineConfigAlpha.caution ?? 0.5,
      },
      {
        name: 'Bravo',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: doctrineBravo,
        loadoutProfile,
        assemblyName: 'Bravo Assembly',
        aggression: doctrineConfigBravo.aggression ?? 0.5,
        caution: doctrineConfigBravo.caution ?? 0.5,
      },
    ],
    densityRatio,
    lighting,
    visibilityOrMu,
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    verbose: false,
  };

  console.log(`\nRunning ${runs} validation battle(s) for ${missionName} (${resolvedMissionId}, ${gameSize})...`);
  console.log(`  Doctrine: ${doctrineLabel}`);
  console.log(`    Alpha: ${doctrineAlpha}`);
  console.log(`    Bravo: ${doctrineBravo}`);
  console.log(`  Loadout Profile: ${loadoutProfile}`);
  for (let i = 0; i < runs; i++) {
    const seed = baseSeed + i;
    const runner = new AIBattleRunner();
    const report = await runner.runBattle(baseConfig, { seed, suppressOutput: true });
    winners[report.winner] = (winners[report.winner] ?? 0) + 1;
    accumulateStats(totals, report.stats);
    accumulateAdvancedRuleMetrics(advancedRuleTotals, report.advancedRules);
    runReports.push({
      run: i + 1,
      seed,
      winner: report.winner,
      finalCounts: report.finalCounts,
      stats: report.stats,
      usage: {
        modelCount: report.usage?.modelCount ?? 0,
        modelsMoved: report.usage?.modelsMoved ?? 0,
        modelsUsedWait: report.usage?.modelsUsedWait ?? 0,
        modelsUsedDetect: report.usage?.modelsUsedDetect ?? 0,
        modelsUsedHide: report.usage?.modelsUsedHide ?? 0,
        modelsUsedReact: report.usage?.modelsUsedReact ?? 0,
        totalPathLength: report.usage?.totalPathLength ?? 0,
        averagePathLengthPerMovedModel: report.usage?.averagePathLengthPerMovedModel ?? 0,
        averagePathLengthPerModel: report.usage?.averagePathLengthPerModel ?? 0,
        topPathModels: report.usage?.topPathModels ?? [],
      },
      missionRuntime: report.missionRuntime,
      nestedSections: report.nestedSections,
      advancedRules: report.advancedRules,
    });
    console.log(
      `  Run ${i + 1}/${runs}: winner=${report.winner}, moves=${report.stats.moves}, ranged=${report.stats.rangedCombats}, close=${report.stats.closeCombats}, path=${(report.usage?.totalPathLength ?? 0).toFixed(2)}`
    );
  }

  const runtimeCoverage = baseCoverageFromStats(totals);
  const probeCoverage = mergeCoverage(emptyCoverage(), runMechanicProbes());
  const coverage = mergeCoverage(runtimeCoverage, probeCoverage);

  const aggregateReport: ValidationAggregateReport = {
    missionId: resolvedMissionId,
    gameSize,
    densityRatio,
    tacticalDoctrine: doctrineLabel,
    sideDoctrines: [
      { sideName: 'Alpha', tacticalDoctrine: doctrineAlpha, loadoutProfile },
      { sideName: 'Bravo', tacticalDoctrine: doctrineBravo, loadoutProfile },
    ],
    loadoutProfile,
    lighting,
    visibilityOrMu,
    maxOrm: baseConfig.maxOrm,
    allowConcentrateRangeExtension: baseConfig.allowConcentrateRangeExtension,
    perCharacterFovLos: baseConfig.perCharacterFovLos,
    runs,
    baseSeed,
    winners,
    totals,
    averages: divideStats(totals, runs),
    advancedRuleTotals,
    advancedRuleAverages: divideAdvancedRuleMetrics(advancedRuleTotals, runs),
    coverage,
    runtimeCoverage,
    probeCoverage,
    runReports,
    generatedAt: new Date().toISOString(),
  };

  const outputPath = writeValidationReport(aggregateReport);
  console.log('\nValidation aggregate:');
  console.log(`  Winners: ${JSON.stringify(winners)}`);
  console.log(`  Runtime Coverage: ${JSON.stringify(runtimeCoverage)}`);
  console.log(`  Probe Coverage: ${JSON.stringify(probeCoverage)}`);
  console.log(`  Combined Coverage: ${JSON.stringify(coverage)}`);
  console.log(`  Bonus Actions: offered=${advancedRuleTotals.bonusActions.optionsOffered}, executed=${advancedRuleTotals.bonusActions.executed}`);
  console.log(`  Passive Options: offered=${advancedRuleTotals.passiveOptions.optionsOffered}, used=${advancedRuleTotals.passiveOptions.used}`);
  console.log(`  Situational Modifiers: tests=${advancedRuleTotals.situationalModifiers.testsObserved}, applied=${advancedRuleTotals.situationalModifiers.modifiersApplied}`);
  console.log(`  Lighting: ${lighting} (Visibility OR ${visibilityOrMu} MU)`);
  console.log(`  Doctrine: ${doctrineLabel}`);
  console.log(`    Alpha: ${doctrineAlpha}`);
  console.log(`    Bravo: ${doctrineBravo}`);
  console.log(`  Loadout Profile: ${loadoutProfile}`);
  console.log(`  Report: ${outputPath}`);
}

function renderBattleReportFile(reportPath: string) {
  const jsonText = readFileSync(reportPath, 'utf-8');
  const parsed = JSON.parse(jsonText) as BattleReport | ValidationAggregateReport;
  const isValidationAggregate =
    typeof (parsed as ValidationAggregateReport).runs === 'number' &&
    Array.isArray((parsed as ValidationAggregateReport).runReports) &&
    Boolean((parsed as ValidationAggregateReport).totals);
  if (isValidationAggregate) {
    console.log(`\n${formatValidationAggregateReportHumanReadable(parsed as ValidationAggregateReport)}\n`);
  } else {
    console.log(`\n${formatBattleReportHumanReadable(parsed as BattleReport)}\n`);
  }
}

function parseLightingArg(value: string | undefined): LightingCondition {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return 'Day, Clear';
  if (
    normalized === '2' ||
    normalized === 'twilight' ||
    normalized === 'twilight_overcast' ||
    normalized === 'twilight-overcast'
  ) {
    return 'Twilight, Overcast';
  }
  return 'Day, Clear';
}

function parseLoadoutProfileArg(value: string | undefined): 'default' | 'melee_only' {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return 'default';
  if (normalized === 'melee' || normalized === 'melee_only' || normalized === 'melee-only') {
    return 'melee_only';
  }
  return 'default';
}

function parseDoctrineArg(value: string | undefined, fallback: TacticalDoctrine = TacticalDoctrine.Operative): TacticalDoctrine {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  for (const doctrine of Object.values(TacticalDoctrine)) {
    if (String(doctrine).toLowerCase() === normalized) {
      return doctrine;
    }
  }
  return fallback;
}

function parseDoctrinePairArgs(
  doctrineArg: string | undefined,
  doctrineArgBravo: string | undefined,
  fallback: TacticalDoctrine
): [TacticalDoctrine, TacticalDoctrine] {
  const raw = (doctrineArg ?? '').trim();
  if (!raw) {
    return [fallback, fallback];
  }

  if (raw.includes(',')) {
    const [left, right] = raw.split(',', 2);
    const alpha = parseDoctrineArg(left, fallback);
    const bravo = parseDoctrineArg(right, alpha);
    return [alpha, bravo];
  }

  const alpha = parseDoctrineArg(raw, fallback);
  const bravo = parseDoctrineArg(doctrineArgBravo, alpha);
  return [alpha, bravo];
}

function parseMissionIdArg(value: string | undefined, fallback: string = 'QAI_11'): string {
  const normalized = (value ?? '').trim().toUpperCase().replace('-', '_');
  if (!normalized) return fallback;
  if (/^QAI_[0-9]+$/.test(normalized)) {
    return normalized;
  }
  return fallback;
}

// Main entry point
const args = process.argv.slice(2);
const command = args[0];

if (command === '--interactive' || command === '-i') {
  runInteractive();
} else if (command === '--render-report' || command === '-r') {
  const reportPath = args[1];
  if (!reportPath) {
    console.error('Missing report path. Usage: npm run ai-battle -- -r generated/ai-battle-reports/<file>.json');
    process.exit(1);
  }
  try {
    renderBattleReportFile(reportPath);
  } catch (error) {
    console.error('\n❌ Report rendering failed with error:');
    console.error(error);
    process.exit(1);
  }
} else if (command === '--validate' || command === '-v') {
  const sizeArg = (args[1] || 'VERY_LARGE').toUpperCase();
  const densityParsed = parseInt(args[2], 10);
  const runsParsed = parseInt(args[3], 10);
  const seedParsed = parseInt(args[4], 10);
  const densityArg = Number.isFinite(densityParsed) ? densityParsed : 50;
  const runsArg = Number.isFinite(runsParsed) ? runsParsed : 3;
  const seedArg = Number.isFinite(seedParsed) ? seedParsed : 424242;
  const lighting = parseLightingArg(args[5]);
  const loadoutProfile = parseLoadoutProfileArg(args[6]);
  const doctrinePair = parseDoctrinePairArgs(
    args[7],
    args[8],
    loadoutProfile === 'melee_only' ? TacticalDoctrine.Juggernaut : TacticalDoctrine.Operative
  );
  const missionId = parseMissionIdArg(args[9], parseMissionIdArg(args[8], 'QAI_11'));
  const toGameSize: Record<string, GameSize> = {
    VERY_SMALL: GameSize.VERY_SMALL,
    SMALL: GameSize.SMALL,
    MEDIUM: GameSize.MEDIUM,
    LARGE: GameSize.LARGE,
    VERY_LARGE: GameSize.VERY_LARGE,
  };
  const gameSize = toGameSize[sizeArg] ?? GameSize.VERY_LARGE;
  runValidationBatch(gameSize, densityArg, runsArg, seedArg, lighting, doctrinePair, loadoutProfile, missionId).catch((error) => {
    console.error('\n❌ Validation failed with error:');
    console.error(error);
    process.exit(1);
  });
} else if (command === '--help' || command === '-h') {
  console.log(`
AI Battle Setup - MEST Tactics

Usage:
  npm run ai-battle                    # Quick battle (VERY_LARGE, density 50)
  npm run ai-battle -- -i              # Interactive setup
  npm run ai-battle -- -r REPORT_PATH
  npm run ai-battle -- -v SIZE DENSITY RUNS SEED [LIGHTING] [LOADOUT_PROFILE] [DOCTRINE_ALPHA[,DOCTRINE_BRAVO]] [MISSION_ID]
  npm run ai-battle -- -v SIZE DENSITY RUNS SEED [LIGHTING] [LOADOUT_PROFILE] [DOCTRINE_ALPHA] [DOCTRINE_BRAVO] [MISSION_ID]
  npm run ai-battle -- SIZE DENSITY [LIGHTING]    # Quick battle with custom params

Game Sizes: VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE
Lighting: DAY (default) | TWILIGHT
Loadout Profile: DEFAULT (default) | MELEE_ONLY
Doctrine: Any tactical doctrine id (default: OPERATIVE, or JUGGERNAUT for MELEE_ONLY)

Examples:
  npm run ai-battle -- VERY_LARGE 50   # Large battle, 50% terrain
  npm run ai-battle -- VERY_LARGE 50 TWILIGHT
  npm run ai-battle -- SMALL 30        # Small battle, 30% terrain
  npm run ai-battle -- -v SMALL 50 1 424242 DAY MELEE_ONLY
  npm run ai-battle -- -v SMALL 50 1 424242 DAY MELEE_ONLY juggernaut
  npm run ai-battle -- -v SMALL 50 1 424242 DAY DEFAULT operative,watchman QAI_11
  npm run ai-battle -- -v SMALL 50 1 424242 DAY DEFAULT operative watchman QAI_20
  npm run ai-battle -- -r generated/ai-battle-reports/battle-report-<ts>.json
  npm run ai-battle -- -v VERY_LARGE 50 5 424242 TWILIGHT
`);
} else {
  // Default: run quick battle with VERY_LARGE and density 50
  const sizeArg = (args[0] || 'VERY_LARGE').toUpperCase();
  const densityParsed = parseInt(args[1], 10);
  const densityArg = Number.isFinite(densityParsed) ? densityParsed : 50;
  const lighting = parseLightingArg(args[2]);
  const toGameSize: Record<string, GameSize> = {
    VERY_SMALL: GameSize.VERY_SMALL,
    SMALL: GameSize.SMALL,
    MEDIUM: GameSize.MEDIUM,
    LARGE: GameSize.LARGE,
    VERY_LARGE: GameSize.VERY_LARGE,
  };
  const gameSize = toGameSize[sizeArg] ?? GameSize.VERY_LARGE;
  runQuickBattle(gameSize, 'QAI_11', densityArg, lighting);
}
