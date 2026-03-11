import type { Character } from '../../core/Character';
import type { Battlefield } from '../../battlefield/Battlefield';
import type { Position } from '../../battlefield/Position';
import type { AIContext, AIControllerConfig } from './AIController';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import { evaluateRangeWithVisibility, parseWeaponOptimalRangeMu } from '../../utils/visibility';
import { getLeapAgilityBonus, getSprintMovementBonus } from '../../traits/combat-traits';
import { getRangedThreatWeapons } from '../shared/ThreatProfileSupport';

export interface ChargeOpportunityResult {
  canCharge: boolean;
  destination?: Position;
  travelDistance: number;
  remainingGap: number;
}

export interface RangedOpportunityResult {
  canAttack: boolean;
  requiresConcentrate: boolean;
  orm: number;
  leanOpportunity: boolean;
}

export function isRangedTargetInRange(
  from: Character,
  to: Character,
  battlefield: Battlefield,
  config: AIControllerConfig,
  hasLOS: (from: Character, to: Character, battlefield: Battlefield) => boolean
): boolean {
  const fromPos = battlefield.getCharacterPosition(from);
  const toPos = battlefield.getCharacterPosition(to);
  if (!fromPos || !toPos) return false;

  if (config.perCharacterFovLos && !hasLOS(from, to, battlefield)) {
    return false;
  }

  const dist = Math.hypot(fromPos.x - toPos.x, fromPos.y - toPos.y);
  const weapons = getRangedThreatWeapons(from);
  for (const weapon of weapons) {
    const weaponOr = parseWeaponOptimalRangeMu(from, weapon);
    const range = evaluateRangeWithVisibility(dist, weaponOr, {
      visibilityOrMu: config.visibilityOrMu,
      maxOrm: config.maxOrm,
      allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
    });
    if (range.inRange) return true;
  }
  return false;
}

function canLeanFromCover(attacker: Character, target: Character, battlefield: Battlefield): boolean {
  const attackerPos = battlefield.getCharacterPosition(attacker);
  const targetPos = battlefield.getCharacterPosition(target);
  if (!attackerPos || !targetPos) return false;

  const attackerModel = {
    id: attacker.id,
    position: attackerPos,
    baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3),
    siz: attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3,
  };
  const targetModel = {
    id: target.id,
    position: targetPos,
    baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3),
    siz: target.finalAttributes.siz ?? target.attributes.siz ?? 3,
  };
  const coverFromTarget = SpatialRules.getCoverResult(battlefield, targetModel, attackerModel);
  return coverFromTarget.hasLOS && (coverFromTarget.hasDirectCover || coverFromTarget.hasInterveningCover);
}

export function estimateChargeMovementAllowance(context: AIContext): number {
  const character = context.character;
  const baseMov = character.finalAttributes.mov ?? character.attributes.mov ?? 2;
  const sprintBonus = getSprintMovementBonus(
    character,
    true,
    Boolean(character.state.isAttentive),
    !Boolean(context.battlefield.isEngaged?.(character))
  );
  const leapBonus = getLeapAgilityBonus(character);
  return Math.max(0, baseMov + 2 + sprintBonus + leapBonus);
}

export function evaluateChargeOpportunity(
  context: AIContext,
  target: Character
): ChargeOpportunityResult {
  const actorPos = context.battlefield.getCharacterPosition(context.character);
  const targetPos = context.battlefield.getCharacterPosition(target);
  if (!actorPos || !targetPos) {
    return { canCharge: false, travelDistance: 0, remainingGap: Number.POSITIVE_INFINITY };
  }
  if (context.battlefield.isEngaged?.(context.character)) {
    return { canCharge: false, travelDistance: 0, remainingGap: Number.POSITIVE_INFINITY };
  }

  const actorBase = getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3);
  const targetBase = getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3);
  const dx = targetPos.x - actorPos.x;
  const dy = targetPos.y - actorPos.y;
  const centerDistance = Math.hypot(dx, dy);
  if (!Number.isFinite(centerDistance) || centerDistance <= 1e-6) {
    return { canCharge: false, travelDistance: 0, remainingGap: Number.POSITIVE_INFINITY };
  }

  const desiredCenterDistance = (actorBase + targetBase) / 2;
  const travelDistance = Math.max(0, centerDistance - desiredCenterDistance);
  if (travelDistance <= 0.05) {
    return { canCharge: false, travelDistance: 0, remainingGap: 0 };
  }

  const movementAllowance = estimateChargeMovementAllowance(context);
  if (travelDistance > movementAllowance + 0.25) {
    return {
      canCharge: false,
      travelDistance,
      remainingGap: Math.max(0, travelDistance - movementAllowance),
    };
  }

  const invDistance = 1 / centerDistance;
  const destination: Position = {
    x: targetPos.x - (dx * invDistance * desiredCenterDistance),
    y: targetPos.y - (dy * invDistance * desiredCenterDistance),
  };
  if (context.battlefield.isWithinBounds && !context.battlefield.isWithinBounds(destination, actorBase)) {
    return {
      canCharge: false,
      travelDistance,
      remainingGap: Math.max(0, travelDistance - movementAllowance),
    };
  }
  for (const model of [...context.allies, ...context.enemies]) {
    if (
      model.id === context.character.id ||
      model.id === target.id ||
      model.state.isKOd ||
      model.state.isEliminated
    ) {
      continue;
    }
    const modelPos = context.battlefield.getCharacterPosition(model);
    if (!modelPos) continue;
    const modelBase = getBaseDiameterFromSiz(model.finalAttributes.siz ?? model.attributes.siz ?? 3);
    const separation = Math.hypot(destination.x - modelPos.x, destination.y - modelPos.y);
    const minSeparation = ((actorBase + modelBase) / 2) - 1e-6;
    if (separation < minSeparation) {
      return {
        canCharge: false,
        travelDistance,
        remainingGap: Math.max(0, travelDistance - movementAllowance),
      };
    }
  }

  return { canCharge: true, destination, travelDistance, remainingGap: 0 };
}

export function evaluateRangedOpportunity(
  context: AIContext,
  target: Character,
  hasLOS: (from: Character, to: Character, battlefield: Battlefield) => boolean
): RangedOpportunityResult {
  const attackerPos = context.battlefield.getCharacterPosition(context.character);
  const targetPos = context.battlefield.getCharacterPosition(target);
  if (!attackerPos || !targetPos) {
    return { canAttack: false, requiresConcentrate: false, orm: 0, leanOpportunity: false };
  }
  if (context.config.perCharacterFovLos && !hasLOS(context.character, target, context.battlefield)) {
    return { canAttack: false, requiresConcentrate: false, orm: 0, leanOpportunity: false };
  }

  const distance = Math.hypot(attackerPos.x - targetPos.x, attackerPos.y - targetPos.y);
  const weapons = getRangedThreatWeapons(context.character);
  const leanOpportunity = canLeanFromCover(context.character, target, context.battlefield);

  for (const weapon of weapons) {
    const weaponOr = parseWeaponOptimalRangeMu(context.character, weapon);
    const range = evaluateRangeWithVisibility(distance, weaponOr, {
      visibilityOrMu: context.config.visibilityOrMu,
      maxOrm: context.config.maxOrm,
      allowConcentrateRangeExtension: context.config.allowConcentrateRangeExtension,
    });
    if (!range.inRange) continue;
    if (range.requiresConcentrate && context.apRemaining < 2) continue;
    return {
      canAttack: true,
      requiresConcentrate: range.requiresConcentrate,
      orm: range.requiresConcentrate ? range.concentratedOrm : range.orm,
      leanOpportunity,
    };
  }

  return { canAttack: false, requiresConcentrate: false, orm: 0, leanOpportunity: false };
}
