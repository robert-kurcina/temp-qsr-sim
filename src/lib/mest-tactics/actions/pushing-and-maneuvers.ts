import { Character } from '../core/Character';
import { ActivationDeps, spendAp } from './activation';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainElement, TERRAIN_HEIGHTS } from '../battlefield/terrain/TerrainElement';
import { resolveFallingTest } from './agility';
import { CombatManeuverResult, CombatManeuverType } from './combat-actions';
import { getLeapAgilityBonus } from '../traits/combat-traits';
import { calculateAgility } from './agility';

/**
 * Pushing Result
 */
export interface PushingResult {
  success: boolean;
  apGained: number;
  delayTokenAdded: boolean;
  reason?: string;
}

/**
 * Pushing Action
 *
 * Once per Initiative, at the option of the player; Active characters having no Delay tokens
 * may use "Pushing" to push themselves to their limit and acquire 1 AP.
 * They will also immediately acquire a Delay token.
 *
 * QSR Rules p.789-791
 * NOTE: Pushing does NOT cost Initiative Points - it's a character-level action
 */
export function performPushing(
  deps: ActivationDeps,
  character: Character
): PushingResult {
  // Check if character already has Delay tokens
  if (character.state.delayTokens > 0) {
    return {
      success: false,
      apGained: 0,
      delayTokenAdded: false,
      reason: 'Character has Delay tokens',
    };
  }

  // Check if character already pushed this Initiative
  if (character.state.hasPushedThisInitiative) {
    return {
      success: false,
      apGained: 0,
      delayTokenAdded: false,
      reason: 'Character already pushed this Initiative',
    };
  }

  // Gain 1 AP
  const currentAp = deps.getApRemaining(character.id);
  deps.setApRemaining(character.id, currentAp + 1);

  // Add Delay token
  character.state.delayTokens += 1;
  character.refreshStatusFlags();

  // Mark as having pushed this Initiative
  character.state.hasPushedThisInitiative = true;

  // NOTE: No IP logging - Pushing does not cost IP

  return {
    success: true,
    apGained: 1,
    delayTokenAdded: true,
  };
}

/**
 * Combat Maneuver Types
 */
export enum CombatManeuverType {
  PushBack = 'push_back',
  PullBack = 'pull_back',
  Reversal = 'reversal',
}

/**
 * Combat Maneuver Result
 */
export interface CombatManeuverResult {
  success: boolean;
  maneuverType: CombatManeuverType;
  cascadesSpent: number;
  targetRepositioned?: { x: number; y: number };
  activeRepositioned?: { x: number; y: number };
  delayTokenApplied?: boolean;
  delayReason?: string;
  targetEliminated?: boolean;
  eliminationReason?: string;
  reason?: string;
}

/**
 * Combat Maneuvers
 *
 * Spend cascades from a successful Hit Test to perform tactical maneuvers.
 * QSR Rules p.1092-1094
 */
export function performCombatManeuver(
  maneuverType: CombatManeuverType,
  cascadesAvailable: number,
  activeCharacter: Character,
  targetCharacter: Character,
  activePosition: { x: number; y: number },
  targetPosition: { x: number; y: number },
  activeBaseDiameter: number,
  targetBaseDiameter: number,
  battlefield?: Battlefield
): CombatManeuverResult {
  // Check minimum cascade requirements
  const minCascades = maneuverType === CombatManeuverType.PushBack ? 1 : 2;

  if (cascadesAvailable < minCascades) {
    return {
      success: false,
      maneuverType,
      cascadesSpent: 0,
      reason: `Insufficient cascades (need ${minCascades}, have ${cascadesAvailable})`,
    };
  }

  switch (maneuverType) {
    case CombatManeuverType.PushBack:
      return performPushBack(
        cascadesAvailable,
        activeCharacter,
        targetCharacter,
        activePosition,
        targetPosition,
        activeBaseDiameter,
        targetBaseDiameter,
        battlefield
      );

    case CombatManeuverType.PullBack:
      return performPullBack(
        cascadesAvailable,
        activeCharacter,
        targetCharacter,
        activePosition,
        targetPosition,
        activeBaseDiameter,
        targetBaseDiameter
      );
    
    case CombatManeuverType.Reversal:
      return performReversal(
        cascadesAvailable,
        activeCharacter,
        targetCharacter,
        activePosition,
        targetPosition,
        activeBaseDiameter,
        targetBaseDiameter
      );
    
    default:
      return {
        success: false,
        maneuverType,
        cascadesSpent: 0,
        reason: 'Unknown maneuver type',
      };
  }
}

/**
 * Push-back Maneuver
 *
 * QSR: Reposition target away up to the Active model's base-diameter.
 * Allow +1 MU per 3 more cascades spent.
 * Afterwards, allow the Active model to reposition up to base-contact with the target.
 * If the target is pushed into wall, obstacle, degraded terrain, or resists being
 * pushed across a ledge or off the battlefield; it receives a Delay token.
 * Disallow into another character.
 * Push-back off battlefield = target effectively Eliminated.
 *
 * Cost: 1 cascade base, +3 cascades per additional MU
 * Diamond-Arrow (◆➆): Requires base-contact or +1 cascade
 * Arrow (➆): Physicality difference affects cascade cost
 */
function performPushBack(
  cascadesAvailable: number,
  activeCharacter: Character,
  targetCharacter: Character,
  activePosition: { x: number; y: number },
  targetPosition: { x: number; y: number },
  activeBaseDiameter: number,
  targetBaseDiameter: number,
  battlefield?: Battlefield
): CombatManeuverResult {
  // Calculate direction vector from active to target
  const dx = targetPosition.x - activePosition.x;
  const dy = targetPosition.y - activePosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Normalize direction
  const dirX = distance > 0 ? dx / distance : 1;
  const dirY = distance > 0 ? dy / distance : 0;

  // Base push distance = active model's base diameter (in MU)
  const basePushDistance = activeBaseDiameter;

  // Additional distance: +1 MU per 3 extra cascades
  const extraCascades = cascadesAvailable - 1;
  const additionalDistance = Math.floor(extraCascades / 3);
  const totalPushDistance = basePushDistance + additionalDistance;

  // Calculate new target position
  const newTargetX = targetPosition.x + (dirX * totalPushDistance);
  const newTargetY = targetPosition.y + (dirY * totalPushDistance);
  const newTargetPosition = { x: newTargetX, y: newTargetY };

  // Calculate cascades spent
  const cascadesSpent = 1 + (additionalDistance > 0 ? Math.ceil(additionalDistance / 3) * 3 : 0);

  // QSR: Check for Delay token - pushed into wall/obstacle/degraded terrain/ledge per QSR
  let delayTokenApplied = false;
  let delayReason = '';
  let targetEliminated = false;
  let eliminationReason = '';
  
  if (battlefield) {
    // Check if pushed off battlefield (Elimination)
    if (isOffBattlefield(newTargetPosition, battlefield)) {
      targetEliminated = true;
      eliminationReason = 'Pushed off battlefield';
    } else {
      // Check terrain at new position
      const terrainAtNewPos = battlefield.getTerrainAt(newTargetPosition);
      const oldTerrain = battlefield.getTerrainAt(targetPosition);
      
      // QSR: Degraded terrain check (Clear > Rough > Difficult > Impassable)
      // Delay if pushed into worse terrain
      const terrainDegraded = isTerrainDegraded(oldTerrain, terrainAtNewPos);
      if (terrainDegraded) {
        delayTokenApplied = true;
        delayReason = `Pushed into degraded terrain (${oldTerrain.type} → ${terrainAtNewPos.type})`;
      }
      
      // Delay if pushed into wall/obstacle (Blocking/Impassable)
      // Walls are impassable UNLESS character can climb them (based on SIZ, Agility, Leap X)
      if (terrainAtNewPos.movement === 'Impassable' || terrainAtNewPos.los === 'Blocking') {
        // Check if character can climb this terrain (dynamic based on SIZ, Agility, Leap X)
        const canClimb = isClimbableBy(terrainAtNewPos, targetCharacter);

        if (!canClimb) {
          delayTokenApplied = true;
          delayReason = delayReason || `Pushed into ${terrainAtNewPos.type} (impassable, ${getTerrainHeight(terrainAtNewPos).toFixed(1)} MU)`;
        }
      }
      
      // Delay if pushed off ledge (terrain height >= 1.0 MU per OVR-003)
      // Check if there's a height difference between old and new position
      const oldHeight = getTerrainHeight(oldTerrain);
      const newHeight = getTerrainHeight(terrainAtNewPos);
      
      if (oldHeight >= 1.0 && newHeight < oldHeight) {
        // Pushed off ledge - apply Delay token and potentially Falling Test
        delayTokenApplied = true;
        delayReason = delayReason || `Pushed off ledge (${oldHeight.toFixed(1)} MU fall)`;
        
        // Optional: Could trigger Falling Test here if fall > Agility
        // For now, just apply Delay token as per QSR
      }
    }
  }

  // QSR: Push-back off battlefield = Elimination
  if (targetEliminated) {
    return {
      success: true,
      maneuverType: CombatManeuverType.PushBack,
      cascadesSpent,
      targetRepositioned: newTargetPosition,
      targetEliminated: true,
      eliminationReason,
      delayTokenApplied: false, // No delay if eliminated
    };
  }

  return {
    success: true,
    maneuverType: CombatManeuverType.PushBack,
    cascadesSpent,
    targetRepositioned: newTargetPosition,
    delayTokenApplied,
    delayReason: delayTokenApplied ? delayReason : undefined,
  };
}

/**
 * Check if position is off the battlefield
 */
function isOffBattlefield(position: { x: number; y: number }, battlefield: Battlefield): boolean {
  return position.x < 0 || position.x > battlefield.width || 
         position.y < 0 || position.y > battlefield.height;
}

/**
 * Check if terrain is degraded (Clear > Rough > Difficult > Impassable)
 * QSR: Pushing into worse terrain causes Delay token
 */
function isTerrainDegraded(oldTerrain: any, newTerrain: any): boolean {
  const terrainOrder = {
    'Clear': 0,
    'Rough': 1,
    'Difficult': 2,
    'Impassable': 3,
    'Obstacle': 3,
  };
  
  const oldRank = terrainOrder[oldTerrain.type as keyof typeof terrainOrder] ?? 0;
  const newRank = terrainOrder[newTerrain.type as keyof typeof terrainOrder] ?? 0;
  
  // Degraded if new terrain is worse (higher rank)
  return newRank > oldRank;
}

/**
 * Get terrain height from TerrainElement per OVR-003
 */
function getTerrainHeight(terrain: any): number {
  if (!terrain || !terrain.name) return 0;
  const heightData = TERRAIN_HEIGHTS[terrain.name.toLowerCase()];
  return heightData?.height ?? 0;
}

/**
 * Calculate maximum climbable height for a character
 * QSR: Climb height based on SIZ (reach), Agility, and Leap X trait
 * 
 * Formula: (SIZ × 0.5) + Agility + Leap Bonus
 * - SIZ × 0.5: Base reach height (taller models can reach higher)
 * - Agility: MOV × 0.5 (agile models can scramble up)
 * - Leap Bonus: Leap X trait adds directly to climbing ability
 */
function getMaxClimbableHeight(character: Character): number {
  const siz = character.finalAttributes?.siz ?? character.attributes?.siz ?? 3;
  const baseReach = siz * 0.5; // SIZ-based reach
  const agility = calculateAgility(character); // MOV-based agility
  const leapBonus = getLeapAgilityBonus(character); // Leap X trait bonus
  
  // Total climbable height = reach + agility + leap
  return baseReach + agility + leapBonus;
}

/**
 * Check if terrain is climbable by a character
 * QSR: Walls are climbable if character can reach the top
 */
function isClimbableBy(terrain: any, character: Character): boolean {
  const terrainHeight = getTerrainHeight(terrain);
  const maxClimbable = getMaxClimbableHeight(character);
  
  // Terrain is climbable if character's max climb height >= terrain height
  return maxClimbable >= terrainHeight;
}

/**
 * Pull-back Maneuver
 * 
 * If in Close Combat; reposition the Active model away from the target 
 * the larger model's base-diameter. 
 * Afterwards, allow the Active model to reposition up to base-contact with the target.
 * 
 * Cost: 2 cascades
 */
function performPullBack(
  cascadesAvailable: number,
  activeCharacter: Character,
  targetCharacter: Character,
  activePosition: { x: number; y: number },
  targetPosition: { x: number; y: number },
  activeBaseDiameter: number,
  targetBaseDiameter: number
): CombatManeuverResult {
  // Calculate direction vector from target to active
  const dx = activePosition.x - targetPosition.x;
  const dy = activePosition.y - targetPosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Normalize direction
  const dirX = distance > 0 ? dx / distance : 1;
  const dirY = distance > 0 ? dy / distance : 0;
  
  // Pull back distance = larger model's base diameter
  const pullBackDistance = Math.max(activeBaseDiameter, targetBaseDiameter);
  
  // Calculate new active position (pulled back)
  const tempActiveX = activePosition.x + (dirX * pullBackDistance);
  const tempActiveY = activePosition.y + (dirY * pullBackDistance);
  
  // Now move back to base-contact (simplified: just move back along same line)
  // Base-contact distance = average of base radii
  const baseContactDistance = (activeBaseDiameter + targetBaseDiameter) / 2;
  
  const finalActiveX = tempActiveX - (dirX * baseContactDistance);
  const finalActiveY = tempActiveY - (dirY * baseContactDistance);
  
  return {
    success: true,
    maneuverType: CombatManeuverType.PullBack,
    cascadesSpent: 2,
    activeRepositioned: { x: finalActiveX, y: finalActiveY },
  };
}

/**
 * Reversal Maneuver
 * 
 * If in Close Combat, switch positions with target. Keep current separation.
 * 
 * Cost: 2 cascades
 */
function performReversal(
  cascadesAvailable: number,
  activeCharacter: Character,
  targetCharacter: Character,
  activePosition: { x: number; y: number },
  targetPosition: { x: number; y: number },
  activeBaseDiameter: number,
  targetBaseDiameter: number
): CombatManeuverResult {
  // Simply swap positions
  // The separation is maintained because we're swapping
  
  return {
    success: true,
    maneuverType: CombatManeuverType.Reversal,
    cascadesSpent: 2,
    targetRepositioned: { ...activePosition },
    activeRepositioned: { ...targetPosition },
  };
}
