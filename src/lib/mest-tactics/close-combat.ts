
import { Character } from './Character';
import { DicePool, DiceType, TestResult } from './dice-roller';
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
    : { attackerBonus: DicePool, attackerPenalty: DicePool, defenderBonus: DicePool, defenderPenalty: DicePool } {
    
    console.log('--- Calculating Modifiers ---');
    console.log('Attacker:', JSON.stringify(attacker, null, 2));
    console.log('Defender:', JSON.stringify(defender, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));

    const attackerBonus: DicePool = {};
    const attackerPenalty: DicePool = {};
    const defenderBonus: DicePool = {};
    const defenderPenalty: DicePool = {};

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

    console.log('Calculated Bonuses/Penalties:', { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty });

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
    context: TestContext = {}
): AttackResult {

    console.log('--- Making Close Combat Attack ---');
    console.log('Attacker:', JSON.stringify(attacker, null, 2));
    console.log('Defender:', JSON.stringify(defender, null, 2));
    console.log('Weapon:', JSON.stringify(weapon, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));

    // 1. Calculate situational modifiers for both participants.
    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, context);

    // 2. Perform the Hit Test.
    const hitTestResult = resolveHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty);
    console.log('Hit Test Result:', JSON.stringify(hitTestResult, null, 2));

    // A hit only succeeds if the attacker's score is strictly greater than the defender's.
    const isHit = (hitTestResult.score > 0) || context.forceHit;
    console.log('Is Hit:', isHit);

    if (!isHit) {
        console.log('Attack missed.');
        return { hit: false, hitTestResult };
    }

    // 3. If the hit is successful (or forced), perform the Damage Resolution.
    console.log('Resolving damage...');
    const damageResolution = resolveDamage(attacker, defender, weapon, hitTestResult, context);
    console.log('Damage Resolution:', JSON.stringify(damageResolution, null, 2));

    // 4. Update the defender's state with the results of the damage resolution.
    defender.state.wounds = damageResolution.defenderState.wounds;
    defender.state.delayTokens = damageResolution.defenderState.delayTokens;
    defender.state.isKOd = damageResolution.defenderState.isKOd;
    defender.state.isEliminated = damageResolution.defenderState.isEliminated;

    console.log('Defender state updated:', JSON.stringify(defender.state, null, 2));

    return {
        hit: true, // It's a hit, either by roll or by force
        damageResolution,
        hitTestResult,
    };
}
