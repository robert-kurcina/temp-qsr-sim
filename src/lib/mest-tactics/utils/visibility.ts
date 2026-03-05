import { Character } from '../core/Character';
import { Item } from '../core/Item';
import { parseOptimalRange } from '../subroutines/optimal-range-parser';

export type LightingCondition = 'Day, Clear' | 'Day, Rain/Fog' | 'Twilight, Overcast' | 'Night';

// Backward compatibility - LightingCondition can be either a string or an object
export type LightingConditionLike = LightingCondition | LightingConditionObject;

// Backward compatibility interface for object-style lighting config
export interface LightingConditionObject {
  name: LightingCondition;
  visibilityOR: number;
}

// Helper function to get visibility OR from either string or object
export function getVisibilityOR(lighting: LightingConditionLike): number {
  if (typeof lighting === 'string') {
    return getVisibilityOrForLighting(lighting);
  }
  return lighting.visibilityOR;
}

// Helper function to get name from either string or object
export function getLightingName(lighting: LightingConditionLike): LightingCondition {
  if (typeof lighting === 'string') {
    return lighting;
  }
  return lighting.name;
}

export interface VisibilityConfig {
  visibilityOrMu: number;
  maxOrm: number;
  allowConcentrateRangeExtension: boolean;
}

export interface RangeCheckResult {
  inRange: boolean;
  requiresConcentrate: boolean;
  orm: number;
  effectiveOrMu: number;
  concentratedOrm: number;
  concentratedOrMu: number;
}

const LIGHTING_TO_VISIBILITY_OR: Record<LightingCondition, number> = {
  'Day, Clear': 16,
  'Day, Rain/Fog': 8,
  'Twilight, Overcast': 8,
  Night: 4,
};

export function getVisibilityOrForLighting(lighting: LightingCondition): number {
  return LIGHTING_TO_VISIBILITY_OR[lighting];
}

export function resolveVisibilityConfig(input: Partial<VisibilityConfig> = {}): VisibilityConfig {
  return {
    visibilityOrMu: Math.max(0.5, input.visibilityOrMu ?? 16),
    maxOrm: Math.max(0, Math.floor(input.maxOrm ?? 3)),
    allowConcentrateRangeExtension: input.allowConcentrateRangeExtension ?? true,
  };
}

export function evaluateWeaponOrExpressionMu(attacker: Character, rawOr: Item['or']): number | null {
  if (rawOr === undefined || rawOr === null) return null;
  if (typeof rawOr === 'number' && Number.isFinite(rawOr)) return rawOr;
  if (typeof rawOr !== 'string') return null;

  const trimmed = rawOr.trim();
  if (!trimmed || trimmed === '-') return null;

  if (/^OR\(/i.test(trimmed)) {
    const parsed = parseOptimalRange(trimmed, attacker.finalAttributes);
    if (Number.isFinite(parsed)) return parsed;
  }

  const compact = trimmed.replace(/\s+/g, '');
  if (/^[+\-]?\d+(\.\d+)?$/.test(compact)) {
    return Number(compact);
  }

  const expressionMatch = compact.match(/[A-Za-z]+|\d+(?:\.\d+)?|[+\-]/g);
  if (!expressionMatch) return null;

  let total = 0;
  let op: '+' | '-' = '+';
  for (const token of expressionMatch) {
    if (token === '+' || token === '-') {
      op = token;
      continue;
    }
    const lower = token.toLowerCase();
    let value = Number.NaN;
    if (/^\d+(\.\d+)?$/.test(token)) {
      value = Number(token);
    } else {
      value = resolveAttributeToken(attacker, lower);
    }
    if (!Number.isFinite(value)) continue;
    total = op === '+' ? total + value : total - value;
  }
  return total;
}

export function parseWeaponOptimalRangeMu(attacker: Character, weapon?: Item): number {
  if (!weapon) return 0;
  const rawOr = weapon.or;

  const explicitOrMu = evaluateWeaponOrExpressionMu(attacker, rawOr);
  if (explicitOrMu !== null && explicitOrMu > 0) {
    return explicitOrMu;
  }

  return inferThrownRange(attacker, weapon);
}

export function calculateOrm(distanceMu: number, optimalRangeMu: number): number {
  if (!Number.isFinite(distanceMu) || distanceMu <= 0 || optimalRangeMu <= 0) {
    return 0;
  }
  return Math.max(0, Math.ceil(distanceMu / optimalRangeMu) - 1);
}

export function evaluateRangeWithVisibility(
  distanceMu: number,
  weaponOrMu: number,
  config: Partial<VisibilityConfig> = {}
): RangeCheckResult {
  const resolved = resolveVisibilityConfig(config);
  const effectiveOrMu = weaponOrMu > 0
    ? Math.min(weaponOrMu, resolved.visibilityOrMu)
    : 0;
  const orm = calculateOrm(distanceMu, effectiveOrMu);
  const normalInRange = effectiveOrMu > 0 && orm <= resolved.maxOrm;

  // Concentrate uses "maximum OR": doubled OR distance cap, without normal ORM cap.
  const concentratedOrMu = effectiveOrMu > 0 ? effectiveOrMu * 2 : 0;
  const concentratedOrm = calculateOrm(distanceMu, concentratedOrMu);
  const concentrateInRange =
    resolved.allowConcentrateRangeExtension &&
    concentratedOrMu > 0 &&
    distanceMu <= concentratedOrMu + 1e-6;

  return {
    inRange: normalInRange || concentrateInRange,
    requiresConcentrate: !normalInRange && concentrateInRange,
    orm,
    effectiveOrMu,
    concentratedOrm,
    concentratedOrMu,
  };
}

function inferThrownRange(attacker: Character, weapon: Item): number {
  const classification = String(weapon.classification ?? weapon.class ?? '').toLowerCase();
  const traits = (weapon.traits ?? []).map(trait => trait.toLowerCase());
  const hasThrowable = traits.some(trait => trait.includes('throwable'));
  const thrownClass =
    classification.includes('thrown') ||
    ((classification.includes('melee') || classification.includes('natural')) && hasThrowable);
  if (!thrownClass) return 0;
  return Math.max(0.5, attacker.finalAttributes.str ?? attacker.attributes.str ?? 0);
}

function resolveAttributeToken(character: Character, token: string): number {
  switch (token) {
    case 'str':
      return character.finalAttributes.str ?? character.attributes.str ?? 0;
    case 'agi':
      return (character.finalAttributes as any).agi ?? (character.attributes as any).agi ?? 0;
    case 'int':
      return character.finalAttributes.int ?? character.attributes.int ?? 0;
    case 'per':
      return (character.finalAttributes as any).per ?? (character.attributes as any).per ?? 0;
    case 'mov':
      return character.finalAttributes.mov ?? character.attributes.mov ?? 0;
    case 'rca':
      return character.finalAttributes.rca ?? character.attributes.rca ?? 0;
    case 'cca':
      return character.finalAttributes.cca ?? character.attributes.cca ?? 0;
    case 'ref':
      return character.finalAttributes.ref ?? character.attributes.ref ?? 0;
    case 'pow':
      return character.finalAttributes.pow ?? character.attributes.pow ?? 0;
    case 'for':
      return character.finalAttributes.for ?? character.attributes.for ?? 0;
    case 'siz':
      return character.finalAttributes.siz ?? character.attributes.siz ?? 0;
    default:
      return Number.NaN;
  }
}
