import { describe, it, expect, beforeEach } from 'vitest';
import { Character, CharacterAttributes } from './Character';

describe('Character Class', () => {
  let character: Character;
  let initialAttributes: CharacterAttributes;

  beforeEach(() => {
    initialAttributes = {
      CCA: 2,
      RCA: 2,
      REF: 2,
      INT: 2,
      POW: 2,
      STR: 2,
      FOR: 2,
      MOV: 2,
      SIZ: 3,
    };
    character = new Character('char1', 'Test Character', { ...initialAttributes }, { x: 0, y: 0 });
  });

  it('should initialize correctly', () => {
    expect(character.id).toBe('char1');
    expect(character.name).toBe('Test Character');
    expect(character.attributes).toEqual(initialAttributes);
    expect(character.position).toEqual({ x: 0, y: 0 });
    expect(character.wounds).toBe(0);
  });

  it('should take a wound', () => {
    character.takeWound();
    expect(character.wounds).toBe(1);
  });

  it('should be knocked out when wounds equal SIZ', () => {
    character.takeWound();
    character.takeWound();
    character.takeWound();
    expect(character.isKnockedOut()).toBe(true);
  });

  it('should not be knocked out when wounds are less than SIZ', () => {
    character.takeWound();
    expect(character.isKnockedOut()).toBe(false);
  });

  it('should be eliminated when wounds are double SIZ', () => {
    character.takeWound();
    character.takeWound();
    character.takeWound();
    character.takeWound();
    character.takeWound();
    character.takeWound();
    expect(character.isEliminated()).toBe(true);
  });

  it('should move to a new position', () => {
    const newPosition = { x: 1, y: 1 };
    character.move(newPosition);
    expect(character.position).toEqual(newPosition);
  });
});
