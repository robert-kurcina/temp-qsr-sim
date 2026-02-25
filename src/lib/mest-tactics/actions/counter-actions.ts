import { Character } from '../core/Character';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { ResolveTestResult, TestDice } from '../subroutines/dice-roller';
import { MoraleOptions, applyFearFromAllyKO, applyFearFromWounds } from '../status/morale';
import { resolveDamage, DamageResolution } from '../subroutines/damage-test';
import { getCharacterTraitLevel } from '../status/status-system';
import { SpatialRules, SpatialModel } from '../battlefield/spatial/spatial-rules';
import { Position } from '../battlefield/Position';
import { Battlefield } from '../battlefield/Battlefield';

export interface CounterStrikeResult {
  executed: boolean;
  reason?: string;
  damageResolution?: DamageResolution;
  bonusActionEligible?: boolean;
  removedWait?: boolean;
  delayAdded?: boolean;
}

export interface CounterFireResult {
  executed: boolean;
  reason?: string;
  damageResolution?: DamageResolution;
  bonusActionEligible?: boolean;
  removedWait?: boolean;
  delayAdded?: boolean;
}

export interface CounterActionResult {
  executed: boolean;
  reason?: string;
  bonusActionCascades?: number;
  carryOverDice?: TestDice;
  removedWait?: boolean;
  delayAdded?: boolean;
}

export interface CounterChargeResult {
  executed: boolean;
  reason?: string;
  moved?: boolean;
  newPosition?: Position;
  removedWait?: boolean;
  delayAdded?: boolean;
}

export interface CounterActionDeps {
  battlefield: Battlefield | null;
  buildSpatialModel: (character: Character) => SpatialModel | null;
  resolveEngagePosition: (mover: SpatialModel, target: SpatialModel, moveLimit: number) => Position | null;
  moveCharacter: (character: Character, position: Position) => boolean;
  applyInterruptCost: (character: Character) => { removedWait: boolean; delayAdded: boolean };
  applyKOCleanup: (character: Character) => void;
  countDice: (dice: TestDice) => number;
  resolveCarryOverSuccesses: (dice: TestDice, rolls?: number[]) => number;
}

export function executeCounterStrike(
  deps: CounterActionDeps,
  defender: Character,
  attacker: Character,
  weapon: Item,
  hitTestResult: ResolveTestResult,
  options: { context?: TestContext; requireTrait?: boolean; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
): CounterStrikeResult {
  if (!deps.battlefield) {
    return { executed: false, reason: 'Battlefield not set.' };
  }
  if (!defender.state.isAttentive || !defender.state.isOrdered) {
    return { executed: false, reason: 'Requires Attentive+Ordered defender.' };
  }
  const requireTrait = options.requireTrait ?? true;
  const hasTrait = getCharacterTraitLevel(defender, 'Counter-strike!') > 0
    || getCharacterTraitLevel(defender, 'Counter-strike') > 0;
  if (requireTrait && !hasTrait) {
    return { executed: false, reason: 'Requires Counter-strike! trait.' };
  }
  if (hitTestResult.score > 0) {
    return { executed: false, reason: 'Hit Test did not fail.' };
  }

  const defenderModel = deps.buildSpatialModel(defender);
  const attackerModel = deps.buildSpatialModel(attacker);
  if (!defenderModel || !attackerModel) {
    return { executed: false, reason: 'Missing positions.' };
  }
  if (!SpatialRules.isEngaged(attackerModel, defenderModel)) {
    return { executed: false, reason: 'Requires melee engagement.' };
  }

  const cost = deps.applyInterruptCost(defender);
  const carryOverDice = hitTestResult.p2Result?.carryOverDice ?? {};
  const counterHitResult = { carryOverDice } as unknown as ResolveTestResult;

  const damageResolution = resolveDamage(defender, attacker, weapon, counterHitResult, options.context ?? {});
  attacker.state.wounds = damageResolution.defenderState.wounds;
  attacker.state.delayTokens = damageResolution.defenderState.delayTokens;
  attacker.state.isKOd = damageResolution.defenderState.isKOd;
  attacker.state.isEliminated = damageResolution.defenderState.isEliminated;
  if (damageResolution) {
    const woundsAdded = damageResolution.woundsAdded + damageResolution.stunWoundsAdded;
    applyFearFromWounds(attacker, woundsAdded);
    if (damageResolution.defenderState.isKOd || damageResolution.defenderState.isEliminated) {
      if (deps.battlefield && options.moraleAllies) {
        applyFearFromAllyKO(deps.battlefield, attacker, options.moraleAllies, options.moraleOptions);
      }
    }
    deps.applyKOCleanup(attacker);
  }

  return {
    executed: true,
    damageResolution,
    bonusActionEligible: Boolean(damageResolution.damageTestResult?.pass),
    removedWait: cost.removedWait,
    delayAdded: cost.delayAdded,
  };
}

export function executeCounterFire(
  deps: CounterActionDeps,
  defender: Character,
  attacker: Character,
  weapon: Item,
  hitTestResult: ResolveTestResult,
  options: { context?: TestContext; visibilityOrMu?: number; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
): CounterFireResult {
  if (!deps.battlefield) {
    return { executed: false, reason: 'Battlefield not set.' };
  }
  if (!defender.state.isAttentive || !defender.state.isOrdered) {
    return { executed: false, reason: 'Requires Attentive+Ordered defender.' };
  }
  if (hitTestResult.score > 0) {
    return { executed: false, reason: 'Hit Test did not fail.' };
  }
  const defenderModel = deps.buildSpatialModel(defender);
  const attackerModel = deps.buildSpatialModel(attacker);
  if (!defenderModel || !attackerModel) {
    return { executed: false, reason: 'Missing positions.' };
  }
  if (SpatialRules.isEngaged(attackerModel, defenderModel)) {
    return { executed: false, reason: 'Requires defender to be Free.' };
  }
  if (attacker.state.isHidden) {
    return { executed: false, reason: 'Requires Revealed attacker.' };
  }
  const hasLOS = SpatialRules.hasLineOfSight(deps.battlefield, defenderModel, attackerModel);
  if (!hasLOS) {
    return { executed: false, reason: 'Requires LOS.' };
  }
  const visibilityOrMu = options.visibilityOrMu ?? 16;
  const edgeDistance = SpatialRules.distanceEdgeToEdge(defenderModel, attackerModel);
  if (edgeDistance > visibilityOrMu) {
    return { executed: false, reason: 'Requires target within Visibility.' };
  }
  const defenderRef = defender.finalAttributes.ref ?? defender.attributes.ref ?? 0;
  const attackerRef = attacker.finalAttributes.ref ?? attacker.attributes.ref ?? 0;
  if (defenderRef < attackerRef) {
    return { executed: false, reason: 'Requires defender REF >= attacker REF.' };
  }

  const cost = deps.applyInterruptCost(defender);
  const carryOverDice = hitTestResult.p2Result?.carryOverDice ?? {};
  const counterHitResult = { carryOverDice } as unknown as ResolveTestResult;

  const damageResolution = resolveDamage(defender, attacker, weapon, counterHitResult, options.context ?? {});
  attacker.state.wounds = damageResolution.defenderState.wounds;
  attacker.state.delayTokens = damageResolution.defenderState.delayTokens;
  attacker.state.isKOd = damageResolution.defenderState.isKOd;
  attacker.state.isEliminated = damageResolution.defenderState.isEliminated;
  if (damageResolution) {
    const woundsAdded = damageResolution.woundsAdded + damageResolution.stunWoundsAdded;
    applyFearFromWounds(attacker, woundsAdded);
    if (damageResolution.defenderState.isKOd || damageResolution.defenderState.isEliminated) {
      if (deps.battlefield && options.moraleAllies) {
        applyFearFromAllyKO(deps.battlefield, attacker, options.moraleAllies, options.moraleOptions);
      }
    }
    deps.applyKOCleanup(attacker);
  }

  return {
    executed: true,
    damageResolution,
    bonusActionEligible: Boolean(damageResolution.damageTestResult?.pass),
    removedWait: cost.removedWait,
    delayAdded: cost.delayAdded,
  };
}

export function executeCounterAction(
  deps: CounterActionDeps,
  defender: Character,
  attacker: Character,
  hitTestResult: ResolveTestResult,
  options: { attackType?: 'melee' | 'ranged'; carryOverRolls?: number[] } = {}
): CounterActionResult {
  if (!defender.state.isAttentive || !defender.state.isOrdered) {
    return { executed: false, reason: 'Requires Attentive+Ordered defender.' };
  }
  if (hitTestResult.score > 0) {
    return { executed: false, reason: 'Hit Test did not fail.' };
  }
  const carryOverDice = hitTestResult.p2Result?.carryOverDice ?? {};
  const carryOverCount = deps.countDice(carryOverDice);
  if (carryOverCount <= 0) {
    return { executed: false, reason: 'Requires carry-over from the failed Hit Test.', carryOverDice };
  }
  if (options.attackType === 'ranged') {
    const defenderRef = defender.finalAttributes.ref ?? defender.attributes.ref ?? 0;
    const attackerRef = attacker.finalAttributes.ref ?? attacker.attributes.ref ?? 0;
    if (defenderRef < attackerRef) {
      return { executed: false, reason: 'Requires defender REF >= attacker REF.', carryOverDice };
    }
  }

  const cost = deps.applyInterruptCost(defender);
  const bonusActionCascades = deps.resolveCarryOverSuccesses(carryOverDice, options.carryOverRolls);

  return {
    executed: true,
    bonusActionCascades,
    carryOverDice,
    removedWait: cost.removedWait,
    delayAdded: cost.delayAdded,
  };
}

export function executeCounterCharge(
  deps: CounterActionDeps,
  observer: Character,
  target: Character,
  options: { visibilityOrMu?: number; moveApSpent?: number; moveEnd?: Position } = {}
): CounterChargeResult {
  if (!deps.battlefield) {
    return { executed: false, reason: 'Battlefield not set.' };
  }
  if (!observer.state.isAttentive || !observer.state.isOrdered) {
    return { executed: false, reason: 'Requires Attentive+Ordered observer.' };
  }
  const observerModel = deps.buildSpatialModel(observer);
  const targetModel = deps.buildSpatialModel(target);
  if (!observerModel || !targetModel) {
    return { executed: false, reason: 'Missing positions.' };
  }
  const hasLOS = SpatialRules.hasLineOfSight(deps.battlefield, observerModel, targetModel);
  if (!hasLOS) {
    return { executed: false, reason: 'Requires LOS.' };
  }
  const visibilityOrMu = options.visibilityOrMu ?? 16;
  const edgeDistance = SpatialRules.distanceEdgeToEdge(observerModel, targetModel);
  if (edgeDistance > visibilityOrMu) {
    return { executed: false, reason: 'Requires target within Visibility.' };
  }

  const observerRef = observer.finalAttributes.ref ?? observer.attributes.ref ?? 0;
  const targetMov = target.finalAttributes.mov ?? target.attributes.mov ?? 0;
  const requiredAp = observerRef > targetMov ? 1 : 2;
  const moveApSpent = options.moveApSpent ?? 2;
  if (moveApSpent < requiredAp) {
    return { executed: false, reason: 'Requires target to spend enough AP on movement.' };
  }

  const moveLimit = observer.finalAttributes.mov ?? observer.attributes.mov ?? 0;
  const desiredPosition = options.moveEnd ?? deps.resolveEngagePosition(observerModel, targetModel, moveLimit);
  if (!desiredPosition) {
    return { executed: false, reason: 'Unable to reach engagement.' };
  }
  const moved = deps.moveCharacter(observer, desiredPosition);
  if (!moved) {
    return { executed: false, reason: 'Move blocked.' };
  }

  const updatedObserver = deps.buildSpatialModel(observer);
  if (!updatedObserver || !SpatialRules.isEngaged(updatedObserver, targetModel)) {
    return { executed: false, reason: 'Move did not engage target.' };
  }

  const cost = deps.applyInterruptCost(observer);
  return {
    executed: true,
    moved: true,
    newPosition: desiredPosition,
    removedWait: cost.removedWait,
    delayAdded: cost.delayAdded,
  };
}
