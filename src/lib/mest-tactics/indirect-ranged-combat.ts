
import { Character } from './Character';
import { DicePool, DiceType, TestResult } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';
import { calculateHindrancePenalty } from './subroutines/hindrances';
import { resolveTest, TestParticipant, mergeDicePools } from './dice-roller';
import { parseAccuracy } from './subroutines/accuracy-parser';

function _calculateModifiers(
    attacker: Character, 
    weapon: Item, 
    orm: number, 
    context: TestContext
): { attackerBonus: DicePool, attackerPenalty: DicePool } {
    const attackerBonus: DicePool = {};
    const attackerPenalty: DicePool = {};

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
    context: TestContext = {}
): TestResult {
    const attackerAttribute = weapon.classification === 'Thrown' ? attacker.finalAttributes.cca : attacker.finalAttributes.rca;

    // Per rules.md, ORM > RCA is an automatic miss.
    if (orm > attackerAttribute) {
        return { pass: false, score: -1, participant1Score: 0, participant2Score: 1, p1Rolls: [], p2Rolls: [], p1Misses: 1, p2Misses: 0, finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
    }

    const { attackerBonus, attackerPenalty } = _calculateModifiers(attacker, weapon, orm, context);

    const { bonusDice: accBonus, penaltyDice: accPenalty } = parseAccuracy(weapon.accuracy);

    const attackerParticipant: TestParticipant = {
        attributeValue: attackerAttribute,
        bonusDice: mergeDicePools(attackerBonus, accBonus),
        penaltyDice: mergeDicePools(attackerPenalty, accPenalty),
    };

    const systemParticipant: TestParticipant = {
        attributeValue: 0,
        bonusDice: {},
        penaltyDice: {},
        isSystemPlayer: true
    };

    return resolveTest(attackerParticipant, systemParticipant, 0, true);
}
