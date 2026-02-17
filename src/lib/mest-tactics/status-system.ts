import { Character } from './Character';
import { gameData } from '../data';
import { ResolveTestResult, resolveTest, TestParticipant } from './dice-roller';

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

export function applyStatusTraitOnHit(
  defender: Character,
  traitName: string,
  options: { cascades?: number; rating?: number; testRolls?: number[] | null } = {}
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

  const cascades = options.cascades ?? 0;
  const status = applyStatusFromTrait(defender, traitName, cascades);
  return { applied: Boolean(status), status: status ?? undefined };
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
