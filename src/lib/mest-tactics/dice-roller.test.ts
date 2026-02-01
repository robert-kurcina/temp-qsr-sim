
import { describe, it, expect } from 'vitest';
import { resolveTest, TestParticipant, DiceType } from './dice-roller';

describe('resolveTest', () => {

  // --- Unopposed Tests (against the System) ---

  it('should PASS an unopposed test on a TIE with the System', () => {
    const attacker: TestParticipant = { attributeValue: 0 };
    const system: TestParticipant = { attributeValue: 999, isSystemPlayer: true }; // Attribute value is ignored
    
    // Attacker score 4. System score should be 4 (2 base + 2 DR).
    const result = resolveTest(attacker, system, 2, () => 4, () => 4);

    expect(result.pass).toBe(true);
    expect(result.cascades).toBe(1); // Tie results in 1 cascade
  });

  it('should PASS an unopposed test when score > System', () => {
    const attacker: TestParticipant = { attributeValue: 0 };
    const system: TestParticipant = { attributeValue: 999, isSystemPlayer: true };

    // Attacker score 5. System score should be 4 (2 base + 2 DR).
    const result = resolveTest(attacker, system, 2, () => 5, () => 4);

    expect(result.pass).toBe(true);
    expect(result.cascades).toBe(1); // 5 - 4 = 1
  });

  it('should FAIL an unopposed test when score < System', () => {
    const attacker: TestParticipant = { attributeValue: 0 };
    const system: TestParticipant = { attributeValue: 999, isSystemPlayer: true };

    // Attacker score 3. System score should be 4 (2 base + 2 DR).
    const result = resolveTest(attacker, system, 2, () => 3, () => 4);

    expect(result.pass).toBe(false);
    expect(result.misses).toBe(1); // 4 - 3 = 1
  });

  // --- Opposed Tests (against another character) ---

  it('should PASS an opposed test on a TIE', () => {
    const attacker: TestParticipant = { attributeValue: 0 };
    const defender: TestParticipant = { attributeValue: 0 };
    
    const result = resolveTest(attacker, defender, 0, () => 4, () => 4);

    expect(result.pass).toBe(true);
    expect(result.cascades).toBe(1); // Tie results in 1 cascade
  });

  it('should PASS an opposed test when score > defender', () => {
    const attacker: TestParticipant = { attributeValue: 0 };
    const defender: TestParticipant = { attributeValue: 0 };

    const result = resolveTest(attacker, defender, 0, () => 5, () => 3);

    expect(result.pass).toBe(true);
    expect(result.cascades).toBe(2); // 5 - 3 = 2
  });

  it('should FAIL an opposed test when score < defender', () => {
    const attacker: TestParticipant = { attributeValue: 0 };
    const defender: TestParticipant = { attributeValue: 0 };

    const result = resolveTest(attacker, defender, 0, () => 3, () => 5);

    expect(result.pass).toBe(false);
    expect(result.misses).toBe(2); // 5 - 3 = 2
  });

  // --- Special Mechanics ---

  it('should calculate carry-over dice correctly (cascades - 1)', () => {
    const attacker: TestParticipant = { attributeValue: 0 };
    const defender: TestParticipant = { attributeValue: 0 };

    // Attacker score 6, Defender score 2 -> 4 cascades
    const result = resolveTest(attacker, defender, 0, () => 6, () => 2);

    expect(result.cascades).toBe(4);
    expect(result.carryOverDice[DiceType.Base]).toBe(3); // 4 - 1 = 3
  });

  it('should NOT generate carry-over dice on a tie (cascades = 1)', () => {
    const attacker: TestParticipant = { attributeValue: 0 };
    const defender: TestParticipant = { attributeValue: 0 };

    const result = resolveTest(attacker, defender, 0, () => 4, () => 4);

    expect(result.cascades).toBe(1);
    expect(Object.keys(result.carryOverDice).length).toBe(0);
  });
});
