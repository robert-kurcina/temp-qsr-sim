import { describe, test, expect, beforeEach, vi } from 'vitest';
import { HandManager } from './HandManager.js';
import { Character } from '../core/Character.js';
import { Weapon } from '../core/Weapon.js';
import { TraitParser } from '../../utils/trait-parser.js';

// Mock external modules
vi.mock('../core/Character.js');
vi.mock('../core/Weapon.js');
vi.mock('../../utils/trait-parser.js');

describe('HandManager', () => {
  let character;
  let handManager;

  beforeEach(() => {
    // Mock the TraitParser to return a simple object
    TraitParser.parse.mockImplementation(traitString => ({ name: traitString, params: [] }));

    // Mock character setup
    const config = {
      archetype: {
        name: 'Test Archetype',
        weapons: ['Pistol', 'Rifle'], // 1H and 2H weapons
      },
      armor: {},
    };
    character = new Character(config);
    character.archetype = config.archetype;
    character.armor = config.armor;
    character.incrementFiddleActions = vi.fn();

    // Mock the Weapon constructor
    Weapon.mockImplementation(name => {
      const weapons = {
        Pistol: { name: 'Pistol', rawTraits: ['1H'] },
        Rifle: { name: 'Rifle', rawTraits: ['2H'] },
        Axe: { name: 'Axe', rawTraits: ['2H'] },
        Dagger: { name: 'Dagger', rawTraits: ['1H'] },
        Rock: { name: 'Rock', rawTraits: [] },
      };
      return weapons[name] || { name, rawTraits: [] };
    });

    handManager = new HandManager(character);
  });

  test('initializes with correct hands used', () => {
    expect(handManager.inHand.length).toBe(1);
    expect(handManager.inHand[0].name).toBe('Pistol'); 
    expect(handManager.stowed.length).toBe(1);
    expect(handManager.stowed[0].name).toBe('Rifle');
    expect(handManager.getFreeHands()).toBe(1);
  });

  test('can switch a stowed item to hand if there is space', () => {
    // First, stow the pistol to make space
    const resultStow = handManager.switchItem('Pistol');
    expect(resultStow).toBe('Pistol stowed.');
    expect(handManager.inHand.length).toBe(0);
    expect(handManager.stowed.length).toBe(2);

    // Now, bring the rifle into hand
    const resultSwitch = handManager.switchItem('Rifle');
    expect(resultSwitch).toBe('Rifle is now in hand.');
    expect(handManager.inHand.length).toBe(1);
    expect(handManager.inHand[0].name).toBe('Rifle');
    expect(handManager.stowed.find(w => w.name === 'Rifle')).toBeUndefined();
  });

  test('cannot switch to an item if not enough hands are free', () => {
    const result = handManager.switchItem('Rifle');
    expect(result).toBe('Not enough free hands to switch to Rifle.');
    expect(handManager.inHand.length).toBe(1);
    expect(handManager.inHand[0].name).toBe('Pistol');
  });

  test('correctly identifies hands required for an item', () => {
    const twoHanded = new Weapon('Axe');
    const oneHanded = new Weapon('Dagger');
    const noHanded = new Weapon('Rock');

    expect(handManager.getHandsRequired(twoHanded)).toBe(2);
    expect(handManager.getHandsRequired(oneHanded)).toBe(1);
    expect(handManager.getHandsRequired(noHanded)).toBe(0);
  });

  test('can use a 2H weapon with one hand', () => {
    const rifle = new Weapon('Rifle');
    expect(handManager.canUseItem(rifle, 1)).toBe(true);
  });
});
