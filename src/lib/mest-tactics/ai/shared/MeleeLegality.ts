import { Battlefield } from '../../battlefield/Battlefield';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import { Item } from '../../core/Item';
import { Character } from '../../core/Character';
import { validateItemUsage } from '../../actions/hand-requirements';
import { canUseOverreach, getReachExtension } from '../../traits/combat-traits';

const RANGE_EPSILON = 1e-6;

export interface MeleeLegalityOptions {
  allowOverreach?: boolean;
  isFirstAction?: boolean;
  isFreeAtStart?: boolean;
}

export interface MeleeLegalityAssessment {
  canAttack: boolean;
  baseContact: boolean;
  withinReach: boolean;
  withinOverreach: boolean;
  requiresReach: boolean;
  requiresOverreach: boolean;
  canUseOverreach: boolean;
  edgeDistanceMu: number;
  reachBonusMu: number;
  overreachBonusMu: number;
}

export interface BestMeleeLegalityAssessment extends MeleeLegalityAssessment {
  weapon?: Item;
}

function traitText(trait: string): string {
  return String(trait ?? '').toLowerCase().replace(/\[|\]/g, '').trim();
}

function hasWeaponTrait(weapon: Item | undefined, needle: string): boolean {
  if (!weapon || !Array.isArray(weapon.traits)) return false;
  const normalizedNeedle = traitText(needle);
  return weapon.traits.some(trait => traitText(trait).includes(normalizedNeedle));
}

function isNaturalWeapon(weapon: Item | undefined): boolean {
  if (!weapon) return false;
  const classification = `${weapon.classification ?? ''} ${weapon.class ?? ''} ${weapon.type ?? ''}`.toLowerCase();
  return classification.includes('natural') || hasWeaponTrait(weapon, 'natural');
}

function getWeaponReachExtension(weapon: Item | undefined): number {
  if (!weapon || !Array.isArray(weapon.traits)) return 0;
  let maxReach = 0;
  for (const trait of weapon.traits) {
    const normalized = traitText(trait);
    const match = normalized.match(/\breach(?:\s+(\d+))?\b/);
    if (!match) continue;
    const level = Number.parseInt(match[1] ?? '1', 10);
    if (Number.isFinite(level) && level > maxReach) {
      maxReach = level;
    }
  }
  return maxReach;
}

function buildSpatialModel(character: Character, battlefield: Battlefield) {
  const position = battlefield.getCharacterPosition(character);
  if (!position) return null;
  const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
  return {
    id: character.id,
    position,
    baseDiameter: getBaseDiameterFromSiz(siz),
    siz,
    isPanicked: character.state?.isPanicked ?? false,
  };
}

function canDeclareOverreach(
  attacker: Character,
  weapon: Item | undefined,
  options: MeleeLegalityOptions
): boolean {
  if (!weapon) return false;
  if (options.allowOverreach === false) return false;
  if (options.isFirstAction === false) return false;
  if (options.isFreeAtStart === false) return false;
  if (!attacker.state.isAttentive) return false;
  if (!canUseOverreach(attacker)) return false;
  if (isNaturalWeapon(weapon)) return false;
  if (hasWeaponTrait(weapon, 'stub')) return false;

  const handValidation = validateItemUsage(attacker, weapon, {
    allowOneLessHand: true,
    isOverreach: true,
  });
  if (!handValidation.canUse) return false;
  if (handValidation.overreachDisallowed) return false;

  return true;
}

export function getMeleeWeaponsForLegality(character: Character): Item[] {
  const rawItems = [
    ...(character.profile?.items ?? []),
    ...(character.profile?.equipment ?? []),
    ...(character.profile?.inHandItems ?? []),
    ...(character.profile?.stowedItems ?? []),
  ];
  const seen = new Set<Item>();
  const melee: Item[] = [];
  for (const item of rawItems) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    const classification = `${item.classification ?? item.class ?? ''}`.toLowerCase();
    if (classification.includes('melee') || classification.includes('natural')) {
      melee.push(item);
    }
  }
  return melee;
}

export function assessMeleeLegalityForWeapon(
  attacker: Character,
  target: Character,
  battlefield: Battlefield,
  weapon: Item | undefined,
  options: MeleeLegalityOptions = {}
): MeleeLegalityAssessment {
  const attackerModel = buildSpatialModel(attacker, battlefield);
  const targetModel = buildSpatialModel(target, battlefield);
  if (!attackerModel || !targetModel) {
    return {
      canAttack: false,
      baseContact: false,
      withinReach: false,
      withinOverreach: false,
      requiresReach: false,
      requiresOverreach: false,
      canUseOverreach: false,
      edgeDistanceMu: Number.POSITIVE_INFINITY,
      reachBonusMu: 0,
      overreachBonusMu: 0,
    };
  }

  const edgeDistanceMu = SpatialRules.distanceEdgeToEdge(attackerModel, targetModel);
  const baseContact = SpatialRules.isEngaged(attackerModel, targetModel);
  const reachBonusMu = Math.max(0, getReachExtension(attacker) + getWeaponReachExtension(weapon));
  const withinReach = baseContact || edgeDistanceMu <= reachBonusMu + RANGE_EPSILON;

  const canUseOverreachNow = canDeclareOverreach(attacker, weapon, options);
  const overreachBonusMu = canUseOverreachNow ? 1 : 0;
  const withinOverreach = baseContact || edgeDistanceMu <= (reachBonusMu + overreachBonusMu + RANGE_EPSILON);
  const canAttack = baseContact || withinReach || (canUseOverreachNow && withinOverreach);
  const requiresReach = canAttack && !baseContact && edgeDistanceMu <= reachBonusMu + RANGE_EPSILON;
  const requiresOverreach = canAttack && !baseContact && !requiresReach && canUseOverreachNow;

  return {
    canAttack,
    baseContact,
    withinReach,
    withinOverreach,
    requiresReach,
    requiresOverreach,
    canUseOverreach: canUseOverreachNow,
    edgeDistanceMu,
    reachBonusMu,
    overreachBonusMu,
  };
}

export function assessBestMeleeLegality(
  attacker: Character,
  target: Character,
  battlefield: Battlefield,
  options: MeleeLegalityOptions & { weapons?: Item[] } = {}
): BestMeleeLegalityAssessment {
  const weapons = options.weapons && options.weapons.length > 0
    ? options.weapons
    : getMeleeWeaponsForLegality(attacker);
  if (weapons.length === 0) {
    return {
      ...assessMeleeLegalityForWeapon(attacker, target, battlefield, undefined, options),
      weapon: undefined,
    };
  }

  let best: BestMeleeLegalityAssessment | null = null;
  for (const weapon of weapons) {
    const assessment = assessMeleeLegalityForWeapon(attacker, target, battlefield, weapon, options);
    const candidate: BestMeleeLegalityAssessment = {
      ...assessment,
      weapon,
    };
    if (!best) {
      best = candidate;
      continue;
    }

    const candidateRange = candidate.reachBonusMu + candidate.overreachBonusMu;
    const bestRange = best.reachBonusMu + best.overreachBonusMu;
    const candidateTuple = [
      candidate.canAttack ? 1 : 0,
      candidate.requiresOverreach ? 0 : 1,
      candidate.requiresReach ? 1 : 0,
      candidateRange,
    ];
    const bestTuple = [
      best.canAttack ? 1 : 0,
      best.requiresOverreach ? 0 : 1,
      best.requiresReach ? 1 : 0,
      bestRange,
    ];
    let isBetter = false;
    for (let i = 0; i < candidateTuple.length; i++) {
      if (candidateTuple[i] > bestTuple[i]) {
        isBetter = true;
        break;
      }
      if (candidateTuple[i] < bestTuple[i]) {
        isBetter = false;
        break;
      }
    }
    if (isBetter) {
      best = candidate;
    }
  }

  if (!best) {
    const fallbackWeapon = weapons[0];
    return {
      ...assessMeleeLegalityForWeapon(attacker, target, battlefield, fallbackWeapon, options),
      weapon: fallbackWeapon,
    };
  }
  return best;
}
