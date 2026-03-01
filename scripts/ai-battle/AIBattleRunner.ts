/**
 * AI Battle Runner
 *
 * Main battle execution class for AI vs AI battles.
 * Handles all battle logic including AI decisions, combat resolution, and reporting.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Character } from '../../src/lib/mest-tactics/core/Character';
import type { Item } from '../../src/lib/mest-tactics/core/Item';
import { Battlefield, type BattlefieldLosCacheStats } from '../../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainType } from '../../src/lib/mest-tactics/battlefield/terrain/Terrain';
import { TerrainElement } from '../../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { placeTerrain, type TerrainPlacementResult } from '../../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { exportBattlefield, getBattlefieldReference } from '../../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import { TerrainFeature } from '../../src/lib/mest-tactics/battlefield/terrain/Terrain';
import { GameManager } from '../../src/lib/mest-tactics/engine/GameManager';
import { Position } from '../../src/lib/mest-tactics/battlefield/Position';
import { SpatialRules } from '../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../src/lib/mest-tactics/battlefield/spatial/size-utils';
import { buildAssembly, buildProfile, GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { MissionSide, ModelSlotStatus } from '../../src/lib/mest-tactics/mission/MissionSide';
import { ObjectiveMarkerKind, ObjectiveMarkerManager } from '../../src/lib/mest-tactics/mission/objective-markers';
import {
  createMissionRuntimeAdapter,
  MissionRuntimeAdapter,
  MissionRuntimeUpdate,
} from '../../src/lib/mest-tactics/missions/mission-runtime-adapter';
import { MissionModel } from '../../src/lib/mest-tactics/missions/mission-keys';
import {
  TacticalDoctrine,
  TACTICAL_DOCTRINE_INFO,
  getDoctrinesByEngagement,
  deriveDoctrineAIPressure,
  getDoctrineComponents,
  EngagementStyle,
  PlanningPriority,
  AggressionLevel,
} from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { CharacterAI, DEFAULT_CHARACTER_AI_CONFIG } from '../../src/lib/mest-tactics/ai/core/CharacterAI';
import { AIContext, AIControllerConfig, AIResult, CharacterKnowledge } from '../../src/lib/mest-tactics/ai/core/AIController';
import { attemptHide, attemptDetect } from '../../src/lib/mest-tactics/status/concealment';
import { getCharacterTraitLevel } from '../../src/lib/mest-tactics/status/status-system';
import { LOFOperations } from '../../src/lib/mest-tactics/battlefield/los/LOFOperations';
import { PathfindingEngine, type PathfindingCacheStats } from '../../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import {
  applyBonusAction,
  type BonusActionOption,
  type BonusActionOutcome,
  type BonusActionSelection,
  type BonusActionType,
} from '../../src/lib/mest-tactics/actions/bonus-actions';
import type { PassiveEvent, PassiveOption, PassiveOptionType } from '../../src/lib/mest-tactics/status/passive-options';
import type { TestContext } from '../../src/lib/mest-tactics/utils/TestContext';
import { performTest, type TestDice } from '../../src/lib/mest-tactics/subroutines/dice-roller';
import {
  LightingCondition,
  evaluateRangeWithVisibility,
  getVisibilityOrForLighting,
  parseWeaponOptimalRangeMu,
} from '../../src/lib/mest-tactics/utils/visibility';
import type { GameConfig, SideConfig, BattleReport, BattleStats, AdvancedRuleMetrics, BattleLogEntry, NestedSections, UsageMetrics, ModelUsageStats, BattleAuditTrace, TurnAudit, ActivationAudit, ActionStepAudit, ModelEffectAudit, OpposedTestAudit, AuditVector, ModelStateAudit, BattlePerformanceSummary, PhaseTimingSummary, TurnTimingSummary, SlowActivationSummary } from '../shared/BattleReportTypes';
import { GAME_SIZE_CONFIG } from '../shared/AIBattleConfig';
import { formatBattleReportHumanReadable } from './reporting/BattleReportFormatter';
import { writeSingleBattleReport, writeVisualAuditReport, writeBattleReportViewer, writeBattlefieldSvg } from './reporting/BattleReportWriter';
import { createEmptyStats, createEmptyAdvancedRuleMetrics, safeRate, computePercentile, createSeededRandom, emptyKnowledge, CONTEXT_MODIFIER_KEYS, type RuleTypeBreakdown, type SideSection, type CharacterSection, type ReactAuditResult } from './validation/ValidationMetrics';
import { buildBonusActionOptions } from '../../src/lib/mest-tactics/actions/bonus-actions';
import { StatisticsTracker } from './tracking/StatisticsTracker';

// Import from new core modules
import {
  buildPredictedScoring,
  buildSideStrategies,
  findBestRetreatPosition,
  findPushBackSelection,
  getBonusActionPriority,
  createBonusSelectionForType,
  shouldUseDefendDeclared,
  shouldUseTakeCoverDeclared,
  getPassiveResponsePriority,
  scoreCounterChargeObserver,
  buildSpatialModelFor,
  shouldUseLeanForRanged,
  shouldUseLeanForDetect,
  findRelocationPositionAgainstThreats,
  findRelocationPosition,
  findTakeCoverPosition,
  buildAutoBonusActionSelections,
  applyAutoBonusActionIfPossible,
  type PredictedScoringResult,
  type SideStrategy,
  type RetreatPosition,
  type PushBackSelection,
} from './core/AIDecisionSupport';

import {
  executeCloseCombat,
  executeRangedCombat,
  executeDisengage,
  pickMeleeWeapon,
  pickRangedWeapon,
  normalizeAttackResult,
  extractWoundsAddedFromDamageResolution,
  trackCombatExtras,
  isAttackDecisionType,
  extractDamageResolutionFromStepDetails,
  extractDamageResolutionFromUnknown,
  hasRangedWeapon,
  hasMeleeWeapon,
  getLoadoutProfile,
  type AttackResult,
  type WeaponSelection,
} from './core/CombatExecutor';

import {
  createMissionRuntimeState,
  createMissionSides,
  buildMissionModelsFromSides,
  applyMissionRuntimeUpdate,
  resolveMissionWinnerName,
  applyMissionStartOverrides,
  syncMissionRuntimeForAttack,
  buildAiObjectiveMarkerSnapshot,
  getMarkerKeyIdsInHand,
  initializeMissionRuntimeAdapter,
  updateMissionRuntimeForTurnEnd,
  checkMissionVictoryConditions,
  type MissionRuntimeState,
  type MissionModelsResult,
  type MissionModel,
} from './core/MissionRuntimeIntegration';

import {
  inspectPassiveOptions,
  inspectMovePassiveOptions,
  executeFailedHitPassiveResponse,
  executeCounterChargeFromMove,
  applyPassiveFollowupBonusActions,
  countDiceInPool,
  resolveCarryOverBonusCascades,
  computeEngageMovePosition,
  areEngaged,
  isFreeFromEngagementInTurn,
  computeFallbackMovePosition,
  computeDirectAdvanceStep,
  type PassiveResponseResult,
  type CounterChargeResult,
  type FollowupBonusResult,
} from './core/PassiveResponseHandler';

export class AIBattleRunner {
  private log: BattleLogEntry[] = [];
  private tracker: StatisticsTracker;
  private modelUsageByCharacter = new Map<Character, ModelUsageStats>();
  private sideNameByCharacterId = new Map<string, string>();
  private doctrineByCharacterId = new Map<string, TacticalDoctrine>();
  
  // Mission runtime state (using new module)
  private missionRuntimeState: MissionRuntimeState;
  
  private currentBattlefield: Battlefield | null = null;
  private auditTurns: TurnAudit[] = [];
  private activationSequence = 0;
  private performanceProfilingEnabled = false;
  private performanceProgressEnabled = false;
  private performanceProgressEachActivation = false;
  private performanceHeartbeatEveryActivations = 25;
  private performanceRunStartMs = 0;
  private performancePhases: Record<string, { count: number; totalMs: number; maxMs: number }> = {};
  private performanceTurns: TurnTimingSummary[] = [];
  private performanceSlowestActivations: SlowActivationSummary[] = [];
  private performanceActivationSamplesMs: number[] = [];
  private activationsProcessed = 0;
  private lastTerrainResult: TerrainPlacementResult | null = null;
  private battlefieldExportPath: string | null = null;

  private resetRunState() {
    this.log = [];
    this.tracker = new StatisticsTracker();
    this.modelUsageByCharacter = new Map<Character, ModelUsageStats>();
    this.sideNameByCharacterId = new Map<string, string>();
    this.doctrineByCharacterId = new Map<string, TacticalDoctrine>();
    this.missionRuntimeState = createMissionRuntimeState();
    this.currentBattlefield = null;
    this.lastTerrainResult = null;
    this.battlefieldExportPath = null;
    this.auditTurns = [];
    this.activationSequence = 0;
    this.performanceProfilingEnabled = false;
    this.performanceProgressEnabled = false;
    this.performanceProgressEachActivation = false;
    this.performanceHeartbeatEveryActivations = 25;
    this.performanceRunStartMs = 0;
    this.performancePhases = {};
    this.performanceTurns = [];
    this.performanceSlowestActivations = [];
    this.performanceActivationSamplesMs = [];
    this.activationsProcessed = 0;
  }

  private setupPerformanceInstrumentation(forceProfiling: boolean = false): void {
    this.performanceProfilingEnabled =
      forceProfiling || process.env.AI_BATTLE_PROFILE === '1' || process.env.AI_BATTLE_PROGRESS === '1';
    this.performanceProgressEnabled = process.env.AI_BATTLE_PROGRESS === '1';
    this.performanceProgressEachActivation = process.env.AI_BATTLE_PROGRESS_EACH_ACTIVATION === '1';
    const rawHeartbeat = Number.parseInt(process.env.AI_BATTLE_HEARTBEAT_EVERY ?? '', 10);
    if (Number.isFinite(rawHeartbeat) && rawHeartbeat > 0) {
      this.performanceHeartbeatEveryActivations = rawHeartbeat;
    }
    this.performanceRunStartMs = Date.now();
  }

  private recordPhaseDuration(phase: string, elapsedMs: number): void {
    if (!this.performanceProfilingEnabled) return;
    const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    const bucket = this.performancePhases[phase] ?? { count: 0, totalMs: 0, maxMs: 0 };
    bucket.count += 1;
    bucket.totalMs += safeElapsedMs;
    bucket.maxMs = Math.max(bucket.maxMs, safeElapsedMs);
    this.performancePhases[phase] = bucket;
  }

  private withPhaseTiming<T>(phase: string, fn: () => T): T {
    const startedMs = Date.now();
    try {
      return fn();
    } finally {
      this.recordPhaseDuration(phase, Date.now() - startedMs);
    }
  }

  private async withAsyncPhaseTiming<T>(phase: string, fn: () => Promise<T>): Promise<T> {
    const startedMs = Date.now();
    try {
      return await fn();
    } finally {
      this.recordPhaseDuration(phase, Date.now() - startedMs);
    }
  }

  private maybeLogActivationHeartbeat(
    turn: number,
    sideName: string,
    character: Character,
    elapsedMs: number
  ): void {
    if (!this.performanceProgressEnabled) return;
    if (this.activationsProcessed % this.performanceHeartbeatEveryActivations !== 0) return;
    const elapsedRunMs = Date.now() - this.performanceRunStartMs;
    console.log(
      `[PROFILE] act=${this.activationsProcessed} turn=${turn} side=${sideName} model=${character.profile.name} activationMs=${elapsedMs.toFixed(1)} totalMs=${elapsedRunMs}`
    );
  }

  private recordSlowActivation(entry: SlowActivationSummary): void {
    if (!this.performanceProfilingEnabled) return;
    this.performanceSlowestActivations.push(entry);
    this.performanceSlowestActivations
      .sort((a, b) => b.elapsedMs - a.elapsedMs);
    if (this.performanceSlowestActivations.length > 10) {
      this.performanceSlowestActivations.length = 10;
    }
  }

  /**
   * Build predicted scoring data for battle report (R1.5: AI Planning)
   * Captures the final predicted scoring state from all sides
   */
  private buildPredictedScoring(sides: MissionSide[]): {
    bySide: Record<string, {
      predictedVp: number;
      predictedRp: number;
      keyScores: Record<string, {
        current: number;
        predicted: number;
        confidence: number;
        leadMargin: number;
      }>;
    }>;
  } | undefined {
    const bySide: Record<string, {
      predictedVp: number;
      predictedRp: number;
      keyScores: Record<string, {
        current: number;
        predicted: number;
        confidence: number;
        leadMargin: number;
      }>;
    }> = {};

    for (const side of sides) {
      bySide[side.id] = {
        predictedVp: side.state.predictedVp,
        predictedRp: side.state.predictedRp,
        keyScores: {},
      };

      // Convert key scores to plain object for JSON serialization
      for (const [key, score] of Object.entries(side.state.keyScores)) {
        if (score) {
          bySide[side.id].keyScores[key] = {
            current: score.current,
            predicted: score.predicted,
            confidence: score.confidence,
            leadMargin: score.leadMargin,
          };
        }
      }
    }

    // Only include if there's actual predicted scoring data
    const hasData = Object.values(bySide).some(s => s.predictedVp > 0 || s.predictedRp > 0 || Object.keys(s.keyScores).length > 0);
    return hasData ? { bySide } : undefined;
  }

  /**
   * Build side-level AI strategies for battle report (R1.5: God Mode Coordination)
   * Captures strategic context and advice from all Side Coordinators
   */
  private buildSideStrategies(): Record<string, {
    doctrine: string;
    advice: string[];
    context?: {
      amILeading: boolean;
      vpMargin: number;
      winningKeys: string[];
      losingKeys: string[];
    };
  }> | undefined {
    const gameManager = this.gameManager;
    if (!gameManager) return undefined;

    const coordinatorManager = gameManager.getSideCoordinatorManager();
    if (!coordinatorManager) return undefined;

    const strategies: Record<string, {
      doctrine: string;
      advice: string[];
      context?: {
        amILeading: boolean;
        vpMargin: number;
        winningKeys: string[];
        losingKeys: string[];
      };
    }> = {};

    for (const coordinator of coordinatorManager.getAllCoordinators()) {
      const context = coordinator.getScoringContext();
      strategies[coordinator.getSideId()] = {
        doctrine: coordinator.getTacticalDoctrine(),
        advice: coordinator.getStrategicAdvice(),
        context: context ? {
          amILeading: context.amILeading,
          vpMargin: context.vpMargin,
          winningKeys: context.winningKeys,
          losingKeys: context.losingKeys,
        } : undefined,
      };
    }

    return Object.keys(strategies).length > 0 ? strategies : undefined;
  }

  private buildPerformanceSummary(battlefield?: Battlefield): BattlePerformanceSummary | undefined {
    if (!this.performanceProfilingEnabled) return undefined;
    const phases: Record<string, PhaseTimingSummary> = {};
    for (const [phase, stats] of Object.entries(this.performancePhases)) {
      phases[phase] = {
        count: stats.count,
        totalMs: Number(stats.totalMs.toFixed(2)),
        avgMs: Number((stats.totalMs / Math.max(1, stats.count)).toFixed(2)),
        maxMs: Number(stats.maxMs.toFixed(2)),
      };
    }
    const activationSamples = this.performanceActivationSamplesMs
      .filter(sample => Number.isFinite(sample) && sample >= 0)
      .slice()
      .sort((a, b) => a - b);
    const activationSampleCount = activationSamples.length;
    const activationSum = activationSamples.reduce((sum, value) => sum + value, 0);
    const activationLatency = {
      avgMs: Number((activationSampleCount > 0 ? activationSum / activationSampleCount : 0).toFixed(2)),
      p50Ms: Number(computePercentile(activationSamples, 0.5).toFixed(2)),
      p95Ms: Number(computePercentile(activationSamples, 0.95).toFixed(2)),
      maxMs: Number((activationSampleCount > 0 ? activationSamples[activationSampleCount - 1] : 0).toFixed(2)),
    };
    const summary: BattlePerformanceSummary = {
      elapsedMs: Number((Date.now() - this.performanceRunStartMs).toFixed(2)),
      activationsProcessed: this.activationsProcessed,
      heartbeatEveryActivations: this.performanceHeartbeatEveryActivations,
      activationLatency,
      phases,
      turns: this.performanceTurns,
      slowestActivations: this.performanceSlowestActivations,
    };
    if (battlefield) {
      const los = battlefield.getLosCacheStats();
      const pathfinding = new PathfindingEngine(battlefield).getCacheStats();
      summary.caches = { los, pathfinding };
    }
    return summary;
  }

  private initializeModelUsage(
    config: GameConfig,
    sides: Array<{ characters: Character[] }>
  ) {
    const sideData = sides.map((side, index) => ({
      characters: side.characters,
      name: config.sides[index]?.name ?? `Side ${index + 1}`,
    }));
    this.tracker.initializeModelUsage(sideData);
    
    // Also populate local maps for quick lookup
    this.modelUsageByCharacter = new Map<Character, ModelUsageStats>();
    this.sideNameByCharacterId = new Map<string, string>();
    this.doctrineByCharacterId = new Map<string, TacticalDoctrine>();
    
    for (let sideIndex = 0; sideIndex < sides.length; sideIndex++) {
      const sideName = config.sides[sideIndex]?.name ?? `Side ${sideIndex + 1}`;
      const doctrine = config.sides[sideIndex]?.tacticalDoctrine ?? TacticalDoctrine.Operative;
      for (const character of sides[sideIndex].characters) {
        this.sideNameByCharacterId.set(character.id, sideName);
        this.doctrineByCharacterId.set(character.id, doctrine);
        const usage = this.tracker.getModelUsage(character);
        if (usage) {
          this.modelUsageByCharacter.set(character, usage);
        }
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

  private incrementTypeBreakdown(breakdown: RuleTypeBreakdown, type: string, amount: number = 1) {
    if (!type || !Number.isFinite(amount) || amount === 0) return;
    breakdown[type] = (breakdown[type] ?? 0) + amount;
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
    this.tracker.trackBonusActionOptions(payload.bonusActionOptions);
    this.tracker.trackBonusActionOutcome(payload.bonusActionOutcome);
    const hitTestResult = payload.result?.hitTestResult ?? payload.hitTestResult;
    if (payload.context || hitTestResult) {
      this.tracker.trackSituationalModifiers(payload.context, hitTestResult);
    }
  }

  private inspectPassiveOptions(gameManager: GameManager, event: PassiveEvent): PassiveOption[] {
    const options = gameManager.getPassiveOptions(event);
    this.tracker.trackPassiveOptions(options);
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

  private isCombatantActive(character: Character): boolean {
    return !character.state.isEliminated && !character.state.isKOd;
  }

  private countEngagers(subject: Character, candidates: Character[], battlefield: Battlefield): number {
    let count = 0;
    for (const candidate of candidates) {
      if (!this.isCombatantActive(candidate)) continue;
      if (candidate.id === subject.id) continue;
      if (this.areEngaged(subject, candidate, battlefield)) {
        count += 1;
      }
    }
    return count;
  }

  private isEngagedAtPositions(
    first: Character,
    firstPosition: Position,
    second: Character,
    secondPosition: Position
  ): boolean {
    const firstSiz = first.finalAttributes.siz ?? first.attributes.siz ?? 3;
    const secondSiz = second.finalAttributes.siz ?? second.attributes.siz ?? 3;
    return SpatialRules.isEngaged(
      {
        id: first.id,
        position: firstPosition,
        baseDiameter: getBaseDiameterFromSiz(firstSiz),
        siz: firstSiz,
      },
      {
        id: second.id,
        position: secondPosition,
        baseDiameter: getBaseDiameterFromSiz(secondSiz),
        siz: secondSiz,
      }
    );
  }

  private countEngagersAtPosition(
    target: Character,
    targetPosition: Position,
    candidates: Character[],
    battlefield: Battlefield
  ): number {
    let count = 0;
    for (const candidate of candidates) {
      if (!this.isCombatantActive(candidate)) continue;
      if (candidate.id === target.id) continue;
      const candidatePos = battlefield.getCharacterPosition(candidate);
      if (!candidatePos) continue;
      if (this.isEngagedAtPositions(target, targetPosition, candidate, candidatePos)) {
        count += 1;
      }
    }
    return count;
  }

  private scoreIncomingThreatAtPosition(
    character: Character,
    position: Position,
    enemies: Character[],
    battlefield: Battlefield
  ): number {
    let threat = 0;
    for (const enemy of enemies) {
      if (!this.isCombatantActive(enemy)) continue;
      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const distance = Math.hypot(position.x - enemyPos.x, position.y - enemyPos.y);
      if (distance <= 0.01) {
        threat += 2;
      } else {
        threat += Math.max(0, 1.6 - distance / 12);
      }
      if (battlefield.hasLineOfSight(enemyPos, position)) {
        threat += 0.8;
      }
      if (this.isEngagedAtPositions(character, position, enemy, enemyPos)) {
        threat += 2.5;
      }
    }
    return threat;
  }

  private findBestRetreatPosition(
    actor: Character,
    reference: Character,
    battlefield: Battlefield,
    enemies: Character[],
    maxDistance: number
  ): Position | undefined {
    const actorPos = battlefield.getCharacterPosition(actor);
    const referencePos = battlefield.getCharacterPosition(reference);
    if (!actorPos || !referencePos) return undefined;

    const baseDirection = {
      x: actorPos.x - referencePos.x,
      y: actorPos.y - referencePos.y,
    };
    const baseLength = Math.hypot(baseDirection.x, baseDirection.y) || 1;
    const dirX = baseDirection.x / baseLength;
    const dirY = baseDirection.y / baseLength;

    const candidateVectors = [
      { x: dirX, y: dirY },
      { x: dirX + dirY * 0.5, y: dirY - dirX * 0.5 },
      { x: dirX - dirY * 0.5, y: dirY + dirX * 0.5 },
      { x: -dirY, y: dirX },
      { x: dirY, y: -dirX },
    ];

    let best: { score: number; position: Position } | null = null;

    for (const vector of candidateVectors) {
      const length = Math.hypot(vector.x, vector.y) || 1;
      const unit = { x: vector.x / length, y: vector.y / length };
      const candidate = {
        x: Math.round(actorPos.x + unit.x * maxDistance),
        y: Math.round(actorPos.y + unit.y * maxDistance),
      };
      if (candidate.x < 0 || candidate.x >= battlefield.width || candidate.y < 0 || candidate.y >= battlefield.height) {
        continue;
      }
      const occupant = battlefield.getCharacterAt(candidate);
      if (occupant && occupant.id !== actor.id) continue;

      const distanceFromReference = Math.hypot(candidate.x - referencePos.x, candidate.y - referencePos.y);
      const breaksLos = !battlefield.hasLineOfSight(referencePos, candidate);
      const threat = this.scoreIncomingThreatAtPosition(actor, candidate, enemies, battlefield);
      const score = distanceFromReference * 0.35 + (breaksLos ? 2.5 : 0) - threat;

      if (!best || score > best.score) {
        best = { score, position: candidate };
      }
    }

    return best?.position;
  }

  private findPushBackSelection(
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    allies: Character[],
    opponents: Character[]
  ): BonusActionSelection {
    const attackerPos = battlefield.getCharacterPosition(attacker);
    const targetPos = battlefield.getCharacterPosition(target);
    if (!attackerPos || !targetPos) {
      return { type: 'PushBack' };
    }

    const attackerBase = getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3);
    const pushDistance = Math.max(1, Math.round(attackerBase));
    const baseDx = targetPos.x - attackerPos.x;
    const baseDy = targetPos.y - attackerPos.y;
    const baseLength = Math.hypot(baseDx, baseDy) || 1;
    const forward = { x: baseDx / baseLength, y: baseDy / baseLength };

    const directions = [
      forward,
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
    ];

    const friendlyGroup = [attacker, ...allies.filter(ally => ally.id !== attacker.id)];
    const enemySupportGroup = opponents.filter(candidate => candidate.id !== target.id);
    const beforeFriendlyEngagers = this.countEngagersAtPosition(target, targetPos, friendlyGroup, battlefield);
    const beforeEnemySupport = this.countEngagersAtPosition(target, targetPos, enemySupportGroup, battlefield);

    let best: { score: number; position: Position } | null = null;

    for (const direction of directions) {
      const magnitude = Math.hypot(direction.x, direction.y) || 1;
      const unit = { x: direction.x / magnitude, y: direction.y / magnitude };
      const destination = {
        x: Math.round(targetPos.x + unit.x * pushDistance),
        y: Math.round(targetPos.y + unit.y * pushDistance),
      };

      let score = 0;
      if (destination.x < 0 || destination.x >= battlefield.width || destination.y < 0 || destination.y >= battlefield.height) {
        score += 6;
      } else {
        const occupant = battlefield.getCharacterAt(destination);
        if (occupant && occupant.id !== target.id) {
          continue;
        }
        const terrain = battlefield.getTerrainAt(destination).type;
        const isBlocked = terrain === TerrainType.Impassable || terrain === TerrainType.Obstacle;
        const isDegraded = terrain === TerrainType.Rough || terrain === TerrainType.Difficult;

        // Prefer Delay-token outcomes and local outnumber pressure.
        if (isBlocked) {
          score += 5;
        } else if (isDegraded) {
          score += 3;
        }

        const afterFriendlyEngagers = this.countEngagersAtPosition(target, destination, friendlyGroup, battlefield);
        const afterEnemySupport = this.countEngagersAtPosition(target, destination, enemySupportGroup, battlefield);
        score += (afterFriendlyEngagers - beforeFriendlyEngagers) * 1.5;
        score += (beforeEnemySupport - afterEnemySupport) * 1.25;
      }

      if (!best || score > best.score) {
        best = { score, position: destination };
      }
    }

    if (best) {
      return { type: 'PushBack', targetPosition: best.position };
    }
    return { type: 'PushBack' };
  }

  private getBonusActionPriority(
    doctrine: TacticalDoctrine,
    isCloseCombat: boolean,
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    allies: Character[],
    opponents: Character[]
  ): BonusActionType[] {
    const components = getDoctrineComponents(doctrine);
    const loadout = this.getLoadoutProfile(attacker);
    const fightLevel = getCharacterTraitLevel(attacker, 'Fight');
    const brawlLevel = getCharacterTraitLevel(attacker, 'Brawl');
    const archetypeName = typeof attacker.profile.archetype === 'string'
      ? attacker.profile.archetype.toLowerCase()
      : '';
    const isBrawlerArchetype = attacker.profile.name.toLowerCase().includes('brawler') || archetypeName.includes('brawler');
    const closeCombatSpecialist = (fightLevel + brawlLevel) > 0 || isBrawlerArchetype;

    const attackerEnemyEngagers = this.countEngagers(attacker, opponents, battlefield);
    const attackerAllySupport = this.countEngagers(attacker, allies, battlefield);
    const attackerOutnumbered = attackerEnemyEngagers > Math.max(1, attackerAllySupport);

    const friendlyGroup = [attacker, ...allies.filter(ally => ally.id !== attacker.id)];
    const targetSupportGroup = opponents.filter(candidate => candidate.id !== target.id);
    const targetFriendlyPressure = this.countEngagers(target, friendlyGroup, battlefield);
    const targetEnemySupport = this.countEngagers(target, targetSupportGroup, battlefield);
    const needsOutnumberLeverage = targetFriendlyPressure <= targetEnemySupport;

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
          ? ['PushBack', 'Reversal', 'Circle', 'PullBack', 'Disengage', 'Reposition', 'Hide', 'Refresh']
          : ['Reposition', 'PushBack', 'Circle', 'PullBack', 'Hide', 'Disengage', 'Reversal', 'Refresh'];
      } else {
        base = components.engagement === EngagementStyle.Ranged
          ? ['Reposition', 'Hide', 'Refresh']
          : ['Reposition', 'Hide', 'Refresh'];
      }
    } else if (components.aggression === AggressionLevel.Defensive) {
      if (isCloseCombat) {
        base = components.engagement === EngagementStyle.Ranged
          ? ['Disengage', 'PullBack', 'Reposition', 'Hide', 'Refresh', 'Circle', 'PushBack', 'Reversal']
          : ['PullBack', 'Disengage', 'Reposition', 'Hide', 'Refresh', 'Circle', 'PushBack', 'Reversal'];
      } else {
        base = ['Hide', 'Reposition', 'Refresh'];
      }
    } else {
      base = isCloseCombat
        ? ['PushBack', 'Circle', 'Reversal', 'PullBack', 'Disengage', 'Reposition', 'Hide', 'Refresh']
        : ['Reposition', 'Hide', 'Refresh'];
    }

    if (components.planning === PlanningPriority.KeysToVictory) {
      base = isCloseCombat
        ? prioritize(base, ['Reposition', 'Disengage', 'Hide', 'Refresh'])
        : prioritize(base, ['Reposition', 'Hide', 'Refresh']);
    } else if (components.planning === PlanningPriority.Aggressive) {
      base = isCloseCombat
        ? prioritize(base, ['PushBack', 'Reversal', 'Circle', 'PullBack'])
        : prioritize(base, ['Reposition', 'Refresh', 'Hide']);
    }

    if (isCloseCombat) {
      if (attackerOutnumbered) {
        base = prioritize(base, ['Disengage', 'PullBack', 'Reversal', 'Reposition']);
      }
      if (needsOutnumberLeverage) {
        base = prioritize(base, ['PushBack', 'Reversal', 'PullBack', 'Circle']);
      }
      if (closeCombatSpecialist) {
        base = prioritize(base, ['PushBack', 'Reversal', 'Circle', 'PullBack']);
      }
      if (brawlLevel > 0 || isBrawlerArchetype) {
        base = prioritize(base, ['PushBack', 'Circle']);
      }
      if (fightLevel > 0) {
        base = prioritize(base, ['Reversal', 'Disengage', 'PullBack']);
      }
      if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) {
        base = prioritize(base, ['PushBack', 'Reversal', 'Disengage']);
      }
    } else if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) {
      base = prioritize(base, ['Reposition', 'Hide', 'Refresh']);
    }

    if (attacker.state.delayTokens > 0) {
      const shouldRefreshEarly = attackerOutnumbered || components.aggression === AggressionLevel.Defensive || attacker.state.delayTokens > 1;
      base = shouldRefreshEarly
        ? prioritize(base, ['Refresh'])
        : prioritize(base, ['PushBack', 'Disengage', 'Refresh']);
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
    allies: Character[],
    opponents: Character[]
  ): BonusActionSelection | undefined {
    if (type === 'Hide') {
      return attacker.state.isHidden ? undefined : { type: 'Hide', opponents };
    }
    if (type === 'Reposition') {
      const relocation = this.findRelocationPositionAgainstThreats(attacker, battlefield, opponents, target);
      return relocation ? { type: 'Reposition', attackerPosition: relocation } : undefined;
    }
    if (type === 'Disengage') {
      const mov = attacker.finalAttributes.mov ?? attacker.attributes.mov ?? 0;
      const attackerBase = getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3);
      const targetBase = getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3);
      const disengageDistance = Math.max(Math.max(attackerBase, targetBase), mov / 2);
      const retreat = this.findBestRetreatPosition(attacker, target, battlefield, opponents, disengageDistance);
      return retreat ? { type: 'Disengage', attackerPosition: retreat } : undefined;
    }
    if (type === 'PullBack') {
      const attackerBase = getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3);
      const targetBase = getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3);
      const pullDistance = Math.max(attackerBase, targetBase);
      const retreat = this.findBestRetreatPosition(attacker, target, battlefield, opponents, pullDistance);
      return retreat ? { type: 'PullBack', attackerPosition: retreat } : undefined;
    }
    if (type === 'PushBack') {
      return this.findPushBackSelection(attacker, target, battlefield, allies, opponents);
    }
    if (type === 'Circle') {
      const attackerPos = battlefield.getCharacterPosition(attacker);
      const targetPos = battlefield.getCharacterPosition(target);
      if (!attackerPos || !targetPos) return undefined;
      const circlePos = {
        x: Math.round(targetPos.x - (attackerPos.x - targetPos.x)),
        y: Math.round(targetPos.y - (attackerPos.y - targetPos.y)),
      };
      if (
        circlePos.x < 0 ||
        circlePos.x >= battlefield.width ||
        circlePos.y < 0 ||
        circlePos.y >= battlefield.height
      ) {
        return undefined;
      }
      const occupant = battlefield.getCharacterAt(circlePos);
      if (occupant && occupant.id !== attacker.id) {
        return undefined;
      }
      return { type: 'Circle', attackerPosition: circlePos };
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

  private findRelocationPositionAgainstThreats(
    character: Character,
    battlefield: Battlefield,
    threatSources: Character[],
    primaryThreat?: Character
  ): Position | undefined {
    const start = battlefield.getCharacterPosition(character);
    if (!start) return undefined;
    const mov = Math.max(1, character.finalAttributes.mov ?? character.attributes.mov ?? 0);
    const maxDistance = mov + 2;
    const activeThreats = threatSources
      .filter(threat => this.isCombatantActive(threat))
      .map(threat => ({ threat, position: battlefield.getCharacterPosition(threat) }))
      .filter((entry): entry is { threat: Character; position: Position } => Boolean(entry.position));
    const primaryThreatPos = primaryThreat ? battlefield.getCharacterPosition(primaryThreat) : undefined;
    let best: { score: number; pos: Position } | null = null;

    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dy = -maxDistance; dy <= maxDistance; dy++) {
        const distance = Math.hypot(dx, dy);
        if (distance <= 0 || distance > maxDistance) continue;
        const candidate = { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
        if (candidate.x < 0 || candidate.x >= battlefield.width || candidate.y < 0 || candidate.y >= battlefield.height) continue;
        const occupant = battlefield.getCharacterAt(candidate);
        if (occupant && occupant.id !== character.id) continue;

        let score = -distance * 0.12;
        if (primaryThreatPos) {
          const breaksPrimaryLos = !battlefield.hasLineOfSight(primaryThreatPos, candidate);
          score += breaksPrimaryLos ? 2.5 : 0;
        }
        if (activeThreats.length > 0) {
          let losExposure = 0;
          for (const { position } of activeThreats) {
            if (battlefield.hasLineOfSight(position, candidate)) {
              losExposure += 1;
            }
          }
          score -= losExposure * 0.5;
          score -= this.scoreIncomingThreatAtPosition(character, candidate, threatSources, battlefield);
        }

        if (!best || score > best.score) {
          best = { score, pos: candidate };
        }
      }
    }

    return best?.pos;
  }

  private findRelocationPosition(
    character: Character,
    battlefield: Battlefield,
    threatSource?: Character
  ): Position | undefined {
    const threatSources = threatSource ? [threatSource] : [];
    return this.findRelocationPositionAgainstThreats(character, battlefield, threatSources, threatSource);
  }

  private findTakeCoverPosition(
    defender: Character,
    attacker: Character,
    battlefield: Battlefield
  ): Position | undefined {
    const start = battlefield.getCharacterPosition(defender);
    const attackerPos = battlefield.getCharacterPosition(attacker);
    if (!start || !attackerPos) {
      return this.findRelocationPosition(defender, battlefield, attacker);
    }

    const mov = Math.max(1, defender.finalAttributes.mov ?? defender.attributes.mov ?? 0);
    const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3;
    const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 3;
    const attackerModel = {
      id: attacker.id,
      position: attackerPos,
      baseDiameter: getBaseDiameterFromSiz(attackerSiz),
      siz: attackerSiz,
    };

    let best: { score: number; pos: Position } | null = null;
    for (let dx = -mov; dx <= mov; dx++) {
      for (let dy = -mov; dy <= mov; dy++) {
        const distance = Math.hypot(dx, dy);
        if (distance <= 0 || distance > mov) continue;
        const candidate = {
          x: Math.round(start.x + dx),
          y: Math.round(start.y + dy),
        };
        if (candidate.x < 0 || candidate.x >= battlefield.width || candidate.y < 0 || candidate.y >= battlefield.height) continue;
        const occupant = battlefield.getCharacterAt(candidate);
        if (occupant && occupant.id !== defender.id) continue;

        const defenderModel = {
          id: defender.id,
          position: candidate,
          baseDiameter: getBaseDiameterFromSiz(defenderSiz),
          siz: defenderSiz,
        };
        const cover = SpatialRules.getCoverResult(battlefield, attackerModel, defenderModel);
        const hasCover = cover.hasDirectCover || cover.hasInterveningCover;
        const hasHardCover = cover.directCoverFeatures.some(feature => feature.meta?.los === 'Hard');
        const inLos = cover.hasLOS;

        // Preference order: break LOS > gain cover > reduce move cost.
        let score = 0;
        if (!inLos) score += 8;
        if (hasCover) score += 4;
        if (hasHardCover) score += 1.5;
        score -= distance * 0.15;

        if (!best || score > best.score) {
          best = { score, pos: candidate };
        }
      }
    }

    return best?.pos ?? this.findRelocationPosition(defender, battlefield, attacker);
  }

  private buildAutoBonusActionSelections(
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    allies: Character[],
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

    const prioritizedTypes = this.getBonusActionPriority(
      doctrine,
      isCloseCombat,
      attacker,
      target,
      battlefield,
      allies,
      opponents
    );
    for (const type of prioritizedTypes) {
      if (!byType.has(type)) continue;
      const selection = this.createBonusSelectionForType(type, attacker, target, battlefield, allies, opponents);
      if (selection) {
        push(selection);
      }
    }

    // Add any remaining available options as doctrine-agnostic fallbacks.
    for (const option of available) {
      const selection = this.createBonusSelectionForType(option.type, attacker, target, battlefield, allies, opponents);
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
    allies: Character[];
    opponents: Character[];
    isCloseCombat: boolean;
    doctrine: TacticalDoctrine;
    isCharge?: boolean;
  }) {
    const { result, attacker, target, battlefield, allies, opponents, isCloseCombat, doctrine, isCharge } = params;
    if (!result || typeof result !== 'object') return;
    const existing = result.bonusActionOutcome as BonusActionOutcome | undefined;
    if (existing?.executed) return;
    const options = Array.isArray(result.bonusActionOptions) ? (result.bonusActionOptions as BonusActionOption[]) : [];
    if (options.length === 0) return;

    const cascadesRaw = result.result?.hitTestResult?.cascades
      ?? result.hitTestResult?.cascades
      ?? 0;
    const cascades = Number.isFinite(cascadesRaw) ? Number(cascadesRaw) : 0;

    const selections = this.buildAutoBonusActionSelections(
      attacker,
      target,
      battlefield,
      allies,
      opponents,
      options,
      isCloseCombat,
      doctrine
    );
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

  private countDiceInPool(dice: TestDice | undefined): number {
    if (!dice) return 0;
    return (dice.base ?? 0) + (dice.modifier ?? 0) + (dice.wild ?? 0);
  }

  private resolveCarryOverBonusCascades(hitTestResult: any): number {
    const carryOverDice = (hitTestResult?.p2Result?.carryOverDice ?? {}) as TestDice;
    const totalDice = this.countDiceInPool(carryOverDice);
    if (totalDice <= 0) return 0;
    const rolls = Array.from({ length: totalDice }, () => Math.floor(Math.random() * 6) + 1);
    return Math.max(0, performTest(carryOverDice, 0, rolls).score);
  }

  private applyPassiveFollowupBonusActions(params: {
    defender: Character;
    attacker: Character;
    battlefield: Battlefield;
    doctrine: TacticalDoctrine;
    attackType: 'melee' | 'ranged';
    cascades: number;
  }): {
    bonusActionCascades: number;
    bonusActionOptions?: BonusActionOption[];
    bonusActionOutcome?: BonusActionOutcome;
  } {
    const { defender, attacker, battlefield, doctrine, attackType } = params;
    const cascades = Math.max(0, Math.floor(params.cascades));
    if (cascades <= 0) {
      return { bonusActionCascades: 0 };
    }

    const isCloseCombat = attackType === 'melee';
    const engaged = this.areEngaged(defender, attacker, battlefield);
    const bonusActionOptions = buildBonusActionOptions({
      battlefield,
      attacker: defender,
      target: attacker,
      cascades,
      isCloseCombat,
      engaged,
    });
    this.tracker.trackBonusActionOptions(bonusActionOptions);

    const selections = this.buildAutoBonusActionSelections(
      defender,
      attacker,
      battlefield,
      [],
      [attacker],
      bonusActionOptions,
      isCloseCombat,
      doctrine
    );

    let bonusActionOutcome: BonusActionOutcome | undefined;
    for (const selection of selections) {
      const outcome = applyBonusAction(
        {
          battlefield,
          attacker: defender,
          target: attacker,
          cascades,
          isCloseCombat,
          engaged,
        },
        selection
      );
      if (outcome.refreshApplied) {
        this.applyRefreshLocally(defender);
      }
      if (outcome.executed) {
        bonusActionOutcome = outcome;
        break;
      }
      bonusActionOutcome = outcome;
    }
    if (bonusActionOutcome) {
      this.tracker.trackBonusActionOutcome(bonusActionOutcome);
    }

    return {
      bonusActionCascades: cascades,
      bonusActionOptions,
      bonusActionOutcome,
    };
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
            this.tracker.trackPassiveUsage('CounterStrike');
            const battlefield = gameManager.battlefield;
            const bonusFollowup = battlefield && result.bonusActionEligible
              ? this.applyPassiveFollowupBonusActions({
                  defender,
                  attacker,
                  battlefield,
                  doctrine,
                  attackType,
                  cascades: this.resolveCarryOverBonusCascades(hitTestResult),
                })
              : { bonusActionCascades: 0 };
            return { type: 'CounterStrike', result: { ...result, ...bonusFollowup } };
          }
        }
      }
      if (type === 'CounterFire' && attackType === 'ranged') {
        const weapon = this.pickRangedWeapon(defender) ?? this.pickMeleeWeapon(defender);
        if (weapon) {
          const result = gameManager.executeCounterFire(defender, attacker, weapon as any, hitTestResult as any, { visibilityOrMu });
          if (result.executed) {
            this.tracker.trackPassiveUsage('CounterFire');
            const battlefield = gameManager.battlefield;
            const bonusFollowup = battlefield && result.bonusActionEligible
              ? this.applyPassiveFollowupBonusActions({
                  defender,
                  attacker,
                  battlefield,
                  doctrine,
                  attackType,
                  cascades: this.resolveCarryOverBonusCascades(hitTestResult),
                })
              : { bonusActionCascades: 0 };
            return { type: 'CounterFire', result: { ...result, ...bonusFollowup } };
          }
        }
      }
      if (type === 'CounterAction') {
        const result = gameManager.executeCounterAction(defender, attacker, hitTestResult as any, { attackType });
        if (result.executed) {
          this.tracker.trackPassiveUsage('CounterAction');
          const battlefield = gameManager.battlefield;
          const bonusFollowup = battlefield
            ? this.applyPassiveFollowupBonusActions({
                defender,
                attacker,
                battlefield,
                doctrine,
                attackType,
                cascades: result.bonusActionCascades ?? 0,
              })
            : { bonusActionCascades: result.bonusActionCascades ?? 0 };
          return { type: 'CounterAction', result: { ...result, ...bonusFollowup } };
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
      this.tracker.trackPassiveUsage('CounterCharge');
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
    seed: number | undefined,
    battlefield?: Battlefield
  ): BattleAuditTrace {
    const audit: BattleAuditTrace = {
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
        // Reference to exported battlefield.json
        exportPath: this.battlefieldExportPath || undefined,
      },
      turns: this.auditTurns,
    };

    // Add terrain if battlefield provided
    if (battlefield && battlefield.terrain && battlefield.terrain.length > 0) {
      (audit as any).terrain = battlefield.terrain.map((t: any) => ({
        id: t.id || t.name,
        type: t.type || t.info?.category,
        vertices: t.vertices,
        meta: t.meta || { color: t.info?.color },
      }));
    }

    // Add Delaunay mesh for pathfinding visualization
    if (battlefield && (battlefield as any).navMesh) {
      const navMesh = (battlefield as any).navMesh;
      if (navMesh && navMesh.points) {
        const triangles = [];
        for (let i = 0; i < navMesh.triangles.length; i += 3) {
          const tri = [];
          for (let j = 0; j < 3; j++) {
            const idx = navMesh.triangles[i + j] * 2;
            tri.push({ x: navMesh.points[idx], y: navMesh.points[idx + 1] });
          }
          triangles.push(tri);
        }
        (audit as any).delaunayMesh = triangles;
      }
    }

    return audit;
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
    options: { seed?: number; suppressOutput?: boolean; forceProfiling?: boolean } = {}
  ): Promise<BattleReport> {
    this.resetRunState();
    this.setupPerformanceInstrumentation(options.forceProfiling === true);
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
      if (this.performanceProgressEnabled) {
        console.log(
          `[PROFILE] start mission=${config.missionId} size=${config.gameSize} turns=${config.maxTurns} modelsPerSide=${config.sides.map(s => s.modelCount).join(',')}`
        );
      }

      // Build assemblies
      const sides = await this.withAsyncPhaseTiming(
        'setup.create_assemblies',
        () => Promise.all(config.sides.map(side => this.createAssembly(side)))
      );
      this.initializeModelUsage(config, sides);

      out('Assemblies built:');
      sides.forEach((side, i) => {
        out(`  ${config.sides[i].name}: ${side.characters.length} models, ${side.totalBP} BP`);
      });
      out();

      // Create battlefield
      const battlefield = this.withPhaseTiming(
        'setup.create_battlefield',
        () => this.createBattlefield(config.battlefieldSize, config.densityRatio)
      );
      this.currentBattlefield = battlefield;

      // Deploy models
      this.withPhaseTiming('setup.deploy_models', () => {
        sides.forEach((side, i) => {
          this.deployModels(side, battlefield, i, config.battlefieldSize);
        });
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
        const turnStartedMs = Date.now();
        turn++;
        this.tracker.setTurnsCompleted(turn);
        this.withPhaseTiming('turn.start', () => gameManager.startTurn());
        if (this.missionRuntimeAdapter) {
          const turnStartUpdate = this.withPhaseTiming(
            'turn.mission_start_update',
            () => this.missionRuntimeAdapter!.onTurnStart(turn, this.buildMissionModels(battlefield))
          );
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

        if (this.performanceProgressEnabled) {
          const elapsedRunMs = Date.now() - this.performanceRunStartMs;
          console.log(`[PROFILE] turn-start turn=${turn}/${config.maxTurns} elapsedMs=${elapsedRunMs}`);
        }

        if (verbose) {
          out(`\n📍 Turn ${turn}\n`);
        }

        // Process each side
        for (let sideIndex = 0; sideIndex < config.sides.length; sideIndex++) {
          const sideCharacters = sides[sideIndex].characters
            .filter(c => !c.state.isEliminated && !c.state.isKOd)
            .sort((a, b) => (b.finalAttributes?.int ?? b.attributes?.int ?? 0) - (a.finalAttributes?.int ?? a.attributes?.int ?? 0));

          for (const character of sideCharacters) {
            if (this.performanceProgressEnabled && this.performanceProgressEachActivation) {
              console.log(
                `[PROFILE] activation-start turn=${turn} side=${config.sides[sideIndex].name} model=${character.profile.name}`
              );
            }
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
          const turnEndUpdate = this.withPhaseTiming(
            'turn.mission_end_update',
            () => this.missionRuntimeAdapter!.onTurnEnd(turn, this.buildMissionModels(battlefield))
          );
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

        const turnElapsedMs = Date.now() - turnStartedMs;
        this.performanceTurns.push({
          turn,
          elapsedMs: Number(turnElapsedMs.toFixed(2)),
          activations: turnAudit.activations.length,
        });
        this.recordPhaseDuration('turn.total', turnElapsedMs);
        if (this.performanceProgressEnabled) {
          const elapsedRunMs = Date.now() - this.performanceRunStartMs;
          console.log(
            `[PROFILE] turn-end turn=${turn}/${config.maxTurns} turnMs=${turnElapsedMs} activations=${turnAudit.activations.length} elapsedMs=${elapsedRunMs}`
          );
        }
      }

      if (this.missionRuntimeAdapter) {
        const finalUpdate = this.withPhaseTiming(
          'mission.finalize',
          () => this.missionRuntimeAdapter!.finalize(this.buildMissionModels(battlefield))
        );
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
        stats: this.tracker.getStats(),
        missionRuntime: {
          vpBySide: { ...this.missionVpBySide },
          rpBySide: { ...this.missionRpBySide },
          immediateWinnerSideId: this.missionImmediateWinnerSideId ?? undefined,
          // Predicted scoring for AI planning (R1.5)
          predictedScoring: this.buildPredictedScoring(this.missionSides),
        },
        // Side-level AI strategies (R1.5: God Mode Coordination)
        sideStrategies: this.buildSideStrategies(),
        usage,
        nestedSections: this.buildNestedSections(config, sides, battlefield, startPositions),
        advancedRules: this.tracker.getAdvancedRules(),
        log: this.log,
        audit: this.createBattleAuditTrace(config, seed, battlefield),
        performance: this.buildPerformanceSummary(battlefield),
        seed,
      };

      // Generate and save battlefield SVG
      const svgPath = writeBattlefieldSvg(battlefield, config);
      if (outputEnabled) {
        console.log(`🗺️  Battlefield SVG: ${svgPath}`);
      }

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
          // Melee-only profile: Average with Sword, Broad + Armored Gear + Armor, Light + Shield, Small
          { archetypeName: 'Average', weight: 4, items: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'] },
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

    // Use layered terrain placement
    const result = placeTerrain({
      mode: 'balanced',
      density: densityRatio,
      battlefieldSize: size,
      terrainTypes: ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks', 'Large Rocks'],
    });

    // Store terrain result for export
    this.lastTerrainResult = result;

    // Add placed terrain to battlefield
    for (const terrainFeature of result.terrain) {
      const centroid = this.getCentroid(terrainFeature.vertices);
      // Map terrain type to valid TerrainElement name
      const typeLower = (terrainFeature.id || terrainFeature.type || 'Tree').toLowerCase();
      let terrainName = 'Tree';

      if (typeLower.includes('shrub') || typeLower.includes('bush')) {
        terrainName = 'Shrub';
      } else if (typeLower.includes('rock')) {
        terrainName = Math.random() > 0.5 ? 'Small Rocks' : 'Medium Rocks';
      } else if (typeLower.includes('tree')) {
        terrainName = 'Tree';
      }

      const rotation = Math.floor(Math.random() * 360);
      battlefield.addTerrainElement(new TerrainElement(terrainName, centroid, rotation));
    }

    // Export battlefield.json
    this.battlefieldExportPath = this.exportBattlefield(battlefield, result);

    return battlefield;
  }

  /**
   * Export battlefield to JSON file
   */
  private exportBattlefield(battlefield: Battlefield, result: TerrainPlacementResult): string {
    try {
      const outputDir = join(process.cwd(), 'generated', 'battlefields');
      mkdirSync(outputDir, { recursive: true });
      
      const filePath = exportBattlefield(battlefield, result, outputDir);
      
      console.log(`🗺️  Battlefield exported: ${filePath}`);
      
      return filePath;
    } catch (error) {
      console.error('⚠️  Failed to export battlefield:', error);
      return null;
    }
  }

  private getCentroid(vertices: Position[]): Position {
    if (!vertices || vertices.length === 0) return { x: 0, y: 0 };
    let x = 0, y = 0;
    for (const v of vertices) {
      x += v.x;
      y += v.y;
    }
    return { x: x / vertices.length, y: y / vertices.length };
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
    const activationStartedMs = Date.now();
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
      this.tracker.trackWaitMaintained();
    }
    if (waitUpkeepPaid) {
      this.tracker.trackWaitUpkeepPaid();
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
      const activationElapsedMs = Date.now() - activationStartedMs;
      this.recordPhaseDuration('activation.total', activationElapsedMs);
      this.recordPhaseDuration('activation.no_ap', activationElapsedMs);
      this.performanceActivationSamplesMs.push(activationElapsedMs);
      this.activationsProcessed += 1;
      this.recordSlowActivation({
        turn,
        sideName,
        modelId: character.id,
        modelName: character.profile.name,
        elapsedMs: Number(activationElapsedMs.toFixed(2)),
        steps: 0,
      });
      this.maybeLogActivationHeartbeat(turn, sideName, character, activationElapsedMs);
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

        const aiResult = await this.withAsyncPhaseTiming(
          'ai.decide_action',
          () => aiController.decideAction(context)
        );
        this.tracker.trackDecisionChoiceSet(character, aiResult.debug);
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

        const actionStartedMs = Date.now();
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
                  this.tracker.trackPassiveUsage('OpportunityAttack');
                  this.tracker.trackCombatExtras(opportunity.result);
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
                this.tracker.incrementAction("Move");
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

            this.tracker.trackAttempt(character, 'wait');
            this.tracker.incrementAction("Wait");
            this.stats.waitChoicesTaken++;
            this.tracker.trackWaitSelection('utility');
            const wait = gameManager.executeWait(character, {
              spendAp: true,
              opponents: enemies,
              visibilityOrMu: config.visibilityOrMu,
              allowRevealReposition: false,
            });
            result = wait.success ? 'wait=true' : `wait=false:${wait.reason ?? 'failed'}`;
            stepDetails = { waitResult: this.sanitizeForAudit(wait) as Record<string, unknown> };
            if (wait.success) {
              this.tracker.trackSuccess(character, 'wait');
              this.stats.waitChoicesSucceeded++;
              actionExecuted = true;
            }
            break;
          }
          case 'wait': {
            this.tracker.trackAttempt(character, 'wait');
            this.tracker.incrementAction("Wait");
            this.stats.waitChoicesTaken++;
            this.tracker.trackWaitSelection(decision.planning?.source);
            const wait = gameManager.executeWait(character, {
              spendAp: true,
              opponents: enemies,
              visibilityOrMu: config.visibilityOrMu,
              allowRevealReposition: false,
            });
            result = wait.success ? 'wait=true' : `wait=false:${wait.reason ?? 'failed'}`;
            stepDetails = { waitResult: this.sanitizeForAudit(wait) as Record<string, unknown> };
            if (wait.success) {
              this.tracker.trackSuccess(character, 'wait');
              this.stats.waitChoicesSucceeded++;
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
              this.tracker.incrementAction("Move");
              actionExecuted = true;
              result = 'move=true';
              stepDetails = { moveResult: this.sanitizeForAudit(moved) as Record<string, unknown> };
            } else {
              result = `move=false:${moved.reason ?? 'blocked'}`;
              stepDetails = { moveResult: this.sanitizeForAudit(moved) as Record<string, unknown> };
            }

            const opportunity = (moved as any)?.opportunityAttack;
            if (opportunity?.attacker) {
              this.tracker.trackPassiveUsage('OpportunityAttack');
              this.tracker.trackCombatExtras(opportunity.result);
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
                    this.tracker.trackPassiveUsage('OpportunityAttack');
                    this.tracker.trackCombatExtras(opportunity.result);
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
                  this.tracker.incrementAction("Move");
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
                allies,
                enemies,
                decision.type === 'charge' || movedForEngagement
              );
              actionExecuted = actionExecuted || closeExecuted.executed;
              result = closeExecuted.resultCode;
              if (closeExecuted.executed) {
                this.tracker.incrementAction("CloseCombatAttack");
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
              sideIndex,
              allies,
              enemies
            );
            actionExecuted = ranged.executed;
            result = ranged.result;
            if (ranged.executed) {
              this.tracker.incrementAction("RangedAttack");
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
            this.tracker.incrementAction("Disengage");
            const disengage = await this.executeDisengage(
              character,
              decision.target,
              battlefield,
              gameManager,
              config,
              turn,
              sideIndex,
              allies,
              enemies
            );
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
            this.tracker.trackAttempt(character, 'detect');
            this.tracker.incrementAction("Detect");
            if (!gameManager.spendAp(character, 1)) {
              result = 'detect=false:not-enough-ap';
              break;
            }
            const useLean = this.shouldUseLeanForDetect(character, decision.target, battlefield);
            const detect = attemptDetect(battlefield, character, decision.target, enemies, {
              attackerLeaning: useLean,
            });
            this.tracker.trackSituationalModifiers({ isLeaning: useLean }, undefined);
            if (useLean) {
              this.incrementTypeBreakdown(this.advancedRules.situationalModifiers.byType, 'detect_lean');
            }
            result = detect.success ? 'detect=true' : `detect=false:${detect.reason ?? 'failed'}`;
            stepDetails = {
              detectResult: this.sanitizeForAudit(detect) as Record<string, unknown>,
              leanApplied: useLean,
            };
            if (detect.success) {
              this.tracker.trackSuccess(character, 'detect');
              actionExecuted = true;
            }
            break;
          }
          case 'hide': {
            this.tracker.trackAttempt(character, 'hide');
            this.tracker.incrementAction("Hide");
            const hide = attemptHide(battlefield, character, enemies, (amount: number) => gameManager.spendAp(character, amount));
            result = hide.canHide ? 'hide=true' : `hide=false:${hide.reason ?? 'failed'}`;
            stepDetails = { hideResult: this.sanitizeForAudit(hide) as Record<string, unknown> };
            if (hide.canHide) {
              this.tracker.trackSuccess(character, 'hide');
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
        const actionElapsedMs = Date.now() - actionStartedMs;
        this.recordPhaseDuration(`action.${decision.type}`, actionElapsedMs);
        this.recordPhaseDuration('action.total', actionElapsedMs);

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
          this.tracker.incrementTotalActions();
          const movedDistance = startPos && endPos ? Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y) : 0;
          this.tracker.trackPathMovement(character, movedDistance);
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
          const reactResult = this.withPhaseTiming(
            'react.process',
            () => this.processReacts(character, enemies, gameManager, trigger, movedDistance, config.visibilityOrMu)
          );
          const actorStateAfterReact = this.snapshotModelState(character);
          if (reactResult.executed && reactResult.reactor) {
            this.stats.reactChoicesTaken++;
            this.syncMissionRuntimeForAttack(
              reactResult.reactor,
              character,
              actorStateBeforeReact,
              actorStateAfterReact,
              this.extractDamageResolutionFromUnknown(reactResult.rawResult)
            );
            const reactWounds = this.extractWoundsAddedFromDamageResolution(
              this.extractDamageResolutionFromUnknown(reactResult.rawResult),
              actorStateBeforeReact,
              actorStateAfterReact
            );
            this.tracker.trackReactWoundsInflicted(reactWounds);
            if (reactResult.reactorWasWaiting) {
              this.tracker.trackWaitTriggeredReact();
              this.tracker.trackWaitReactWoundsInflicted(reactWounds);
            }
          }
          if (reactResult.executed) {
            this.stats.reacts++;
            this.tracker.trackPassiveUsage('React');
            if (reactResult.reactor) {
              this.tracker.trackAttempt(reactResult.reactor, 'react');
              this.tracker.trackSuccess(reactResult.reactor, 'react');
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
        if (actionExecuted && decision.type === 'move' && actorStateBefore.isWaiting) {
          this.tracker.trackMovesWhileWaiting();
        }
        if (decision.planning) {
          stepDetails = {
            ...(stepDetails ?? {}),
            planning: this.sanitizeForAudit(decision.planning) as Record<string, unknown>,
          };
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
                this.tracker.trackPassiveUsage('OpportunityAttack');
                this.tracker.trackCombatExtras(opportunity.result);
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
              this.tracker.incrementAction("Move");
              this.tracker.incrementTotalActions();
              this.tracker.trackPathMovement(character, movedDistance);
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
              const reactResult = this.withPhaseTiming(
                'react.process',
                () => this.processReacts(
                  character,
                  enemies,
                  gameManager,
                  movedDistance > 0 ? 'Move' : 'NonMove',
                  movedDistance,
                  config.visibilityOrMu
                )
              );
              if (reactResult.executed && reactResult.reactor) {
                this.stats.reactChoicesTaken++;
                this.syncMissionRuntimeForAttack(
                  reactResult.reactor,
                  character,
                  fallbackStateBeforeReact,
                  this.snapshotModelState(character),
                  this.extractDamageResolutionFromUnknown(reactResult.rawResult)
                );
                const fallbackStateAfterReact = this.snapshotModelState(character);
                const reactWounds = this.extractWoundsAddedFromDamageResolution(
                  this.extractDamageResolutionFromUnknown(reactResult.rawResult),
                  fallbackStateBeforeReact,
                  fallbackStateAfterReact
                );
                this.tracker.trackReactWoundsInflicted(reactWounds);
                if (reactResult.reactorWasWaiting) {
                  this.tracker.trackWaitTriggeredReact();
                  this.tracker.trackWaitReactWoundsInflicted(reactWounds);
                }
              }
              if (reactResult.executed) {
                this.stats.reacts++;
                this.tracker.trackPassiveUsage('React');
                if (reactResult.reactor) {
                  this.tracker.trackAttempt(reactResult.reactor, 'react');
                  this.tracker.trackSuccess(reactResult.reactor, 'react');
                }
              }
              const fallbackStateAfter = this.snapshotModelState(character);
              const fallbackApAfter = gameManager.getApRemaining(character);
              lastKnownAp = fallbackApAfter;
              if (fallbackStateBefore.isWaiting) {
                this.tracker.trackMovesWhileWaiting();
              }
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
    const activationElapsedMs = Date.now() - activationStartedMs;
    this.recordPhaseDuration('activation.total', activationElapsedMs);
    this.performanceActivationSamplesMs.push(activationElapsedMs);
    this.activationsProcessed += 1;
    this.recordSlowActivation({
      turn,
      sideName,
      modelId: character.id,
      modelName: character.profile.name,
      elapsedMs: Number(activationElapsedMs.toFixed(2)),
      steps: activationAudit.steps.length,
    });
    this.maybeLogActivationHeartbeat(turn, sideName, character, activationElapsedMs);
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
    this.tracker.trackReactChoiceWindow(options);
    const choicesGiven = options.filter(option => option.available && option.type === 'StandardReact').length;
    const first = options.find(option => option.available && option.type === 'StandardReact');
    if (!first) {
      return {
        executed: false,
        choiceWindowOffered: choicesGiven > 0,
        choicesGiven,
      };
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
      return {
        executed: false,
        reactor: first.actor,
        reactorWasWaiting: Boolean(first.actor.state.isWaiting),
        choiceWindowOffered: choicesGiven > 0,
        choicesGiven,
      };
    }

    const reactorWasWaiting = Boolean(first.actor.state.isWaiting);
    const reactorPos = gameManager.battlefield?.getCharacterPosition(first.actor);
    const activePos = gameManager.battlefield?.getCharacterPosition(active);
    const react = gameManager.executeStandardReact(first.actor, active, weapon, { visibilityOrMu });
    if (!react.executed) {
      return {
        executed: false,
        reactor: first.actor,
        reactorWasWaiting,
        choiceWindowOffered: choicesGiven > 0,
        choicesGiven,
        details: {
          actorId: first.actor.id,
          targetId: active.id,
          reason: 'standard-react-not-executed',
          reactResult: this.sanitizeForAudit(react) as Record<string, unknown>,
        },
      };
    }
    this.tracker.trackCombatExtras((react as any).result);
    return {
      executed: true,
      reactor: first.actor,
      reactorWasWaiting,
      choiceWindowOffered: choicesGiven > 0,
      choicesGiven,
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

  private hasLos(observer: Character, target: Character, battlefield: Battlefield, captureForAudit: { vectors?: any[] } = null): boolean {
    const observerPos = battlefield.getCharacterPosition(observer);
    const targetPos = battlefield.getCharacterPosition(target);
    if (!observerPos || !targetPos) return false;

    const result = SpatialRules.hasLineOfSight(
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

    // Capture LOS vector for audit visualization
    if (captureForAudit && captureForAudit.vectors) {
      captureForAudit.vectors.push({
        kind: 'los',
        from: { x: observerPos.x, y: observerPos.y },
        to: { x: targetPos.x, y: targetPos.y },
        distanceMu: Math.hypot(targetPos.x - observerPos.x, targetPos.y - observerPos.y),
        success: result
      });
    }

    return result;
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
    allies: Character[],
    opponents: Character[],
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
        this.tracker.trackPassiveUsage('Defend');
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
        allies,
        opponents,
        isCloseCombat: true,
        doctrine: attackerDoctrine,
        isCharge,
      });
      this.tracker.trackCombatExtras(result);
      const normalized = this.normalizeAttackResult(result);

      if (config.verbose) {
        const koStatus = normalized.ko ? 'KO' : 'OK';
        const elimStatus = normalized.eliminated ? 'Elim' : 'Active';
        console.log(`    → Hit: ${normalized.hit}, KO: ${koStatus}, Elim: ${elimStatus}`);
      }

      if (normalized.ko) {
        this.tracker.trackKO();
      }
      if (normalized.eliminated) {
        this.tracker.trackElimination();
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
    sideIndex: number,
    allies: Character[],
    opponents: Character[]
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

      const losCapture = { vectors: [] as any[] };
      if (config.perCharacterFovLos && !this.hasLos(attacker, defender, battlefield, losCapture)) {
        return { executed: false, result: 'ranged=false:no-los', vectors: losCapture.vectors };
      }
      // Add LOS vectors to result
      vectors.push(...losCapture.vectors);

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
        this.tracker.trackPassiveUsage('Defend');
      }
      if (takeCoverPosition) {
        this.tracker.trackPassiveUsage('TakeCover');
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

      this.tracker.trackLOSCheck();
      battlefield.hasLineOfSight(attackerPos, defenderPos);
      this.tracker.trackLOFCheck();
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
        allies,
        opponents,
        isCloseCombat: false,
        doctrine: attackerDoctrine,
      });
      this.tracker.trackCombatExtras(result);
      const normalized = this.normalizeAttackResult(result);
      if (config.verbose) {
        console.log(`    → Hit: ${normalized.hit}, KO: ${normalized.ko}, Elim: ${normalized.eliminated}`);
      }

      if (normalized.ko) {
        this.tracker.trackKO();
      }
      if (normalized.eliminated) {
        this.tracker.trackElimination();
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
    sideIndex: number,
    allies: Character[],
    opponents: Character[]
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
        allies,
        opponents,
        isCloseCombat: true,
        doctrine: disengagerDoctrine,
      });
      this.tracker.trackCombatExtras(result);

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
