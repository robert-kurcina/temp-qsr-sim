import type { AIContext } from '../core/AIController';
import type { Position } from '../../battlefield/Position';
import { ObjectiveMarkerKind } from '../../mission/objective-markers';

interface ObjectiveMarkerLike {
  id: string;
  name: string;
  state: string;
  position?: Position;
  carriedBy?: string;
  scoringSideId?: string;
  controlledBy?: string;
  omTypes?: string[];
  switchState?: string;
  isNeutral?: boolean;
  metadata?: Record<string, unknown>;
}

interface ObjectiveMarkerProvider {
  getObjectiveMarkers(): ObjectiveMarkerLike[];
}

export function buildAIObjectiveMarkerSnapshot(
  provider: ObjectiveMarkerProvider
): AIContext['objectiveMarkers'] {
  const markers = provider.getObjectiveMarkers();
  return markers.map(marker => ({
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
    interactable: marker.metadata?.['aiInteractable'] === false ? false : true,
    missionSource: typeof marker.metadata?.['missionSource'] === 'string'
      ? marker.metadata['missionSource']
      : undefined,
  }));
}

export function getMarkerKeyIdsInHand(
  characterId: string,
  provider: ObjectiveMarkerProvider
): string[] {
  if (!characterId) return [];
  const markers = provider.getObjectiveMarkers();
  return markers
    .filter(marker => marker.carriedBy === characterId && (marker.omTypes ?? []).includes(ObjectiveMarkerKind.Key))
    .map(marker => marker.id);
}
