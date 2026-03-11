import type { AIContext } from './AIController';
import type { Character } from '../../core/Character';
import type { ActionType } from './AIController';
import { getActionVPInfo } from './ActionVPFilter';
import { calculateSuddenDeathTimePressure } from './TurnHorizon';
import { findMyScrumGroup } from './TacticalHeuristics';

interface KeyScore {
  current: number;
  predicted: number;
  confidence: number;
  leadMargin: number;
}

interface FractionalPotentialLedger {
  myTotalPotential?: number;
  opponentTotalPotential?: number;
  myDeniedPotential?: number;
  opponentDeniedPotential?: number;
}

export interface FractionalScoringPotential {
  sideVP: number;
  opponentVP: number;
  sideRP: number;
  opponentRP: number;
  vpDeficit: number;
  rpDeficit: number;
  myFractionalVpPotential: number;
  opponentFractionalVpPotential: number;
  vpPotentialDelta: number;
  myRpVpPotential: number;
  opponentRpVpPotential: number;
  urgencyScalar: number;
}

export interface TargetVPRPPressureBreakdown {
  vpPotential: number;
  vpDenial: number;
  rpPotential: number;
  rpDenial: number;
  total: number;
}

export interface ActionFractionalScoringBreakdown {
  vpPotential: number;
  vpDenial: number;
  rpPotential: number;
  rpDenial: number;
  total: number;
}

export interface FractionalScoringAction {
  action: ActionType;
  target?: Character;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number): number {
  return clampNumber(value, 0, 1);
}

export function resolveSideScore(
  scoreBySide: Record<string, number> | undefined,
  sideId: string | undefined,
  fallback: number
): number {
  if (scoreBySide && sideId) {
    const raw = scoreBySide[sideId];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.max(0, raw);
    }
  }
  return Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
}

export function resolveOpponentScore(
  scoreBySide: Record<string, number> | undefined,
  sideId: string | undefined
): number {
  if (!scoreBySide) {
    return 0;
  }
  return Object.entries(scoreBySide)
    .filter(([candidateSideId]) => candidateSideId !== sideId)
    .reduce((max, [, score]) => {
      if (typeof score !== 'number' || !Number.isFinite(score)) {
        return max;
      }
      return Math.max(max, score);
    }, 0);
}

export function estimateFractionalKeyPotential(
  keyScores: Record<string, KeyScore> | undefined
): number {
  if (!keyScores) return 0;
  let total = 0;

  for (const score of Object.values(keyScores)) {
    const current = Number.isFinite(score.current) ? score.current : 0;
    const predicted = Number.isFinite(score.predicted) ? score.predicted : current;
    const confidence = clamp01(Number.isFinite(score.confidence) ? score.confidence : 0.5);
    const gain = Math.max(0, predicted - current);
    const contestedBoost = score.leadMargin < 0 ? 1.1 : 1;
    total += gain * (0.35 + (confidence * 0.65)) * contestedBoost;
  }

  return total;
}

export function estimateRpVictoryPotential(myRp: number, opponentRp: number): number {
  if (!(myRp > opponentRp)) {
    return 0;
  }
  const leadMargin = Math.max(0, myRp - opponentRp);
  const plusOnePotential = clamp01(leadMargin);
  const doubleProgress = opponentRp <= 0
    ? (myRp > 0 ? 1 : 0)
    : myRp / (opponentRp * 2);
  const plusTwoProgress = clamp01(Math.min(doubleProgress, leadMargin / 3));
  return clampNumber(Math.max(plusOnePotential, plusTwoProgress * 2), 0, 2);
}

export function computeFractionalScoringPotential(context: AIContext): FractionalScoringPotential {
  const sideVP = resolveSideScore(
    context.vpBySide,
    context.sideId,
    Number(context.side?.state?.victoryPoints ?? 0)
  );
  const opponentVP = resolveOpponentScore(
    context.vpBySide,
    context.sideId
  );
  const sideRP = resolveSideScore(
    context.rpBySide,
    context.sideId,
    Number(context.side?.state?.resourcePoints ?? 0)
  );
  const opponentRP = resolveOpponentScore(
    context.rpBySide,
    context.sideId
  );

  const vpDeficit = Math.max(0, opponentVP - sideVP);
  const rpDeficit = Math.max(0, opponentRP - sideRP);
  const ledger = context.scoringContext?.fractionalPotentialLedger as FractionalPotentialLedger | undefined;
  const myFractionalVpPotential = ledger && Number.isFinite(ledger.myTotalPotential)
    ? Math.max(0, Number(ledger.myTotalPotential))
    : estimateFractionalKeyPotential(context.scoringContext?.myKeyScores as Record<string, KeyScore> | undefined);
  const opponentFractionalVpPotential = ledger && Number.isFinite(ledger.opponentTotalPotential)
    ? Math.max(0, Number(ledger.opponentTotalPotential))
    : estimateFractionalKeyPotential(context.scoringContext?.opponentKeyScores as Record<string, KeyScore> | undefined);
  const myDeniedPotential = ledger && Number.isFinite(ledger.myDeniedPotential)
    ? Math.max(0, Number(ledger.myDeniedPotential))
    : 0;
  const opponentDeniedPotential = ledger && Number.isFinite(ledger.opponentDeniedPotential)
    ? Math.max(0, Number(ledger.opponentDeniedPotential))
    : 0;
  const denialDelta = myDeniedPotential - opponentDeniedPotential;
  const vpPotentialDelta =
    (myFractionalVpPotential - opponentFractionalVpPotential) +
    (denialDelta * 0.4);

  const myRpVpPotential = estimateRpVictoryPotential(sideRP, opponentRP);
  const opponentRpVpPotential = estimateRpVictoryPotential(opponentRP, sideRP);

  const currentTurn = Math.max(1, Number(context.currentTurn ?? 1));
  const maxTurns = Math.max(currentTurn, Number(context.maxTurns ?? 6));
  const endGameTurn = Number.isFinite(context.endGameTurn)
    ? Number(context.endGameTurn)
    : Number.isFinite(context.scoringContext?.predictorEndGameTurn)
      ? Number(context.scoringContext?.predictorEndGameTurn)
      : undefined;
  const timePressure = calculateSuddenDeathTimePressure(currentTurn, maxTurns, endGameTurn);
  const potentialGapPressure = Math.max(
    0,
    (opponentFractionalVpPotential + (opponentDeniedPotential * 0.35)) -
    (myFractionalVpPotential + (myDeniedPotential * 0.35))
  );
  const urgencyScalar = clampNumber(
    1 +
    (vpDeficit * 0.35) +
    (rpDeficit * 0.12) +
    (potentialGapPressure * 0.28) +
    (Math.max(0, -denialDelta) * 0.18) +
    (timePressure * 0.25),
    0.65,
    3.4
  );

  return {
    sideVP,
    opponentVP,
    sideRP,
    opponentRP,
    vpDeficit,
    rpDeficit,
    myFractionalVpPotential,
    opponentFractionalVpPotential,
    vpPotentialDelta,
    myRpVpPotential,
    opponentRpVpPotential,
    urgencyScalar,
  };
}

export function evaluateSelfOutOfPlayRiskPenalty(
  context: AIContext,
  selfBp: number,
  exposureCount: number
): number {
  if (selfBp <= 0) return 0;

  const selfSiz = Math.max(1, context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3);
  const selfWounds = Math.max(0, context.character.state.wounds ?? 0);
  const woundPressure = Math.min(1, selfWounds / selfSiz);
  const exposurePressure = context.enemies.length > 0
    ? Math.min(1, exposureCount / context.enemies.length)
    : 0;
  const engagementPressure = context.battlefield.isEngaged?.(context.character) ? 0.25 : 0;

  const riskScore = Math.min(1, (woundPressure * 0.6) + (exposurePressure * 0.3) + engagementPressure);
  let penalty = selfBp * riskScore * 0.1;

  // If losing elimination pressure, preserve some aggression.
  if (!context.scoringContext?.amILeading &&
      context.scoringContext?.losingKeys?.includes('elimination')) {
    penalty *= 0.75;
  }

  return penalty;
}

export function hasOutnumberingScrumCondition(context: AIContext): boolean {
  const scrum = findMyScrumGroup(context.character, context as any);
  if (scrum && scrum.members.length >= 2 && scrum.localOutnumber > 0 && scrum.engagedEnemies.length > 0) {
    return true;
  }

  const actorPos = context.battlefield.getCharacterPosition(context.character);
  if (!actorPos) {
    return false;
  }

  const scrumRange = 1.75;
  for (const enemy of context.enemies) {
    if (enemy.state.isEliminated || enemy.state.isKOd) continue;
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;

    const actorDistance = Math.hypot(enemyPos.x - actorPos.x, enemyPos.y - actorPos.y);
    if (actorDistance > scrumRange) continue;

    let friendlyCount = 1;
    for (const ally of context.allies) {
      if (ally.state.isEliminated || ally.state.isKOd) continue;
      const allyPos = context.battlefield.getCharacterPosition(ally);
      if (!allyPos) continue;
      const allyDistance = Math.hypot(enemyPos.x - allyPos.x, enemyPos.y - allyPos.y);
      if (allyDistance <= scrumRange) {
        friendlyCount += 1;
      }
    }

    let enemyCount = 0;
    for (const opponent of context.enemies) {
      if (opponent.state.isEliminated || opponent.state.isKOd) continue;
      const opponentPos = context.battlefield.getCharacterPosition(opponent);
      if (!opponentPos) continue;
      const opponentDistance = Math.hypot(enemyPos.x - opponentPos.x, enemyPos.y - opponentPos.y);
      if (opponentDistance <= scrumRange) {
        enemyCount += 1;
      }
    }

    if (friendlyCount > enemyCount) {
      return true;
    }
  }

  return false;
}

export function computeConditionalSurvivalFactor(context: AIContext): number {
  let factor = 1;
  const wounds = Math.max(0, Number(context.character.state.wounds ?? 0));

  // Human-like risk appetite:
  // - healthier models can spend risk to gain tempo
  // - wounded models still keep a reduced survival weighting
  factor *= wounds > 0 ? 0.5 : 0.25;

  // In favorable scrums (local outnumber), survival pressure is reduced further
  // so the model can commit to finishing pressure.
  if (hasOutnumberingScrumCondition(context)) {
    factor *= 0.5;
  }

  return clampNumber(factor, 0.05, 1);
}

export function evaluateEnemyOutOfPlayPressure(enemy: Character, enemyBp: number): number {
  if (enemyBp <= 0) return 0;

  const enemySiz = Math.max(1, enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3);
  const enemyWounds = Math.max(0, enemy.state.wounds ?? 0);
  const woundProgress = Math.min(1, enemyWounds / enemySiz);
  const nearOutOfPlay = enemyWounds >= enemySiz - 1 ? 1 : 0;

  // Fractional pressure: increases as enemy approaches out-of-play.
  return (enemyBp * woundProgress * 0.16) + (enemyBp * nearOutOfPlay * 0.08);
}

export function evaluateTargetVPRPPressure(
  enemy: Character,
  enemyBp: number,
  maxEnemyBp: number,
  scoringPotential: FractionalScoringPotential
): TargetVPRPPressureBreakdown {
  const enemyBpShare = maxEnemyBp > 0
    ? clampNumber(enemyBp / maxEnemyBp, 0.2, 1)
    : 0.5;

  const enemySiz = Math.max(1, enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3);
  const enemyWounds = Math.max(0, enemy.state.wounds ?? 0);
  const woundProgress = clamp01(enemyWounds / enemySiz);
  const nearOutOfPlay = enemyWounds >= enemySiz - 1 ? 1 : 0;
  const outOfPlayProgress = clampNumber((woundProgress * 0.7) + (nearOutOfPlay * 0.3), 0, 1);

  const vpNeedScale =
    0.45 +
    (scoringPotential.vpDeficit * 0.28) +
    (Math.max(0, -scoringPotential.vpPotentialDelta) * 0.22);
  const vpPotential =
    outOfPlayProgress *
    enemyBpShare *
    vpNeedScale *
    scoringPotential.urgencyScalar *
    2.1;

  const vpDenial =
    outOfPlayProgress *
    enemyBpShare *
    Math.max(0, scoringPotential.opponentFractionalVpPotential) *
    0.9;

  const rpNeedScale = scoringPotential.rpDeficit > 0
    ? 0.3 + Math.min(1.4, scoringPotential.rpDeficit * 0.2)
    : 0.18;
  const rpPotential =
    outOfPlayProgress *
    enemyBpShare *
    rpNeedScale *
    (1 + Math.max(0, 1 - (scoringPotential.myRpVpPotential * 0.45)));

  const rpDenial =
    outOfPlayProgress *
    enemyBpShare *
    scoringPotential.opponentRpVpPotential *
    0.35;

  const total = vpPotential + vpDenial + rpPotential + rpDenial;
  return { vpPotential, vpDenial, rpPotential, rpDenial, total };
}

export function evaluateActionFractionalScoring(
  action: FractionalScoringAction,
  scoringPotential: FractionalScoringPotential
): ActionFractionalScoringBreakdown {
  const vpInfo = getActionVPInfo(
    action.action,
    action.target !== undefined,
    true
  );

  const directnessWeight = vpInfo.isDirectVPAction
    ? 1.0
    : vpInfo.isVPEnablingAction
      ? 0.65
      : vpInfo.isSupportAction
        ? 0.45
        : vpInfo.isMovementAction
          ? 0.4
          : 0.15;

  const vpNeedScale =
    1 +
    (scoringPotential.vpDeficit * 0.35) +
    (Math.max(0, -scoringPotential.vpPotentialDelta) * 0.2);
  let vpPotential =
    vpInfo.estimatedVPContribution *
    directnessWeight *
    scoringPotential.urgencyScalar *
    vpNeedScale *
    1.8;

  let vpDenial =
    (vpInfo.isDirectVPAction ? 1 : vpInfo.isVPEnablingAction ? 0.55 : 0.2) *
    Math.max(0, scoringPotential.opponentFractionalVpPotential) *
    0.22 *
    scoringPotential.urgencyScalar;

  const rpCatchupNeed =
    1 +
    (scoringPotential.rpDeficit * 0.18) +
    (Math.max(0, scoringPotential.opponentRpVpPotential - scoringPotential.myRpVpPotential) * 0.15);
  let rpPotential =
    (vpInfo.isDirectVPAction ? 0.35 : vpInfo.isVPEnablingAction ? 0.2 : 0.08) *
    rpCatchupNeed *
    Math.max(0.4, 1 - (scoringPotential.myRpVpPotential * 0.2));

  let rpDenial =
    (vpInfo.isDirectVPAction ? 0.28 : vpInfo.isVPEnablingAction ? 0.16 : 0.06) *
    scoringPotential.opponentRpVpPotential;

  if (vpInfo.isPassiveAction) {
    const passivePenalty =
      (scoringPotential.vpDeficit * 0.55) +
      (scoringPotential.rpDeficit * 0.2) +
      (Math.max(0, -scoringPotential.vpPotentialDelta) * 0.3);
    vpPotential -= passivePenalty;
    rpPotential -= scoringPotential.rpDeficit > 0
      ? 0.2 + (scoringPotential.rpDeficit * 0.1)
      : 0;
    vpDenial *= 0.35;
    rpDenial *= 0.35;
  }

  const total = vpPotential + vpDenial + rpPotential + rpDenial;
  return { vpPotential, vpDenial, rpPotential, rpDenial, total };
}
