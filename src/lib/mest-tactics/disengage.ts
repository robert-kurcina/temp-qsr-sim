
import { Character } from './Character';
import { DicePool, DiceType, ResolveTestResult, resolveTest, TestParticipant, mergeDicePools } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';
import { calculateHindrancePenalty } from './subroutines/hindrances';
import { parseAccuracy } from './subroutines/accuracy-parser';

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
    disengagerBonus: DicePool, 
    disengagerPenalty: DicePool, 
    defenderBonus: DicePool, 
    defenderPenalty: DicePool
} {
    let disengagerBonus: DicePool = { [DiceType.Base]: 1 };
    let disengagerPenalty: DicePool = {};
    let defenderBonus: DicePool = {};
    let defenderPenalty: DicePool = {};

    // 1. Disengager Hindrance
    const hindrance = calculateHindrancePenalty(disengager.state);
    if (hindrance > 0) {
        disengagerPenalty[DiceType.Modifier] = (disengagerPenalty[DiceType.Modifier] || 0) + hindrance;
    }

    // 2. Defender Weapon Accuracy
    const { bonusDice: accBonus, penaltyDice: accPenalty } = parseAccuracy(defenderWeapon.accuracy);
    defenderBonus = mergeDicePools(defenderBonus, accBonus);
    defenderPenalty = mergeDicePools(defenderPenalty, accPenalty);

    // 3. Contextual Modifiers
    if (context.isCornered) disengagerPenalty[DiceType.Modifier] = (disengagerPenalty[DiceType.Modifier] || 0) + 1;
    if (context.isFlanked) disengagerPenalty[DiceType.Modifier] = (disengagerPenalty[DiceType.Modifier] || 0) + 1;
    if (context.hasHighGround) disengagerBonus[DiceType.Modifier] = (disengagerBonus[DiceType.Modifier] || 0) + 1;
    if (context.outnumberAdvantage && context.outnumberAdvantage > 0) {
        disengagerBonus[DiceType.Wild] = (disengagerBonus[DiceType.Wild] || 0) + context.outnumberAdvantage;
    }
    if (context.outnumberAdvantage && context.outnumberAdvantage < 0) {
        defenderBonus[DiceType.Wild] = (defenderBonus[DiceType.Wild] || 0) + Math.abs(context.outnumberAdvantage);
    }
    if (context.hasSuddenness) disengagerBonus[DiceType.Wild] = (disengagerBonus[DiceType.Wild] || 0) + 1;

    // Defender Size Advantage
    if (context.sizeAdvantage && context.sizeAdvantage > 0) {
        const bonus = Math.floor(context.sizeAdvantage / 2);
        if (bonus > 0) {
            defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + bonus;
        }
    }

    // Disengager Size Advantage
    if (context.sizeAdvantage && context.sizeAdvantage < 0) {
        const bonus = Math.floor(Math.abs(context.sizeAdvantage) / 2);
        if (bonus > 0) {
            disengagerBonus[DiceType.Base] = (disengagerBonus[DiceType.Base] || 0) + bonus;
        }
    }

    if (context.isOverreach) disengagerPenalty[DiceType.Wild] = (disengagerPenalty[DiceType.Wild] || 0) + 1;

    return { disengagerBonus, disengagerPenalty, defenderBonus, defenderPenalty };
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

    const { disengagerBonus, disengagerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(disengager, defender, defenderWeapon, context);

    const disengagerParticipant: TestParticipant = {
        character: disengager,
        attribute: 'ref',
        bonusDice: disengagerBonus,
        penaltyDice: disengagerPenalty,
    };

    const defenderParticipant: TestParticipant = {
        character: defender,
        attribute: 'cca',
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
