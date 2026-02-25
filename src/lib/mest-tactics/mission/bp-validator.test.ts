import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAssemblyBP,
  validateMissionAssemblies,
  createAssemblyValidator,
  recommendGameSize,
  BPValidationResult,
} from './bp-validator';
import { Assembly } from '../core/Assembly';
import { Profile } from '../core/Profile';
import { GameSize } from './assembly-builder';

// Helper to create a test profile
function createTestProfile(name: string, bp: number): Profile {
  return {
    name,
    archetype: {
      name: 'Test',
      attributes: {
        cca: 2,
        rca: 2,
        ref: 2,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov: 4,
        siz: 3,
      },
      traits: [],
      bp,
    },
    items: [],
    equipment: [],
    totalBp: bp,
    adjustedBp: bp,
    physicality: 3,
    durability: 3,
    burden: { totalBurden: 0, items: [] },
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

// Helper to create a test assembly
function createTestAssembly(
  name: string,
  profiles: Profile[],
  config?: any
): Assembly {
  return {
    name,
    characters: profiles.map(p => p.name),
    totalBP: profiles.reduce((sum, p) => sum + p.totalBp, 0),
    totalCharacters: profiles.length,
    config: config || {
      bpLimitMin: 250,
      bpLimitMax: 500,
      characterLimitMin: 4,
      characterLimitMax: 8,
      gameSize: GameSize.SMALL,
    },
  };
}

describe('BP Validator - Assembly Validation', () => {
  describe('validateAssemblyBP', () => {
    it('should pass for valid assembly within limits', () => {
      const profiles = [
        createTestProfile('Char1', 100),
        createTestProfile('Char2', 100),
        createTestProfile('Char3', 100),
        createTestProfile('Char4', 100),
      ];
      const assembly = createTestAssembly('Test', profiles, {
        bpLimitMin: 250,
        bpLimitMax: 500,
        characterLimitMin: 4,
        characterLimitMax: 8,
        gameSize: GameSize.SMALL,
      });

      const result = validateAssemblyBP(assembly, profiles);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.currentBP).toBe(400);
      expect(result.currentCharacters).toBe(4);
    });

    it('should fail for BP below minimum', () => {
      const profiles = [
        createTestProfile('Char1', 50),
        createTestProfile('Char2', 50),
      ];
      const assembly = createTestAssembly('Test', profiles, {
        bpLimitMin: 250,
        bpLimitMax: 500,
        characterLimitMin: 4,
        characterLimitMax: 8,
        gameSize: GameSize.SMALL,
      });

      const result = validateAssemblyBP(assembly, profiles);

      expect(result.passed).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('BP too low')
      );
    });

    it('should fail for BP above maximum', () => {
      const profiles = [
        createTestProfile('Char1', 200),
        createTestProfile('Char2', 200),
        createTestProfile('Char3', 200),
      ];
      const assembly = createTestAssembly('Test', profiles, {
        bpLimitMin: 250,
        bpLimitMax: 500,
        characterLimitMin: 4,
        characterLimitMax: 8,
        gameSize: GameSize.SMALL,
      });

      const result = validateAssemblyBP(assembly, profiles);

      expect(result.passed).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('BP exceeded')
      );
    });

    it('should fail for too few characters', () => {
      const profiles = [
        createTestProfile('Char1', 100),
        createTestProfile('Char2', 100),
      ];
      const assembly = createTestAssembly('Test', profiles, {
        bpLimitMin: 250,
        bpLimitMax: 500,
        characterLimitMin: 4,
        characterLimitMax: 8,
        gameSize: GameSize.SMALL,
      });

      const result = validateAssemblyBP(assembly, profiles);

      expect(result.passed).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Too few models')
      );
    });

    it('should fail for too many characters', () => {
      const profiles = Array(10).fill(null).map((_, i) =>
        createTestProfile(`Char${i}`, 50)
      );
      const assembly = createTestAssembly('Test', profiles, {
        bpLimitMin: 250,
        bpLimitMax: 500,
        characterLimitMin: 4,
        characterLimitMax: 8,
        gameSize: GameSize.SMALL,
      });

      const result = validateAssemblyBP(assembly, profiles);

      expect(result.passed).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Too many models')
      );
    });

    it('should warn for underutilized BP', () => {
      const profiles = [
        createTestProfile('Char1', 100),
        createTestProfile('Char2', 100),
        createTestProfile('Char3', 100),
        createTestProfile('Char4', 100),
      ];
      const assembly = createTestAssembly('Test', profiles, {
        bpLimitMin: 250,
        bpLimitMax: 500,
        characterLimitMin: 4,
        characterLimitMax: 8,
        gameSize: GameSize.SMALL,
      });

      const result = validateAssemblyBP(assembly, profiles);

      // 400/500 = 80%, should not warn
      expect(result.warnings).not.toContainEqual(
        expect.stringContaining('BP underutilized')
      );
    });

    it('should warn for expensive characters', () => {
      const profiles = [
        createTestProfile('ExpensiveChar', 300), // More than half of 500
        createTestProfile('Char2', 50),
        createTestProfile('Char3', 50),
        createTestProfile('Char4', 50),
      ];
      const assembly = createTestAssembly('Test', profiles, {
        bpLimitMin: 250,
        bpLimitMax: 500,
        characterLimitMin: 4,
        characterLimitMax: 8,
        gameSize: GameSize.SMALL,
      });

      const result = validateAssemblyBP(assembly, profiles);

      expect(result.warnings).toContainEqual(
        expect.stringContaining('Expensive character')
      );
    });

    it('should fail for missing configuration', () => {
      const profiles = [createTestProfile('Char1', 100)];
      const assembly: Assembly = {
        name: 'Test',
        characters: ['Char1'],
        totalBP: 100,
        totalCharacters: 1,
      };

      const result = validateAssemblyBP(assembly, profiles);

      expect(result.passed).toBe(false);
      expect(result.errors).toContainEqual('Assembly has no configuration');
    });
  });
});

describe('BP Validator - Mission Validation', () => {
  describe('validateMissionAssemblies', () => {
    it('should validate multiple assemblies', () => {
      const profiles1 = [
        createTestProfile('A1', 100),
        createTestProfile('A2', 100),
        createTestProfile('A3', 100),
        createTestProfile('A4', 100),
      ];
      const profiles2 = [
        createTestProfile('B1', 100),
        createTestProfile('B2', 100),
        createTestProfile('B3', 100),
        createTestProfile('B4', 100),
      ];
      const assemblies = [
        createTestAssembly('SideA', profiles1),
        createTestAssembly('SideB', profiles2),
      ];
      const allProfiles = [...profiles1, ...profiles2];

      const result = validateMissionAssemblies(assemblies, allProfiles);

      expect(result.passed).toBe(true);
      expect(result.sideResults.size).toBe(2);
      expect(result.summary.totalBP).toBe(800);
      expect(result.summary.totalCharacters).toBe(8);
    });

    it('should detect unbalanced sides', () => {
      const profiles1 = [
        createTestProfile('A1', 125),
        createTestProfile('A2', 125),
        createTestProfile('A3', 125),
        createTestProfile('A4', 125),
      ];
      const profiles2 = [
        createTestProfile('B1', 50),
        createTestProfile('B2', 50),
        createTestProfile('B3', 50),
        createTestProfile('B4', 50),
      ];
      const assemblies = [
        createTestAssembly('SideA', profiles1),
        createTestAssembly('SideB', profiles2),
      ];
      const allProfiles = [...profiles1, ...profiles2];

      const result = validateMissionAssemblies(assemblies, allProfiles);

      expect(result.summary.balanced).toBe(false);
      // SideA should have warning about imbalance
      const sideAResult = result.sideResults.get('SideA');
      expect(sideAResult?.warnings).toContainEqual(
        expect.stringContaining('Unbalanced')
      );
    });

    it('should fail if any assembly fails validation', () => {
      const profiles1 = [
        createTestProfile('A1', 100),
        createTestProfile('A2', 100),
        createTestProfile('A3', 100),
        createTestProfile('A4', 100),
      ];
      const profiles2 = [
        createTestProfile('B1', 50), // Too low BP
      ];
      const assemblies = [
        createTestAssembly('SideA', profiles1),
        createTestAssembly('SideB', profiles2),
      ];
      const allProfiles = [...profiles1, ...profiles2];

      const result = validateMissionAssemblies(assemblies, allProfiles);

      expect(result.passed).toBe(false);
    });
  });
});

describe('BP Validator - Assembly Validator Factory', () => {
  describe('createAssemblyValidator', () => {
    let validator: ReturnType<typeof createAssemblyValidator>;

    beforeEach(() => {
      validator = createAssemblyValidator({
        bpLimitMin: 250,
        bpLimitMax: 500,
        characterLimitMin: 4,
        characterLimitMax: 8,
        gameSize: GameSize.SMALL,
      });
    });

    describe('canAddProfile', () => {
      it('should allow adding within limits', () => {
        const profile = createTestProfile('NewChar', 50);
        const result = validator.canAddProfile(profile, 300, 4);

        expect(result.canAdd).toBe(true);
      });

      it('should reject if exceeds BP limit', () => {
        const profile = createTestProfile('NewChar', 250);
        const result = validator.canAddProfile(profile, 400, 4);

        expect(result.canAdd).toBe(false);
        expect(result.reason).toContain('BP limit');
      });

      it('should reject if exceeds character limit', () => {
        const profile = createTestProfile('NewChar', 50);
        const result = validator.canAddProfile(profile, 300, 8);

        expect(result.canAdd).toBe(false);
        expect(result.reason).toContain('character limit');
      });
    });

    describe('getRemainingBP', () => {
      it('should calculate remaining BP', () => {
        const remaining = validator.getRemainingBP(300);
        expect(remaining).toBe(200);
      });

      it('should return 0 if over limit', () => {
        const remaining = validator.getRemainingBP(600);
        expect(remaining).toBe(0);
      });
    });

    describe('getRemainingSlots', () => {
      it('should calculate remaining slots', () => {
        const remaining = validator.getRemainingSlots(5);
        expect(remaining).toBe(3);
      });

      it('should return 0 if over limit', () => {
        const remaining = validator.getRemainingSlots(10);
        expect(remaining).toBe(0);
      });
    });

    describe('isComplete', () => {
      it('should return true when minimums met', () => {
        const result = validator.isComplete(300, 5);
        expect(result.complete).toBe(true);
      });

      it('should return false if BP below minimum', () => {
        const result = validator.isComplete(200, 5);
        expect(result.complete).toBe(false);
        expect(result.missing).toContain('BP');
      });

      it('should return false if characters below minimum', () => {
        const result = validator.isComplete(300, 2);
        expect(result.complete).toBe(false);
        expect(result.missing).toContain('characters');
      });
    });
  });
});

describe('BP Validator - Game Size Recommendations', () => {
  describe('recommendGameSize', () => {
    it('should recommend SMALL for 400 BP and 6 models', () => {
      const result = recommendGameSize(400, 6);
      expect(result.recommended).toBe(GameSize.SMALL);
    });

    it('should recommend MEDIUM for 600 BP and 10 models', () => {
      const result = recommendGameSize(600, 10);
      expect(result.recommended).toBe(GameSize.MEDIUM);
    });

    it('should recommend LARGE for 900 BP and 12 models', () => {
      const result = recommendGameSize(900, 12);
      expect(result.recommended).toBe(GameSize.LARGE);
    });

    it('should provide alternatives', () => {
      const result = recommendGameSize(500, 8);
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('should handle edge cases', () => {
      const result = recommendGameSize(125, 2);
      expect(result.recommended).toBe(GameSize.VERY_SMALL);
    });
  });
});
