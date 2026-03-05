
import { describe, it, expect, beforeEach } from 'vitest';
import { getCompulsoryActions, isNervous, isDisordered, isPanicked, isEliminatedByFear } from './compulsory-actions';
import type { Character } from '../core/Character';

// Mock Character Data for testing
const createMockCharacter = (): Character => ({
  id: 'char-1',
  name: 'Test Character',
  profile: { archetype: 'Warrior', equipment: [] },
  finalAttributes: { wil: 10 }, // Willpower for morale tests
  allTraits: [],
  state: {
    wounds: 0,
    delayTokens: 0,
    fearTokens: 0,
    isHidden: false,
    isWaiting: false,
    isDisordered: false,
    isDistracted: false,
    isEngaged: false,
    isInCover: false,
    isKOd: false,
    isEliminated: false,
    statusEffects: [],
    armor: { total: 0, suit: 0, gear: 0, shield: 0, helm: 0 },
  },
} as any);

let character: Character;

describe('Morale State Utility Functions', () => {
  beforeEach(() => {
    character = createMockCharacter();
  });

  it('isNervous should be true for 1+ fear tokens', () => {
    character.state.fearTokens = 1;
    expect(isNervous(character)).toBe(true);
    character.state.fearTokens = 0;
    expect(isNervous(character)).toBe(false);
  });

  it('isDisordered should be true for 2+ fear tokens', () => {
    character.state.fearTokens = 2;
    expect(isDisordered(character)).toBe(true);
    character.state.fearTokens = 1;
    expect(isDisordered(character)).toBe(false);
  });

  it('isPanicked should be true for 3+ fear tokens', () => {
    character.state.fearTokens = 3;
    expect(isPanicked(character)).toBe(true);
    character.state.fearTokens = 2;
    expect(isPanicked(character)).toBe(false);
  });

  it('isEliminatedByFear should be true for 4+ fear tokens', () => {
    character.state.fearTokens = 4;
    expect(isEliminatedByFear(character)).toBe(true);
    character.state.fearTokens = 3;
    expect(isEliminatedByFear(character)).toBe(false);
  });
});

describe('getCompulsoryActions', () => {
  beforeEach(() => {
    character = createMockCharacter();
  });

  it('should return no actions for a character with 0 fear tokens', () => {
    const actions = getCompulsoryActions(character);
    expect(actions).toHaveLength(0);
  });

  it('should return no actions for a Nervous character (1 fear token)', () => {
    character.state.fearTokens = 1;
    const actions = getCompulsoryActions(character);
    expect(actions).toHaveLength(0);
  });

  describe('Disordered Character (2 Fear Tokens)', () => {
    beforeEach(() => {
      character.state.fearTokens = 2;
    });

    it('should require a Disengage action if Engaged', () => {
      character.state.isEngaged = true;
      const actions = getCompulsoryActions(character);
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('Disengage');
      expect(actions[0].apCost).toBe(1);
    });

    it('should require a Move action if not Engaged and not in Cover', () => {
      character.state.isEngaged = false;
      character.state.isInCover = false;
      const actions = getCompulsoryActions(character);
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('Move');
      expect(actions[0].apCost).toBe(1);
      expect(actions[0].description).toContain('the nearest Cover or location out of enemy LOS');
    });

    it('should require a Rally action if in Cover and not Engaged', () => {
      character.state.isEngaged = false;
      character.state.isInCover = true;
      const actions = getCompulsoryActions(character);
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('Rally');
      expect(actions[0].apCost).toBe(1);
    });
  });

  describe('Panicked Character (3 Fear Tokens)', () => {
    beforeEach(() => {
      character.state.fearTokens = 3;
    });

    it('should require a Disengage action (2 AP) if Engaged', () => {
      character.state.isEngaged = true;
      const actions = getCompulsoryActions(character);
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('Disengage');
      expect(actions[0].apCost).toBe(2);
    });

    it('should require a Move action (2 AP) if not Engaged and not in Cover', () => {
      character.state.isEngaged = false;
      character.state.isInCover = false;
      const actions = getCompulsoryActions(character);
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('Move');
      expect(actions[0].apCost).toBe(2);
      expect(actions[0].description).toContain('the nearest Friendly battlefield entry edge');
    });

    it('should require a Rally action (2 AP) if in Cover and not Engaged', () => {
      character.state.isEngaged = false;
      character.state.isInCover = true;
      const actions = getCompulsoryActions(character);
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('Rally');
      expect(actions[0].apCost).toBe(2);
    });
  });

  describe('Elimination by Fear (4+ Fear Tokens)', () => {
    it('should return an Eliminated action and set state if fear is 4', () => {
      character.state.fearTokens = 4;
      const actions = getCompulsoryActions(character);
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('Eliminated');
      expect(actions[0].apCost).toBe(0);
      expect(character.state.isEliminated).toBe(true);
    });

    it('should return an Eliminated action and set state if fear is 5', () => {
      character.state.fearTokens = 5;
      const actions = getCompulsoryActions(character);
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('Eliminated');
      expect(character.state.isEliminated).toBe(true);
    });
  });
});
