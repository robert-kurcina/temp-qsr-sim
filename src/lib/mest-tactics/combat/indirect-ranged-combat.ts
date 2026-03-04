
import { Character } from '../core/Character';
import { TestDice, DiceType, ResolveTestResult } from '../subroutines/dice-roller';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { calculateHindrancePenalty } from '../subroutines/hindrances';
import { resolveTest, TestParticipant, mergeTestDice } from '../subroutines/dice-roller';
import { parseAccuracy } from '../subroutines/accuracy-parser';
import { metricsService } from '../engine/MetricsService';
import { SpatialAttackContext, SpatialRules } from '../battlefield/spatial/spatial-rules';
import { applyStatusTraitOnHit, parseStatusTrait, getCharacterTraitLevel } from '../status/status-system';
import { getArcheryBonus, getShootPenaltyReduction, getShootMaxORMBonus } from '../traits/combat-traits';
import { calculateObscuredPenalty } from './obscured';

function _calculateModifiers(
    attacker: Character, 
    weapon: Item, 
    orm: number, 
    context: TestContext
): { attackerBonus: TestDice, attackerPenalty: TestDice } {
    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};

    const hindrance = calculateHindrancePenalty({
        woundTokens: attacker.state.wounds,
        fearTokens: attacker.state.fearTokens,
        delayTokens: attacker.state.delayTokens,
        statusTokens: attacker.state.statusTokens,
    });
    if (hindrance > 0) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + hindrance;
    }

    if (context.isLeaning) attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + 1;
    if (context.isTargetLeaning) attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + 1;
    if (context.isPointBlank) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasSuddenness || context.isSudden) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasDirectCover) attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + 1;
    if (context.hasInterveningCover) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
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
    if (context.handPenaltyBase) {
        attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + context.handPenaltyBase;
    }
    if (context.isBlindAttack) {
        attackerPenalty[DiceType.Wild] = (attackerPenalty[DiceType.Wild] || 0) + 1;
    }

    if (context.obscuringModels && context.obscuringModels > 0) {
        const obscuredPenalty = calculateObscuredPenalty(context.obscuringModels);
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + obscuredPenalty;
    }
    
    if (orm > 0) {
        // IC.10 + IC.12 (Distance): indirect hit tests apply ORM as Base-die penalties.
        attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + orm;
    }

    // Archery X: +Xm Bow Hit Tests
    const weaponClass = (weapon.classification || weapon.class || '').toLowerCase();
    const archeryBonus = getArcheryBonus(attacker, weaponClass.includes('bow'));
    if (archeryBonus > 0) {
        attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + archeryBonus;
    }

    // Shoot X: Reduce up to X penalty Modifier dice on Range Hit Tests
    const shootPenaltyReduction = getShootPenaltyReduction(attacker);
    if (shootPenaltyReduction > 0 && (attackerPenalty[DiceType.Modifier] || 0) > 0) {
        attackerPenalty[DiceType.Modifier] = Math.max(
            0,
            (attackerPenalty[DiceType.Modifier] || 0) - shootPenaltyReduction
        );
    }

    return { attackerBonus, attackerPenalty };
}

export function makeIndirectRangedAttack(
    attacker: Character,
    weapon: Item,
    orm: number, // Optimal Range Multiple
    context: TestContext = {},
    p1Rolls: number[] | null = null,
    spatial?: SpatialAttackContext,
    target?: Character,
    options: { applyOnHitTraits?: boolean } = {}
): ResolveTestResult {
    const attackerAttribute = attacker.finalAttributes.rca;

    const shootOrmBonus = getShootMaxORMBonus(attacker);
    const effectiveOrm = Math.max(0, orm - shootOrmBonus);

    if (effectiveOrm > attackerAttribute) {
        return { pass: false, score: -1, p1FinalScore: 0, p2FinalScore: 1, cascades: 0, p1Result: { score: 0, carryOverDice: {} }, p2Result: { score: 1, carryOverDice: {} } };
    }

    const spatialContext = spatial ? SpatialRules.buildRangedContextFromSpatial(spatial) : {};
    const fullContext = { ...spatialContext, ...context, orm };
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
    const { attackerBonus, attackerPenalty } = _calculateModifiers(attacker, weapon, effectiveOrm, fullContext);

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

    const applyOnHitTraits = options.applyOnHitTraits ?? true;
    if (applyOnHitTraits && result.pass && target && weapon.traits?.length) {
        const cascades = result.cascades ?? 0;
        for (const trait of weapon.traits) {
            const parsed = parseStatusTrait(trait);
            if (!parsed) continue;
            applyStatusTraitOnHit(target, parsed.traitName, {
                cascades,
                rating: parsed.rating,
                impact: weapon.impact ?? 0,
            });
        }
    }

    return result;
}
