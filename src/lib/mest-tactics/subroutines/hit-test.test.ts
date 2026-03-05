
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from '../utils/character-factory';
import { resolveHitTest } from './hit-test';
import { DiceType, TestDice } from '../subroutines/dice-roller';
import type { Profile } from '../core/Profile';
import type { Item } from '../core/Item';
import type { Character } from '../core/Character';
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

    const attackerProfile: Profile = { name: 'Attacker Profile', archetype: attackerArchetype, equipment: [weapon] } as any;
    const defenderProfile: Profile = { name: 'Defender Profile', archetype: defenderArchetype, equipment: [] } as any;

    attacker = await createCharacter(attackerProfile);
    defender = await createCharacter(defenderProfile);
  });

  it('should resolve a standard hit test without external modifiers', () => {
    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = {};
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
    const attackerBonus: TestDice = { [DiceType.Base]: 1 } as any;
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = {};
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
    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = { [DiceType.Base]: 1 } as any;
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
    const attackerBonus: TestDice = {};
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = {};
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
    const attackerBonus: TestDice = { [DiceType.Modifier]: 1 } as any;
    const attackerPenalty: TestDice = {};
    const defenderBonus: TestDice = {};
    const defenderPenalty: TestDice = {};
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
