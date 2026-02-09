
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from '../character-factory';
import { resolveHitTest } from './hit-test';
import { setRoller, resetRoller, DiceType } from '../dice-roller';
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
    // Attacker: CCA 3 -> 3 dice. Defender: CCA 1 -> 1 die.
    setRoller(() => [6, 1, 1, 1]); // 3 for attacker, 1 for defender
    const result = resolveHitTest(attacker, defender, weapon);
    // Attacker rolls [6, 1, 1] -> 2 successes.
    // Defender rolls [1] -> 0 successes.
    // Score: 2 - 0 = 2. HIT.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(2);
  });

  it('should apply external bonus dice to the attacker', () => {
    // Attacker: CCA 3 + 1 bonus -> 4 dice. Defender: CCA 1 -> 1 die.
    setRoller(() => [6, 1, 1, 1, 1]); // 4 for attacker, 1 for defender
    const attackerBonus = { [DiceType.Base]: 1 };
    const result = resolveHitTest(attacker, defender, weapon, attackerBonus);
    // Attacker rolls [6, 1, 1, 1] -> 2 successes.
    // Defender rolls [1] -> 0 successes.
    // Score: 2 - 0 = 2. HIT.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(2);
  });

  it('should apply external penalty dice to the defender', () => {
    // Attacker: CCA 3 -> 3 dice. Defender: CCA 1 - 1 penalty -> 0 dice.
    setRoller(() => [6, 1, 1]); // 3 for attacker, 0 for defender
    const defenderPenalty = { [DiceType.Base]: 1 };
    const result = resolveHitTest(attacker, defender, weapon, {}, {}, {}, defenderPenalty);
    // Attacker rolls [6, 1, 1] -> 2 successes.
    // Defender rolls [] -> 0 successes.
    // Score: 2 - 0 = 2. HIT.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(2);
  });

  it('should correctly parse and apply weapon accuracy modifiers', () => {
    // Attacker: CCA 3 + 1 bonus (accuracy) -> 4 dice. Defender: CCA 1 -> 1 die.
    setRoller(() => [6, 1, 1, 1, 1]); // 4 for attacker, 1 for defender
    weapon.accuracy = '+1b';
    const result = resolveHitTest(attacker, defender, weapon);
    // Attacker rolls [6, 1, 1, 1] -> 2 successes.
    // Defender rolls [1] -> 0 successes.
    // Score: 2 - 0 = 2. HIT.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(2);
  });

  it('should combine external modifiers and accuracy modifiers', () => {
    // Attacker: CCA 3 + 1b (accuracy) -> 4 base dice. +1m (bonus) -> 1 mod die. Total 5 dice.
    // Defender: CCA 1 -> 1 die.
    setRoller(() => [6, 1, 1, 1, 5, 1]); // 5 for attacker, 1 for defender
    weapon.accuracy = '+1b';
    const attackerBonus = { [DiceType.Modifier]: 1 };
    const result = resolveHitTest(attacker, defender, weapon, attackerBonus);
    // Attacker base rolls [6, 1, 1, 1] -> 2 successes. Attacker mod rolls [5] -> 1 success. Total 3.
    // Defender rolls [1] -> 0 successes.
    // Score: 3 - 0 = 3. HIT.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(3);
  });
});
