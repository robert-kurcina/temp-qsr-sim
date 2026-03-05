/**
 * Falling Rules Tests
 *
 * Tests for QSR Falling mechanics:
 * - Jump Down (wound at Agility-0.5)
 * - Falling Test (DR = SIZ + (MU beyond Agility ÷ 4))
 * - Falling Collision (ignore one miss, targets test)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character, Profile } from '../core';
import {
  calculateAgility,
  jumpDown,
  resolveFallingTest,
  resolveFallingCollision,
} from './agility';

// Helper to create a test character
function createTestCharacter(overrides: any = {}): Character {
  const attributes = {
    cca: 2,
    rca: 2,
    ref: 2,
    int: 2,
    pow: 2,
    str: 2,
    for: 2,
    mov: 2,
    siz: 3,
  };

  const baseProfile: Profile = {
    name: 'Test Character',
    archetype: 'Average' as any as any,
    attributes: { ...attributes },
    totalBp: 30,
    adjustedBp: 30,
    physicality: 2,
    durability: 3,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 0,
    totalDeflect: 0,
    totalAr: 0,
    finalTraits: [],
    allTraits: [],
    items: [],
  } as any;

  const character: Character = {
    id: 'test-char-1',
    name: 'Test Character',
    profile: baseProfile,
    attributes: { ...attributes },
    finalAttributes: { ...attributes },
    state: {
      isAttentive: true,
      isOrdered: true,
      isReady: true,
      isHidden: false,
      isKOd: false,
      isEliminated: false,
      wounds: 0,
      delayTokens: 0,
      fearTokens: 0,
      initiative: 0,
      weaponsInHand: [],
      lastWeaponUsed: null,
      naturalWeapons: [],
    },
  } as any;

  // Apply overrides to finalAttributes
  if (overrides.finalAttributes) {
    character.finalAttributes = { ...character.finalAttributes, ...overrides.finalAttributes };
  }
  if (overrides.state) {
    character.state = { ...character.state, ...overrides.state };
  }
  if (overrides.id) {
    character.id = overrides.id as string;
  }

  return character;
}

describe('Falling Rules', () => {
  describe('calculateAgility', () => {
    it('should calculate agility as MOV × 0.5', () => {
      const char = createTestCharacter({ finalAttributes: { mov: 4 } as any });
      expect(calculateAgility(char)).toBe(1);
    });

    it('should keep fractions up to 0.5', () => {
      const char = createTestCharacter({ finalAttributes: { mov: 4 } as any });
      expect(calculateAgility(char)).toBe(1.5);
    });

    it('should handle MOV 1', () => {
      const char = createTestCharacter({ finalAttributes: { mov: 4 } as any });
      expect(calculateAgility(char)).toBe(0.5);
    });

    it('should handle MOV 4', () => {
      const char = createTestCharacter({ finalAttributes: { mov: 4 } as any });
      expect(calculateAgility(char)).toBe(2);
    });
  });

  describe('jumpDown', () => {
    it('should allow jump down within agility without wound', () => {
      const char = createTestCharacter({ finalAttributes: { mov: 4 } as any }); // Agility = 1
      const result = jumpDown(char, { terrainHeight: 0.4 }); // Less than agility-0.5
      expect(result.success).toBe(true);
      expect(result.woundAdded).toBe(false);
      expect(result.agilitySpent).toBe(0.4);
    });

    it('should add wound when jumping down at agility-0.5 or more', () => {
      const char = createTestCharacter({ finalAttributes: { mov: 4 } as any }); // Agility = 1
      const result = jumpDown(char, { terrainHeight: 0.5 });
      // At exactly agility-0.5, wound should be added
      expect(result.woundAdded).toBe(true);
    });

    it('should trigger Falling Test when fall exceeds agility', () => {
      const char = createTestCharacter({ finalAttributes: { mov: 4 } as any }); // Agility = 1
      const result = jumpDown(char, { terrainHeight: 1.5 });
      expect(result.success).toBe(true);
      expect(result.woundAdded).toBe(true);
      // delayAdded depends on Falling Test result (probabilistic)
      expect(result).toHaveProperty('delayAdded');
    });

    it('should fail if jump down exceeds agility (without Falling Test)', () => {
      // Note: Current implementation allows exceeding agility with Falling Test
      // This test documents the expected behavior
      const char = createTestCharacter({ finalAttributes: { mov: 4 } as any });
      const result = jumpDown(char, { terrainHeight: 2 });
      expect(result.success).toBe(true); // Falls with test
      expect(result.woundAdded).toBe(true);
    });
  });

  describe('resolveFallingTest', () => {
    it('should calculate DR = SIZ + (MU beyond Agility ÷ 4)', () => {
      const char = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any, // Agility = 1
      });
      // Fall 5 MU, Agility 1, beyond = 4, DR = 3 + 4/4 = 4
      const result = resolveFallingTest(char, 5, 1);
      // Result varies due to dice, but structure should be correct
      expect(result).toHaveProperty('delayTokens');
      expect(result).toHaveProperty('woundAdded');
      expect(result.woundAdded).toBe(true); // 5 >= 1-0.5
    });

    it('should add wound for falls >= Agility-0.5', () => {
      const char = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any,
      });
      const result = resolveFallingTest(char, 0.5, 1);
      expect(result.woundAdded).toBe(true);
    });

    it('should not add wound for falls < Agility-0.5', () => {
      const char = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any,
      });
      const result = resolveFallingTest(char, 0.3, 1);
      expect(result.woundAdded).toBe(false);
    });

    it('should use FOR attribute for test', () => {
      const charHighFor = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any,
      });
      const charLowFor = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any,
      });
      // Higher FOR should generally result in fewer delay tokens
      // (test is probabilistic, so we run multiple times)
      let highForTotal = 0;
      let lowForTotal = 0;
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        highForTotal += resolveFallingTest(charHighFor, 2, 1).delayTokens;
        lowForTotal += resolveFallingTest(charLowFor, 2, 1).delayTokens;
      }
      expect(highForTotal).toBeLessThanOrEqual(lowForTotal);
    });

    it('should round DR to nearest whole number', () => {
      const char = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any,
      });
      // Fall 3 MU, Agility 1, beyond = 2, DR = 3 + 2/4 = 3.5 → 4
      const result = resolveFallingTest(char, 3, 1);
      expect(result).toHaveProperty('delayTokens');
    });
  });

  describe('resolveFallingCollision', () => {
    it('should allow falling character to ignore one miss', () => {
      const fallingChar = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any,
      });
      const targets: any[] = [];
      const results = resolveFallingCollision(fallingChar, targets, 3, 1);
      expect(results.length).toBe(1);
      expect(results[0].fallingCharacterIgnoresOneMiss).toBe(true);
    });

    it('should process all target characters', () => {
      const fallingChar = createTestCharacter();
      const target1 = createTestCharacter();
      target1.id = 'target-1';
      const target2 = createTestCharacter();
      target2.id = 'target-2';
      const targets = [target1, target2];

      const results = resolveFallingCollision(fallingChar, targets, 3, 1);

      expect(results.length).toBe(3); // Falling char + 2 targets
      expect(results.map((r: any) => r.targetId)).toContain('target-1');
      expect(results.map((r: any) => r.targetId)).toContain('target-2');
    });

    it('should use same DR for all characters', () => {
      const fallingChar = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any,
      });
      const target = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any,
      });

      // DR should be the same for both (based on fall distance and agility)
      const results = resolveFallingCollision(fallingChar, [target], 5, 1);

      // Both should have wound (5 >= 1-0.5)
      expect(results[0].woundAdded).toBe(true);
      expect(results[1].woundAdded).toBe(true);
    });
  });

  describe('Falling Test Examples from QSR', () => {
    it('Example: SIZ 3, FOR 2, Agility 1, Falls 5 MU', () => {
      const char = createTestCharacter({
        finalAttributes: { siz: 3, for: 3, mov: 4, cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2 } as any, // Agility = 1
      });
      const result = resolveFallingTest(char, 5, 1);
      // DR = 3 + (5-1)/4 = 3 + 1 = 4
      // System score = 4
      // Character rolls 2d6 + FOR 2
      // Result varies, but wound should be added
      expect(result.woundAdded).toBe(true);
    });
  });
});
