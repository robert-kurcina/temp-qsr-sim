import { Character } from '../core/Character';
import { Item } from '../core/Item';
import { Position } from '../battlefield/Position';
import { ActionContextInput, CloseCombatContextInput, buildCloseCombatActionContext, buildLOSResultContext, buildRangedActionContext, resolveFriendlyFire } from '../battlefield/validation/action-context';
import { SpatialRules, SpatialModel } from '../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { TestContext } from '../utils/TestContext';
import { resolveRangedCombatHitTest, buildRangedHitTestModifiers } from '../combat/ranged-combat';
import { resolveCloseCombatHitTest } from '../combat/close-combat';
import { DamageResolution, resolveDamage } from '../subroutines/damage-test';
import { resolveTest, TestParticipant, TestDice, DiceType, mergeTestDice, ResolveTestResult } from '../subroutines/dice-roller';
import { parseAccuracy } from '../subroutines/accuracy-parser';
import { BonusActionOutcome, BonusActionSelection, applyBonusAction, buildBonusActionOptions } from './bonus-actions';
import { parseStatusTrait, applyStatusTraitOnHit } from '../status/status-system';
import { MoraleOptions, applyFearFromAllyKO, applyFearFromWounds } from '../status/morale';
import { makeIndirectRangedAttack } from '../combat/indirect-ranged-combat';
import { resolveScatter, type ScatterResult } from '../combat/scatter';
import { LOSOperations } from '../battlefield/los/LOSOperations';
import { hasItemTrait, hasItemTraitOnWeapon } from '../traits/item-traits';
import {
  getFightBonusActions,
  checkBonusActionEligibility,
  hasReload,
  getReloadActionsRequired,
  isWeaponLoaded,
  setWeaponLoaded,
  getWeaponIndexForCharacter,
  getSneakyLevel,
  checkSneakyAutoHide,
  getSneakySuddennessBonus,
  isUnarmed,
  getUnarmedHitPenalty,
  getUnarmedDamagePenalty,
  getAcrobaticBonusDice,
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
} from '../traits/combat-traits';
import {
  validateItemUsage,
  markUsingOneLessHand,
  getHandPenalty,
  clearUsingOneLessHand,
} from './hand-requirements';
import { canAttackKOdTarget, getKOdEliminationThreshold, KOdAttackRulesConfig } from '../status/kod-rules';

function findTargetsInBaseContact(
  position: Position,
  characters: Character[],
  getCharacterPosition: (character: Character) => Position | undefined
): Array<{ character: Character; position: Position }> {
  const results: Array<{ character: Character; position: Position }> = [];
  for (const character of characters) {
    const targetPos = getCharacterPosition(character);
    if (!targetPos) continue;
    const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
    const radius = getBaseDiameterFromSiz(siz) / 2;
    const distance = Math.hypot(targetPos.x - position.x, targetPos.y - position.y);
    if (distance <= radius) {
      results.push({ character, position: targetPos });
    }
  }
  return results;
}

function resolveScrambleMoves(options: {
  characters: Character[];
  getCharacterPosition: (character: Character) => Position | undefined;
  moveCharacter: (character: Character, position: Position) => boolean;
  targetPosition: Position;
  allowScramble: boolean;
  scrambleMoves?: Record<string, Position>;
}): {
  eligibleIds: string[];
  movedIds: string[];
} {
  if (!options.allowScramble) {
    return { eligibleIds: [], movedIds: [] };
  }
  const eligible = findTargetsInBaseContact(options.targetPosition, options.characters, options.getCharacterPosition);
  const eligibleIds = eligible.map(entry => entry.character.id);
  const movedIds: string[] = [];
  if (!options.scrambleMoves) {
    return { eligibleIds, movedIds };
  }

  for (const entry of eligible) {
    const character = entry.character;
    const target = options.scrambleMoves[character.id];
    if (!target) continue;
    const current = entry.position;
    const maxDistance = (character.finalAttributes.mov ?? character.attributes.mov ?? 0) * 0.5;
    const distance = Math.hypot(target.x - current.x, target.y - current.y);
    if (distance <= maxDistance) {
      const moved = options.moveCharacter(character, target);
      if (moved) movedIds.push(character.id);
    }
  }
  return { eligibleIds, movedIds };
}

interface BlindIndirectContext {
  isBlind: boolean;
  allowed: boolean;
  usedSpotter: boolean;
  usedKnown: boolean;
  reason?: string;
}

function rollD6(rng: () => number = Math.random): number {
  return Math.floor(rng() * 6) + 1;
}

function wildSuccessFromRoll(roll: number): number {
  if (roll >= 6) return 2;
  if (roll >= 4) return 1;
  return 0;
}

function resolveBlindIndirectContext(options: {
  deps: CombatActionDeps;
  attacker: Character;
  attackerPos: Position;
  target: { id: string; position: Position; baseDiameter: number; siz: number };
  hasLOS: boolean;
  knownAtInitiativeStart?: boolean;
  spotters?: Character[];
  cohesionRangeMu?: number;
}): BlindIndirectContext {
  if (options.hasLOS) {
    return { isBlind: false, allowed: true, usedSpotter: false, usedKnown: false };
  }

  const usedKnown = options.knownAtInitiativeStart === true;
  const cohesionRange = Math.max(0, options.cohesionRangeMu ?? 4);
  const targetModel: SpatialModel = {
    id: options.target.id,
    position: options.target.position,
    baseDiameter: options.target.baseDiameter,
    siz: options.target.siz,
  };

  let usedSpotter = false;
  for (const spotter of options.spotters ?? []) {
    if (spotter.id === options.attacker.id) continue;
    if (spotter.state.isEliminated || spotter.state.isKOd) continue;
    if (!spotter.state.isAttentive || !spotter.state.isOrdered) continue;

    const spotterPos = options.deps.getCharacterPosition(spotter);
    if (!spotterPos) continue;
    const spotterModel: SpatialModel = {
      id: spotter.id,
      position: spotterPos,
      baseDiameter: getBaseDiameterFromSiz(spotter.finalAttributes.siz ?? spotter.attributes.siz ?? 3),
      siz: spotter.finalAttributes.siz ?? spotter.attributes.siz ?? 3,
    };
    const attackerModel: SpatialModel = {
      id: options.attacker.id,
      position: options.attackerPos,
      baseDiameter: getBaseDiameterFromSiz(options.attacker.finalAttributes.siz ?? options.attacker.attributes.siz ?? 3),
      siz: options.attacker.finalAttributes.siz ?? options.attacker.attributes.siz ?? 3,
    };

    const cohesionDistance = SpatialRules.distanceEdgeToEdge(spotterModel, attackerModel);
    if (cohesionDistance > cohesionRange) continue;
    if (!SpatialRules.hasLineOfSight(options.deps.battlefield!, spotterModel, targetModel)) continue;

    // Approximation of "Free": no base-contact with other in-play models.
    const engagedWithAny = options.deps.characters.some(other => {
      if (other.id === spotter.id || other.state.isKOd || other.state.isEliminated) {
        return false;
      }
      const otherPos = options.deps.getCharacterPosition(other);
      if (!otherPos) return false;
      const otherModel: SpatialModel = {
        id: other.id,
        position: otherPos,
        baseDiameter: getBaseDiameterFromSiz(other.finalAttributes.siz ?? other.attributes.siz ?? 3),
        siz: other.finalAttributes.siz ?? other.attributes.siz ?? 3,
      };
      return SpatialRules.isEngaged(spotterModel, otherModel);
    });
    if (engagedWithAny) continue;

    usedSpotter = true;
    break;
  }

  if (!usedSpotter && !usedKnown) {
    return {
      isBlind: true,
      allowed: false,
      usedSpotter: false,
      usedKnown: false,
      reason: 'Blind indirect attack requires Spotter or Known target.',
    };
  }

  return {
    isBlind: true,
    allowed: true,
    usedSpotter,
    usedKnown,
  };
}

export interface CombatActionDeps {
  battlefield: import('../battlefield/Battlefield').Battlefield | null;
  characters: Character[];
  getCharacterPosition: (character: Character) => Position | undefined;
  moveCharacter: (character: Character, position: Position) => boolean;
  buildSpatialModel: (character: Character) => SpatialModel | null;
  applyPassiveOptionCost: (character: Character) => { removedWait: boolean; delayAdded: boolean };
  applyRefresh: (character: Character) => boolean;
  applyKOCleanup: (character: Character) => void;
}

export interface RangedAttackOptions extends Partial<ActionContextInput> {
  optimalRangeMu?: number;
  orm?: number;
  context?: TestContext;
  moraleAllies?: Character[];
  moraleOptions?: MoraleOptions;
  allowTakeCover?: boolean;
  takeCoverPosition?: Position;
  defend?: boolean;
  allowBonusActions?: boolean;
  bonusAction?: BonusActionSelection;
  bonusActionOpponents?: Character[];
  weaponIndex?: number;
  allowKOdAttacks?: boolean;
  kodRules?: KOdAttackRulesConfig;
}

export interface CloseCombatAttackOptions extends Partial<CloseCombatContextInput> {
  context?: TestContext;
  moraleAllies?: Character[];
  moraleOptions?: MoraleOptions;
  defend?: boolean;
  allowBonusActions?: boolean;
  bonusAction?: BonusActionSelection;
  bonusActionOpponents?: Character[];
  weaponIndex?: number;
  allowKOdAttacks?: boolean;
  kodRules?: KOdAttackRulesConfig;
}

function applyHandRequirementPenalty(
  attacker: Character,
  weapon: Item,
  context: TestContext
): { failed: boolean; reason?: string } {
  const check = validateItemUsage(attacker, weapon, {
    allowOneLessHand: true,
    isConcentrating: context.isConcentrating ?? false,
    isOverreach: context.isOverreach ?? false,
  });
  if (!check.valid || !check.canUse) {
    return { failed: true, reason: check.reason };
  }
  if (check.overreachDisallowed) {
    context.isOverreach = false;
  }
  if (check.usingOneLessHand) {
    markUsingOneLessHand(attacker);
    const penalty = getHandPenalty(attacker);
    if (penalty < 0) {
      context.handPenaltyBase = (context.handPenaltyBase ?? 0) + Math.abs(penalty);
    }
    clearUsingOneLessHand(attacker);
  }
  return { failed: false };
}

export function executeRangedAttack(
  deps: CombatActionDeps,
  attacker: Character,
  defender: Character,
  weapon: Item,
  options: RangedAttackOptions = {}
) {
  if (!deps.battlefield) {
    throw new Error('Battlefield not set.');
  }
  const attackerPos = options.attacker?.position ?? deps.getCharacterPosition(attacker);
  let defenderPos = options.target?.position ?? deps.getCharacterPosition(defender);
  if (!attackerPos || !defenderPos) {
    throw new Error('Missing attacker or defender position.');
  }

  let spatial: ActionContextInput = {
    battlefield: deps.battlefield,
    attacker: {
      id: attacker.id,
      position: attackerPos,
      baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz),
      siz: attacker.finalAttributes.siz,
    },
    target: {
      id: defender.id,
      position: defenderPos,
      baseDiameter: getBaseDiameterFromSiz(defender.finalAttributes.siz),
      siz: defender.finalAttributes.siz,
    },
    optimalRangeMu: options.optimalRangeMu,
    orm: options.orm,
    attackerEngagedOverride: options.attackerEngagedOverride,
    isLeaning: options.isLeaning,
    isTargetLeaning: options.isTargetLeaning,
    lofWidthMu: options.lofWidthMu,
  };

  let takeCoverResult: { applied: boolean; cancelled: boolean; moved: boolean } | null = null;
  if (options.allowTakeCover && options.takeCoverPosition) {
    const engaged = SpatialRules.isEngaged(spatial.attacker, spatial.target);
    const defenderRef = defender.finalAttributes.ref ?? defender.attributes.ref ?? 0;
    const attackerRef = attacker.finalAttributes.ref ?? attacker.attributes.ref ?? 0;
    if (!engaged && defender.state.isAttentive && defender.state.isOrdered && defenderRef >= attackerRef) {
      const moveLimit = defender.finalAttributes.mov ?? defender.attributes.mov ?? 0;
      const moveDistance = LOSOperations.distance(defenderPos, options.takeCoverPosition);
      if (moveDistance <= moveLimit) {
        const moved = deps.moveCharacter(defender, options.takeCoverPosition);
        if (moved) {
          defenderPos = options.takeCoverPosition;
          spatial = {
            ...spatial,
            target: {
              ...spatial.target,
              position: defenderPos,
            },
          };
          const coverAfter = SpatialRules.getCoverResult(deps.battlefield, spatial.attacker, spatial.target);
          const behindCover = coverAfter.hasDirectCover || coverAfter.hasInterveningCover || !coverAfter.hasLOS;
          takeCoverResult = { applied: behindCover, cancelled: behindCover && !coverAfter.hasLOS, moved: true };
        }
      }
    }
  }

  const friendlyFire = resolveFriendlyFire(
    spatial,
    deps.characters.map(character => {
      const pos = deps.getCharacterPosition(character);
      return {
        id: character.id,
        position: pos ?? attackerPos,
        baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz),
        siz: character.finalAttributes.siz,
        isFriendly: false,
        isAttentive: character.state.isAttentive,
        isOrdered: character.state.isOrdered,
      };
    })
  );

  const context = buildRangedActionContext(spatial);
  const mergedContext: TestContext = { ...context, ...(options.context ?? {}) };
  mergedContext.isCloseCombat = false;
  if (!attacker.state.isAttentive) {
    mergedContext.isOverreach = false;
    mergedContext.isLeaning = false;
  }
  if (!defender.state.isAttentive) {
    mergedContext.isTargetLeaning = false;
  }
  if (attacker.state.isHidden && mergedContext.hasSuddenness !== false) {
    mergedContext.hasSuddenness = true;
  }
  if (defender.state.isHidden && !mergedContext.forceHit) {
    mergedContext.forceMiss = true;
  }

  if (takeCoverResult?.cancelled) {
    mergedContext.forceMiss = true;
  }

  if (options.defend && defender.state.isAttentive) {
    mergedContext.isDefending = true;
  }

  const handCheck = applyHandRequirementPenalty(attacker, weapon, mergedContext);
  if (handCheck.failed) {
    return {
      result: { hit: false, hitTestResult: { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: {} } },
      context: mergedContext,
      friendlyFire,
      takeCover: takeCoverResult,
      handRequirementFailed: true,
      handRequirementReason: handCheck.reason,
    };
  }

  // Multiple Attack Penalty: -1m for using same weapon consecutively
  // Natural weapons and Natural Weapon trait are exempt
  let weaponJammed = false;
  let multipleAttackPenalty = 0;
  let burstBonusBase = 0;
  
  // Determine weapon index (use option override if provided)
  const weaponIndex = options.weaponIndex ?? getWeaponIndexForCharacter(attacker, weapon);
  attacker.state.activeWeaponIndex = weaponIndex;
  
  if (!isMultipleAttackExempt(attacker, weaponIndex)) {
    const penaltyResult = getMultipleAttackPenalty(attacker, weaponIndex);
    multipleAttackPenalty = penaltyResult.penalty;
    if (multipleAttackPenalty > 0) {
      mergedContext.multipleAttackPenalty = multipleAttackPenalty;
    }
  }
  
  // [Burst] trait: +1b to Hit Test
  if (hasBurst(attacker, weaponIndex)) {
    const burstResult = getBurstBonus(attacker, weaponIndex);
    burstBonusBase = burstResult.bonusBaseDice;
    if (burstBonusBase > 0) {
      mergedContext.burstBonusBase = burstBonusBase;
    }
  }
  
  // Reload trait: cannot fire if weapon is not loaded (unless Archery ignores bow reload)
  const reloadRequired = getReloadActionsRequired(attacker, weaponIndex);
  if (reloadRequired > 0 && !isWeaponLoaded(attacker, weaponIndex)) {
    return {
      result: { hit: false, hitTestResult: { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: {} } },
      context: mergedContext,
      friendlyFire,
      takeCover: takeCoverResult,
      weaponReloading: true,
    };
  }

  // Check for weapon jam before attack ([Feed], [Jam], [Burst] traits)
  if (isWeaponJammed(attacker, weaponIndex)) {
    // Weapon is jammed, cannot attack
    return {
      result: { hit: false, hitTestResult: { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: {} } },
      context: mergedContext,
      friendlyFire,
      takeCover: takeCoverResult,
      weaponJammed: true,
    };
  }

  if (defender.state.isKOd) {
    const allow = canAttackKOdTarget(attacker, defender, {
      enabled: options.allowKOdAttacks ?? false,
      ...(options.kodRules ?? {}),
    });
    if (!allow.allowed) {
      return {
        result: { hit: false, hitTestResult: { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: {} } },
        context: mergedContext,
        friendlyFire,
        takeCover: takeCoverResult,
        weaponJammed,
        multipleAttackPenalty,
        reason: allow.reason,
      };
    }

    const hitTestResult = resolveKOdRangedHitTest(attacker, defender, weapon, mergedContext);
    if (reloadRequired > 0) {
      setWeaponLoaded(attacker, weaponIndex, false);
    }
    recordWeaponUse(attacker, weaponIndex);

    // Check for [Feed] jam (jams on roll of 1 on any attack die)
    if (hasFeed(attacker, weaponIndex) && hitTestResult.p1Rolls) {
      const feedResult = checkFeedJam(hitTestResult.p1Rolls);
      if (feedResult.jammed) {
        weaponJammed = true;
        setWeaponJammed(attacker, weaponIndex);
      }
    }

    // Check for [Burst] jam (jams on roll of 1 on any attack die)
    if (hasBurst(attacker, weaponIndex) && hitTestResult.p1Rolls) {
      const feedResult = checkFeedJam(hitTestResult.p1Rolls);
      if (feedResult.jammed) {
        weaponJammed = true;
        setWeaponJammed(attacker, weaponIndex);
      }
    }

    // Check for [Jam] trait (random jam chance after attack)
    if (hasJam(attacker, weaponIndex) && !weaponJammed) {
      const jamResult = checkJam();
      if (jamResult.jammed) {
        weaponJammed = true;
        setWeaponJammed(attacker, weaponIndex);
      }
    }

    if (!hitTestResult.pass) {
      return {
        result: { hit: false, hitTestResult },
        context: mergedContext,
        friendlyFire,
        takeCover: takeCoverResult,
        weaponJammed,
        multipleAttackPenalty,
      };
    }

    const damageResolution = resolveKOdDamageIfNeeded(attacker, defender, weapon, hitTestResult, mergedContext, {
      allowKOdAttacks: options.allowKOdAttacks ?? false,
      kodRules: options.kodRules,
    });
    if (damageResolution) {
      defender.state.wounds = damageResolution.defenderState.wounds;
      defender.state.delayTokens = damageResolution.defenderState.delayTokens;
      defender.state.isKOd = damageResolution.defenderState.isKOd;
      defender.state.isEliminated = damageResolution.defenderState.isEliminated;
    }

    return {
      result: { hit: true, hitTestResult, damageResolution },
      context: mergedContext,
      friendlyFire,
      takeCover: takeCoverResult,
      weaponJammed,
      multipleAttackPenalty,
    };
  }

  const { hitTestResult, context: resolvedContext } = resolveRangedCombatHitTest(
    attacker,
    defender,
    weapon,
    options.orm ?? 0,
    mergedContext,
    spatial
  );

  if (reloadRequired > 0) {
    setWeaponLoaded(attacker, weaponIndex, false);
  }
  
  // Record weapon use for Multiple Attack Penalty tracking
  recordWeaponUse(attacker, weaponIndex);
  
  // Check for [Feed] jam (jams on roll of 1 on any attack die)
  if (hasFeed(attacker, weaponIndex) && hitTestResult.p1Rolls) {
    const feedResult = checkFeedJam(hitTestResult.p1Rolls);
    if (feedResult.jammed) {
      weaponJammed = true;
      setWeaponJammed(attacker, weaponIndex);
    }
  }
  
  // Check for [Burst] jam (jams on roll of 1 on any attack die)
  if (hasBurst(attacker, weaponIndex) && hitTestResult.p1Rolls) {
    const feedResult = checkFeedJam(hitTestResult.p1Rolls);
    if (feedResult.jammed) {
      weaponJammed = true;
      setWeaponJammed(attacker, weaponIndex);
    }
  }
  
  // Check for [Jam] trait (random jam chance after attack)
  if (hasJam(attacker, weaponIndex) && !weaponJammed) {
    const jamResult = checkJam();
    if (jamResult.jammed) {
      weaponJammed = true;
      setWeaponJammed(attacker, weaponIndex);
    }
  }

  if (!hitTestResult.pass) {
    if (options.defend && defender.state.isAttentive) {
      deps.applyPassiveOptionCost(defender);
    }
    return {
      result: { hit: false, hitTestResult },
      context: resolvedContext,
      friendlyFire,
      takeCover: takeCoverResult,
      weaponJammed,
      multipleAttackPenalty,
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

  let bonusActionOptions: ReturnType<typeof buildBonusActionOptions> | undefined;
  let bonusActionOutcome: BonusActionOutcome | undefined;
  const allowBonusActions = options.allowBonusActions ?? true;
  if (allowBonusActions) {
    bonusActionOptions = buildBonusActionOptions({
      battlefield: deps.battlefield,
      attacker,
      target: defender,
      cascades: hitTestResult.cascades ?? 0,
      isCloseCombat: false,
    });
    if (options.bonusAction) {
      bonusActionOutcome = applyBonusAction(
        {
          battlefield: deps.battlefield,
          attacker,
          target: defender,
          cascades: hitTestResult.cascades ?? 0,
          isCloseCombat: false,
        },
        { ...options.bonusAction, opponents: options.bonusActionOpponents }
      );
      if (bonusActionOutcome.refreshApplied) {
        deps.applyRefresh(attacker);
      }
    }
  }

  const damageResolution = resolveDamage(attacker, defender, weapon, hitTestResult as unknown as ResolveTestResult, resolvedContext);
  defender.state.wounds = damageResolution.defenderState.wounds;
  defender.state.delayTokens = damageResolution.defenderState.delayTokens;
  defender.state.isKOd = damageResolution.defenderState.isKOd;
  defender.state.isEliminated = damageResolution.defenderState.isEliminated;

  if (weapon.traits?.includes('[Reveal]')) {
    const cover = SpatialRules.getCoverResult(spatial.battlefield, spatial.attacker, spatial.target);
    if (cover.hasLOS) {
      attacker.state.isHidden = false;
    }
  }
  if (damageResolution) {
    const woundsAdded = damageResolution.woundsAdded + damageResolution.stunWoundsAdded;
    applyFearFromWounds(defender, woundsAdded);
    if (damageResolution.defenderState.isKOd || damageResolution.defenderState.isEliminated) {
      if (deps.battlefield && options.moraleAllies) {
        applyFearFromAllyKO(deps.battlefield, defender, options.moraleAllies, options.moraleOptions);
      }
    }
    deps.applyKOCleanup(defender);
  }

  if (options.defend && defender.state.isAttentive && !bonusActionOutcome?.executed) {
    deps.applyPassiveOptionCost(defender);
  }

  return {
    result: { hit: true, hitTestResult, damageResolution },
    context: resolvedContext,
    friendlyFire,
    takeCover: takeCoverResult,
    bonusActionOptions,
    bonusActionOutcome,
    weaponJammed,
    multipleAttackPenalty,
  };
}

export function executeIndirectAttack(
  deps: CombatActionDeps,
  attacker: Character,
  weapon: Item,
  orm: number,
  options: Partial<ActionContextInput> & {
    context?: TestContext;
    targetCharacter?: Character;
    directionRoll?: number;
    scatterBias?: 'biased' | 'unbiased';
    scatterWeights?: number[];
    scrambleMoves?: Record<string, Position>;
    allowScramble?: boolean;
    knownAtInitiativeStart?: boolean;
    spotters?: Character[];
    spotterCohesionRangeMu?: number;
    blindScatterDistanceRoll?: number;
    blindScatterDistanceRng?: () => number;
    weaponIndex?: number;
    allowKOdAttacks?: boolean;
    kodRules?: KOdAttackRulesConfig;
  } = {}
) {
  if (!deps.battlefield) {
    throw new Error('Battlefield not set.');
  }
  const attackerPos = options.attacker?.position ?? deps.getCharacterPosition(attacker);
  if (!attackerPos || !options.target?.position) {
    throw new Error('Missing attacker or target position.');
  }
  const spatial: ActionContextInput = {
    battlefield: deps.battlefield,
    attacker: {
      id: attacker.id,
      position: attackerPos,
      baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz),
      siz: attacker.finalAttributes.siz,
    },
    target: options.target,
    optimalRangeMu: options.optimalRangeMu,
    orm,
    attackerEngagedOverride: options.attackerEngagedOverride,
    isLeaning: options.isLeaning,
    isTargetLeaning: options.isTargetLeaning,
    lofWidthMu: options.lofWidthMu,
  };

  const context = buildRangedActionContext(spatial);
  const losContext = buildLOSResultContext(spatial);
  const mergedContext: TestContext = { ...context, ...(options.context ?? {}) };
  mergedContext.isCloseCombat = false;
  const blind = resolveBlindIndirectContext({
    deps,
    attacker,
    attackerPos,
    target: options.target,
    hasLOS: losContext.hasLOS,
    knownAtInitiativeStart: options.knownAtInitiativeStart,
    spotters: options.spotters,
    cohesionRangeMu: options.spotterCohesionRangeMu,
  });
  if (!blind.allowed) {
    return {
      hitTestResult: { pass: false, score: -99, p1FinalScore: 0, p2FinalScore: 99, cascades: 0, p1Result: { score: 0, carryOverDice: {} }, p2Result: { score: 99, carryOverDice: {} } },
      scatterResult: undefined,
      finalPosition: options.target?.position,
      damageResults: [],
      scramble: { eligibleIds: [], movedIds: [] },
      blind,
      handRequirementFailed: true,
      handRequirementReason: blind.reason,
    };
  }
  if (blind.isBlind) {
    mergedContext.isBlindAttack = true;
  }
  const handCheck = applyHandRequirementPenalty(attacker, weapon, mergedContext);
  if (handCheck.failed) {
    return {
      hitTestResult: { pass: false, score: -99, p1FinalScore: 0, p2FinalScore: 99, cascades: 0, p1Result: { score: 0, carryOverDice: {} }, p2Result: { score: 99, carryOverDice: {} } },
      scatterResult: undefined,
      finalPosition: options.target?.position,
      damageResults: [],
      scramble: { eligibleIds: [], movedIds: [] },
      blind,
      handRequirementFailed: true,
      handRequirementReason: handCheck.reason,
    };
  }
  const hitTestResult = makeIndirectRangedAttack(attacker, weapon, orm, mergedContext, null, spatial, options.targetCharacter);
  const weaponIndex = options.weaponIndex ?? getWeaponIndexForCharacter(attacker, weapon);
  attacker.state.activeWeaponIndex = weaponIndex;

  const misses = hitTestResult.pass ? 0 : Math.max(1, Math.ceil(Math.abs(hitTestResult.score)));
  const usesScatter = hasItemTraitOnWeapon(weapon, 'Scatter');
  const blindScatterUsesUnbiased = blind.isBlind && usesScatter;
  const blindScatterDistanceRoll = blindScatterUsesUnbiased
    ? (options.blindScatterDistanceRoll ?? rollD6(options.blindScatterDistanceRng))
    : undefined;
  const blindScatterDistanceBonus = blindScatterUsesUnbiased && blindScatterDistanceRoll !== undefined
    ? wildSuccessFromRoll(blindScatterDistanceRoll)
    : 0;
  const scatterMisses = misses + blindScatterDistanceBonus;
  const scatterResult: ScatterResult | undefined = hitTestResult.pass
    ? undefined
    : resolveScatter({
        attackerPosition: attackerPos,
        targetPosition: options.target!.position,
        misses: scatterMisses,
        battlefield: deps.battlefield,
        directionRoll: options.directionRoll,
        bias: blindScatterUsesUnbiased ? 'unbiased' : options.scatterBias,
        weights: options.scatterWeights,
      });

  const finalPosition = scatterResult?.finalPosition ?? options.target!.position;

  const scramble = resolveScrambleMoves({
    characters: deps.characters,
    getCharacterPosition: deps.getCharacterPosition,
    moveCharacter: deps.moveCharacter,
    targetPosition: options.target!.position,
    allowScramble: options.allowScramble ?? false,
    scrambleMoves: options.scrambleMoves,
  });

  const blastTargets = findTargetsInBaseContact(finalPosition, deps.characters, deps.getCharacterPosition);
  const usesAoE = hasItemTraitOnWeapon(weapon, 'AoE') || hasItemTraitOnWeapon(weapon, 'Frag');
  const hasFrag = hasItemTraitOnWeapon(weapon, 'Frag');

  const damageResults: Array<{ targetId: string; damageResolution: DamageResolution }> = [];
  if (usesAoE) {
    for (const entry of blastTargets) {
      const target = entry.character;
      if (target.state.isKOd) {
        const allowKOd = canAttackKOdTarget(attacker, target, {
          enabled: options.allowKOdAttacks ?? false,
          ...(options.kodRules ?? {}),
        });
        if (!allowKOd.allowed) {
          continue;
        }
      }
      if (hasFrag) {
        const fragSpatial: ActionContextInput = {
          battlefield: deps.battlefield,
          attacker: {
            id: attacker.id,
            position: attackerPos,
            baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz),
            siz: attacker.finalAttributes.siz,
          },
          target: {
            id: target.id,
            position: entry.position,
            baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz),
            siz: target.finalAttributes.siz,
          },
        };
        const fragContext = buildRangedActionContext(fragSpatial);
        const fragHit = resolveRangedCombatHitTest(
          attacker,
          target,
          weapon,
          orm,
          fragContext,
          fragSpatial
        );
        if (fragHit.hitTestResult.pass) {
          continue;
        }
      }
      if (hasFrag && hitTestResult.pass) {
        continue;
      }
      const damageResolution = resolveKOdDamageIfNeeded(attacker, target, weapon, hitTestResult, mergedContext, {
        allowKOdAttacks: options.allowKOdAttacks ?? false,
        kodRules: options.kodRules,
      });
      if (!damageResolution) {
        continue;
      }
      target.state.wounds = damageResolution.defenderState.wounds;
      target.state.delayTokens = damageResolution.defenderState.delayTokens;
      target.state.isKOd = damageResolution.defenderState.isKOd;
      target.state.isEliminated = damageResolution.defenderState.isEliminated;
      damageResults.push({ targetId: target.id, damageResolution });
    }
  } else if (options.targetCharacter) {
    const damageResolution = resolveKOdDamageIfNeeded(attacker, options.targetCharacter, weapon, hitTestResult, mergedContext, {
      allowKOdAttacks: options.allowKOdAttacks ?? false,
      kodRules: options.kodRules,
    });
    if (!damageResolution) {
      return {
        hitTestResult,
        scatterResult,
        finalPosition,
        damageResults,
        scramble,
        blind,
        blindScatterDistanceBonus,
        blindScatterDistanceRoll,
      };
    }
    options.targetCharacter.state.wounds = damageResolution.defenderState.wounds;
    options.targetCharacter.state.delayTokens = damageResolution.defenderState.delayTokens;
    options.targetCharacter.state.isKOd = damageResolution.defenderState.isKOd;
    options.targetCharacter.state.isEliminated = damageResolution.defenderState.isEliminated;
    damageResults.push({ targetId: options.targetCharacter.id, damageResolution });
  }

  return {
    hitTestResult,
    scatterResult,
    finalPosition,
    damageResults,
    scramble,
    blind,
    blindScatterDistanceBonus,
    blindScatterDistanceRoll,
  };
}

function resolveKOdDamageIfNeeded(
  attacker: Character,
  defender: Character,
  weapon: Item,
  hitTestResult: ResolveTestResult,
  context: TestContext,
  options: { allowKOdAttacks: boolean; kodRules?: KOdAttackRulesConfig; damageBonus?: number }
): DamageResolution | null {
  if (!defender.state.isKOd) {
    return resolveDamage(attacker, defender, weapon, hitTestResult, context);
  }

  const allow = canAttackKOdTarget(attacker, defender, {
    enabled: options.allowKOdAttacks,
    ...(options.kodRules ?? {}),
  });
  if (!allow.allowed) {
    return null;
  }

  const originalState = {
    wounds: defender.state.wounds,
    delayTokens: defender.state.delayTokens,
    isKOd: defender.state.isKOd,
    isEliminated: defender.state.isEliminated,
    armorTotal: defender.state.armor.total,
  };

  defender.state.armor.total = Math.max(0, originalState.armorTotal - 3);

  const damageBonus = options.damageBonus ?? 0;
  const adjustedWeapon = damageBonus > 0 ? {
    ...weapon,
    dmg: `${weapon.dmg ?? ''}+${damageBonus}`,
  } : weapon;

  const damageResolution = resolveDamage(attacker, defender, adjustedWeapon, hitTestResult, context);

  const threshold = getKOdEliminationThreshold(defender);
  if (damageResolution.woundsAdded >= threshold) {
    defender.state.isEliminated = true;
    defender.state.isKOd = false;
    defender.state.wounds = Math.max(defender.state.wounds, (defender.finalAttributes.siz ?? 0) + 3);
    damageResolution.defenderState = {
      wounds: defender.state.wounds,
      delayTokens: defender.state.delayTokens,
      isKOd: defender.state.isKOd,
      isEliminated: defender.state.isEliminated,
    };
  } else {
    defender.state.wounds = originalState.wounds;
    defender.state.delayTokens = originalState.delayTokens;
    defender.state.isKOd = originalState.isKOd;
    defender.state.isEliminated = originalState.isEliminated;
    damageResolution.woundsAdded = 0;
    damageResolution.stunWoundsAdded = 0;
    damageResolution.defenderState = {
      wounds: defender.state.wounds,
      delayTokens: defender.state.delayTokens,
      isKOd: defender.state.isKOd,
      isEliminated: defender.state.isEliminated,
    };
  }

  defender.state.armor.total = originalState.armorTotal;
  return damageResolution;
}

function buildAutoHitResult(): ResolveTestResult {
  const p1Result = { score: 1, carryOverDice: { base: 1, modifier: 0, wild: 0 } };
  const p2Result = { score: 0, carryOverDice: { base: 0, modifier: 0, wild: 0 } };
  return {
    score: 1,
    p1FinalScore: 1,
    p2FinalScore: 0,
    cascades: 1,
    p1Result,
    p2Result,
    pass: true,
    carryOverDice: { base: 1, modifier: 0, wild: 0 },
  } as ResolveTestResult;
}

function resolveKOdRangedHitTest(
  attacker: Character,
  defender: Character,
  weapon: Item,
  context: TestContext
): ResolveTestResult {
  const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = buildRangedHitTestModifiers(attacker, defender, weapon, context);
  attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 3;

  const { bonusDice: accBonus, penaltyDice: accPenalty } = parseAccuracy(weapon.accuracy);
  const attackerAttribute = weapon.classification === 'Thrown'
    ? attacker.finalAttributes.cca
    : attacker.finalAttributes.rca;

  const attackerParticipant: TestParticipant = {
    attributeValue: attackerAttribute,
    bonusDice: mergeTestDice(attackerBonus, accBonus),
    penaltyDice: mergeTestDice(attackerPenalty, accPenalty),
  };
  const systemParticipant: TestParticipant = {
    attributeValue: 0,
    bonusDice: defenderBonus,
    penaltyDice: defenderPenalty,
    isSystemPlayer: true,
  };

  const result = resolveTest(attackerParticipant, systemParticipant);
  (result as ResolveTestResult & { carryOverDice?: TestDice }).carryOverDice = result.p1Result?.carryOverDice ?? { base: 0, modifier: 0, wild: 0 };
  return result as ResolveTestResult;
}

export function executeCloseCombatAttack(
  deps: CombatActionDeps,
  attacker: Character,
  defender: Character,
  weapon: Item,
  options: CloseCombatAttackOptions = {}
) {
  if (!deps.battlefield) {
    throw new Error('Battlefield not set.');
  }
  const attackerPos = options.attacker?.position ?? deps.getCharacterPosition(attacker);
  const defenderPos = options.target?.position ?? deps.getCharacterPosition(defender);
  if (!attackerPos || !defenderPos) {
    throw new Error('Missing attacker or defender position.');
  }
  const spatial: CloseCombatContextInput = {
    battlefield: deps.battlefield,
    attacker: {
      id: attacker.id,
      position: attackerPos,
      baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz),
      siz: attacker.finalAttributes.siz,
    },
    target: {
      id: defender.id,
      position: defenderPos,
      baseDiameter: getBaseDiameterFromSiz(defender.finalAttributes.siz),
      siz: defender.finalAttributes.siz,
    },
    moveStart: options.moveStart,
    moveEnd: options.moveEnd,
    movedOverClear: options.movedOverClear,
    wasFreeAtStart: options.wasFreeAtStart,
    imprecisionMu: options.imprecisionMu,
    attackerElevationMu: options.attackerElevationMu,
    targetElevationMu: options.targetElevationMu,
    attackerBaseHeightMu: options.attackerBaseHeightMu,
    targetBaseHeightMu: options.targetBaseHeightMu,
    opposingModels: options.opposingModels,
  };

  const context = buildCloseCombatActionContext(spatial);
  const mergedContext: TestContext = { ...context, ...(options.context ?? {}) };
  mergedContext.isCloseCombat = true;
  if (!attacker.state.isAttentive) {
    mergedContext.isOverreach = false;
    mergedContext.isLeaning = false;
  }
  if (!defender.state.isAttentive) {
    mergedContext.isTargetLeaning = false;
    mergedContext.isDefending = false;
  }
  if (options.defend && defender.state.isAttentive) {
    mergedContext.isDefending = true;
  }

  const handCheck = applyHandRequirementPenalty(attacker, weapon, mergedContext);
  if (handCheck.failed) {
    return {
      result: { hit: false, hitTestResult: { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: {} } },
      context: mergedContext,
      handRequirementFailed: true,
      handRequirementReason: handCheck.reason,
    };
  }

  if (defender.state.isKOd) {
    const allow = canAttackKOdTarget(attacker, defender, {
      enabled: options.allowKOdAttacks ?? false,
      ...(options.kodRules ?? {}),
    });
    if (!allow.allowed) {
      return {
        result: { hit: false, hitTestResult: { pass: false, score: -99, participant1Score: 0, participant2Score: 99, p1Rolls: [], p2Rolls: [], finalPools: {} } },
        context: mergedContext,
        handRequirementFailed: true,
        handRequirementReason: allow.reason,
      };
    }
    const hitTestResult = buildAutoHitResult();
    const damageResolution = resolveKOdDamageIfNeeded(attacker, defender, weapon, hitTestResult, mergedContext, {
      allowKOdAttacks: options.allowKOdAttacks ?? false,
      kodRules: options.kodRules,
      damageBonus: 3,
    });
    if (damageResolution) {
      defender.state.wounds = damageResolution.defenderState.wounds;
      defender.state.delayTokens = damageResolution.defenderState.delayTokens;
      defender.state.isKOd = damageResolution.defenderState.isKOd;
      defender.state.isEliminated = damageResolution.defenderState.isEliminated;
    }
    return {
      result: { hit: true, hitTestResult, damageResolution },
      context: mergedContext,
    };
  }
  
  // Sneaky X: +Xm Suddenness bonus
  const sneakySuddenness = getSneakySuddennessBonus(attacker);
  if (sneakySuddenness > 0 && attacker.state.isHidden) {
    mergedContext.hasSuddenness = true;
    mergedContext.suddennessBonus = (mergedContext.suddennessBonus ?? 0) + sneakySuddenness;
  }
  
  if (attacker.state.isHidden && mergedContext.hasSuddenness !== false) {
    mergedContext.hasSuddenness = true;
  }
  if (defender.state.isHidden && !mergedContext.forceHit) {
    mergedContext.forceMiss = true;
  }
  
  // Unarmed: -1m Hit Test, STR-1m Damage
  if (isUnarmed(attacker)) {
    const unarmedHitPenalty = getUnarmedHitPenalty(attacker);
    if (unarmedHitPenalty < 0) {
      mergedContext.unarmedPenalty = (mergedContext.unarmedPenalty ?? 0) + Math.abs(unarmedHitPenalty);
    }
  }
  
  // Acrobatic X: +X Wild dice Defender Close Combat Tests
  const acrobaticBonus = getAcrobaticBonusDice(defender);
  if (acrobaticBonus > 0) {
    mergedContext.acrobaticBonus = (mergedContext.acrobaticBonus ?? 0) + acrobaticBonus;
  }
  
  if (mergedContext.isCharge && hasItemTrait(defender, 'Awkward')) {
    const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3;
    const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 3;
    if (attackerSiz >= defenderSiz - 3) {
      defender.state.delayTokens += 1;
      defender.refreshStatusFlags();
    }
  }
  const weaponIndex = options.weaponIndex ?? getWeaponIndexForCharacter(attacker, weapon);
  attacker.state.activeWeaponIndex = weaponIndex;
  const hitTestResult = resolveCloseCombatHitTest(attacker, defender, weapon, mergedContext);
  recordWeaponUse(attacker, weaponIndex);
  const forcedMiss = mergedContext.forceMiss && !mergedContext.forceHit;
  const hit = (hitTestResult.score > 0 || mergedContext.forceHit) && !forcedMiss;
  let bonusActionOptions: ReturnType<typeof buildBonusActionOptions> | undefined;
  let bonusActionOutcome: BonusActionOutcome | undefined;
  const allowBonusActions = options.allowBonusActions ?? true;

  // Fight trait: additional bonus actions when Fight level is higher than opponent
  const fightBonusActions = getFightBonusActions(attacker, defender, attacker.state.isAttentive);

  // Brawl trait: allows bonus actions even on failed hit (with Delay token)
  const brawlEligibility = checkBonusActionEligibility(
    attacker,
    defender,
    attacker.state.isAttentive,
    true, // isEngaged
    !hit // failedHitTest
  );

  const attackerModel = deps.buildSpatialModel(attacker);
  const defenderModel = deps.buildSpatialModel(defender);
  const engaged = attackerModel && defenderModel ? SpatialRules.isEngaged(attackerModel, defenderModel) : false;

  if (allowBonusActions) {
    bonusActionOptions = buildBonusActionOptions({
      battlefield: deps.battlefield,
      attacker,
      target: defender,
      cascades: hitTestResult.cascades ?? 0,
      isCloseCombat: true,
      isCharge: mergedContext.isCharge,
      engaged,
      additionalBonusActions: fightBonusActions,
    });

    // Allow bonus action even on failed hit if Brawl trait qualifies.
    const canPerformBonusAction = hit || brawlEligibility.canPerform;
    if (options.bonusAction && canPerformBonusAction) {
      bonusActionOutcome = applyBonusAction(
        {
          battlefield: deps.battlefield,
          attacker,
          target: defender,
          cascades: hitTestResult.cascades ?? 0,
          isCloseCombat: true,
          isCharge: mergedContext.isCharge,
          engaged,
        },
        { ...options.bonusAction, opponents: options.bonusActionOpponents }
      );
      if (bonusActionOutcome.refreshApplied) {
        deps.applyRefresh(attacker);
      }

      // Brawl: acquire Delay token if performing a bonus action on failed hit.
      if (brawlEligibility.requiresDelayToken && !hit && bonusActionOutcome.executed) {
        attacker.state.delayTokens += 1;
        attacker.refreshStatusFlags();
      }
    }
  }

  if (!hit) {
    if (options.defend && defender.state.isAttentive && !bonusActionOutcome?.executed) {
      deps.applyPassiveOptionCost(defender);
    }
    return { hit: false, hitTestResult, context: mergedContext, bonusActionOptions, bonusActionOutcome };
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

  let allowDamage = true;
  const updatedAttacker = deps.buildSpatialModel(attacker);
  const updatedDefender = deps.buildSpatialModel(defender);
  if (updatedAttacker && updatedDefender) {
    allowDamage = SpatialRules.isEngaged(updatedAttacker, updatedDefender);
  }

  let damageResolution: DamageResolution | undefined;
  if (allowDamage) {
    damageResolution = resolveDamage(attacker, defender, weapon, hitTestResult as unknown as ResolveTestResult, mergedContext);
    defender.state.wounds = damageResolution.defenderState.wounds;
    defender.state.delayTokens = damageResolution.defenderState.delayTokens;
    defender.state.isKOd = damageResolution.defenderState.isKOd;
    defender.state.isEliminated = damageResolution.defenderState.isEliminated;
  }

  if (weapon.traits?.includes('[Reveal]')) {
    attacker.state.isHidden = false;
  }
  if (damageResolution) {
    const woundsAdded = damageResolution.woundsAdded + damageResolution.stunWoundsAdded;
    applyFearFromWounds(defender, woundsAdded);
    if (damageResolution.defenderState.isKOd || damageResolution.defenderState.isEliminated) {
      if (deps.battlefield && options.moraleAllies) {
        applyFearFromAllyKO(deps.battlefield, defender, options.moraleAllies, options.moraleOptions);
      }
    }
    deps.applyKOCleanup(defender);
  }

  if (options.defend && defender.state.isAttentive && !bonusActionOutcome?.executed) {
    deps.applyPassiveOptionCost(defender);
  }

  return {
    hit: true,
    hitTestResult,
    damageResolution,
    bonusActionOptions,
    bonusActionOutcome,
    context: mergedContext,
  };
}
