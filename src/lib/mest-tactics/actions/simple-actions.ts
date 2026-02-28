import { Character } from '../core/Character';
import { TestContext } from '../utils/TestContext';
import { resolveTest } from '../subroutines/dice-roller';
import { CharacterStatus } from '../core/types';
import { hasReload, getReloadActionsRequired, isWeaponLoaded, setWeaponLoaded } from '../traits/combat-traits';
import { validateFiddleAction, hasUsingOneLessHandPenalty, clearUsingOneLessHand, getAvailableHands, getItemHandRequirement } from './hand-requirements';
import { getLeaderRallyBonus } from '../core/leader-identification';
import { MissionSide } from '../mission/MissionSide';
import { Item } from '../core/Item';

export interface SimpleActionDeps {
  spendAp: (character: Character, cost: number) => boolean;
  setWaiting: (character: Character) => void;
  isOutnumberedForWait?: (character: Character) => boolean;
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
  options: { 
    context?: TestContext; 
    rolls?: number[];
    side?: MissionSide;
  } = {}
) {
  if (deps.hasRallyUsed(target.id)) {
    return { success: false, reason: 'Target already rallied this turn.' };
  }
  
  // Get leader rally bonus if side provided
  let rallyBonus = 0;
  if (options.side) {
    rallyBonus = getLeaderRallyBonus(actor, options.side);
  }
  
  const result = resolveTest(
    { 
      character: target, 
      attribute: 'pow', 
      bonusDice: {
        ...(options.context?.isFocusing ? { wild: 1 } : {}),
        ...(rallyBonus > 0 ? { modifier: rallyBonus } : {}),
      }
    },
    { isSystemPlayer: true },
    options.rolls ?? null
  );
  if (!result.pass) {
    return { success: false, result, leaderBonusApplied: rallyBonus };
  }
  const cascades = result.cascades ?? 0;
  target.state.fearTokens = Math.max(0, target.state.fearTokens - cascades);
  target.refreshStatusFlags();
  deps.markRallyUsed(target.id);
  return { success: true, result, fearRemoved: cascades, leaderBonusApplied: rallyBonus };
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
  if (!options.maintain && deps.isOutnumberedForWait?.(actor)) {
    return { success: false, reason: 'Cannot Wait while outnumbered.' };
  }
  const cost = options.maintain ? 1 : 2;
  if (options.spendAp ?? true) {
    if (!deps.spendAp(actor, cost)) {
      return { success: false, reason: 'Not enough AP.' };
    }
  }
  deps.setWaiting(actor);
  return { success: true };
}

// ============================================================================
// STOW/UNSTOW ITEMS (QSR Lines 270-271)
// ============================================================================

/**
 * Stow an in-hand item (move to stowedItems)
 * QSR: Use Fiddle action to stow item on person
 * Cost: 0 AP if first Fiddle, 1 AP otherwise
 */
export function executeStowItem(
  deps: SimpleActionDeps,
  actor: Character,
  options: {
    itemIndex?: number; // Index in inHandItems (default: last)
    itemName?: string;  // Or specify by name
  } = {}
): { success: boolean; reason?: string; itemStowed?: Item } {
  const inHand = actor.profile?.inHandItems ?? [];
  const stowed = actor.profile?.stowedItems ?? [];
  
  if (inHand.length === 0) {
    return { success: false, reason: 'No items in hand to stow' };
  }
  
  // Find item to stow
  let itemIndex = options.itemIndex ?? (inHand.length - 1);
  if (options.itemName) {
    itemIndex = inHand.findIndex(item => item.name === options.itemName);
  }
  
  if (itemIndex < 0 || itemIndex >= inHand.length) {
    return { success: false, reason: 'Invalid item index or name' };
  }
  
  const itemToStow = inHand[itemIndex];
  
  // Move item from in-hand to stowed
  actor.profile.inHandItems = inHand.filter((_, i) => i !== itemIndex);
  actor.profile.stowedItems = [...stowed, itemToStow];
  
  return { success: true, itemStowed: itemToStow };
}

/**
 * Unstow/draw a stowed item (move to inHandItems)
 * QSR: Use Fiddle action to draw stowed item
 * Cost: 0 AP if first Fiddle, 1 AP otherwise
 * Requires: Enough available hands for item
 */
export function executeUnstowItem(
  deps: SimpleActionDeps,
  actor: Character,
  options: {
    itemIndex?: number; // Index in stowedItems (default: last)
    itemName?: string;  // Or specify by name
  } = {}
): { success: boolean; reason?: string; itemDrawn?: Item } {
  const inHand = actor.profile?.inHandItems ?? [];
  const stowed = actor.profile?.stowedItems ?? [];
  
  if (stowed.length === 0) {
    return { success: false, reason: 'No stowed items to draw' };
  }
  
  // Find item to draw
  let itemIndex = options.itemIndex ?? (stowed.length - 1);
  if (options.itemName) {
    itemIndex = stowed.findIndex(item => item.name === options.itemName);
  }
  
  if (itemIndex < 0 || itemIndex >= stowed.length) {
    return { success: false, reason: 'Invalid item index or name' };
  }
  
  const itemToDraw = stowed[itemIndex];
  const handsRequired = getItemHandRequirement(itemToDraw);
  const handsAvailable = getAvailableHands(actor);
  
  if (handsAvailable < handsRequired) {
    return { 
      success: false, 
      reason: `Not enough hands (${handsAvailable}/${handsRequired} required)`,
    };
  }
  
  // Move item from stowed to in-hand
  actor.profile.stowedItems = stowed.filter((_, i) => i !== itemIndex);
  actor.profile.inHandItems = [...inHand, itemToDraw];
  
  return { success: true, itemDrawn: itemToDraw };
}

/**
 * Swap items (stow one, draw another)
 * QSR: Use Fiddle action to switch out items
 * Cost: 0 AP if first Fiddle, 1 AP otherwise
 * Combines stow + unstow in single action
 */
export function executeSwapItem(
  deps: SimpleActionDeps,
  actor: Character,
  options: {
    stowItemIndex?: number;
    stowItemName?: string;
    drawItemIndex?: number;
    drawItemName?: string;
  } = {}
): { success: boolean; reason?: string; itemStowed?: Item; itemDrawn?: Item } {
  // First stow the item
  const stowResult = executeStowItem(deps, actor, {
    itemIndex: options.stowItemIndex,
    itemName: options.stowItemName,
  });
  
  if (!stowResult.success) {
    return { success: false, reason: stowResult.reason };
  }
  
  // Then draw the new item
  const drawResult = executeUnstowItem(deps, actor, {
    itemIndex: options.drawItemIndex,
    itemName: options.drawItemName,
  });
  
  if (!drawResult.success) {
    // Restore stowed item if draw fails
    if (stowResult.itemStowed) {
      actor.profile.inHandItems = [...(actor.profile?.inHandItems ?? []), stowResult.itemStowed];
      actor.profile.stowedItems = (actor.profile?.stowedItems ?? []).filter(i => i !== stowResult.itemStowed);
    }
    return { success: false, reason: drawResult.reason };
  }
  
  return { 
    success: true, 
    itemStowed: stowResult.itemStowed, 
    itemDrawn: drawResult.itemDrawn 
  };
}
