
import { Character } from '../core/Character';
import { TestDice, DiceType, ResolveTestResult, resolveTest, TestParticipant, mergeTestDice } from '../subroutines/dice-roller';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { calculateHindrancePenalty } from '../subroutines/hindrances';
import { parseAccuracy } from '../subroutines/accuracy-parser';
import { getCharacterTraitLevel } from '../status/status-system';

export interface DisengageResult {
    pass: boolean;
    score: number;
    testResult: ResolveTestResult;
}

function _calculateModifiers(
    disengager: Character, 
    defender: Character, 
    defenderWeapon: Item, 
    context: TestContext
): {
    disengagerBonus: TestDice, 
    disengagerPenalty: TestDice, 
    defenderBonus: TestDice, 
    defenderPenalty: TestDice,
    disengagerAttributeModifier: number,
    defenderAttributeModifier: number
} {
    let disengagerBonus: TestDice = {};
    let disengagerPenalty: TestDice = {};
    let defenderBonus: TestDice = {};
    let defenderPenalty: TestDice = {};
    let disengagerAttributeModifier = 0;
    let defenderAttributeModifier = 0;

    // 1. Disengager Hindrance
    const hindrance = calculateHindrancePenalty(disengager.state);
    if (hindrance > 0) {
        disengagerPenalty[DiceType.Modifier] = (disengagerPenalty[DiceType.Modifier] || 0) + hindrance;
    }

    // 2. Defender Weapon Accuracy
    const { bonusDice: accBonus, penaltyDice: accPenalty } = parseAccuracy(defenderWeapon.accuracy);
    defenderBonus = mergeTestDice(defenderBonus, accBonus);
    defenderPenalty = mergeTestDice(defenderPenalty, accPenalty);

    // 3. Contextual Modifiers
    const disengagerHasLumbering = getCharacterTraitLevel(disengager, 'Lumbering') > 0;
    if (context.isCornered) {
        const key = disengagerHasLumbering ? DiceType.Base : DiceType.Modifier;
        disengagerPenalty[key] = (disengagerPenalty[key] || 0) + 1;
    }
    if (context.isFlanked) {
        const key = disengagerHasLumbering ? DiceType.Base : DiceType.Modifier;
        disengagerPenalty[key] = (disengagerPenalty[key] || 0) + 1;
    }
    if (context.hasHighGround) disengagerBonus[DiceType.Modifier] = (disengagerBonus[DiceType.Modifier] || 0) + 1;
    if (context.outnumberAdvantage && context.outnumberAdvantage > 0) {
        disengagerBonus[DiceType.Wild] = (disengagerBonus[DiceType.Wild] || 0) + context.outnumberAdvantage;
    }
    if (context.outnumberAdvantage && context.outnumberAdvantage < 0) {
        defenderBonus[DiceType.Wild] = (defenderBonus[DiceType.Wild] || 0) + Math.abs(context.outnumberAdvantage);
    }
    if (context.hasSuddenness) disengagerBonus[DiceType.Wild] = (disengagerBonus[DiceType.Wild] || 0) + 1;
    if (context.isConcentrating && (context.concentrateTarget ?? 'hit') !== 'damage') {
        disengagerBonus[DiceType.Wild] = (disengagerBonus[DiceType.Wild] || 0) + 1;
    }
    if (context.isFocusing) {
        disengagerBonus[DiceType.Wild] = (disengagerBonus[DiceType.Wild] || 0) + 1;
    }
    if (context.reactPenaltyBase) {
        disengagerPenalty[DiceType.Base] = (disengagerPenalty[DiceType.Base] || 0) + context.reactPenaltyBase;
    }

    // Disengager Size Advantage (when sizeAdvantage > 0, disengager is larger)
    // This gives the defender a penalty (not the disengager a bonus)
    if (context.sizeAdvantage && context.sizeAdvantage > 0) {
        defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + 1;
        disengagerAttributeModifier += 1;
    }

    // Defender Size Advantage (when sizeAdvantage < 0, defender is larger)
    if (context.sizeAdvantage && context.sizeAdvantage < 0) {
        disengagerPenalty[DiceType.Modifier] = (disengagerPenalty[DiceType.Modifier] || 0) + 1;
        defenderAttributeModifier += 1;
    }

    // Overreach penalty: give defender a modifier bonus die
    if (context.isOverreach) {
        defenderBonus[DiceType.Modifier] = (defenderBonus[DiceType.Modifier] || 0) + 1;
        disengagerAttributeModifier -= 1;
    }

    return { disengagerBonus, disengagerPenalty, defenderBonus, defenderPenalty, disengagerAttributeModifier, defenderAttributeModifier };
}

/**
 * Orchestrates a complete disengage action.
 */
export function makeDisengageAction(
    disengager: Character,
    defender: Character,
    defenderWeapon: Item,
    context: TestContext = {},
    p1Rolls: number[] | null = null,
    p2Rolls: number[] | null = null
): DisengageResult {

    if (context.isAutoPass) {
        const testResult: ResolveTestResult = { 
            pass: true,
            score: 99, 
            cascades: 99,
            p1FinalScore: 99, 
            p2FinalScore: 0, 
            p1Result: { score: 99, carryOverDice: {}},
            p2Result: { score: 0, carryOverDice: {}},
        };
        return { pass: true, score: 99, testResult };
    }

    const { disengagerBonus, disengagerPenalty, defenderBonus, defenderPenalty, disengagerAttributeModifier, defenderAttributeModifier } = _calculateModifiers(disengager, defender, defenderWeapon, context);

    const disengagerBaseAttribute = disengager.finalAttributes.ref || 0;
    const defenderBaseAttribute = defender.finalAttributes.cca || 0;
    const disengagerAttributeValue = disengagerBaseAttribute + disengagerAttributeModifier;
    const defenderAttributeValue = defenderBaseAttribute + defenderAttributeModifier;

    const disengagerParticipant: TestParticipant = {
        character: disengager,
        attributeValue: disengagerAttributeValue,
        bonusDice: disengagerBonus,
        penaltyDice: disengagerPenalty,
    };

    const defenderParticipant: TestParticipant = {
        character: defender,
        attributeValue: defenderAttributeValue,
        bonusDice: defenderBonus,
        penaltyDice: defenderPenalty,
    };

    const testResult = resolveTest(disengagerParticipant, defenderParticipant, p1Rolls, p2Rolls);

    return {
        pass: testResult.pass,
        score: testResult.score,
        testResult,
    };
}
