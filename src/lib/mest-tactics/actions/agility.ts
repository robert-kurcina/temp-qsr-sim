/**
 * Agility Rules - QSR Advanced Movement
 *
 * Agility rating is MOV × ½" (keep fractions up to 0.5")
 * Used for navigating difficult terrain and unusual positions
 */

import { Character } from '../core/Character';
import { Position } from '../battlefield/Position';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainElement } from '../battlefield/terrain/TerrainElement';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { d6, getDieSuccesses, DiceType } from '../subroutines/dice-roller';
import { getAvailableHands, getTotalHands } from './hand-requirements';

export interface AgilityState {
  agilitySpent: number;
  agilityRemaining: number;
  isLeaning: boolean;
  leaningPosition?: Position;
}

export interface AgilityOptions {
  bypass?: boolean;
  climb?: boolean;
  jumpUp?: boolean;
  jumpDown?: boolean;
  jumpAcross?: boolean;
  runningJump?: boolean;
  leaning?: boolean;
  moveDistance?: number;
  terrainHeight?: number;
  gapWidth?: number;
  hasLedge?: boolean;
  twoHandsRequired?: boolean;
}

export interface AgilityResult {
  success: boolean;
  agilitySpent: number;
  delayAdded?: boolean;
  woundAdded?: boolean;
  reason?: string;
  newPosition?: Position;
}

/**
 * Calculate a character's Agility rating
 * QSR: Agility = MOV × ½" (keep fractions up to 0.5")
 */
export function calculateAgility(character: Character): number {
  const mov = character.finalAttributes?.mov ?? character.attributes?.mov ?? 0;
  const agility = mov * 0.5;
  // Keep fractions up to 0.5"
  return Math.ceil(agility * 2) / 2;
}

/**
 * Initialize agility state for a character's activation
 */
export function initializeAgilityState(character: Character): AgilityState {
  const agility = calculateAgility(character);
  return {
    agilitySpent: 0,
    agilityRemaining: agility,
    isLeaning: false,
  };
}

/**
 * QSR Agility: Bypass
 * Bypass Rough or Difficult terrain, or cut corners of an obstacle
 * Requires agility >= half base-diameter or base-height
 */
export function bypassTerrain(
  character: Character,
  battlefield: Battlefield,
  terrain: TerrainElement,
  options: AgilityOptions = {}
): AgilityResult {
  const agility = calculateAgility(character);
  const baseDiameter = getBaseDiameterFromSiz(character.finalAttributes?.siz ?? 3);
  const requiredAgility = baseDiameter / 2;

  if (agility < requiredAgility) {
    return {
      success: false,
      agilitySpent: 0,
      reason: `Insufficient agility (${agility} < ${requiredAgility} MU required)`,
    };
  }

  // Bypass makes terrain Clear for this movement
  return {
    success: true,
    agilitySpent: requiredAgility,
    reason: 'Bypass terrain - treated as Clear',
  };
}

/**
 * QSR Agility: Climb
 * Climb up or down, reach across a gap within base-height
 * Requires [2H] going up, [1H] down per OVR-003
 * Ends action or acquires Delay token
 */
export function climbTerrain(
  character: Character,
  battlefield: Battlefield,
  options: AgilityOptions = {}
): AgilityResult {
  const agility = calculateAgility(character);
  const baseHeight = getBaseDiameterFromSiz(character.finalAttributes?.siz ?? 3) / 2;
  const heightToClimb = options.terrainHeight ?? baseHeight;

  if (heightToClimb > baseHeight) {
    return {
      success: false,
      agilitySpent: 0,
      reason: `Cannot climb height ${heightToClimb} MU (max: ${baseHeight} MU)`,
    };
  }

  // QSR: Check hand requirements - [2H] going up, [1H] down per OVR-003
  const goingUp = (options.terrainHeight ?? 0) > 0;
  const handsRequired = goingUp ? 2 : 1;
  const handsAvailable = getAvailableHands(character);
  const totalHands = getTotalHands(character);

  // Check if character has enough hands
  if (handsAvailable < handsRequired) {
    // Can only use one less hand if it's a [1H] requirement and character has 1 hand free
    const canUseOneLess = (handsRequired === 2 && handsAvailable === 1);
    
    if (!canUseOneLess) {
      return {
        success: false,
        agilitySpent: 0,
        reason: `Insufficient hands for climb: ${handsAvailable}/${totalHands} available, ${handsRequired} required (${goingUp ? '[2H] up' : '[1H] down'})`,
      };
    }
    
    // Apply -1b penalty for using one less hand (set flag for next test)
    character.state.usingOneLessHand = true;
  }

  return {
    success: true,
    agilitySpent: Math.min(agility, heightToClimb),
    delayAdded: true, // Climb ends action or adds Delay
    reason: `Climb ${heightToClimb} MU (${goingUp ? 'up' : 'down'}, ${handsRequired}H required, ${handsAvailable}/${totalHands} available)`,
  };
}

/**
 * QSR Agility: Jump Up
 * Jump up to half of Agility as Clear
 */
export function jumpUp(
  character: Character,
  options: AgilityOptions = {}
): AgilityResult {
  const agility = calculateAgility(character);
  const maxJumpUp = agility / 2;
  const jumpHeight = options.terrainHeight ?? maxJumpUp;

  if (jumpHeight > maxJumpUp) {
    return {
      success: false,
      agilitySpent: 0,
      reason: `Cannot jump up ${jumpHeight} MU (max: ${maxJumpUp} MU)`,
    };
  }

  return {
    success: true,
    agilitySpent: jumpHeight,
    reason: `Jump up ${jumpHeight} MU`,
  };
}

/**
 * QSR Agility: Jump Down
 * Jump down up to Agility
 * Acquire Wound if within last 0.5 MU of Agility or more
 * If > Agility, perform Falling Test (DR = SIZ + (MU beyond Agility ÷ 4))
 */
export function jumpDown(
  character: Character,
  options: AgilityOptions = {}
): AgilityResult {
  const agility = calculateAgility(character);
  const jumpDown = options.terrainHeight ?? agility;

  if (jumpDown > agility) {
    // Falling Test required - see resolveFallingTest below
    const fallingResult = resolveFallingTest(character, jumpDown, agility);
    return {
      success: true,
      agilitySpent: agility,
      woundAdded: fallingResult.woundAdded,
      delayAdded: fallingResult.delayTokens > 0,
      reason: `Fall ${jumpDown} MU: WOUND${fallingResult.delayTokens > 0 ? ` + ${fallingResult.delayTokens} Delay (Falling Test failed by ${fallingResult.delayTokens})` : ''}`,
    };
  }

  // Check for falling damage (within last 0.5 MU of Agility)
  const woundAdded = jumpDown >= agility - 0.5;

  return {
    success: true,
    agilitySpent: jumpDown,
    woundAdded,
    reason: `Jump down ${jumpDown} MU${woundAdded ? ' - WOUND from fall!' : ''}`,
  };
}

/**
 * QSR: Falling Test
 *
 * When falling further than Agility, perform an Unopposed FOR Test.
 * DR = SIZ + (MU beyond Agility ÷ 4), round to nearest whole number.
 * On fail: acquire misses as Delay tokens (Stun damage).
 * Wound added if fall >= Agility - 0.5 MU.
 *
 * @param character - The falling character
 * @param fallDistance - Total distance fallen in MU
 * @param agility - Character's Agility rating
 * @returns Object with delayTokens and woundAdded
 */
export function resolveFallingTest(
  character: Character,
  fallDistance: number,
  agility: number
): { delayTokens: number; woundAdded: boolean } {
  const siz = character.finalAttributes?.siz ?? character.attributes?.siz ?? 3;
  const forAttribute = character.finalAttributes?.for ?? character.attributes?.for ?? 0;

  // DR = SIZ + (MU beyond Agility ÷ 4), round to nearest whole number
  const beyondAgility = Math.max(0, fallDistance - agility);
  const dr = siz + Math.round(beyondAgility / 4);

  // Unopposed FOR Test: Character rolls 2 Base dice + FOR, System rolls 2 Base dice + 2
  // For Unopposed tests, System score = 2 (base) + 2 (fixed) = 4
  const systemScore = 4;

  // Character rolls 2 Base dice + FOR attribute using dice-roller
  const roll1 = d6();
  const roll2 = d6();

  // Count successes: 4-5 = 1 success, 6 = 2 successes (using getDieSuccesses)
  let successes = 0;
  successes += getDieSuccesses(DiceType.Base, roll1).successes;
  successes += getDieSuccesses(DiceType.Base, roll2).successes;

  const characterScore = forAttribute + successes;

  // Calculate misses (how much test failed by)
  const misses = Math.max(0, systemScore - characterScore);

  // Wound if fall >= Agility - 0.5
  const woundAdded = fallDistance >= agility - 0.5;

  return {
    delayTokens: misses,
    woundAdded,
  };
}

/**
 * QSR: Falling Collision
 *
 * When falling into other models:
 * - Falling model may ignore one miss on Falling Test
 * - Target models must perform Falling Test using same DR
 *
 * @param fallingCharacter - The character that is falling
 * @param targetCharacters - Characters at the landing location
 * @param fallDistance - Total distance fallen in MU
 * @param agility - Falling character's Agility rating
 * @returns Array of collision results for each target
 */
export function resolveFallingCollision(
  fallingCharacter: Character,
  targetCharacters: Character[],
  fallDistance: number,
  agility: number
): Array<{
  targetId: string;
  delayTokens: number;
  woundAdded: boolean;
  fallingCharacterIgnoresOneMiss: boolean;
}> {
  const results: Array<{
    targetId: string;
    delayTokens: number;
    woundAdded: boolean;
    fallingCharacterIgnoresOneMiss: boolean;
  }> = [];

  // Falling character may ignore one miss
  const fallingResult = resolveFallingTest(fallingCharacter, fallDistance, agility);
  const adjustedDelay = Math.max(0, fallingResult.delayTokens - 1);

  results.push({
    targetId: fallingCharacter.id,
    delayTokens: adjustedDelay,
    woundAdded: fallingResult.woundAdded,
    fallingCharacterIgnoresOneMiss: true,
  });

  // Each target model must perform Falling Test using same DR
  for (const target of targetCharacters) {
    const targetResult = resolveFallingTest(target, fallDistance, agility);
    results.push({
      targetId: target.id,
      delayTokens: targetResult.delayTokens,
      woundAdded: targetResult.woundAdded,
      fallingCharacterIgnoresOneMiss: false,
    });
  }

  return results;
}

/**
 * QSR Agility: Jump Across
 * Jump down and across up to Agility (if Attentive)
 * For every 1 MU down, allow +0.5 MU across
 * If ledge to grab, add base-diameter but acquire Delay
 * Requires [2H]
 */
export function jumpAcross(
  character: Character,
  battlefield: Battlefield,
  options: AgilityOptions = {}
): AgilityResult {
  const agility = calculateAgility(character);
  const jumpDown = options.terrainHeight ?? 0;
  const jumpAcross = options.gapWidth ?? 0;

  if (!character.state.isAttentive) {
    return {
      success: false,
      agilitySpent: 0,
      reason: 'Must be Attentive to Jump Across',
    };
  }

  // Calculate max jump: agility + (0.5 × jumpDown)
  const maxAcross = agility + (jumpDown * 0.5);

  if (jumpAcross > maxAcross) {
    return {
      success: false,
      agilitySpent: 0,
      reason: `Cannot jump across ${jumpAcross} MU (max: ${maxAcross} MU with ${jumpDown} MU down)`,
    };
  }

  // Check for ledge grab
  const hasLedge = options.hasLedge ?? false;
  const delayAdded = hasLedge;

  // Requires [2H]
  const twoHandsRequired = true;

  return {
    success: true,
    agilitySpent: jumpAcross,
    delayAdded,
    reason: `Jump across ${jumpAcross} MU${hasLedge ? ' (ledge grab - Delay)' : ''}`,
  };
}

/**
 * QSR Agility: Running Jump
 * Bonus agility = 1/4 of straight distance moved this Action
 * For Jump Across or Jump Down (horizontal or downwards)
 * Allow reach upwards at base-height if ledge available before midpoint
 */
export function runningJump(
  character: Character,
  moveDistance: number,
  options: AgilityOptions = {}
): AgilityResult {
  const baseAgility = calculateAgility(character);
  const bonusAgility = moveDistance / 4;
  const totalAgility = baseAgility + bonusAgility;

  const jumpType = options.jumpAcross ? 'across' : 'down';
  const jumpDistance = options.gapWidth ?? options.terrainHeight ?? totalAgility;

  if (jumpDistance > totalAgility) {
    return {
      success: false,
      agilitySpent: 0,
      reason: `Running jump failed: ${jumpDistance} MU > ${totalAgility} MU available`,
    };
  }

  // Check for upward reach with ledge
  const baseHeight = getBaseDiameterFromSiz(character.finalAttributes?.siz ?? 3) / 2;
  const canReachUp = options.hasLedge && jumpDistance <= totalAgility / 2;

  return {
    success: true,
    agilitySpent: jumpDistance,
    reason: `Running jump ${jumpType} ${jumpDistance} MU (+${bonusAgility} bonus)${canReachUp ? ' + upward reach' : ''}`,
  };
}

/**
 * QSR Agility: Leaning
 * Establish LOS from behind Cover using up to Agility (max base-diameter)
 * -1b for Detect and Range Combat Hit Tests for self and others
 * Leaning marker may be targeted
 * Removed after next Action against or by this model
 */
export function leaning(
  character: Character,
  battlefield: Battlefield,
  position: Position
): AgilityResult {
  const agility = calculateAgility(character);
  const baseDiameter = getBaseDiameterFromSiz(character.finalAttributes?.siz ?? 3);
  const maxLean = Math.min(agility, baseDiameter);

  // Check if in base-contact with cover terrain
  const position_ = battlefield.getCharacterPosition(character);
  if (!position_) {
    return {
      success: false,
      agilitySpent: 0,
      reason: 'Character not on battlefield',
    };
  }

  // Check for cover in base-contact (simplified check)
  const nearbyTerrain = battlefield.getTerrainElements().filter(t => {
    const dist = Math.sqrt(
      Math.pow(t.position.x - position_.x, 2) +
      Math.pow(t.position.y - position_.y, 2)
    );
    return dist <= 0.5; // Within base-contact
  });

  const hasCover = nearbyTerrain.some(t => 
    t.terrainType === 'Wall' || 
    t.terrainType === 'Obstacle' ||
    t.name.includes('Cover')
  );

  if (!hasCover) {
    return {
      success: false,
      agilitySpent: 0,
      reason: 'Must be in base-contact with Cover terrain to Lean',
    };
  }

  return {
    success: true,
    agilitySpent: maxLean,
    reason: `Leaning ${maxLean} MU from cover (-1b Detect/Range Hit Tests)`,
  };
}

/**
 * Apply leaning penalty to test dice
 * -1b for Detect and Range Combat Hit Tests
 */
export function applyLeaningPenalty(
  isLeaning: boolean,
  testType: 'detect' | 'range-hit' | 'other'
): number {
  if (!isLeaning) return 0;
  if (testType === 'detect' || testType === 'range-hit') {
    return -1; // -1 Base die
  }
  return 0;
}

/**
 * Check if character can use agility for a given action
 */
export function canUseAgility(character: Character): boolean {
  return character.state.isAttentive && 
         !character.state.isKOd && 
         !character.state.isEliminated &&
         calculateAgility(character) > 0;
}

/**
 * Get available agility actions for a character
 */
export function getAvailableAgilityActions(
  character: Character,
  battlefield: Battlefield,
  options: AgilityOptions = {}
): string[] {
  const actions: string[] = [];
  
  if (!canUseAgility(character)) {
    return actions;
  }

  const agility = calculateAgility(character);
  const baseDiameter = getBaseDiameterFromSiz(character.finalAttributes?.siz ?? 3);
  const baseHeight = baseDiameter / 2;

  if (agility >= baseDiameter / 2) {
    actions.push('Bypass');
  }

  if (options.terrainHeight !== undefined && options.terrainHeight <= baseHeight) {
    actions.push(options.terrainHeight > 0 ? 'Climb Up' : 'Climb Down');
  }

  if (agility / 2 >= 0.5) {
    actions.push('Jump Up');
  }

  if (agility >= 0.5) {
    actions.push('Jump Down');
  }

  if (character.state.isAttentive && agility >= 0.5) {
    actions.push('Jump Across');
  }

  actions.push('Running Jump');
  actions.push('Leaning');

  return actions;
}
