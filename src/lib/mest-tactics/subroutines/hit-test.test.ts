
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from '../character-factory';
import { resolveHitTest } from './hit-test';
import { DiceType, DicePool } from '../dice-roller';
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
  });

  it('should resolve a standard hit test without external modifiers', () => {
    const attackerBonus: DicePool = {};
    const attackerPenalty: DicePool = {};
    const defenderBonus: DicePool = {};
    const defenderPenalty: DicePool = {};
    const attackerRolls = [6, 1];
    const defenderRolls = [1, 1];

    const result = resolveHitTest(
      attacker,
      defender,
      weapon,
      attackerBonus,
      attackerPenalty,
      defenderBonus,
      defenderPenalty,
      attackerRolls,
      defenderRolls
    );

    expect(result.pass).toBe(true);
    expect(result.score).toBe(4);
  });

  it('should apply external bonus dice to the attacker', () => {
    const attackerBonus: DicePool = { [DiceType.Base]: 1 };
    const attackerPenalty: DicePool = {};
    const defenderBonus: DicePool = {};
    const defenderPenalty: DicePool = {};
    const attackerRolls = [6, 1, 1];
    const defenderRolls = [1, 1];
    
    const result = resolveHitTest(
      attacker,
      defender,
      weapon,
      attackerBonus,
      attackerPenalty,
      defenderBonus,
      defenderPenalty,
      attackerRolls,
      defenderRolls
    );

    expect(result.pass).toBe(true);
    expect(result.score).toBe(4);
  });

  it('should apply external penalty dice to the defender', () => {
    const attackerBonus: DicePool = {};
    const attackerPenalty: DicePool = {};
    const defenderBonus: DicePool = {};
    const defenderPenalty: DicePool = { [DiceType.Base]: 1 };
    const attackerRolls = [6, 1, 1];
    const defenderRolls = [1, 1];

    const result = resolveHitTest(
      attacker,
      defender,
      weapon,
      attackerBonus,
      attackerPenalty,
      defenderBonus,
      defenderPenalty,
      attackerRolls,
      defenderRolls
    );

    expect(result.pass).toBe(true);
    expect(result.score).toBe(4);
  });

  it('should correctly parse and apply weapon accuracy modifiers', () => {
    weapon.accuracy = '+1b';
    const attackerBonus: DicePool = {};
    const attackerPenalty: DicePool = {};
    const defenderBonus: DicePool = {};
    const defenderPenalty: DicePool = {};
    const attackerRolls = [6, 1, 1];
    const defenderRolls = [1, 1];

    const result = resolveHitTest(
      attacker,
      defender,
      weapon,
      attackerBonus,
      attackerPenalty,
      defenderBonus,
      defenderPenalty,
      attackerRolls,
      defenderRolls
    );

    expect(result.pass).toBe(true);
    expect(result.score).toBe(4);
  });

  it('should combine external modifiers and accuracy modifiers', () => {
    weapon.accuracy = '+1b';
    const attackerBonus: DicePool = { [DiceType.Modifier]: 1 };
    const attackerPenalty: DicePool = {};
    const defenderBonus: DicePool = {};
    const defenderPenalty: DicePool = {};
    const attackerRolls = [6, 1, 1, 5];
    const defenderRolls = [1, 1];

    const result = resolveHitTest(
      attacker,
      defender,
      weapon,
      attackerBonus,
      attackerPenalty,
      defenderBonus,
      defenderPenalty,
      attackerRolls,
      defenderRolls
    );

    expect(result.pass).toBe(true);
    expect(result.score).toBe(5);
  });
});
