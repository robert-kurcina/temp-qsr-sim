import { Position } from '../battlefield/Position';

export type ObjectiveMarkerKind = 'Switch' | 'Lock' | 'Key' | 'Idea' | 'Tiny' | 'Small' | 'Large' | 'Bulky';
export type ObjectiveMarkerState = 'Neutral' | 'Carried' | 'Destroyed';
export type SwitchState = 'On' | 'Off';

export interface ObjectiveMarker {
  id: string;
  kinds: ObjectiveMarkerKind[];
  position: Position;
  state: ObjectiveMarkerState;
  carrierId?: string;
  ownerSideId?: string;
  switchState?: SwitchState;
  lockId?: string;
  keyId?: string;
  scoringSideId?: string;
  sharedSideIds?: string[];
  toggledBySideId?: string;
}

export interface ObjectiveMarkerActionContext {
  actorId: string;
  sideId: string;
  apAvailable: number;
  isFree: boolean;
  isAttentive: boolean;
  isOrdered: boolean;
  opposingAttentiveInContact: number;
  hindrance?: number;
  keysInHand?: string[];
}

export interface ObjectiveMarkerActionResult {
  success: boolean;
  apCost: number;
  reason?: string;
  marker: ObjectiveMarker;
}

export function createObjectiveMarker(input: Partial<ObjectiveMarker> & Pick<ObjectiveMarker, 'id' | 'kinds' | 'position'>): ObjectiveMarker {
  return {
    id: input.id,
    kinds: input.kinds,
    position: input.position,
    state: input.state ?? 'Neutral',
    carrierId: input.carrierId,
    ownerSideId: input.ownerSideId,
    switchState: input.switchState ?? (input.kinds.includes('Switch') || input.kinds.includes('Lock') ? 'Off' : undefined),
    lockId: input.lockId,
    keyId: input.keyId,
    scoringSideId: input.scoringSideId,
    sharedSideIds: input.sharedSideIds ?? [],
    toggledBySideId: input.toggledBySideId,
  };
}

export function isSwitch(marker: ObjectiveMarker): boolean {
  return marker.kinds.includes('Switch') || marker.kinds.includes('Lock');
}

export function isIdea(marker: ObjectiveMarker): boolean {
  return marker.kinds.includes('Idea');
}

export function isPhysical(marker: ObjectiveMarker): boolean {
  return !isSwitch(marker) && !isIdea(marker);
}

export function requiresKey(marker: ObjectiveMarker): boolean {
  return marker.kinds.includes('Lock');
}

export function canAcquireObjective(marker: ObjectiveMarker, context: ObjectiveMarkerActionContext): ObjectiveMarkerActionResult {
  if (marker.state === 'Destroyed') {
    return { success: false, apCost: 0, reason: 'destroyed', marker };
  }
  if (!context.isFree) {
    return { success: false, apCost: 0, reason: 'not-free', marker };
  }
  if (context.opposingAttentiveInContact > 0) {
    return { success: false, apCost: 0, reason: 'opposing-contact', marker };
  }
  const apCost = isPhysical(marker) && marker.kinds.includes('Tiny') ? 2 : 1;
  if (context.apAvailable < apCost) {
    return { success: false, apCost, reason: 'insufficient-ap', marker };
  }
  if (requiresKey(marker)) {
    const keyId = marker.keyId || marker.lockId;
    if (keyId && !context.keysInHand?.includes(keyId)) {
      return { success: false, apCost, reason: 'missing-key', marker };
    }
  }
  return { success: true, apCost, marker };
}

export function acquireObjectiveMarker(marker: ObjectiveMarker, context: ObjectiveMarkerActionContext): ObjectiveMarkerActionResult {
  const check = canAcquireObjective(marker, context);
  if (!check.success) return check;

  if (isSwitch(marker)) {
    const nextState: SwitchState = marker.switchState === 'On' ? 'Off' : 'On';
    const toggledBySideId = marker.toggledBySideId ?? context.sideId;
    return {
      success: true,
      apCost: check.apCost,
      marker: {
        ...marker,
        switchState: nextState,
        toggledBySideId,
        scoringSideId: marker.scoringSideId ?? context.sideId,
      },
    };
  }

  if (isIdea(marker)) {
    const shared = new Set(marker.sharedSideIds ?? []);
    shared.add(context.sideId);
    return {
      success: true,
      apCost: check.apCost,
      marker: {
        ...marker,
        state: 'Carried',
        carrierId: context.actorId,
        ownerSideId: context.sideId,
        scoringSideId: marker.scoringSideId ?? context.sideId,
        sharedSideIds: Array.from(shared),
      },
    };
  }

  return {
    success: true,
    apCost: check.apCost,
    marker: {
      ...marker,
      state: 'Carried',
      carrierId: context.actorId,
      ownerSideId: context.sideId,
      scoringSideId: marker.scoringSideId ?? context.sideId,
    },
  };
}

export function transferObjectiveMarker(
  marker: ObjectiveMarker,
  context: ObjectiveMarkerActionContext,
  targetSideId: string,
  targetActorId: string
): ObjectiveMarkerActionResult {
  if (marker.state === 'Destroyed') {
    return { success: false, apCost: 0, reason: 'destroyed', marker };
  }
  if (!isPhysical(marker)) {
    return { success: false, apCost: 0, reason: 'not-physical', marker };
  }
  if (context.apAvailable < 1) {
    return { success: false, apCost: 1, reason: 'insufficient-ap', marker };
  }
  if (!(context.isAttentive || context.isOrdered)) {
    return { success: false, apCost: 1, reason: 'not-attentive-ordered', marker };
  }
  return {
    success: true,
    apCost: 1,
    marker: {
      ...marker,
      state: 'Carried',
      carrierId: targetActorId,
      ownerSideId: targetSideId,
      scoringSideId: marker.scoringSideId ?? targetSideId,
    },
  };
}

export function shareObjectiveMarker(
  marker: ObjectiveMarker,
  context: ObjectiveMarkerActionContext,
  targetSideId: string
): ObjectiveMarkerActionResult {
  if (!isIdea(marker)) {
    return { success: false, apCost: 0, reason: 'not-idea', marker };
  }
  const hindrance = context.hindrance ?? 0;
  const apCost = 1 + Math.max(0, hindrance);
  if (context.apAvailable < apCost) {
    return { success: false, apCost, reason: 'insufficient-ap', marker };
  }
  if (!context.isFree || !context.isAttentive || !context.isOrdered) {
    return { success: false, apCost, reason: 'not-attentive-free', marker };
  }
  const shared = new Set(marker.sharedSideIds ?? []);
  shared.add(context.sideId);
  shared.add(targetSideId);
  return {
    success: true,
    apCost,
    marker: {
      ...marker,
      sharedSideIds: Array.from(shared),
      scoringSideId: marker.scoringSideId ?? context.sideId,
    },
  };
}

export function dropObjectiveMarker(marker: ObjectiveMarker, position: Position): ObjectiveMarker {
  if (!isPhysical(marker)) {
    return marker;
  }
  return {
    ...marker,
    state: 'Neutral',
    carrierId: undefined,
    ownerSideId: undefined,
    position,
  };
}

export function destroyObjectiveMarker(marker: ObjectiveMarker, context: ObjectiveMarkerActionContext): ObjectiveMarkerActionResult {
  if (!isPhysical(marker)) {
    return { success: false, apCost: 0, reason: 'not-physical', marker };
  }
  if (context.apAvailable < 1) {
    return { success: false, apCost: 1, reason: 'insufficient-ap', marker };
  }
  return {
    success: true,
    apCost: 1,
    marker: {
      ...marker,
      state: 'Destroyed',
      carrierId: undefined,
      ownerSideId: undefined,
    },
  };
}
