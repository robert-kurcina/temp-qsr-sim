/**
 * Hand Requirements Enforcement
 *
 * QSR Rules:
 * - Characters have Hands equal to their model's sculpt (default 2 for Humanoids)
 * - Items require [1H] or [2H] commitment
 * - Can use item with one less hand but suffer -1b penalty on next Test
 * - Fiddle actions require 1 Hand each
 */

import { hasItemTraitOnWeapon } from '../traits/item-traits';

import { Character } from '../core/Character';
import { Item } from '../core/Item';
import { hasItemTrait } from '../traits/item-traits';

export interface HandState {
  totalHands: number;
  committedHands: number;
  availableHands: number;
  usingOneLessHand: boolean;
}

export interface ItemHandRequirement {
  item: Item;
  handsRequired: number;
  handsCommitted: number;
  isInHand: boolean;
  isStowed: boolean;
}

export interface HandValidationResult {
  valid: boolean;
  canUse: boolean;
  handsRequired: number;
  handsAvailable: number;
  effectiveHandsAvailable?: number;
  handsCommittedToItem?: number;
  overCommittedBy?: number;
  usingOneLessHand: boolean;
  penaltyApplied: boolean;
  overreachDisallowed?: boolean;
  reason?: string;
}

/**
 * Get total hands for a character
 * Default is 2 for Humanoids, can be modified by traits or species
 */
export function getTotalHands(character: Character): number {
  // Check for explicit hand count in profile or traits
  const profileHands = character.profile?.totalHands ?? 0;
  if (profileHands > 0) {
    return profileHands;
  }
  
  // Default: Humanoids have 2 hands
  return 2;
}

/**
 * Calculate hand requirement for an item
 * Returns 1 for [1H], 2 for [2H], 0 for no hand requirement
 */
export function getItemHandRequirement(item: Item): number {
  if (hasItemTraitOnWeapon(item, '2H')) {
    return 2;
  }
  if (hasItemTraitOnWeapon(item, '1H')) {
    return 1;
  }
  
  // Check for hand requirements in traits string
  if (item.traits) {
    if (item.traits.includes('[2H]') || item.traits.includes('2H')) {
      return 2;
    }
    if (item.traits.includes('[1H]') || item.traits.includes('1H')) {
      return 1;
    }
  }
  
  // Default: no hand requirement (equipment, consumables, etc.)
  return 0;
}

/**
 * Get all items currently in hand for a character
 */
export function getItemsInHand(character: Character): Item[] {
  const inHandItems: Item[] = [];
  
  // Check profile's in-hand items
  if (character.profile?.inHandItems) {
    inHandItems.push(...character.profile.inHandItems);
  }
  
  return inHandItems;
}

function itemsMatch(left: Item, right: Item): boolean {
  if (left === right) return true;

  const leftId = String(left.id ?? '').trim();
  const rightId = String(right.id ?? '').trim();
  if (leftId.length > 0 && rightId.length > 0 && leftId === rightId) {
    return true;
  }

  return left.name === right.name;
}

function getHandsCommittedToItem(character: Character, item: Item): number {
  const inHandItems = getItemsInHand(character);
  let committed = 0;

  for (const inHandItem of inHandItems) {
    if (!itemsMatch(inHandItem, item)) continue;
    committed += getItemHandRequirement(inHandItem);
  }

  const itemRequirement = getItemHandRequirement(item);
  return Math.min(committed, itemRequirement);
}

/**
 * Calculate committed hands for a character
 */
export function getCommittedHands(character: Character): number {
  const inHandItems = getItemsInHand(character);
  let committed = 0;
  
  for (const item of inHandItems) {
    committed += getItemHandRequirement(item);
  }
  
  return committed;
}

/**
 * Get available hands for a character
 */
export function getAvailableHands(character: Character): number {
  const total = getTotalHands(character);
  const committed = getCommittedHands(character);
  return Math.max(0, total - committed);
}

/**
 * Get current hand state for a character
 */
export function getHandState(character: Character): HandState {
  const totalHands = getTotalHands(character);
  const committedHands = getCommittedHands(character);
  const availableHands = getAvailableHands(character);
  
  return {
    totalHands,
    committedHands,
    availableHands,
    usingOneLessHand: character.state?.usingOneLessHand ?? false,
  };
}

/**
 * Validate if a character can use an item with current hand availability
 */
export function validateItemUsage(
  character: Character,
  item: Item,
  options: { allowOneLessHand?: boolean; isConcentrating?: boolean; isOverreach?: boolean } = {}
): HandValidationResult {
  let handsRequired = getItemHandRequirement(item);
  const handsAvailable = getAvailableHands(character);
  const handsCommittedToItem = getHandsCommittedToItem(character, item);
  const effectiveHandsAvailable = handsAvailable + handsCommittedToItem;
  const totalHands = getTotalHands(character);
  const committedHands = getCommittedHands(character);
  const overCommittedBy = Math.max(0, committedHands - totalHands);
  const isConcentrating = options.isConcentrating ?? false;
  const isOverreach = options.isOverreach ?? false;
  const isOneHandedWeapon = handsRequired === 1;
  let overreachDisallowed = false;

  // [1H] weapons used with Concentrate require two hands
  if (isConcentrating && isOneHandedWeapon) {
    handsRequired = 2;
  }
  const isTwoHandedRequirement = handsRequired >= 2;

  // No hand requirement
  if (handsRequired === 0) {
    return {
      valid: true,
      canUse: true,
      handsRequired: 0,
      handsAvailable,
      effectiveHandsAvailable,
      handsCommittedToItem,
      overCommittedBy,
      usingOneLessHand: false,
      penaltyApplied: false,
    };
  }
  
  // Has enough hands
  if (effectiveHandsAvailable >= handsRequired) {
    const overcommittedTwoHandedUse = isTwoHandedRequirement && overCommittedBy > 0 && handsCommittedToItem > 0;
    // Two-handed weapons used with two hands cannot Overreach
    if (isTwoHandedRequirement && isOverreach) {
      overreachDisallowed = true;
    }
    return {
      valid: true,
      canUse: true,
      handsRequired,
      handsAvailable,
      effectiveHandsAvailable,
      handsCommittedToItem,
      overCommittedBy,
      usingOneLessHand: overcommittedTwoHandedUse,
      penaltyApplied: overcommittedTwoHandedUse,
      overreachDisallowed,
      reason: overcommittedTwoHandedUse
        ? `Using ${item.name} while over-committed by ${overCommittedBy} hand(s); vulnerable when interrupted`
        : undefined,
    };
  }
  
  // Can use with one less hand?
  const allowOneLessHand = options.allowOneLessHand ?? true;
  const allowOneLessHandAdjusted = isConcentrating && isOneHandedWeapon ? false : allowOneLessHand;
  const canUseOneLess = effectiveHandsAvailable >= handsRequired - 1 && handsRequired > 1;
  
  if (allowOneLessHandAdjusted && canUseOneLess) {
    return {
      valid: true,
      canUse: true,
      handsRequired,
      handsAvailable,
      effectiveHandsAvailable,
      handsCommittedToItem,
      overCommittedBy,
      usingOneLessHand: true,
      penaltyApplied: true, // -1b penalty on next Test
      reason: `Using ${item.name} with one less hand (-1b penalty on next Test)`,
    };
  }
  
  // Cannot use item
  return {
    valid: false,
    canUse: false,
    handsRequired,
    handsAvailable,
    effectiveHandsAvailable,
    handsCommittedToItem,
    overCommittedBy,
    usingOneLessHand: false,
    penaltyApplied: false,
    reason: `Not enough hands (need ${handsRequired}, have ${effectiveHandsAvailable} effective / ${handsAvailable} free)`,
  };
}

/**
 * Mark that character is using an item with one less hand
 * This applies -1b penalty to the next Test
 */
export function markUsingOneLessHand(character: Character): void {
  if (!character.state) {
    (character as any).state = {};
  }
  character.state.usingOneLessHand = true;
}

/**
 * Clear the one-less-hand penalty after it's been applied
 */
export function clearUsingOneLessHand(character: Character): void {
  if (character.state?.usingOneLessHand) {
    character.state.usingOneLessHand = false;
  }
}

/**
 * Check if character has one-less-hand penalty active
 */
export function hasUsingOneLessHandPenalty(character: Character): boolean {
  return character.state?.usingOneLessHand ?? false;
}

/**
 * Get hand penalty for test
 * Returns -1 Base die if using one less hand
 */
export function getHandPenalty(character: Character): number {
  return hasUsingOneLessHandPenalty(character) ? -1 : 0;
}

/**
 * Validate Fiddle action hand requirement
 * Each Fiddle action requires 1 Hand [1H]
 */
export function validateFiddleAction(character: Character): HandValidationResult {
  const handsAvailable = getAvailableHands(character);
  
  if (handsAvailable >= 1) {
    return {
      valid: true,
      canUse: true,
      handsRequired: 1,
      handsAvailable,
      usingOneLessHand: false,
      penaltyApplied: false,
    };
  }
  
  return {
    valid: false,
    canUse: false,
    handsRequired: 1,
    handsAvailable,
    usingOneLessHand: false,
    penaltyApplied: false,
    reason: 'No hands available for Fiddle action',
  };
}

/**
 * Get stowed items for a character
 * Items that are carried but not in hand
 */
export function getStowedItems(character: Character): Item[] {
  const allItems = character.profile?.items ?? [];
  const inHandItems = getItemsInHand(character);
  
  return allItems.filter(item => !inHandItems.includes(item));
}

/**
 * Calculate total hands required for all items
 */
export function getTotalHandsRequired(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    total += getItemHandRequirement(item);
  }
  return total;
}

/**
 * Check if character's loadout is valid (total hands required <= total hands)
 */
export function validateCharacterLoadout(character: Character): {
  valid: boolean;
  handsRequired: number;
  handsAvailable: number;
  excessHands: number;
} {
  const allItems = character.profile?.items ?? [];
  const handsRequired = getTotalHandsRequired(allItems);
  const handsAvailable = getTotalHands(character);
  const excessHands = handsRequired - handsAvailable;
  
  return {
    valid: excessHands <= 0,
    handsRequired,
    handsAvailable,
    excessHands: Math.max(0, excessHands),
  };
}

/**
 * Get situational modifier for hand penalty
 * Used in combat and other tests
 */
export function getHandSituationalModifier(character: Character): number {
  // -1b = -1 Base die penalty
  return hasUsingOneLessHandPenalty(character) ? -1 : 0;
}
