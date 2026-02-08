import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Character, CharacterAttributes } from '../character/Character';
import { CombatEngine } from './CombatEngine';

describe('CombatEngine', () => {
  let attacker: Character;
  let defender: Character;

  beforeEach(() => {
    const attackerAttributes: CharacterAttributes = { CCA: 3, RCA: 2, REF: 2, INT: 2, POW: 2, STR: 3, FOR: 2, MOV: 2, SIZ: 3 };
    const defenderAttributes: CharacterAttributes = { CCA: 2, RCA: 2, REF: 2, INT: 2, POW: 2, STR: 2, FOR: 2, MOV: 2, SIZ: 3 };
    attacker = new Character('attacker', 'Attacker', { ...attackerAttributes }, { x: 0, y: 0 });
    defender = new Character('defender', 'Defender', { ...defenderAttributes }, { x: 1, y: 0 });
  });

  it('should resolve a successful hit and wound', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // Ensure high rolls

    const result = CombatEngine.resolveCloseCombat(attacker, defender);

    expect(result.hit).toBe(true);
    expect(result.wound).toBe(true);
    expect(defender.wounds).toBe(1);

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should resolve a successful hit and a failed wound', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.9) // High roll for hit
      .mockReturnValueOnce(0.1); // Low roll for wound

    const result = CombatEngine.resolveCloseCombat(attacker, defender);

    expect(result.hit).toBe(true);
    expect(result.wound).toBe(false);
    expect(defender.wounds).toBe(0);

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should resolve a failed hit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // Low roll

    const result = CombatEngine.resolveCloseCombat(attacker, defender);

    expect(result.hit).toBe(false);
    expect(result.wound).toBe(false);
    expect(defender.wounds).toBe(0);

    vi.spyOn(Math, 'random').mockRestore();
  });
});
