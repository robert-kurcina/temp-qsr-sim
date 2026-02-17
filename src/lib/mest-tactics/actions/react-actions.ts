import { Character } from '../Character';
import { Item } from '../Item';
import { TestContext } from '../TestContext';
import { Position } from '../battlefield/Position';
import { SpatialRules, SpatialModel } from '../battlefield/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/size-utils';

export interface ReactActionDeps {
  battlefield: import('../battlefield/Battlefield').Battlefield | null;
  reactingNow: Set<string>;
  reactedThisTurn: Set<string>;
  getCharacterPosition: (character: Character) => Position | undefined;
  applyInterruptCost: (character: Character) => { removedWait: boolean; delayAdded: boolean };
  executeRangedAttack: (
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: { attacker: SpatialModel; target: SpatialModel; context?: TestContext }
  ) => unknown;
}

export function executeOverwatchReact(
  deps: ReactActionDeps,
  reactor: Character,
  target: Character,
  weapon: Item,
  options: { context?: TestContext; visibilityOrMu?: number } = {}
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

  const reactorModel: SpatialModel = {
    id: reactor.id,
    position: reactorPos,
    baseDiameter: getBaseDiameterFromSiz(reactor.finalAttributes.siz ?? reactor.attributes.siz ?? 3),
    siz: reactor.finalAttributes.siz ?? reactor.attributes.siz ?? 3,
  };
  const targetModel: SpatialModel = {
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

  const result = deps.executeRangedAttack(reactor, target, weapon, {
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
