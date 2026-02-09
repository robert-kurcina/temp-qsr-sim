import { Character } from './Character';
import { TestDice, DiceType, TestResult } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';
import { calculateHindrancePenalty } from './subroutines/hindrances';
import { resolveHitTest } from './subroutines/hit-test';
import { resolveDamage, DamageResolution } from './subroutines/damage-test';

// --- Main Attack Result Interface --- //

export interface AttackResult {
    hit: boolean;
    damageResolution?: DamageResolution;
    hitTestResult: TestResult;
}

// --- Internal Modifier Calculation --- //

function _calculateModifiers(attacker: Character, defender: Character, context: TestContext)
    : { attackerBonus: TestDice, attackerPenalty: TestDice, defenderBonus: TestDice, defenderPenalty: TestDice } {

    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = {};

    // 1. Hindrance Penalties
    const attackerHindrance = calculateHindrancePenalty({ woundTokens: attacker.state.wounds, fearTokens: attacker.state.fearTokens, delayTokens: attacker.state.delayTokens });
    if (attackerHindrance > 0) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + attackerHindrance;

    const defenderHindrance = calculateHindrancePenalty({ woundTokens: defender.state.wounds, fearTokens: defender.state.fearTokens, delayTokens: defender.state.delayTokens });
    if (defenderHindrance > 0) defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + defenderHindrance;

    // 2. Contextual Modifiers
    if (context.isDefending) defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
    if (context.isCharge) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.isOverreach) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1; // Overreach Penalty
    if (context.outnumberAdvantage) attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + context.outnumberAdvantage;
    if (context.hasHighGround) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.isCornered) defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + 1;
    if (context.isFlanked) defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + 1;

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
    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, context);

    // 2. Perform the Hit Test.
    const hitTestResult = resolveHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty, p1Rolls, p2Rolls);

    // A hit only succeeds if the attacker's score is strictly greater than the defender's.
    const isHit = (hitTestResult.score > 0) || context.forceHit;

    if (!isHit) {
        return { hit: false, hitTestResult };
    }

    // 3. If the hit is successful (or forced), perform the Damage Resolution.
    const damageResolution = resolveDamage(attacker, defender, weapon, hitTestResult, context, p3Rolls, p4Rolls);

    // 4. Update the defender's state with the results of the damage resolution.
    defender.state.wounds = damageResolution.defenderState.wounds;
    defender.state.delayTokens = damageResolution.defenderState.delayTokens;
    defender.state.isKOd = damageResolution.defenderState.isKOd;
    defender.state.isEliminated = damageResolution.defenderState.isEliminated;

    return {
        hit: true, // It's a hit, either by roll or by force
        damageResolution,
        hitTestResult,
    };
}
