
import { Character } from './Character';
import { DicePool, DiceType, TestResult, resolveTest, TestParticipant, mergeDicePools } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';
import { calculateHindrancePenalty } from './subroutines/hindrances';
import { parseAccuracy } from './subroutines/accuracy-parser';

export interface DisengageResult {
    pass: boolean;
    score: number;
    testResult: TestResult;
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
    let disengagerBonus: DicePool = {};
    let disengagerPenalty: DicePool = {};
    let defenderBonus: DicePool = {};
    let defenderPenalty: DicePool = {};

    // 1. Hindrance Penalties
    const disengagerHindrance = calculateHindrancePenalty({ 
        woundTokens: disengager.state.wounds, 
        fearTokens: disengager.state.fearTokens, 
        delayTokens: disengager.state.delayTokens 
    });
    if (disengagerHindrance > 0) disengagerPenalty[DiceType.Modifier] = (disengagerPenalty[DiceType.Modifier] || 0) + disengagerHindrance;

    const defenderHindrance = calculateHindrancePenalty({ 
        woundTokens: defender.state.wounds, 
        fearTokens: defender.state.fearTokens, 
        delayTokens: defender.state.delayTokens 
    });
    if (defenderHindrance > 0) defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + defenderHindrance;

    // 2. Defender Weapon Accuracy
    const { bonusDice: accBonus, penaltyDice: accPenalty } = parseAccuracy(defenderWeapon.accuracy);
    defenderBonus = mergeDicePools(defenderBonus, accBonus);
    defenderPenalty = mergeDicePools(defenderPenalty, accPenalty);

    // 3. Contextual Modifiers
    if (context.isDefending) defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
    if (context.isCornered) disengagerPenalty[DiceType.Modifier] = (disengagerPenalty[DiceType.Modifier] || 0) + 1;
    if (context.isFlanked) disengagerPenalty[DiceType.Modifier] = (disengagerPenalty[DiceType.Modifier] || 0) + 1;
    if (context.isOverreach) disengagerPenalty[DiceType.Modifier] = (disengagerPenalty[DiceType.Modifier] || 0) + 1;
    if (context.hasSuddenness) disengagerBonus[DiceType.Modifier] = (disengagerBonus[DiceType.Modifier] || 0) + 1;

    if (context.hasHighGround) {
        disengagerBonus[DiceType.Modifier] = (disengagerBonus[DiceType.Modifier] || 0) + 1;
    }

    if (context.outnumberAdvantage) {
        if (context.outnumberAdvantage > 0) {
            disengagerBonus[DiceType.Wild] = (disengagerBonus[DiceType.Wild] || 0) + context.outnumberAdvantage;
        } else {
            defenderBonus[DiceType.Wild] = (defenderBonus[DiceType.Wild] || 0) + Math.abs(context.outnumberAdvantage);
        }
    }
    
    if (context.sizeAdvantage) {
        if (context.sizeAdvantage > 0) {
            disengagerBonus[DiceType.Modifier] = (disengagerBonus[DiceType.Modifier] || 0) + context.sizeAdvantage;
        } else {
            defenderBonus[DiceType.Modifier] = (defenderBonus[DiceType.Modifier] || 0) + Math.abs(context.sizeAdvantage);
        }
    }

    return { disengagerBonus, disengagerPenalty, defenderBonus, defenderPenalty };
}

/**
 * Orchestrates a complete disengage action.
 */
export function makeDisengageAction(
    disengager: Character,
    defender: Character,
    defenderWeapon: Item,
    context: TestContext = {}
): DisengageResult {

    if (context.isAutoPass) {
        const testResult: TestResult = { pass: true, score: 99, participant1Score: 99, participant2Score: 0, p1Rolls: [], p2Rolls: [], p1Misses: 0, p2Misses: 0, finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
        return { pass: true, score: 99, testResult };
    }

    const { disengagerBonus, disengagerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(disengager, defender, defenderWeapon, context);

    const disengagerParticipant: TestParticipant = {
        attributeValue: disengager.finalAttributes.ref,
        bonusDice: disengagerBonus,
        penaltyDice: disengagerPenalty,
    };

    const defenderParticipant: TestParticipant = {
        attributeValue: defender.finalAttributes.cca,
        bonusDice: defenderBonus,
        penaltyDice: defenderPenalty,
    };

    const testResult = resolveTest(disengagerParticipant, defenderParticipant, 0, true);

    return {
        pass: testResult.pass,
        score: testResult.score,
        testResult,
    };
}
