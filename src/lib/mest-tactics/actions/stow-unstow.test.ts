/**
 * Stow/Unstow Items Tests
 *
 * Tests for QSR Lines 270-271: Using Fiddle action to switch out stowed items.
 * QSR Reference: Hand Requirements, Fiddle Action
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Item } from '../core/Item';
import { SimpleActionDeps } from './simple-actions';
import { executeStowItem, executeUnstowItem, executeSwapItem } from './simple-actions';

// Helper to create test character
function createTestCharacter(name: string, totalHands: number = 2): Character {
  const profile: Profile = {
    name,
    archetype: 'Average' as any,
    attributes: {
      cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 4, siz: 3,
    },
    finalAttributes: {
      cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 4, siz: 3,
    },
    totalBp: 30,
    adjustedBp: 30,
    physicality: 2,
    durability: 3,
    burden: { totalBurden: 0, totalLaden: 0, items: [] },
    totalHands,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
    items: [],
    equipment: [],
    inHandItems: [],
    stowedItems: [],
  };
  
  const character = new Character(profile);
  character.id = name;
  character.name = name;
  return character;
}

// Helper to create test item
function createTestItem(name: string, hands: number = 1, classification: string = 'Melee'): Item {
  return {
    name,
    classification,
    class: classification,
    type: 'Weapon',
    bp: 10,
    or: '5"',
    accuracy: '+0',
    impact: 1,
    dmg: 'STR',
    traits: hands === 2 ? ['[2H]'] : hands === 1 ? ['[1H]'] : [],
  };
}

// Mock SimpleActionDeps
function createMockDeps(): SimpleActionDeps {
  const fiddleUsed = new Set<string>();
  
  return {
    spendAp: (character, cost) => true,
    setWaiting: (character) => {},
    isOutnumberedForWait: (character) => false,
    setCharacterStatus: (characterId, status) => {},
    markRallyUsed: (characterId) => {},
    markReviveUsed: (characterId) => {},
    markFiddleUsed: (characterId) => { fiddleUsed.add(characterId); },
    hasRallyUsed: (characterId) => false,
    hasReviveUsed: (characterId) => false,
    hasFiddleUsed: (characterId) => fiddleUsed.has(characterId),
  };
}

describe('Stow/Unstow Items', () => {
  let deps: SimpleActionDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  describe('executeStowItem', () => {
    it('should stow in-hand item to stowedItems', () => {
      const character = createTestCharacter('Warrior');
      const sword = createTestItem('Sword', 1);
      character.profile.inHandItems = [sword];
      character.profile.stowedItems = [];
      
      const result = executeStowItem(deps, character, { itemName: 'Sword' });
      
      expect(result.success).toBe(true);
      expect(result.itemStowed).toBe(sword);
      expect(character.profile.inHandItems.length).toBe(0);
      expect(character.profile.stowedItems.length).toBe(1);
      expect(character.profile.stowedItems[0]).toBe(sword);
    });

    it('should fail with no items in hand', () => {
      const character = createTestCharacter('Unarmed');
      character.profile.inHandItems = [];
      
      const result = executeStowItem(deps, character);
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('No items in hand');
    });

    it('should fail with invalid item name', () => {
      const character = createTestCharacter('Warrior');
      character.profile.inHandItems = [createTestItem('Sword', 1)];
      
      const result = executeStowItem(deps, character, { itemName: 'Axe' });
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Invalid item');
    });

    it('should stow last item by default', () => {
      const character = createTestCharacter('Warrior');
      const sword = createTestItem('Sword', 1);
      const axe = createTestItem('Axe', 1);
      character.profile.inHandItems = [sword, axe];
      
      const result = executeStowItem(deps, character);
      
      expect(result.success).toBe(true);
      expect(result.itemStowed).toBe(axe); // Last item
      expect(character.profile.inHandItems.length).toBe(1);
    });
  });

  describe('executeUnstowItem', () => {
    it('should draw stowed item to inHandItems', () => {
      const character = createTestCharacter('Warrior');
      const sword = createTestItem('Sword', 1);
      character.profile.inHandItems = [];
      character.profile.stowedItems = [sword];
      
      const result = executeUnstowItem(deps, character, { itemName: 'Sword' });
      
      expect(result.success).toBe(true);
      expect(result.itemDrawn).toBe(sword);
      expect(character.profile.inHandItems.length).toBe(1);
      expect(character.profile.stowedItems.length).toBe(0);
    });

    it('should fail with no stowed items', () => {
      const character = createTestCharacter('Warrior');
      character.profile.stowedItems = [];
      
      const result = executeUnstowItem(deps, character);
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('No stowed items');
    });

    it('should fail with insufficient hands', () => {
      const character = createTestCharacter('OneHanded', 1); // Only 1 hand
      const greatsword = createTestItem('Greatsword', 2); // [2H] weapon
      character.profile.stowedItems = [greatsword];
      character.profile.inHandItems = [createTestItem('Shield', 1)];
      
      const result = executeUnstowItem(deps, character, { itemName: 'Greatsword' });
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Not enough hands');
    });

    it('should succeed with sufficient hands', () => {
      const character = createTestCharacter('TwoHanded', 2);
      const greatsword = createTestItem('Greatsword', 2);
      character.profile.stowedItems = [greatsword];
      character.profile.inHandItems = [];
      
      const result = executeUnstowItem(deps, character, { itemName: 'Greatsword' });
      
      expect(result.success).toBe(true);
      expect(character.profile.inHandItems.length).toBe(1);
    });

    it('should fail with invalid item name', () => {
      const character = createTestCharacter('Warrior');
      character.profile.stowedItems = [createTestItem('Sword', 1)];
      
      const result = executeUnstowItem(deps, character, { itemName: 'Axe' });
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Invalid item');
    });
  });

  describe('executeSwapItem', () => {
    it('should succeed with valid swap', () => {
      const character = createTestCharacter('Warrior');
      const sword = createTestItem('Sword', 1);
      const axe = createTestItem('Axe', 1);
      character.profile.inHandItems = [sword];
      character.profile.stowedItems = [axe];
      
      const result = executeSwapItem(deps, character, {
        stowItemName: 'Sword',
        drawItemName: 'Axe',
      });
      
      expect(result.success).toBe(true);
      expect(result.itemStowed).toBe(sword);
      expect(result.itemDrawn).toBe(axe);
      expect(character.profile.inHandItems.length).toBe(1);
      expect(character.profile.inHandItems[0]).toBe(axe);
      expect(character.profile.stowedItems.length).toBe(1);
      expect(character.profile.stowedItems[0]).toBe(sword);
    });

    it('should rollback on draw failure', () => {
      const character = createTestCharacter('OneHanded', 1);
      const sword = createTestItem('Sword', 1);
      const greatsword = createTestItem('Greatsword', 2); // [2H]
      character.profile.inHandItems = [sword];
      character.profile.stowedItems = [greatsword];
      
      const result = executeSwapItem(deps, character, {
        stowItemName: 'Sword',
        drawItemName: 'Greatsword',
      });
      
      expect(result.success).toBe(false);
      // Sword should be restored to in-hand
      expect(character.profile.inHandItems.length).toBe(1);
      expect(character.profile.inHandItems[0]).toBe(sword);
    });

    it('should fail on stow failure', () => {
      const character = createTestCharacter('Warrior');
      character.profile.inHandItems = []; // Nothing to stow
      character.profile.stowedItems = [createTestItem('Axe', 1)];
      
      const result = executeSwapItem(deps, character, {
        drawItemName: 'Axe',
      });
      
      expect(result.success).toBe(false);
    });
  });
});
