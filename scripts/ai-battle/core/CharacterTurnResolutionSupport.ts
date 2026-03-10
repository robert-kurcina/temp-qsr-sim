import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { CharacterAI } from '../../../src/lib/mest-tactics/ai/core/CharacterAI';
import { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import {
  findRepositionForReveal,
  InitiativeHiddenCheckOptions,
} from '../../../src/lib/mest-tactics/status/concealment';
import type {
  ActivationAudit,
  BattleLogEntry,
  BattleStats,
  GameConfig,
  ModelStateAudit,
} from '../../shared/BattleReportTypes';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import { isFreeFromEngagementForRunner } from './MovementPlanningSupport';
import {
  isCoordinatorUrgentForIp,
  type SideCoordinatorSignalForTurn,
} from './CoordinatorSignalTypes';
import {
  ActivationDecisionRuntimeBuildResult,
  buildActivationDecisionRuntimeForRunner,
} from './ActivationDecisionRuntimeBuilder';
import { runActivationDecisionLoopForRunner } from './ActivationDecisionLoopSupport';

interface ResolveCharacterTurnDeps {
  isFreeFromEngagement: (
    character: Character,
    enemies: Character[],
    battlefield: Battlefield
  ) => boolean;
  buildActivationDecisionRuntime: (
    params: Parameters<typeof buildActivationDecisionRuntimeForRunner>[0]
  ) => ActivationDecisionRuntimeBuildResult;
  runActivationDecisionLoop: (
    params: Parameters<typeof runActivationDecisionLoopForRunner>[0]
  ) => Promise<{ lastKnownAp: number }>;
}

const DEFAULT_DEPS: ResolveCharacterTurnDeps = {
  isFreeFromEngagement: isFreeFromEngagementForRunner,
  buildActivationDecisionRuntime: buildActivationDecisionRuntimeForRunner,
  runActivationDecisionLoop: runActivationDecisionLoopForRunner,
};

interface InitiativeRefreshHeuristicParams {
  gameManager: GameManager;
  character: Character;
  side: MissionSide | undefined;
  coordinatorSignal?: SideCoordinatorSignalForTurn;
  missionSides: MissionSide[];
  missionVpBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  enemiesAtStart: Character[];
  battlefield: Battlefield;
  apPerActivation: number;
  turn: number;
  endGameTurn: number;
}

function getClosestEnemyDistanceForRefreshForRunner(
  character: Character,
  enemiesAtStart: Character[],
  battlefield: Battlefield
): number | null {
  const getCharacterPosition = (battlefield as unknown as {
    getCharacterPosition?: (model: Character) => { x: number; y: number } | undefined;
  }).getCharacterPosition;
  if (typeof getCharacterPosition !== 'function') {
    return null;
  }
  const actorPosition = getCharacterPosition.call(battlefield, character);
  if (!actorPosition) {
    return null;
  }
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemiesAtStart) {
    const enemyPosition = getCharacterPosition.call(battlefield, enemy);
    if (!enemyPosition) {
      continue;
    }
    const distance = Math.hypot(enemyPosition.x - actorPosition.x, enemyPosition.y - actorPosition.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
    }
  }
  return Number.isFinite(nearestDistance) ? nearestDistance : null;
}

function shouldSpendInitiativePointForRefreshForRunner(
  params: InitiativeRefreshHeuristicParams
): { shouldSpend: boolean; reason: string } {
  const {
    gameManager,
    character,
    side,
    coordinatorSignal,
    missionSides,
    missionVpBySide,
    missionRpBySide,
    enemiesAtStart,
    battlefield,
    apPerActivation,
    turn,
    endGameTurn,
  } = params;
  if (!side) return { shouldSpend: false, reason: 'missing_side' };
  if ((side.state.initiativePoints ?? 0) < 1) return { shouldSpend: false, reason: 'no_ip' };
  const urgentCoordinator = isCoordinatorUrgentForIp(coordinatorSignal);
  const delayTokens = character.state.delayTokens ?? 0;
  if (delayTokens <= 0) return { shouldSpend: false, reason: 'no_delay' };

  if (delayTokens >= apPerActivation) {
    return { shouldSpend: true, reason: 'activation_unlocked' };
  }

  const nearestEnemyDistance = getClosestEnemyDistanceForRefreshForRunner(character, enemiesAtStart, battlefield);
  const hasMomentumOpportunity = nearestEnemyDistance !== null && nearestEnemyDistance <= 10;
  const canUnlockPushingMomentum = delayTokens === 1
    && !!character.state.isAttentive
    && !character.state.hasPushedThisInitiative
    && hasMomentumOpportunity;

  const mySideId = side.id;
  const myVp = missionVpBySide[mySideId] ?? 0;
  const myRp = missionRpBySide[mySideId] ?? 0;
  let bestOpponentVp = Number.NEGATIVE_INFINITY;
  let bestOpponentRpAtTopVp = Number.NEGATIVE_INFINITY;
  for (const missionSide of missionSides) {
    if (missionSide.id === mySideId) continue;
    const opponentVp = missionVpBySide[missionSide.id] ?? 0;
    const opponentRp = missionRpBySide[missionSide.id] ?? 0;
    if (opponentVp > bestOpponentVp) {
      bestOpponentVp = opponentVp;
      bestOpponentRpAtTopVp = opponentRp;
      continue;
    }
    if (opponentVp === bestOpponentVp && opponentRp > bestOpponentRpAtTopVp) {
      bestOpponentRpAtTopVp = opponentRp;
    }
  }
  const trailingOnScore = Number.isFinite(bestOpponentVp)
    && (myVp < bestOpponentVp || (myVp === bestOpponentVp && myRp < bestOpponentRpAtTopVp));
  const recommendRefreshInitiativeSpend = (gameManager as unknown as {
    recommendRefreshInitiativeSpend?: (
      sideId: string,
      context: {
        currentTurn: number;
        endGameTurn: number;
        availableIp: number;
        delayTokens: number;
        apPerActivation: number;
        hasMomentumOpportunity: boolean;
        canUnlockPushingMomentum: boolean;
        trailingOnScore: boolean;
      }
    ) => { shouldSpend: boolean; reason: string };
  }).recommendRefreshInitiativeSpend;
  if (typeof recommendRefreshInitiativeSpend === 'function') {
    return recommendRefreshInitiativeSpend.call(gameManager, side.id, {
      currentTurn: turn,
      endGameTurn,
      availableIp: side.state.initiativePoints ?? 0,
      delayTokens,
      apPerActivation,
      hasMomentumOpportunity,
      canUnlockPushingMomentum,
      trailingOnScore,
    });
  }

  if (canUnlockPushingMomentum) {
    return {
      shouldSpend: true,
      reason: urgentCoordinator
        ? 'coordinator_unlock_pushing_momentum'
        : 'unlock_pushing_momentum',
    };
  }

  // Two or more delay tokens are always worth clearing if possible.
  if (delayTokens >= 2) {
    return { shouldSpend: true, reason: 'high_delay_stack' };
  }

  if (hasMomentumOpportunity && delayTokens >= 1) {
    return {
      shouldSpend: true,
      reason: urgentCoordinator ? 'coordinator_momentum_window' : 'momentum_window',
    };
  }

  if (!Number.isFinite(bestOpponentVp)) {
    return { shouldSpend: false, reason: 'no_opponents' };
  }

  const nearEndgame = turn >= Math.max(1, endGameTurn - 1);
  if (trailingOnScore && nearEndgame) {
    return { shouldSpend: true, reason: urgentCoordinator ? 'coordinator_score_pressure' : 'score_pressure' };
  }
  if (urgentCoordinator && delayTokens > 0 && hasMomentumOpportunity) {
    return { shouldSpend: true, reason: 'coordinator_tempo_pressure' };
  }
  return { shouldSpend: false, reason: 'no_opportunity' };
}

export interface ResolveCharacterTurnForRunnerParams {
  character: Character;
  allSides: { characters: Character[] }[];
  battlefield: Battlefield;
  gameManager: GameManager;
  aiController: CharacterAI;
  turn: number;
  sideIndex: number;
  config: GameConfig;
  tracker: StatisticsTracker;
  profiler: PerformanceProfiler;
  log: BattleLogEntry[];
  stats: BattleStats;
  missionSides: MissionSide[];
  missionVpBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  coordinatorSignal?: SideCoordinatorSignalForTurn;
  missionSideIds: string[];
  eliminatedBPBySide: Record<string, number>;
  sideNameByCharacterId: Map<string, string>;
  doctrineByCharacterId: Map<string, TacticalDoctrine>;
  getFirstBloodAwarded: () => boolean;
  setFirstBloodAwarded: (value: boolean) => void;
  nextActivationSequence: () => number;
  applyDoctrineLoadoutConfig: (
    aiController: CharacterAI,
    character: Character,
    sideConfig: GameConfig['sides'][number],
    sideIndex: number,
    config: GameConfig
  ) => void;
  sanitizeForAudit: (value: unknown) => unknown;
  syncMissionRuntimeForAttack: (
    attacker: Character | undefined,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ) => void;
  deps?: Partial<ResolveCharacterTurnDeps>;
}

export async function resolveCharacterTurnForRunner(
  params: ResolveCharacterTurnForRunnerParams
): Promise<ActivationAudit | null> {
  const {
    character,
    allSides,
    battlefield,
    gameManager,
    aiController,
    turn,
    sideIndex,
    config,
    tracker,
    profiler,
    log,
    stats,
    missionSides,
    missionVpBySide,
    missionRpBySide,
    coordinatorSignal,
    missionSideIds,
    eliminatedBPBySide,
    sideNameByCharacterId,
    doctrineByCharacterId,
    getFirstBloodAwarded,
    setFirstBloodAwarded,
    nextActivationSequence,
    applyDoctrineLoadoutConfig,
    sanitizeForAudit,
    syncMissionRuntimeForAttack,
  } = params;
  const deps: ResolveCharacterTurnDeps = {
    ...DEFAULT_DEPS,
    ...(params.deps ?? {}),
  };
  const sideConfig = config.sides[sideIndex];
  const sideName = sideConfig.name;
  const activationStartedMs = Date.now();
  const waitAtStart = character.state.isWaiting;
  const delayTokensAtStart = character.state.delayTokens;
  const enemiesAtStart = allSides
    .flatMap((side, index) => (index === sideIndex ? [] : side.characters))
    .filter(enemy => !enemy.state.isEliminated && !enemy.state.isKOd);
  const missionSide = missionSides[sideIndex];
  const refreshDecision = shouldSpendInitiativePointForRefreshForRunner({
    gameManager,
    character,
    side: missionSide,
    coordinatorSignal,
    missionSides,
    missionVpBySide,
    missionRpBySide,
    enemiesAtStart,
    battlefield,
    apPerActivation: gameManager.apPerActivation,
    turn,
    endGameTurn: config.endGameTurn,
  });
  const spentInitiativeOnRefresh = refreshDecision.shouldSpend
    && !!missionSide
    && gameManager.refresh(character, missionSide);
  if (spentInitiativeOnRefresh) {
    log.push({
      turn,
      modelId: character.id,
      side: sideName,
      model: character.profile.name,
      action: 'initiative_refresh',
      detail: `spent 1 IP to remove Delay token (${refreshDecision.reason})`,
      result: 'refresh=true',
    } as any);
  }
  const hiddenInitiativeCheck = (gameManager as unknown as {
    checkHiddenAtInitiativeStart?: (
      character: Character,
      opponents: Character[],
      options?: InitiativeHiddenCheckOptions
    ) => unknown;
  }).checkHiddenAtInitiativeStart;
  if (character.state.isHidden && typeof hiddenInitiativeCheck === 'function') {
    hiddenInitiativeCheck.call(gameManager, character, enemiesAtStart, {
      allowReposition: true,
      revealReposition: findRepositionForReveal,
    });
  }
  const freeAtStart = waitAtStart
    ? deps.isFreeFromEngagement(character, enemiesAtStart, battlefield)
    : true;
  const apAfterDelay = Math.max(0, gameManager.apPerActivation - delayTokensAtStart);
  const initialAp = gameManager.beginActivation(character);
  const waitMaintained = waitAtStart && character.state.isWaiting;
  const waitUpkeepPaid = waitAtStart && !freeAtStart && initialAp < apAfterDelay;
  if (waitMaintained) {
    tracker.trackWaitMaintained();
  }
  if (waitUpkeepPaid) {
    tracker.trackWaitUpkeepPaid();
  }
  const activationAudit: ActivationAudit = {
    activationSequence: nextActivationSequence(),
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
    profiler.recordPhaseDuration('activation.total', activationElapsedMs);
    profiler.recordPhaseDuration('activation.no_ap', activationElapsedMs);
    profiler.sampleActivationLatency(activationElapsedMs);
    profiler.incrementActivationsProcessed();
    profiler.recordSlowActivation({
      turn,
      sideName,
      modelId: character.id,
      modelName: character.profile.name,
      elapsedMs: Number(activationElapsedMs.toFixed(2)),
      steps: 0,
    });
    profiler.logHeartbeat(turn, sideName, character.profile.name, activationElapsedMs);
    return activationAudit;
  }

  applyDoctrineLoadoutConfig(aiController, character, sideConfig, sideIndex, config);
  const { missionState, runtime } = deps.buildActivationDecisionRuntime({
    character,
    sideIndex,
    config,
    battlefield,
    gameManager,
    tracker,
    profiler,
    log,
    stats,
    missionSides,
    missionVpBySide,
    missionRpBySide,
    missionSideIds,
    eliminatedBPBySide,
    sideNameByCharacterId,
    doctrineByCharacterId,
    sanitizeForAudit,
    syncMissionRuntimeForAttack,
    getFirstBloodAwarded,
    setFirstBloodAwarded,
  });

  const { lastKnownAp } = await deps.runActivationDecisionLoop({
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
  });

  if (activationAudit.steps.length === 0 && !activationAudit.skippedReason) {
    activationAudit.skippedReason = 'no_executed_steps';
  }
  activationAudit.apEnd = lastKnownAp;
  gameManager.endActivation(character);
  const activationElapsedMs = Date.now() - activationStartedMs;
  profiler.recordPhaseDuration('activation.total', activationElapsedMs);
  profiler.sampleActivationLatency(activationElapsedMs);
  profiler.incrementActivationsProcessed();
  profiler.recordSlowActivation({
    turn,
    sideName,
    modelId: character.id,
    modelName: character.profile.name,
    elapsedMs: Number(activationElapsedMs.toFixed(2)),
    steps: activationAudit.steps.length,
  });
  profiler.logHeartbeat(turn, sideName, character.profile.name, activationElapsedMs);
  return activationAudit;
}
