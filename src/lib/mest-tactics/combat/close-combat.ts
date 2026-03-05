/**
 * Close Combat Rules Implementation
 *
 * **Rules References:**
 * - [[rules-combat|Rules: Combat]] - Close Combat overview
 * - [[rule-close-combat|Rules: Close Combat (QSR)]] - Detailed QSR rules
 * - [[rules-situational-modifiers|Rules: Situational Modifiers]] - Combat modifiers
 * - [[rules-bonus-actions|Rules: Bonus Actions]] - Post-hit maneuvers
 * - [[rules-traits-list|Rules: Traits List]] - Combat traits (Charge, Cleave, Parry, etc.)
 */

import { Character } from '../core/Character';
import { TestDice, DiceType, TestResult } from '../subroutines/dice-roller';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { calculateHindrancePenalty } from '../subroutines/hindrances';
import { resolveHitTest } from '../subroutines/hit-test';
import { resolveDamage, DamageResolution } from '../subroutines/damage-test';
import { applyStatusTraitOnHit, parseStatusTrait, getCharacterTraitLevel } from '../status/status-system';
import { parseTrait } from '../traits/trait-parser';
import {
  hasPerimeter,
  hasReachAdvantage,
  getParryBonus,
  getFightPenaltyReduction,
  checkCleaveTrigger,
  hasCharge,
  getKnifeFighterBonus,
  hasStub,
  hasAwkward,
  getAwkwardExtraApCost,
  checkAwkwardChargeDelay,
  hasHafted,
  getHaftedPenalty,
  hasBash,
  checkBashCascadeBonus,
  getMultipleWeaponsBonus,
  getMultipleAttackPenalty,
  getWeaponIndexForCharacter,
} from '../traits/combat-traits';
import { Position } from '../battlefield/Position';

// Export combat maneuver interfaces and functions
export interface CombatManeuverResult {
  maneuverType: 'push-back' | 'reversal' | 'pull-back';
  success: boolean;
  cascadesUsed: number;
  newPosition?: Position;
  attackerNewPosition?: Position;
  defenderNewPosition?: Position;
}

// --- Main Attack Result Interface --- //

export interface AttackResult {
    hit: boolean;
    damageResolution?: DamageResolution;
    hitTestResult: TestResult;
}

// --- Internal Modifier Calculation --- //

function _calculateModifiers(attacker: Character, defender: Character, weapon: Item, context: TestContext)
    : { attackerBonus: TestDice, attackerPenalty: TestDice, defenderBonus: TestDice, defenderPenalty: TestDice } {

    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = {};
    const weaponIndex = getWeaponIndexForCharacter(attacker, weapon);

    // 1. Hindrance Penalties
    const attackerHindrance = calculateHindrancePenalty({
        woundTokens: attacker.state.wounds,
        fearTokens: attacker.state.fearTokens,
        delayTokens: attacker.state.delayTokens,
        statusTokens: attacker.state.statusTokens,
    });
    if (attackerHindrance > 0) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + attackerHindrance;

    const defenderHindrance = calculateHindrancePenalty({
        woundTokens: defender.state.wounds,
        fearTokens: defender.state.fearTokens,
        delayTokens: defender.state.delayTokens,
        statusTokens: defender.state.statusTokens,
    });
    if (defenderHindrance > 0) defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + defenderHindrance;

    // 2. Multiple Weapons Bonus (+1m per additional weapon of same classification)
    const multipleWeaponsBonus = getMultipleWeaponsBonus(attacker, weaponIndex, true);
    if (multipleWeaponsBonus > 0) {
        attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + multipleWeaponsBonus;
    }

    // 3. Multiple Attack Penalty (-1m for consecutive same weapon use)
    const multipleAttackResult = getMultipleAttackPenalty(attacker, weaponIndex);
    if (multipleAttackResult.penalty > 0) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + multipleAttackResult.penalty;
    }

    // 4. Contextual Modifiers
    if (context.isDefending) defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
    
    // Charge bonus (hit test bonus, damage bonus handled in resolveDamage)
    if (context.isCharge) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;

    // Overreach Penalty (QSR Line 470: -1 REF and -1 Attacker Close Combat Tests)
    if (context.isOverreach) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
        // Set Overreach status for -1 REF penalty this Initiative
        attacker.state.isOverreach = true;
    }
    
    if (context.outnumberAdvantage) attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + context.outnumberAdvantage;
    if (context.hasHighGround) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasSuddenness || context.isSudden) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;

    // Parry trait bonus for defender (+Xm Defender Close Combat Tests)
    const parryBonus = getParryBonus(defender);
    if (parryBonus > 0) defenderBonus[DiceType.Modifier] = (defenderBonus[DiceType.Modifier] || 0) + parryBonus;

    // Fight trait - reduces penalty dice (not adds bonus dice)
    const attackerFightReduction = getFightPenaltyReduction(attacker);
    if (attackerFightReduction > 0 && (attackerPenalty[DiceType.Modifier] || 0) > 0) {
        attackerPenalty[DiceType.Modifier] = Math.max(
            0,
            (attackerPenalty[DiceType.Modifier] || 0) - attackerFightReduction
        );
    }

    // Knife-fighter X: +Xb +X Impact when Attentive, in base-contact, using [Stub] weapon
    const isAttentive = attacker.state.isAttentive;
    const isInBaseContact = (context as any).isNowInBaseContact ?? false;
    const isUsingStubWeapon = weapon.traits?.some(t => t.includes('[Stub]')) ?? false;
    const knifeFighterBonus = getKnifeFighterBonus(attacker, isAttentive, isInBaseContact, isUsingStubWeapon);
    if (knifeFighterBonus.bonusBaseDice > 0) {
        attackerBonus[DiceType.Base] = (attackerBonus[DiceType.Base] || 0) + knifeFighterBonus.bonusBaseDice;
    }

    // Hafted: -1m Defender Close Combat Hit Tests
    const haftedPenalty = getHaftedPenalty(defender);
    if (haftedPenalty < 0) defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + Math.abs(haftedPenalty);

    // Lumbering: upgrades penalties to Base dice
    const defenderHasLumbering = getCharacterTraitLevel(defender, 'Lumbering') > 0;
    if (context.isCornered) {
        const key = defenderHasLumbering ? DiceType.Base : DiceType.Modifier;
        defenderPenalty[key] = (defenderPenalty[key] || 0) + 1;
    }
    if (context.isFlanked) {
        const key = defenderHasLumbering ? DiceType.Base : DiceType.Modifier;
        defenderPenalty[key] = (defenderPenalty[key] || 0) + 1;
    }
    if (context.isConcentrating && (context.concentrateTarget ?? 'hit') !== 'damage') {
        attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + 1;
    }
    if (context.isFocusing) {
        attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + 1;
    }
    if (context.reactPenaltyBase) {
        attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + context.reactPenaltyBase;
    }
    if (context.handPenaltyBase) {
        attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + context.handPenaltyBase;
    }

    // QSR: Confined - -1m if Confined by Terrain (vertically, horizontally, or behind)
    if (context.isConfined) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
    }

    return { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty };
}

// --- Main Combat Function --- //

/**
 * Orchestrates a complete close combat attack, from the initial hit roll to the final damage resolution.
 * This function uses imported subroutines to handle the detailed mechanics.
 */
export function makeCloseCombatAttack(
    attacker: Character,
    defender: Character,
    weapon: Item,
    context: TestContext = {},
    p1Rolls: number[] | null = null,
    p2Rolls: number[] | null = null,
    p3Rolls: number[] | null = null,
    p4Rolls: number[] | null = null,
): AttackResult {

    // 1. Calculate situational modifiers for both participants.
    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, weapon, context);

    // 2. Perform the Hit Test.
    const hitTestResult = resolveHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty, p1Rolls, p2Rolls);

    // A hit only succeeds if the attacker's score is strictly greater than the defender's.
    const isHit = (hitTestResult.score > 0) || context.forceHit;

    if (!isHit) {
        return { hit: false, hitTestResult };
    }

    // Apply weapon traits on hit (Stun, etc.)
    if (weapon.traits?.length) {
        const cascades = hitTestResult.cascades ?? 0;
        for (const trait of weapon.traits) {
            const parsed = parseStatusTrait(trait);
            if (!parsed) continue;
            applyStatusTraitOnHit(defender, parsed.traitName, {
                cascades,
                rating: parsed.rating,
                impact: weapon.impact ?? 0,
            });
        }
    }

    // 3. If the hit is successful (or forced), perform the Damage Resolution.
    // Pass charge context for Charge trait damage bonus
    const damageContext: TestContext = {
        ...context,
        isCharge: context.isCharge || hasCharge(attacker),
    };
    
    // Calculate Cleave extra wounds BEFORE damage resolution
    // Cleave X adds (X-1) extra wounds for level >= 2
    let cleaveExtraWounds = 0;
    if (weapon.traits?.length) {
        for (const trait of weapon.traits) {
            const parsed = parseTrait(trait);
            if (parsed.name.toLowerCase() === 'cleave' && (parsed.level ?? 1) >= 2) {
                cleaveExtraWounds = (parsed.level ?? 1) - 1;
                break;
            }
        }
    }
    
    const damageResolution = resolveDamage(attacker, defender, weapon, hitTestResult, damageContext, cleaveExtraWounds);

    // 4. Apply Cleave trait - convert KO to Elimination
    // Cleave triggers if the attack KO'd the target (including Cleave extra wounds)
    if (damageResolution.defenderState.isKOd && !damageResolution.defenderState.isEliminated && cleaveExtraWounds >= 0) {
        // Check if Cleave trait exists on weapon (any level)
        const hasCleave = weapon.traits?.some(t => {
            const parsed = parseTrait(t);
            return parsed.name.toLowerCase() === 'cleave';
        });
        
        if (hasCleave) {
            damageResolution.defenderState.isEliminated = true;
            damageResolution.defenderState.isKOd = false;
            defender.state.isEliminated = true;
            defender.state.isKOd = false;
        }
    } else {
        // Update defender state normally
        defender.state.wounds = damageResolution.defenderState.wounds;
        defender.state.delayTokens = damageResolution.defenderState.delayTokens;
        defender.state.isKOd = damageResolution.defenderState.isKOd;
        defender.state.isEliminated = damageResolution.defenderState.isEliminated;
    }

    // 5. Apply Bash cascade bonus (+1 cascade for Bonus Actions when Charging)
    const bashResult = checkBashCascadeBonus(attacker, context.isCharge ?? false, true, isHit);
    if (bashResult.cascadeBonus > 0) {
        // Store bash bonus for potential bonus action use
        damageResolution.bashCascadeBonus = bashResult.cascadeBonus;
    }

    // 6. Apply Awkward charge delay (defender gets Delay token if charged)
    const awkwardResult = checkAwkwardChargeDelay(defender, attacker, context.isCharge ?? false);
    if (awkwardResult.shouldAcquireDelay) {
        defender.state.delayTokens += awkwardResult.delayTokens;
        damageResolution.defenderState.delayTokens += awkwardResult.delayTokens;
    }

    return {
        hit: true, // It's a hit, either by roll or by force
        damageResolution,
        hitTestResult,
    };
}

export function resolveCloseCombatHitTest(
    attacker: Character,
    defender: Character,
    weapon: Item,
    context: TestContext = {},
    p1Rolls: number[] | null = null,
    p2Rolls: number[] | null = null,
) {
    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, weapon, context);
    return resolveHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty, p1Rolls, p2Rolls);
}

// ============================================================================
// COMBAT MANEUVERS
// ============================================================================

/**
 * Combat Maneuvers (QSR)
 * Spend cascades from successful Hit Test to perform special maneuvers
 * before rolling Damage Test.
 * 
 * Maneuvers:
 * - Push-back (1 cascade): Target 1" away (+1" per 2 additional cascades)
 * - Reversal (2 cascades): Switch positions with attacker
 * - Pull-back (1 cascade): Attacker 1" away after resolution
 */

export interface ManeuverOptions {
  /** Number of cascades available to spend */
  cascades: number;
  /** Attacker's current position */
  attackerPosition: Position;
  /** Defender's current position */
  defenderPosition: Position;
  /** Direction to push (normalized vector) */
  pushDirection?: { x: number; y: number };
}

/**
 * Push-back Maneuver
 * QSR: Spend 1 cascade to push target 1" away (+1" per 2 additional cascades)
 */
export function performPushBack(
  options: ManeuverOptions
): CombatManeuverResult {
  const { cascades, defenderPosition, pushDirection } = options;
  
  if (cascades < 1) {
    return {
      maneuverType: 'push-back',
      success: false,
      cascadesUsed: 0,
    };
  }
  
  // Calculate push distance: 1" + 1" per 2 additional cascades
  const additionalCascades = cascades - 1;
  const bonusDistance = Math.floor(additionalCascades / 2);
  const pushDistance = 1 + bonusDistance;
  
  // Default push direction (away from attacker)
  const direction = pushDirection ?? { x: 1, y: 0 };
  
  // Normalize direction
  const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  const normalizedDir = length > 0 
    ? { x: direction.x / length, y: direction.y / length }
    : { x: 1, y: 0 };
  
  // Calculate new position
  const newDefenderPosition: Position = {
    x: defenderPosition.x + normalizedDir.x * pushDistance,
    y: defenderPosition.y + normalizedDir.y * pushDistance,
  };
  
  return {
    maneuverType: 'push-back',
    success: true,
    cascadesUsed: cascades,
    defenderNewPosition: newDefenderPosition,
  };
}

/**
 * Reversal Maneuver
 * QSR: Spend 2 cascades to switch positions with attacker
 */
export function performReversal(
  options: ManeuverOptions
): CombatManeuverResult {
  const { cascades, attackerPosition, defenderPosition } = options;
  
  if (cascades < 2) {
    return {
      maneuverType: 'reversal',
      success: false,
      cascadesUsed: 0,
    };
  }
  
  // Switch positions
  return {
    maneuverType: 'reversal',
    success: true,
    cascadesUsed: 2,
    attackerNewPosition: defenderPosition,
    defenderNewPosition: attackerPosition,
  };
}

/**
 * Pull-back Maneuver
 * QSR: Spend 1 cascade to move attacker 1" away after resolution
 */
export function performPullBack(
  options: ManeuverOptions
): CombatManeuverResult {
  const { cascades, attackerPosition, pushDirection } = options;
  
  if (cascades < 1) {
    return {
      maneuverType: 'pull-back',
      success: false,
      cascadesUsed: 0,
    };
  }
  
  // Default pull direction (away from defender)
  const direction = pushDirection ?? { x: -1, y: 0 };
  
  // Normalize direction
  const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  const normalizedDir = length > 0 
    ? { x: direction.x / length, y: direction.y / length }
    : { x: -1, y: 0 };
  
  // Calculate new position (1" away)
  const newAttackerPosition: Position = {
    x: attackerPosition.x + normalizedDir.x * 1,
    y: attackerPosition.y + normalizedDir.y * 1,
  };
  
  return {
    maneuverType: 'pull-back',
    success: true,
    cascadesUsed: 1,
    attackerNewPosition: newAttackerPosition,
  };
}

/**
 * Apply combat maneuver to character positions
 */
export function applyCombatManeuver(
  maneuverResult: CombatManeuverResult,
  setAttackerPosition: (position: Position) => void,
  setDefenderPosition: (position: Position) => void
): boolean {
  if (!maneuverResult.success) {
    return false;
  }
  
  if (maneuverResult.attackerNewPosition) {
    setAttackerPosition(maneuverResult.attackerNewPosition);
  }
  
  if (maneuverResult.defenderNewPosition) {
    setDefenderPosition(maneuverResult.defenderNewPosition);
  }
  
  return true;
}
