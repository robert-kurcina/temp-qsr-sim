import { GameManager } from './GameManager';
import { Character } from './Character';
import { CharacterStatus, TurnPhase } from './types';
import { describe, it, expect, beforeEach } from 'vitest';
import { Profile } from './Profile';

describe('GameManager', () => {
  let characters: Character[];
  let gameManager: GameManager;

  beforeEach(() => {
    const makeProfile = (name: string, ref: number): Profile => ({
      name,
      archetype: { attributes: { cca: 0, rca: 0, ref, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
      items: [],
      totalBp: 0,
      adjustedBp: 0,
      adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
      physicality: 0,
      adjPhysicality: 0,
      durability: 0,
      adjDurability: 0,
      burden: { totalLaden: 0, totalBurden: 0 },
      totalHands: 0,
      totalDeflect: 0,
      totalAR: 0,
      finalTraits: [],
      allTraits: [],
    });

    characters = [
      new Character(makeProfile('Alpha', 2)),
      new Character(makeProfile('Bravo', 4)),
    ];
    gameManager = new GameManager(characters);
  });

  it('should initialize with a list of characters', () => {
    expect(gameManager.characters.length).toBe(2);
    expect(gameManager.getCharacterStatus(characters[0].id)).toBe(CharacterStatus.Ready);
  });

  it('should correctly identify the current character', () => {
    const roller = () => 0; // initiative = 1 + REF
    gameManager.rollInitiative(roller);
    const next = gameManager.getNextToActivate();
    expect(next?.name).toBe('Bravo');
  });

  it('should advance to the next character', () => {
    const roller = () => 0;
    gameManager.rollInitiative(roller);
    const first = gameManager.getNextToActivate();
    expect(first?.name).toBe('Bravo');
    if (first) {
      gameManager.endActivation(first);
    }
    const second = gameManager.getNextToActivate();
    expect(second?.name).toBe('Alpha');
  });

  it('should loop back to the first character after the last one', () => {
    const roller = () => 0;
    gameManager.rollInitiative(roller);
    const first = gameManager.getNextToActivate();
    if (first) gameManager.endActivation(first);
    const second = gameManager.getNextToActivate();
    if (second) gameManager.endActivation(second);
    expect(gameManager.isTurnOver()).toBe(true);
    gameManager.startRound();
    const next = gameManager.getNextToActivate();
    expect(next?.name).toBe('Bravo');
  });

  it('should handle an empty character list', () => {
    const emptyManager = new GameManager([]);
    expect(emptyManager.getNextToActivate()).toBeUndefined();
    expect(emptyManager.isTurnOver()).toBe(true);
  });

  it('should consume delay tokens when beginning activation', () => {
    const character = characters[0];
    character.state.delayTokens = 1;
    const ap = gameManager.beginActivation(character);
    expect(ap).toBe(1);
    expect(character.state.delayTokens).toBe(0);
  });

  it('should set waiting status and treat it as turn over', () => {
    const character = characters[0];
    gameManager.setWaiting(character);
    expect(gameManager.getCharacterStatus(character.id)).toBe(CharacterStatus.Waiting);
    gameManager.endActivation(characters[1]);
    expect(gameManager.isTurnOver()).toBe(true);
  });

  it('should advance phases through a turn', () => {
    expect(gameManager.phase).toBe(TurnPhase.Setup);
    gameManager.advancePhase({ roller: () => 0 });
    expect(gameManager.phase).toBe(TurnPhase.Activation);
    const first = gameManager.getNextToActivate();
    if (first) gameManager.endActivation(first);
    const second = gameManager.getNextToActivate();
    if (second) gameManager.endActivation(second);
    expect(gameManager.isTurnOver()).toBe(true);
    gameManager.advancePhase();
    expect(gameManager.phase).toBe(TurnPhase.TurnEnd);
    gameManager.advancePhase({ roller: () => 0 });
    expect(gameManager.phase).toBe(TurnPhase.Activation);
  });

  it('should eliminate a side that fails a bottle test', () => {
    const character = characters[0];
    const other = characters[1];
    character.finalAttributes = character.attributes;
    other.finalAttributes = other.attributes;
    character.state.isKOd = true;
    other.finalAttributes.pow = 1;
    gameManager.resolveBottleTests([
      {
        id: 'SideA',
        characters: [character, other],
        orderedCandidate: other,
        opposingCount: 4,
        rolls: [1, 1],
      },
    ]);
    expect(other.state.isEliminated).toBe(true);
  });
});
