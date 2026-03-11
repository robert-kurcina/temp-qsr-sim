import type { Character } from '../../core/Character';
import type { Position } from '../../battlefield/Position';
import type { AIContext, AIObjectiveMarkerInfo } from './AIController';
import type { MissionBias } from './UtilityScorerDoctrineSupport';

export interface ObjectiveScoredAction {
  action: 'fiddle';
  objectiveAction: 'acquire_marker' | 'share_marker' | 'transfer_marker' | 'destroy_marker';
  markerId?: string;
  markerTargetModelId?: string;
  score: number;
  factors: Record<string, number>;
}

type DoctrinePlanning = 'aggression' | 'keys_to_victory' | 'balanced';

function objectivePriorityBoost(doctrinePlanning: DoctrinePlanning): number {
  if (doctrinePlanning === 'keys_to_victory') {
    return 0.9;
  }
  if (doctrinePlanning === 'aggression') {
    return -0.35;
  }
  return 0;
}

export function getInteractableObjectiveMarkers(
  context: AIContext
): NonNullable<AIContext['objectiveMarkers']> {
  const markers = context.objectiveMarkers ?? [];
  return markers.filter(marker =>
    marker.interactable !== false &&
    marker.state !== 'Destroyed' &&
    marker.state !== 'Scored'
  );
}

function buildNearbyAllyDistances(context: AIContext, actorPos: Position): { ally: Character; distance: number }[] {
  return context.allies
    .filter(ally => !ally.state.isEliminated && !ally.state.isKOd)
    .map(ally => {
      const allyPos = context.battlefield.getCharacterPosition(ally);
      return allyPos
        ? { ally, distance: Math.hypot(actorPos.x - allyPos.x, actorPos.y - allyPos.y) }
        : null;
    })
    .filter((entry): entry is { ally: Character; distance: number } => Boolean(entry))
    .sort((a, b) => a.distance - b.distance);
}

export function evaluateObjectiveMarkerActions(
  context: AIContext,
  missionBias: MissionBias,
  doctrinePlanning: DoctrinePlanning
): ObjectiveScoredAction[] {
  const markers = getInteractableObjectiveMarkers(context);
  if (markers.length === 0) {
    return [];
  }

  const actorPos = context.battlefield.getCharacterPosition(context.character);
  if (!actorPos) {
    return [];
  }

  const actions: ObjectiveScoredAction[] = [];
  const sideId = context.sideId;
  const priorityBoost = objectivePriorityBoost(doctrinePlanning);

  for (const marker of markers) {
    const isSwitchOrLock = marker.omTypes.includes('Switch') || marker.omTypes.includes('Lock');
    const isIdea = marker.omTypes.includes('Idea');
    const isPhysical = marker.omTypes.some(type =>
      type === 'Tiny' || type === 'Small' || type === 'Large' || type === 'Bulky'
    );
    const markerPosition = marker.position;
    const distanceToMarker = markerPosition
      ? Math.hypot(actorPos.x - markerPosition.x, actorPos.y - markerPosition.y)
      : Number.POSITIVE_INFINITY;
    const isAdjacent = distanceToMarker <= 1.25;
    const isCarriedByActor = marker.carriedBy === context.character.id;
    const markerIsAvailable = marker.state === 'Available' || marker.state === 'Dropped';

    if (isAdjacent && (markerIsAvailable || isSwitchOrLock)) {
      let score =
        2.2 +
        (missionBias.objectiveActionPressure * 2.1) +
        priorityBoost;
      if (marker.missionSource === 'assault') {
        score += 2.4;
      } else if (marker.missionSource === 'breach') {
        score += 1.2;
      }
      if (isSwitchOrLock) score += 0.6;
      if (isIdea) score += 0.4;
      if (isPhysical) score += 0.3;
      if (sideId && marker.scoringSideId && marker.scoringSideId !== sideId) {
        score += 0.7;
      }

      actions.push({
        action: 'fiddle',
        objectiveAction: 'acquire_marker',
        markerId: marker.id,
        score,
        factors: {
          objectivePressure: missionBias.objectiveActionPressure,
          adjacent: 1,
          switchOrLock: isSwitchOrLock ? 1 : 0,
          idea: isIdea ? 1 : 0,
          physical: isPhysical ? 1 : 0,
        },
      });
    }

    if (isCarriedByActor && sideId) {
      const nearbyAllies = buildNearbyAllyDistances(context, actorPos);

      if (isIdea) {
        const shareTarget = nearbyAllies.find(entry => entry.distance <= 2);
        if (shareTarget) {
          const shareScore =
            1.8 +
            (missionBias.objectiveActionPressure * 1.7) +
            priorityBoost +
            (2 - Math.min(2, shareTarget.distance)) * 0.25;
          actions.push({
            action: 'fiddle',
            objectiveAction: 'share_marker',
            markerId: marker.id,
            markerTargetModelId: shareTarget.ally.id,
            score: shareScore,
            factors: {
              objectivePressure: missionBias.objectiveActionPressure,
              allyDistance: shareTarget.distance,
              idea: 1,
            },
          });
        }
      }

      if (isPhysical && (context.character.state.wounds > 0 || context.character.state.delayTokens > 0)) {
        const transferTarget = nearbyAllies.find(entry => entry.distance <= 1.25);
        if (transferTarget) {
          const transferScore =
            1.55 +
            (missionBias.objectiveActionPressure * 1.45) +
            priorityBoost +
            (context.character.state.wounds > 0 ? 0.4 : 0);
          actions.push({
            action: 'fiddle',
            objectiveAction: 'transfer_marker',
            markerId: marker.id,
            markerTargetModelId: transferTarget.ally.id,
            score: transferScore,
            factors: {
              objectivePressure: missionBias.objectiveActionPressure,
              allyDistance: transferTarget.distance,
              woundedCarrier: context.character.state.wounds > 0 ? 1 : 0,
            },
          });
        }
      }
    }

    if (
      isAdjacent &&
      marker.state !== 'Destroyed' &&
      marker.state !== 'Scored' &&
      sideId &&
      marker.scoringSideId &&
      marker.scoringSideId !== sideId &&
      !isSwitchOrLock
    ) {
      const destroyScore =
        1.35 +
        (missionBias.objectiveActionPressure * 1.2) +
        (doctrinePlanning === 'aggression' ? 0.2 : 0);
      actions.push({
        action: 'fiddle',
        objectiveAction: 'destroy_marker',
        markerId: marker.id,
        score: destroyScore,
        factors: {
          objectivePressure: missionBias.objectiveActionPressure,
          enemyControlled: 1,
        },
      });
    }
  }

  return actions;
}

function markersWithPositions(
  markers: AIObjectiveMarkerInfo[]
): Array<AIObjectiveMarkerInfo & { position: Position }> {
  return markers.filter((marker): marker is AIObjectiveMarkerInfo & { position: Position } =>
    Boolean(marker.position)
  );
}

export function evaluateObjectiveAdvance(
  position: Position,
  context: AIContext,
  objectiveAdvanceCache: Map<string, number>,
  toPositionKey: (position: Position) => string
): number {
  const cacheKey = toPositionKey(position);
  const cached = objectiveAdvanceCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const actorPos = context.battlefield.getCharacterPosition(context.character);
  if (!actorPos) {
    return 0;
  }

  const markers = markersWithPositions(getInteractableObjectiveMarkers(context));
  if (markers.length === 0) {
    return 0;
  }

  let bestAdvance = 0;
  for (const marker of markers) {
    const markerPos = marker.position;
    const currentDistance = Math.hypot(actorPos.x - markerPos.x, actorPos.y - markerPos.y);
    if (currentDistance <= 1.25) {
      continue;
    }
    const nextDistance = Math.hypot(position.x - markerPos.x, position.y - markerPos.y);
    if (nextDistance >= currentDistance) {
      continue;
    }
    const normalizedGain = (currentDistance - nextDistance) / Math.max(1, currentDistance);
    const adjacencyBonus = nextDistance <= 1.25 ? 0.45 : 0;
    bestAdvance = Math.max(bestAdvance, normalizedGain + adjacencyBonus);
  }

  objectiveAdvanceCache.set(cacheKey, bestAdvance);
  return bestAdvance;
}
