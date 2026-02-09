
import { Character } from './Character';
import { TestDice, DiceType, ResolveTestResult } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';
import { calculateHindrancePenalty } from './subroutines/hindrances';
import { resolveTest, TestParticipant, mergeTestDice } from './dice-roller';
import { parseAccuracy } from './subroutines/accuracy-parser';
import { metricsService } from './MetricsService';

function _calculateModifiers(
    attacker: Character, 
    weapon: Item, 
    orm: number, 
    context: TestContext
): { attackerBonus: TestDice, attackerPenalty: TestDice } {
    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};

    const hindrance = calculateHindrancePenalty(attacker.state);
    if (hindrance > 0) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + hindrance;
    }

    if (context.isPointBlank) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasDirectCover) attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + 1;
    if (context.hasInterveningCover) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
    
    if (orm > 0) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + orm;
    }

    return { attackerBonus, attackerPenalty };
}

export function makeIndirectRangedAttack(
    attacker: Character,
    weapon: Item,
    orm: number, // Optimal Range Multiple
    context: TestContext = {},
    p1Rolls: number[] | null = null
): ResolveTestResult {
    console.log('attacker in makeIndirectRangedAttack', attacker);
    const attackerAttribute = weapon.classification === 'Thrown' ? attacker.finalAttributes.cca : attacker.finalAttributes.rca;

    if (orm > attackerAttribute) {
        return { pass: false, score: -1, p1FinalScore: 0, p2FinalScore: 1, cascades: 0, p1Result: { score: 0, carryOverDice: {} }, p2Result: { score: 1, carryOverDice: {} } };
    }

    const { attackerBonus, attackerPenalty } = _calculateModifiers(attacker, weapon, orm, context);

    const { bonusDice: accBonus, penaltyDice: accPenalty } = parseAccuracy(weapon.accuracy);

    const attackerParticipant: TestParticipant = {
        attributeValue: attackerAttribute,
        bonusDice: mergeTestDice(attackerBonus, accBonus),
        penaltyDice: mergeTestDice(attackerPenalty, accPenalty),
    };

    const systemParticipant: TestParticipant = {
        attributeValue: 0,
        bonusDice: {},
        penaltyDice: {},
        isSystemPlayer: true
    };
    
    const result = resolveTest(attackerParticipant, systemParticipant, p1Rolls);
    metricsService.logEvent('diceTestResolved', { finalPools: { p1FinalBonus: attackerParticipant.bonusDice, p1FinalPenalty: attackerParticipant.penaltyDice, p2FinalBonus: systemParticipant.bonusDice, p2FinalPenalty: systemParticipant.penaltyDice }, result: result });

    return result;
}
