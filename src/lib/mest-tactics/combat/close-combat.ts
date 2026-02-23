import { Character } from '../core/Character';
import { TestDice, DiceType, TestResult } from '../subroutines/dice-roller';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { calculateHindrancePenalty } from '../subroutines/hindrances';
import { resolveHitTest } from '../subroutines/hit-test';
import { resolveDamage, DamageResolution } from '../subroutines/damage-test';
import { applyStatusTraitOnHit, parseStatusTrait, getCharacterTraitLevel } from '../status/status-system';
import {
  hasPerimeter,
  hasReachAdvantage,
  getParryBonus,
  getFightPenaltyReduction,
  checkCleaveTrigger,
  hasCharge,
  getKnifeFighterBonus,
  hasStub,
  hasAwkward,
  getAwkwardExtraApCost,
  checkAwkwardChargeDelay,
  hasHafted,
  getHaftedPenalty,
  hasBash,
  checkBashCascadeBonus,
} from '../traits/combat-traits';

// --- Main Attack Result Interface --- //

export interface AttackResult {
    hit: boolean;
    damageResolution?: DamageResolution;
    hitTestResult: TestResult;
}

// --- Internal Modifier Calculation --- //

function _calculateModifiers(attacker: Character, defender: Character, weapon: Item, context: TestContext)
    : { attackerBonus: TestDice, attackerPenalty: TestDice, defenderBonus: TestDice, defenderPenalty: TestDice } {

    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = {};

    // 1. Hindrance Penalties
    const attackerHindrance = calculateHindrancePenalty({ woundTokens: attacker.state.wounds, fearTokens: attacker.state.fearTokens, delayTokens: attacker.state.delayTokens });
    if (attackerHindrance > 0) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + attackerHindrance;

    const defenderHindrance = calculateHindrancePenalty({ woundTokens: defender.state.wounds, fearTokens: defender.state.fearTokens, delayTokens: defender.state.delayTokens });
    if (defenderHindrance > 0) defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + defenderHindrance;

    // 2. Contextual Modifiers
    if (context.isDefending) defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
    
    // Charge bonus (hit test bonus, damage bonus handled in resolveDamage)
    if (context.isCharge) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    
    // Overreach Penalty
    if (context.isOverreach) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
    
    if (context.outnumberAdvantage) attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + context.outnumberAdvantage;
    if (context.hasHighGround) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasSuddenness || context.isSudden) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;

    // Parry trait bonus for defender (+Xm Defender Close Combat Tests)
    const parryBonus = getParryBonus(defender);
    if (parryBonus > 0) defenderBonus[DiceType.Modifier] = (defenderBonus[DiceType.Modifier] || 0) + parryBonus;

    // Fight trait - reduces penalty dice (not adds bonus dice)
    const attackerFightReduction = getFightPenaltyReduction(attacker);
    // Apply penalty reduction (handled by caller in dice cancellation)

    // Knife-fighter X: +Xb +X Impact when Attentive, in base-contact, using [Stub] weapon
    const isAttentive = attacker.state.isAttentive;
    const isInBaseContact = context.isNowInBaseContact ?? false;
    const isUsingStubWeapon = weapon.traits?.some(t => t.includes('[Stub]')) ?? false;
    const knifeFighterBonus = getKnifeFighterBonus(attacker, isAttentive, isInBaseContact, isUsingStubWeapon);
    if (knifeFighterBonus.bonusBaseDice > 0) {
        attackerBonus[DiceType.Base] = (attackerBonus[DiceType.Base] || 0) + knifeFighterBonus.bonusBaseDice;
    }

    // Hafted: -1m Defender Close Combat Hit Tests
    const haftedPenalty = getHaftedPenalty(defender);
    if (haftedPenalty < 0) defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + Math.abs(haftedPenalty);

    // Lumbering: upgrades penalties to Base dice
    const defenderHasLumbering = getCharacterTraitLevel(defender, 'Lumbering') > 0;
    if (context.isCornered) {
        const key = defenderHasLumbering ? DiceType.Base : DiceType.Modifier;
        defenderPenalty[key] = (defenderPenalty[key] || 0) + 1;
    }
    if (context.isFlanked) {
        const key = defenderHasLumbering ? DiceType.Base : DiceType.Modifier;
        defenderPenalty[key] = (defenderPenalty[key] || 0) + 1;
    }
    if (context.isConcentrating && (context.concentrateTarget ?? 'hit') !== 'damage') {
        attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + 1;
    }
    if (context.isFocusing) {
        attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + 1;
    }
    if (context.reactPenaltyBase) {
        attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + context.reactPenaltyBase;
    }

    // QSR: Confined - -1m if Confined by Terrain (vertically, horizontally, or behind)
    if (context.isConfined) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
    }

    return { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty };
}

// --- Main Combat Function --- //

/**
 * Orchestrates a complete close combat attack, from the initial hit roll to the final damage resolution.
 * This function uses imported subroutines to handle the detailed mechanics.
 */
export function makeCloseCombatAttack(
    attacker: Character,
    defender: Character,
    weapon: Item,
    context: TestContext = {},
    p1Rolls: number[] | null = null,
    p2Rolls: number[] | null = null,
    p3Rolls: number[] | null = null,
    p4Rolls: number[] | null = null,
): AttackResult {

    // 1. Calculate situational modifiers for both participants.
    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, weapon, context);

    // 2. Perform the Hit Test.
    const hitTestResult = resolveHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty, p1Rolls, p2Rolls);

    // A hit only succeeds if the attacker's score is strictly greater than the defender's.
    const isHit = (hitTestResult.score > 0) || context.forceHit;

    if (!isHit) {
        return { hit: false, hitTestResult };
    }

    // Apply weapon traits on hit (Stun, etc.)
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

    // 3. If the hit is successful (or forced), perform the Damage Resolution.
    // Pass charge context for Charge trait damage bonus
    const damageContext: TestContext = {
        ...context,
        isCharge: context.isCharge || hasCharge(attacker),
    };
    const damageResolution = resolveDamage(attacker, defender, weapon, hitTestResult, damageContext, p3Rolls, p4Rolls);

    // 4. Apply Cleave trait - convert KO to Elimination
    if (damageResolution.defenderState.isKOd && !damageResolution.defenderState.isEliminated) {
        const cleaveResult = checkCleaveTrigger(attacker, defender, true);
        if (cleaveResult.targetEliminated) {
            damageResolution.defenderState.isEliminated = true;
            damageResolution.defenderState.isKOd = false;
            defender.state.isEliminated = true;
            defender.state.isKOd = false;
            // Apply extra wounds from Cleave level 2+
            if (cleaveResult.extraWoundsApplied > 0) {
                damageResolution.defenderState.wounds += cleaveResult.extraWoundsApplied;
                defender.state.wounds += cleaveResult.extraWoundsApplied;
            }
        }
    } else {
        // Update defender state normally
        defender.state.wounds = damageResolution.defenderState.wounds;
        defender.state.delayTokens = damageResolution.defenderState.delayTokens;
        defender.state.isKOd = damageResolution.defenderState.isKOd;
        defender.state.isEliminated = damageResolution.defenderState.isEliminated;
    }

    // 5. Apply Bash cascade bonus (+1 cascade for Bonus Actions when Charging)
    const bashResult = checkBashCascadeBonus(attacker, context.isCharge ?? false, true, isHit);
    if (bashResult.cascadeBonus > 0) {
        // Store bash bonus for potential bonus action use
        damageResolution.bashCascadeBonus = bashResult.cascadeBonus;
    }

    // 6. Apply Awkward charge delay (defender gets Delay token if charged)
    const awkwardResult = checkAwkwardChargeDelay(defender, attacker, context.isCharge ?? false);
    if (awkwardResult.shouldAcquireDelay) {
        defender.state.delayTokens += awkwardResult.delayTokens;
        damageResolution.defenderState.delayTokens += awkwardResult.delayTokens;
    }

    return {
        hit: true, // It's a hit, either by roll or by force
        damageResolution,
        hitTestResult,
    };
}

export function resolveCloseCombatHitTest(
    attacker: Character,
    defender: Character,
    weapon: Item,
    context: TestContext = {},
    p1Rolls: number[] | null = null,
    p2Rolls: number[] | null = null,
) {
    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, weapon, context);
    return resolveHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty, p1Rolls, p2Rolls);
}
