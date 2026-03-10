import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { resolveDeclaredWeapon } from './declared-weapon';

export type ReactTriggerType = 'Move' | 'NonMove';

export interface ReactActionDeps {
  battlefield: Battlefield | null;
  reactingNow: Set<string>;
  reactedThisTurn: Set<string>;
  getActiveCharacterId: () => string | null;
  setActiveCharacterId: (characterId: string | null) => void;
  getCharacterPosition: (character: Character) => import('../battlefield/Position').Position | undefined;
  applyInterruptCost: (character: Character) => { removedWait: boolean; delayAdded: boolean };
  executeRangedAttack: (
    attacker: Character,
    defender: Character,
    weapon: import('../core/Item').Item,
    options: {
      attacker: import('../battlefield/spatial/spatial-rules').SpatialModel;
      target: import('../battlefield/spatial/spatial-rules').SpatialModel;
      context?: import('../utils/TestContext').TestContext;
      weaponIndex?: number;
    }
  ) => unknown;
}

export function executeStandardReact(
  deps: ReactActionDeps,
  reactor: Character,
  target: Character,
  weapon: import('../core/Item').Item,
  options: { context?: import('../utils/TestContext').TestContext; visibilityOrMu?: number } = {}
) {
  if (!deps.battlefield) {
    throw new Error('Battlefield not set.');
  }
  if (!reactor.state.isWaiting) {
    return { executed: false, reason: 'Requires Wait status.' };
  }
  if (deps.reactingNow.has(reactor.id)) {
    return { executed: false, reason: 'Already reacting.' };
  }
  if (deps.reactedThisTurn.has(reactor.id)) {
    return { executed: false, reason: 'Already reacted this turn.' };
  }

  const reactorPos = deps.getCharacterPosition(reactor);
  const targetPos = deps.getCharacterPosition(target);
  if (!reactorPos || !targetPos) {
    return { executed: false, reason: 'Missing positions.' };
  }

  const reactorModel: import('../battlefield/spatial/spatial-rules').SpatialModel = {
    id: reactor.id,
    position: reactorPos,
    baseDiameter: getBaseDiameterFromSiz(reactor.finalAttributes.siz ?? reactor.attributes.siz ?? 3),
    siz: reactor.finalAttributes.siz ?? reactor.attributes.siz ?? 3,
  };
  const targetModel: import('../battlefield/spatial/spatial-rules').SpatialModel = {
    id: target.id,
    position: targetPos,
    baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3),
    siz: target.finalAttributes.siz ?? target.attributes.siz ?? 3,
  };
  if (!SpatialRules.hasLineOfSight(deps.battlefield, reactorModel, targetModel)) {
    return { executed: false, reason: 'Requires LOS.' };
  }
  const baseVisibility = options.visibilityOrMu ?? 16;
  const effectiveVisibility = reactor.state.isWaiting ? baseVisibility * 2 : baseVisibility;
  const edgeDistance = SpatialRules.distanceEdgeToEdge(reactorModel, targetModel);
  if (edgeDistance > effectiveVisibility) {
    return { executed: false, reason: 'Target outside React visibility.' };
  }

  deps.reactingNow.add(reactor.id);
  deps.applyInterruptCost(reactor);
  deps.reactedThisTurn.add(reactor.id);
  const previousActiveCharacterId = deps.getActiveCharacterId();
  deps.setActiveCharacterId(reactor.id);

  try {
    const resolved = resolveDeclaredWeapon(reactor, weapon);
    const result = deps.executeRangedAttack(reactor, target, resolved.weapon, {
      attacker: reactorModel,
      target: targetModel,
      context: options.context,
      weaponIndex: resolved.weaponIndex,
    });

    return { executed: true, result };
  } finally {
    deps.setActiveCharacterId(previousActiveCharacterId);
    deps.reactingNow.delete(reactor.id);
  }
}

export function executeReactAction(
  deps: ReactActionDeps,
  reactor: Character,
  action: () => unknown
) {
  if (!reactor.state.isWaiting) {
    return { executed: false, reason: 'Requires Wait status.' };
  }
  if (deps.reactingNow.has(reactor.id)) {
    return { executed: false, reason: 'Already reacting.' };
  }
  if (deps.reactedThisTurn.has(reactor.id)) {
    return { executed: false, reason: 'Already reacted this turn.' };
  }

  deps.reactingNow.add(reactor.id);
  deps.applyInterruptCost(reactor);
  deps.reactedThisTurn.add(reactor.id);
  const previousActiveCharacterId = deps.getActiveCharacterId();
  deps.setActiveCharacterId(reactor.id);

  try {
    const result = action();
    return { executed: true, result };
  } finally {
    deps.setActiveCharacterId(previousActiveCharacterId);
    deps.reactingNow.delete(reactor.id);
  }
}

export interface ReactEvent {
  battlefield: Battlefield;
  active: Character;
  opponents: Character[];
  trigger: ReactTriggerType;
  movedDistance?: number;
  visibilityOrMu?: number;
  reactingToReact?: boolean;
  reactingToEngaged?: boolean;
  isGroupAction?: boolean;
}

export interface ReactOption {
  actor: Character;
  target: Character;
  type: 'StandardReact' | 'ReactAction';
  available: boolean;
  requiredRef: number;
  effectiveRef: number;
  reason?: string;
}

export function sortReactOptions(options: ReactOption[]): ReactOption[] {
  return [...options].sort((a, b) => {
    if (b.effectiveRef !== a.effectiveRef) return b.effectiveRef - a.effectiveRef;
    const bInit = b.actor.initiative ?? 0;
    const aInit = a.actor.initiative ?? 0;
    if (bInit !== aInit) return bInit - aInit;
    return a.actor.name.localeCompare(b.actor.name);
  });
}

export function buildReactOptions(event: ReactEvent): ReactOption[] {
  const options: ReactOption[] = [];
  const activePos = event.battlefield.getCharacterPosition(event.active);
  if (!activePos) return options;
  const baseVisibility = event.visibilityOrMu ?? 16;
  const activeRef = event.active.finalAttributes.ref ?? event.active.attributes.ref ?? 0;
  const activeMov = event.active.finalAttributes.mov ?? event.active.attributes.mov ?? 0;
  const activeBase = getBaseDiameterFromSiz(event.active.finalAttributes.siz ?? event.active.attributes.siz ?? 3);
  const movedDistance = event.movedDistance ?? 0;
  const requiresMovementTrigger = movedDistance >= activeBase / 2;

  for (const opponent of event.opponents) {
    if (!opponent.state.isWaiting) {
      options.push({
        actor: opponent,
        target: event.active,
        type: event.trigger === 'Move' ? 'StandardReact' : 'ReactAction',
        available: false,
        requiredRef: 0,
        effectiveRef: 0,
        reason: 'Requires Wait status.',
      });
      continue;
    }
    const opponentPos = event.battlefield.getCharacterPosition(opponent);
    if (!opponentPos) continue;
    const opponentModel = {
      id: opponent.id,
      position: opponentPos,
      baseDiameter: getBaseDiameterFromSiz(opponent.finalAttributes.siz ?? opponent.attributes.siz ?? 3),
      siz: opponent.finalAttributes.siz ?? opponent.attributes.siz ?? 3,
    };
    const activeModel = {
      id: event.active.id,
      position: activePos,
      baseDiameter: activeBase,
      siz: event.active.finalAttributes.siz ?? event.active.attributes.siz ?? 3,
    };
    const hasLOS = SpatialRules.hasLineOfSight(event.battlefield, opponentModel, activeModel);
    if (!hasLOS) {
      options.push({
        actor: opponent,
        target: event.active,
        type: event.trigger === 'Move' ? 'StandardReact' : 'ReactAction',
        available: false,
        requiredRef: 0,
        effectiveRef: 0,
        reason: 'Requires LOS.',
      });
      continue;
    }
    const effectiveVisibility = opponent.state.isWaiting ? baseVisibility * 2 : baseVisibility;
    const edgeDistance = SpatialRules.distanceEdgeToEdge(opponentModel, activeModel);
    if (edgeDistance > effectiveVisibility) {
      options.push({
        actor: opponent,
        target: event.active,
        type: event.trigger === 'Move' ? 'StandardReact' : 'ReactAction',
        available: false,
        requiredRef: 0,
        effectiveRef: 0,
        reason: 'Target outside React visibility.',
      });
      continue;
    }

    const waitBonus = opponent.state.isWaiting ? 1 : 0;
    const soloBonus = event.isGroupAction ? 1 : 0;
    // QSR Line 470: Overreach -1 REF penalty
    const overreachPenalty = opponent.state.isOverreach ? -1 : 0;
    const effectiveRef = (opponent.finalAttributes.ref ?? opponent.attributes.ref ?? 0) + waitBonus + soloBonus + overreachPenalty;
    const requiredRefBase = event.trigger === 'Move' ? activeMov : activeRef;
    const reactedToEngaged = event.reactingToEngaged ?? (
      event.trigger === 'Move' && SpatialRules.isEngaged(opponentModel, activeModel)
    );
    // QSR ReactAction nuance: Abrupt (NonMove) reactions require higher REF than the active threshold.
    const abruptHigherRefBonus = event.trigger === 'NonMove' ? 1 : 0;
    const requiredRef = requiredRefBase
      + abruptHigherRefBonus
      + (reactedToEngaged ? 1 : 0)
      + (event.reactingToReact ? 1 : 0);
    const available = effectiveRef >= requiredRef
      && (event.trigger !== 'Move' || requiresMovementTrigger);
    options.push({
      actor: opponent,
      target: event.active,
      type: event.trigger === 'Move' ? 'StandardReact' : 'ReactAction',
      available,
      requiredRef,
      effectiveRef,
      reason: available
        ? undefined
        : event.trigger === 'Move' && !requiresMovementTrigger
          ? 'Move did not trigger Standard react threshold.'
          : 'Insufficient REF to React.',
    });
  }

  return options;
}

// Backward compatibility aliases for older tests/callers
export const getReactOptions = buildReactOptions;
export function getReactOptionsSorted(event: ReactEvent): ReactOption[] {
  return sortReactOptions(buildReactOptions(event));
}
