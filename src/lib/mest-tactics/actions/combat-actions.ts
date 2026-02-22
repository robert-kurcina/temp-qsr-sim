import { Character } from '../core/Character';
import { Item } from '../core/Item';
import { Position } from '../battlefield/Position';
import { ActionContextInput, CloseCombatContextInput, buildCloseCombatActionContext, buildRangedActionContext, resolveFriendlyFire } from '../battlefield/validation/action-context';
import { SpatialRules, SpatialModel } from '../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { TestContext } from '../TestContext';
import { ResolveTestResult } from '../dice-roller';
import { resolveRangedCombatHitTest } from '../combat/ranged-combat';
import { resolveCloseCombatHitTest } from '../combat/close-combat';
import { DamageResolution, resolveDamage } from '../subroutines/damage-test';
import { BonusActionOutcome, BonusActionSelection, applyBonusAction, buildBonusActionOptions } from './bonus-actions';
import { parseStatusTrait, applyStatusTraitOnHit } from '../status/status-system';
import { MoraleOptions, applyFearFromAllyKO, applyFearFromWounds } from '../status/morale';
import { makeIndirectRangedAttack } from '../combat/indirect-ranged-combat';
import { LOSOperations } from '../battlefield/los/LOSOperations';
import { hasItemTrait } from '../traits/item-traits';
import {
  getFightBonusActions,
  getBrawlLevel,
  checkBonusActionEligibility,
  hasReload,
  getReloadActionsRequired,
  getSneakyLevel,
  checkSneakyAutoHide,
  getSneakySuddennessBonus,
  isUnarmed,
  getUnarmedHitPenalty,
  getUnarmedDamagePenalty,
  getAcrobaticBonusDice,
} from '../traits/combat-traits';

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
}

export interface CloseCombatAttackOptions extends Partial<CloseCombatContextInput> {
  context?: TestContext;
  moraleAllies?: Character[];
  moraleOptions?: MoraleOptions;
  defend?: boolean;
  allowBonusActions?: boolean;
  bonusAction?: BonusActionSelection;
  bonusActionOpponents?: Character[];
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

  const { hitTestResult, context: resolvedContext } = resolveRangedCombatHitTest(
    attacker,
    defender,
    weapon,
    options.orm ?? 0,
    mergedContext,
    spatial
  );

  if (!hitTestResult.pass) {
    if (options.defend && defender.state.isAttentive) {
      deps.applyPassiveOptionCost(defender);
    }
    return {
      result: { hit: false, hitTestResult },
      context: resolvedContext,
      friendlyFire,
      takeCover: takeCoverResult,
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
  };
}

export function executeIndirectAttack(
  deps: CombatActionDeps,
  attacker: Character,
  weapon: Item,
  orm: number,
  options: Partial<ActionContextInput> & { context?: TestContext; targetCharacter?: Character } = {}
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
  const mergedContext: TestContext = { ...context, ...(options.context ?? {}) };
  return makeIndirectRangedAttack(attacker, weapon, orm, mergedContext, null, spatial, options.targetCharacter);
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
  const hitTestResult = resolveCloseCombatHitTest(attacker, defender, weapon, mergedContext);
  const forcedMiss = mergedContext.forceMiss && !mergedContext.forceHit;
  const hit = (hitTestResult.score > 0 || mergedContext.forceHit) && !forcedMiss;
  if (!hit) {
    if (options.defend && defender.state.isAttentive) {
      deps.applyPassiveOptionCost(defender);
    }
    return { hit: false, hitTestResult };
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
  
  // Fight trait: additional bonus actions when Fight level is higher than opponent
  const fightBonusActions = getFightBonusActions(attacker, defender, attacker.state.isAttentive);
  
  // Brawl trait: allows bonus actions even on failed hit (with Delay token)
  const brawlLevel = getBrawlLevel(attacker);
  const brawlEligibility = checkBonusActionEligibility(
    attacker,
    defender,
    attacker.state.isAttentive,
    true, // isEngaged
    !hit // failedHitTest
  );
  
  if (allowBonusActions) {
    const attackerModel = deps.buildSpatialModel(attacker);
    const defenderModel = deps.buildSpatialModel(defender);
    const engaged = attackerModel && defenderModel ? SpatialRules.isEngaged(attackerModel, defenderModel) : false;
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
    
    // Allow bonus action even on failed hit if Brawl trait qualifies
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
      
      // Brawl: acquire Delay token if performing bonus action on failed hit
      if (brawlEligibility.requiresDelayToken && !hit) {
        attacker.state.delayTokens += 1;
        attacker.refreshStatusFlags();
      }
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
  };
}
