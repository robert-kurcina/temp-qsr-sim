
import { Character } from './Character';
import { DicePool, DiceType, TestResult, resolveTest, TestParticipant } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';
import { calculateHindrancePenalty } from './subroutines/hindrances';
import { parseAccuracy } from './subroutines/accuracy-parser';

export interface IndirectRangedAttackResult {
    pass: boolean;
    testResult: TestResult;
}

function _calculateModifiers(
    attacker: Character,
    weapon: Item,
    orm: number,
    context: TestContext
): { 
    attackerBonus: DicePool, 
    attackerPenalty: DicePool 
} {
    const attackerBonus: DicePool = {};
    const attackerPenalty: DicePool = {};

    // 1. Hindrance Penalty
    const attackerHindrance = calculateHindrancePenalty({
        woundTokens: attacker.state.wounds,
        fearTokens: attacker.state.fearTokens,
        delayTokens: attacker.state.delayTokens
    });
    if (attackerHindrance > 0) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + attackerHindrance;

    // 2. ORM Penalty
    if (orm > 0) {
        attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + orm;
    }

    // 3. Weapon Accuracy
    const { bonusDice, penaltyDice } = parseAccuracy(weapon.accuracy);
    Object.assign(attackerBonus, bonusDice);
    Object.assign(attackerPenalty, penaltyDice);

    // 4. Contextual Modifiers
    if (context.isPointBlank) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasDirectCover) attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + 1;
    if (context.hasInterveningCover) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;

    return { attackerBonus, attackerPenalty };
}

/**
 * Orchestrates an indirect ranged attack against a location.
 */
export function makeIndirectRangedAttack(
    attacker: Character,
    weapon: Item,
    orm: number, // ORM is a direct input for indirect attacks
    context: TestContext = {}
): IndirectRangedAttackResult {

    const { attackerBonus, attackerPenalty } = _calculateModifiers(attacker, weapon, orm, context);

    const attackerParticipant: TestParticipant = {
        attributeValue: attacker.finalAttributes.rca,
        bonusDice: attackerBonus,
        penaltyDice: attackerPenalty,
    };

    // Unopposed test: The "defender" has no attributes or dice.
    const targetLocation: TestParticipant = {
        attributeValue: 0,
        bonusDice: {},
        penaltyDice: {},
    };

    const testResult = resolveTest(attackerParticipant, targetLocation);

    return {
        pass: testResult.score > 0, // A hit requires a score strictly greater than 0
        testResult,
    };
}
