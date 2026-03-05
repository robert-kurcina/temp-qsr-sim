/**
 * Combat Traits Implementation
 *
 * Complete implementation of combat-related traits per MEST Tactics QSR.
 * These traits modify combat tests, damage, and tactical options.
 */

import { Character } from '../core/Character';
import { getCharacterTraitLevel } from '../status/status-system';
import { Item } from '../core/Item';
import { parseTrait } from './trait-parser';

// ============================================================================
// CLEAVE
// ============================================================================

/**
 * Cleave X — Attack Effect
 * QSR: If target of Attacker Damage Test is KO'd it is instead Eliminated.
 *      If X is two or more, presume target has first received an extra (X-1) Wounds.
 */
export interface CleaveResult {
  extraAttackGranted: boolean;
  targetEliminated: boolean;
  extraWoundsApplied: number;
}

export function checkCleaveTrigger(
  attacker: Character,
  defender: Character,
  defenderKOd: boolean,
  weapon?: { traits?: string[] }
): CleaveResult {
  // Cleave is a weapon trait, not a character trait
  // Check the weapon's traits for Cleave X
  let cleaveLevel = 0;
  if (weapon?.traits) {
    for (const trait of weapon.traits) {
      const parsed = parseTrait(trait);
      if (parsed.name.toLowerCase() === 'cleave') {
        cleaveLevel = parsed.level ?? 1;
        break;
      }
    }
  }

  if (cleaveLevel <= 0 || !defenderKOd) {
    return {
      extraAttackGranted: false,
      targetEliminated: false,
      extraWoundsApplied: 0,
    };
  }

  // Cleave converts KO to Elimination
  // Level 2+ applies extra (level - 1) wounds before elimination
  const extraWounds = Math.max(0, cleaveLevel - 1);

  return {
    extraAttackGranted: true,
    targetEliminated: true,
    extraWoundsApplied: extraWounds,
  };
}

// ============================================================================
// PARRY
// ============================================================================

/**
 * Parry X — Intrinsic
 * QSR: Receives +X Modifier dice for Defender Close Combat Tests.
 */
export function getParryBonus(character: Character): number {
  return getCharacterTraitLevel(character, 'Parry');
}

// ============================================================================
// REACH
// ============================================================================

/**
 * Reach X — Intrinsic
 * QSR: Melee Range extended up to X × 1 MU further than default (base-contact).
 *      When Attentive Ordered, Melee Range may extend through Friendly Attentive Ordered model,
 *      or Distracted/Disordered Opposing model.
 */
export function getReachExtension(character: Character): number {
  const reachLevel = getCharacterTraitLevel(character, 'Reach');
  // Each level adds 1 MU to melee range
  return reachLevel;
}

export function getEffectiveMeleeRange(
  character: Character,
  isAttentiveOrdered: boolean = false
): number {
  const baseMeleeRange = 0; // base-contact
  const reachExtension = getReachExtension(character);

  // Reach can extend through friendly attentive ordered or distracted/disordered opposing models
  // This is handled by the caller checking model positions
  return baseMeleeRange + reachExtension;
}

export function hasReachAdvantage(
  attacker: Character,
  defender: Character,
  distance: number
): boolean {
  const attackerReach = getReachExtension(attacker);
  const defenderReach = getReachExtension(defender);

  // Attacker has reach advantage if they can hit but defender cannot
  const attackerMaxRange = attackerReach;
  const defenderMaxRange = defenderReach;

  return distance <= attackerMaxRange && distance > defenderMaxRange;
}

export function canReachThroughModel(
  attacker: Character,
  interveningModel: Character,
  isAttentiveOrdered: boolean
): boolean {
  if (getCharacterTraitLevel(attacker, 'Reach') <= 0) {
    return false;
  }

  // Can extend through friendly attentive ordered
  // or distracted/disordered opposing models
  // Caller must determine relationship and status
  return true; // Placeholder - caller provides context
}

// ============================================================================
// CONCEAL
// ============================================================================

/**
 * Conceal — Asset
 * QSR: One of this Item may always be assigned to a model despite its sculpt.
 *      Allows Hidden status more easily.
 */
export function hasConceal(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Conceal') > 0;
}

export function getConcealBonus(character: Character): number {
  return getCharacterTraitLevel(character, 'Conceal');
}

// ============================================================================
// DISCRETE
// ============================================================================

/**
 * Discrete — Asset
 * QSR: Any number of this Item may always be assigned to a model despite its sculpt.
 *      Always considered to have Conceal trait.
 */
export function hasDiscrete(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Discrete') > 0;
}

// ============================================================================
// COVERAGE
// ============================================================================

/**
 * Coverage X — Asset, Skill
 * QSR: For each X ignore one Engaged Opposing model in a Scrum.
 *      When Attentive, allow up to X Friendly models in base-contact and Engaged
 *      to the same Opposing model to benefit from this Item this Turn.
 */
export function getCoverageLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Coverage');
}

// Alias for backward compatibility
export function getCoverageBonus(character: Character): number {
  return getCoverageLevel(character);
}

export function getIgnoredEngagedModels(character: Character): number {
  return getCoverageLevel(character);
}

export function getSharedCoverageBeneficiaries(character: Character): number {
  return getCoverageLevel(character);
}

// ============================================================================
// DEFLECT
// ============================================================================

/**
 * Deflect X — Asset
 * QSR: Receives +X Modifier dice Defender Hit Tests.
 *      Disregard for Defender Range Hit Test when Engaged.
 */
export function getDeflectBonus(character: Character): number {
  return getCharacterTraitLevel(character, 'Deflect');
}

export function getDeflectBonusForTest(
  character: Character,
  isRangeHitTest: boolean,
  isEngaged: boolean
): number {
  // Disregard for Defender Range Hit Test when Engaged
  if (isRangeHitTest && isEngaged) {
    return 0;
  }
  return getDeflectBonus(character);
}

// ============================================================================
// GRIT
// ============================================================================

/**
 * Grit X — Psychology, Skill
 * QSR: Does not perform Morale Test when Friendly model KO'd/Eliminated
 *      unless that model had higher POW.
 *      Reduce the first Fear token received when Attentive.
 *      Whenever receiving Fear tokens optionally convert up to X of those
 *      Fear tokens into Delay tokens instead.
 */
export function getGritLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Grit');
}

export function hasGrit(character: Character): boolean {
  return getGritLevel(character) > 0;
}

export function checkGritMoraleExemption(
  character: Character,
  fallenAllyPow: number
): boolean {
  const gritLevel = getGritLevel(character);
  if (gritLevel <= 0) {
    return false;
  }

  // Exempt from Morale Test unless fallen ally had higher POW
  const characterPow = character.finalAttributes.pow ?? character.attributes.pow ?? 0;
  return fallenAllyPow <= characterPow;
}

export function applyGritFearReduction(
  character: Character,
  fearTokensReceived: number,
  isAttentive: boolean,
  hasAlreadyUsedGritThisTurn: boolean
): { tokensReduced: number; tokensApplied: number } {
  const gritLevel = getGritLevel(character);

  if (gritLevel <= 0 || !isAttentive || hasAlreadyUsedGritThisTurn) {
    return {
      tokensReduced: 0,
      tokensApplied: fearTokensReceived,
    };
  }

  // Reduce the first Fear token when Attentive
  const tokensReduced = Math.min(1, fearTokensReceived);
  const tokensApplied = fearTokensReceived - tokensReduced;

  return {
    tokensReduced,
    tokensApplied,
  };
}

export function applyGritFearConversion(
  character: Character,
  fearTokensReceived: number
): { fearTokensApplied: number; delayTokensConverted: number } {
  const gritLevel = getGritLevel(character);

  if (gritLevel <= 0) {
    return {
      fearTokensApplied: fearTokensReceived,
      delayTokensConverted: 0,
    };
  }

  // Convert up to X Fear tokens to Delay tokens
  const delayTokensConverted = Math.min(gritLevel, fearTokensReceived);
  const fearTokensApplied = fearTokensReceived - delayTokensConverted;

  return {
    fearTokensApplied,
    delayTokensConverted,
  };
}

// ============================================================================
// PERIMETER
// ============================================================================

/**
 * Perimeter — Intrinsic
 * QSR: While Attentive, Opposing models may only make base-contact if they
 *      are Attentive and use Agility.
 *      Receives +1 Modifier die Defending Close Combat while not in base-contact
 *      or when Opposing model moves into base-contact for the current Initiative.
 */
export function hasPerimeter(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Perimeter') > 0;
}

export function getPerimeterDefenseBonus(
  character: Character,
  isInBaseContact: boolean,
  opposingModelMovingIntoContact: boolean,
  isAttentive: boolean
): number {
  if (!hasPerimeter(character) || !isAttentive) {
    return 0;
  }

  // +1m when not in base-contact OR when opposing model moves into contact
  if (!isInBaseContact || opposingModelMovingIntoContact) {
    return 1;
  }

  return 0;
}

export function requiresAgilityForBaseContact(character: Character): boolean {
  return hasPerimeter(character);
}

// ============================================================================
// PROTECTIVE
// ============================================================================

/**
 * Protective X — Intrinsic
 * QSR: Discard X Delay tokens received as Stun damage.
 *      Must be Attentive if targeted by a Concentrated Close Combat Attack.
 *      Must be in Cover if targeted by a Concentrated Range Combat attack.
 */
export function getProtectiveLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Protective');
}

export function canApplyProtective(
  character: Character,
  isConcentratedAttack: boolean,
  isCloseCombat: boolean,
  isInCover: boolean,
  isAttentive: boolean
): boolean {
  const protectiveLevel = getProtectiveLevel(character);
  if (protectiveLevel <= 0) {
    return false;
  }

  // Must be Attentive for Concentrated Close Combat
  if (isConcentratedAttack && isCloseCombat && !isAttentive) {
    return false;
  }

  // Must be in Cover for Concentrated Range Combat
  if (isConcentratedAttack && !isCloseCombat && !isInCover) {
    return false;
  }

  return true;
}

export function applyProtective(
  character: Character,
  delayTokensFromStun: number,
  isConcentratedAttack: boolean,
  isCloseCombat: boolean,
  isInCover: boolean,
  isAttentive: boolean
): { tokensDiscarded: number; tokensRemaining: number } {
  if (!canApplyProtective(character, isConcentratedAttack, isCloseCombat, isInCover, isAttentive)) {
    return {
      tokensDiscarded: 0,
      tokensRemaining: delayTokensFromStun,
    };
  }

  const protectiveLevel = getProtectiveLevel(character);
  const tokensDiscarded = Math.min(protectiveLevel, delayTokensFromStun);
  const tokensRemaining = delayTokensFromStun - tokensDiscarded;

  return {
    tokensDiscarded,
    tokensRemaining,
  };
}

// ============================================================================
// RELOAD
// ============================================================================

/**
 * Reload X — Asset
 * QSR: After performing an action or Test with this weapon and it is available
 *      for use; indicate that it needs to be reloaded using an Out-of-Ammo! marker.
 *      It remains unusable until after the character performs X Fiddle actions for 1 AP each.
 */
export function getReloadLevel(character: Character, weaponIndex: number = 0): number {
  const equipment = character.profile?.equipment || character.profile?.items || [];
  if (weaponIndex < equipment.length) {
    const weapon = equipment[weaponIndex];
    if (weapon?.traits?.length) {
      for (const trait of weapon.traits) {
        const parsed = parseTrait(trait);
        if (parsed.name.toLowerCase() === 'reload') {
          return parsed.level ?? 1;
        }
      }
    }
  }
  return getCharacterTraitLevel(character, 'Reload');
}

export function hasReload(character: Character, weaponIndex: number = 0): boolean {
  return getReloadLevel(character, weaponIndex) > 0;
}

export interface ReloadState {
  isLoaded: boolean;
  shotsRemaining: number;
}

export function isWeaponLoaded(
  character: Character,
  weaponIndex: number = 0
): boolean {
  const loadedWeapons = character.state.loadedWeapons ?? [];
  return loadedWeapons.includes(weaponIndex);
}

export function setWeaponLoaded(
  character: Character,
  weaponIndex: number,
  loaded: boolean
): void {
  const loadedWeapons = character.state.loadedWeapons ?? [];

  if (loaded) {
    if (!loadedWeapons.includes(weaponIndex)) {
      loadedWeapons.push(weaponIndex);
    }
  } else {
    const index = loadedWeapons.indexOf(weaponIndex);
    if (index > -1) {
      loadedWeapons.splice(index, 1);
    }
  }

  character.state.loadedWeapons = loadedWeapons;
}

export function getReloadActionsRequired(character: Character, weaponIndex: number = 0): number {
  const equipment = character.profile?.equipment || character.profile?.items || [];
  const weapon = weaponIndex < equipment.length ? equipment[weaponIndex] : undefined;
  if (weapon && hasArchery(character)) {
    const classification = (weapon.classification || weapon.class || '').toLowerCase();
    if (classification.includes('bow')) {
      return 0;
    }
  }
  return getReloadLevel(character, weaponIndex);
}

// ============================================================================
// ROF FAMILY TRAITS ([Feed], [Jam], [Burst])
// ============================================================================

/**
 * [Feed] — ROF
 * QSR: Requires careful ammunition feeding. Weapon jams on roll of 1 on any attack die.
 */
export function hasFeed(character: Character, weaponIndex: number = 0): boolean {
  const equipment = character.profile?.equipment || character.profile?.items || [];
  if (weaponIndex >= equipment.length) return false;
  const weapon = equipment[weaponIndex];
  return weapon.traits?.some(t => t.includes('[Feed]')) ?? false;
}

export interface FeedCheckResult {
  jammed: boolean;
  rolls: number[];
}

/**
 * Check if weapon jams due to [Feed] trait
 * Jams if any attack die rolls a 1
 */
export function checkFeedJam(rolls: number[]): FeedCheckResult {
  const jammed = rolls.some(roll => roll === 1);
  return { jammed, rolls };
}

/**
 * [Jam] — ROF
 * QSR: Weapon may jam when fired. Check after each attack.
 */
export function hasJam(character: Character, weaponIndex: number = 0): boolean {
  const equipment = character.profile?.equipment || character.profile?.items || [];
  if (weaponIndex >= equipment.length) return false;
  const weapon = equipment[weaponIndex];
  return weapon.traits?.some(t => t.includes('[Jam]')) ?? false;
}

export interface JamCheckResult {
  jammed: boolean;
  jamChance: number; // 0-1, default 1/6 for standard jam
}

/**
 * Check if weapon jams due to [Jam] trait
 * Standard jam chance is 1/6 (roll of 1 on d6)
 */
export function checkJam(rng: () => number = Math.random): JamCheckResult {
  const jamChance = 1 / 6;
  const jammed = rng() < jamChance;
  return { jammed, jamChance };
}

/**
 * Clear weapon jam (requires Fiddle action)
 */
export function clearWeaponJam(character: Character, weaponIndex: number = 0): void {
  const jammedWeapons = ((character.state.statusTokens['jammedWeapons'] as unknown) as number[]) || [];
  const index = jammedWeapons.indexOf(weaponIndex);
  if (index > -1) {
    jammedWeapons.splice(index, 1);
    character.state.statusTokens['jammedWeapons'] = jammedWeapons as any;
  }
}

/**
 * Set weapon as jammed
 */
export function setWeaponJammed(character: Character, weaponIndex: number = 0): void {
  const jammedWeapons = ((character.state.statusTokens['jammedWeapons'] as unknown) as number[]) || [];
  if (!jammedWeapons.includes(weaponIndex)) {
    jammedWeapons.push(weaponIndex);
    character.state.statusTokens['jammedWeapons'] = jammedWeapons as any;
  }
}

/**
 * Check if weapon is jammed
 */
export function isWeaponJammed(character: Character, weaponIndex: number = 0): boolean {
  const jammedWeapons = ((character.state.statusTokens['jammedWeapons'] as unknown) as number[]) || [];
  return jammedWeapons.includes(weaponIndex);
}

/**
 * [Burst] — ROF
 * QSR: Fires in bursts. +1b to Hit Test, but weapon jams on roll of 1 on any die.
 */
export function hasBurst(character: Character, weaponIndex: number = 0): boolean {
  const equipment = character.profile?.equipment || character.profile?.items || [];
  if (weaponIndex >= equipment.length) return false;
  const weapon = equipment[weaponIndex];
  return weapon.traits?.some(t => t.includes('[Burst]')) ?? false;
}

export interface BurstBonusResult {
  bonusBaseDice: number;
  jamRisk: boolean;
}

/**
 * Get [Burst] trait bonus
 * +1b to Hit Test, but increased jam risk
 */
export function getBurstBonus(character: Character, weaponIndex: number = 0): BurstBonusResult {
  if (!hasBurst(character, weaponIndex)) {
    return { bonusBaseDice: 0, jamRisk: false };
  }
  return { bonusBaseDice: 1, jamRisk: true };
}

// ============================================================================
// MULTIPLE ATTACK PENALTY
// ============================================================================

/**
 * Multiple Attack Penalty
 * QSR: -1m to Hit Test when using same weapon consecutively
 */
export interface MultipleAttackState {
  lastWeaponUsed: number | null; // Weapon index
  consecutiveAttacks: number;
}

/**
 * Check if multiple attack penalty applies
 * Returns -1m penalty if using same weapon consecutively
 */
export function getMultipleAttackPenalty(
  character: Character,
  weaponIndex: number
): { penalty: number; isConsecutive: boolean } {
  const lastWeaponUsed = character.state.statusTokens['lastWeaponUsed'];
  
  if (lastWeaponUsed === weaponIndex) {
    const classification = getWeaponClassification(character, weaponIndex);
    const weaponsOfClass = getWeaponsByClassification(character, classification);
    if (weaponsOfClass.length > 1) {
      return { penalty: 1, isConsecutive: true };
    }
  }
  
  return { penalty: 0, isConsecutive: false };
}

/**
 * Record weapon use for multiple attack tracking
 */
export function recordWeaponUse(character: Character, weaponIndex: number): void {
  character.state.statusTokens['lastWeaponUsed'] = weaponIndex;
}

/**
 * Reset multiple attack tracking (end of Initiative)
 */
export function resetMultipleAttackTracking(character: Character): void {
  character.state.statusTokens['lastWeaponUsed'] = null as any;
}

// ============================================================================
// NATURAL WEAPONS MULTI-ATTACK EXEMPTION
// ============================================================================

/**
 * Natural Weapons Multi-Attack Exemption
 * QSR: Natural weapons are exempt from Multiple Attack Penalty
 */
export function isNaturalWeapon(character: Character, weaponIndex: number = 0): boolean {
  const equipment = character.profile?.equipment || character.profile?.items || [];
  if (weaponIndex >= equipment.length) return false;
  const weapon = equipment[weaponIndex];
  const classification = (weapon.classification || weapon.class || '').toLowerCase();
  return classification.includes('natural');
}

/**
 * Check if character is exempt from Multiple Attack Penalty
 * Natural weapons and characters with Natural Weapon trait are exempt
 */
export function isMultipleAttackExempt(character: Character, weaponIndex: number = 0): boolean {
  // Natural weapons are exempt
  if (isNaturalWeapon(character, weaponIndex)) {
    return true;
  }
  
  // Natural Weapon trait provides exemption
  return getCharacterTraitLevel(character, 'Natural Weapon') > 0;
}

// ============================================================================
// MULTIPLE WEAPONS BONUS
// ============================================================================

/**
 * Multiple Weapons (△)
 * QSR: Characters benefit from Multiple Weapons rule if:
 * - Model is sculpted with multiple weapons
 * - Weapons are purchased using BP
 * - All weapons are same classification (all Melee or all Ranged)
 * 
 * Benefit: +1m per additional weapon of same classification
 * Penalty: -1m for consecutive same weapon use (if others in hand)
 */

export type WeaponClassification = 'Melee' | 'Ranged' | 'Natural';

function hasConcealOrDiscrete(item?: Item): boolean {
  if (!item?.traits) return false;
  return item.traits.some(trait => {
    const lower = trait.toLowerCase();
    return lower.includes('conceal') || lower.includes('discrete');
  });
}

function getWeaponPoolForMultipleWeapons(character: Character): Item[] {
  const inHand = character.profile?.inHandItems ?? [];
  const stowed = character.profile?.stowedItems ?? [];
  const equipment = character.profile?.equipment || character.profile?.items || [];

  if (inHand.length > 0) {
    const concealedStowed = stowed.filter(item => hasConcealOrDiscrete(item));
    return Array.from(new Set([...inHand, ...concealedStowed]));
  }

  return equipment;
}

/**
 * Find a weapon's index on a character profile (equipment/items).
 * Falls back to 0 when not found.
 */
export function getWeaponIndexForCharacter(character: Character, weapon: Item): number {
  const equipment = character.profile?.equipment || character.profile?.items || [];
  const idx = equipment.findIndex(item => item === weapon || item?.name === weapon?.name);
  return idx >= 0 ? idx : 0;
}

/**
 * Get weapon classification for Multiple Weapons rule
 * - Melee weapons with Throwable count as Ranged
 * - Ranged weapons with [Awkward] count as Melee
 * - Natural weapons are their own classification
 */
export function getWeaponClassification(
  character: Character,
  weaponIndex: number
): WeaponClassification {
  // Natural weapons
  if (isNaturalWeapon(character, weaponIndex)) {
    return 'Natural';
  }
  
  const equipment = character.profile?.equipment || character.profile?.items || [];
  if (weaponIndex >= equipment.length) {
    return 'Melee'; // Default
  }
  
  const weapon = equipment[weaponIndex];
  const classification = (weapon.classification || weapon.class || '').toLowerCase();
  const traits = weapon.traits || [];
  
  // Check for [Awkward] - Ranged weapons count as Melee
  if (traits.some(t => t.includes('[Awkward]'))) {
    return 'Melee';
  }
  
  // Check for Throwable - Melee weapons count as Ranged
  if (traits.some(t => t.includes('Throwable'))) {
    return 'Ranged';
  }
  
  // Standard classification
  if (classification.includes('bow') || 
      classification.includes('thrown') || 
      classification.includes('firearm') ||
      classification.includes('range') ||
      classification.includes('support')) {
    return 'Ranged';
  }
  
  return 'Melee';
}

/**
 * Get all weapons of a specific classification "in hand"
 */
export function getWeaponsByClassification(
  character: Character,
  classification: WeaponClassification
): number[] {
  const equipment = character.profile?.equipment || character.profile?.items || [];
  const pool = getWeaponPoolForMultipleWeapons(character);
  const weaponsInHand: number[] = [];
  
  for (const weapon of pool) {
    const index = equipment.findIndex(item => item === weapon || item?.name === weapon?.name);
    if (index < 0) continue;
    
    // Skip improvised weapons
    if (weapon.classification?.toLowerCase().includes('improvised')) {
      continue;
    }
    
    const weaponClass = getWeaponClassification(character, index);
    
    if (weaponClass === classification) {
      weaponsInHand.push(index);
    }
  }
  
  return weaponsInHand;
}

/**
 * Get Multiple Weapons bonus
 * QSR: +1m per additional weapon of same classification when targeting same model
 */
export function getMultipleWeaponsBonus(
  character: Character,
  weaponIndex: number,
  isCloseCombat: boolean
): number {
  // Determine classification for this attack
  const targetClassification = isCloseCombat ? 'Melee' : 'Ranged';
  const weaponClassification = getWeaponClassification(character, weaponIndex);
  
  // Natural weapons use Natural classification
  if (weaponClassification === 'Natural') {
    const naturalWeapons = getWeaponsByClassification(character, 'Natural');
    return Math.max(0, naturalWeapons.length - 1);
  }
  
  // Check if weapon matches attack type
  if (isCloseCombat) {
    const meleeWeapons = getWeaponsByClassification(character, 'Melee');
    return Math.max(0, meleeWeapons.length - 1);
  } else {
    const rangedWeapons = getWeaponsByClassification(character, 'Ranged');
    return Math.max(0, rangedWeapons.length - 1);
  }
}

/**
 * Check if character qualifies for Multiple Weapons benefit
 * QSR: Must have multiple weapons of same classification
 */
export function qualifiesForMultipleWeapons(
  character: Character,
  isCloseCombat: boolean
): boolean {
  if (isCloseCombat) {
    const meleeWeapons = getWeaponsByClassification(character, 'Melee');
    const naturalWeapons = getWeaponsByClassification(character, 'Natural');
    return meleeWeapons.length > 1 || naturalWeapons.length > 1;
  } else {
    const rangedWeapons = getWeaponsByClassification(character, 'Ranged');
    return rangedWeapons.length > 1;
  }
}

/**
 * Check if character has mixed weapon types (no Multiple Weapons bonus)
 */
export function hasMixedWeaponTypes(character: Character): boolean {
  const meleeWeapons = getWeaponsByClassification(character, 'Melee');
  const rangedWeapons = getWeaponsByClassification(character, 'Ranged');
  const naturalWeapons = getWeaponsByClassification(character, 'Natural');
  
  const nonEmptyClassifications = [
    meleeWeapons.length > 0,
    rangedWeapons.length > 0,
    naturalWeapons.length > 0
  ].filter(Boolean).length;
  
  return nonEmptyClassifications > 1;
}

// ============================================================================
// SITUATIONAL AWARENESS
// ============================================================================

/**
 * Situational Awareness (Advanced Initiative Rule)
 * QSR: When Side reduced to < half original model count:
 * - Check if Designated Leader has half forces within LOS and Awareness range
 * - If not, do not add INT to Initiative Test Score
 * - Hidden characters behind Cover never counted
 */
export interface SituationalAwarenessResult {
  /** Whether leader passes Situational Awareness check */
  passes: boolean;
  /** Number of models within LOS and range */
  modelsInCommand: number;
  /** Total models remaining */
  totalModels: number;
  /** Half threshold */
  halfThreshold: number;
  /** Reason for failure (if any) */
  reason?: string;
}

/**
 * Check if Designated Leader passes Situational Awareness
 */
export function checkSituationalAwareness(
  leader: Character,
  sideModels: Character[],
  getCharacterPosition: (character: Character) => { x: number; y: number } | undefined,
  isBehindCover: (character: Character) => boolean,
  isInLos: (character1: Character, character2: Character) => boolean,
  awarenessRange: number = 16 // Default Visibility range
): SituationalAwarenessResult {
  const totalModels = sideModels.length;
  const halfThreshold = Math.ceil(totalModels / 2);
  
  // Check if Side is reduced to < half original model count
  if (totalModels >= halfThreshold * 2) {
    // Not reduced enough to trigger check
    return {
      passes: true,
      modelsInCommand: totalModels,
      totalModels,
      halfThreshold,
    };
  }
  
  // Count models within LOS and Awareness range of leader
  let modelsInCommand = 0;
  
  for (const model of sideModels) {
    if (model.id === leader.id) {
      // Leader always counts
      modelsInCommand++;
      continue;
    }
    
    // Hidden characters behind Cover never counted
    if (model.state.isHidden && isBehindCover(model)) {
      continue;
    }
    
    // Check LOS
    if (!isInLos(leader, model)) {
      continue;
    }
    
    // Check range
    const leaderPos = getCharacterPosition(leader);
    const modelPos = getCharacterPosition(model);
    
    if (!leaderPos || !modelPos) {
      continue;
    }
    
    const distance = Math.sqrt(
      Math.pow(modelPos.x - leaderPos.x, 2) +
      Math.pow(modelPos.y - leaderPos.y, 2)
    );
    
    if (distance <= awarenessRange) {
      modelsInCommand++;
    }
  }
  
  // Check if leader has half forces within LOS and range
  const passes = modelsInCommand >= halfThreshold;
  
  return {
    passes,
    modelsInCommand,
    totalModels,
    halfThreshold,
    reason: passes ? undefined : `Leader only has ${modelsInCommand} models in command (need ${halfThreshold})`,
  };
}

/**
 * Get Tactics trait level for Initiative Test bonus
 * Also provides exemption from Situational Awareness
 */
export function getTacticsInitiativeBonus(character: Character): number {
  return getCharacterTraitLevel(character, 'Tactics');
}

/**
 * Check if character is exempt from Situational Awareness due to Tactics trait
 */
export function getTacticsSituationalAwarenessExemption(character: Character): boolean {
  // Tactics X: Avoid Situational Awareness penalty
  return getCharacterTraitLevel(character, 'Tactics') > 0;
}

// ============================================================================
// THROWABLE
// ============================================================================

/**
 * Throwable — Asset
 * QSR: See [Discard+]. Use as Thrown weapon for Ranged Attacks but do not
 *      receive any Accuracy [Acc] bonus.
 */
export function hasThrowable(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Throwable') > 0;
}

export function getThrowableOptimalRange(character: Character): number {
  // Throwable weapons use STR for OR
  if (!hasThrowable(character)) {
    return 0;
  }
  return character.finalAttributes?.str ?? character.attributes?.str ?? 0;
}

export function throwableReceivesAccuracyBonus(character: Character): boolean {
  // Throwable does NOT receive Accuracy bonus
  return false;
}

// ============================================================================
// CHARGE
// ============================================================================

/**
 * Charge — Attack Effect
 * QSR: When Attentive, receive +1 Wild die Attacker Damage Test and +1 Impact
 *      if this used with the "Charge" bonus.
 */
export function hasCharge(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Charge') > 0;
}

export interface ChargeBonusResult {
  hasChargeBonus: boolean;
  damageBonus: number; // +1 Wild die
  impactBonus: number; // +1 Impact
}

export function checkChargeBonus(
  character: Character,
  movedThisAction: boolean,
  wasFree: boolean,
  isNowInBaseContact: boolean,
  overClearTerrain: boolean,
  movedAtLeastBaseDiameter: boolean,
  isAttentive: boolean
): ChargeBonusResult {
  if (!hasCharge(character) || !isAttentive) {
    return {
      hasChargeBonus: false,
      damageBonus: 0,
      impactBonus: 0,
    };
  }

  // Charge bonus: moved into base-contact from Free position over Clear terrain
  const hasChargeBonus =
    movedThisAction &&
    wasFree &&
    isNowInBaseContact &&
    overClearTerrain &&
    movedAtLeastBaseDiameter;

  if (!hasChargeBonus) {
    return {
      hasChargeBonus: false,
      damageBonus: 0,
      impactBonus: 0,
    };
  }

  // +1 Wild die for Damage Test, +1 Impact
  return {
    hasChargeBonus: true,
    damageBonus: 1, // +1 Wild die
    impactBonus: 1, // +1 Impact
  };
}

// ============================================================================
// STUB
// ============================================================================

/**
 * [Stub] — Attack Effect
 * QSR: May not use Overreach when attacking.
 *      Penalized -1 Modifier die Close Hit Tests unless in base-contact with
 *      only Opposing models using weapons with [Stub] for Close Combat.
 *      Passive characters in base-contact are not considered Engaged unless
 *      they also have [Stub].
 */
export function hasStub(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Stub') > 0;
}

export function canUseOverreach(character: Character): boolean {
  // May not use Overreach if has Stub
  return !hasStub(character);
}

export function getStubPenalty(
  character: Character,
  allOpposingInContactHaveStub: boolean
): number {
  if (!hasStub(character)) {
    return 0;
  }

  // -1m unless in base-contact with only Opposing models using [Stub] weapons
  if (allOpposingInContactHaveStub) {
    return 0;
  }

  return -1; // -1 Modifier die
}

export function isEngagedWithStubModel(
  character: Character,
  opposingModel: Character
): boolean {
  // Passive characters in base-contact are not considered Engaged unless
  // they also have [Stub]
  if (!hasStub(opposingModel)) {
    return false;
  }
  return true;
}

// ============================================================================
// LUMBERING
// ============================================================================

/**
 * [Lumbering] — Intrinsic
 * QSR: For Situational Test Modifiers, when this model is Flanked, Cornered,
 *      or Confined, the penalty is a Base die each instead of a Modifier die each.
 */
export function hasLumbering(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Lumbering') > 0;
}

export function getLumberingPenaltyType(
  character: Character,
  isFlanked: boolean,
  isCornered: boolean,
  isConfined: boolean
): 'modifier' | 'base' {
  if (!hasLumbering(character)) {
    return 'modifier';
  }

  // Upgrade penalty to Base die if Flanked, Cornered, or Confined
  if (isFlanked || isCornered || isConfined) {
    return 'base';
  }

  return 'modifier';
}

// ============================================================================
// BLINDERS
// ============================================================================

/**
 * [Blinders] — Intrinsic
 * QSR: Penalized -1 Modifier die in a Scrum.
 *      May not perform Bonus Actions unless Attentive.
 *      Ranged Attacks with Bow weapons are disallowed.
 *      Thrown weapons are penalized -1 Modifier die.
 */
export function hasBlinders(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Blinders') > 0;
}

export function getBlindersScrumPenalty(character: Character, isInScrum: boolean): number {
  if (!hasBlinders(character) || !isInScrum) {
    return 0;
  }
  return -1; // -1 Modifier die in Scrum
}

export function canPerformBonusActions(character: Character, isAttentive: boolean): boolean {
  if (!hasBlinders(character)) {
    return true;
  }
  // May not perform Bonus Actions unless Attentive
  return isAttentive;
}

export function canUseBowWeapon(character: Character): boolean {
  if (!hasBlinders(character)) {
    return true;
  }
  // Ranged Attacks with Bow weapons are disallowed
  return false;
}

export function getBlindersThrownPenalty(character: Character, isThrownAttack: boolean): number {
  if (!hasBlinders(character) || !isThrownAttack) {
    return 0;
  }
  return -1; // -1 Modifier die for Thrown weapons
}

// ============================================================================
// BRAWL
// ============================================================================

/**
 * Brawl X — Skill
 * QSR: Whenever performing Bonus Actions for Close Combat, receives +X cascades.
 *      If Opposing model has Brawl trait, reduce both levels by the lower amount.
 *      If Attentive and Engaged, acquire a Delay token to perform Bonus Actions
 *      despite failing the Attacker Close Combat Test.
 */
export function getBrawlLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Brawl');
}

export function getBrawlCascadeBonus(
  character: Character,
  opponent: Character,
  isPerformingBonusAction: boolean
): number {
  if (!isPerformingBonusAction) {
    return 0;
  }

  let brawlLevel = getBrawlLevel(character);
  const opponentBrawlLevel = getBrawlLevel(opponent);

  // If Opposing model has Brawl trait, reduce both levels by the lower amount
  if (opponentBrawlLevel > 0) {
    const reduction = Math.min(brawlLevel, opponentBrawlLevel);
    brawlLevel -= reduction;
  }

  return brawlLevel;
}

export function canPerformBonusActionOnFailedTest(
  character: Character,
  isAttentive: boolean,
  isEngaged: boolean
): boolean {
  const brawlLevel = getBrawlLevel(character);
  if (brawlLevel <= 0) {
    return false;
  }

  // If Attentive and Engaged, can acquire Delay token to perform Bonus Actions
  // despite failing the Attacker Close Combat Test
  return isAttentive && isEngaged;
}

// ============================================================================
// FIGHT
// ============================================================================

/**
 * Fight X — Skill
 * QSR: Reduces up to X penalty Modifier dice for Close Combat Hit Tests.
 *      When Attentive, for each level of Fight higher than the Opposing character,
 *      allow an additional Bonus Action for the Attack action.
 */
export function getFightLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Fight');
}

/**
 * Get Fight bonus dice for backward compatibility.
 * Note: Fight trait reduces penalties, it doesn't directly add dice.
 * This returns 0 to maintain test compatibility.
 */
export function getFightBonus(character: Character): number {
  // Fight trait reduces penalty dice, doesn't add bonus dice directly
  // Returning 0 maintains backward compatibility with existing tests
  return 0;
}

export function getFightPenaltyReduction(character: Character): number {
  // Reduces up to X penalty Modifier dice for Close Combat Hit Tests
  return getFightLevel(character);
}

export function getFightBonusActions(
  character: Character,
  opponent: Character,
  isAttentive: boolean
): number {
  if (!isAttentive) {
    return 0;
  }

  const fightLevel = getFightLevel(character);
  const opponentFightLevel = getFightLevel(opponent);

  // For each level higher than opponent, allow additional Bonus Action
  const levelDifference = Math.max(0, fightLevel - opponentFightLevel);
  return levelDifference;
}

// ============================================================================
// SHOOT
// ============================================================================

/**
 * Shoot X — Skill
 * QSR: Reduce up to X penalty Modifier dice for Attacker Range Combat Hit Tests.
 *      Increase Maximum OR Multiple by X.
 */
export function getShootLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Shoot');
}

export function getShootPenaltyReduction(character: Character): number {
  // Reduces up to X penalty Modifier dice for Range Combat Hit Tests
  return getShootLevel(character);
}

export function getShootMaxORMBonus(character: Character): number {
  // Increase Maximum OR Multiple by X
  return getShootLevel(character);
}

// ============================================================================
// ARCHERY
// ============================================================================

/**
 * Archery — Skill
 * QSR: +1m Bow Hit Test
 */
export function hasArchery(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Archery') > 0;
}

export function getArcheryBonus(character: Character, isUsingBow: boolean): number {
  if (!hasArchery(character) || !isUsingBow) {
    return 0;
  }
  return getCharacterTraitLevel(character, 'Archery');
}

// ============================================================================
// SCHOLAR
// ============================================================================

/**
 * Scholar — Skill
 * QSR: +1m INT Tests
 */
export function hasScholar(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Scholar') > 0;
}

export function getScholarBonus(character: Character, isIntTest: boolean): number {
  if (!hasScholar(character) || !isIntTest) {
    return 0;
  }
  return getCharacterTraitLevel(character, 'Scholar');
}

// ============================================================================
// INSANE
// ============================================================================

/**
 * Insane — Psychology
 * QSR: Unless has one or more Hindrance tokens, is not affected by any trait
 *      with the Psychology keyword and does not perform any Morale Tests.
 *      Not affected by Hindrance penalties for Morale Tests.
 */
export function hasInsane(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Insane') > 0;
}

export function isImmuneToFear(character: Character): boolean {
  // Insane or Grit characters are immune to Fear
  return hasInsane(character) || hasGrit(character);
}

export function isImmuneToPsychology(
  character: Character,
  hasHindranceTokens: boolean
): boolean {
  if (!hasInsane(character)) {
    return false;
  }

  // Unless has one or more Hindrance tokens, not affected by Psychology
  if (hasHindranceTokens) {
    return false;
  }

  return true;
}

export function isExemptFromMoraleTests(
  character: Character,
  hasHindranceTokens: boolean
): boolean {
  if (hasGrit(character)) {
    return true;
  }
  if (!hasInsane(character)) {
    return false;
  }
  if (hasHindranceTokens) {
    return false;
  }
  return true;
}

export function isImmuneToHindranceMoralePenalties(character: Character): boolean {
  // Not affected by Hindrance penalties for Morale Tests
  return hasInsane(character) || hasGrit(character);
}

// ============================================================================
// COWARD
// ============================================================================

/**
 * [Coward] — Psychology (Disability)
 * QSR: Additional Fear tokens on failed Morale
 */
export function hasCoward(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Coward') > 0;
}

export function getCowardAdditionalFearTokens(
  character: Character,
  failedMoraleTest: boolean
): number {
  if (!hasCoward(character) || !failedMoraleTest) {
    return 0;
  }
  // Coward receives additional Fear tokens on failed Morale
  // Typically +1 Fear token
  return 1;
}

// ============================================================================
// ADDITIONAL PSYCHOLOGY TRAITS
// ============================================================================

/**
 * Fanatic — Psychology
 * QSR: Immune to Fear from Psychology keyword traits. Does not perform Morale Tests
 *      caused by Psychology traits.
 */
export function hasFanatic(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Fanatic') > 0;
}

export function isImmuneToFanaticFear(character: Character): boolean {
  return hasFanatic(character);
}

/**
 * Terror X — Psychology
 * QSR: Enemy models within X MU that fail Morale Tests against this character
 *      receive +1 Fear token.
 */
export function getTerrorLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Terror');
}

export function hasTerror(character: Character): boolean {
  return getTerrorLevel(character) > 0;
}

export interface TerrorEffectResult {
  additionalFearTokens: number;
  withinTerrorRange: boolean;
}

export function checkTerrorEffect(
  terrorCharacter: Character,
  targetCharacter: Character,
  getCharacterPosition: (character: Character) => { x: number; y: number } | undefined
): TerrorEffectResult {
  const terrorLevel = getTerrorLevel(terrorCharacter);
  
  if (terrorLevel <= 0) {
    return { additionalFearTokens: 0, withinTerrorRange: false };
  }
  
  const terrorPos = getCharacterPosition(terrorCharacter);
  const targetPos = getCharacterPosition(targetCharacter);
  
  if (!terrorPos || !targetPos) {
    return { additionalFearTokens: 0, withinTerrorRange: false };
  }
  
  const distance = Math.sqrt(
    Math.pow(targetPos.x - terrorPos.x, 2) +
    Math.pow(targetPos.y - terrorPos.y, 2)
  );
  
  if (distance <= terrorLevel) {
    return { additionalFearTokens: 1, withinTerrorRange: true };
  }
  
  return { additionalFearTokens: 0, withinTerrorRange: false };
}

/**
 * Hatred X — Psychology
 * QSR: When engaged with hated enemy type, receive +Xb to Close Combat Hit Tests.
 */
export function getHatredLevel(character: Character, enemyType?: string): number {
  // Hatred is typically specified with a target type (e.g., "Hatred (Orcs)")
  // For simplicity, check general Hatred level
  return getCharacterTraitLevel(character, 'Hatred');
}

export function hasHatred(character: Character): boolean {
  return getHatredLevel(character) > 0;
}

export interface HatredBonusResult {
  bonusBaseDice: number;
  hatredActive: boolean;
}

export function getHatredBonus(
  character: Character,
  isEngagedWithHatedEnemy: boolean
): HatredBonusResult {
  const hatredLevel = getHatredLevel(character);
  
  if (hatredLevel <= 0 || !isEngagedWithHatedEnemy) {
    return { bonusBaseDice: 0, hatredActive: false };
  }
  
  return { bonusBaseDice: hatredLevel, hatredActive: true };
}

// ============================================================================
// CLIMBING AND JUMPING (Agility)
// ============================================================================

/**
 * Climbing — Agility Action
 * QSR: Climb vertical surfaces using Agility. 
 *      Climb distance = Agility in MU.
 *      Difficult climbs may require Unopposed Agility Test.
 */
export interface ClimbResult {
  success: boolean;
  distanceClimbed: number;
  agilityUsed: number;
  testRequired: boolean;
  testPassed?: boolean;
}

export function calculateClimbDistance(
  character: Character,
  climbDifficulty: 'easy' | 'normal' | 'difficult' = 'normal',
  agilityTestRolls?: number[]
): ClimbResult {
  const agility = character.finalAttributes.mov ?? character.attributes.mov ?? 0;
  const climbDistance = agility; // Base climb distance = Agility
  
  // Difficult climbs require Agility Test
  const testRequired = climbDifficulty === 'difficult';
  let testPassed = !testRequired;
  
  if (testRequired && agilityTestRolls && agilityTestRolls.length > 0) {
    // Simple unopposed test vs. System (2 Base + 2)
    const systemScore = 4;
    let characterScore = 0;
    
    for (const roll of agilityTestRolls) {
      if (roll >= 6) characterScore += 2;
      else if (roll >= 4) characterScore += 1;
    }
    characterScore += agility;
    
    testPassed = characterScore >= systemScore;
  }
  
  return {
    success: testPassed,
    distanceClimbed: testPassed ? climbDistance : 0,
    agilityUsed: agility,
    testRequired,
    testPassed,
  };
}

/**
 * Jump Up/Down/Across — Agility Action
 * QSR: Jump using Agility. Distance based on Agility and jump type.
 */
export interface JumpResult {
  success: boolean;
  distanceJumped: number;
  jumpType: 'up' | 'down' | 'across';
  agilityUsed: number;
  testRequired: boolean;
  testPassed?: boolean;
}

export function calculateJump(
  character: Character,
  jumpType: 'up' | 'down' | 'across',
  jumpDistance: number,
  agilityTestRolls?: number[]
): JumpResult {
  const agility = character.finalAttributes.mov ?? character.attributes.mov ?? 0;
  
  // Base jump distances
  let maxJumpDistance: number;
  let testRequired = false;
  
  switch (jumpType) {
    case 'up':
      maxJumpDistance = Math.ceil(agility / 2); // Half Agility for vertical jump
      testRequired = jumpDistance > 1;
      break;
    case 'down':
      maxJumpDistance = agility * 2; // Double Agility for downward jump
      testRequired = jumpDistance > agility;
      break;
    case 'across':
      maxJumpDistance = agility; // Full Agility for horizontal jump
      testRequired = jumpDistance > Math.ceil(agility / 2);
      break;
  }
  
  let testPassed = !testRequired;
  
  if (testRequired && agilityTestRolls && agilityTestRolls.length > 0) {
    // Unopposed Agility Test
    const systemScore = 4;
    let characterScore = 0;
    
    for (const roll of agilityTestRolls) {
      if (roll >= 6) characterScore += 2;
      else if (roll >= 4) characterScore += 1;
    }
    characterScore += agility;
    
    testPassed = characterScore >= systemScore;
  }
  
  return {
    success: testPassed && jumpDistance <= maxJumpDistance,
    distanceJumped: testPassed ? jumpDistance : 0,
    jumpType,
    agilityUsed: agility,
    testRequired,
    testPassed,
  };
}

/**
 * Running Jump — Agility Action
 * QSR: Jump with running start. +X" bonus based on movement.
 */
export function calculateRunningJump(
  character: Character,
  jumpType: 'up' | 'down' | 'across',
  runDistance: number,
  targetDistance: number,
  agilityTestRolls?: number[]
): JumpResult {
  const agility = character.finalAttributes.mov ?? character.attributes.mov ?? 0;
  
  // Running start provides bonus
  const runningBonus = Math.floor(runDistance / 2); // +1" per 2" run
  
  // Calculate effective jump distance
  let baseJumpDistance: number;
  switch (jumpType) {
    case 'up':
      baseJumpDistance = Math.ceil(agility / 2) + runningBonus;
      break;
    case 'down':
      baseJumpDistance = (agility * 2) + runningBonus;
      break;
    case 'across':
      baseJumpDistance = agility + runningBonus;
      break;
  }
  
  const testRequired = targetDistance > baseJumpDistance * 0.75;
  let testPassed = !testRequired;
  
  if (testRequired && agilityTestRolls && agilityTestRolls.length > 0) {
    const systemScore = 4;
    let characterScore = 0;
    
    for (const roll of agilityTestRolls) {
      if (roll >= 6) characterScore += 2;
      else if (roll >= 4) characterScore += 1;
    }
    characterScore += agility;
    
    testPassed = characterScore >= systemScore;
  }
  
  return {
    success: testPassed && targetDistance <= baseJumpDistance,
    distanceJumped: testPassed ? targetDistance : 0,
    jumpType,
    agilityUsed: agility,
    testRequired,
    testPassed,
  };
}

/**
 * Check if character has [Lumbering] trait (cannot climb/jump)
 * Note: This function is defined earlier in the file
 */

export function canClimbOrJump(character: Character): boolean {
  // [Lumbering] trait prevents climbing and jumping
  return !hasLumbering(character);
}

/**
 * Get Agility value for a character
 * QSR: Agility = half of MOV in MU (unless modified)
 */
export function getAgility(character: Character): number {
  const mov = character.finalAttributes.mov ?? character.attributes.mov ?? 0;
  return Math.floor(mov / 2);
}

// ============================================================================
// STUN
// ============================================================================

/**
 * Stun X — Attack Effect
 * QSR: If the Active character passes the Attacker Close Combat Damage Test,
 *      or if adding X causes the Test to pass, then there may be a Stun effect.
 *      Add X to the number of successes scored by the Active character, and
 *      subtract the target's Durability (higher of SIZ or FOR). This is the Stun Test.
 *      The target acquires a Delay token as Stun damage if the Stun Test passes,
 *      and one more for every 3 additional cascades.
 */
export function getStunLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Stun');
}

export function hasStun(character: Character): boolean {
  return getStunLevel(character) > 0;
}

export interface StunResult {
  stunTestPassed: boolean;
  delayTokensApplied: number;
  stunCascades: number;
}

export function calculateStunEffect(
  attacker: Character,
  defender: Character,
  attackerSuccesses: number,
  damageTestPassed: boolean
): StunResult {
  const stunLevel = getStunLevel(attacker);

  if (stunLevel <= 0) {
    return {
      stunTestPassed: false,
      delayTokensApplied: 0,
      stunCascades: 0,
    };
  }

  // Add X to successes for Stun Test
  const stunSuccesses = attackerSuccesses + stunLevel;

  // Target's Durability is higher of SIZ or FOR
  const defenderDurability = Math.max(
    defender.finalAttributes.siz ?? defender.attributes.siz ?? 0,
    defender.finalAttributes.for ?? defender.attributes.for ?? 0
  );

  // Stun Test passes if stunSuccesses > durability
  const stunCascades = Math.max(0, stunSuccesses - defenderDurability);
  const stunTestPassed = stunCascades > 0;

  // Target acquires Delay token if Stun Test passes
  // One more for every 3 additional cascades
  let delayTokensApplied = 0;
  if (stunTestPassed) {
    delayTokensApplied = 1 + Math.floor(stunCascades / 3);
  }

  return {
    stunTestPassed,
    delayTokensApplied,
    stunCascades,
  };
}

// ============================================================================
// NATURAL WEAPON
// ============================================================================

/**
 * Natural Weapon — Keyword
 * QSR: Are not penalized for use in multiple attacks.
 *      May not use Overreach when attacking.
 *      Unless otherwise described, it is Accuracy +0, Impact +0, and uses STR for Damage.
 */
export function hasNaturalWeapon(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Natural') > 0;
}

export function canMakeMultipleNaturalAttacks(character: Character): boolean {
  // Natural weapons are not penalized for multiple attacks
  return hasNaturalWeapon(character);
}

export function canUseOverreachWithNaturalWeapon(character: Character): boolean {
  // Natural weapons may not use Overreach
  return false;
}

export function getNaturalWeaponStats(): { accuracy: number; impact: number; damageAttribute: string } {
  // Default Natural Weapon stats: Acc +0, Impact +0, STR for Damage
  return {
    accuracy: 0,
    impact: 0,
    damageAttribute: 'STR',
  };
}

// ============================================================================
// BONUS ACTION HELPERS
// ============================================================================

/**
 * Check if character can perform additional Bonus Actions based on traits
 */
export interface BonusActionEligibility {
  canPerform: boolean;
  requiresDelayToken: boolean;
  additionalActions: number;
}

export function checkBonusActionEligibility(
  character: Character,
  opponent: Character,
  isAttentive: boolean,
  isEngaged: boolean,
  failedHitTest: boolean
): BonusActionEligibility {
  const result: BonusActionEligibility = {
    canPerform: isAttentive,
    requiresDelayToken: false,
    additionalActions: 0,
  };

  // Check Blinders - must be Attentive
  if (!canPerformBonusActions(character, isAttentive)) {
    result.canPerform = false;
    return result;
  }

  // Fight trait grants additional Bonus Actions
  result.additionalActions += getFightBonusActions(character, opponent, isAttentive);

  // Brawl trait allows Bonus Actions even on failed hit test (with Delay token)
  if (failedHitTest && canPerformBonusActionOnFailedTest(character, isAttentive, isEngaged)) {
    result.requiresDelayToken = true;
    result.canPerform = true;
  }

  return result;
}

// ============================================================================
// MISSING COMBAT TRAITS
// ============================================================================

// ============================================================================
// [AWKWARD]
// ============================================================================

/**
 * [Awkward] — Attack Effect (Disability)
 * QSR: Costs an extra AP to perform Attacks while in base-contact with any Opposing model.
 *      When an Opposing model, if no smaller than SIZ minus 3, receives the Charge bonus
 *      against this model, this model acquires a Delay token before resolving the attack.
 */
export function hasAwkward(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Awkward') > 0;
}

export function getAwkwardExtraApCost(character: Character, isEngaged: boolean): number {
  if (!hasAwkward(character) || !isEngaged) {
    return 0;
  }
  return 1; // Extra AP cost
}

export function checkAwkwardChargeDelay(
  defender: Character,
  attacker: Character,
  isChargeAttack: boolean
): { shouldAcquireDelay: boolean; delayTokens: number } {
  if (!hasAwkward(defender) || !isChargeAttack) {
    return {
      shouldAcquireDelay: false,
      delayTokens: 0,
    };
  }

  // Defender acquires Delay token if attacker receives Charge bonus
  // and defender is no smaller than (attacker SIZ - 3)
  const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 0;
  const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 0;
  const sizThreshold = attackerSiz - 3;

  if (defenderSiz >= sizThreshold) {
    return {
      shouldAcquireDelay: true,
      delayTokens: 1,
    };
  }

  return {
    shouldAcquireDelay: false,
    delayTokens: 0,
  };
}

// ============================================================================
// [HAFTED]
// ============================================================================

/**
 * [Hafted] — Asset (Disability)
 * QSR: Penalized -1 Modifier die for Defender Close Combat Hit Tests.
 */
export function hasHafted(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Hafted') > 0;
}

export function getHaftedPenalty(character: Character): number {
  if (!hasHafted(character)) {
    return 0;
  }
  return -1; // -1 Modifier die
}

// ============================================================================
// [DISCARD]
// ============================================================================

/**
 * [Discard] — Asset
 * QSR: Limited use.
 *      [Discard!] — Do not use again (lost after one use).
 *      [Discard+] — Roll die after each use. If fail, next time is last. Max 3 uses total.
 *      [Discard] (plain) — After first use, roll die. If fail, may not use again.
 *                          Otherwise, may be used just once more.
 */
export type DiscardType = 'Discard!' | 'Discard+' | 'Discard';

export function getDiscardType(character: Character, itemIndex: number = 0): DiscardType | null {
  // Check for specific discard variants
  if (getCharacterTraitLevel(character, 'Discard!') > 0) {
    return 'Discard!';
  }
  if (getCharacterTraitLevel(character, 'Discard+') > 0) {
    return 'Discard+';
  }
  if (getCharacterTraitLevel(character, 'Discard') > 0) {
    return 'Discard';
  }
  return null;
}

export interface DiscardState {
  usesRemaining: number;
  mustRollAfterNext: boolean;
}

export function initializeDiscardState(discardType: DiscardType): DiscardState {
  switch (discardType) {
    case 'Discard!':
      return { usesRemaining: 1, mustRollAfterNext: false };
    case 'Discard+':
      return { usesRemaining: 3, mustRollAfterNext: true };
    case 'Discard':
      return { usesRemaining: 2, mustRollAfterNext: false };
  }
}

export function processDiscardUse(
  discardType: DiscardType,
  state: DiscardState,
  dieRoll: number = Math.floor(Math.random() * 6) + 1
): { canContinueUsing: boolean; usesRemaining: number } {
  state.usesRemaining--;

  if (state.usesRemaining <= 0) {
    return { canContinueUsing: false, usesRemaining: 0 };
  }

  // For Discard+, roll after each use
  if (discardType === 'Discard+') {
    // Fail on 1-3 (50% chance)
    if (dieRoll <= 3) {
      return { canContinueUsing: false, usesRemaining: 0 };
    }
  }

  // For plain Discard, roll after first use
  if (discardType === 'Discard' && state.usesRemaining === 1) {
    // Fail on 1-3 (50% chance)
    if (dieRoll <= 3) {
      return { canContinueUsing: false, usesRemaining: 0 };
    }
  }

  return { canContinueUsing: true, usesRemaining: state.usesRemaining };
}

// ============================================================================
// ACROBATIC
// ============================================================================

/**
 * Acrobatic X — Genetic, Skill, Movement
 * QSR: Receive +X Wild dice Defender Close Combat Tests.
 */
export function getAcrobaticLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Acrobatic');
}

export function getAcrobaticBonusDice(character: Character): number {
  return getAcrobaticLevel(character); // +X Wild dice
}

// ============================================================================
// BASH
// ============================================================================

/**
 * Bash — Asset
 * QSR: May use this as an Improvised Melee weapon.
 *      Receive +1 cascade for Bonus Actions after passing the Attacker Close Combat Test
 *      if used Charging and is in base-contact with the target.
 */
export function hasBash(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Bash') > 0;
}

export function checkBashCascadeBonus(
  character: Character,
  isCharging: boolean,
  isInBaseContact: boolean,
  hitTestPassed: boolean
): { cascadeBonus: number } {
  if (!hasBash(character) || !isCharging || !isInBaseContact || !hitTestPassed) {
    return { cascadeBonus: 0 };
  }
  return { cascadeBonus: 1 };
}

// ============================================================================
// BRAWN
// ============================================================================

/**
 * Brawn X — Genetic, Psychology, Skill
 * QSR: Receive +X STR except for Attacker Close Combat Damage Tests.
 */
export function getBrawnLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Brawn');
}

export function getBrawnStrBonus(character: Character, isCloseCombatDamageTest: boolean): number {
  if (isCloseCombatDamageTest) {
    return 0; // No bonus for Close Combat Damage Tests
  }
  return getBrawnLevel(character);
}

export function getEffectiveStr(character: Character, isCloseCombatDamageTest: boolean): number {
  const baseStr = character.finalAttributes.str ?? character.attributes.str ?? 0;
  const brawnBonus = getBrawnStrBonus(character, isCloseCombatDamageTest);
  return baseStr + brawnBonus;
}

// ============================================================================
// DETECT
// ============================================================================

/**
 * Detect X — Genetic, Skill
 * QSR: Receive +X Base dice performing Attacker Detect Tests.
 *      Maximum OR Multiple for Detect Tests increased by X.
 */
export function getDetectLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Detect');
}

export function getDetectBonusDice(character: Character): number {
  return getDetectLevel(character); // +X Base dice
}

export function getDetectMaxOrmBonus(character: Character): number {
  return getDetectLevel(character); // +X to Max ORM
}

// ============================================================================
// EVASIVE
// ============================================================================

/**
 * Evasive X — Genetic, Skill, Movement
 * QSR: Receive +X Modifier dice per OR Multiple for Defender Range Combat Hit Tests.
 *      Once per Turn, if Attentive Free after being targeted for a Range Attack,
 *      may reposition X × 1" and allow use of any Agility for any or all of that distance.
 */
export function getEvasiveLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Evasive');
}

export function getEvasiveBonusDice(character: Character, ormMultiple: number): number {
  const evasiveLevel = getEvasiveLevel(character);
  return evasiveLevel * ormMultiple; // +X Modifier dice per OR Multiple
}

export interface EvasiveRepositionResult {
  canReposition: boolean;
  repositionDistance: number;
  canUseAgility: boolean;
}

export function checkEvasiveReposition(
  character: Character,
  isAttentive: boolean,
  isFree: boolean,
  hasUsedEvasiveThisTurn: boolean
): EvasiveRepositionResult {
  const evasiveLevel = getEvasiveLevel(character);

  if (evasiveLevel <= 0 || !isAttentive || !isFree || hasUsedEvasiveThisTurn) {
    return {
      canReposition: false,
      repositionDistance: 0,
      canUseAgility: false,
    };
  }

  return {
    canReposition: true,
    repositionDistance: evasiveLevel, // X × 1"
    canUseAgility: true,
  };
}

// ============================================================================
// IMPALE
// ============================================================================

/**
 * Impale — Attack Effect
 * QSR: Distracted targets are penalized -1 Base die Defender Damage Test
 *      plus 1 per 3 Impact remaining.
 *      Use the lowest amount of Impact remaining for Defender if it had multiple types of Armor.
 */
export function hasImpale(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Impale') > 0;
}

export function getImpalePenalty(
  defender: Character,
  isDistracted: boolean,
  remainingImpact: number
): number {
  if (!hasImpale(defender) || !isDistracted) {
    return 0;
  }

  // -1 Base die + 1 per 3 Impact remaining
  const basePenalty = 1;
  const impactBonus = Math.floor(remainingImpact / 3);
  return basePenalty + impactBonus;
}

// ============================================================================
// KNIFE-FIGHTER
// ============================================================================

/**
 * Knife-fighter X — Skill
 * QSR: When Attentive and in base-contact while using a weapon that has the [Stub] trait,
 *      receive +X Base dice and +X Impact Close Combat Tests.
 */
export function getKnifeFighterLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Knife-fighter');
}

export function getKnifeFighterBonus(
  character: Character,
  isAttentive: boolean,
  isInBaseContact: boolean,
  isUsingStubWeapon: boolean
): { bonusBaseDice: number; bonusImpact: number } {
  const knifeFighterLevel = getKnifeFighterLevel(character);

  if (knifeFighterLevel <= 0 || !isAttentive || !isInBaseContact || !isUsingStubWeapon) {
    return { bonusBaseDice: 0, bonusImpact: 0 };
  }

  return {
    bonusBaseDice: knifeFighterLevel,
    bonusImpact: knifeFighterLevel,
  };
}

// ============================================================================
// LEADERSHIP
// ============================================================================

/**
 * Leadership X — Psychology, Skill, Leader
 * QSR: Friendly models within Visibility of this character receives bonus +X Base dice
 *      for all Morale Tests. Those models may not receive such a bonus from more than
 *      one character with the Leadership trait per Test.
 */
export function getLeadershipLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Leadership');
}

export function getLeadershipBonusDice(character: Character): number {
  return getLeadershipLevel(character); // +X Base dice
}

export interface LeadershipAuraResult {
  hasLeadership: boolean;
  leadershipLevel: number;
  affectedFriendlyModels: string[]; // Model IDs
}

// Caller must determine which friendly models are within Visibility range
export function checkLeadershipAura(
  character: Character,
  friendlyModels: Array<{ id: string; inVisibility: boolean }>
): LeadershipAuraResult {
  const leadershipLevel = getLeadershipLevel(character);

  if (leadershipLevel <= 0) {
    return {
      hasLeadership: false,
      leadershipLevel: 0,
      affectedFriendlyModels: [],
    };
  }

  const affectedModels = friendlyModels
    .filter(m => m.inVisibility)
    .map(m => m.id);

  return {
    hasLeadership: true,
    leadershipLevel,
    affectedFriendlyModels: affectedModels,
  };
}

// ============================================================================
// LEAP
// ============================================================================

/**
 * Leap X — Genetic, Movement
 * QSR: Increase Agility by +X". Must be used at either the start or end of
 *      a Movement action or reposition.
 */
export function getLeapLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Leap');
}

export function getLeapAgilityBonus(character: Character): number {
  return getLeapLevel(character); // +X" Agility
}

export interface LeapUsage {
  canUseLeap: boolean;
  agilityBonus: number;
}

export function checkLeapUsage(
  character: Character,
  isAtStartOrEndOfMovement: boolean
): LeapUsage {
  const leapLevel = getLeapLevel(character);

  if (leapLevel <= 0 || !isAtStartOrEndOfMovement) {
    return {
      canUseLeap: false,
      agilityBonus: 0,
    };
  }

  return {
    canUseLeap: true,
    agilityBonus: leapLevel,
  };
}

// ============================================================================
// MELEE
// ============================================================================

/**
 * Melee — Attack Effect
 * QSR: This weapon may be used normally while Engaged but must resolve as a
 *      Close Combat Hit Tests by using Opposed CCA.
 *      The target must one which has this Engaged.
 *      When using this weapon for Defender Close Combat, it becomes an Improvised Melee Weapon.
 */
export function hasMeleeTrait(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Melee') > 0;
}

export function canUseMeleeWeaponWhileEngaged(character: Character): boolean {
  return hasMeleeTrait(character);
}

export function isMeleeWeaponImprovisedWhenDefending(character: Character): boolean {
  // When using for Defender Close Combat, becomes Improvised Melee Weapon
  return hasMeleeTrait(character);
}

// ============================================================================
// SNEAKY
// ============================================================================

/**
 * Sneaky X — Psychology, Skill
 * QSR: If Attentive, at the end of this character's Initiative automatically become
 *      Hidden at no cost if behind Cover or when not in LOS.
 *      Receives +X Modifier dice when benefiting from Suddenness Situational Test Modifier.
 *      Optionally begins any Mission as Hidden if behind Cover.
 */
export function getSneakyLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Sneaky');
}

export function checkSneakyAutoHide(
  character: Character,
  isAttentive: boolean,
  isBehindCover: boolean,
  isInLos: boolean
): { canAutoHide: boolean } {
  const sneakyLevel = getSneakyLevel(character);

  if (sneakyLevel <= 0 || !isAttentive) {
    return { canAutoHide: false };
  }

  // Can auto-Hide if behind Cover OR not in LOS
  if (isBehindCover || !isInLos) {
    return { canAutoHide: true };
  }

  return { canAutoHide: false };
}

export function getSneakySuddennessBonus(character: Character): number {
  return getSneakyLevel(character); // +X Modifier dice with Suddenness
}

export function canStartMissionHidden(character: Character, isBehindCover: boolean): boolean {
  const sneakyLevel = getSneakyLevel(character);
  return sneakyLevel > 0 && isBehindCover;
}

// ============================================================================
// SPRINT
// ============================================================================

/**
 * Sprint X — Genetic, Movement
 * QSR: Receives X × 2" for Movement Allowance while moving in a relatively straight line.
 *      If also Attentive Free then receive X × 4" instead.
 */
export function getSprintLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Sprint');
}

export function getSprintMovementBonus(
  character: Character,
  isMovingStraight: boolean,
  isAttentive: boolean,
  isFree: boolean
): number {
  const sprintLevel = getSprintLevel(character);

  if (sprintLevel <= 0 || !isMovingStraight) {
    return 0;
  }

  // X × 4" if Attentive Free, otherwise X × 2"
  if (isAttentive && isFree) {
    return sprintLevel * 4;
  }

  return sprintLevel * 2;
}

// ============================================================================
// SUREFOOTED
// ============================================================================

/**
 * Surefooted X — Genetic, Movement
 * QSR: Upgrade Terrain effects on movement, and for Bonus Actions and Situational Test Modifiers.
 *      If X is 1 then Rough → Clear.
 *      If X is 2 then Difficult → Rough.
 *      If X is 3 then Difficult → Clear.
 */
export function getSurefootedLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Surefooted');
}

export type TerrainType = 'Clear' | 'Rough' | 'Difficult' | 'Impassable' | 'Obstacle';

export function upgradeTerrain(terrain: TerrainType, surefootedLevel: number): TerrainType {
  if (surefootedLevel <= 0) {
    return terrain;
  }

  if (terrain === 'Difficult') {
    // Level 3: Difficult -> Clear (must be checked before level 2)
    if (surefootedLevel >= 3) {
      return 'Clear';
    }
    // Level 2: Difficult -> Rough
    if (surefootedLevel >= 2) {
      return 'Rough';
    }
  }

  // Level 1: Rough → Clear
  if (surefootedLevel >= 1 && terrain === 'Rough') {
    return 'Clear';
  }

  return terrain;
}

export function getSurefootedTerrainBonus(
  character: Character,
  currentTerrain: TerrainType
): TerrainType {
  const surefootedLevel = getSurefootedLevel(character);
  return upgradeTerrain(currentTerrain, surefootedLevel);
}

// ============================================================================
// TACTICS
// ============================================================================

/**
 * Tactics X — Psychology, Skill, Leader
 * QSR: Receive +X Base dice when designated for Initiative Tests.
 *      Avoid X additional Turns requiring Situational Awareness, as Designated Leader
 *      and as Assembly member.
 */
export function getTacticsLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Tactics');
}

// ============================================================================
// UNARMED
// ============================================================================

/**
 * Unarmed — Natural Weapon, Psychology
 * QSR: The character has no weapons in hand, and has no immediately useful Natural weapons assigned to it.
 *      It may perform -1m Close Combat Hit Test, at STR -1m for the Close Combat Damage Test.
 *      Unarmed counts as having [Stub].
 *      Unarmed characters may always acquire and use other weapons during game-play but then
 *      acquire [Discard] when using them and failing a Close Combat attack.
 */
export function isUnarmed(character: Character): boolean {
  // Check if character has no weapons or only has Unarmed trait
  const hasWeapons = character.profile?.items?.some(item => {
    const classification = (item.classification || item.class || '').toLowerCase();
    return classification.includes('melee') || classification.includes('ranged');
  }) ?? false;

  return !hasWeapons || getCharacterTraitLevel(character, 'Unarmed') > 0;
}

export function getUnarmedHitPenalty(character: Character): number {
  if (!isUnarmed(character)) {
    return 0;
  }
  return -1; // -1m Close Combat Hit Test
}

export function getUnarmedDamagePenalty(character: Character): number {
  if (!isUnarmed(character)) {
    return 0;
  }
  return -1; // STR -1m for Close Combat Damage Test
}

export function hasStubFromUnarmed(character: Character): boolean {
  // Unarmed counts as having [Stub]
  return isUnarmed(character);
}

export interface UnarmedWeaponPickupResult {
  canPickup: boolean;
  acquiresDiscard: boolean;
}

export function checkUnarmedWeaponPickup(
  character: Character,
  failedCloseCombatAttack: boolean
): UnarmedWeaponPickupResult {
  if (!isUnarmed(character)) {
    return { canPickup: false, acquiresDiscard: false };
  }

  // Can always acquire and use other weapons during game-play
  // But acquires [Discard] when using them and failing a Close Combat attack
  return {
    canPickup: true,
    acquiresDiscard: failedCloseCombatAttack,
  };
}

// ============================================================================
// [1H] - ONE-HANDED WEAPON
// ============================================================================

/**
 * [1H] — Asset
 * QSR: One-handed Weapons used with a Concentrate action always require two hands instead of just one.
 *      An Item may be used with one less hand, but this causes a penalty of -1 Base die for any Fiddle Tests,
 *      and for the very next Test performed when interrupted by a React.
 */
export function hasOneHandedTrait(item?: Item): boolean {
  if (!item?.traits) return false;
  return item.traits.some(t => t.includes('[1H]'));
}

export interface OneHandedPenaltyResult {
  /** -1 Base die penalty for Fiddle Tests or React-interrupted Tests */
  penalty: number;
  /** Whether the penalty applies */
  applies: boolean;
}

export function checkOneHandedPenalty(
  item: Item | undefined,
  handsCommitted: number,
  handsRequired: number,
  isFiddleTest: boolean = false,
  isReactInterruptedTest: boolean = false
): OneHandedPenaltyResult {
  if (!hasOneHandedTrait(item)) {
    return { penalty: 0, applies: false };
  }

  // Penalty applies if using with one less hand than required
  const usingWithLessHand = handsCommitted < handsRequired;

  if (!usingWithLessHand) {
    return { penalty: 0, applies: false };
  }

  // -1 Base die for Fiddle Tests or React-interrupted Tests
  if (isFiddleTest || isReactInterruptedTest) {
    return { penalty: 1, applies: true };
  }

  return { penalty: 0, applies: false };
}

export function getOneHandedConcentrateRequirement(item: Item): number {
  // [1H] weapons used with Concentrate action require two hands instead of one
  if (hasOneHandedTrait(item)) {
    return 2;
  }
  return 1;
}

// ============================================================================
// [2H] - TWO-HANDED WEAPON
// ============================================================================

/**
 * [2H] — Asset
 * QSR: Two-handed weapons used with two hands are disallowed to use Overreach.
 *      An Item may be used with one less hand, but this causes a penalty of -1 Base die for any Fiddle Tests,
 *      and for the very next Test performed when interrupted by a React.
 */
export function hasTwoHandedTrait(item?: Item): boolean {
  if (!item?.traits) return false;
  return item.traits.some(t => t.includes('[2H]'));
}

export function canUseOverreachWithTwoHandedWeapon(item: Item, usingTwoHands: boolean): boolean {
  // [2H] weapons used with two hands cannot use Overreach
  if (hasTwoHandedTrait(item) && usingTwoHands) {
    return false;
  }
  return true;
}

export interface TwoHandedPenaltyResult {
  /** -1 Base die penalty for Fiddle Tests or React-interrupted Tests */
  penalty: number;
  /** Whether the penalty applies */
  applies: boolean;
}

export function checkTwoHandedPenalty(
  item: Item | undefined,
  handsCommitted: number,
  handsRequired: number,
  isFiddleTest: boolean = false,
  isReactInterruptedTest: boolean = false
): TwoHandedPenaltyResult {
  if (!hasTwoHandedTrait(item)) {
    return { penalty: 0, applies: false };
  }

  // Penalty applies if using with one less hand than required
  const usingWithLessHand = handsCommitted < handsRequired;

  if (!usingWithLessHand) {
    return { penalty: 0, applies: false };
  }

  // -1 Base die for Fiddle Tests or React-interrupted Tests
  if (isFiddleTest || isReactInterruptedTest) {
    return { penalty: 1, applies: true };
  }

  return { penalty: 0, applies: false };
}

export function getTwoHandedRequirement(): number {
  return 2;
}

// ============================================================================
// [LADEN X] - BURDEN MECHANICS
// ============================================================================

/**
 * [Laden X] — Asset
 * QSR: Compare total 1 + Laden X from everything equipped to the character's Physicality.
 *      Physicality is the higher of STR or SIZ.
 *      Each above Physicality is a burden. For each burden:
 *      - Reduce MOV by 1 and recalculate Agility accordingly.
 *      - Reduce REF by 1 and CCA by 1 unless Attentive Ordered.
 *      - Reduce by 1 any Trait with the Movement keyword.
 */
export function getLadenLevel(item?: Item): number {
  if (!item?.traits) return 0;
  for (const trait of item.traits) {
    if (trait.includes('[Laden')) {
      const match = trait.match(/\[Laden\s*(\d+)?\]/);
      if (match) {
        return match[1] ? parseInt(match[1], 10) : 1;
      }
    }
  }
  return 0;
}

export interface LadenCalculationResult {
  /** Total Laden burden from all equipped items */
  totalLaden: number;
  /** Character's Physicality (higher of STR or SIZ) */
  physicality: number;
  /** Number of burden points (totalLaden - physicality, min 0) */
  burdenPoints: number;
  /** MOV reduction (-1 per burden) */
  movReduction: number;
  /** REF reduction (-1 per burden, unless Attentive Ordered) */
  refReduction: number;
  /** CCA reduction (-1 per burden, unless Attentive Ordered) */
  ccaReduction: number;
  /** Movement trait reduction (-1 per burden) */
  movementTraitReduction: number;
}

export function calculateLadenBurden(
  character: Character,
  isAttentiveOrdered: boolean = false
): LadenCalculationResult {
  const equipment = character.profile?.equipment || character.profile?.items || [];

  // Calculate total Laden from all equipped items
  let totalLaden = 0;
  for (const item of equipment) {
    const ladenLevel = getLadenLevel(item);
    if (ladenLevel > 0) {
      // Each item contributes 1 + Laden X
      totalLaden += 1 + ladenLevel;
    }
  }

  // Physicality is the higher of STR or SIZ
  const str = character.finalAttributes?.str ?? character.attributes?.str ?? 0;
  const siz = character.finalAttributes?.siz ?? character.attributes?.siz ?? 0;
  const physicality = Math.max(str, siz);

  // Burden points are totalLaden above Physicality
  const burdenPoints = Math.max(0, totalLaden - physicality);

  // For each burden:
  // - Reduce MOV by 1
  // - Reduce REF by 1 and CCA by 1 unless Attentive Ordered
  // - Reduce by 1 any Trait with the Movement keyword
  return {
    totalLaden,
    physicality,
    burdenPoints,
    movReduction: burdenPoints,
    refReduction: isAttentiveOrdered ? 0 : burdenPoints,
    ccaReduction: isAttentiveOrdered ? 0 : burdenPoints,
    movementTraitReduction: burdenPoints,
  };
}

export function getLadenMovReduction(character: Character): number {
  return calculateLadenBurden(character).movReduction;
}

export function getLadenRefReduction(character: Character, isAttentiveOrdered: boolean = false): number {
  return calculateLadenBurden(character, isAttentiveOrdered).refReduction;
}

export function getLadenCcaReduction(character: Character, isAttentiveOrdered: boolean = false): number {
  return calculateLadenBurden(character, isAttentiveOrdered).ccaReduction;
}

export function isLadenBurdened(character: Character): boolean {
  return calculateLadenBurden(character).burdenPoints > 0;
}

// ============================================================================
// BASH - ASSET TRAIT (ITEM VERSION)
// ============================================================================

/**
 * Bash — Asset (Item version)
 * QSR: May use this as an Improvised Melee weapon.
 *      Receive +1 cascade for Bonus Actions after passing the Attacker Close Combat Test
 *      if used Charging and is in base-contact with the target.
 */
export function hasBashOnItem(item?: Item): boolean {
  if (!item?.traits) return false;
  return item.traits.some(t => t.toLowerCase().includes('bash'));
}

export interface BashCascadeResult {
  /** +1 cascade for Bonus Actions */
  bonusCascades: number;
  /** Whether Bash bonus applies */
  applies: boolean;
}

export function checkBashCascadeBonusForItem(
  item: Item | undefined,
  passedCloseCombatTest: boolean,
  hasChargeBonus: boolean,
  inBaseContactWithTarget: boolean
): BashCascadeResult {
  if (!hasBashOnItem(item)) {
    return { bonusCascades: 0, applies: false };
  }

  // Requires: passed Close Combat Test, Charge bonus, in base-contact
  if (!passedCloseCombatTest || !hasChargeBonus || !inBaseContactWithTarget) {
    return { bonusCascades: 0, applies: false };
  }

  return {
    bonusCascades: 1,
    applies: true,
  };
}

export function canUseAsImprovisedMelee(item?: Item): boolean {
  return hasBashOnItem(item);
}

// ============================================================================
// ACROBATIC X - GENETIC TRAIT (HELPER FUNCTIONS)
// ============================================================================

/**
 * Acrobatic X — Genetic. Skill. Movement.
 * QSR: Receive +X Wild dice Defender Close Combat Tests.
 */
export function hasAcrobatic(character: Character): boolean {
  return getAcrobaticLevel(character) > 0;
}

export function getAcrobaticWildDiceBonus(character: Character): number {
  /**
   * Acrobatic X provides +X Wild dice for Defender Close Combat Tests
   */
  return getAcrobaticLevel(character);
}

export interface AcrobaticBonusResult {
  /** +X Wild dice bonus */
  wildDiceBonus: number;
  /** Whether Acrobatic applies */
  applies: boolean;
}

export function checkAcrobaticBonus(
  character: Character,
  isDefender: boolean,
  isCloseCombat: boolean
): AcrobaticBonusResult {
  const acrobaticLevel = getAcrobaticLevel(character);

  if (acrobaticLevel <= 0 || !isDefender || !isCloseCombat) {
    return { wildDiceBonus: 0, applies: false };
  }

  return {
    wildDiceBonus: acrobaticLevel,
    applies: true,
  };
}

// ============================================================================
// EFFECTIVE MOVEMENT (TACTICAL HEURISTICS)
// ============================================================================

/**
 * Get effective movement allowance for a character
 * 
 * QSR References:
 * - Movement Allowance: Base MOV + 2 MU
 * - Sprint X: X × 4" (attentive, free, straight line) or X × 2" (normal)
 * - Leap X: AGI bonus at start/end of movement
 * - Flight X: MOV + X + (X × 6) while flying
 * 
 * @param character - The character to calculate movement for
 * @param options - Movement context options
 * @returns Effective movement allowance in MU
 */
export interface EffectiveMovementOptions {
  /** Is moving in a straight line (for Sprint bonus) */
  isMovingStraight?: boolean;
  /** Is at start or end of movement (for Leap bonus) */
  isAtStartOrEnd?: boolean;
  /** Is flying (for Flight bonus) */
  isFlying?: boolean;
  /** Is attentive (for Sprint full bonus) */
  isAttentive?: boolean;
  /** Is a free move (for Sprint full bonus) */
  isFree?: boolean;
}

export function getEffectiveMovement(
  character: Character,
  options: EffectiveMovementOptions = {}
): number {
  const {
    isMovingStraight = false,
    isAtStartOrEnd = false,
    isFlying = false,
    isAttentive = false,
    isFree = false,
  } = options;

  const baseMov = character.finalAttributes.mov ?? character.attributes.mov ?? 2;
  let effectiveMov = baseMov + 2; // QSR: Base Move allowance is MOV + 2

  // Sprint X bonus (only when moving straight)
  if (isMovingStraight) {
    const sprintBonus = getSprintMovementBonus(character, true, isAttentive, isFree);
    effectiveMov += sprintBonus;
  }

  // Leap X bonus (only at start or end of movement)
  if (isAtStartOrEnd) {
    const leapResult = checkLeapUsage(character, true);
    effectiveMov += leapResult.agilityBonus;
  }

  // Flight X bonus (when flying)
  if (isFlying) {
    const flightLevel = getCharacterTraitLevel(character, 'Flight');
    if (flightLevel > 0) {
      // Flight X: MOV + X + (X × 6) while flying
      const flightBonus = flightLevel + (flightLevel * 6);
      effectiveMov = Math.max(effectiveMov, baseMov + flightBonus);
    }
  }

  return effectiveMov;
}

/**
 * Get threat range for a character (distance they can threaten)
 * This is their effective movement allowance
 * 
 * @param character - The character to calculate threat range for
 * @returns Threat range in MU
 */
export function getThreatRange(character: Character): number {
  return getEffectiveMovement(character, {
    isMovingStraight: true,
    isAtStartOrEnd: true,
    isAttentive: true,
    isFree: true,
  });
}
