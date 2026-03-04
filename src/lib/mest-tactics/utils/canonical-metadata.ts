import { gameData } from '../../data';

interface ItemClassificationRow {
  wae_class?: unknown;
  item_type?: unknown;
  item_class?: unknown;
}

interface KeywordRow {
  name?: unknown;
  description?: unknown;
}

interface TechLevelRow {
  tech_age?: unknown;
  tech_level?: unknown;
}

export interface CanonicalItemClassification {
  waeClass: string;
  itemType: string | null;
  itemClass: string;
}

function toKey(value: string): string {
  return value.trim().toLowerCase();
}

const ITEM_CLASSIFICATIONS = gameData.item_classifications as Record<string, ItemClassificationRow>;
const ITEM_CLASSIFICATIONS_BY_LABEL = new Map<string, CanonicalItemClassification>();
for (const [label, row] of Object.entries(ITEM_CLASSIFICATIONS)) {
  const waeClass = typeof row.wae_class === 'string' ? row.wae_class : '';
  const itemClass = typeof row.item_class === 'string' ? row.item_class : '';
  const itemType = typeof row.item_type === 'string'
    ? row.item_type
    : row.item_type === null
      ? null
      : null;

  if (!waeClass || !itemClass) continue;
  ITEM_CLASSIFICATIONS_BY_LABEL.set(toKey(label), {
    waeClass,
    itemType,
    itemClass,
  });
}

const KEYWORDS = gameData.keyword_descriptions as KeywordRow[];
const CANONICAL_KEYWORDS_BY_KEY = new Map<string, string>();
for (const keyword of KEYWORDS) {
  if (typeof keyword.name !== 'string') continue;
  CANONICAL_KEYWORDS_BY_KEY.set(toKey(keyword.name), keyword.name.trim());
}

const TECH_LEVEL_ROWS = gameData.tech_level as TechLevelRow[];
const TECH_LEVEL_BY_AGE = new Map<string, number | null>();
for (const row of TECH_LEVEL_ROWS) {
  if (typeof row.tech_age !== 'string') continue;
  const age = row.tech_age.trim();
  if (!age) continue;

  if (typeof row.tech_level === 'number' && Number.isFinite(row.tech_level)) {
    if (!TECH_LEVEL_BY_AGE.has(toKey(age))) {
      TECH_LEVEL_BY_AGE.set(toKey(age), row.tech_level);
    }
    continue;
  }

  if (row.tech_level === null && !TECH_LEVEL_BY_AGE.has(toKey(age))) {
    TECH_LEVEL_BY_AGE.set(toKey(age), null);
  }
}

export function getCanonicalItemClassification(label?: string | null): CanonicalItemClassification | null {
  if (typeof label !== 'string') return null;
  return ITEM_CLASSIFICATIONS_BY_LABEL.get(toKey(label)) ?? null;
}

export function canonicalizeKeywordToken(token: string): string {
  const canonical = CANONICAL_KEYWORDS_BY_KEY.get(toKey(token));
  return canonical ?? token.trim();
}

export function isKnownKeyword(token: string): boolean {
  return CANONICAL_KEYWORDS_BY_KEY.has(toKey(token));
}

export function getCanonicalTechLevelForAge(age: string): number | null {
  return TECH_LEVEL_BY_AGE.get(toKey(age)) ?? null;
}

