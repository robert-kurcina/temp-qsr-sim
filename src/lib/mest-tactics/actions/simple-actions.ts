import { Character } from '../core/Character';
import { TestContext } from '../utils/TestContext';
import { resolveTest } from '../subroutines/dice-roller';
import { CharacterStatus } from '../core/types';
import { hasReload, getReloadActionsRequired, isWeaponLoaded, setWeaponLoaded } from '../traits/combat-traits';
import { validateFiddleAction, hasUsingOneLessHandPenalty, clearUsingOneLessHand } from './hand-requirements';

export interface SimpleActionDeps {
  spendAp: (character: Character, cost: number) => boolean;
  setWaiting: (character: Character) => void;
  setCharacterStatus: (characterId: string, status: CharacterStatus) => void;
  markRallyUsed: (characterId: string) => void;
  markReviveUsed: (characterId: string) => void;
  markFiddleUsed: (characterId: string) => void;
  hasRallyUsed: (characterId: string) => boolean;
  hasReviveUsed: (characterId: string) => boolean;
  hasFiddleUsed: (characterId: string) => boolean;
}

export function executeRallyAction(
  deps: SimpleActionDeps,
  actor: Character,
  target: Character,
  options: { context?: TestContext; rolls?: number[] } = {}
) {
  if (deps.hasRallyUsed(target.id)) {
    return { success: false, reason: 'Target already rallied this turn.' };
  }
  const result = resolveTest(
    { character: target, attribute: 'pow', bonusDice: options.context?.isFocusing ? { wild: 1 } : undefined },
    { isSystemPlayer: true },
    options.rolls ?? null
  );
  if (!result.pass) {
    return { success: false, result };
  }
  const cascades = result.cascades ?? 0;
  target.state.fearTokens = Math.max(0, target.state.fearTokens - cascades);
  target.refreshStatusFlags();
  deps.markRallyUsed(target.id);
  return { success: true, result, fearRemoved: cascades };
}

export function executeReviveAction(
  deps: SimpleActionDeps,
  actor: Character,
  target: Character,
  options: { context?: TestContext; rolls?: number[] } = {}
) {
  if (deps.hasReviveUsed(target.id)) {
    return { success: false, reason: 'Target already revived this turn.' };
  }
  const result = resolveTest({ character: target, attribute: 'for' }, { isSystemPlayer: true }, options.rolls ?? null);
  if (!result.pass) {
    return { success: false, result };
  }
  let cascades = result.cascades ?? 0;
  if (target.state.isKOd) {
    const siz = target.finalAttributes.siz ?? target.attributes.siz ?? 3;
    const delayTokens = Math.max(2, siz);
    target.state.isKOd = false;
    target.state.isEliminated = false;
    target.state.delayTokens = 2;
    target.state.wounds += Math.max(0, delayTokens - 2);
    deps.setCharacterStatus(target.id, CharacterStatus.Done);
  }

  while (cascades > 0 && target.state.delayTokens > 0) {
    target.state.delayTokens -= 1;
    cascades -= 1;
  }
  while (cascades >= 2 && target.state.wounds > 0) {
    target.state.wounds -= 1;
    cascades -= 2;
  }
  target.refreshStatusFlags();
  deps.markReviveUsed(target.id);
  return { success: true, result };
}

export function executeFiddleAction(
  deps: SimpleActionDeps,
  actor: Character,
  options: {
    attribute?: keyof Character['finalAttributes'];
    difficulty?: number;
    spendAp?: boolean;
    rolls?: number[];
    opponentRolls?: number[];
    usesOneLessHand?: boolean;
    reloadWeaponIndex?: number; // For Reload trait
    helpingModels?: number; // For +1m Help bonus per model
  } = {}
) {
  const handCheck = validateFiddleAction(actor);
  if (!handCheck.valid || !handCheck.canUse) {
    return { success: false, reason: handCheck.reason ?? 'No hands available.' };
  }

  const free = !deps.hasFiddleUsed(actor.id);
  const apCost = free ? 0 : 1;
  if (options.spendAp ?? true) {
    if (apCost > 0 && !deps.spendAp(actor, apCost)) {
      return { success: false, reason: 'Not enough AP.' };
    }
  }
  deps.markFiddleUsed(actor.id);

  // Reload trait: track reload progress
  if (options.reloadWeaponIndex !== undefined) {
    const reloadLevel = getReloadActionsRequired(actor, options.reloadWeaponIndex);
    if (reloadLevel > 0) {
      // Track reload progress in character state
      const currentReloadProgress = actor.state.reloadProgress ?? 0;
      const newProgress = currentReloadProgress + 1;
      actor.state.reloadProgress = newProgress;

      if (newProgress >= reloadLevel) {
        // Reload complete
        setWeaponLoaded(actor, options.reloadWeaponIndex, true);
        actor.state.reloadProgress = 0;
        return { success: true, reloadComplete: true };
      }
      return { success: true, reloadComplete: false, reloadProgress: newProgress, reloadRequired: reloadLevel };
    }
  }

  if (!options.attribute || options.difficulty === undefined) {
    return { success: true };
  }
  const attributeValue = actor.finalAttributes[options.attribute] ?? 0;
  const applyHandPenalty = options.usesOneLessHand || hasUsingOneLessHandPenalty(actor);
  const penaltyDice = applyHandPenalty ? { base: 1 } : undefined;
  if (applyHandPenalty) {
    clearUsingOneLessHand(actor);
  }
  
  // QSR: Help - +1m per Free Attentive Ordered Friendly model in base-contact
  // that is given a Delay token
  const bonusDice: { modifier?: number } = {};
  if (options.helpingModels && options.helpingModels > 0) {
    bonusDice.modifier = options.helpingModels;
  }
  
  const result = resolveTest(
    { attributeValue, penaltyDice, bonusDice },
    { attributeValue: options.difficulty },
    options.rolls ?? null,
    options.opponentRolls ?? null
  );
  return { success: result.pass, result };
}

export function executeWaitAction(
  deps: SimpleActionDeps,
  actor: Character,
  options: { spendAp?: boolean; maintain?: boolean } = {}
) {
  const cost = options.maintain ? 1 : 2;
  if (options.spendAp ?? true) {
    if (!deps.spendAp(actor, cost)) {
      return { success: false, reason: 'Not enough AP.' };
    }
  }
  deps.setWaiting(actor);
  return { success: true };
}
