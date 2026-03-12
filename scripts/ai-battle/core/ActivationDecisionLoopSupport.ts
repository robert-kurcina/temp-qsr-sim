import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import { CharacterAI } from '../../../src/lib/mest-tactics/ai/core/CharacterAI';
import { AIContext } from '../../../src/lib/mest-tactics/ai/core/AIController';
import { buildActivationLoopBudget } from '../../../src/lib/mest-tactics/ai/executor/ActivationLoopBudget';
import { buildAIContext } from '../../../src/lib/mest-tactics/ai/executor/AIContextBuilder';
import { runAIDecisionCycle } from '../../../src/lib/mest-tactics/ai/executor/AIDecisionCycle';
import { buildCoordinatorContextSlice } from '../../../src/lib/mest-tactics/ai/executor/CoordinatorContext';
import { createEmptyKnowledge } from '../../../src/lib/mest-tactics/ai/executor/Knowledge';
import { buildAIObjectiveMarkerSnapshot } from '../../../src/lib/mest-tactics/ai/executor/ObjectiveMarkerSnapshot';
import { buildPressureTopologySignatureForGameLoop } from '../../../src/lib/mest-tactics/ai/executor/PressureTopologySupport';
import { cloneSideResourceMaps } from '../../../src/lib/mest-tactics/ai/executor/SideResourceSnapshot';
import { updateSideTargetCommitment } from '../../../src/lib/mest-tactics/ai/executor/TargetCommitment';
import { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import type {
  ActionStepAudit,
  ActivationAudit,
  BattleLogEntry,
  GameConfig,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';
import type { ReactAuditResult } from '../validation/ValidationMetrics';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import { normalizeKeyScoresForRunner } from './StrategyReportingSupport';
import { CombatActionResolutionDeps } from './CombatActionResolution';
import { executeActivationDecisionStepForRunner } from './ActivationDecisionStepSupport';
import {
  ActionValidator,
  MoveAndOpportunityResult,
  WaitActionResult,
} from './ActivationDecisionSharedTypes';

interface RunActivationDecisionLoopParams {
  character: Character;
  allSides: { characters: Character[] }[];
  battlefield: Battlefield;
  gameManager: GameManager;
  aiController: CharacterAI;
  turn: number;
  sideIndex: number;
  sideName: string;
  config: GameConfig;
  initialAp: number;
  activationAudit: ActivationAudit;
  missionState: ActivationDecisionLoopMissionState;
  runtime: ActivationDecisionLoopRuntime;
}

export interface ActivationDecisionLoopMissionState {
  missionSides: MissionSide[];
  missionVpBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  sideNameByCharacterId: Map<string, string>;
}

export interface ActivationDecisionLoopRuntime {
  tracker: StatisticsTracker;
  profiler: PerformanceProfiler;
  log: BattleLogEntry[];
  sanitizeForAudit: (value: unknown) => unknown;
  syncMissionRuntimeForAttack: (
    attacker: Character | undefined,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ) => void;
  computeFallbackMovePosition: (
    actor: Character,
    enemies: Character[],
    battlefield: Battlefield
  ) => Position | null;
  maximizeClosingMoveDestination: (
    actor: Character,
    intendedDestination: Position,
    enemies: Character[],
    battlefield: Battlefield
  ) => Position;
  processReacts: (
    active: Character,
    opponents: Character[],
    gameManager: GameManager,
    trigger: 'Move' | 'NonMove',
    movedDistance: number,
    reactingToEngaged: boolean,
    visibilityOrMu: number
  ) => ReactAuditResult;
  trackReactOutcome: (
    reactResult: ReactAuditResult | undefined,
    active: Character,
    actorStateBeforeReact: ModelStateAudit,
    actorStateAfterReact: ModelStateAudit
  ) => void;
  executeMoveAndTrackOpportunity: (
    gameManager: GameManager,
    character: Character,
    destination: Position,
    enemies: Character[],
    actorStateBefore: ModelStateAudit,
    stepInteractions: ActionStepAudit['interactions'],
    stepOpposedTest: OpposedTestAudit | undefined,
    stepDetails: Record<string, unknown> | undefined
  ) => MoveAndOpportunityResult;
  executeWaitAction: (
    character: Character,
    opponents: Character[],
    gameManager: GameManager,
    visibilityOrMu: number,
    selectionSource: string | undefined,
    allowWaitAction: boolean
  ) => WaitActionResult;
  buildCombatActionResolutionDeps: () => CombatActionResolutionDeps;
  processMoveConcludedPassives: (enemies: Character[], movedDistance: number) => void;
  actionValidator: ActionValidator;
}

export async function runActivationDecisionLoopForRunner(
  params: RunActivationDecisionLoopParams
): Promise<{ lastKnownAp: number }> {
  const {
    character,
    allSides,
    battlefield,
    gameManager,
    aiController,
    turn,
    sideIndex,
    sideName,
    config,
    initialAp,
    activationAudit,
    missionState,
    runtime,
  } = params;
  const {
    missionSides,
    missionVpBySide,
    missionRpBySide,
    sideNameByCharacterId,
  } = missionState;
  const allCharacters = allSides.flatMap(side => side.characters);
  const {
    tracker,
    profiler,
    log,
    sanitizeForAudit,
    syncMissionRuntimeForAttack,
    computeFallbackMovePosition,
    maximizeClosingMoveDestination,
    processReacts,
    trackReactOutcome,
    executeMoveAndTrackOpportunity,
    executeWaitAction,
    buildCombatActionResolutionDeps,
    processMoveConcludedPassives,
    actionValidator,
  } = runtime;

  let lastKnownAp = initialAp;

  try {
    const loopBudget = buildActivationLoopBudget({
      maxDecisionAttempts: 8,
      maxStalledDecisions: 3,
    });
    let guard = 0;
    const activationStartMs = Date.now();
    let activationBuildContextMs = 0;
    let activationDecisionCycleMs = 0;
    let activationStepExecutionMs = 0;
    while (guard < loopBudget.maxDecisionAttempts) {
      guard++;
      const apBefore = gameManager.getApRemaining(character);
      const canPushAtZeroAp =
        apBefore === 0 &&
        character.state.isAttentive &&
        !character.state.isKOd &&
        !character.state.isEliminated &&
        !(character.state as any).hasPushedThisInitiative &&
        (character.state.delayTokens ?? 0) === 0;
      if (apBefore <= 0 && !canPushAtZeroAp) {
        break;
      }
      const loopStartMs = Date.now();

      if (loopStartMs - activationStartMs > 5000) {
        console.warn(
          `[DEBUG] ${character.profile.name} activation taking too long: ${loopStartMs - activationStartMs}ms, guard=${guard}, ap=${apBefore}, buildContextMs=${activationBuildContextMs.toFixed(1)}, decisionCycleMs=${activationDecisionCycleMs.toFixed(1)}, stepExecutionMs=${activationStepExecutionMs.toFixed(1)}`
        );
      }

      const allies = allSides[sideIndex].characters.filter(c => c.id !== character.id && !c.state.isEliminated && !c.state.isKOd);
      const enemies = allSides.flatMap((side, i) => i !== sideIndex ? side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd) : []);
      if (enemies.length === 0) {
        break;
      }

      const coordinatorManager = gameManager.getSideCoordinatorManager();
      const sideCoordinator = coordinatorManager?.getCoordinator(sideName);
      const coordinatorSlice = buildCoordinatorContextSlice({
        coordinator: sideCoordinator,
        currentTurn: turn,
        normalizeKeyScores: scores => normalizeKeyScoresForRunner(scores as any),
        includeFractionalPotentialLedger: false,
      });
      const resourceSnapshot = cloneSideResourceMaps(missionVpBySide, missionRpBySide);
      const buildContextStartMs = Date.now();
      const context: AIContext = buildAIContext({
        character,
        allies,
        enemies,
        battlefield,
        currentTurn: turn,
        currentRound: 1,
        apRemaining: apBefore,
        sideId: sideName,
        objectiveMarkers: buildAIObjectiveMarkerSnapshot(gameManager),
        knowledge: createEmptyKnowledge(turn),
        config: aiController.getConfig(),
        vpBySide: resourceSnapshot.vpBySide,
        rpBySide: resourceSnapshot.rpBySide,
        maxTurns: config.maxTurns,
        endGameTurn: config.endGameTurn,
        side: missionSides[sideIndex],
        coordinator: coordinatorSlice,
      });
      const buildContextMs = Date.now() - buildContextStartMs;
      activationBuildContextMs += buildContextMs;
      profiler.recordPhaseDuration('ai.build_context', buildContextMs);

      const aiDecisionStartMs = Date.now();
      const aiResult = runAIDecisionCycle(context, {
        updateKnowledge: () => profiler.withPhaseTiming(
          'ai.update_knowledge',
          () => aiController.updateKnowledge(context)
        ),
        decideAction: () => profiler.withPhaseTiming(
          'ai.decide_action',
          () => aiController.decideAction(context)
        ),
      });
      const aiDecisionMs = Date.now() - aiDecisionStartMs;
      activationDecisionCycleMs += aiDecisionMs;
      profiler.recordPhaseDuration('ai.decision_cycle', aiDecisionMs);
      if (aiDecisionMs > 1000) {
        console.warn(`[DEBUG] AI decision took ${aiDecisionMs}ms for ${character.profile.name}`);
      }
      tracker.trackDecisionChoiceSet(character, aiResult.debug);
      const decision = aiResult.decision;
      if (!decision || decision.type === 'none') {
        if (activationAudit.steps.length === 0) {
          activationAudit.skippedReason = 'no_valid_action';
        }
        break;
      }

      const stepExecutionStartMs = Date.now();
      const stepOutcome = await executeActivationDecisionStepForRunner({
        decision: decision as ActionDecision,
        apBefore,
        character,
        allSides,
        allies,
        enemies,
        battlefield,
        gameManager,
        config,
        sideIndex,
        sideName,
        turn,
        missionSides,
        sideNameByCharacterId,
        activationAudit,
        tracker,
        profiler,
        log,
        actionValidator,
        computeFallbackMovePosition,
        maximizeClosingMoveDestination,
        executeMoveAndTrackOpportunity,
        executeWaitAction,
        buildCombatActionResolutionDeps,
        processMoveConcludedPassives,
        processReacts,
        trackReactOutcome,
        sanitizeForAudit,
        syncMissionRuntimeForAttack,
        onAttackDecision: (target, targetStateAfter, decisionType, actionExecuted) => {
          const sideId = missionSides[sideIndex]?.id ?? sideName;
          const topologySignature = buildPressureTopologySignatureForGameLoop(
            decisionType,
            sideId,
            character,
            target,
            {
              battlefield,
              allCharacters,
              findCharacterSide: model => sideNameByCharacterId.get(model.id) ?? null,
            }
          );
          updateSideTargetCommitment({
            coordinatorHost: gameManager,
            sideId,
            attacker: character,
            target,
            actionType: decisionType,
            actionExecuted,
            turn,
            targetStateAfter,
            topologySignature,
          });
        },
      });
      const stepExecutionMs = Date.now() - stepExecutionStartMs;
      activationStepExecutionMs += stepExecutionMs;
      profiler.recordPhaseDuration('ai.step_execution', stepExecutionMs);

      lastKnownAp = stepOutcome.lastKnownAp;
      if (stepOutcome.continueLoop) {
        continue;
      }
      if (stepOutcome.breakLoop) {
        break;
      }
    }
  } catch (error) {
    if (config.verbose) {
      console.error(`    Error: ${error}`);
    }
  }

  return { lastKnownAp };
}
