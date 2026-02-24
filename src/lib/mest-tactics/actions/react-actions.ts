import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';

export type ReactTriggerType = 'Move' | 'NonMove';

export interface ReactActionDeps {
  battlefield: Battlefield | null;
  reactingNow: Set<string>;
  reactedThisTurn: Set<string>;
  getCharacterPosition: (character: Character) => import('../battlefield/Position').Position | undefined;
  applyInterruptCost: (character: Character) => { removedWait: boolean; delayAdded: boolean };
  executeRangedAttack: (
    attacker: Character,
    defender: Character,
    weapon: import('../core/Item').Item,
    options: { attacker: import('../battlefield/spatial/spatial-rules').SpatialModel; target: import('../battlefield/spatial/spatial-rules').SpatialModel; context?: import('../utils/TestContext').TestContext }
  ) => unknown;
}

function resolveDeclaredWeapon(reactor: Character, fallback: import('../core/Item').Item) {
  const declaredIndex = reactor.state.activeWeaponIndex;
  if (declaredIndex === undefined || declaredIndex === null) {
    return fallback;
  }
  const equipment = reactor.profile?.equipment || reactor.profile?.items || [];
  const declaredWeapon = equipment[declaredIndex];
  return declaredWeapon ?? fallback;
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

  deps.reactingNow.add(reactor.id);
  deps.applyInterruptCost(reactor);
  deps.reactedThisTurn.add(reactor.id);

  const resolvedWeapon = resolveDeclaredWeapon(reactor, weapon);
  const result = deps.executeRangedAttack(reactor, target, resolvedWeapon, {
    attacker: reactorModel,
    target: targetModel,
    context: options.context,
  });

  deps.reactingNow.delete(reactor.id);
  return { executed: true, result };
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

  const result = action();
  deps.reactingNow.delete(reactor.id);
  return { executed: true, result };
}

export interface ReactEvent {
  battlefield: Battlefield;
  active: Character;
  opponents: Character[];
  trigger: ReactTriggerType;
  movedDistance?: number;
  reactingToReact?: boolean;
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

    const waitBonus = opponent.state.isWaiting ? 1 : 0;
    const soloBonus = event.isGroupAction ? 1 : 0;
    const effectiveRef = (opponent.finalAttributes.ref ?? opponent.attributes.ref ?? 0) + waitBonus + soloBonus;
    const requiredRefBase = event.trigger === 'Move' ? activeMov : activeRef;
    const requiredRef = requiredRefBase + (event.reactingToReact ? 1 : 0);
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
