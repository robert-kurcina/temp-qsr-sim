import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatEngine, CombatResult } from './CombatEngine';
import { Character } from '../Character';
import { Profile } from '../Profile';

// Mock the dice roller
vi.mock('../dice-roller', async () => {
  const actual = await vi.importActual('../dice-roller');
  return {
    ...actual,
    // Keep the actual implementation and just spy on getRolls if needed, or override here.
  };
});

describe('CombatEngine', () => {
  let attacker: Character;
  let defender: Character;

  beforeEach(() => {
    const attackerProfile: Profile = {
      name: 'Attacker',
      archetype: 'Average',
      attributes: { cca: 3, rca: 2, ref: 2, int: 2, pow: 2, str: 3, for: 2, mov: 2, siz: 3 },
      traits: [],
      items: [],
    };
    const defenderProfile: Profile = {
      name: 'Defender',
      archetype: 'Average',
      attributes: { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 3, mov: 2, siz: 3 },
      traits: [],
      items: [],
    };
    attacker = new Character(attackerProfile);
    defender = new Character(defenderProfile);
  });

  it('should resolve a successful hit and wound', () => {
    // Attacker rolls high, defender rolls low for both hit and wound
    CombatEngine.testing_diceRolls = {
      attackerRolls: [6, 6, 6, 6, 6, 6],
      defenderRolls: [1, 1, 1, 1],
    };
    const result: CombatResult = CombatEngine.resolveCloseCombat(attacker, defender);
    expect(result.hit).toBe(true);
    expect(result.wound).toBe(true);
    expect(defender.wounds).toBe(1);
  });

  it('should resolve a successful hit and a failed wound', () => {
    // Attacker hits, but defender's FOR test is successful
    CombatEngine.testing_diceRolls = {
        attackerRolls: [6, 6, 1, 1, 1, 1],
        defenderRolls: [1, 1, 6, 6],
    };
    const result: CombatResult = CombatEngine.resolveCloseCombat(attacker, defender);
    expect(result.hit).toBe(true);
    expect(result.wound).toBe(false);
    expect(defender.wounds).toBe(0);
  });

  it('should resolve a failed hit', () => {
    // Attacker rolls low, defender rolls high for the hit test
    CombatEngine.testing_diceRolls = {
        attackerRolls: [1, 1],
        defenderRolls: [6, 6],
    }; 
    const result: CombatResult = CombatEngine.resolveCloseCombat(attacker, defender);
    expect(result.hit).toBe(false);
    expect(result.wound).toBe(false);
    expect(defender.wounds).toBe(0);
  });
});
