
import { Character } from '../Character';
import { resolveTest, TestParticipant, DicePool, DiceType, TestResult } from '../dice-roller';
import { Item } from '../Item';
import { TestContext } from '../TestContext';

// --- Sub-functions for parsing --- //

const parseDiceString = (diceString: string): DicePool => {
    const dice: DicePool = {};
    const value = parseInt(diceString.slice(1, -1), 10) || 1;
    const type = diceString.endsWith('m') ? DiceType.Modifier : diceString.endsWith('b') ? DiceType.Base : DiceType.Wild;
    dice[type] = value;
    return dice;
};

function parseDamageFormula(formula: string, attacker: Character): { value: number; dice: DicePool } {
    let value = 0;
    const dice: DicePool = {};
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
    context: TestContext = {}
): DamageResolution {

    let woundsFromStun = 0;
    let woundsFromDamage = 0;
    let finalDelayTokens = defender.state.delayTokens;
    let totalImpact = 0;

    // 1. Resolve Stun Damage (e.g., from 'Delay' trait)
    const apAllotment = 2; // Default AP
    const newDelayTokens = context.delayTokensAdded || 0;
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
        const { value: damageValue, dice: damageDice } = parseDamageFormula(damageFormula, attacker);
        
        const damageTestAttacker: TestParticipant = {
            attributeValue: damageValue,
            bonusDice: { ...damageDice, ...hitTestResult.carryOverDice },
        };
        
        const damageTestDefender: TestParticipant = {
            attributeValue: defender.finalAttributes.for,
        };
      
        damageTestResult = resolveTest(damageTestAttacker, damageTestDefender);

        // 3. Calculate Wounds from the roll (if it passed)
        if (damageTestResult.pass) {
            const baseImpact = weapon.impact || 0;
            const assistImpact = context.assistingModels || 0;
            totalImpact = baseImpact + assistImpact;
            const effectiveAR = Math.max(0, defender.state.armor.total - totalImpact);

            const netCascades = Math.max(0, damageTestResult.cascades - effectiveAR);

            if (netCascades > defender.state.wounds) {
                woundsFromDamage = netCascades - defender.state.wounds;
            } else {
                woundsFromDamage = 1;
            }
        }
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
