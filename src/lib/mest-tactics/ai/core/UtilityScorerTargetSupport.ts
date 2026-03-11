import type { Character } from '../../core/Character';
import type { Position } from '../../battlefield/Position';
import type { AIContext } from './AIController';
import { scoreROFPlacement } from './ROFScoring';
import type {
  FractionalScoringPotential,
  TargetVPRPPressureBreakdown,
} from './UtilityScorerPressureSupport';
import type { ThreatImmediacyFactors } from './TacticalHeuristics';

interface CohesionAwareEnemies {
  withinCohesion: Character[];
  outsideCohesion: Character[];
}

interface BuildAllyTargetCountsParams {
  context: AIContext;
  relevantEnemies: Character[];
  getCharacterPosition: (character: Character) => Position | undefined;
}

interface ResolveSingleTargetPositionParams {
  attacker: Character;
  enemy: Character;
  context: AIContext;
  isAttackableEnemy: (
    attacker: Character,
    enemy: Character,
    config: AIContext['config']
  ) => boolean;
  getCharacterPosition: (character: Character) => Position | undefined;
}

interface EvaluatePrioritizedTargetsParams<T> {
  context: AIContext;
  cohesionAware: CohesionAwareEnemies;
  shouldSkipTargetEvaluation: (
    enemy: Character,
    context: AIContext,
    currentBestScore: number
  ) => boolean;
  evaluateSingleTarget: (
    enemy: Character,
    currentBestScore: number
  ) => T | null;
}

interface TargetScoringWeights {
  targetHealth: number;
  targetThreat: number;
  distanceToTarget: number;
  victoryConditionValue: number;
}

interface MissionPriorityBias {
  centerTargetBias: number;
  vipTargetBias: number;
}

interface EvaluateSingleTargetScoreParams {
  enemy: Character;
  context: AIContext;
  characterPos: Position;
  enemyPos: Position;
  rofLevel: number;
  allyTargetCounts: Map<string, number>;
  selfOutOfPlayRiskPenalty: number;
  scoringPotential: FractionalScoringPotential;
  weights: TargetScoringWeights;
  evaluateTargetHealth: (target: Character) => number;
  evaluateTargetThreat: (target: Character, context: AIContext) => number;
  evaluateTargetDistance: (from: Position, to: Position) => number;
  hasLOS: (target: Character) => boolean;
  evaluateMissionPriority: (target: Character, context: AIContext) => number;
  evaluateROFTargetValue: (
    target: Character,
    context: AIContext,
    rofLevel: number
  ) => number;
  evaluateJumpDownBonus: (
    target: Character,
    characterPos: Position,
    enemyPos: Position,
    context: AIContext
  ) => number;
  evaluateEnemyOutOfPlayPressure: (target: Character) => number;
  evaluateTargetVPRPPressure: (
    target: Character,
    context: AIContext,
    scoringPotential: FractionalScoringPotential
  ) => TargetVPRPPressureBreakdown;
  evaluateThreatImmediacy: (
    target: Character,
    characterPos: Position,
    context: AIContext
  ) => ThreatImmediacyFactors;
}

interface SingleTargetScoreEvaluation {
  score: number;
  factors: Record<string, number>;
}

export interface JumpDownAttackEvaluation {
  score: number;
  canJump: boolean;
}

export function buildAllyTargetCounts(
  params: BuildAllyTargetCountsParams
): Map<string, number> {
  const {
    context,
    relevantEnemies,
    getCharacterPosition,
  } = params;
  const allyTargetCounts = new Map<string, number>();
  for (const ally of context.allies) {
    if (ally.state.isAttentive && ally.state.isOrdered && !ally.state.isKOd && !ally.state.isEliminated) {
      const allyPos = getCharacterPosition(ally);
      if (!allyPos) continue;

      let closestEnemy: Character | null = null;
      let closestDist = Infinity;
      for (const enemy of relevantEnemies) {
        const enemyPos = getCharacterPosition(enemy);
        if (!enemyPos) continue;
        const dist = Math.hypot(enemyPos.x - allyPos.x, enemyPos.y - allyPos.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestEnemy = enemy;
        }
      }
      if (closestEnemy) {
        const count = allyTargetCounts.get(closestEnemy.id) || 0;
        allyTargetCounts.set(closestEnemy.id, count + 1);
      }
    }
  }
  return allyTargetCounts;
}

export function resolveSingleTargetPosition(
  params: ResolveSingleTargetPositionParams
): Position | null {
  const {
    attacker,
    enemy,
    context,
    isAttackableEnemy,
    getCharacterPosition,
  } = params;
  if (!isAttackableEnemy(attacker, enemy, context.config)) {
    return null;
  }
  return getCharacterPosition(enemy) ?? null;
}

export function evaluatePrioritizedTargets<T extends { score: number }>(
  params: EvaluatePrioritizedTargetsParams<T>
): T[] {
  const {
    context,
    cohesionAware,
    shouldSkipTargetEvaluation,
    evaluateSingleTarget,
  } = params;
  const targets: T[] = [];
  let currentBestScore = 0;

  for (const enemy of cohesionAware.withinCohesion) {
    if (shouldSkipTargetEvaluation(enemy, context, currentBestScore)) continue;

    const target = evaluateSingleTarget(enemy, currentBestScore);
    if (target) {
      targets.push(target);
      currentBestScore = Math.max(currentBestScore, target.score);
    }
  }

  for (const enemy of cohesionAware.outsideCohesion) {
    if (shouldSkipTargetEvaluation(enemy, context, currentBestScore * 0.7)) continue;

    const target = evaluateSingleTarget(enemy, currentBestScore);
    if (target) {
      targets.push(target);
      currentBestScore = Math.max(currentBestScore, target.score);
    }
  }

  targets.sort((a, b) => b.score - a.score);
  return targets;
}

export function evaluateSingleTargetScore(
  params: EvaluateSingleTargetScoreParams
): SingleTargetScoreEvaluation {
  const {
    enemy,
    context,
    characterPos,
    enemyPos,
    rofLevel,
    allyTargetCounts,
    selfOutOfPlayRiskPenalty,
    scoringPotential,
    weights,
    evaluateTargetHealth,
    evaluateTargetThreat,
    evaluateTargetDistance,
    hasLOS,
    evaluateMissionPriority,
    evaluateROFTargetValue,
    evaluateJumpDownBonus,
    evaluateEnemyOutOfPlayPressure,
    evaluateTargetVPRPPressure,
    evaluateThreatImmediacy,
  } = params;

  const health = evaluateTargetHealth(enemy);
  const threat = evaluateTargetThreat(enemy, context);
  const distance = evaluateTargetDistance(characterPos, enemyPos);
  const visibility = context.config.perCharacterFovLos
    ? (hasLOS(enemy) ? 1.0 : 0.0)
    : 1.0;
  const missionPriority = evaluateMissionPriority(enemy, context);
  const rofTargetScore = rofLevel > 0
    ? evaluateROFTargetValue(enemy, context, rofLevel)
    : 0;
  const jumpDownBonus = evaluateJumpDownBonus(enemy, characterPos, enemyPos, context);

  const allyTargetCount = allyTargetCounts.get(enemy.id) || 0;
  const allyFocusFireBonus = allyTargetCount > 0 ? allyTargetCount * 1.5 : 0;
  const targetCommitment = context.targetCommitments?.[enemy.id] ?? 0;
  const targetCommitmentBonus = targetCommitment > 0
    ? Math.min(6, targetCommitment * 1.25)
    : 0;
  const scrumContinuity = context.scrumContinuity?.[enemy.id] ?? 0;
  const lanePressure = context.lanePressure?.[enemy.id] ?? 0;
  const scrumContinuityBonus = scrumContinuity > 0 ? Math.min(4.5, scrumContinuity * 1.1) : 0;
  const lanePressureBonus = lanePressure > 0 ? Math.min(4, lanePressure * 0.95) : 0;
  const focusFireBonus = allyFocusFireBonus + targetCommitmentBonus + scrumContinuityBonus + lanePressureBonus;

  const enemySiz = enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3;
  const enemyWounds = enemy.state.wounds;
  const finishOffBonus = enemyWounds >= enemySiz - 1 ? 5.0 : 0;
  const outOfPlayPressureBonus = evaluateEnemyOutOfPlayPressure(enemy);
  const vpPressureBreakdown = evaluateTargetVPRPPressure(enemy, context, scoringPotential);
  const vpPressureBonus = vpPressureBreakdown.total;
  const threatImmediacy = evaluateThreatImmediacy(enemy, characterPos, context);
  const threatImmediacyBonus = evaluateThreatImmediacyBonusScore(threatImmediacy);

  const score =
    health * weights.targetHealth +
    threat * weights.targetThreat +
    distance * weights.distanceToTarget +
    visibility * 2.0 +
    missionPriority * weights.victoryConditionValue +
    rofTargetScore * 1.5 +
    jumpDownBonus +
    focusFireBonus +
    outOfPlayPressureBonus +
    finishOffBonus +
    vpPressureBonus +
    threatImmediacyBonus -
    selfOutOfPlayRiskPenalty;

  return {
    score,
    factors: {
      health,
      threat,
      distance,
      visibility,
      missionPriority,
      rofTargetScore,
      jumpDown: jumpDownBonus,
      focusFire: focusFireBonus,
      targetCommitment: targetCommitmentBonus,
      scrumContinuity: scrumContinuityBonus,
      lanePressure: lanePressureBonus,
      outOfPlayPressure: outOfPlayPressureBonus,
      selfOutOfPlayRisk: selfOutOfPlayRiskPenalty,
      finishOff: finishOffBonus,
      vpPressure: vpPressureBonus,
      vpPotential: vpPressureBreakdown.vpPotential,
      vpDenial: vpPressureBreakdown.vpDenial,
      rpPotential: vpPressureBreakdown.rpPotential,
      rpDenial: vpPressureBreakdown.rpDenial,
      threatImmediacy: threatImmediacyBonus,
    },
  };
}

export function evaluateJumpDownBonusScore(result: JumpDownAttackEvaluation): number {
  return result.canJump ? result.score * 0.5 : 0;
}

export function evaluateThreatImmediacyBonusScore(
  threatImmediacy: ThreatImmediacyFactors
): number {
  return threatImmediacy.totalScore * 1.5;
}

export function evaluateTargetHealthScore(target: Character): number {
  const siz = target.finalAttributes.siz ?? target.attributes.siz ?? 3;
  const healthRatio = 1 - (target.state.wounds / siz);
  // Prefer wounded targets.
  return 1 - healthRatio;
}

export function evaluateTargetThreatScore(target: Character): number {
  let threat = 0;

  if (target.finalAttributes.cca >= 3) threat += 0.5;
  if (target.finalAttributes.cca >= 4) threat += 0.5;
  if (target.finalAttributes.rca >= 3) threat += 0.5;
  if (target.finalAttributes.rca >= 4) threat += 0.5;

  const profileName = String(target.profile?.name ?? '').toLowerCase();
  if (profileName.includes('elite')) threat += 1.0;
  else if (profileName.includes('veteran')) threat += 0.5;

  return threat;
}

export function evaluateTargetDistanceScore(from: Position, to: Position): number {
  const dist = Math.sqrt(
    Math.pow(from.x - to.x, 2) +
    Math.pow(from.y - to.y, 2)
  );
  // Prefer closer targets.
  return Math.max(0, 1 - dist / 24);
}

export function evaluateMissionPriorityScore(
  target: Character,
  context: AIContext,
  bias: MissionPriorityBias
): number {
  let priority = 1.0;

  const targetPos = context.battlefield.getCharacterPosition(target);
  if (targetPos && bias.centerTargetBias > 0) {
    const center = {
      x: context.battlefield.width / 2,
      y: context.battlefield.height / 2,
    };
    const maxCenterDistance = Math.hypot(context.battlefield.width / 2, context.battlefield.height / 2);
    const distanceToCenter = Math.hypot(targetPos.x - center.x, targetPos.y - center.y);
    const centerAffinity = 1 - Math.min(1, distanceToCenter / Math.max(1, maxCenterDistance));
    priority += centerAffinity * bias.centerTargetBias;
  }

  if (bias.vipTargetBias > 0) {
    const enemyBps = context.enemies.map(enemy => enemy.profile.totalBp ?? 0);
    const maxEnemyBp = enemyBps.length > 0 ? Math.max(...enemyBps) : (target.profile.totalBp ?? 0);
    const targetBp = target.profile.totalBp ?? 0;
    if (maxEnemyBp > 0) {
      const normalized = targetBp / maxEnemyBp;
      priority += normalized * bias.vipTargetBias;
    }
  }

  if ((context.config.missionRole ?? 'neutral') === 'defender') {
    priority += 0.1 * bias.centerTargetBias;
  }

  return Math.max(0.25, Math.min(3, priority));
}

export function evaluateROFTargetValueScore(
  attacker: Character,
  primaryTarget: Character,
  context: AIContext,
  rofLevel: number
): number {
  const attackerPos = context.battlefield.getCharacterPosition(attacker);
  const primaryTargetPos = context.battlefield.getCharacterPosition(primaryTarget);
  if (!attackerPos || !primaryTargetPos || rofLevel <= 0) {
    return 0;
  }

  const allCharacters = [attacker, primaryTarget, ...context.allies, ...context.enemies];
  const rofScore = scoreROFPlacement(
    attacker,
    context.battlefield,
    primaryTarget,
    rofLevel,
    allCharacters
  );

  let score = 0;
  score += rofScore.targetsInRange * 2;
  score += rofScore.rofDiceBonus * 0.5;
  if (!rofScore.avoidsFriendlyFire) {
    score -= 5;
  }

  return Math.max(0, score);
}
