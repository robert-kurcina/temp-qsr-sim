
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from '../character-factory';
import { resolveHitTest } from './hit-test';
import { setRoller, resetRoller, DiceType, Roller } from '../dice-roller';
import type { Profile } from '../Profile';
import type { Item } from '../Item';
import type { Character } from '../Character';
import { gameData } from '../../data';

const { archetypes, melee_weapons } = gameData;

describe('resolveHitTest', () => {
  let attacker: Character;
  let defender: Character;
  let weapon: Item;

  beforeEach(async () => {
    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] };
    const defenderArchetype = { name: "Militia", ...archetypes["Militia"] };
    weapon = { name: "Sword, Broad", ...melee_weapons["Sword, Broad"] };

    const attackerProfile: Profile = { name: 'Attacker Profile', archetype: attackerArchetype, equipment: [weapon] };
    const defenderProfile: Profile = { name: 'Defender Profile', archetype: defenderArchetype, equipment: [] };

    attacker = await createCharacter(attackerProfile);
    defender = await createCharacter(defenderProfile);

    resetRoller();
  });

  it('should resolve a standard hit test without external modifiers', () => {
    setRoller(() => [6, 1, 1, 1]);
    const result = resolveHitTest(attacker, defender, weapon);
    // Attacker: 3 + 1 = 4. Defender: 1 + 0 = 1. Score: 3. HIT.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(3);
  });

  it('should apply external bonus dice to the attacker', () => {
    setRoller(() => [6, 1, 1, 1, 1]);
    const attackerBonus = { [DiceType.Base]: 1 };
    const result = resolveHitTest(attacker, defender, weapon, attackerBonus);
    // Attacker has 3 dice (2 base + 1 bonus). Rolls 6,1,1 -> 2 successes. Score 3+2=5.
    // Defender has 1 die. Rolls 1. 0 successes. Score 1+0=1.
    // Final score 4. HIT.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(4);
  });

  it('should apply external penalty dice to the defender', () => {
    setRoller(() => [6, 1, 1, 1, 1]);
    const defenderPenalty = { [DiceType.Base]: 1 };
    const result = resolveHitTest(attacker, defender, weapon, {}, {}, {}, defenderPenalty);
    // Attacker: 1 success. Score 4. Defender: 0 successes. Score 1. Result 3.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(3);
  });

  it('should correctly parse and apply weapon accuracy modifiers', () => {
    setRoller(() => [6, 1, 1, 1, 1]);
    weapon.accuracy = '+1b';
    const result = resolveHitTest(attacker, defender, weapon);
    // Attacker: 3 dice, 2 base, 1 bonus. Rolls 6,1,1 -> 2 successes. Score 3+2=5.
    // Defender: 1 die -> 1, 0 success. Score 1+0=1.
    // Final: 4. HIT.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(4);
  });

  it('should combine external modifiers and accuracy modifiers', () => {
    setRoller(() => [6, 1, 1, 1, 1]);
    weapon.accuracy = '+1b';
    const attackerBonus = { [DiceType.Modifier]: 1 };
    const result = resolveHitTest(attacker, defender, weapon, attackerBonus);
    // Attacker has 3 dice (2 base, 1 bonus base) and 1 modifier die. Rolls 6,1,1 for base, 1 for mod -> 2 successes. Score 3+2=5.
    // Defender has 1 die, rolls 1 -> 0 successes. Score 1.
    // Final 3. HIT.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(4);
  });
});
