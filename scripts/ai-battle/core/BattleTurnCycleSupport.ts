import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { CharacterStatus } from '../../../src/lib/mest-tactics/core/types';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import { MissionRuntimeAdapter } from '../../../src/lib/mest-tactics/missions/mission-runtime-adapter';
import type {
  ActivationAudit,
  BattleLogEntry,
  GameConfig,
  TurnAudit,
} from '../../shared/BattleReportTypes';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import { buildMissionModelsForRunner } from './MissionRuntimeSupport';
import {
  isCoordinatorDefensiveForIp,
  isCoordinatorUrgentForIp,
  type SideCoordinatorSignalForTurn,
} from './CoordinatorSignalTypes';
import {
  buildTurnCoordinatorDecisionsForRunner,
  normalizeKeyScoresForRunner,
} from './StrategyReportingSupport';
import {
  normalizeSideStrategy,
  selectCurrentTurnTrace,
} from './CoordinatorTraceSerialization';

interface BattleTurnCycleParams {
  config: GameConfig;
  sides: Array<{ characters: Character[] }>;
  battlefield: Battlefield;
  gameManager: GameManager;
  missionSides: MissionSide[];
  missionRuntimeAdapter: MissionRuntimeAdapter | null;
  getMissionImmediateWinnerSideId: () => string | null;
  log: BattleLogEntry[];
  tracker: StatisticsTracker;
  profiler: PerformanceProfiler;
  auditTurns: TurnAudit[];
  applyMissionRuntimeDelta: (update: unknown) => void;
  resolveCharacterTurn: (args: {
    character: Character;
    turn: number;
    sideIndex: number;
    coordinatorSignal?: SideCoordinatorSignalForTurn;
  }) => Promise<ActivationAudit | null>;
  verbose: boolean;
  out: (...args: unknown[]) => void;
}

function buildSideCoordinatorSignalsForTurn(
  managerStrategies: Record<string, unknown> | undefined,
  currentTurn: number
): Map<string, SideCoordinatorSignalForTurn> {
  const signals = new Map<string, SideCoordinatorSignalForTurn>();
  if (!managerStrategies || Object.keys(managerStrategies).length === 0) {
    return signals;
  }

  for (const [sideId, strategy] of Object.entries(managerStrategies)) {
    if (!strategy) continue;
    const normalized = normalizeSideStrategy(sideId, strategy);
    const trace = selectCurrentTurnTrace(normalized.decisionTrace, currentTurn);
    signals.set(sideId, {
      sideId,
      amILeading: trace?.observations.amILeading ?? normalized.context?.amILeading ?? false,
      vpMargin: trace?.observations.vpMargin ?? normalized.context?.vpMargin ?? 0,
      priority: String(trace?.response.priority ?? 'neutral'),
      potentialDirective: trace?.response.potentialDirective,
      pressureDirective: trace?.response.pressureDirective,
      urgency: Number(trace?.observations.fractionalPotential?.urgency ?? 0),
    });
  }
  return signals;
}

function buildSideCoordinatorSignalsFromCoordinatorManager(
  sideInitiativeSignals: Record<string, unknown> | undefined
): Map<string, SideCoordinatorSignalForTurn> {
  const signals = new Map<string, SideCoordinatorSignalForTurn>();
  if (!sideInitiativeSignals || Object.keys(sideInitiativeSignals).length === 0) {
    return signals;
  }

  for (const [sideId, rawSignal] of Object.entries(sideInitiativeSignals)) {
    const signal = (rawSignal ?? {}) as Record<string, unknown>;
    signals.set(sideId, {
      sideId: String(signal.sideId ?? sideId),
      amILeading: Boolean(signal.amILeading),
      vpMargin: Number(signal.vpMargin ?? 0),
      priority: String(signal.priority ?? 'neutral'),
      potentialDirective: typeof signal.potentialDirective === 'string'
        ? signal.potentialDirective
        : undefined,
      pressureDirective: typeof signal.pressureDirective === 'string'
        ? signal.pressureDirective
        : undefined,
      urgency: Number(signal.urgency ?? 0),
    });
  }
  return signals;
}

function getClosestEnemyDistanceForRunner(
  character: Character,
  opponents: Character[],
  battlefield: Battlefield
): number | null {
  const getCharacterPosition = (battlefield as unknown as {
    getCharacterPosition?: (model: Character) => { x: number; y: number } | undefined;
  }).getCharacterPosition;
  if (typeof getCharacterPosition !== 'function') {
    return null;
  }
  const characterPosition = getCharacterPosition.call(battlefield, character);
  if (!characterPosition) {
    return null;
  }
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const opponent of opponents) {
    if (opponent.state.isEliminated || opponent.state.isKOd) {
      continue;
    }
    const opponentPosition = getCharacterPosition.call(battlefield, opponent);
    if (!opponentPosition) {
      continue;
    }
    const distance = Math.hypot(opponentPosition.x - characterPosition.x, opponentPosition.y - characterPosition.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
    }
  }
  return Number.isFinite(nearestDistance) ? nearestDistance : null;
}

function hasMomentumOpportunityForRunner(
  character: Character,
  opponents: Character[],
  battlefield: Battlefield
): boolean {
  const nearestEnemyDistance = getClosestEnemyDistanceForRunner(character, opponents, battlefield);
  return nearestEnemyDistance !== null && nearestEnemyDistance <= 10;
}

function scoreInitiativeOpportunityForRunner(
  character: Character,
  opponents: Character[],
  battlefield: Battlefield
): { score: number; nearestEnemyDistance: number | null } {
  const nearestEnemyDistance = getClosestEnemyDistanceForRunner(character, opponents, battlefield);
  const initiative = character.finalAttributes?.int ?? character.attributes?.int ?? 0;
  const delayTokens = character.state.delayTokens ?? 0;
  const canPush = delayTokens === 0
    && !!character.state.isAttentive
    && !character.state.hasPushedThisInitiative;
  let score = initiative;
  if (nearestEnemyDistance !== null) {
    if (nearestEnemyDistance <= 4) score += 120;
    else if (nearestEnemyDistance <= 8) score += 80;
    else if (nearestEnemyDistance <= 12) score += 40;
    else score += 10;
  }
  if (canPush) score += 20;
  if (delayTokens > 0) score -= 15;
  if (character.state.isWaiting) score -= 20;
  return { score, nearestEnemyDistance };
}

function buildReadyActivationOrderForRunner(
  gameManager: GameManager
): Character[] {
  const activationOrder = (gameManager as unknown as {
    activationOrder?: Character[];
  }).activationOrder;
  if (!Array.isArray(activationOrder)) {
    return [];
  }
  const getCharacterStatus = (gameManager as unknown as {
    getCharacterStatus?: (characterId: string) => CharacterStatus | undefined;
  }).getCharacterStatus;
  if (typeof getCharacterStatus !== 'function') {
    return activationOrder.filter(character => !character.state.isEliminated && !character.state.isKOd);
  }
  return activationOrder.filter(character =>
    !character.state.isEliminated
    && !character.state.isKOd
    && getCharacterStatus.call(gameManager, character.id) === CharacterStatus.Ready
  );
}

function attemptForceInitiativeForRunner(args: {
  turn: number;
  config: GameConfig;
  sides: Array<{ characters: Character[] }>;
  missionSides: MissionSide[];
  coordinatorSignalsBySideId: Map<string, SideCoordinatorSignalForTurn>;
  battlefield: Battlefield;
  gameManager: GameManager;
  sideIndexByCharacterId: Map<string, number>;
  log: BattleLogEntry[];
}): boolean {
  const {
    turn,
    config,
    sides,
    missionSides,
    coordinatorSignalsBySideId,
    battlefield,
    gameManager,
    sideIndexByCharacterId,
    log,
  } = args;
  const forceInitiative = (gameManager as unknown as {
    forceInitiative?: (character: Character, side?: MissionSide) => boolean;
  }).forceInitiative;
  if (typeof forceInitiative !== 'function') {
    return false;
  }
  const readyOrder = buildReadyActivationOrderForRunner(gameManager);
  if (readyOrder.length < 2) {
    return false;
  }

  const front = readyOrder[0];
  const frontSideIndex = sideIndexByCharacterId.get(front.id);
  if (frontSideIndex === undefined) {
    return false;
  }
  const frontOpponents = sides
    .flatMap((entry, index) => (index === frontSideIndex ? [] : entry.characters))
    .filter(character => !character.state.isEliminated && !character.state.isKOd);
  const frontAssessment = scoreInitiativeOpportunityForRunner(front, frontOpponents, battlefield);

  let bestCandidate: null | {
    character: Character;
    side: MissionSide;
    sideIndex: number;
    sideName: string;
    readyIndex: number;
    scoreGain: number;
    reason: string;
  } = null;
  const nearEndgame = turn >= Math.max(1, config.endGameTurn - 1);
  const scanLimit = Math.min(readyOrder.length, 6);

  for (let readyIndex = 1; readyIndex < scanLimit; readyIndex += 1) {
    const candidate = readyOrder[readyIndex];
    const candidateSideIndex = sideIndexByCharacterId.get(candidate.id);
    if (candidateSideIndex === undefined) continue;
    const side = missionSides[candidateSideIndex];
    if (!side) continue;
    const availableIp = side.state.initiativePoints ?? 0;
    if (availableIp < 1) continue;

    const candidateOpponents = sides
      .flatMap((entry, index) => (index === candidateSideIndex ? [] : entry.characters))
      .filter(character => !character.state.isEliminated && !character.state.isKOd);
    const candidateAssessment = scoreInitiativeOpportunityForRunner(candidate, candidateOpponents, battlefield);
    const scoreGain = candidateAssessment.score - frontAssessment.score;
    const candidateCanPush = (candidate.state.delayTokens ?? 0) === 0
      && !!candidate.state.isAttentive
      && !candidate.state.hasPushedThisInitiative;
    const recommendForceInitiativeSpend = (gameManager as unknown as {
      recommendForceInitiativeSpend?: (
        sideId: string,
        context: {
          currentTurn: number;
          endGameTurn: number;
          availableIp: number;
          readyIndex: number;
          scoreGain: number;
          candidateNearestEnemyDistance: number | null;
          candidateCanPush: boolean;
        }
      ) => { shouldSpend: boolean; reason: string };
    }).recommendForceInitiativeSpend;
    const coordinatorDecision = typeof recommendForceInitiativeSpend === 'function'
      ? recommendForceInitiativeSpend.call(gameManager, side.id, {
          currentTurn: turn,
          endGameTurn: config.endGameTurn,
          availableIp,
          readyIndex,
          scoreGain,
          candidateNearestEnemyDistance: candidateAssessment.nearestEnemyDistance,
          candidateCanPush,
        })
      : null;
    const shouldSpend = coordinatorDecision
      ? coordinatorDecision.shouldSpend
      : (() => {
          const sideSignal = coordinatorSignalsBySideId.get(side.id);
          const urgent = isCoordinatorUrgentForIp(sideSignal);
          const defensive = isCoordinatorDefensiveForIp(sideSignal);
          const canReachFront = availableIp >= readyIndex;
          const scoreGainThreshold = urgent ? 20 : (defensive ? 40 : 30);
          const leapThreshold = urgent ? 45 : (defensive ? 75 : 60);
          if (scoreGain < scoreGainThreshold && !(nearEndgame && scoreGain >= Math.max(15, scoreGainThreshold - 10))) {
            return false;
          }
          if (!canReachFront && scoreGain < leapThreshold) {
            return false;
          }
          return true;
        })();

    if (!shouldSpend) {
      continue;
    }
    const reason = coordinatorDecision?.reason ?? (() => {
      const sideSignal = coordinatorSignalsBySideId.get(side.id);
      const urgent = isCoordinatorUrgentForIp(sideSignal);
      return candidateAssessment.nearestEnemyDistance !== null && candidateAssessment.nearestEnemyDistance <= 8
        ? (urgent ? 'coordinator_opportunity_window' : 'opportunity_window')
        : (nearEndgame
          ? (urgent ? 'coordinator_endgame_reorder' : 'endgame_reorder')
          : (urgent ? 'coordinator_score_uplift' : 'score_uplift'));
    })();

    if (!bestCandidate || scoreGain > bestCandidate.scoreGain) {
      bestCandidate = {
        character: candidate,
        side,
        sideIndex: candidateSideIndex,
        sideName: config.sides[candidateSideIndex]?.name ?? side.id,
        readyIndex,
        scoreGain,
        reason,
      };
    }
  }

  if (!bestCandidate) {
    return false;
  }

  let pushesSpent = 0;
  const maxPushes = Math.min(bestCandidate.readyIndex, bestCandidate.side.state.initiativePoints ?? 0);
  for (let push = 0; push < maxPushes; push += 1) {
    const forced = forceInitiative.call(gameManager, bestCandidate.character, bestCandidate.side);
    if (!forced) {
      break;
    }
    pushesSpent += 1;
    const updatedReadyOrder = buildReadyActivationOrderForRunner(gameManager);
    if (updatedReadyOrder[0]?.id === bestCandidate.character.id) {
      break;
    }
  }
  if (pushesSpent <= 0) {
    return false;
  }
  log.push({
    turn,
    modelId: bestCandidate.character.id,
    side: bestCandidate.sideName,
    model: bestCandidate.character.profile.name,
    action: 'initiative_force',
    detail: `spent ${pushesSpent} IP to advance activation (${bestCandidate.reason}, gain=${bestCandidate.scoreGain.toFixed(1)})`,
    result: `force=true pushes=${pushesSpent}`,
  } as any);
  return true;
}

function didGenerateMomentumWindowForRunner(audit: ActivationAudit | null): boolean {
  if (!audit) {
    return false;
  }
  return audit.steps.some(step =>
    step.success
    && (
      step.actionType === 'move'
      || step.actionType === 'combined'
      || step.actionType === 'close_combat'
      || step.actionType === 'ranged_combat'
      || step.actionType === 'pushing'
      || step.actionType === 'refresh'
      || step.actionType === 'charge'
    )
  );
}

function shouldSpendInitiativePointForMaintainForRunner(args: {
  gameManager: GameManager;
  side: MissionSide | undefined;
  coordinatorSignal?: SideCoordinatorSignalForTurn;
  actorActivationAudit: ActivationAudit | null;
  candidate: Character;
  opponents: Character[];
  battlefield: Battlefield;
  turn: number;
  endGameTurn: number;
}): { shouldSpend: boolean; reason: string } {
  const {
    gameManager,
    side,
    coordinatorSignal,
    actorActivationAudit,
    candidate,
    opponents,
    battlefield,
    turn,
    endGameTurn,
  } = args;
  if (!side) {
    return { shouldSpend: false, reason: 'missing_side' };
  }
  const availableIp = side.state.initiativePoints ?? 0;
  if (availableIp < 1) {
    return { shouldSpend: false, reason: 'no_ip' };
  }
  const candidateOpportunity = hasMomentumOpportunityForRunner(candidate, opponents, battlefield);
  const candidateCanPush = (candidate.state.delayTokens ?? 0) === 0
    && !!candidate.state.isAttentive
    && !candidate.state.hasPushedThisInitiative;
  const actorMomentum = didGenerateMomentumWindowForRunner(actorActivationAudit);
  const recommendMaintainInitiativeSpend = (gameManager as unknown as {
    recommendMaintainInitiativeSpend?: (
      sideId: string,
      context: {
        currentTurn: number;
        endGameTurn: number;
        availableIp: number;
        candidateOpportunity: boolean;
        candidateCanPush: boolean;
        actorGeneratedMomentum: boolean;
      }
    ) => { shouldSpend: boolean; reason: string };
  }).recommendMaintainInitiativeSpend;
  if (typeof recommendMaintainInitiativeSpend === 'function') {
    return recommendMaintainInitiativeSpend.call(gameManager, side.id, {
      currentTurn: turn,
      endGameTurn,
      availableIp,
      candidateOpportunity,
      candidateCanPush,
      actorGeneratedMomentum: actorMomentum,
    });
  }

  const urgent = isCoordinatorUrgentForIp(coordinatorSignal);
  const defensive = isCoordinatorDefensiveForIp(coordinatorSignal);
  if (candidateOpportunity) {
    if (defensive && availableIp === 1 && turn < Math.max(1, endGameTurn - 1)) {
      return { shouldSpend: false, reason: 'defensive_reserve' };
    }
    return { shouldSpend: true, reason: urgent ? 'coordinator_opportunity_window' : 'opportunity_window' };
  }
  if (actorMomentum && (availableIp >= 2 || urgent)) {
    return { shouldSpend: true, reason: urgent ? 'coordinator_chain_momentum' : 'chain_momentum' };
  }

  const nearEndgame = turn >= Math.max(1, endGameTurn - 1);
  if (nearEndgame && actorMomentum) {
    return { shouldSpend: true, reason: urgent ? 'coordinator_endgame_chain' : 'endgame_chain' };
  }

  return { shouldSpend: false, reason: 'no_opportunity' };
}

function selectMaintainInitiativeTargetForRunner(args: {
  actor: Character;
  sideCharacters: Character[];
  opponents: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  excludedCharacterIds: Set<string>;
}): Character | null {
  const { actor, sideCharacters, opponents, battlefield, gameManager, excludedCharacterIds } = args;
  const getCharacterStatus = (gameManager as unknown as {
    getCharacterStatus?: (characterId: string) => CharacterStatus | undefined;
  }).getCharacterStatus;
  if (typeof getCharacterStatus !== 'function') {
    return null;
  }

  const sourcePosition = battlefield.getCharacterPosition(actor);
  const readyCandidates = sideCharacters.filter(candidate => {
    if (excludedCharacterIds.has(candidate.id)) return false;
    if (candidate.state.isEliminated || candidate.state.isKOd || candidate.state.isWaiting) return false;
    if (getCharacterStatus.call(gameManager, candidate.id) !== CharacterStatus.Ready) return false;
    const delayTokens = candidate.state.delayTokens ?? 0;
    return delayTokens < gameManager.apPerActivation;
  });
  if (readyCandidates.length === 0) {
    return null;
  }

  const scoredCandidates = readyCandidates.map(candidate => {
    const candidatePosition = battlefield.getCharacterPosition(candidate);
    const distanceFromActor = sourcePosition && candidatePosition
      ? Math.hypot(candidatePosition.x - sourcePosition.x, candidatePosition.y - sourcePosition.y)
      : Number.POSITIVE_INFINITY;
    const nearestEnemyDistance = getClosestEnemyDistanceForRunner(candidate, opponents, battlefield);
    const initiative = candidate.finalAttributes?.int ?? candidate.attributes?.int ?? 0;
    const canPush = (candidate.state.delayTokens ?? 0) === 0
      && !!candidate.state.isAttentive
      && !candidate.state.hasPushedThisInitiative;

    let score = 0;
    if (nearestEnemyDistance !== null && nearestEnemyDistance <= 10) score += 100;
    if (nearestEnemyDistance !== null && nearestEnemyDistance <= 6) score += 40;
    if (Number.isFinite(distanceFromActor) && distanceFromActor <= 8) score += 20;
    if (canPush) score += 15;
    score += initiative;

    return {
      candidate,
      score,
      distanceFromActor,
      nearestEnemyDistance,
      initiative,
    };
  });

  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.nearestEnemyDistance !== b.nearestEnemyDistance) {
      return (a.nearestEnemyDistance ?? Number.POSITIVE_INFINITY) - (b.nearestEnemyDistance ?? Number.POSITIVE_INFINITY);
    }
    if (a.distanceFromActor !== b.distanceFromActor) {
      return a.distanceFromActor - b.distanceFromActor;
    }
    return b.initiative - a.initiative;
  });

  return scoredCandidates[0]?.candidate ?? null;
}

export async function runBattleTurnCycleForRunner(params: BattleTurnCycleParams): Promise<void> {
  const {
    config,
    sides,
    battlefield,
    gameManager,
    missionSides,
    missionRuntimeAdapter,
    getMissionImmediateWinnerSideId,
    log,
    tracker,
    profiler,
    auditTurns,
    applyMissionRuntimeDelta,
    resolveCharacterTurn,
    verbose,
    out,
  } = params;

  let gameOver = false;
  let turn = 0;
  // QSR end-game trigger dice:
  // roll existing END dice first; if game continues, add one die at/after endGameTurn.
  let endGameDice = 0;
  const profilerConfig = profiler.getConfig();
  const sideIndexByCharacterId = new Map<string, number>();
  for (let sideIndex = 0; sideIndex < sides.length; sideIndex += 1) {
    for (const character of sides[sideIndex].characters) {
      sideIndexByCharacterId.set(character.id, sideIndex);
    }
  }
  const runMaintainInitiativeBonusActivations = async (
    actor: Character,
    actorActivationAudit: ActivationAudit | null,
    sideIndex: number,
    turn: number,
    coordinatorSignalsBySideId: Map<string, SideCoordinatorSignalForTurn>
  ): Promise<ActivationAudit[]> => {
    const side = missionSides[sideIndex];
    if (!side) return [];
    const sideCharacters = sides[sideIndex]?.characters ?? [];
    if (sideCharacters.length <= 1) return [];

    const bonusAudits: ActivationAudit[] = [];
    const excludedCharacterIds = new Set<string>([actor.id]);
    let sourceActor = actor;
    let sourceActivationAudit = actorActivationAudit;
    const sideName = config.sides[sideIndex]?.name ?? side.id;
    const opponents = sides
      .flatMap((entry, entrySideIndex) => (entrySideIndex === sideIndex ? [] : entry.characters))
      .filter(candidate => !candidate.state.isEliminated && !candidate.state.isKOd);
    const bonusGuardLimit = Math.max(1, sideCharacters.length);
    let bonusGuardCount = 0;

    while (bonusGuardCount < bonusGuardLimit) {
      bonusGuardCount += 1;
      const target = selectMaintainInitiativeTargetForRunner({
        actor: sourceActor,
        sideCharacters,
        opponents,
        battlefield,
        gameManager,
        excludedCharacterIds,
      });
      if (!target) {
        break;
      }
      const maintainDecision = shouldSpendInitiativePointForMaintainForRunner({
        gameManager,
        side,
        coordinatorSignal: coordinatorSignalsBySideId.get(side.id),
        actorActivationAudit: sourceActivationAudit,
        candidate: target,
        opponents,
        battlefield,
        turn,
        endGameTurn: config.endGameTurn,
      });
      if (!maintainDecision.shouldSpend) {
        break;
      }
      if (!gameManager.maintainInitiative(side)) {
        break;
      }
      log.push({
        turn,
        modelId: sourceActor.id,
        side: sideName,
        model: sourceActor.profile.name,
        action: 'initiative_maintain',
        detail: `spent 1 IP to chain ${target.profile.name} (${maintainDecision.reason})`,
        result: `maintain=true target=${target.id}`,
      } as any);

      const maintainAudit = await resolveCharacterTurn({
        character: target,
        turn,
        sideIndex,
        coordinatorSignal: coordinatorSignalsBySideId.get(side.id),
      });
      if (maintainAudit) {
        bonusAudits.push(maintainAudit);
      }
      excludedCharacterIds.add(target.id);
      sourceActor = target;
      sourceActivationAudit = maintainAudit;
    }

    return bonusAudits;
  };

  while (!gameOver && turn < config.maxTurns) {
    const turnStartedMs = Date.now();
    turn++;
    tracker.setTurnsCompleted(turn);
    const coordinatorMissionConfig = {
      totalVPPool: 5,
      hasRPToVPConversion: false,
      currentTurn: turn,
      maxTurns: config.maxTurns,
      endGameTurn: config.endGameTurn,
    };
    profiler.withPhaseTiming(
      'turn.start',
      () => gameManager.startTurn(
        Math.random,
        missionSides,
        {
          missionId: config.missionId,
          missionName: config.missionName,
          lighting: String(config.lighting),
          visibilityOrMu: config.visibilityOrMu,
          maxOrm: config.maxOrm,
          battlefieldWidth: config.battlefieldWidth,
          battlefieldHeight: config.battlefieldHeight,
          missionConfig: coordinatorMissionConfig as any,
        }
      )
    );
    if (missionRuntimeAdapter) {
      const turnStartUpdate = profiler.withPhaseTiming(
        'turn.mission_start_update',
        () => missionRuntimeAdapter.onTurnStart(
          turn,
          buildMissionModelsForRunner(battlefield, missionSides) as any
        )
      );
      applyMissionRuntimeDelta(turnStartUpdate);
    }

    const coordinatorManager = gameManager.getSideCoordinatorManager();
    if (coordinatorManager) {
      const sideKeyScores = new Map<string, Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>>();
      for (const side of missionSides) {
        sideKeyScores.set(side.id, normalizeKeyScoresForRunner(side.state.keyScores as any));
      }

      const missionConfig = {
        ...coordinatorMissionConfig,
      };
      coordinatorManager.updateAllScoringContexts(sideKeyScores, turn, missionConfig);
    }
    const managerStrategies = gameManager.getSideStrategies?.();
    const managerSignals = gameManager.getSideInitiativeSignals?.(turn);
    const coordinatorSignalsBySideId = managerSignals && Object.keys(managerSignals).length > 0
      ? buildSideCoordinatorSignalsFromCoordinatorManager(managerSignals as Record<string, unknown>)
      : buildSideCoordinatorSignalsForTurn(
          managerStrategies as Record<string, unknown> | undefined,
          turn
        );

    const turnAudit: TurnAudit = {
      turn,
      activations: [],
      sideSummaries: config.sides.map((side, index) => ({
        sideName: side.name,
        activeModelsStart: sides[index].characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length,
        activeModelsEnd: 0,
      })),
      coordinatorDecisions: buildTurnCoordinatorDecisionsForRunner({
        managerStrategies,
        currentTurn: turn,
      }),
    };
    auditTurns.push(turnAudit);

    if (profilerConfig.progressEnabled) {
      const elapsedRunMs = profiler.getElapsedMs();
      console.log(`[PROFILE] turn-start turn=${turn}/${config.maxTurns} elapsedMs=${elapsedRunMs}`);
    }

    if (verbose) {
      out(`\n📍 Turn ${turn}\n`);
    }

    const getNextToActivate = (gameManager as unknown as {
      getNextToActivate?: () => Character | undefined;
    }).getNextToActivate;

    if (typeof getNextToActivate === 'function') {
      const activeModelCount = turnAudit.sideSummaries.reduce(
        (sum, summary) => sum + summary.activeModelsStart,
        0
      );
      const activationGuardLimit = Math.max(1, activeModelCount * 4);
      let activationGuardCount = 0;

      while (activationGuardCount < activationGuardLimit) {
        attemptForceInitiativeForRunner({
          turn,
          config,
          sides,
          missionSides,
          coordinatorSignalsBySideId,
          battlefield,
          gameManager,
          sideIndexByCharacterId,
          log,
        });
        const character = getNextToActivate.call(gameManager);
        if (!character) {
          break;
        }
        activationGuardCount += 1;
        const sideIndex = sideIndexByCharacterId.get(character.id);
        if (sideIndex === undefined) {
          continue;
        }
        if (profilerConfig.progressEnabled && profilerConfig.progressEachActivation) {
          console.log(
            `[PROFILE] activation-start turn=${turn} side=${config.sides[sideIndex].name} model=${character.profile.name}`
          );
        }
        const activationAudit = await resolveCharacterTurn({
          character,
          turn,
          sideIndex,
          coordinatorSignal: coordinatorSignalsBySideId.get(missionSides[sideIndex]?.id ?? ''),
        });
        if (activationAudit) {
          turnAudit.activations.push(activationAudit);
        }
        const maintainAudits = await runMaintainInitiativeBonusActivations(
          character,
          activationAudit,
          sideIndex,
          turn,
          coordinatorSignalsBySideId
        );
        if (maintainAudits.length > 0) {
          turnAudit.activations.push(...maintainAudits);
        }
      }
    } else {
      for (let sideIndex = 0; sideIndex < config.sides.length; sideIndex++) {
        const sideCharacters = sides[sideIndex].characters
          .filter(c => !c.state.isEliminated && !c.state.isKOd)
          .sort((a, b) => (b.finalAttributes?.int ?? b.attributes?.int ?? 0) - (a.finalAttributes?.int ?? a.attributes?.int ?? 0));

        for (const character of sideCharacters) {
          if (profilerConfig.progressEnabled && profilerConfig.progressEachActivation) {
            console.log(
              `[PROFILE] activation-start turn=${turn} side=${config.sides[sideIndex].name} model=${character.profile.name}`
            );
          }
          const activationAudit = await resolveCharacterTurn({
            character,
            turn,
            sideIndex,
            coordinatorSignal: coordinatorSignalsBySideId.get(missionSides[sideIndex]?.id ?? ''),
          });
          if (activationAudit) {
            turnAudit.activations.push(activationAudit);
          }
          const maintainAudits = await runMaintainInitiativeBonusActivations(
            character,
            activationAudit,
            sideIndex,
            turn,
            coordinatorSignalsBySideId
          );
          if (maintainAudits.length > 0) {
            turnAudit.activations.push(...maintainAudits);
          }
        }
      }
    }

    turnAudit.sideSummaries = turnAudit.sideSummaries.map((summary, index) => ({
      ...summary,
      activeModelsEnd: sides[index].characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length,
    }));

    if (missionRuntimeAdapter) {
      const turnEndUpdate = profiler.withPhaseTiming(
        'turn.mission_end_update',
        () => missionRuntimeAdapter.onTurnEnd(
          turn,
          buildMissionModelsForRunner(battlefield, missionSides) as any
        )
      );
      applyMissionRuntimeDelta(turnEndUpdate);
    }

    const remainingPerSide = sides.map(side =>
      side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length
    );

    if (getMissionImmediateWinnerSideId()) {
      gameOver = true;
      if (verbose) {
        out(`\n🏆 Mission immediate winner: ${getMissionImmediateWinnerSideId()}\n`);
      }
    }

    const sidesWithModels = remainingPerSide.filter(value => value > 0).length;
    if (!gameOver && sidesWithModels <= 1) {
      gameOver = true;
      if (verbose) {
        out(`\n🏆 Game Over - Only ${sidesWithModels} side(s) with models remaining!\n`);
      }
    } else if (!gameOver) {
      const endGameRolls: number[] = [];
      if (endGameDice > 0) {
        for (let index = 0; index < endGameDice; index += 1) {
          endGameRolls.push(Math.floor(Math.random() * 6) + 1);
        }
      }
      const endGameTriggered = endGameRolls.some(roll => roll >= 1 && roll <= 3);
      if (endGameTriggered) {
        gameOver = true;
        if (verbose) {
          out(`\n🎲 End-game trigger roll (${endGameRolls.join(', ')}) - Game Over!\n`);
        }
      }
      if (!gameOver && turn >= config.endGameTurn) {
        endGameDice += 1;
        if (verbose) {
          out(`\n🎲 End-game trigger: +1 END die (total ${endGameDice})\n`);
        }
      }
    }

    if (verbose) {
      config.sides.forEach((side, index) => {
        out(`  ${side.name}: ${remainingPerSide[index]}/${sides[index].characters.length} models`);
      });
    }

    const turnElapsedMs = Date.now() - turnStartedMs;
    profiler.recordTurnTiming({
      turn,
      elapsedMs: Number(turnElapsedMs.toFixed(2)),
      activations: turnAudit.activations.length,
    });
    profiler.recordPhaseDuration('turn.total', turnElapsedMs);
    if (profilerConfig.progressEnabled) {
      const elapsedRunMs = profiler.getElapsedMs();
      console.log(
        `[PROFILE] turn-end turn=${turn}/${config.maxTurns} turnMs=${turnElapsedMs} activations=${turnAudit.activations.length} elapsedMs=${elapsedRunMs}`
      );
    }
  }
}
