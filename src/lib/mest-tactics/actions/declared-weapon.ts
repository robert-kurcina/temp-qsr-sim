import { Character } from '../core/Character';
import { Item } from '../core/Item';

export interface DeclaredWeaponResolution {
  weapon: Item;
  weaponIndex?: number;
  declared: boolean;
}

export function resolveDeclaredWeapon(
  character: Character,
  fallback: Item
): DeclaredWeaponResolution {
  const declaredIndex = character.state.activeWeaponIndex;
  if (declaredIndex === undefined || declaredIndex === null) {
    return { weapon: fallback, declared: false };
  }

  const equipment = character.profile?.equipment || character.profile?.items || [];
  const declaredWeapon = equipment[declaredIndex];
  if (!declaredWeapon) {
    return { weapon: fallback, declared: false };
  }

  return { weapon: declaredWeapon, weaponIndex: declaredIndex, declared: true };
}
