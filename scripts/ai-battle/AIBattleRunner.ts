/**
 * AI Battle Runner
 *
 * Main battle execution class for AI vs AI battles.
 * Handles all battle logic including AI decisions, combat resolution, and reporting.
 */

import { Character } from '../../src/lib/mest-tactics/core/Character';
import { Battlefield, type BattlefieldLosCacheStats } from '../../src/lib/mest-tactics/battlefield/Battlefield';
import { GameManager } from '../../src/lib/mest-tactics/engine/GameManager';
import { Position } from '../../src/lib/mest-tactics/battlefield/Position';
import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { MissionSide } from '../../src/lib/mest-tactics/mission/MissionSide';
import {
  createMissionRuntimeAdapter,
  MissionRuntimeAdapter,
} from '../../src/lib/mest-tactics/missions/mission-runtime-adapter';
import {
  TacticalDoctrine,
  TACTICAL_DOCTRINE_INFO,
  getDoctrinesByEngagement,
  deriveDoctrineAIPressure,
  getDoctrineComponents,
} from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { CharacterAI } from '../../src/lib/mest-tactics/ai/core/CharacterAI';
import { AIControllerConfig, AIResult, CharacterKnowledge } from '../../src/lib/mest-tactics/ai/core/AIController';
import {
  LightingCondition,
  getVisibilityOrForLighting,
} from '../../src/lib/mest-tactics/utils/visibility';
import type { GameConfig, SideConfig, BattleReport, BattleStats, AdvancedRuleMetrics, BattleLogEntry, NestedSections, UsageMetrics, ModelUsageStats, BattleAuditTrace, TurnAudit, ActivationAudit, ActionStepAudit, ModelEffectAudit, OpposedTestAudit, AuditVector, ModelStateAudit, BattlePerformanceSummary, PhaseTimingSummary, TurnTimingSummary, SlowActivationSummary } from '../shared/BattleReportTypes';
import { GAME_SIZE_CONFIG } from '../shared/AIBattleConfig';
import { getMissionDeploymentProfile } from '../../src/lib/mest-tactics/missions/mission-deployment';
import {
  sanitizeForAudit,
  snapshotModelState,
} from './reporting/BattleAuditHelpers';
import { createEmptyStats, createEmptyAdvancedRuleMetrics, safeRate, createSeededRandom } from './validation/ValidationMetrics';
import { StatisticsTracker } from './tracking/StatisticsTracker';
import { PerformanceProfiler } from './instrumentation/PerformanceProfiler';
import { getDefaultSimpleBattlefieldPath, normalizeGameSizeSegment } from '../shared/BattlefieldPaths';
import {
  createBattlefieldWithTerrain,
  deployModels as deployModelsIntoBattlefield,
  loadBattlefieldFromPath,
  type TerrainPlacementResult,
} from './core/BattlefieldSetup';
import { createAssemblyForRunner } from './core/AssemblyBuilderSupport';

import {
  extractWoundsAddedFromDamageResolutionForRunner,
} from './core/CombatRuntimeSupport';

import {
  getLoadoutProfile,
} from './core/CombatExecutor';
import { createAiControllersForRunner } from './core/AIControllerSetup';
import { resolveCharacterTurnForRunner } from './core/CharacterTurnResolutionSupport';
import { applyMissionEndScoringForRunner } from './core/MissionEndScoringSupport';
import { runBattleTurnCycleForRunner } from './core/BattleTurnCycleSupport';
import {
  buildBattleReportForRunner,
  emitBattleReportOutputForRunner,
} from './reporting/BattleReportFinalizationSupport';

import {
  createMissionRuntimeState,
  initializeMissionRuntimeAdapter,
  type MissionRuntimeState,
} from './core/MissionRuntimeIntegration';
import {
  applyMissionRuntimeUpdateForRunner,
  applyMissionStartOverridesForRunner,
  buildMissionModelsForRunner,
  createMissionSidesForRunner,
  findCharacterPositionForRunner,
  syncMissionRuntimeForAttackForRunner,
} from './core/MissionRuntimeSupport';

export class AIBattleRunner {
  private log: BattleLogEntry[] = [];
  private tracker: StatisticsTracker = new StatisticsTracker();
  private profiler: PerformanceProfiler = new PerformanceProfiler();
  private modelUsageByCharacter = new Map<Character, ModelUsageStats>();
  private sideNameByCharacterId = new Map<string, string>();
  private doctrineByCharacterId = new Map<string, TacticalDoctrine>();

  // Mission runtime state (using new module)
  private missionRuntimeState: MissionRuntimeState = createMissionRuntimeState();
  private missionSides: MissionSide[] = [];
  private missionRuntimeAdapter: MissionRuntimeAdapter | null = null;
  private missionSideIds: string[] = [];
  private missionVpBySide: Record<string, number> = {};
  private missionRpBySide: Record<string, number> = {};
  private eliminatedBPBySide: Record<string, number> = {};  // For Elimination Key (QSR MEST.Tactics.Missions.txt)
  private missionImmediateWinnerSideId: string | null = null;
  private firstBloodAwarded: boolean = false;
  private stats: BattleStats = createEmptyStats();
  private advancedRules: AdvancedRuleMetrics = createEmptyAdvancedRuleMetrics();

  private currentBattlefield: Battlefield | null = null;
  private currentGameManager: GameManager | null = null;
  private auditTurns: TurnAudit[] = [];
  private activationSequence = 0;
  private lastTerrainResult: TerrainPlacementResult | null = null;
  private battlefieldExportPath: string | null = null;
  private currentGameSize: string | null = null;

  private resetRunState() {
    this.log = [];
    this.tracker = new StatisticsTracker();
    this.profiler = new PerformanceProfiler();
    this.modelUsageByCharacter = new Map<Character, ModelUsageStats>();
    this.sideNameByCharacterId = new Map<string, string>();
    this.doctrineByCharacterId = new Map<string, TacticalDoctrine>();
    this.missionRuntimeState = createMissionRuntimeState();
    this.missionSides = [];
    this.missionRuntimeAdapter = null;
    this.currentBattlefield = null;
    this.currentGameManager = null;
    this.lastTerrainResult = null;
    this.battlefieldExportPath = null;
    this.currentGameSize = null;
    this.auditTurns = [];
    this.activationSequence = 0;
    this.stats = createEmptyStats();
    this.advancedRules = createEmptyAdvancedRuleMetrics();
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

  private syncMissionRuntimeForAttack(
    attacker: Character | undefined,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ): void {
    syncMissionRuntimeForAttackForRunner({
      missionRuntimeAdapter: this.missionRuntimeAdapter,
      attacker,
      target,
      targetStateBefore,
      targetStateAfter,
      damageResolution,
      sideNameByCharacterId: this.sideNameByCharacterId,
      extractWoundsAddedFromDamageResolution: (
        value,
        beforeState,
        afterState
      ) => extractWoundsAddedFromDamageResolutionForRunner(value, beforeState, afterState),
      applyMissionRuntimeUpdate: update => this.applyMissionRuntimeDelta(update),
      findCharacterPosition: character =>
        findCharacterPositionForRunner({
          character,
          currentBattlefield: this.currentBattlefield,
          missionSides: this.missionSides,
        }),
    });
  }

  private applyMissionRuntimeDelta(update: unknown): void {
    const result = applyMissionRuntimeUpdateForRunner({
      update: update as any,
      missionSideIds: this.missionSideIds,
      missionVpBySide: this.missionVpBySide,
      missionRpBySide: this.missionRpBySide,
      missionImmediateWinnerSideId: this.missionImmediateWinnerSideId,
    });
    this.missionVpBySide = result.missionVpBySide;
    this.missionRpBySide = result.missionRpBySide;
    this.missionImmediateWinnerSideId = result.missionImmediateWinnerSideId;
  }

  private deriveEliminationKeyBpBySide(): Record<string, number> {
    const fallback = { ...this.eliminatedBPBySide };
    if (this.missionSides.length !== 2) {
      return fallback;
    }

    const [sideA, sideB] = this.missionSides;
    const sumCasualtyBp = (side: MissionSide): number =>
      side.members.reduce((total, member) => {
        const isCasualty = member.character.state.isKOd || member.character.state.isEliminated;
        if (!isCasualty) {
          return total;
        }
        return total + (member.profile?.totalBp ?? 0);
      }, 0);

    // In two-side missions, KO/Eliminated BP on one side is attributable to the opposing side.
    return {
      ...fallback,
      [sideA.id]: sumCasualtyBp(sideB),
      [sideB.id]: sumCasualtyBp(sideA),
    };
  }

  private applyDoctrineLoadoutConfig(
    aiController: CharacterAI,
    character: Character,
    sideConfig: SideConfig,
    sideIndex: number,
    config: GameConfig
  ) {
    const loadoutProfile = getLoadoutProfile(character);
    const pressure = deriveDoctrineAIPressure(sideConfig.tacticalDoctrine, loadoutProfile);
    const doctrineComponents = getDoctrineComponents(sideConfig.tacticalDoctrine);
    const defenderAtIndexZero = new Set(['QAI_13', 'QAI_16', 'QAI_18', 'QAI_19', 'QAI_20']);
    const missionRole: 'attacker' | 'defender' | 'neutral' = defenderAtIndexZero.has(config.missionId)
      ? (sideIndex === 0 ? 'defender' : 'attacker')
      : 'neutral';
    aiController.setConfig({
      aggression: pressure.aggression,
      caution: pressure.caution,
      visibilityOrMu: config.visibilityOrMu,
      maxOrm: config.maxOrm,
      allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
      perCharacterFovLos: config.perCharacterFovLos,
      allowWaitAction: config.allowWaitAction ?? true,
      allowHideAction: config.allowHideAction ?? true,
      gameSize: config.gameSize,
      missionId: config.missionId,
      missionRole,
      doctrineEngagement: doctrineComponents.engagement,
      doctrinePlanning: doctrineComponents.planning,
      doctrineAggression: doctrineComponents.aggression,
    });
  }

  private sanitizeForAudit(
    value: unknown,
    depth: number = 0,
    seen: WeakSet<object> = new WeakSet<object>()
  ): unknown {
    return sanitizeForAudit(
      value,
      {
        snapshotModelState,
        resolveSideName: (characterId) => this.sideNameByCharacterId.get(characterId),
      },
      depth,
      seen
    );
  }

  async runBattle(
    config: GameConfig,
    options: { seed?: number; suppressOutput?: boolean; forceProfiling?: boolean } = {}
  ): Promise<BattleReport> {
    this.resetRunState();
    this.currentGameSize = normalizeGameSizeSegment(String(config.gameSize));
    this.profiler.setupFromEnvironment(options.forceProfiling === true);
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
      // Default to false for performance - enable via config.verbose for debugging
      const verbose = false;
      const auditLevel = config.auditLevel ?? ((config.viewer || config.audit) ? 'full' : 'none');
      const detailedAuditEnabled = auditLevel === 'full';

      out('\n⚔️  Starting Battle\n');
      out(`Mission: ${config.missionName}`);
      out(`Battlefield: ${config.battlefieldWidth}×${config.battlefieldHeight} MU`);
      out(`Max Turns: ${config.maxTurns}\n`);
      const profilerConfig = this.profiler.getConfig();
      if (profilerConfig.progressEnabled) {
        console.log(
          `[PROFILE] start mission=${config.missionId} size=${config.gameSize} turns=${config.maxTurns} modelsPerSide=${config.sides.map(s => s.modelCount).join(',')}`
        );
      }

      // Build assemblies
      const sides = await this.profiler.withAsyncPhaseTiming(
        'setup.create_assemblies',
        () => Promise.all(config.sides.map(side => createAssemblyForRunner(side)))
      );
      this.initializeModelUsage(config, sides);

      out('Assemblies built:');
      sides.forEach((side, i) => {
        out(`  ${config.sides[i].name}: ${side.characters.length} models, ${side.totalBP} BP`);
      });
      out();

      const resolvedBattlefieldPath = config.battlefieldPath ?? getDefaultSimpleBattlefieldPath(String(config.gameSize));
      if (!config.battlefieldPath && resolvedBattlefieldPath) {
        out(`Using default battlefield: ${resolvedBattlefieldPath}`);
      }

      // Create battlefield using canonical rectangular dimensions.
      const battlefield = this.profiler.withPhaseTiming(
        resolvedBattlefieldPath ? 'setup.load_battlefield' : 'setup.create_battlefield',
        () => {
          if (resolvedBattlefieldPath) {
            return loadBattlefieldFromPath(resolvedBattlefieldPath);
          }
          const generated = createBattlefieldWithTerrain(
            config.battlefieldWidth,
            config.battlefieldHeight,
            config.densityRatio,
            this.currentGameSize ?? 'UNKNOWN'
          );
          this.lastTerrainResult = generated.terrainResult;
          this.battlefieldExportPath = generated.exportPath;
          return generated.battlefield;
        }
      );
      this.currentBattlefield = battlefield;
      if (resolvedBattlefieldPath) {
        this.battlefieldExportPath = resolvedBattlefieldPath;
      }

      // Deploy models
      this.profiler.withPhaseTiming('setup.deploy_models', () => {
        const deploymentProfile = getMissionDeploymentProfile(config.missionId, config.gameSize);
        sides.forEach((side, i) => {
          const deploymentDepth = Math.max(
            1,
            deploymentProfile.deploymentDepth || GAME_SIZE_CONFIG[config.gameSize]?.deploymentDepth || 6
          );
          deployModelsIntoBattlefield(
            side,
            battlefield,
            i,
            config.battlefieldWidth,
            config.battlefieldHeight,
            deploymentDepth,
            deploymentProfile.deploymentType
          );
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
      this.currentGameManager = gameManager;
      this.missionSides = createMissionSidesForRunner(config, sides);
      gameManager.setSides(this.missionSides);
      const sideDoctrines = new Map<string, TacticalDoctrine>();
      for (let sideIndex = 0; sideIndex < this.missionSides.length; sideIndex++) {
        const sideId = this.missionSides[sideIndex].id;
        const doctrine = config.sides[sideIndex]?.tacticalDoctrine ?? TacticalDoctrine.Operative;
        sideDoctrines.set(sideId, doctrine);
      }
      gameManager.initializeSideCoordinators(this.missionSides, sideDoctrines);
      this.missionSideIds = this.missionSides.map(side => side.id);
      this.missionVpBySide = Object.fromEntries(this.missionSideIds.map(sideId => [sideId, 0]));
      this.missionRpBySide = Object.fromEntries(this.missionSideIds.map(sideId => [sideId, 0]));
      this.eliminatedBPBySide = Object.fromEntries(this.missionSideIds.map(sideId => [sideId, 0]));  // For Elimination Key
      this.missionRuntimeAdapter = createMissionRuntimeAdapter(config.missionId, this.missionSides);
      gameManager.setMissionRuntimeAdapter(this.missionRuntimeAdapter);
      applyMissionStartOverridesForRunner(
        config,
        sides,
        character => gameManager.setWaiting(character)
      );

      const aiControllers = createAiControllersForRunner(config, sides);

      await runBattleTurnCycleForRunner({
        config,
        sides,
        battlefield,
        gameManager,
        missionSides: this.missionSides,
        missionRuntimeAdapter: this.missionRuntimeAdapter,
        getMissionImmediateWinnerSideId: () => this.missionImmediateWinnerSideId,
        log: this.log,
        tracker: this.tracker,
        profiler: this.profiler,
        auditTurns: this.auditTurns,
        applyMissionRuntimeDelta: update => this.applyMissionRuntimeDelta(update),
        resolveCharacterTurn: async ({ character, turn, sideIndex, coordinatorSignal }) => {
          const aiController = aiControllers.get(character.id)!;
          return resolveCharacterTurnForRunner({
            character,
            allSides: sides,
            battlefield,
            gameManager,
            aiController,
            turn,
            sideIndex,
            coordinatorSignal,
            config: { ...config, verbose },
            tracker: this.tracker,
            profiler: this.profiler,
            log: this.log,
            stats: this.stats,
            missionSides: this.missionSides,
            missionVpBySide: this.missionVpBySide,
            missionRpBySide: this.missionRpBySide,
            missionSideIds: this.missionSideIds,
            eliminatedBPBySide: this.eliminatedBPBySide,
            sideNameByCharacterId: this.sideNameByCharacterId,
            doctrineByCharacterId: this.doctrineByCharacterId,
            getFirstBloodAwarded: () => this.firstBloodAwarded,
            setFirstBloodAwarded: value => {
              this.firstBloodAwarded = value;
            },
            nextActivationSequence: () => ++this.activationSequence,
            applyDoctrineLoadoutConfig: (controller, active, activeSideConfig, activeSideIndex, runConfig) =>
              this.applyDoctrineLoadoutConfig(controller, active, activeSideConfig, activeSideIndex, runConfig),
            sanitizeForAudit: detailedAuditEnabled
              ? (value => this.sanitizeForAudit(value))
              : ((_value: unknown) => undefined),
            syncMissionRuntimeForAttack: (
              attacker,
              target,
              targetStateBefore,
              targetStateAfter,
              damageResolution
            ) => this.syncMissionRuntimeForAttack(
              attacker,
              target,
              targetStateBefore,
              targetStateAfter,
              damageResolution
            ),
          });
        },
        verbose,
        out,
      });

      if (this.missionRuntimeAdapter) {
        const finalUpdate = this.profiler.withPhaseTiming(
          'mission.finalize',
          () => this.missionRuntimeAdapter!.finalize(
            buildMissionModelsForRunner(battlefield, this.missionSides) as any
          )
        );
        this.applyMissionRuntimeDelta(finalUpdate);
      }

      const eliminationKeyBpBySide = this.deriveEliminationKeyBpBySide();
      const scoring = applyMissionEndScoringForRunner({
        missionVpBySide: this.missionVpBySide,
        missionRpBySide: this.missionRpBySide,
        eliminatedBPBySide: eliminationKeyBpBySide,
      });
      this.missionVpBySide = scoring.missionVpBySide;
      if (config.verbose && scoring.eliminationKeyWinner) {
        const winner = scoring.eliminationKeyWinner;
        out(`\n🏆 Elimination Key: ${winner.sideId} wins +1 VP (eliminated ${winner.eliminatedBP} BP worth of enemies)`);
      }
      if (config.verbose && scoring.rpKeyAward) {
        const award = scoring.rpKeyAward;
        if (award.totalVpAwarded === 2) {
          out(`🏆 RP Dominance: ${award.sideId} wins +2 VP (${award.topRp} RP vs ${award.secondRp} RP, margin ${award.rpMargin})`);
        } else {
          out(`🏆 RP Key: ${award.sideId} wins +1 VP (${award.topRp} RP vs ${award.secondRp} RP)`);
        }
      }

      const report = buildBattleReportForRunner({
        config,
        sides,
        battlefield,
        startPositions,
        missionSides: this.missionSides,
        missionImmediateWinnerSideId: this.missionImmediateWinnerSideId,
        missionVpBySide: this.missionVpBySide,
        missionRpBySide: this.missionRpBySide,
        currentGameManager: this.currentGameManager,
        doctrineByCharacterId: this.doctrineByCharacterId,
        tracker: this.tracker,
        log: this.log,
        auditTurns: this.auditTurns,
        battlefieldExportPath: this.battlefieldExportPath,
        profiler: this.profiler,
        aiControllers,
        modelUsageByCharacter: this.modelUsageByCharacter,
        seed,
        auditLevel,
      });

      emitBattleReportOutputForRunner({
        report,
        battlefield,
        config,
        outputEnabled,
      });

      return report;
    } finally {
      if (typeof seed === 'number') {
        Math.random = originalRandom;
      }
    }
  }

}

// ============================================================================
