import { Character } from '../Character';
import { Item } from '../Item';

export function hasItemTrait(character: Character, trait: string): boolean {
  const items = [
    ...(character.profile?.equipment ?? []),
    ...(character.profile?.items ?? []),
    ...(character.profile?.inHandItems ?? []),
    ...(character.profile?.stowedItems ?? []),
  ];
  const needle = trait.toLowerCase();
  return items.some(item => item?.traits?.some(t => t.toLowerCase().includes(needle)));
}

export function hasItemTraitOnWeapon(weapon: Item, trait: string): boolean {
  const needle = trait.toLowerCase();
  return weapon?.traits?.some(t => t.toLowerCase().includes(needle)) ?? false;
}
