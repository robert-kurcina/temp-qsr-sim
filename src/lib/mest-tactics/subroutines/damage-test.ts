import { Character } from '../core/Character';
import { resolveTest, TestParticipant, TestDice, DiceType, TestResult } from '../subroutines/dice-roller';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { getCoverageBonus, getStunLevel, calculateStunEffect, hasCharge, hasImpale, getImpalePenalty, hasGrit, applyProtective } from '../traits/combat-traits';

// --- Sub-functions for parsing --- //

const parseDiceString = (diceString: string): TestDice => {
    const dice: TestDice = {};
    const value = parseInt(diceString.slice(1, -1), 10) || 1;
    const type = diceString.endsWith('m') ? DiceType.Modifier : diceString.endsWith('b') ? DiceType.Base : DiceType.Wild;
    dice[type] = value;
    return dice;
};

function parseDamageFormula(formula: string, attacker: Character): { value: number; dice: TestDice } {
    let value = 0;
    const dice: TestDice = {};
    for (const part of formula.split('+')) {
        const upperPart = part.toUpperCase();
        if (upperPart === 'STR') value += attacker.finalAttributes.str;
        else if (upperPart === 'POW') value += attacker.finalAttributes.pow;
        else if (upperPart === 'INT') value += attacker.finalAttributes.int;
        else if (part.endsWith('w') || part.endsWith('b') || part.endsWith('m')) {
            const parsed = parseDiceString('+' + part);
            for (const key in parsed) {
                const type = key as DiceType;
                dice[type] = (dice[type] || 0) + parsed[type]!;
            }
        } else {
            value += parseInt(part, 10) || 0;
        }
    }
    return { value, dice };
}

// --- Result Interfaces --- //

export interface DamageResolution {
    impact: number;
    woundsAdded: number;
    stunWoundsAdded: number;
    delayTokensAdded: number;
    defenderState: {
        wounds: number;
        delayTokens: number;
        isKOd: boolean;
        isEliminated: boolean;
    };
    damageTestResult?: TestResult;
    bashCascadeBonus?: number; // From Bash trait
}

/**
 * Resolves the entire damage phase of an attack, including Stun, the Damage Test, and KO/Elimination checks.
 * This function modifies the character state directly based on the rules.
 */
export function resolveDamage(
    attacker: Character,
    defender: Character,
    weapon: Item,
    hitTestResult: TestResult, // Assumes a successful hit
    context: TestContext = {},
    cleaveExtraWounds: number = 0, // Extra wounds from Cleave 2+ trait
): DamageResolution {

    let woundsFromStun = 0;
    let woundsFromDamage = 0;
    let finalDelayTokens = defender.state.delayTokens;
    let totalImpact = 0;

    // 1. Resolve Stun Damage from weapon traits
    const apAllotment = 2; // Default AP
    
    // Check for Stun X trait on weapon
    const stunLevel = getStunLevel(attacker);
    let stunDelayTokens = 0;
    
    if (stunLevel > 0 && hitTestResult.cascades) {
        // Calculate Stun effect: Add X to successes, subtract Durability
        const stunResult = calculateStunEffect(attacker, defender, hitTestResult.cascades, true);
        stunDelayTokens = stunResult.delayTokensApplied;
    }
    
    const protective = applyProtective(
        defender,
        stunDelayTokens,
        context.isConcentrating ?? false,
        context.isCloseCombat ?? false,
        defender.state.isInCover,
        defender.state.isAttentive
    );
    stunDelayTokens = protective.tokensRemaining;

    // Add delay tokens from context (e.g., from weapon traits applied earlier)
    const newDelayTokens = (context.delayTokensAdded || 0) + stunDelayTokens;
    
    if (newDelayTokens > 0) {
        const totalDelay = defender.state.delayTokens + newDelayTokens;
        if (totalDelay > apAllotment) {
            woundsFromStun = totalDelay - apAllotment;
            finalDelayTokens = apAllotment;
        } else {
            finalDelayTokens = totalDelay;
        }
    }

    // 2. Perform the Opposed Damage Test (if the attack has a damage rating)
    let damageTestResult: TestResult | undefined = undefined;
    const damageFormula = weapon.dmg;

    if (damageFormula && damageFormula !== '-') {
        // Impact is a property of the hit, calculated before the damage roll.
        let baseImpact = weapon.impact || 0;
        
        // Charge trait: +1 Impact when charging
        if (context.isCharge || hasCharge(attacker)) {
            baseImpact += 1;
        }
        
        const assistImpact = context.assistingModels || 0;
        totalImpact = baseImpact + assistImpact;

        const { value: damageValue, dice: damageDice } = parseDamageFormula(damageFormula, attacker);

        const bonusDice = { ...damageDice, ...hitTestResult.carryOverDice };
        if (context.isConcentrating && (context.concentrateTarget ?? 'hit') === 'damage') {
            bonusDice[DiceType.Wild] = (bonusDice[DiceType.Wild] || 0) + 1;
        }
        if (context.isFocusing) {
            bonusDice[DiceType.Wild] = (bonusDice[DiceType.Wild] || 0) + 1;
        }

        const damageTestAttacker: TestParticipant = {
            attributeValue: damageValue,
            bonusDice,
        };

        const damageTestDefender: TestParticipant = {
            attributeValue: defender.finalAttributes.for,
            bonusDice: context.hasHardCover ? { [DiceType.Wild]: 1 } : undefined,
        };
        
        // Impale: Distracted targets are penalized -1 Base die Defender Damage Test plus 1 per 3 Impact remaining
        if (hasImpale(attacker) && defender.state.isDistracted) {
            const impalePenalty = getImpalePenalty(defender, true, totalImpact);
            if (impalePenalty > 0) {
                damageTestDefender.penaltyDice = { 
                    ...damageTestDefender.penaltyDice, 
                    base: (damageTestDefender.penaltyDice?.base ?? 0) + impalePenalty 
                };
            }
        }

        damageTestResult = resolveTest(damageTestAttacker, damageTestDefender);

        // 3. Calculate Wounds from the roll (if it passed)
        if (damageTestResult.pass) {
            const cascades = damageTestResult.cascades || 0;

            // Apply Coverage bonus to AR
            const coverageBonus = getCoverageBonus(defender);
            const baseAR = defender.state.armor.total;
            const effectiveAR = Math.max(0, baseAR + coverageBonus - totalImpact);

            // Calculate base wounds from cascades
            let calculatedWounds = Math.max(0, cascades - effectiveAR);

            woundsFromDamage = calculatedWounds;
        }
    }

    if (context.forceHit) {
        woundsFromDamage = Math.max(woundsFromDamage, 2);
    }

    if (woundsFromDamage > 0 && hasGrit(defender) && !defender.state.gritWoundIgnored) {
        woundsFromDamage = Math.max(0, woundsFromDamage - 1);
        defender.state.gritWoundIgnored = true;
    }

    // Apply Cleave extra wounds (X-1 for Cleave level X >= 2)
    // These are added BEFORE KO check per QSR: "presume target has first received an extra X-1 Wounds"
    if (cleaveExtraWounds > 0) {
        woundsFromDamage += cleaveExtraWounds;
    }

    // 4. Sum all wounds and update defender state
    const totalWoundsToAdd = woundsFromStun + woundsFromDamage;
    const finalWounds = defender.state.wounds + totalWoundsToAdd;
    const siz = defender.finalAttributes.siz || 1;

    const isKOd = finalWounds >= siz;
    const isEliminated = finalWounds >= siz + 3;

    // 5. Return the final resolution
    return {
        impact: totalImpact,
        woundsAdded: woundsFromDamage,
        stunWoundsAdded: woundsFromStun,
        delayTokensAdded: newDelayTokens,
        defenderState: {
            wounds: finalWounds,
            delayTokens: finalDelayTokens,
            isKOd: isKOd,
            isEliminated: isEliminated,
        },
        damageTestResult: damageTestResult,
    };
}
