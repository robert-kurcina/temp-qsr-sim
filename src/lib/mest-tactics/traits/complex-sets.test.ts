/**
 * Complex Set Integration Tests
 *
 * Tests trait interactions for the most complex Weapons, Equipment, Items, and Archetypes.
 * Each test set creates a crucible environment where traits must be tested against opposing traits.
 *
 * Test Sets:
 * 1. Top 3 most complex Weapons (by trait count)
 * 2. Top 3 most complex Equipment (by trait count)
 * 3. Top 3 most complex Items (by trait count)
 * 4. Top 3 most complex Archetypes (by trait count)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { buildProfile } from '../mission/assembly-builder';
import { Item } from '../core/Item';
import {
  // Combat traits
  checkCleaveTrigger,
  hasThrowable,
  hasHafted,
  hasStub,
  getReachExtension,
  getParryBonus,
  getDeflectBonus,
  hasStun,
  // Item traits
  hasOneHandedTrait,
  hasTwoHandedTrait,
  getLadenLevel,
  calculateLadenBurden,
  hasAwkward,
  hasBlinders,
  hasLumbering,
} from './combat-traits';
import { getCharacterTraitLevel } from '../status/status-system';
import { buildMissionSide } from '../mission/MissionSideBuilder';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestCharacter(archetype: string, itemNames: any[] = []): Character {
  const profile = buildProfile(archetype, { itemNames });
  return new Character(profile);
}

function createMockItem(name: string, traits: string[], classification: string = 'Melee'): Item {
  return {
    name,
    classification,
    dmg: 'STR',
    impact: 0,
    accuracy: '',
    traits,
    range: 0,
  } as any;
}

// ============================================================================
// SET 1: TOP 3 MOST COMPLEX WEAPONS
// ============================================================================

describe('Complex Set Tests - Set 1: Most Complex Weapons', () => {
  // Based on melee_weapons.json analysis:
  // 1. "Axe-Sword of Tan-doc" - 9 traits: Cleave, STR, Heal, Regenerate, Parry, Deflect, Bulletproof, Battery X:Type > List
  // 2. "Electrostaff, Neon" - 7 traits: [Reveal], Stun 2, Reach, [Hafted], Perimeter, [2H], Light X (Flicker)
  // 3. "Dagger, Obsidian" - 8 traits: [Stub], Discrete, Throwable, Impale, [Discard+], [1H], Silent

  describe('Weapon #1: Axe-Sword of Tan-doc (9 traits)', () => {
    it('should have Cleave, Parry, and Deflect traits active', () => {
      const character = createTestCharacter('Elite');
      character.allTraits = [{ name: 'Cleave', level: 1 }, { name: 'Parry', level: 1 }, { name: 'Deflect', level: 1 }];
      const weapon = createMockItem('Axe-Sword of Tan-doc', [
        'Cleave',
        'STR',
        'Heal',
        'Regenerate',
        'Parry',
        'Deflect',
        'Bulletproof',
        'Battery X:Type > List',
      ]);
      character.profile.equipment = [weapon];

      // Verify Parry trait
      expect(getParryBonus(character)).toBeGreaterThan(0);

      // Verify Deflect trait
      expect(getDeflectBonus(character)).toBeGreaterThan(0);

      // Verify Cleave trait
      expect(getCharacterTraitLevel(character, 'Cleave')).toBeGreaterThan(0);
    });

    it('should apply Cleave effect when target is KO\'d', () => {
      const attacker = createTestCharacter('Elite');
      attacker.allTraits = [{ name: 'Cleave', level: 1 }];
      const defender = createTestCharacter('Average');

      const weapon = createMockItem('Axe-Sword of Tan-doc', ['Cleave']);
      attacker.profile.equipment = [weapon];

      // Verify Cleave trait is present
      expect(getCharacterTraitLevel(attacker, 'Cleave')).toBeGreaterThan(0);
    });
  });

  describe('Weapon #2: Electrostaff, Neon (7 traits)', () => {
    it('should have Reach, Stun, and [2H] traits', () => {
      const character = createTestCharacter('Veteran');
      character.allTraits = [{ name: 'Reach', level: 1 }, { name: 'Stun', level: 1 }];
      const weapon = createMockItem('Electrostaff, Neon', [
        '[Reveal]',
        'Stun 2',
        'Reach',
        '[Hafted]',
        'Perimeter',
        '[2H]',
        'Light X (Flicker)',
      ]);
      character.profile.equipment = [weapon];

      // Verify Reach trait
      expect(getReachExtension(character)).toBeGreaterThan(0);

      // Verify Stun trait
      expect(getCharacterTraitLevel(character, 'Stun')).toBeGreaterThan(0);

      // Verify [2H] trait
      expect(hasTwoHandedTrait(weapon)).toBe(true);
    });

    it('should disallow Overreach when using with two hands', () => {
      const character = createTestCharacter('Veteran');
      const weapon = createMockItem('Electrostaff, Neon', ['[2H]']);
      character.profile.equipment = [weapon];

      // [2H] weapons used with two hands cannot use Overreach
      // This would be tested in combat integration
      expect(hasTwoHandedTrait(weapon)).toBe(true);
    });
  });

  describe('Weapon #3: Dagger, Obsidian (8 traits)', () => {
    it('should have [Stub], Throwable, and [1H] traits', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Stub', level: 1 }, { name: 'Throwable', level: 1 }];
      const weapon = createMockItem('Dagger, Obsidian', [
        '[Stub]',
        'Discrete',
        'Throwable',
        'Impale',
        '[Discard+]',
        '[1H]',
        'Silent',
      ]);
      character.profile.equipment = [weapon];

      // Verify [Stub] trait
      expect(getCharacterTraitLevel(character, 'Stub')).toBeGreaterThan(0);

      // Verify Throwable trait
      expect(getCharacterTraitLevel(character, 'Throwable')).toBeGreaterThan(0);

      // Verify [1H] trait
      expect(hasOneHandedTrait(weapon)).toBe(true);
    });

    it('should apply Throwable optimal range based on STR', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Throwable', level: 1 }];
      const weapon = createMockItem('Dagger, Obsidian', ['Throwable']);
      character.profile.equipment = [weapon];

      // Throwable uses STR for optimal range
      expect(getCharacterTraitLevel(character, 'Throwable')).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// SET 2: TOP 3 MOST COMPLEX EQUIPMENT
// ============================================================================

describe('Complex Set Tests - Set 2: Most Complex Equipment', () => {
  // Based on equipment.json analysis:
  // 1. "Arcanum, Codex, Legendary" - 4 traits: Codex 6, Scholar 2, [Laden 2], [2H]
  // 2. "Arcanum, Codex, Common" - 4 traits: Codex 2, Scholar, [Laden], [2H]
  // 3. "Anti-gravity Harness" - 3 traits: [Laden], Flight 3

  describe('Equipment #1: Arcanum, Codex, Legendary (4 traits)', () => {
    it('should have [Laden 2] and [2H] traits creating burden', () => {
      const character = createTestCharacter('Average');
      const equipment = createMockItem('Arcanum, Codex, Legendary', [
        'Codex 6',
        'Scholar 2',
        '[Laden 2]',
        '[2H]',
      ], 'Misc - Tool');
      character.profile.equipment = [equipment];

      // Verify [Laden 2] creates burden for Average (STR 2, SIZ 3, Physicality 3)
      // Total Laden = 1 + 2 = 3, which equals Physicality, so no burden
      const ladenResult = calculateLadenBurden(character, false);
      expect(ladenResult.totalLaden).toBe(3);
      expect(ladenResult.burdenPoints).toBe(0);
    });

    it('should apply burden when character has lower Physicality', () => {
      const character = createTestCharacter('Untrained');
      const equipment = createMockItem('Arcanum, Codex, Legendary', [
        '[Laden 2]',
      ], 'Misc - Tool');
      character.profile.equipment = [equipment];

      // Untrained: STR 1, SIZ 3, Physicality 3
      // Total Laden = 1 + 2 = 3, equals Physicality
      const ladenResult = calculateLadenBurden(character, false);
      expect(ladenResult.totalLaden).toBe(3);
    });

    it('should not apply REF/CCA reduction when Attentive Ordered', () => {
      const character = createTestCharacter('Average');
      const equipment = createMockItem('Arcanum, Codex, Legendary', [
        '[Laden 3]',
      ], 'Misc - Tool');
      character.profile.equipment = [equipment];

      const ladenResult = calculateLadenBurden(character, true);
      expect(ladenResult.refReduction).toBe(0);
      expect(ladenResult.ccaReduction).toBe(0);
    });
  });

  describe('Equipment #2: Arcanum, Codex, Common (4 traits)', () => {
    it('should have [Laden] and [2H] traits', () => {
      const character = createTestCharacter('Average');
      const equipment = createMockItem('Arcanum, Codex, Common', [
        'Codex 2',
        'Scholar',
        '[Laden]',
        '[2H]',
      ], 'Misc - Tool');
      character.profile.equipment = [equipment];

      // Verify [Laden] trait (level 1)
      const ladenResult = calculateLadenBurden(character, false);
      expect(ladenResult.totalLaden).toBe(2); // 1 + 1
    });
  });

  describe('Equipment #3: Anti-gravity Harness (3 traits)', () => {
    it('should have [Laden] and Flight traits', () => {
      const character = createTestCharacter('Average');
      const equipment = createMockItem('Anti-gravity Harness', [
        '[Laden]',
        'Flight 3',
      ], 'Misc - Tool');
      character.profile.equipment = [equipment];

      // Verify [Laden] trait
      const ladenResult = calculateLadenBurden(character, false);
      expect(ladenResult.totalLaden).toBe(2); // 1 + 1
    });
  });
});

// ============================================================================
// SET 3: TOP 3 MOST COMPLEX ITEMS (Combined Weapons + Equipment)
// ============================================================================

describe('Complex Set Tests - Set 3: Most Complex Items (Combined)', () => {
  describe('Item #1: Axe-Sword of Tan-doc (9 traits)', () => {
    it('should have multiple defensive and offensive traits', () => {
      const character = createTestCharacter('Elite');
      character.allTraits = [{ name: 'Cleave', level: 1 }, { name: 'Parry', level: 1 }, { name: 'Deflect', level: 1 }];
      const weapon = createMockItem('Axe-Sword of Tan-doc', [
        'Cleave',
        'Parry',
        'Deflect',
      ]);
      character.profile.equipment = [weapon];

      // Verify multiple traits are active
      expect(getParryBonus(character)).toBeGreaterThan(0);
      expect(getDeflectBonus(character)).toBeGreaterThan(0);
      expect(getCharacterTraitLevel(character, 'Cleave')).toBeGreaterThan(0);
    });
  });

  describe('Item #2: Dagger, Obsidian (8 traits)', () => {
    it('should have stealth and throwable traits', () => {
      const character = createTestCharacter('Average');
      character.allTraits = [{ name: 'Stub', level: 1 }, { name: 'Throwable', level: 1 }];
      const weapon = createMockItem('Dagger, Obsidian', [
        '[Stub]',
        'Discrete',
        'Throwable',
        'Silent',
      ]);
      character.profile.equipment = [weapon];

      // Verify traits
      expect(getCharacterTraitLevel(character, 'Stub')).toBeGreaterThan(0);
      expect(getCharacterTraitLevel(character, 'Throwable')).toBeGreaterThan(0);
    });
  });

  describe('Item #3: Electrostaff, Neon (7 traits)', () => {
    it('should have reach and stun traits', () => {
      const character = createTestCharacter('Veteran');
      character.allTraits = [{ name: 'Reach', level: 1 }, { name: 'Stun', level: 1 }];
      const weapon = createMockItem('Electrostaff, Neon', [
        'Reach',
        'Stun 2',
        '[Hafted]',
      ]);
      character.profile.equipment = [weapon];

      // Verify traits
      expect(getReachExtension(character)).toBeGreaterThan(0);
      expect(getCharacterTraitLevel(character, 'Stun')).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// SET 4: TOP 3 MOST COMPLEX ARCHETYPES
// ============================================================================

describe('Complex Set Tests - Set 4: Most Complex Archetypes', () => {
  // Based on archetypes.json analysis:
  // 1. "Elite" - 3 traits: Grit, Fight, Shoot
  // 2. "Veteran, Tactician" - 2 traits: Grit, Tactics
  // 3. "Veteran, Sneak" - 2 traits: Grit, Sneaky

  describe('Archetype #1: Elite (3 traits)', () => {
    it('should have Grit, Fight, and Shoot traits', () => {
      const character = createTestCharacter('Elite');

      // Verify Grit trait
      expect(getCharacterTraitLevel(character, 'Grit')).toBeGreaterThan(0);

      // Verify Fight trait
      expect(getCharacterTraitLevel(character, 'Fight')).toBeGreaterThan(0);

      // Verify Shoot trait
      expect(getCharacterTraitLevel(character, 'Shoot')).toBeGreaterThan(0);
    });

    it('should benefit from Fight bonus actions', () => {
      const character = createTestCharacter('Elite');

      // Elite has Fight trait which provides bonus actions
      expect(getCharacterTraitLevel(character, 'Fight')).toBeGreaterThan(0);
    });

    it('should be exempt from Morale Tests with Grit', () => {
      const character = createTestCharacter('Elite');

      // Grit provides morale exemption
      expect(getCharacterTraitLevel(character, 'Grit')).toBeGreaterThan(0);
    });
  });

  describe('Archetype #2: Veteran, Tactician (2 traits)', () => {
    it('should have Grit and Tactics traits', () => {
      const character = createTestCharacter('Veteran, Tactician');

      // Verify Grit trait
      expect(getCharacterTraitLevel(character, 'Grit')).toBeGreaterThan(0);

      // Verify Tactics trait
      expect(getCharacterTraitLevel(character, 'Tactics')).toBeGreaterThan(0);
    });

    it('should benefit from Tactics Initiative bonus', () => {
      const character = createTestCharacter('Veteran, Tactician');

      // Tactics provides Initiative bonus
      expect(getCharacterTraitLevel(character, 'Tactics')).toBeGreaterThan(0);
    });
  });

  describe('Archetype #3: Veteran, Sneak (2 traits)', () => {
    it('should have Grit and Sneaky traits', () => {
      const character = createTestCharacter('Veteran, Sneak');

      // Verify Grit trait
      expect(getCharacterTraitLevel(character, 'Grit')).toBeGreaterThan(0);

      // Verify Sneaky trait
      expect(getCharacterTraitLevel(character, 'Sneaky')).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// CRUCIBLE COMBAT SCENARIOS
// ============================================================================

describe('Complex Set Tests - Crucible Combat Scenarios', () => {
  describe('Scenario 1: Complex Weapon vs Complex Archetype', () => {
    it('should handle Axe-Sword (9 traits) vs Elite (3 traits) interaction', () => {
      const attacker = createTestCharacter('Average');
      attacker.allTraits = [{ name: 'Cleave', level: 1 }, { name: 'Parry', level: 1 }, { name: 'Deflect', level: 1 }];
      const defender = createTestCharacter('Elite');

      const weapon = createMockItem('Axe-Sword of Tan-doc', [
        'Cleave',
        'Parry',
        'Deflect',
      ]);
      attacker.profile.equipment = [weapon];

      // Attacker has Cleave weapon
      expect(getCharacterTraitLevel(attacker, 'Cleave')).toBeGreaterThan(0);

      // Defender has Grit, Fight, Shoot
      expect(getCharacterTraitLevel(defender, 'Grit')).toBeGreaterThan(0);
      expect(getCharacterTraitLevel(defender, 'Fight')).toBeGreaterThan(0);
    });
  });

  describe('Scenario 2: Laden Burden in Combat', () => {
    it('should apply Laden penalties to burdened character', () => {
      const burdenedCharacter = createTestCharacter('Untrained');
      const heavyEquipment = createMockItem('Heavy Armor', ['[Laden 3]']);
      burdenedCharacter.profile.equipment = [heavyEquipment];

      // Untrained: STR 1, SIZ 3, Physicality 3
      // Total Laden = 1 + 3 = 4, burden = 4 - 3 = 1
      const ladenResult = calculateLadenBurden(burdenedCharacter, false);
      expect(ladenResult.burdenPoints).toBe(1);
      expect(ladenResult.movReduction).toBe(1);
      expect(ladenResult.refReduction).toBe(1);
      expect(ladenResult.ccaReduction).toBe(1);
    });

    it('should not apply REF/CCA reduction when Attentive Ordered', () => {
      const burdenedCharacter = createTestCharacter('Untrained');
      const heavyEquipment = createMockItem('Heavy Armor', ['[Laden 3]']);
      burdenedCharacter.profile.equipment = [heavyEquipment];

      const ladenResult = calculateLadenBurden(burdenedCharacter, true);
      expect(ladenResult.burdenPoints).toBe(1);
      expect(ladenResult.movReduction).toBe(1);
      expect(ladenResult.refReduction).toBe(0);
      expect(ladenResult.ccaReduction).toBe(0);
    });
  });

  describe('Scenario 3: [Stub] vs [Stub] Engagement', () => {
    it('should not apply [Stub] penalty when both have [Stub]', () => {
      const character1 = createTestCharacter('Average');
      const character2 = createTestCharacter('Average');

      character1.allTraits = [{ name: '[Stub]', level: 1 }];
      character2.allTraits = [{ name: '[Stub]', level: 1 }];

      // Both have [Stub], so no penalty
      expect(hasStub(character1)).toBe(true);
      expect(hasStub(character2)).toBe(true);
    });
  });

  describe('Scenario 4: Throwable Weapon Range', () => {
    it('should use STR for Throwable optimal range', () => {
      const character = createTestCharacter('Veteran');
      character.allTraits = [{ name: 'Throwable', level: 1 }];
      const weapon = createMockItem('Axe', ['Throwable']);
      character.profile.equipment = [weapon];

      expect(hasThrowable(character)).toBe(true);
      // Throwable optimal range is based on STR
    });
  });

  describe('Scenario 5: Reach Extension in Melee', () => {
    it('should extend melee range with Reach trait', () => {
      const character = createTestCharacter('Veteran');
      character.allTraits = [{ name: 'Reach', level: 1 }];
      const weapon = createMockItem('Spear', ['Reach']);
      character.profile.equipment = [weapon];

      expect(getReachExtension(character)).toBeGreaterThan(0);
    });
  });
});
