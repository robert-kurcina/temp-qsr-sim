
import { Character } from './Character';
import { TestDice, DiceType, TestResult } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';
import { calculateHindrancePenalty } from './subroutines/hindrances';
import { resolveRangedHitTest } from './subroutines/ranged-hit-test'; // Correct hit test for ranged
import { resolveDamage, DamageResolution } from './subroutines/damage-test';
import { SpatialAttackContext, SpatialRules } from './battlefield/spatial-rules';
import { applyStatusTraitOnHit, parseStatusTrait, getCharacterTraitLevel } from './status-system';

// --- Main Attack Result Interface ---

export interface AttackResult {
    hit: boolean;
    damageResolution?: DamageResolution;
    hitTestResult: TestResult;
}

// --- Internal Modifier Calculation for Ranged Combat --- //

function _calculateModifiers(attacker: Character, defender: Character, context: TestContext)
    : { attackerBonus: TestDice, attackerPenalty: TestDice, defenderBonus: TestDice, defenderPenalty: TestDice } {
    
    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = {};

    // 1. Hindrance Penalties (applies to most tests)
    const attackerHindrance = calculateHindrancePenalty({ woundTokens: attacker.state.wounds, fearTokens: attacker.state.fearTokens, delayTokens: attacker.state.delayTokens });
    if (attackerHindrance > 0) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + attackerHindrance;

    // Note: Defender hindrance doesn't apply to the REF roll for being hit.

    // 2. Ranged-Specific Contextual Modifiers
    if (context.isLeaning) attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + 1;
    if (context.isTargetLeaning) attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + 1;
    if (context.isPointBlank) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasSuddenness || context.isSudden) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasDirectCover) defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
    if (context.hasInterveningCover) defenderBonus[DiceType.Modifier] = (defenderBonus[DiceType.Modifier] || 0) + 1;
    if (context.isDefending) defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
    if (context.isConcentrating && (context.concentrateTarget ?? 'hit') !== 'damage') {
        attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + 1;
    }
    if (context.isFocusing) {
        attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + 1;
    }
    if (context.blindersThrownPenalty) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + context.blindersThrownPenalty;
    }
    if (context.reactPenaltyBase) {
        attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + context.reactPenaltyBase;
    }

    if (context.obscuringModels && context.obscuringModels > 0) {
        const thresholds = [1, 2, 5, 10];
        let obscuredPenalty = 0;
        for (const threshold of thresholds) {
            if (context.obscuringModels >= threshold) obscuredPenalty += 1;
        }
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + obscuredPenalty;
    }
    
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
    orm: number = 0,
    context: TestContext = {},
    spatial?: SpatialAttackContext
): AttackResult {

    const spatialContext = spatial ? SpatialRules.buildRangedContextFromSpatial(spatial) : {};
    // Merge ORM into context, explicit context wins over spatial defaults.
    const fullContext: TestContext = { ...spatialContext, ...context, orm };
    if (getCharacterTraitLevel(attacker, 'Blinders') > 0) {
        const classification = (weapon.classification || weapon.class || '').toLowerCase();
        if (classification.includes('bow')) {
            if (!fullContext.forceHit) {
                fullContext.forceMiss = true;
            }
        } else if (classification.includes('thrown')) {
            fullContext.blindersThrownPenalty = 1;
        }
    }

    if (spatial) {
        const cover = SpatialRules.getCoverResult(spatial.battlefield, spatial.attacker, spatial.target);
        if (!cover.hasLOS && !fullContext.forceHit) {
            fullContext.forceMiss = true;
        }
    }

    // 1. Calculate situational modifiers for the ranged attack.
    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, fullContext);

    // 2. Perform the Ranged Hit Test (RCA vs REF).
    let hitTestResult: TestResult;
    if (fullContext.forceHit) {
        hitTestResult = { pass: true, score: 99, participant1Score: 99, participant2Score: 0, p1Rolls: [], p2Rolls: [], finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
    } else if (fullContext.forceMiss) {
        hitTestResult = { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
    } else {
        hitTestResult = resolveRangedHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty);
    }

    if (!hitTestResult.pass) {
        return { hit: false, hitTestResult };
    }

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

    // 3. If the hit is successful, perform the standard Damage Resolution.
    // The damage phase is the same for both close and ranged combat.
    const damageResolution = resolveDamage(attacker, defender, weapon, hitTestResult, fullContext);

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

export function resolveRangedCombatHitTest(
    attacker: Character,
    defender: Character,
    weapon: Item,
    orm: number = 0,
    context: TestContext = {},
    spatial?: SpatialAttackContext
) {
    const spatialContext = spatial ? SpatialRules.buildRangedContextFromSpatial(spatial) : {};
    const fullContext: TestContext = { ...spatialContext, ...context, orm };
    if (spatial) {
        const cover = SpatialRules.getCoverResult(spatial.battlefield, spatial.attacker, spatial.target);
        if (!cover.hasLOS && !fullContext.forceHit) {
            fullContext.forceMiss = true;
        }
    }

    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, fullContext);

    let hitTestResult: TestResult;
    if (fullContext.forceHit) {
        hitTestResult = { pass: true, score: 99, participant1Score: 99, participant2Score: 0, p1Rolls: [], p2Rolls: [], finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
    } else if (fullContext.forceMiss) {
        hitTestResult = { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
    } else {
        hitTestResult = resolveRangedHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty);
    }

    return { hitTestResult, context: fullContext };
}
