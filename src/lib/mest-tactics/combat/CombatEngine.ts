import { Character } from './character/Character';

export interface CombatResult {
  hit: boolean;
  wound: boolean;
}

export class CombatEngine {
  public static resolveCloseCombat(attacker: Character, defender: Character): CombatResult {
    const hitRoll = Math.floor(Math.random() * 6) + 1; // d6 roll
    const hitTarget = attacker.attributes.CCA - defender.attributes.CCA;
    const hit = hitRoll >= hitTarget;

    if (!hit) {
      return { hit: false, wound: false };
    }

    const woundRoll = Math.floor(Math.random() * 6) + 1; // d6 roll
    const woundTarget = attacker.attributes.STR - defender.attributes.FOR;
    const wound = woundRoll >= woundTarget;

    if (wound) {
      defender.takeWound();
    }

    return { hit, wound };
  }
}
