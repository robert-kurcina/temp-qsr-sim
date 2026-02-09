
import { describe, it, expect, beforeEach } from 'vitest';
import { Character, CharacterAttributes } from '../Character';
import { CombatEngine } from './CombatEngine';
import { setRoller, resetRoller } from '../dice-roller';

describe('CombatEngine', () => {
  let attacker: Character;
  let defender: Character;

  beforeEach(() => {
    const attackerAttributes: CharacterAttributes = { cca: 3, rca: 2, ref: 2, int: 2, pow: 2, str: 3, for: 2, mov: 2, siz: 3 };
    const defenderAttributes: CharacterAttributes = { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 };
    attacker = new Character('attacker', 'Attacker', { ...attackerAttributes });
    defender = new Character('defender', 'Defender', { ...defenderAttributes });
    resetRoller();
  });

  it('should resolve a successful hit and wound', () => {
    // Attacker hits: Rolls 6, 6 (4 successes + 2 base carry) vs Defender rolls 1, 1 (0 successes)
    // Attacker wounds: Rolls 6, 6, 6, 6 (8 successes from base, 2 from carry) vs Defender rolls 1, 1 (0 successes)
    const rolls = [6, 6, 1, 1, 6, 6, 6, 6, 1, 1];
    setRoller(() => rolls.shift() ? [rolls.shift() || 1] : [1]);

    const result = CombatEngine.resolveCloseCombat(attacker, defender);

    expect(result.hit).toBe(true);
    expect(result.wound).toBe(true);
    expect(defender.wounds).toBe(1);
  });

  it('should resolve a successful hit and a failed wound', () => {
    // Attacker hits: Rolls 6, 6 (4 successes + 2 base carry) vs Defender rolls 1, 1 (0 successes)
    // Attacker wounds: Rolls 1, 1, 1, 1 (0 successes) vs Defender rolls 6, 6 (4 successes)
    const rolls = [6, 6, 1, 1, 1, 1, 1, 1, 6, 6];
    setRoller(() => rolls.shift() ? [rolls.shift() || 1] : [1]);

    const result = CombatEngine.resolveCloseCombat(attacker, defender);

    expect(result.hit).toBe(true);
    expect(result.wound).toBe(false);
    expect(defender.wounds).toBe(0);
  });

  it('should resolve a failed hit', () => {
    // Attacker hits: Rolls 1, 1 (0 successes) vs Defender rolls 6, 6 (4 successes)
    const rolls = [1, 1, 6, 6];
    setRoller(() => rolls.shift() ? [rolls.shift() || 1] : [1]);

    const result = CombatEngine.resolveCloseCombat(attacker, defender);

    expect(result.hit).toBe(false);
    expect(result.wound).toBe(false);
    expect(defender.wounds).toBe(0);
  });
});
