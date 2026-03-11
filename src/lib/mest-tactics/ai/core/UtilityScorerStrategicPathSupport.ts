import type { Battlefield } from '../../battlefield/Battlefield';
import type { Position } from '../../battlefield/Position';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import {
  createMultiGoalPathfinding,
  type MultiGoalPathOptions,
} from '../../battlefield/pathfinding/MultiGoalPathfinding';
import type { AIContext } from './AIController';
import type { EvaluationSession } from './UtilityScorerSessionSupport';
import { isAttackableEnemy } from './ai-utils';

type StrategicTarget = {
  source: 'enemy' | 'objective';
  index: number;
  position: Position;
  distance: number;
  sourcePriority: number;
};

type StrategicProbe = {
  source: 'enemy' | 'objective';
  index: number;
  targetPosition: Position;
  endpoint: Position;
  score: number;
  needsFineResolution: boolean;
  distanceToTarget: number;
};

export function snapToBoardCell(position: Position, battlefield: Battlefield): Position {
  const x = Math.max(0, Math.min(battlefield.width - 1, Math.round(position.x)));
  const y = Math.max(0, Math.min(battlefield.height - 1, Math.round(position.y)));
  return { x, y };
}

export function dedupePositions(positions: Position[], battlefield: Battlefield): Position[] {
  const seen = new Set<string>();
  const unique: Position[] = [];
  for (const pos of positions) {
    const snapped = snapToBoardCell(pos, battlefield);
    const key = `${snapped.x},${snapped.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(snapped);
  }
  return unique;
}

export function sampleStrategicPositions(
  context: AIContext,
  characterPos: Position,
  session: EvaluationSession,
  getInteractableObjectiveMarkers: (context: AIContext) => NonNullable<AIContext['objectiveMarkers']>,
  tryConsumeStrategicPathBudget: (session: EvaluationSession) => boolean
): Position[] {
  if (session.strategicPathQueryBudget <= 0) {
    return [];
  }
  const gameSize = String(context.config.gameSize ?? '').toUpperCase();
  const fastStrategicPathing = gameSize === 'VERY_SMALL' || gameSize === 'SMALL';
  const mov = context.character.finalAttributes.mov ?? context.character.attributes.mov ?? 2;
  const movementAllowance = Math.max(1, mov + 2);
  const footprintDiameter = getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? 3);
  const engine = session.pathEngine;
  const candidates: StrategicTarget[] = [];

  const candidateEnemies = context.enemies
    .map(enemy => {
      if (!isAttackableEnemy(context.character, enemy, context.config)) return null;
      // Keep strategic approach probes even without immediate LOS so dense boards
      // still produce directed advance toward known enemy positions.
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) return null;
      return {
        position: enemyPos,
        distance: Math.hypot(characterPos.x - enemyPos.x, characterPos.y - enemyPos.y),
      };
    })
    .filter((entry): entry is { position: Position; distance: number } => Boolean(entry))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, session.strategicEnemyLimit);

  for (const enemy of candidateEnemies) {
    candidates.push({
      source: 'enemy',
      index: candidates.length,
      position: enemy.position,
      distance: enemy.distance,
      sourcePriority: 1.0,
    });
  }

  const objectiveMarkers = getInteractableObjectiveMarkers(context)
    .filter(marker => marker.position)
    .sort((a, b) => {
      const posA = a.position as Position;
      const posB = b.position as Position;
      const distA = Math.hypot(characterPos.x - posA.x, characterPos.y - posA.y);
      const distB = Math.hypot(characterPos.x - posB.x, characterPos.y - posB.y);
      return distA - distB;
    })
    .slice(0, session.strategicObjectiveLimit);

  for (const marker of objectiveMarkers) {
    const markerPos = marker.position as Position;
    const markerDistance = Math.hypot(characterPos.x - markerPos.x, characterPos.y - markerPos.y);
    candidates.push({
      source: 'objective',
      index: candidates.length,
      position: markerPos,
      distance: markerDistance,
      sourcePriority: 1.12,
    });
  }

  if (candidates.length === 0) {
    return [];
  }

  const reserveForRefinement = Math.min(session.strategicRefineTopK, session.strategicPathQueryBudget);
  const maxCoarseProbes = Math.max(1, session.strategicPathQueryBudget - reserveForRefinement);
  const coarseProbes: StrategicProbe[] = [];

  // R8: Use multi-goal pathfinding for 10+ candidates (shared search tree optimization)
  // For fewer candidates, individual queries are faster due to lower overhead
  const useMultiGoal = candidates.length >= 10;

  if (useMultiGoal) {
    // R8: Batch path query with shared search tree
    const multiGoalEngine = createMultiGoalPathfinding(context.battlefield);
    const candidatePositions = candidates.slice(0, maxCoarseProbes).map(c => c.position);

    const multiGoalOptions: MultiGoalPathOptions = {
      footprintDiameter,
      movementMetric: 'length',
      useNavMesh: !fastStrategicPathing,
      useHierarchical: !fastStrategicPathing,
      optimizeWithLOS: false,
      useTheta: false,
      turnPenalty: 0,
      portalNarrowPenalty: 0.08,
      portalNarrowThresholdFactor: 1.25,
      gridResolution: fastStrategicPathing ? 1.0 : session.strategicCoarseResolution,
      maxMu: movementAllowance,
      maxDestinations: maxCoarseProbes,
    };

    const multiResult = multiGoalEngine.findPathsToMultipleGoals(
      characterPos,
      candidatePositions,
      multiGoalOptions
    );

    // Convert multi-goal results to strategic probes
    for (let i = 0; i < candidatePositions.length && i < candidates.length; i++) {
      if (!tryConsumeStrategicPathBudget(session)) break;

      const candidate = candidates[i];
      const path = multiResult.destinations.get(
        `${candidate.position.x.toFixed(2)},${candidate.position.y.toFixed(2)}`
      );

      if (!path || path.points.length === 0) continue;

      const coarseEnd = path.points[path.points.length - 1];
      const distanceToTarget = Math.hypot(coarseEnd.x - candidate.position.x, coarseEnd.y - candidate.position.y);
      const progress = Math.max(0, candidate.distance - distanceToTarget) / Math.max(1, candidate.distance);
      const coarseTravelBase = Math.max(0.25, Math.min(candidate.distance, movementAllowance));
      const detourRatio = path.totalLength / coarseTravelBase;
      const needsFineResolution =
        detourRatio >= 1.35 ||
        (!path.reachedEnd && distanceToTarget > 1.25) ||
        (footprintDiameter <= 1.0 && detourRatio >= 1.18);
      const score =
        (progress * 1.8) +
        (candidate.sourcePriority * 0.6) +
        (path.reachedEnd ? 0.35 : 0) -
        (Math.max(0, detourRatio - 1.15) * 0.2);

      coarseProbes.push({
        source: candidate.source,
        index: candidate.index,
        targetPosition: candidate.position,
        endpoint: snapToBoardCell(coarseEnd, context.battlefield),
        score,
        needsFineResolution,
        distanceToTarget,
      });
    }
  } else {
    // Legacy: Individual path queries for 1-2 candidates
    for (let i = 0; i < candidates.length && i < maxCoarseProbes; i++) {
      const candidate = candidates[i];
      if (!tryConsumeStrategicPathBudget(session)) break;
      const coarse = engine.findPathWithMaxMu(
        characterPos,
        candidate.position,
        {
          footprintDiameter,
          movementMetric: 'length',
          useNavMesh: !fastStrategicPathing,
          useHierarchical: !fastStrategicPathing,
          optimizeWithLOS: false,
          useTheta: false,
          turnPenalty: 0,
          portalNarrowPenalty: 0.08,
          portalNarrowThresholdFactor: 1.25,
          gridResolution: fastStrategicPathing ? 1.0 : session.strategicCoarseResolution,
        },
        movementAllowance
      );
      const coarseEnd = coarse.points[coarse.points.length - 1];
      if (!coarseEnd) continue;

      const distanceToTarget = Math.hypot(coarseEnd.x - candidate.position.x, coarseEnd.y - candidate.position.y);
      const progress = Math.max(0, candidate.distance - distanceToTarget) / Math.max(1, candidate.distance);
      const coarseTravelBase = Math.max(0.25, Math.min(candidate.distance, movementAllowance));
      const detourRatio = coarse.totalLength / coarseTravelBase;
      const needsFineResolution =
        detourRatio >= 1.35 ||
        (!coarse.reachedEnd && distanceToTarget > 1.25) ||
        (footprintDiameter <= 1.0 && detourRatio >= 1.18);
      const score =
        (progress * 1.8) +
        (candidate.sourcePriority * 0.6) +
        (coarse.reachedEnd ? 0.35 : 0) -
        (Math.max(0, detourRatio - 1.15) * 0.2);

      coarseProbes.push({
        source: candidate.source,
        index: candidate.index,
        targetPosition: candidate.position,
        endpoint: snapToBoardCell(coarseEnd, context.battlefield),
        score,
        needsFineResolution,
        distanceToTarget,
      });
    }
  }

  if (coarseProbes.length === 0) {
    return [];
  }

  // Adaptive granularity:
  // - use coarse probes for broad ranking,
  // - refine only top-K trajectories with 0.5 MU default,
  // - escalate to 0.25 MU when coarse probe indicates chokepoint/clearance contention.
  const topForRefinement = coarseProbes
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.distanceToTarget !== b.distanceToTarget) return a.distanceToTarget - b.distanceToTarget;
      return a.index - b.index;
    });
  const refinementCandidates = topForRefinement.filter(probe => probe.needsFineResolution);
  const probesForRefinement = fastStrategicPathing
    ? refinementCandidates.slice(0, Math.min(1, session.strategicRefineTopK))
    : refinementCandidates.slice(0, session.strategicRefineTopK);
  const refinedByIndex = new Map<number, Position>();

  for (const probe of probesForRefinement) {
    if (!tryConsumeStrategicPathBudget(session)) break;
    const refined = engine.findPathWithMaxMu(
      characterPos,
      probe.targetPosition,
      {
        footprintDiameter,
        movementMetric: 'length',
        useNavMesh: !fastStrategicPathing,
        useHierarchical: !fastStrategicPathing,
        optimizeWithLOS: !fastStrategicPathing,
        useTheta: !fastStrategicPathing,
        turnPenalty: fastStrategicPathing ? 0 : 0.1,
        portalNarrowPenalty: fastStrategicPathing ? 0.08 : 0.18,
        portalNarrowThresholdFactor: 1.35,
        gridResolution: fastStrategicPathing
          ? 0.75
          : (probe.needsFineResolution ? 0.25 : session.strategicDefaultResolution),
      },
      movementAllowance
    );
    const refinedEnd = refined.points[refined.points.length - 1];
    if (!refinedEnd) continue;
    refinedByIndex.set(probe.index, snapToBoardCell(refinedEnd, context.battlefield));
  }

  const refinedFirst = coarseProbes
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(probe => refinedByIndex.get(probe.index) ?? probe.endpoint);
  return refinedFirst;
}
