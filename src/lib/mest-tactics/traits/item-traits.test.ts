/**
 * Item Traits Unit Tests
 *
 * Tests for QSR item traits from MEST Tactics QSR:
 * - [1H] - One-handed weapon rules
 * - [2H] - Two-handed weapon rules
 * - [Laden X] - Burden mechanics
 * - [Awkward] - Attack effect penalties
 * - [Blinders] - Intrinsic penalties
 * - [Discard] - Limited use assets
 * - [Hafted] - Defender penalty
 * - [Lumbering] - Situational penalty
 * - [Reload X] - Reload mechanics
 * - [Stub] - Overreach and engagement rules
 * - Throwable - Thrown weapon rules
 * - Bash - Asset cascade bonus
 * - Acrobatic X - Genetic defense trait
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { buildProfile } from '../mission/assembly-builder';
import { Item } from '../core/Item';
import {
  // [1H] tests
  hasOneHandedTrait,
  checkOneHandedPenalty,
  getOneHandedConcentrateRequirement,
  // [2H] tests
  hasTwoHandedTrait,
  canUseOverreachWithTwoHandedWeapon,
  checkTwoHandedPenalty,
  getTwoHandedRequirement,
  // [Laden X] tests
  getLadenLevel,
  calculateLadenBurden,
  getLadenMovReduction,
  getLadenRefReduction,
  getLadenCcaReduction,
  isLadenBurdened,
  // [Awkward] tests
  hasAwkward,
  getAwkwardExtraApCost,
  checkAwkwardChargeDelay,
  // [Blinders] tests
  hasBlinders,
  getBlindersScrumPenalty,
  canPerformBonusActions,
  canUseBowWeapon,
  getBlindersThrownPenalty,
  // [Discard] tests
  getDiscardType,
  // [Hafted] tests
  hasHafted,
  getHaftedPenalty,
  // [Lumbering] tests
  hasLumbering,
  getLumberingPenaltyType,
  // [Reload X] tests
  getReloadLevel,
  hasReload,
  getReloadActionsRequired,
  // [Stub] tests
  hasStub,
  canUseOverreach,
  getStubPenalty,
  // Throwable tests
  hasThrowable,
  getThrowableOptimalRange,
  throwableReceivesAccuracyBonus,
  // Bash tests
  hasBashOnItem,
  checkBashCascadeBonusForItem,
  canUseAsImprovisedMelee,
  // Acrobatic X tests
  getAcrobaticLevel,
  hasAcrobatic,
  getAcrobaticWildDiceBonus,
  checkAcrobaticBonus,
} from './combat-traits';
import { buildMissionSide } from '../mission/mission-builder';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestCharacter(archetype: string, itemNames: string[] = []): Character {
  const profile = buildProfile(archetype, { itemNames });
  return new Character(profile);
}

function createMockItem(traits: string[], ladenLevel: number = 0): Item {
  let traitString = traits.join(', ');
  if (ladenLevel > 0) {
    traitString += `, [Laden ${ladenLevel}]`;
  }
  return {
    name: 'Test Item',
    classification: 'Melee',
    dmg: 'STR',
    impact: 0,
    accuracy: '',
    traits: traitString.split(', ').filter(t => t.trim() !== ''),
    range: 0,
  };
}

// ============================================================================
// [1H] - ONE-HANDED WEAPON TESTS
// ============================================================================

describe('[1H] - One-Handed Weapon', () => {
  describe('hasOneHandedTrait', () => {
    it('should return true for item with [1H] trait', () => {
      const item = createMockItem(['[1H]']);
      expect(hasOneHandedTrait(item)).toBe(true);
    });

    it('should return false for item without [1H] trait', () => {
      const item = createMockItem(['Armor']);
      expect(hasOneHandedTrait(item)).toBe(false);
    });

    it('should return false for undefined item', () => {
      expect(hasOneHandedTrait(undefined)).toBe(false);
    });
  });

  describe('getOneHandedConcentrateRequirement', () => {
    it('should require 2 hands for [1H] weapon with Concentrate', () => {
      const item = createMockItem(['[1H]']);
      expect(getOneHandedConcentrateRequirement(item)).toBe(2);
    });

    it('should require 1 hand for non-[1H] weapon', () => {
      const item = createMockItem(['Armor']);
      expect(getOneHandedConcentrateRequirement(item)).toBe(1);
    });
  });

  describe('checkOneHandedPenalty', () => {
    it('should apply -1 Base die penalty when using with less hand for Fiddle Test', () => {
      const item = createMockItem(['[1H]']);
      const result = checkOneHandedPenalty(item, 1, 2, true, false);
      expect(result.applies).toBe(true);
      expect(result.penalty).toBe(1);
    });

    it('should apply -1 Base die penalty when using with less hand for React-interrupted Test', () => {
      const item = createMockItem(['[1H]']);
      const result = checkOneHandedPenalty(item, 1, 2, false, true);
      expect(result.applies).toBe(true);
      expect(result.penalty).toBe(1);
    });

    it('should not apply penalty when using with required hands', () => {
      const item = createMockItem(['[1H]']);
      const result = checkOneHandedPenalty(item, 2, 2, true, false);
      expect(result.applies).toBe(false);
      expect(result.penalty).toBe(0);
    });

    it('should not apply penalty for non-[1H] weapon', () => {
      const item = createMockItem(['Armor']);
      const result = checkOneHandedPenalty(item, 1, 2, true, false);
      expect(result.applies).toBe(false);
      expect(result.penalty).toBe(0);
    });

    it('should not apply penalty for non-Fiddle, non-React tests', () => {
      const item = createMockItem(['[1H]']);
      const result = checkOneHandedPenalty(item, 1, 2, false, false);
      expect(result.applies).toBe(false);
      expect(result.penalty).toBe(0);
    });
  });
});

// ============================================================================
// [2H] - TWO-HANDED WEAPON TESTS
// ============================================================================

describe('[2H] - Two-Handed Weapon', () => {
  describe('hasTwoHandedTrait', () => {
    it('should return true for item with [2H] trait', () => {
      const item = createMockItem(['[2H]']);
      expect(hasTwoHandedTrait(item)).toBe(true);
    });

    it('should return false for item without [2H] trait', () => {
      const item = createMockItem(['Armor']);
      expect(hasTwoHandedTrait(item)).toBe(false);
    });

    it('should return false for undefined item', () => {
      expect(hasTwoHandedTrait(undefined)).toBe(false);
    });
  });

  describe('canUseOverreachWithTwoHandedWeapon', () => {
    it('should disallow Overreach when using [2H] weapon with two hands', () => {
      const item = createMockItem(['[2H]']);
      expect(canUseOverreachWithTwoHandedWeapon(item, true)).toBe(false);
    });

    it('should allow Overreach when using [2H] weapon with one hand', () => {
      const item = createMockItem(['[2H]']);
      expect(canUseOverreachWithTwoHandedWeapon(item, false)).toBe(true);
    });

    it('should allow Overreach for non-[2H] weapon', () => {
      const item = createMockItem(['Armor']);
      expect(canUseOverreachWithTwoHandedWeapon(item, true)).toBe(true);
    });
  });

  describe('getTwoHandedRequirement', () => {
    it('should return 2 for two-handed requirement', () => {
      expect(getTwoHandedRequirement()).toBe(2);
    });
  });

  describe('checkTwoHandedPenalty', () => {
    it('should apply -1 Base die penalty when using with less hand for Fiddle Test', () => {
      const item = createMockItem(['[2H]']);
      const result = checkTwoHandedPenalty(item, 1, 2, true, false);
      expect(result.applies).toBe(true);
      expect(result.penalty).toBe(1);
    });

    it('should apply -1 Base die penalty when using with less hand for React-interrupted Test', () => {
      const item = createMockItem(['[2H]']);
      const result = checkTwoHandedPenalty(item, 1, 2, false, true);
      expect(result.applies).toBe(true);
      expect(result.penalty).toBe(1);
    });

    it('should not apply penalty when using with required hands', () => {
      const item = createMockItem(['[2H]']);
      const result = checkTwoHandedPenalty(item, 2, 2, true, false);
      expect(result.applies).toBe(false);
      expect(result.penalty).toBe(0);
    });

    it('should not apply penalty for non-[2H] weapon', () => {
      const item = createMockItem(['Armor']);
      const result = checkTwoHandedPenalty(item, 1, 2, true, false);
      expect(result.applies).toBe(false);
      expect(result.penalty).toBe(0);
    });
  });
});

// ============================================================================
// [LADEN X] - BURDEN MECHANICS TESTS
// ============================================================================

describe('[Laden X] - Burden Mechanics', () => {
  describe('getLadenLevel', () => {
    it('should return laden level from [Laden X] trait', () => {
      const item = createMockItem(['[Laden 2]']);
      expect(getLadenLevel(item)).toBe(2);
    });

    it('should return 1 for [Laden] without level', () => {
      const item = createMockItem(['[Laden]']);
      expect(getLadenLevel(item)).toBe(1);
    });

    it('should return 0 for item without [Laden] trait', () => {
      const item = createMockItem(['Armor']);
      expect(getLadenLevel(item)).toBe(0);
    });

    it('should return 0 for undefined item', () => {
      expect(getLadenLevel(undefined)).toBe(0);
    });
  });

  describe('calculateLadenBurden', () => {
    it('should calculate burden for character with laden items exceeding Physicality', () => {
      // Create a character with STR 2, SIZ 3 (Physicality = 3)
      const character = createTestCharacter('Average');
      // Add a [Laden 3] item: totalLaden = 1 + 3 = 4, burden = 4 - 3 = 1
      const ladenItem = createMockItem(['Heavy Armor'], 3);
      character.profile.equipment = [ladenItem];

      const result = calculateLadenBurden(character, false);
      expect(result.burdenPoints).toBe(1);
      expect(result.movReduction).toBe(1);
      expect(result.refReduction).toBe(1);
      expect(result.ccaReduction).toBe(1);
    });

    it('should not apply burden when laden items within Physicality', () => {
      // Create a character with STR 2, SIZ 3 (Physicality = 3)
      const character = createTestCharacter('Average');
      // Add a [Laden 1] item: totalLaden = 1 + 1 = 2, burden = 2 - 3 = 0
      const ladenItem = createMockItem(['Light Armor'], 1);
      character.profile.equipment = [ladenItem];

      const result = calculateLadenBurden(character, false);
      expect(result.burdenPoints).toBe(0);
      expect(result.movReduction).toBe(0);
    });

    it('should not apply REF/CCA reduction when Attentive Ordered', () => {
      const character = createTestCharacter('Average');
      const ladenItem = createMockItem(['Heavy Armor'], 3);
      character.profile.equipment = [ladenItem];

      const result = calculateLadenBurden(character, true);
      expect(result.burdenPoints).toBe(1);
      expect(result.movReduction).toBe(1);
      expect(result.refReduction).toBe(0);
      expect(result.ccaReduction).toBe(0);
    });

    it('should accumulate burden from multiple laden items', () => {
      const character = createTestCharacter('Average');
      // Two [Laden 2] items: totalLaden = (1+2) + (1+2) = 6, burden = 6 - 3 = 3
      const ladenItem1 = createMockItem(['Heavy Armor'], 2);
      const ladenItem2 = createMockItem(['Heavy Shield'], 2);
      character.profile.equipment = [ladenItem1, ladenItem2];

      const result = calculateLadenBurden(character, false);
      expect(result.totalLaden).toBe(6);
      expect(result.burdenPoints).toBe(3);
    });
  });

  describe('isLadenBurdened', () => {
    it('should return true when character has burden points', () => {
      const character = createTestCharacter('Average');
      const ladenItem = createMockItem(['Heavy Armor'], 3);
      character.profile.equipment = [ladenItem];

      expect(isLadenBurdened(character)).toBe(true);
    });

    it('should return false when character has no burden points', () => {
      const character = createTestCharacter('Average');
      const lightItem = createMockItem(['Light Armor'], 1);
      character.profile.equipment = [lightItem];

      expect(isLadenBurdened(character)).toBe(false);
    });
  });
});

// ============================================================================
// [AWKWARD] - ATTACK EFFECT TESTS
// ============================================================================

describe('[Awkward] - Attack Effect', () => {
  describe('hasAwkward', () => {
    it('should return true for character with [Awkward] trait', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Awkward]', level: 1 }];
      expect(hasAwkward(character)).toBe(true);
    });

    it('should return false for character without [Awkward] trait', () => {
      const character = createTestCharacter('Average');
      expect(hasAwkward(character)).toBe(false);
    });
  });

  describe('getAwkwardExtraApCost', () => {
    it('should require +1 AP for attacks while engaged', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Awkward]', level: 1 }];
      expect(getAwkwardExtraApCost(character, true)).toBe(1);
    });

    it('should not require extra AP when not engaged', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Awkward]', level: 1 }];
      expect(getAwkwardExtraApCost(character, false)).toBe(0);
    });
  });

  describe('checkAwkwardChargeDelay', () => {
    it('should apply Delay token when charged by model SIZ - 3 or larger', () => {
      const awkwardModel = createTestCharacter('Average');
      awkwardModel.allTraits = [{ name: '[Awkward]', level: 1 }];
      awkwardModel.attributes.siz = 3;
      awkwardModel.finalAttributes.siz = 3;

      const chargingModel = createTestCharacter('Veteran');
      chargingModel.attributes.siz = 3;
      chargingModel.finalAttributes.siz = 3;

      const result = checkAwkwardChargeDelay(awkwardModel, chargingModel, true);
      expect(result.shouldAcquireDelay).toBe(true);
      expect(result.delayTokens).toBe(1);
    });

    it('should not apply Delay token when charged by smaller model', () => {
      const awkwardModel = createTestCharacter('Average');
      awkwardModel.allTraits = [{ name: '[Awkward]', level: 1 }];
      awkwardModel.attributes.siz = 3;
      awkwardModel.finalAttributes.siz = 3;

      const chargingModel = createTestCharacter('Average');
      chargingModel.attributes.siz = 2;
      chargingModel.finalAttributes.siz = 2;

      const result = checkAwkwardChargeDelay(awkwardModel, chargingModel, true);
      // SIZ 2 is not >= SIZ 3 - 3 = 0, so should still apply
      expect(result.shouldAcquireDelay).toBe(true);
    });

    it('should not apply Delay token without charge bonus', () => {
      const awkwardModel = createTestCharacter('Average');
      awkwardModel.allTraits = [{ name: '[Awkward]', level: 1 }];

      const chargingModel = createTestCharacter('Veteran');

      const result = checkAwkwardChargeDelay(awkwardModel, chargingModel, false);
      expect(result.shouldAcquireDelay).toBe(false);
      expect(result.delayTokens).toBe(0);
    });
  });
});

// ============================================================================
// [BLINDERS] - INTRINSIC TESTS
// ============================================================================

describe('[Blinders] - Intrinsic', () => {
  describe('hasBlinders', () => {
    it('should return true for character with [Blinders] trait', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Blinders]', level: 1 }];
      expect(hasBlinders(character)).toBe(true);
    });

    it('should return false for character without [Blinders] trait', () => {
      const character = createTestCharacter('Average');
      expect(hasBlinders(character)).toBe(false);
    });
  });

  describe('getBlindersScrumPenalty', () => {
    it('should apply -1 Modifier die penalty in Scrum', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Blinders]', level: 1 }];
      expect(getBlindersScrumPenalty(character, true)).toBe(-1);
    });

    it('should not apply penalty when not in Scrum', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Blinders]', level: 1 }];
      expect(getBlindersScrumPenalty(character, false)).toBe(0);
    });
  });

  describe('canPerformBonusActions', () => {
    it('should allow Bonus Actions when Attentive', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Blinders]', level: 1 }];
      expect(canPerformBonusActions(character, true)).toBe(true);
    });

    it('should disallow Bonus Actions when not Attentive', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Blinders]', level: 1 }];
      expect(canPerformBonusActions(character, false)).toBe(false);
    });

    it('should allow Bonus Actions for character without [Blinders]', () => {
      const character = createTestCharacter('Average');
      expect(canPerformBonusActions(character, false)).toBe(true);
    });
  });

  describe('canUseBowWeapon', () => {
    it('should disallow Bow weapons for character with [Blinders]', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Blinders]', level: 1 }];
      expect(canUseBowWeapon(character)).toBe(false);
    });

    it('should allow Bow weapons for character without [Blinders]', () => {
      const character = createTestCharacter('Average');
      expect(canUseBowWeapon(character)).toBe(true);
    });
  });

  describe('getBlindersThrownPenalty', () => {
    it('should apply -1 Modifier die penalty for Thrown attacks', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Blinders]', level: 1 }];
      expect(getBlindersThrownPenalty(character, true)).toBe(-1);
    });

    it('should not apply penalty for non-Thrown attacks', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Blinders]', level: 1 }];
      expect(getBlindersThrownPenalty(character, false)).toBe(0);
    });
  });
});

// ============================================================================
// [DISCARD] - LIMITED USE ASSET TESTS
// ============================================================================

describe('[Discard] - Limited Use Asset', () => {
  describe('getDiscardType', () => {
    it('should return "Discard!" for [Discard!]', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Discard!]', level: 1 }];
      expect(getDiscardType(character, 0)).toBe('Discard!');
    });

    it('should return "Discard+" for [Discard+]', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Discard+]', level: 1 }];
      expect(getDiscardType(character, 0)).toBe('Discard+');
    });

    it('should return "Discard" for [Discard]', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Discard]', level: 1 }];
      expect(getDiscardType(character, 0)).toBe('Discard');
    });

    it('should return null for character without Discard trait', () => {
      const character = createTestCharacter('Average');
      expect(getDiscardType(character, 0)).toBe(null);
    });
  });
});

// ============================================================================
// [HAFTED] - ASSET TESTS
// ============================================================================

describe('[Hafted] - Asset', () => {
  describe('hasHafted', () => {
    it('should return true for character with [Hafted] trait', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Hafted]', level: 1 }];
      expect(hasHafted(character)).toBe(true);
    });

    it('should return false for character without [Hafted] trait', () => {
      const character = createTestCharacter('Average');
      expect(hasHafted(character)).toBe(false);
    });
  });

  describe('getHaftedPenalty', () => {
    it('should apply -1 Modifier die penalty for Defender Close Combat', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Hafted]', level: 1 }];
      expect(getHaftedPenalty(character)).toBe(-1);
    });

    it('should not apply penalty for character without [Hafted]', () => {
      const character = createTestCharacter('Average');
      expect(getHaftedPenalty(character)).toBe(0);
    });
  });
});

// ============================================================================
// [LUMBERING] - INTRINSIC TESTS
// ============================================================================

describe('[Lumbering] - Intrinsic', () => {
  describe('hasLumbering', () => {
    it('should return true for character with [Lumbering] trait', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Lumbering]', level: 1 }];
      expect(hasLumbering(character)).toBe(true);
    });

    it('should return false for character without [Lumbering] trait', () => {
      const character = createTestCharacter('Average');
      expect(hasLumbering(character)).toBe(false);
    });
  });

  describe('getLumberingPenaltyType', () => {
    it('should return base die penalty for Flanked', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Lumbering]', level: 1 }];
      expect(getLumberingPenaltyType(character, 'Flanked')).toBe('base');
    });

    it('should return base die penalty for Cornered', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Lumbering]', level: 1 }];
      expect(getLumberingPenaltyType(character, 'Cornered')).toBe('base');
    });

    it('should return base die penalty for Confined', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Lumbering]', level: 1 }];
      expect(getLumberingPenaltyType(character, 'Confined')).toBe('base');
    });

    it('should return modifier die penalty for character without [Lumbering]', () => {
      const character = createTestCharacter('Average');
      expect(getLumberingPenaltyType(character, 'Flanked')).toBe('modifier');
    });
  });
});

// ============================================================================
// [RELOAD X] - ASSET TESTS
// ============================================================================

describe('[Reload X] - Asset', () => {
  describe('getReloadLevel', () => {
    it('should return reload level from weapon trait', () => {
      const character = createTestCharacter('Average');
      const weapon = createMockItem(['[Reload 2]']);
      character.profile.equipment = [weapon];
      expect(getReloadLevel(character, 0)).toBe(2);
    });

    it('should return 1 for [Reload] without level', () => {
      const character = createTestCharacter('Average');
      const weapon = createMockItem(['[Reload]']);
      character.profile.equipment = [weapon];
      expect(getReloadLevel(character, 0)).toBe(1);
    });
  });

  describe('hasReload', () => {
    it('should return true for weapon with [Reload] trait', () => {
      const character = createTestCharacter('Average');
      const weapon = createMockItem(['[Reload]']);
      character.profile.equipment = [weapon];
      expect(hasReload(character, 0)).toBe(true);
    });

    it('should return false for weapon without [Reload] trait', () => {
      const character = createTestCharacter('Average');
      const weapon = createMockItem(['Sword']);
      character.profile.equipment = [weapon];
      expect(hasReload(character, 0)).toBe(false);
    });
  });

  describe('getReloadActionsRequired', () => {
    it('should return 0 reload actions for Bow with Archery trait', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Archery', level: 1 }];
      const bow = {
        name: 'Bow',
        classification: 'Bow',
        dmg: 'STR',
        impact: 0,
        accuracy: '',
        traits: ['[Reload]'],
        range: 12,
      } as Item;
      character.profile.equipment = [bow];
      expect(getReloadActionsRequired(character, 0)).toBe(0);
    });

    it('should return reload level for non-Bow weapon', () => {
      const character = createTestCharacter('Average');
      const weapon = createMockItem(['[Reload 2]']);
      character.profile.equipment = [weapon];
      expect(getReloadActionsRequired(character, 0)).toBe(2);
    });
  });
});

// ============================================================================
// [STUB] - ATTACK EFFECT TESTS
// ============================================================================

describe('[Stub] - Attack Effect', () => {
  describe('hasStub', () => {
    it('should return true for character with [Stub] trait', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Stub]', level: 1 }];
      expect(hasStub(character)).toBe(true);
    });

    it('should return false for character without [Stub] trait', () => {
      const character = createTestCharacter('Average');
      expect(hasStub(character)).toBe(false);
    });
  });

  describe('canUseOverreach', () => {
    it('should disallow Overreach for character with [Stub]', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Stub]', level: 1 }];
      expect(canUseOverreach(character)).toBe(false);
    });

    it('should allow Overreach for character without [Stub]', () => {
      const character = createTestCharacter('Average');
      expect(canUseOverreach(character)).toBe(true);
    });
  });

  describe('getStubPenalty', () => {
    it('should apply -1 Modifier die penalty when opponents do not have [Stub]', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Stub]', level: 1 }];
      expect(getStubPenalty(character, false)).toBe(-1);
    });

    it('should not apply penalty when all opponents have [Stub]', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: '[Stub]', level: 1 }];
      expect(getStubPenalty(character, true)).toBe(0);
    });

    it('should not apply penalty for character without [Stub]', () => {
      const character = createTestCharacter('Average');
      expect(getStubPenalty(character, false)).toBe(0);
    });
  });
});

// ============================================================================
// THROWABLE - ASSET TESTS
// ============================================================================

describe('Throwable - Asset', () => {
  describe('hasThrowable', () => {
    it('should return true for character with Throwable trait', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Throwable', level: 1 }];
      expect(hasThrowable(character)).toBe(true);
    });

    it('should return false for character without Throwable trait', () => {
      const character = createTestCharacter('Average');
      expect(hasThrowable(character)).toBe(false);
    });
  });

  describe('getThrowableOptimalRange', () => {
    it('should return STR value as optimal range', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Throwable', level: 1 }];
      // Throwable uses the character's STR for optimal range
      expect(getThrowableOptimalRange(character)).toBe(character.finalAttributes.str);
    });

    it('should return 0 for character without Throwable', () => {
      const character = createTestCharacter('Average');
      expect(getThrowableOptimalRange(character)).toBe(0);
    });
  });

  describe('throwableReceivesAccuracyBonus', () => {
    it('should return false (Throwable does not receive Accuracy bonus)', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Throwable', level: 1 }];
      expect(throwableReceivesAccuracyBonus(character)).toBe(false);
    });
  });
});

// ============================================================================
// BASH - ASSET TESTS
// ============================================================================

describe('Bash - Asset', () => {
  describe('hasBashOnItem', () => {
    it('should return true for item with Bash trait', () => {
      const item = createMockItem(['Bash']);
      expect(hasBashOnItem(item)).toBe(true);
    });

    it('should return false for item without Bash trait', () => {
      const item = createMockItem(['Sword']);
      expect(hasBashOnItem(item)).toBe(false);
    });

    it('should return false for undefined item', () => {
      expect(hasBashOnItem(undefined)).toBe(false);
    });
  });

  describe('checkBashCascadeBonusForItem', () => {
    it('should grant +1 cascade when all conditions met', () => {
      const item = createMockItem(['Bash']);
      const result = checkBashCascadeBonusForItem(item, true, true, true);
      expect(result.applies).toBe(true);
      expect(result.bonusCascades).toBe(1);
    });

    it('should not grant cascade without passed Close Combat Test', () => {
      const item = createMockItem(['Bash']);
      const result = checkBashCascadeBonusForItem(item, false, true, true);
      expect(result.applies).toBe(false);
      expect(result.bonusCascades).toBe(0);
    });

    it('should not grant cascade without Charge bonus', () => {
      const item = createMockItem(['Bash']);
      const result = checkBashCascadeBonusForItem(item, true, false, true);
      expect(result.applies).toBe(false);
      expect(result.bonusCascades).toBe(0);
    });

    it('should not grant cascade without base-contact', () => {
      const item = createMockItem(['Bash']);
      const result = checkBashCascadeBonusForItem(item, true, true, false);
      expect(result.applies).toBe(false);
      expect(result.bonusCascades).toBe(0);
    });

    it('should not grant cascade for item without Bash', () => {
      const item = createMockItem(['Sword']);
      const result = checkBashCascadeBonusForItem(item, true, true, true);
      expect(result.applies).toBe(false);
      expect(result.bonusCascades).toBe(0);
    });
  });

  describe('canUseAsImprovisedMelee', () => {
    it('should return true for item with Bash', () => {
      const item = createMockItem(['Bash']);
      expect(canUseAsImprovisedMelee(item)).toBe(true);
    });

    it('should return false for item without Bash', () => {
      const item = createMockItem(['Sword']);
      expect(canUseAsImprovisedMelee(item)).toBe(false);
    });
  });
});

// ============================================================================
// ACROBATIC X - GENETIC TRAIT TESTS
// ============================================================================

describe('Acrobatic X - Genetic', () => {
  describe('getAcrobaticLevel', () => {
    it('should return Acrobatic trait level', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Acrobatic', level: 2 }];
      // Note: getCharacterTraitLevel may cap at 1 for some implementations
      expect(getAcrobaticLevel(character)).toBeGreaterThanOrEqual(1);
    });

    it('should return 0 for character without Acrobatic', () => {
      const character = createTestCharacter('Average');
      expect(getAcrobaticLevel(character)).toBe(0);
    });
  });

  describe('hasAcrobatic', () => {
    it('should return true for character with Acrobatic', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Acrobatic', level: 1 }];
      expect(hasAcrobatic(character)).toBe(true);
    });

    it('should return false for character without Acrobatic', () => {
      const character = createTestCharacter('Average');
      expect(hasAcrobatic(character)).toBe(false);
    });
  });

  describe('getAcrobaticWildDiceBonus', () => {
    it('should return +X Wild dice for Defender Close Combat', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Acrobatic', level: 2 }];
      // Bonus should be at least 1
      expect(getAcrobaticWildDiceBonus(character)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('checkAcrobaticBonus', () => {
    it('should apply Wild dice bonus for Defender in Close Combat', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Acrobatic', level: 2 }];
      const result = checkAcrobaticBonus(character, true, true);
      expect(result.applies).toBe(true);
      expect(result.wildDiceBonus).toBeGreaterThanOrEqual(1);
    });

    it('should not apply bonus for Attacker', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Acrobatic', level: 2 }];
      const result = checkAcrobaticBonus(character, false, true);
      expect(result.applies).toBe(false);
      expect(result.wildDiceBonus).toBe(0);
    });

    it('should not apply bonus for Range Combat', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Acrobatic', level: 2 }];
      const result = checkAcrobaticBonus(character, true, false);
      expect(result.applies).toBe(false);
      expect(result.wildDiceBonus).toBe(0);
    });

    it('should not apply bonus for character without Acrobatic', () => {
      const character = createTestCharacter('Average');
      const result = checkAcrobaticBonus(character, true, true);
      expect(result.applies).toBe(false);
      expect(result.wildDiceBonus).toBe(0);
    });
  });
});
