import type { Character } from '../../core/Character';
import type { Item } from '../../core/Item';

export interface LoadoutProfile {
  hasMeleeWeapons: boolean;
  hasRangedWeapons: boolean;
  primaryWeaponType: 'melee' | 'ranged' | 'mixed' | 'none';
}

function getCharacterItems(character: Character): Item[] {
  const profile = character.profile ?? {};
  const rawItems = [
    ...(profile.equipment ?? []),
    ...(profile.items ?? []),
    ...(profile.inHandItems ?? []),
    ...(profile.stowedItems ?? []),
    ...(character.items ?? []),
  ];

  const seen = new Set<string>();
  const deduped: Item[] = [];
  for (const item of rawItems) {
    if (!item) continue;
    const key = `${item.name}|${item.classification}|${item.class}|${item.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function getClassification(item: Item): string {
  return String(item.classification ?? item.class ?? '').toLowerCase();
}

function hasThrowableTrait(item: Item): boolean {
  return Array.isArray(item.traits) && item.traits.some(trait => String(trait).toLowerCase().includes('throw'));
}

export function isRangedWeapon(item: Item): boolean {
  const classification = getClassification(item);
  if (
    classification.includes('range') ||
    classification.includes('bow') ||
    classification.includes('firearm') ||
    classification.includes('thrown') ||
    classification.includes('support') ||
    classification.includes('rifle') ||
    classification.includes('pistol') ||
    classification.includes('gun')
  ) {
    return true;
  }

  return (
    (classification.includes('melee') || classification.includes('natural')) &&
    hasThrowableTrait(item)
  );
}

export function isMeleeWeapon(item: Item): boolean {
  const classification = getClassification(item);
  return (
    classification.includes('melee') ||
    classification.includes('natural') ||
    classification.includes('sword') ||
    classification.includes('axe') ||
    classification.includes('spear')
  );
}

export function hasRangedWeapon(character: Character): boolean {
  return getCharacterItems(character).some(item => isRangedWeapon(item));
}

export function hasMeleeWeapon(character: Character): boolean {
  return getCharacterItems(character).some(item => isMeleeWeapon(item));
}

export function getLoadoutProfile(character: Character): LoadoutProfile {
  const hasMeleeWeapons = hasMeleeWeapon(character);
  const hasRangedWeapons = hasRangedWeapon(character);

  let primaryWeaponType: LoadoutProfile['primaryWeaponType'] = 'none';
  if (hasMeleeWeapons && hasRangedWeapons) {
    primaryWeaponType = 'mixed';
  } else if (hasMeleeWeapons) {
    primaryWeaponType = 'melee';
  } else if (hasRangedWeapons) {
    primaryWeaponType = 'ranged';
  }

  return {
    hasMeleeWeapons,
    hasRangedWeapons,
    primaryWeaponType,
  };
}
