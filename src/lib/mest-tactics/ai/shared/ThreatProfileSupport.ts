import type { Character } from '../../core/Character';
import type { Item } from '../../core/Item';

export interface ThreatLoadoutProfile {
  hasMeleeWeapons: boolean;
  hasRangedWeapons: boolean;
}

export function getCharacterThreatItems(character: Character): Item[] {
  const profile = character.profile ?? {};
  const rawItems = [
    ...(profile.equipment ?? []),
    ...(profile.items ?? []),
    ...(profile.inHandItems ?? []),
    ...(profile.stowedItems ?? []),
  ];
  const seen = new Set<string>();
  const deduped: Item[] = [];
  for (const item of rawItems) {
    if (!item) continue;
    const key = `${item.name ?? ''}|${item.classification ?? ''}|${item.class ?? ''}|${item.type ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

export function isRangedThreatWeapon(item: Item): boolean {
  const classification = String(item.classification ?? item.class ?? '').toLowerCase();
  if (
    classification.includes('bow') ||
    classification.includes('thrown') ||
    classification.includes('firearm') ||
    classification.includes('range') ||
    classification.includes('support')
  ) {
    return true;
  }
  return (
    (classification.includes('melee') || classification.includes('natural')) &&
    Array.isArray(item.traits) &&
    item.traits.some(trait => String(trait).toLowerCase().includes('throwable'))
  );
}

export function isMeleeThreatWeapon(item: Item): boolean {
  const classification = String(item.classification ?? item.class ?? '').toLowerCase();
  return classification.includes('melee') || classification.includes('natural');
}

export function getRangedThreatWeapons(character: Character): Item[] {
  return getCharacterThreatItems(character).filter(isRangedThreatWeapon);
}

export function getMeleeThreatWeapons(character: Character): Item[] {
  return getCharacterThreatItems(character).filter(isMeleeThreatWeapon);
}

export function hasMeleeThreatProfile(
  character: Character,
  options: { defaultWhenNoItems?: boolean } = {}
): boolean {
  const items = getCharacterThreatItems(character);
  if (items.length === 0) {
    return options.defaultWhenNoItems ?? false;
  }
  return items.some(isMeleeThreatWeapon);
}

export function hasRangedThreatProfile(character: Character): boolean {
  return getCharacterThreatItems(character).some(isRangedThreatWeapon);
}

export function getThreatLoadoutProfile(character: Character): ThreatLoadoutProfile {
  const hasRangedWeapons = hasRangedThreatProfile(character);
  const hasMeleeWeapons = hasMeleeThreatProfile(character);
  return { hasMeleeWeapons, hasRangedWeapons };
}

