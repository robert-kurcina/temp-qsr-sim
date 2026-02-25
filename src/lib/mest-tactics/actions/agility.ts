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
 * Requires [2H] going up, [1H] down
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

  // Check hand requirements: [2H] going up, [1H] down
  const goingUp = (options.terrainHeight ?? 0) > 0;
  const handsRequired = goingUp ? 2 : 1;
  
  // Note: Full hand enforcement would check available hands here
  // For now, we just note the requirement

  return {
    success: true,
    agilitySpent: Math.min(agility, heightToClimb),
    delayAdded: true, // Climb ends action or adds Delay
    reason: `Climb ${heightToClimb} MU (${goingUp ? 'up' : 'down'}, ${handsRequired}H required)`,
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
 */
export function jumpDown(
  character: Character,
  options: AgilityOptions = {}
): AgilityResult {
  const agility = calculateAgility(character);
  const jumpDown = options.terrainHeight ?? agility;

  if (jumpDown > agility) {
    return {
      success: false,
      agilitySpent: 0,
      reason: `Cannot jump down ${jumpDown} MU (max: ${agility} MU)`,
    };
  }

  // Check for falling damage
  const woundAdded = jumpDown >= agility - 0.5;

  return {
    success: true,
    agilitySpent: jumpDown,
    woundAdded,
    reason: `Jump down ${jumpDown} MU${woundAdded ? ' - WOUND from fall!' : ''}`,
  };
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
