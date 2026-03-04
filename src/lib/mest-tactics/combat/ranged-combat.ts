
/**
 * Range Combat Rules Implementation
 *
 * **Rules References:**
 * - [[rules-combat|Rules: Combat]] - Range Combat overview
 * - [[rule-direct-range-combat|Rules: Direct Range Combat (QSR)]] - Detailed QSR rules
 * - [[rules-indirect|Rules: Indirect Combat]] - Indirect attacks and Scatter
 * - [[rules-situational-modifiers|Rules: Situational Modifiers]] - Range modifiers (ORM, Cover, etc.)
 * - [[rules-friendly-fire-los|Rules: Friendly Fire & LOF]] - Miss resolution
 * - [[rules-traits-list|Rules: Traits List]] - Range traits (Shoot, Evasive, etc.)
 */

import { Character } from '../core/Character';
import { TestDice, DiceType, TestResult } from '../subroutines/dice-roller';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { calculateHindrancePenalty } from '../subroutines/hindrances';
import { resolveRangedHitTest } from '../subroutines/ranged-hit-test';
import { resolveDamage, DamageResolution } from '../subroutines/damage-test';
import { SpatialAttackContext, SpatialRules } from '../battlefield/spatial/spatial-rules';
import { applyStatusTraitOnHit, parseStatusTrait, getCharacterTraitLevel } from '../status/status-system';
import {
  getDetectMaxOrmBonus,
  getEvasiveBonusDice,
  checkEvasiveReposition,
  hasBlinders,
  getArcheryBonus,
  getShootPenaltyReduction,
  getShootMaxORMBonus,
  getDeflectBonusForTest,
  getWeaponIndexForCharacter,
} from '../traits/combat-traits';
import { resolveFriendlyFire, FriendlyFireOptions } from './friendly-fire';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import {
  hasBurst, 
  getBurstBonus,
  hasFeed, 
  checkFeedJam,
  hasJam, 
  checkJam,
  isWeaponJammed,
  setWeaponJammed,
  getMultipleAttackPenalty,
  recordWeaponUse,
  isMultipleAttackExempt,
  getMultipleWeaponsBonus,
} from '../traits/combat-traits';
import { calculateObscuredPenalty } from './obscured';

// --- Main Attack Result Interface ---

export interface AttackResult {
    hit: boolean;
    damageResolution?: DamageResolution;
    hitTestResult: TestResult;
    friendlyFire?: {
        triggered: boolean;
        hit: boolean;
        hitCharacter?: Character;
        reason?: string;
    };
    weaponJammed?: boolean;
    multipleAttackPenalty?: number;
}

// --- Internal Modifier Calculation for Ranged Combat --- //

export function buildRangedHitTestModifiers(attacker: Character, defender: Character, weapon: Item, context: TestContext)
    : { attackerBonus: TestDice, attackerPenalty: TestDice, defenderBonus: TestDice, defenderPenalty: TestDice } {
    
    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = {};
    const weaponIndex = getWeaponIndexForCharacter(attacker, weapon);
    const weaponClass = (weapon.classification || weapon.class || '').toLowerCase();
    const isBow = weaponClass.includes('bow');

    // 1. Hindrance Penalties (applies to most tests)
    const attackerHindrance = calculateHindrancePenalty({
        woundTokens: attacker.state.wounds,
        fearTokens: attacker.state.fearTokens,
        delayTokens: attacker.state.delayTokens,
        statusTokens: attacker.state.statusTokens,
    });
    if (attackerHindrance > 0) attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + attackerHindrance;

    // Note: Defender hindrance doesn't apply to the REF roll for being hit.

    // 2. Multiple Weapons Bonus (+1m per additional weapon of same classification)
    const multipleWeaponsBonus = getMultipleWeaponsBonus(attacker, weaponIndex, false);
    if (multipleWeaponsBonus > 0) {
        attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + multipleWeaponsBonus;
    }

    // 3. Multiple Attack Penalty (-1m for consecutive same weapon use)
    // Natural weapons and Natural Weapon trait are exempt
    // This is handled externally and passed via context.multipleAttackPenalty

    if (context.multipleAttackPenalty) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + context.multipleAttackPenalty;
    }

    // 4. [Burst] trait bonus (+1b to Hit Test) - handled via context.burstBonusBase
    if (context.burstBonusBase) {
        attackerBonus[DiceType.Base] = (attackerBonus[DiceType.Base] || 0) + context.burstBonusBase;
    }
    if (context.rofBonusWild) {
        attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + context.rofBonusWild;
    }

    // 4. Ranged-Specific Contextual Modifiers
    if (context.isLeaning) attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + 1;
    if (context.isTargetLeaning) attackerPenalty[DiceType.Base] = (attackerPenalty[DiceType.Base] || 0) + 1;
    if (context.isPointBlank) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasSuddenness || context.isSudden) attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    if (context.hasDirectCover) defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
    if (context.hasInterveningCover) defenderBonus[DiceType.Modifier] = (defenderBonus[DiceType.Modifier] || 0) + 1;
    if (context.isDefending) defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
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

    if (context.obscuringModels && context.obscuringModels > 0) {
        const obscuredPenalty = calculateObscuredPenalty(context.obscuringModels);
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + obscuredPenalty;
    }

    // QSR: Elevation - +1m if higher than opponent by 1" for every 1" away
    if (context.hasElevationAdvantage) {
        attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
    }

    // QSR: Confined - -1m if Confined by Terrain (vertically, horizontally, or behind)
    if (context.isConfined) {
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
    }

    // Distance Penalty (ORM)
    if (context.orm && context.orm > 0) {
        // Detect X and Shoot X: Increase Maximum OR Multiple by X
        const detectOrmBonus = getDetectMaxOrmBonus(attacker);
        const shootOrmBonus = getShootMaxORMBonus(attacker);
        const effectiveOrm = Math.max(0, context.orm - detectOrmBonus - shootOrmBonus);
        attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + effectiveOrm;
    }
    
    // Evasive X: +X Modifier dice per OR Multiple for Defender Range Combat Hit Tests
    if (context.orm && context.orm > 0) {
        const evasiveBonus = getEvasiveBonusDice(defender, context.orm);
        if (evasiveBonus > 0) {
            defenderBonus[DiceType.Modifier] = (defenderBonus[DiceType.Modifier] || 0) + evasiveBonus;
        }
    }

    // Deflect X: +X Modifier dice for Defender Range Combat Hit Tests (ignored if engaged)
    const deflectBonus = getDeflectBonusForTest(defender, true, context.isEngaged ?? false);
    if (deflectBonus > 0) {
        defenderBonus[DiceType.Modifier] = (defenderBonus[DiceType.Modifier] || 0) + deflectBonus;
    }

    // Archery X: +Xm Bow Hit Tests
    const archeryBonus = getArcheryBonus(attacker, isBow);
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

    return { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty };
}

// --- Main Ranged Combat Function --- //

/**
 * Orchestrates a complete direct ranged combat attack, from the initial hit roll to the final damage resolution.
 * Includes Friendly Fire resolution when the attack misses.
 */
export function makeRangedCombatAttack(
    attacker: Character,
    defender: Character,
    weapon: Item,
    orm: number = 0,
    context: TestContext = {},
    spatial?: SpatialAttackContext,
    options?: {
        /** All characters on battlefield for friendly fire check */
        allCharacters?: Character[];
        /** Character position lookup for friendly fire */
        getCharacterPosition?: (character: Character) => Position | undefined;
        /** Battlefield for LOS checks in friendly fire */
        battlefield?: Battlefield;
    }
): AttackResult {

    const spatialContext = spatial ? SpatialRules.buildRangedContextFromSpatial(spatial) : {};
    // Merge ORM into context, explicit context wins over spatial defaults.
    const fullContext: TestContext = { ...spatialContext, ...context, orm };
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

    if (spatial) {
        const cover = SpatialRules.getCoverResult(spatial.battlefield, spatial.attacker, spatial.target);
        if (!cover.hasLOS && !fullContext.forceHit) {
            fullContext.forceMiss = true;
        }
    }

    // 1. Calculate situational modifiers for the ranged attack.
    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = buildRangedHitTestModifiers(attacker, defender, weapon, fullContext);

    // 2. Perform the Ranged Hit Test (RCA vs REF).
    let hitTestResult: TestResult;
    if (fullContext.forceHit) {
        hitTestResult = { pass: true, score: 99, participant1Score: 99, participant2Score: 0, p1Rolls: [], p2Rolls: [], finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
    } else if (fullContext.forceMiss) {
        hitTestResult = { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
    } else {
        hitTestResult = resolveRangedHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty);
    }

    // 3. Handle missed attacks - check for Friendly Fire
    if (!hitTestResult.pass) {
        // Calculate misses for friendly fire
        const misses = Math.abs(Math.min(0, hitTestResult.score));
        
        // Check if we have the required data for friendly fire
        let friendlyFireResult: AttackResult['friendlyFire'] = undefined;
        if (options?.allCharacters && options?.getCharacterPosition && options?.battlefield) {
            const ffOptions: FriendlyFireOptions = {
                attacker,
                originalTarget: defender,
                originalTargetPosition: spatial?.target.position ?? { x: 0, y: 0 },
                allCharacters: options.allCharacters,
                getCharacterPosition: options.getCharacterPosition,
                battlefield: options.battlefield,
                weapon,
                misses,
                isConcentrated: context.isConcentrating ?? false,
            };
            
            const ffResult = resolveFriendlyFire(ffOptions);
            friendlyFireResult = {
                triggered: ffResult.triggered,
                hit: ffResult.hit,
                hitCharacter: ffResult.hitCharacter,
                reason: ffResult.reason,
            };
        }
        
        return {
            hit: false,
            hitTestResult,
            friendlyFire: friendlyFireResult,
        };
    }

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

    // 3. If the hit is successful, perform the standard Damage Resolution.
    // The damage phase is the same for both close and ranged combat.
    const damageResolution = resolveDamage(attacker, defender, weapon, hitTestResult, fullContext);

    // 4. Update the defender's state with the results.
    defender.state.wounds = damageResolution.defenderState.wounds;
    defender.state.delayTokens = damageResolution.defenderState.delayTokens;
    defender.state.isKOd = damageResolution.defenderState.isKOd;
    defender.state.isEliminated = damageResolution.defenderState.isEliminated;

    return {
        hit: true,
        damageResolution,
        hitTestResult,
    };
}

export function resolveRangedCombatHitTest(
    attacker: Character,
    defender: Character,
    weapon: Item,
    orm: number = 0,
    context: TestContext = {},
    spatial?: SpatialAttackContext
) {
    const spatialContext = spatial ? SpatialRules.buildRangedContextFromSpatial(spatial) : {};
    const fullContext: TestContext = { ...spatialContext, ...context, orm };
    if (spatial) {
        const cover = SpatialRules.getCoverResult(spatial.battlefield, spatial.attacker, spatial.target);
        if (!cover.hasLOS && !fullContext.forceHit) {
            fullContext.forceMiss = true;
        }
    }

    const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = buildRangedHitTestModifiers(attacker, defender, weapon, fullContext);

    let hitTestResult: TestResult;
    if (fullContext.forceHit) {
        hitTestResult = { pass: true, score: 99, participant1Score: 99, participant2Score: 0, p1Rolls: [], p2Rolls: [], finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
    } else if (fullContext.forceMiss) {
        hitTestResult = { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: { p1FinalBonus: {}, p1FinalPenalty: {}, p2FinalBonus: {}, p2FinalPenalty: {} } };
    } else {
        hitTestResult = resolveRangedHitTest(attacker, defender, weapon, attackerBonus, attackerPenalty, defenderBonus, defenderPenalty);
    }

    return { hitTestResult, context: fullContext };
}
