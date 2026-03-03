import { Character } from '../core/Character';
import { TestContext } from '../utils/TestContext';
import { resolveTest } from '../subroutines/dice-roller';
import { CharacterStatus } from '../core/types';
import { hasReload, getReloadActionsRequired, isWeaponLoaded, setWeaponLoaded, getThreatRange } from '../traits/combat-traits';
import { validateFiddleAction, hasUsingOneLessHandPenalty, clearUsingOneLessHand, getAvailableHands, getItemHandRequirement } from './hand-requirements';
import { getLeaderRallyBonus } from '../core/leader-identification';
import { MissionSide } from '../mission/MissionSide';
import { Item } from '../core/Item';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';
import { buildSpatialModel as runBuildSpatialModel } from '../battlefield/spatial-helpers';

export interface SimpleActionDeps {
  spendAp: (character: Character, cost: number) => boolean;
  setWaiting: (character: Character) => void;
  isOutnumberedForWait?: (character: Character) => boolean;
  getCharacterPosition?: (character: Character) => Position | undefined;
  getTwoApMovementRange?: (character: Character) => number;
  setCharacterStatus: (characterId: string, status: CharacterStatus) => void;
  markRallyUsed: (characterId: string) => void;
  markReviveUsed: (characterId: string) => void;
  markFiddleUsed: (characterId: string) => void;
  hasRallyUsed: (characterId: string) => boolean;
  hasReviveUsed: (characterId: string) => boolean;
  hasFiddleUsed: (characterId: string) => boolean;
}

const RALLY_DISTANCE_EPSILON = 1e-6;

function resolveRallyCohesionRange(options: { cohesionRangeMu?: number; visibilityOrMu?: number }): number {
  if (options.cohesionRangeMu !== undefined) {
    return Math.max(0, options.cohesionRangeMu);
  }
  const visibilityOrMu = options.visibilityOrMu ?? 16;
  return Math.min(8, Math.floor(visibilityOrMu / 2));
}

function getDistance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function executeRallyAction(
  deps: SimpleActionDeps,
  actor: Character,
  target: Character,
  options: { 
    context?: TestContext; 
    rolls?: number[];
    side?: MissionSide;
    battlefield?: Battlefield | null;
    allies?: Character[];
    opponents?: Character[];
    cohesionRangeMu?: number;
    visibilityOrMu?: number;
  } = {}
) {
  if (actor.state.isEngaged) {
    return { success: false, reason: 'Rally requires actor to be Free.' };
  }
  if (target.state.isEngaged) {
    return { success: false, reason: 'Rally target must be Free.' };
  }
  if (deps.hasRallyUsed(target.id)) {
    return { success: false, reason: 'Target already rallied this turn.' };
  }
  const cohesionRange = resolveRallyCohesionRange(options);
  if (target.id !== actor.id) {
    const allyIds = new Set((options.allies ?? []).map(character => character.id));
    if (!allyIds.has(target.id)) {
      return { success: false, reason: 'Rally target must be a Friendly model.' };
    }
    const actorPos = deps.getCharacterPosition?.(actor);
    const targetPos = deps.getCharacterPosition?.(target);
    if (!actorPos || !targetPos) {
      return { success: false, reason: 'Rally target must be within Cohesion.' };
    }
    const distanceToTarget = getDistance(actorPos, targetPos);
    if (distanceToTarget > cohesionRange + RALLY_DISTANCE_EPSILON) {
      return { success: false, reason: 'Rally target must be within Cohesion.' };
    }
  }
  if (!deps.spendAp(actor, 1)) {
    return { success: false, reason: 'Not enough AP.' };
  }
  
  // Get leader rally bonus if side provided
  let rallyBonus = 0;
  if (options.side) {
    rallyBonus = getLeaderRallyBonus(actor, options.side);
  }

  // QSR RL.7: +1m when at least one Attentive+Ordered Friendly model is in Cohesion.
  let friendlyBonus = 0;
  const targetPos = deps.getCharacterPosition?.(target);
  if (targetPos) {
    const friendlyPool = new Map<string, Character>();
    for (const candidate of options.allies ?? []) {
      friendlyPool.set(candidate.id, candidate);
    }
    friendlyPool.set(actor.id, actor);

    for (const friendly of friendlyPool.values()) {
      if (friendly.id === target.id) continue;
      if (!friendly.state.isAttentive || !friendly.state.isOrdered) continue;
      const friendlyPos = deps.getCharacterPosition?.(friendly);
      if (!friendlyPos) continue;
      const distance = getDistance(targetPos, friendlyPos);
      if (distance <= cohesionRange + RALLY_DISTANCE_EPSILON) {
        friendlyBonus = 1;
        break;
      }
    }
  }

  // QSR RL.8: +1w when in Safety:
  // behind Cover or out of LOS, and not within 2 AP Movement of opposing models.
  let safetyBonus = 0;
  if (options.battlefield && options.opponents && options.opponents.length > 0) {
    const getPosition = deps.getCharacterPosition ?? (() => undefined);
    const targetModel = runBuildSpatialModel(options.battlefield, getPosition, target);
    if (targetModel) {
      let protectedFromOpposition = true;
      let outsideThreatRange = true;

      for (const opponent of options.opponents) {
        if (opponent.id === target.id || opponent.state.isEliminated || opponent.state.isKOd) continue;

        const opponentModel = runBuildSpatialModel(options.battlefield, getPosition, opponent);
        if (!opponentModel) {
          protectedFromOpposition = false;
          outsideThreatRange = false;
          break;
        }

        const cover = SpatialRules.getCoverResult(options.battlefield, opponentModel, targetModel);
        const hasCoverOrNoLos = !cover.hasLOS || cover.hasDirectCover || cover.hasInterveningCover;
        if (!hasCoverOrNoLos) {
          protectedFromOpposition = false;
        }

        const twoApMovementRange = deps.getTwoApMovementRange?.(opponent) ?? (getThreatRange(opponent) * 2);
        const edgeDistance = SpatialRules.distanceEdgeToEdge(opponentModel, targetModel);
        if (edgeDistance <= twoApMovementRange + RALLY_DISTANCE_EPSILON) {
          outsideThreatRange = false;
        }

        if (!protectedFromOpposition || !outsideThreatRange) {
          break;
        }
      }

      if (protectedFromOpposition && outsideThreatRange) {
        safetyBonus = 1;
      }
    }
  }

  const totalModifierBonus = rallyBonus + friendlyBonus;
  const totalWildBonus = (options.context?.isFocusing ? 1 : 0) + safetyBonus;
  
  const result = resolveTest(
    { 
      character: target, 
      attribute: 'pow', 
      bonusDice: {
        ...(totalWildBonus > 0 ? { wild: totalWildBonus } : {}),
        ...(totalModifierBonus > 0 ? { modifier: totalModifierBonus } : {}),
      }
    },
    { isSystemPlayer: true },
    options.rolls ?? null
  );
  if (!result.pass) {
    return {
      success: false,
      result,
      leaderBonusApplied: rallyBonus,
      friendlyBonusApplied: friendlyBonus > 0,
      safetyBonusApplied: safetyBonus > 0,
    };
  }
  const cascades = result.cascades ?? 0;
  target.state.fearTokens = Math.max(0, target.state.fearTokens - cascades);
  target.refreshStatusFlags();
  deps.markRallyUsed(target.id);
  return {
    success: true,
    result,
    fearRemoved: cascades,
    leaderBonusApplied: rallyBonus,
    friendlyBonusApplied: friendlyBonus > 0,
    safetyBonusApplied: safetyBonus > 0,
  };
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
