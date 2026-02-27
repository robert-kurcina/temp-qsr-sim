import { Character } from '../core/Character';
import { ActivationDeps, spendAp } from './activation';

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
  targetBaseDiameter: number
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
        targetBaseDiameter
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
 * Reposition target away up to the Active model's base-diameter. 
 * Allow +1 MU per 3 more cascades spent. 
 * Afterwards, allow the Active model to reposition up to base-contact with the target. 
 * If the target is pushed into wall, obstacle, degraded terrain, or resists being 
 * pushed across a ledge or off the battlefield; it receives a Delay token. 
 * Disallow into another character.
 * 
 * Cost: 1 cascade base, +3 cascades per additional MU
 */
function performPushBack(
  cascadesAvailable: number,
  activeCharacter: Character,
  targetCharacter: Character,
  activePosition: { x: number; y: number },
  targetPosition: { x: number; y: number },
  activeBaseDiameter: number,
  targetBaseDiameter: number
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
  
  // Calculate cascades spent
  const cascadesSpent = 1 + (additionalDistance > 0 ? Math.ceil(additionalDistance / 3) * 3 : 0);
  
  // Note: Terrain collision and character collision checks would be done by the caller
  // For now, we just calculate the repositioning
  
  return {
    success: true,
    maneuverType: CombatManeuverType.PushBack,
    cascadesSpent,
    targetRepositioned: { x: newTargetX, y: newTargetY },
    delayTokenApplied: false, // Would be set by caller if terrain collision occurs
  };
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
