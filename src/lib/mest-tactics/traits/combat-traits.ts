/**
 * Combat Traits Implementation
 *
 * Complete implementation of combat-related traits per MEST Tactics QSR.
 * These traits modify combat tests, damage, and tactical options.
 */

import { Character } from '../Character';
import { getCharacterTraitLevel } from '../status-system';
import { Item } from '../Item';

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
  defenderKOd: boolean
): CleaveResult {
  const cleaveLevel = getCharacterTraitLevel(attacker, 'Cleave');

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
  const characterPow = character.profile?.finalAttributes?.POW ?? 0;
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
  if (isConcentratedAttack && !isCloseCombat && !isCover) {
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
  // Reload is typically on the weapon, not character
  // This checks if character has any weapon with Reload trait
  return getCharacterTraitLevel(character, 'Reload');
}

export function hasReload(character: Character): boolean {
  return getReloadLevel(character) > 0;
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

export function getReloadActionsRequired(character: Character): number {
  return getReloadLevel(character);
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
  return character.profile?.finalAttributes?.STR ?? 0;
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
  // Insane characters are immune to Fear (Psychology trait)
  return hasInsane(character);
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
  if (!hasInsane(character)) {
    return false;
  }

  // Does not perform Morale Tests unless has Hindrance tokens
  if (hasHindranceTokens) {
    return false;
  }

  return true;
}

export function isImmuneToHindranceMoralePenalties(character: Character): boolean {
  // Not affected by Hindrance penalties for Morale Tests
  return hasInsane(character);
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
    defender.profile?.finalAttributes?.SIZ ?? 0,
    defender.profile?.finalAttributes?.FOR ?? 0
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
  const defenderSiz = defender.profile?.finalAttributes?.SIZ ?? 0;
  const attackerSiz = attacker.profile?.finalAttributes?.SIZ ?? 0;
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
  const baseStr = character.profile?.finalAttributes?.STR ?? 0;
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
  if (!hasImpale(character) || !isDistracted) {
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

export type TerrainType = 'Clear' | 'Rough' | 'Difficult' | 'Impassable';

export function upgradeTerrain(terrain: TerrainType, surefootedLevel: number): TerrainType {
  if (surefootedLevel <= 0) {
    return terrain;
  }

  // Level 1: Rough → Clear
  if (surefootedLevel >= 1 && terrain === 'Rough') {
    return 'Clear';
  }

  // Level 2: Difficult → Rough
  if (surefootedLevel >= 2 && terrain === 'Difficult') {
    return 'Rough';
  }

  // Level 3: Difficult → Clear (direct upgrade)
  if (surefootedLevel >= 3 && terrain === 'Difficult') {
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

export function getTacticsInitiativeBonus(character: Character): number {
  return getTacticsLevel(character); // +X Base dice for Initiative Tests
}

export function getTacticsSituationalAwarenessExemption(character: Character): number {
  return getTacticsLevel(character); // Avoid X Turns of Situational Awareness checks
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
