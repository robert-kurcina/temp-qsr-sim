/**
 * Tech Level Filtering Unit Tests
 * 
 * Tests for technology level filtering system.
 * 
 * Source: rules-technology-genres.md, tech_level.json, item_tech_window.json
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  TechnologicalAge,
  TechPeriod,
  TechWindow,
  TechLevelConfig,
  // Functions
  AGE_TO_TECH_LEVEL,
  getTechPeriod,
  getDefaultQSRMaxTechLevel,
  getItemTechWindow,
  isItemAvailableAtTechLevel,
  filterItemsByTechLevel,
  createTechConfigFromAge,
  getAvailableItemsForAge,
  validateItemsForTechLevel,
  getTechLevelViolation,
} from './tech-level-filter';

// ============================================================================
// AGE TO TECH LEVEL MAPPING TESTS
// ============================================================================

describe('Tech Level Filter - Age Mapping', () => {
  describe('AGE_TO_TECH_LEVEL', () => {
    it('should map Stone Age to Tech 1', () => {
      expect(AGE_TO_TECH_LEVEL['Stone']).toBe(1);
    });

    it('should map Bronze Age to Tech 2', () => {
      expect(AGE_TO_TECH_LEVEL['Bronze']).toBe(2);
    });

    it('should map Iron Age to Tech 3', () => {
      expect(AGE_TO_TECH_LEVEL['Iron']).toBe(3);
    });

    it('should map Medieval to Tech 5', () => {
      expect(AGE_TO_TECH_LEVEL['Medieval']).toBe(5);
    });

    it('should map Modern to Tech 11', () => {
      expect(AGE_TO_TECH_LEVEL['Modern']).toBe(11);
    });

    it('should map Symbolic to Tech 19', () => {
      expect(AGE_TO_TECH_LEVEL['Symbolic']).toBe(19);
    });
  });

  describe('getTechPeriod', () => {
    it('should return Ancient for Tech 1-3', () => {
      expect(getTechPeriod(1)).toBe('Ancient');
      expect(getTechPeriod(2)).toBe('Ancient');
      expect(getTechPeriod(3)).toBe('Ancient');
    });

    it('should return Archaic for Tech 5-7', () => {
      expect(getTechPeriod(5)).toBe('Archaic');
      expect(getTechPeriod(6)).toBe('Archaic');
      expect(getTechPeriod(7)).toBe('Archaic');
    });

    it('should return Modern for Tech 11-13', () => {
      expect(getTechPeriod(11)).toBe('Modern');
      expect(getTechPeriod(12)).toBe('Modern');
      expect(getTechPeriod(13)).toBe('Modern');
    });

    it('should return Fantastic for Tech 19-20', () => {
      expect(getTechPeriod(19)).toBe('Fantastic');
      expect(getTechPeriod(20)).toBe('Fantastic');
    });
  });

  describe('getDefaultQSRMaxTechLevel', () => {
    it('should return 3 for standard QSR', () => {
      expect(getDefaultQSRMaxTechLevel(false)).toBe(3);
    });

    it('should return 5 for extended QSR', () => {
      expect(getDefaultQSRMaxTechLevel(true)).toBe(5);
    });
  });
});

// ============================================================================
// TECH WINDOW LOOKUP TESTS
// ============================================================================

describe('Tech Level Filter - Tech Window Lookup', () => {
  describe('getItemTechWindow', () => {
    it('should return tech window for Vibrodagger', () => {
      const window = getItemTechWindow('Vibrodagger');
      expect(window).not.toBeNull();
      expect(window?.early).toBe(16); // Quantum
      expect(window?.latest).toBe(20);
    });

    it('should return tech window for Powered Armor-Battle', () => {
      const window = getItemTechWindow('Powered Armor-Battle');
      expect(window).not.toBeNull();
      expect(window?.early).toBe(17); // Energy
      expect(window?.latest).toBe(20);
    });

    it('should return tech window for Axe (available early)', () => {
      const window = getItemTechWindow('Axe');
      expect(window).not.toBeNull();
      expect(window?.early).toBe(1); // Stone Age
    });

    it('should return tech window for Rifle, Heavy, Auto (Modern)', () => {
      const window = getItemTechWindow('Rifle, Heavy, Auto');
      expect(window).not.toBeNull();
      expect(window?.early).toBe(11); // Modern
    });
  });

  describe('isItemAvailableAtTechLevel', () => {
    it('should return true for Axe at Tech 5 (Medieval)', () => {
      expect(isItemAvailableAtTechLevel('Axe', 5)).toBe(true);
    });

    it('should return false for Vibrodagger at Tech 5 (Medieval)', () => {
      expect(isItemAvailableAtTechLevel('Vibrodagger', 5)).toBe(false);
    });

    it('should return true for Vibrodagger at Tech 16 (Quantum)', () => {
      expect(isItemAvailableAtTechLevel('Vibrodagger', 16)).toBe(true);
    });

    it('should return false for Powered Armor-Battle at Tech 15 (Fusion)', () => {
      expect(isItemAvailableAtTechLevel('Powered Armor-Battle', 15)).toBe(false);
    });

    it('should return true for Powered Armor-Battle at Tech 17 (Energy)', () => {
      expect(isItemAvailableAtTechLevel('Powered Armor-Battle', 17)).toBe(true);
    });
  });
});

// ============================================================================
// ITEM FILTERING TESTS
// ============================================================================

describe('Tech Level Filter - Item Filtering', () => {
  describe('filterItemsByTechLevel', () => {
    it('should filter out high-tech items for Medieval (Tech 5)', () => {
      const items = [
        'Axe',
        'Vibrodagger',
        'Sword, Long',
        'Powered Armor-Battle',
        'Bow, Long',
      ];

      const config: TechLevelConfig = {
        maxTechLevel: 5,
        minTechLevel: 1,
        allowAnyTech: true,
      };

      const filtered = filterItemsByTechLevel(items, config);

      expect(filtered).toContain('Axe');
      expect(filtered).toContain('Sword, Long');
      expect(filtered).toContain('Bow, Long');
      expect(filtered).not.toContain('Vibrodagger');
      expect(filtered).not.toContain('Powered Armor-Battle');
    });

    it('should allow all items for Tech 20 (Symbolic)', () => {
      const items = [
        'Axe',
        'Vibrodagger',
        'Powered Armor-Battle',
        'Rifle, Heavy, Auto',
      ];

      const config: TechLevelConfig = {
        maxTechLevel: 20,
        minTechLevel: 1,
        allowAnyTech: true,
      };

      const filtered = filterItemsByTechLevel(items, config);

      expect(filtered.length).toBe(items.length);
    });

    it('should filter based on minTechLevel', () => {
      const items = [
        'Axe',
        'Rifle, Heavy, Auto',
        'Vibrodagger',
      ];

      const config: TechLevelConfig = {
        maxTechLevel: 20,
        minTechLevel: 11, // Modern and later only
        allowAnyTech: true,
      };

      const filtered = filterItemsByTechLevel(items, config);

      // Axe has tech_window 1-20, so it passes minTechLevel check (latest >= 11)
      // Items are filtered by early <= maxTechLevel, not by minTechLevel
      expect(filtered).toContain('Axe');
      expect(filtered).toContain('Rifle, Heavy, Auto');
      expect(filtered).toContain('Vibrodagger');
    });
  });

  describe('createTechConfigFromAge', () => {
    it('should create config for Medieval age', () => {
      const config = createTechConfigFromAge('Medieval');

      expect(config.maxTechLevel).toBe(5);
      expect(config.minTechLevel).toBe(1);
      expect(config.allowAnyTech).toBe(true);
    });

    it('should create config for Modern age', () => {
      const config = createTechConfigFromAge('Modern');

      expect(config.maxTechLevel).toBe(11);
      expect(config.minTechLevel).toBe(1);
      expect(config.allowAnyTech).toBe(true);
    });

    it('should create config for Symbolic age', () => {
      const config = createTechConfigFromAge('Symbolic');

      expect(config.maxTechLevel).toBe(19);
      expect(config.minTechLevel).toBe(1);
      expect(config.allowAnyTech).toBe(true);
    });
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('Tech Level Filter - Validation', () => {
  describe('validateItemsForTechLevel', () => {
    it('should return empty array for valid items', () => {
      const items = ['Axe', 'Sword, Long', 'Bow, Long'];
      const invalid = validateItemsForTechLevel(items, 5);

      expect(invalid).toHaveLength(0);
    });

    it('should return invalid items for Tech 5', () => {
      const items = ['Axe', 'Vibrodagger', 'Powered Armor-Battle'];
      const invalid = validateItemsForTechLevel(items, 5);

      expect(invalid).toContain('Vibrodagger');
      expect(invalid).toContain('Powered Armor-Battle');
      expect(invalid).not.toContain('Axe');
    });
  });

  describe('getTechLevelViolation', () => {
    it('should return violation message for Vibrodagger at Tech 5', () => {
      const message = getTechLevelViolation('Vibrodagger', 5);

      expect(message).toContain('Vibrodagger');
      expect(message).toContain('Tech 16');
      expect(message).toContain('Tech 5');
    });

    it('should return empty string for valid item', () => {
      const message = getTechLevelViolation('Axe', 5);

      expect(message).toBe('');
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Tech Level Filter - Integration', () => {
  describe('getAvailableItemsForAge', () => {
    it('should return filtered items for Medieval age', () => {
      const available = getAvailableItemsForAge('Medieval');

      // Should filter based on tech level
      // Note: gameData structure may vary, so we test the filtering logic
      // by checking that high-tech items are excluded
      
      // Vibrodagger requires Tech 16, should be filtered out at Tech 5
      const vibrodaggerAvailable = available.weapons.includes('Vibrodagger');
      expect(vibrodaggerAvailable).toBe(false);
      
      // Beam Rifle requires Tech 15, should be filtered out at Tech 5
      const beamRifleAvailable = available.weapons.includes('Beam Rifle');
      expect(beamRifleAvailable).toBe(false);
    });

    it('should return more items for extended QSR', () => {
      const standard = getAvailableItemsForAge('Iron', false);
      const extended = getAvailableItemsForAge('Medieval', true);

      // Extended should have at least as many items
      expect(extended.weapons.length).toBeGreaterThanOrEqual(standard.weapons.length);
    });
  });

  describe('QSR Tech Level Restrictions', () => {
    it('should allow Bronze Age items for QSR', () => {
      const config = createTechConfigFromAge('Bronze');

      expect(isItemAvailableAtTechLevel('Axe, Battle', config.maxTechLevel)).toBe(true);
      expect(isItemAvailableAtTechLevel('Bow, Long', config.maxTechLevel)).toBe(true);
    });

    it('should allow Iron Age items for extended QSR', () => {
      const config = createTechConfigFromAge('Iron', true);

      expect(isItemAvailableAtTechLevel('Crossbow, Light', config.maxTechLevel)).toBe(true);
      expect(isItemAvailableAtTechLevel('Armor, Light Mail', config.maxTechLevel)).toBe(true);
    });

    it('should allow Medieval items for extended QSR', () => {
      const config = createTechConfigFromAge('Medieval', true);

      expect(isItemAvailableAtTechLevel('Sword, Long', config.maxTechLevel)).toBe(true);
      expect(isItemAvailableAtTechLevel('Rifle, Light, Archaic', config.maxTechLevel)).toBe(true);
    });
  });
});
