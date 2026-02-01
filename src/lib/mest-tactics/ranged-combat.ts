
import { Character } from './Character';
import { DicePool, DiceType, TestResult } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';
import { calculateHindrancePenalty } from './subroutines/hindrances';
import { resolveRangedHitTest } from './subroutines/ranged-hit-test'; // Correct hit test for ranged
import { resolveDamage, DamageResolution } from './subroutines/damage-test';

// --- Main Attack Result Interface --- //

export interface AttackResult {
    hit: boolean;
    damageResolution?: DamageResolution;
    hitTestResult: TestResult;
}

// --- Internal Modifier Calculation for Ranged Combat --- //

function _calculateModifiers(attacker: Character, defender: Character, context: TestContext)
    : { attackerBonus: DicePool, attackerPenalty: DicePool, defenderBonus: DicePool, defenderPenalty: DicePool } {
    
    const attackerBonus: DicePool = {};
    const attackerPenalty: DicePool = {};
    const defenderBonus: DicePool = {};
    const defenderPenalty: DicePool = {};

    // 1. Hindrance Penalties (applies to most tests)
    const attackerHindrance = calculateHindrancePenalty({ woundTokens: attacker.state.wounds, fearTokens: attacker.state.fearTokens, delayTokens: attacker.state.delayTokens });
    if (attackerHindrance > 0) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + attackerHindrance;

    // Note: Defender hindrance doesn't apply to the REF roll for being hit.

    // 2. Ranged-Specific Contextual Modifiers
    if (context.isPointBlank) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasDirectCover) defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
    if (context.hasInterveningCover) defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + 1;
    
    // Distance Penalty (ORM)
    if (context.orm && context.orm > 0) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + context.orm;
    }

    return { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty };
}

// --- Main Ranged Combat Function --- //

/**
 * Orchestrates a complete direct ranged combat attack, from the initial hit roll to the final damage resolution.
 */
export function makeRangedCombatAttack(
    attacker: Character,
    defender: Character,
    weapon: Item,
    context: TestContext = {}
): AttackResult {

    // 1. Calculate situational modifiers for the ranged attack.
    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, context);

    // 2. Perform the Ranged Hit Test (RCA vs REF).
    const hitTestResult = resolveRangedHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty);

    if (!hitTestResult.pass) {
        return { hit: false, hitTestResult };
    }

    // 3. If the hit is successful, perform the standard Damage Resolution.
    // The damage phase is the same for both close and ranged combat.
    const damageResolution = resolveDamage(attacker, defender, weapon, hitTestResult, context);

    // 4. Update the defender's state with the results.
    defender.state.wounds = damageResolution.defenderState.wounds;
    defender.state.delayTokens = damageResolution.defenderState.delayTokens;
    defender.state.isKOd = damageResolution.defenderState.isKOd;
    defender.state.isEliminated = damageResolution.defenderState.isEliminated;

    return {
        hit: true,
        damageResolution,
        hitTestResult,
    };
}
