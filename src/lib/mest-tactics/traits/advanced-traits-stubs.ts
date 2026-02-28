/**
 * Advanced Traits Implementation Stubs - Partial Traits
 * 
 * These traits are documented in trait_descriptions.json but the advanced rules
 * documents don't provide complete implementation details. Each stub includes
 * TODO comments noting what context is needed.
 * 
 * Categories (20 traits):
 * - [Arc X], [Backblast X], [Carriage X], [Configure X]
 * - [Discard variants], [Discord X], [Drone X], [Entropy variants]
 * - [Exit], [Fettered], [Flex], [Fodder], [Fragile X]
 * - [Grenade X], [Hard-point X], [Hurried X], [Immobile], [Impaired]
 * - [Inept variants], [Jam X]
 */

import { Character } from '../core/Character';
import { Item } from '../core/Item';
import { getCharacterTraitLevel } from '../status/status-system';

// ============================================================================
// [ARC X] - ATTACK EFFECT
// ============================================================================

/**
 * [Arc X] — Attack Effect. Intrinsic.
 * QSR: See [Scatter]. May not use Indirect Range Attack against targets closer than X × 8 MU.
 *      Subject to Indirect Attacks rules. Direct Attacks penalized -X Wild dice Range Hit Test.
 *      If miss, resolve as Indirect Attack using [Scatter] from location behind target.
 * 
 * TODO: Need full Indirect Attack rules context
 * TODO: Need [Scatter] trait implementation details
 * TODO: Need clarification on LOF/Cohesion calculation for scatter location
 */
export function getArcLevel(character: Character): number {
  // TODO: Implement arc level retrieval from character traits
  return getCharacterTraitLevel(character, 'Arc');
}

export function canUseDirectAttackWithArc(character: Character, distanceMu: number): boolean {
  // TODO: Implement minimum range check (X × 8 MU)
  const arcLevel = getArcLevel(character);
  const minRange = arcLevel * 8;
  return distanceMu >= minRange;
}

export function getArcHitTestPenalty(character: Character): number {
  // TODO: Implement -X Wild dice penalty for Direct Attacks
  const arcLevel = getArcLevel(character);
  return -arcLevel;
}

// ============================================================================
// [BACKBLAST X] - ATTACK EFFECT
// ============================================================================

/**
 * [Backblast X] — Attack Effect.
 * QSR: Models within 1 MU of LOF from target through Attacker up to 2 × X MU behind
 *      Attacker each receive Burned token, and another if within X MU.
 * 
 * TODO: Need Burned token assignment rules clarification
 * TODO: Need LOF calculation details for backblast area
 * TODO: Need clarification on "behind Attacker" direction determination
 */
export function getBackblastLevel(character: Character): number {
  // TODO: Implement backblast level retrieval
  return getCharacterTraitLevel(character, 'Backblast');
}

export interface BackblastArea {
  /** Distance behind attacker affected (2 × X MU) */
  maxRange: number;
  /** Inner zone distance (X MU) for extra Burned token */
  innerZone: number;
}

export function calculateBackblastArea(character: Character): BackblastArea {
  // TODO: Implement backblast area calculation
  const backblastLevel = getBackblastLevel(character);
  return {
    maxRange: 2 * backblastLevel,
    innerZone: backblastLevel,
  };
}

// ============================================================================
// [CARRIAGE X] - INTRINSIC
// ============================================================================

/**
 * [Carriage X] — Intrinsic. Asset.
 * QSR: Item affixed atop Carriage of SIZ X. Can be moved using Dislodging rules,
 *      or carried as [Laden X + 3]. Group Action uses highest Physicality.
 * 
 * TODO: Need Dislodging rules context
 * TODO: Need Group Action movement rules for carriages
 * TODO: Need clarification on "count every 2 Members if within 2 Physicality"
 */
export function getCarriageSiz(character: Character): number {
  // TODO: Implement carriage SIZ retrieval
  return getCharacterTraitLevel(character, 'Carriage');
}

export function getCarriageLadenEquivalent(character: Character): number {
  // TODO: Calculate equivalent Laden for carrying
  const carriageSiz = getCarriageSiz(character);
  return carriageSiz + 3;
}

// ============================================================================
// [CONFIGURE X] - INTRINSIC
// ============================================================================

/**
 * [Configure X] — Intrinsic.
 * QSR: Must perform X additional Fiddle actions before first use and before any [Emplace].
 * 
 * TODO: Need [Emplace] interaction clarification
 * TODO: Need Fiddle action tracking mechanism
 * TODO: Need clarification on "first use" definition
 */
export function getConfigureLevel(character: Character): number {
  // TODO: Implement configure level retrieval
  return getCharacterTraitLevel(character, 'Configure');
}

export function getConfigureActionsRequired(character: Character): number {
  // TODO: Calculate Fiddle actions required
  const configureLevel = getConfigureLevel(character);
  return configureLevel;
}

// ============================================================================
// [DISCARD VARIANTS] - ASSET
// ============================================================================

/**
 * [Discard > Type] — Asset.
 * QSR: When discarded by placing in base-contact or throwing, acquires traits in List
 *      at that location. If [Discard! > List] then allow just once.
 * 
 * TODO: Need trait transfer mechanism details
 * TODO: Need "throwing to target location" rules
 * TODO: Need clarification on duration of transferred traits
 */
export function getDiscardTypeList(character: Character, itemIndex: number = 0): string[] {
  // TODO: Implement trait list retrieval from Discard > Type
  // TODO: Parse trait list from trait description
  return [];
}

/**
 * [Discard! > Type] — Asset.
 * QSR: Same as [Discard > Type] but only once.
 */
export function hasDiscardOnce(character: Character, itemIndex: number = 0): boolean {
  // TODO: Check for [Discard! > Type] variant
  return false;
}

/**
 * [Discard+ > Type] — Asset.
 * QSR: When discarded, traits in List temporarily assigned to Active character
 *      until start of its next Initiative.
 * 
 * TODO: Need temporary trait assignment mechanism
 * TODO: Need clarification on "until start of next Initiative" timing
 */
export function getDiscardPlusTypeList(character: Character, itemIndex: number = 0): string[] {
  // TODO: Implement trait list retrieval from [Discard+ > Type]
  return [];
}

// ============================================================================
// [DISCORD X] - ASSET
// ============================================================================

/**
 * [Discord X] — Asset. Magic.
 * QSR: Items with Discord may lose magical abilities. Safe total = 1 + higher of INT + POW.
 *      May not acquire more Items with [Discord] until existing discarded.
 * 
 * TODO: Need Magic system rules context
 * TODO: Need "lose magical abilities" mechanism
 * TODO: Need Discord tracking across character's items
 */
export function getDiscordLevel(character: Character): number {
  // TODO: Implement discord level retrieval
  return getCharacterTraitLevel(character, 'Discord');
}

export function getSafeDiscordTotal(character: Character): number {
  // TODO: Calculate safe Discord total based on INT + POW
  const intAttr = character.finalAttributes?.int ?? character.attributes?.int ?? 0;
  const powAttr = character.finalAttributes?.pow ?? character.attributes?.pow ?? 0;
  return 1 + Math.max(intAttr, powAttr);
}

export function canAcquireMoreDiscordItems(character: Character, newDiscordLevel: number): boolean {
  // TODO: Check if character can acquire more Discord items
  // TODO: Track total Discord from all items
  return true; // Placeholder
}

// ============================================================================
// [DRONE X > ACTIONS] - INTRINSIC
// ============================================================================

/**
 * [Drone X > Actions] — Intrinsic. Unchanging.
 * QSR: Paired with Controller spending AP. Enabled/Disabled via Fiddle action.
 *      When Enabled, performs actions in List using Controller's AP.
 *      Receive X additional AP if Controller is Attentive.
 * 
 * TODO: Need Controller/Drone pairing mechanism
 * TODO: Need action list parsing from trait
 * TODO: Need AP transfer rules from Controller to Drone
 */
export function getDroneLevel(character: Character): number {
  // TODO: Implement drone level retrieval
  return getCharacterTraitLevel(character, 'Drone');
}

export function getDroneActionList(character: Character): string[] {
  // TODO: Parse action list from [Drone X > Actions] trait
  return [];
}

export function isDroneEnabled(character: Character): boolean {
  // TODO: Track Drone enabled/disabled status
  return true; // Placeholder
}

// ============================================================================
// [ENTROPY VARIANTS] - ATTACK EFFECT
// ============================================================================

/**
 * [Entropy!!] — Attack Effect. Asset.
 * QSR: Presume OR is 2 MU, ignore Visibility limit. Penalize -1 Damage per OR Multiple.
 * 
 * TODO: Need OR Multiple damage penalty mechanism
 * TODO: Need "ignore Visibility limit" clarification
 */
export function hasEntropyDoubleExclam(character: Character): boolean {
  // TODO: Check for [Entropy!!] variant
  return getCharacterTraitLevel(character, 'Entropy!!') > 0;
}

/**
 * [Entropy!] — Attack Effect. Asset.
 * QSR: Presume OR is 4 MU. Penalize -1 Damage per OR Multiple.
 */
export function hasEntropyExclam(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Entropy!') > 0;
}

/**
 * [Entropy] — Attack Effect. Asset.
 * QSR: Presume OR is 8 MU. Penalize -1 Damage per OR Multiple.
 */
export function hasEntropy(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Entropy') > 0;
}

/**
 * [Entropy+] — Attack Effect. Asset.
 * QSR: Presume OR is 16 MU. Penalize -1 Damage per OR Multiple.
 */
export function hasEntropyPlus(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Entropy+') > 0;
}

export function getEntropyPresumedOr(character: Character): number {
  // TODO: Return presumed OR based on Entropy variant
  // [Entropy!!] = 2 MU, [Entropy!] = 4 MU, [Entropy] = 8 MU, [Entropy+] = 16 MU
  if (hasEntropyDoubleExclam(character)) return 2;
  if (hasEntropyExclam(character)) return 4;
  if (hasEntropyPlus(character)) return 16;
  if (hasEntropy(character)) return 8;
  return 0;
}

export function getEntropyDamagePenalty(character: Character, ormMultiple: number): number {
  // TODO: Calculate -1 Damage per OR Multiple
  return -ormMultiple;
}

// ============================================================================
// [EXIT] - ASSET
// ============================================================================

/**
 * [Exit] — Asset.
 * QSR: After using this item, character removed from play but doesn't count as Eliminated.
 * 
 * TODO: Need "removed from play" mechanism
 * TODO: Need clarification on when character can return
 * TODO: Need tracking for Exit status
 */
export function hasExit(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Exit') > 0;
}

export function applyExitEffect(character: Character): void {
  // TODO: Implement character removal from play
  // TODO: Mark as not Eliminated
}

// ============================================================================
// [FETTERED > TARGET] - INTRINSIC
// ============================================================================

/**
 * [Fettered > Target] — Intrinsic. Unchanging.
 * QSR: Must remain within Cohesion of character from Assembly or cannot activate.
 *      If no such character remains, Eliminated. Requires Fiddle action to re-fetter.
 * 
 * TODO: Need Cohesion enforcement mechanism
 * TODO: Need Assembly tracking for fetter target
 * TODO: Need "released via Fiddle action" rules
 */
export function getFetteredTargetAssembly(character: Character): string {
  // TODO: Parse Assembly from [Fettered > Target] trait
  return '';
}

export function isWithinFetteredCohesion(character: Character): boolean {
  // TODO: Check if character is within Cohesion of fetter target
  return true; // Placeholder
}

// ============================================================================
// [FLEX] - ASSET
// ============================================================================

/**
 * [Flex] — Asset. Suit. (Should be Laden -1).
 * QSR: If Opposing Attacker tied or passes Damage Test with Impact 0 or Stun trait,
 *      character receives at least 1 Delay token as Stun damage.
 * 
 * TODO: Need Suit trait interaction clarification
 * TODO: Need "tied or passes Damage Test" condition check
 * TODO: Need Stun damage application mechanism
 */
export function hasFlex(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Flex') > 0;
}

export function shouldApplyFlexStun(
  attackerPassedTest: boolean,
  weaponImpact: number,
  hasStunTrait: boolean
): boolean {
  // TODO: Implement Flex stun condition check
  const tiedOrPassed = attackerPassedTest;
  const lowImpact = weaponImpact <= 0;
  return tiedOrPassed && (lowImpact || hasStunTrait);
}

// ============================================================================
// [FODDER] - INTRINSIC
// ============================================================================

/**
 * [Fodder] — Intrinsic. Unchanging.
 * QSR: Eliminated if KO'd. Automatically fails Bottle Test.
 *      Hindrance penalties are -1 Base dice instead of -1 Modifier dice.
 * 
 * TODO: Need Bottle Test rules context
 * TODO: Need KO → Eliminated conversion mechanism
 */
export function hasFodder(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Fodder') > 0;
}

export function isEliminatedWhenKOd(character: Character): boolean {
  // TODO: Check if character has Fodder trait
  return hasFodder(character);
}

export function getFodderHindrancePenaltyType(): 'Base' | 'Modifier' {
  // Fodder uses Base dice for hindrance penalties
  return 'Base';
}

// ============================================================================
// [FRAGILE X] - ASSET
// ============================================================================

/**
 * [Fragile X] — Asset.
 * QSR: If used for Damage Test and have lower Test Score with no Base die successes,
 *      Item is Damaged. If already Damaged, Destroyed. Presume Test Score lower by X.
 * 
 * TODO: Need Damage/Destroyed state tracking
 * TODO: Need "randomly determine which Item" mechanism for Hard-point
 * TODO: Need clarification on Damaged armor reducing Armor by 3
 */
export function getFragileLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Fragile');
}

export interface FragileState {
  isDamaged: boolean;
  isDestroyed: boolean;
}

export function checkFragileDamage(
  character: Character,
  hadBaseDieSuccesses: boolean,
  hasLowerTestScore: boolean
): FragileState {
  // TODO: Implement Fragile damage check
  return { isDamaged: false, isDestroyed: false };
}

// ============================================================================
// [GRENADE X] - ASSET
// ============================================================================

/**
 * [Grenade X] — Asset.
 * QSR: Can be used as Thrown weapon. See [Discard+], [Scatter X], [Reload], and Discrete.
 *      Must target battlefield location as Indirect Range Attack.
 * 
 * TODO: Need Indirect Range Attack rules context
 * TODO: Need [Scatter X] interaction clarification
 * TODO: Need grenade targeting mechanism
 */
export function getGrenadeScatterLevel(character: Character): number {
  // TODO: Parse X from [Grenade X] trait
  return getCharacterTraitLevel(character, 'Grenade');
}

export function isGrenadeThrownWeapon(character: Character): boolean {
  // TODO: Check if item has Grenade trait
  return getCharacterTraitLevel(character, 'Grenade') > 0;
}

// ============================================================================
// [HARD-POINT X] - INTRINSIC
// ============================================================================

/**
 * [Hard-point X] — Intrinsic.
 * QSR: Creates X Hard-point Points. Each allows one Mounted Item.
 *      When Item receives Wound, roll Modifier dice equal to 1 + Mounted Items.
 *      If all succeed, randomly determine which Item destroyed.
 * 
 * TODO: Need Mounted Item association mechanism
 * TODO: Need random Item destruction selection
 * TODO: Need Hard-point damage roll mechanism
 */
export function getHardPointLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Hard-point');
}

export function getHardPointCapacity(character: Character): number {
  // TODO: Return Hard-point capacity
  return getHardPointLevel(character);
}

export function checkHardPointDamage(character: Character): void {
  // TODO: Implement Hard-point damage roll
  // TODO: Randomly destroy mounted item if all dice succeed
}

// ============================================================================
// [HURRIED X] - INTRINSIC
// ============================================================================

/**
 * [Hurried X] — Intrinsic.
 * QSR: On first activation, perform Unopposed INT Test at -X Modifier dice.
 *      If fail, delay entry by misses Turns. Begins with +X Delay Tokens.
 *      Never starts in Hidden status.
 * 
 * TODO: Need delayed entry mechanism
 * TODO: Need Turn delay tracking
 * TODO: Need Hidden status prevention
 */
export function getHurriedLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Hurried');
}

export interface HurriedEntryResult {
  delayedTurns: number;
  initialDelayTokens: number;
  canStartHidden: boolean;
}

export function calculateHurriedEntry(character: Character, intTestMisses: number): HurriedEntryResult {
  // TODO: Calculate hurried entry effects
  const hurriedLevel = getHurriedLevel(character);
  return {
    delayedTurns: intTestMisses,
    initialDelayTokens: hurriedLevel,
    canStartHidden: false,
  };
}

// ============================================================================
// [IMMOBILE] - INTRINSIC
// ============================================================================

/**
 * [Immobile] — Intrinsic.
 * QSR: May not perform Movement, use Agility, Bonus Actions, or actively reposition.
 *      Penalized -3 to Defender Combat Hit Test.
 * 
 * TODO: Need movement restriction enforcement
 * TODO: Need -3 Defender Combat Hit Test penalty application
 */
export function hasImmobile(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Immobile') > 0;
}

export function canPerformMovement(character: Character): boolean {
  // TODO: Check if character can perform movement
  return !hasImmobile(character);
}

export function getImmobileDefensePenalty(character: Character): number {
  // TODO: Return -3 penalty for Immobile characters
  return hasImmobile(character) ? -3 : 0;
}

// ============================================================================
// [IMPAIRED] - INTRINSIC
// ============================================================================

/**
 * [Impaired] — Intrinsic.
 * QSR: May not climb ladders, jump across/up. Treats staircases/inclines as Difficult.
 *      May not use weapons. Visibility never more than 6 MU.
 *      Disallowed Bonus and Fiddle actions.
 * 
 * TODO: Need movement restriction details
 * TODO: Need weapon use prohibition
 * TODO: Need Visibility cap enforcement
 */
export function hasImpaired(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Impaired') > 0;
}

export function getMaxVisibilityForImpaired(character: Character): number {
  // TODO: Return 6 MU visibility cap
  return hasImpaired(character) ? 6 : Infinity;
}

export function canUseWeapons(character: Character): boolean {
  // TODO: Check if character can use weapons
  return !hasImpaired(character);
}

// ============================================================================
// [INEPT VARIANTS] - INTRINSIC
// ============================================================================

/**
 * [Inept] — Intrinsic.
 * QSR: Disallowed Pushing, Concentrate, Combined Action, and Rally.
 */
export function hasInept(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Inept') > 0;
}

/**
 * [Inept!] — Intrinsic.
 * QSR: [Inept] + Disallowed Bonus Actions.
 */
export function hasIneptExclam(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Inept!') > 0;
}

/**
 * [Inept!!] — Intrinsic.
 * QSR: [Inept] + Disallowed Passive Player Options and React actions/tests.
 */
export function hasIneptDoubleExclam(character: Character): boolean {
  return getCharacterTraitLevel(character, 'Inept!!') > 0;
}

export function canUsePushing(character: Character): boolean {
  // TODO: Check if character can use Pushing
  return !hasInept(character);
}

export function canUseConcentrate(character: Character): boolean {
  // TODO: Check if character can use Concentrate
  return !hasInept(character);
}

export function canPerformBonusActions(character: Character): boolean {
  // TODO: Check if character can perform Bonus Actions
  return !hasIneptExclam(character) && !hasIneptDoubleExclam(character);
}

// ============================================================================
// [JAM X] - ASSET
// ============================================================================

/**
 * [Jam X] — Asset. Attack Effect.
 * QSR: When resolving Range Combat Hit Test with ROF dice, if no successes on any two
 *      Base dice, note which ROF dice are misses. Re-roll each X times.
 *      For each miss: Remove ROF marker, mark with Jammed! status.
 * 
 * TODO: Need ROF dice re-roll mechanism
 * TODO: Need Jammed! status tracking
 * TODO: Need Fiddle action clearance rules
 */
export function getJamLevel(character: Character): number {
  return getCharacterTraitLevel(character, 'Jam');
}

export interface JamCheckResult {
  jammed: boolean;
  rofMarkersRemoved: number;
}

export function checkJam(
  character: Character,
  baseDiceSuccesses: number,
  rofDiceMisses: number
): JamCheckResult {
  // TODO: Implement Jam check logic
  // TODO: Re-roll ROF dice misses X times
  // TODO: Remove ROF markers and mark Jammed! for each miss
  return { jammed: false, rofMarkersRemoved: 0 };
}
