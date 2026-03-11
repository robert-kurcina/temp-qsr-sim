import type { AIContext } from './AIController';
import type { ScoredAction } from './UtilityScorer';
import type { Character } from '../../core/Character';
import type { Position } from '../../battlefield/Position';

export interface TacticalPatchSnapshotForKey {
  category: string;
  friendlyBp: number;
  enemyBp: number;
  objectiveDistance: number;
  supportBalance: number;
  adjacencyControl: number;
  laneThreatScore: number;
  scrumPressure: number;
  objectiveProgress: number;
}

export interface MinimaxCacheKeyDeps {
  hasMeleeThreatProfile(character: Character): boolean;
  hasRangedThreatProfile(character: Character): boolean;
  hashCompactState(raw: string): string;
}

export function buildMinimaxTranspositionKey(
  context: AIContext,
  action: ScoredAction,
  actorPosition: Position,
  depth: number,
  opponentSamples: number,
  currentPatch: TacticalPatchSnapshotForKey,
  projectedPatch: TacticalPatchSnapshotForKey,
  deps: MinimaxCacheKeyDeps
): string {
  const patchSignature = [
    `patch:${currentPatch.category}->${projectedPatch.category}`,
    `bp:${projectedPatch.friendlyBp.toFixed(1)}:${projectedPatch.enemyBp.toFixed(1)}`,
    `obj:${projectedPatch.objectiveDistance.toFixed(1)}:${projectedPatch.objectiveProgress.toFixed(2)}`,
    `sup:${projectedPatch.supportBalance.toFixed(2)}`,
    `adj:${projectedPatch.adjacencyControl.toFixed(2)}`,
    `lane:${projectedPatch.laneThreatScore.toFixed(2)}`,
    `scr:${projectedPatch.scrumPressure.toFixed(2)}`,
  ].join(':');
  const tacticalStateSignature = buildCompactTacticalStateSignature(
    context,
    actorPosition,
    action,
    currentPatch,
    projectedPatch,
    deps
  );
  return [
    `actor:${context.character.id}`,
    `ap:${context.apRemaining}`,
    `action:${action.action}`,
    `depth:${depth}`,
    `samples:${opponentSamples}`,
    patchSignature,
    `state:${tacticalStateSignature}`,
  ].join('|');
}

export function buildMinimaxHeuristicCacheKey(
  context: AIContext,
  action: ScoredAction,
  actorPosition: Position,
  depth: number,
  opponentSamples: number,
  currentPatch: TacticalPatchSnapshotForKey,
  deps: MinimaxCacheKeyDeps
): string {
  const liveEnemies = context.enemies
    .filter(enemy => !enemy.state.isKOd && !enemy.state.isEliminated)
    .map(enemy => context.battlefield.getCharacterPosition(enemy))
    .filter((pos): pos is Position => !!pos);
  const nearbyEnemy2 = liveEnemies.filter(pos => Math.hypot(pos.x - actorPosition.x, pos.y - actorPosition.y) <= 2.25).length;
  const nearbyEnemy6 = liveEnemies.filter(pos => Math.hypot(pos.x - actorPosition.x, pos.y - actorPosition.y) <= 6).length;
  const targetPos = action.target ? context.battlefield.getCharacterPosition(action.target) : null;
  const targetDistanceBucket = targetPos
    ? Math.round(Math.hypot(targetPos.x - actorPosition.x, targetPos.y - actorPosition.y))
    : -1;
  const targetWoundsBucket = action.target
    ? Math.max(0, Math.min(4, Number(action.target.state.wounds ?? 0)))
    : -1;
  const apBucket = Math.max(0, Math.min(4, Math.round(context.apRemaining)));
  const objectiveCountBucket = Math.max(0, Math.min(4, (context.objectiveMarkers ?? []).length));
  const actorRole = `${deps.hasMeleeThreatProfile(context.character) ? 'm' : '-'}${deps.hasRangedThreatProfile(context.character) ? 'r' : '-'}`;
  const allyTopology = context.allies
    .filter(ally => !ally.state.isKOd && !ally.state.isEliminated)
    .map(ally => {
      const pos = context.battlefield.getCharacterPosition(ally);
      if (!pos) return `${ally.id}:-1,-1`;
      return `${ally.id}:${Math.round(pos.x)},${Math.round(pos.y)}`;
    })
    .sort()
    .join(';');
  const enemyTopology = context.enemies
    .filter(enemy => !enemy.state.isKOd && !enemy.state.isEliminated)
    .map(enemy => {
      const pos = context.battlefield.getCharacterPosition(enemy);
      if (!pos) return `${enemy.id}:-1,-1`;
      return `${enemy.id}:${Math.round(pos.x)},${Math.round(pos.y)}`;
    })
    .sort()
    .join(';');
  const topologyDigest = deps.hashCompactState(`${allyTopology}|${enemyTopology}`);

  return [
    `actor:${context.character.id}`,
    `role:${actorRole}`,
    `ap:${apBucket}`,
    `action:${action.action}`,
    `depth:${depth}`,
    `samples:${opponentSamples}`,
    `patch:${currentPatch.category}`,
    `pressure:${Math.min(4, nearbyEnemy2)}/${Math.min(8, nearbyEnemy6)}`,
    `target:${targetWoundsBucket}:${targetDistanceBucket}`,
    `topo:${topologyDigest}`,
    `obj:${objectiveCountBucket}`,
  ].join('|');
}

function buildCompactTacticalStateSignature(
  context: AIContext,
  actorPosition: Position,
  action: ScoredAction,
  currentPatch: TacticalPatchSnapshotForKey,
  projectedPatch: TacticalPatchSnapshotForKey,
  deps: MinimaxCacheKeyDeps
): string {
  const allyStates = context.allies
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 8)
    .map(ally => encodeModelStateSignature(context, ally));

  const enemyStates = context.enemies
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 10)
    .map(enemy => encodeModelStateSignature(context, enemy));

  const liveEnemies = context.enemies
    .filter(enemy => !enemy.state.isKOd && !enemy.state.isEliminated)
    .map(enemy => ({
      enemy,
      pos: context.battlefield.getCharacterPosition(enemy),
    }))
    .filter((entry): entry is { enemy: Character; pos: Position } => !!entry.pos)
    .map(entry => ({
      ...entry,
      distance: Math.hypot(entry.pos.x - actorPosition.x, entry.pos.y - actorPosition.y),
    }))
    .sort((a, b) => {
      if (a.distance === b.distance) {
        return a.enemy.id.localeCompare(b.enemy.id);
      }
      return a.distance - b.distance;
    });

  const topThreats = liveEnemies.slice(0, 4);
  const losBits = topThreats
    .map(entry => context.battlefield.hasLineOfSight(actorPosition, entry.pos) ? '1' : '0')
    .join('');
  const threatCoverBits = topThreats
    .map(entry => context.battlefield.isAreaTerrainCovered(entry.pos) ? '1' : '0')
    .join('');
  const threatWoundBits = topThreats
    .map(entry => Math.max(0, Math.min(9, Number(entry.enemy.state.wounds ?? 0))).toString(10))
    .join('');

  const actorEngagedProjected = isProjectedActorEngaged(actorPosition, liveEnemies.map(entry => entry.pos));
  const actorInAreaCover = context.battlefield.isAreaTerrainCovered(actorPosition);
  const nearbyEnemy2 = liveEnemies.filter(entry => entry.distance <= 2.25).length;
  const nearbyEnemy6 = liveEnemies.filter(entry => entry.distance <= 6).length;
  const nearbyEnemy12 = liveEnemies.filter(entry => entry.distance <= 12).length;
  const engagedAllies = context.allies.filter(ally => {
    if (ally.state.isKOd || ally.state.isEliminated) return false;
    return context.battlefield.isEngaged(ally);
  }).length;
  const engagedEnemies = context.enemies.filter(enemy => {
    if (enemy.state.isKOd || enemy.state.isEliminated) return false;
    return context.battlefield.isEngaged(enemy);
  }).length;

  const objectiveSignature = (context.objectiveMarkers ?? [])
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 6)
    .map(marker => {
      const mx = marker.position ? Math.round(marker.position.x * 2) : -1;
      const my = marker.position ? Math.round(marker.position.y * 2) : -1;
      return [
        marker.id,
        marker.state,
        marker.carriedBy ?? '-',
        marker.controlledBy ?? '-',
        marker.scoringSideId ?? '-',
        marker.isNeutral ? 'n' : 'o',
        `${mx},${my}`,
      ].join(':');
    })
    .join(';');

  const targetPosition = action.target
    ? context.battlefield.getCharacterPosition(action.target)
    : null;
  const targetDistanceBucket = targetPosition
    ? Math.round(Math.hypot(targetPosition.x - actorPosition.x, targetPosition.y - actorPosition.y) * 2) / 2
    : -1;
  const targetWoundsBucket = action.target
    ? Math.max(0, Math.min(9, Number(action.target.state.wounds ?? 0)))
    : -1;
  const targetStatusBucket = action.target
    ? `${action.target.state.isKOd ? 1 : 0}${action.target.state.isEliminated ? 1 : 0}`
    : '--';
  const actionPositionBucket = action.position
    ? `${Math.round(action.position.x)},${Math.round(action.position.y)}`
    : '-';

  const raw = [
    `self:${context.character.id}:${Math.round(actorPosition.x * 2)},${Math.round(actorPosition.y * 2)}:${context.character.state.wounds}:${context.character.state.isKOd ? 1 : 0}:${context.character.state.isEliminated ? 1 : 0}`,
    `action:${action.action}:${targetWoundsBucket}:${targetStatusBucket}:${targetDistanceBucket}:${actionPositionBucket}`,
    `patch:${currentPatch.category}->${projectedPatch.category}:${Math.round(projectedPatch.friendlyBp)}:${Math.round(projectedPatch.enemyBp)}:${Math.round(projectedPatch.objectiveDistance * 2)}:${Math.round(projectedPatch.supportBalance * 10)}:${Math.round(projectedPatch.adjacencyControl * 10)}:${Math.round(projectedPatch.laneThreatScore * 10)}:${Math.round(projectedPatch.scrumPressure * 10)}:${Math.round(projectedPatch.objectiveProgress * 10)}`,
    `pressure:${nearbyEnemy2}/${nearbyEnemy6}/${nearbyEnemy12}:${engagedAllies}/${engagedEnemies}:${actorEngagedProjected ? 1 : 0}:${actorInAreaCover ? 1 : 0}`,
    `los:${losBits || 'x'}:cov:${threatCoverBits || 'x'}:wnd:${threatWoundBits || 'x'}`,
    `ally:${allyStates.join(';')}`,
    `enemy:${enemyStates.join(';')}`,
    `obj:${objectiveSignature || '-'}`,
  ].join('|');

  const digest = deps.hashCompactState(raw);
  return [
    digest,
    `p${nearbyEnemy6}`,
    `e${engagedAllies}-${engagedEnemies}`,
    `l${losBits || 'x'}`,
    `o${(context.objectiveMarkers ?? []).length}`,
  ].join(':');
}

function encodeModelStateSignature(context: AIContext, model: Character): string {
  const pos = context.battlefield.getCharacterPosition(model);
  const x = pos ? Math.round(pos.x * 2) : -1;
  const y = pos ? Math.round(pos.y * 2) : -1;
  const engaged = (!model.state.isKOd && !model.state.isEliminated && context.battlefield.isEngaged(model)) ? 1 : 0;
  const areaCover = pos && context.battlefield.isAreaTerrainCovered(pos) ? 1 : 0;
  return `${model.id}:${x},${y}:${model.state.wounds}:${model.state.isKOd ? 1 : 0}:${model.state.isEliminated ? 1 : 0}:${engaged}:${areaCover}`;
}

function isProjectedActorEngaged(actorPosition: Position, enemyPositions: Position[]): boolean {
  const projectedScrumRadius = 1.75;
  return enemyPositions.some(pos => Math.hypot(pos.x - actorPosition.x, pos.y - actorPosition.y) <= projectedScrumRadius);
}
