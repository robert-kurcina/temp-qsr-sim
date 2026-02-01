
import { describe, it, expect, afterEach } from 'vitest';
import { resolveTest, setRoller, resetRoller, TestParticipant, DiceType, Roller } from './dice-roller';

describe('resolveTest', () => {

  afterEach(() => {
    resetRoller();
  });

  // --- Unopposed Tests (against the System) ---

  it('should PASS an unopposed test on a TIE with the System', () => {
    const attacker: TestParticipant = { attributeValue: 2 }; // Attacker base score 2
    const system: TestParticipant = { attributeValue: 999, isSystemPlayer: true }; // System base score 2
    setRoller(() => 0); // No extra successes from dice
    
    const result = resolveTest(attacker, system, 0);

    expect(result.pass).toBe(true);
    expect(result.cascades).toBe(1); // Tie results in 1 cascade
  });

  it('should PASS an unopposed test when score > System', () => {
    const attacker: TestParticipant = { attributeValue: 3 }; // Attacker base score 3
    const system: TestParticipant = { attributeValue: 999, isSystemPlayer: true }; // System base score 2
    setRoller(() => 0);

    const result = resolveTest(attacker, system, 0);

    expect(result.pass).toBe(true);
    expect(result.cascades).toBe(1); // 3 - 2 = 1
  });

  it('should FAIL an unopposed test when score < System', () => {
    const attacker: TestParticipant = { attributeValue: 1 }; // Attacker base score 1
    const system: TestParticipant = { attributeValue: 999, isSystemPlayer: true }; // System base score 2
    setRoller(() => 0);

    const result = resolveTest(attacker, system, 0);

    expect(result.pass).toBe(false);
    expect(result.misses).toBe(1); // 2 - 1 = 1
  });

  // --- Opposed Tests (against another character) ---

  it('should PASS an opposed test on a TIE', () => {
    const attacker: TestParticipant = { attributeValue: 3 };
    const defender: TestParticipant = { attributeValue: 3 };
    setRoller(() => 0);
    
    const result = resolveTest(attacker, defender, 0);

    expect(result.pass).toBe(true);
    expect(result.cascades).toBe(1); // Tie results in 1 cascade
  });

  it('should PASS an opposed test when score > defender', () => {
    const attacker: TestParticipant = { attributeValue: 4 };
    const defender: TestParticipant = { attributeValue: 2 };
    setRoller(() => 0);

    const result = resolveTest(attacker, defender, 0);

    expect(result.pass).toBe(true);
    expect(result.cascades).toBe(2); // 4 - 2 = 2
  });

  it('should FAIL an opposed test when score < defender', () => {
    const attacker: TestParticipant = { attributeValue: 3 };
    const defender: TestParticipant = { attributeValue: 5 };
    setRoller(() => 0);

    const result = resolveTest(attacker, defender, 0);

    expect(result.pass).toBe(false);
    expect(result.misses).toBe(2); // 5 - 3 = 2
  });

  // --- Special Mechanics ---

  it('should calculate carry-over dice correctly (cascades - 1)', () => {
    const attacker: TestParticipant = { attributeValue: 6 };
    const defender: TestParticipant = { attributeValue: 2 };
    setRoller(() => 0);

    const result = resolveTest(attacker, defender, 0);

    expect(result.cascades).toBe(4);
    expect(result.carryOverDice[DiceType.Base]).toBe(3); // 4 - 1 = 3
  });

  it('should NOT generate carry-over dice on a tie (cascades = 1)', () => {
    const attacker: TestParticipant = { attributeValue: 4 };
    const defender: TestParticipant = { attributeValue: 4 };
    setRoller(() => 0);

    const result = resolveTest(attacker, defender, 0);

    expect(result.cascades).toBe(1);
    expect(result.carryOverDice[DiceType.Base]).toBeUndefined();
  });
});
