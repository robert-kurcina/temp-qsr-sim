import { Character } from './Character';
import { gameData } from '../data';
import { ResolveTestResult, resolveTest, TestParticipant, TestDice, DiceType } from './dice-roller';
import { Battlefield } from './battlefield/Battlefield';
import { Position } from './battlefield/Position';
import { SpatialRules, SpatialModel } from './battlefield/spatial-rules';
import { getBaseDiameterFromSiz } from './battlefield/size-utils';
import { parseTrait } from './trait-parser';
import type { Item } from './Item';

export interface StatusDefinition {
  name: string;
  sourceTrait?: string;
}

const STATUS_SUFFIXED = new Set(['Poison', 'Burn', 'Acid', 'Confused', 'Transfixed']);

function normalizeStatusName(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function toStatusFromVerb(verb: string): string {
  const base = normalizeStatusName(verb);
  if (STATUS_SUFFIXED.has(base)) return base;
  if (base.endsWith('e')) return `${base}d`;
  return `${base}ed`;
}

function extractStatusTypesFromTraits(): StatusDefinition[] {
  const definitions: StatusDefinition[] = [];
  const seen = new Set<string>();
  const traitDescriptions = gameData.trait_descriptions as Record<string, { description?: string }>;

  for (const [traitName, detail] of Object.entries(traitDescriptions)) {
    const description = detail.description ?? '';
    const statusMatches = description.match(/([A-Za-z]+) token/g);
    if (statusMatches) {
      for (const match of statusMatches) {
        const tokenName = normalizeStatusName(match.replace(' token', ''));
        if (!seen.has(tokenName)) {
          seen.add(tokenName);
          definitions.push({ name: tokenName, sourceTrait: traitName });
        }
      }
    }

    const traitVerbMatch = traitName.match(/^([A-Za-z]+)\s+X$/);
    if (traitVerbMatch) {
      const verb = traitVerbMatch[1];
      const statusName = toStatusFromVerb(verb);
      if (!seen.has(statusName)) {
        seen.add(statusName);
        definitions.push({ name: statusName, sourceTrait: traitName });
      }
    }
  }

  return definitions;
}

let cachedDefinitions: StatusDefinition[] | null = null;

export function getStatusDefinitions(): StatusDefinition[] {
  if (!cachedDefinitions) {
    cachedDefinitions = extractStatusTypesFromTraits();
  }
  return cachedDefinitions;
}

export function addStatusToken(character: Character, status: string, count = 1): void {
  const name = normalizeStatusName(status);
  if (!character.state.statusTokens[name]) {
    character.state.statusTokens[name] = 0;
  }
  character.state.statusTokens[name] += Math.max(0, count);
}

export function removeStatusToken(character: Character, status: string, count = 1): void {
  const name = normalizeStatusName(status);
  if (!character.state.statusTokens[name]) return;
  character.state.statusTokens[name] = Math.max(0, character.state.statusTokens[name] - Math.max(0, count));
  if (character.state.statusTokens[name] === 0) {
    delete character.state.statusTokens[name];
  }
}

export function getStatusTokenCount(character: Character, status: string): number {
  const name = normalizeStatusName(status);
  return character.state.statusTokens[name] ?? 0;
}

export function applyStatusFromTrait(
  character: Character,
  traitName: string,
  cascades: number,
  options: { baseTokens?: number; perCascades?: number } = {}
): string | null {
  const match = traitName.match(/^([A-Za-z]+)\s+X$/);
  if (!match) return null;
  const verb = match[1];
  const status = toStatusFromVerb(verb);
  const baseTokens = options.baseTokens ?? 1;
  const perCascades = options.perCascades ?? 3;
  const extra = perCascades > 0 ? Math.floor(Math.max(0, cascades) / perCascades) : 0;
  const total = baseTokens + extra;
  addStatusToken(character, status, total);
  return status;
}

export interface StatusTraitResolution {
  applied: boolean;
  status?: string;
  testResult?: ResolveTestResult;
}

export function getCharacterTraitLevel(character: Character, traitName: string): number {
  const nameLower = traitName.toLowerCase();
  const traitPool: string[] = [];
  if (character.profile?.finalTraits) traitPool.push(...character.profile.finalTraits);
  if (character.profile?.allTraits) traitPool.push(...character.profile.allTraits);
  if (character.allTraits?.length) {
    for (const trait of character.allTraits) {
      if (trait?.name) traitPool.push(trait.source ?? trait.name);
    }
  }

  let best = 0;
  for (const raw of traitPool) {
    if (!raw) continue;
    const parsed = parseTrait(raw);
    if (parsed.name.toLowerCase() !== nameLower) continue;
    const level = parsed.level ?? 1;
    if (level > best) best = level;
  }
  return best;
}

function getNaturalPoisonRating(character: Character): number {
  const items: Item[] = [];
  if (character.profile?.equipment) items.push(...character.profile.equipment);
  if (character.profile?.items) items.push(...character.profile.items);
  if (character.profile?.inHandItems) items.push(...character.profile.inHandItems);
  if (character.profile?.stowedItems) items.push(...character.profile.stowedItems);

  let best = 0;
  for (const item of items) {
    if (!item) continue;
    const classification = (item.classification || item.class || '').toLowerCase();
    if (!classification.includes('natural')) continue;
    for (const trait of item.traits || []) {
      const parsed = parseTrait(trait);
      if (parsed.name.toLowerCase() !== 'poison') continue;
      const level = parsed.level ?? 1;
      if (level > best) best = level;
    }
  }
  return best;
}

export function applyStatusTraitOnHit(
  defender: Character,
  traitName: string,
  options: {
    cascades?: number;
    rating?: number;
    testRolls?: number[] | null;
    impact?: number;
    effectiveArmor?: number;
  } = {}
): StatusTraitResolution {
  if (traitName === 'Confuse X') {
    const attributeValue = Math.max(defender.finalAttributes.int, defender.finalAttributes.pow);
    const participant: TestParticipant = { attributeValue };
    const systemPlayer: TestParticipant = { isSystemPlayer: true };
    const result = resolveTest(participant, systemPlayer, options.testRolls ?? null);
    if (!result.pass) {
      return { applied: false, testResult: result };
    }
    const rating = options.rating ?? 1;
    const status = applyStatusFromTrait(defender, traitName, rating);
    return { applied: Boolean(status), status: status ?? undefined, testResult: result };
  }

  const rating = Math.max(1, options.rating ?? 1);
  const cascades = options.cascades ?? 0;
  const impact = options.impact ?? 0;
  const armorTotal = defender.state.armor?.total ?? 0;
  const effectiveArmor = options.effectiveArmor ?? (armorTotal - impact);
  const siz = Math.max(1, defender.finalAttributes.siz ?? defender.attributes.siz ?? 1);
  const fortitude = Math.max(1, defender.finalAttributes.for ?? defender.attributes.for ?? 1);

  if (traitName === 'Burn X') {
    const tokens = Math.max(1, Math.floor(rating / siz));
    const status = applyStatusFromTrait(defender, traitName, 0, { baseTokens: tokens, perCascades: 0 });
    return { applied: Boolean(status), status: status ?? undefined };
  }

  if (traitName === 'Acid X') {
    if (effectiveArmor > 0) {
      return { applied: false };
    }
    const tokens = 1 + Math.floor(rating / siz);
    const status = applyStatusFromTrait(defender, traitName, 0, { baseTokens: tokens, perCascades: 0 });
    return { applied: Boolean(status), status: status ?? undefined };
  }

  if (traitName === 'Poison X') {
    if (effectiveArmor > 0) {
      return { applied: false };
    }
    const naturalPoison = getNaturalPoisonRating(defender);
    const reduction = Math.min(rating, naturalPoison);
    const effectiveRating = Math.max(0, rating - reduction);
    if (effectiveRating <= 0) {
      return { applied: false };
    }
    const tokens = Math.max(1, Math.floor(effectiveRating / fortitude));
    const status = applyStatusFromTrait(defender, traitName, 0, { baseTokens: tokens, perCascades: 0 });
    return { applied: Boolean(status), status: status ?? undefined };
  }

  const status = applyStatusFromTrait(defender, traitName, cascades);
  return { applied: Boolean(status), status: status ?? undefined };
}

export interface TransfixTarget {
  character: Character;
  position: Position;
  baseDiameter?: number;
}

export interface TransfixResult {
  targetId: string;
  inRange: boolean;
  hasLOS: boolean;
  effectiveX: number;
  misses: number;
}

export function resolveTransfixEffect(
  battlefield: Battlefield,
  source: SpatialModel & { character: Character },
  targets: TransfixTarget[],
  options: { rating?: number; testRolls?: Record<string, number[]> } = {}
): TransfixResult[] {
  const rating = Math.max(0, options.rating ?? getCharacterTraitLevel(source.character, 'Transfix'));
  if (rating <= 0) return [];

  const results: TransfixResult[] = [];
  const sourceBase = source.baseDiameter ?? getBaseDiameterFromSiz(source.siz ?? source.character.finalAttributes.siz ?? 3);
  const sourceModel: SpatialModel = {
    id: source.id,
    position: source.position,
    baseDiameter: sourceBase,
    siz: source.siz ?? source.character.finalAttributes.siz,
  };

  for (const target of targets) {
    const targetBase = target.baseDiameter ?? getBaseDiameterFromSiz(target.character.finalAttributes.siz ?? 3);
    const targetModel: SpatialModel = {
      id: target.character.id,
      position: target.position,
      baseDiameter: targetBase,
      siz: target.character.finalAttributes.siz,
    };

    const distance = SpatialRules.distanceEdgeToEdge(sourceModel, targetModel);
    const beyondBase = Math.max(0, distance - sourceBase);
    let effectiveX = rating - Math.floor(beyondBase);
    if (effectiveX <= 0) {
      results.push({
        targetId: target.character.id,
        inRange: false,
        hasLOS: false,
        effectiveX: 0,
        misses: 0,
      });
      continue;
    }

    const targetTransfix = getCharacterTraitLevel(target.character, 'Transfix');
    if (targetTransfix > 0) {
      const reduction = Math.min(rating, targetTransfix);
      effectiveX = Math.max(0, effectiveX - reduction);
    }

    if (effectiveX <= 0) {
      results.push({
        targetId: target.character.id,
        inRange: false,
        hasLOS: false,
        effectiveX: 0,
        misses: 0,
      });
      continue;
    }

    const hasLOS = SpatialRules.hasLineOfSight(battlefield, sourceModel, targetModel);
    if (!hasLOS) {
      results.push({
        targetId: target.character.id,
        inRange: true,
        hasLOS: false,
        effectiveX,
        misses: 0,
      });
      continue;
    }

    const penaltyDice: TestDice = { [DiceType.Modifier]: effectiveX };
    const participant: TestParticipant = {
      attributeValue: target.character.finalAttributes.int ?? 0,
      penaltyDice,
    };
    const systemPlayer: TestParticipant = { isSystemPlayer: true };
    const testRolls = options.testRolls?.[target.character.id] ?? null;
    const result = resolveTest(participant, systemPlayer, testRolls);
    const misses = Math.max(0, result.p2FinalScore - result.p1FinalScore);
    if (misses > 0) {
      addStatusToken(target.character, 'Transfixed', misses);
    }

    results.push({
      targetId: target.character.id,
      inRange: true,
      hasLOS: true,
      effectiveX,
      misses,
    });
  }

  return results;
}

export function parseStatusTrait(trait: string): { traitName: string; rating: number } | null {
  const cleaned = trait.replace(/[\[\]]/g, '').trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/\s+/);
  if (parts.length === 0) return null;
  const verb = parts[0];
  const statusName = toStatusFromVerb(verb);
  const definitions = getStatusDefinitions();
  if (!definitions.some(def => def.name === statusName)) {
    return null;
  }
  const rating = parts.length > 1 ? Number(parts[1]) : 1;
  if (!Number.isFinite(rating) || rating <= 0) {
    return { traitName: `${verb} X`, rating: 1 };
  }
  return { traitName: `${verb} X`, rating };
}
