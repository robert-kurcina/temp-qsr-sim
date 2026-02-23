import { GameManager } from './GameManager';
import { Character } from '../core/Character';
import { CharacterStatus, TurnPhase } from '../core/types';
import { describe, it, expect, beforeEach } from 'vitest';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainElement } from '../battlefield/terrain/TerrainElement';

describe('GameManager', () => {
  let characters: Character[];
  let gameManager: GameManager;

  beforeEach(() => {
    const makeProfile = (name: string, int: number): Profile => ({
      name,
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
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
    const roller = () => 0; // initiative = 1 + INT (QSR Line 715), dice pips = 2 each
    gameManager.rollInitiative(roller);
    // With same dice rolls, Bravo has higher INT (4 vs 2) so wins
    const next = gameManager.getNextToActivate();
    expect(next?.name).toBe('Bravo');
  });

  it('should advance to the next character', () => {
    const roller = () => 0;
    gameManager.rollInitiative(roller);
    const first = gameManager.getNextToActivate();
    // With same dice rolls, Bravo has higher INT (4 vs 2) so wins
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
    // With same dice rolls, Bravo has higher INT (4 vs 2) so wins
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

  it('should allow take cover to cancel a ranged attack when LOS is broken', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain(new TerrainElement('Tree', { x: 8, y: 5 }).toFeature());

    const attacker = characters[0];
    const defender = characters[1];
    attacker.finalAttributes.mov = 6;
    defender.finalAttributes.mov = 10;

    gameManager.setBattlefield(battlefield);
    gameManager.placeCharacter(attacker, { x: 2, y: 2 });
    gameManager.placeCharacter(defender, { x: 8, y: 2 });

    const weapon = {
      name: 'Test Rifle',
      class: 'Range',
      classification: 'Range',
      type: 'Ranged',
      bp: 0,
      or: 8,
      accuracy: '-',
      impact: 0,
      dmg: '1',
      traits: [],
    };

    const outcome = gameManager.executeRangedAttack(attacker, defender, weapon as any, {
      allowTakeCover: true,
      takeCoverPosition: { x: 8, y: 5 },
    });

    expect(outcome.takeCover?.cancelled).toBe(true);
    expect(outcome.result.hit).toBe(false);
  });

  it('should apply ongoing status tokens as wounds at activation start', () => {
    const character = characters[0];
    character.state.statusPendingTokens.Poison = 2;
    character.state.statusTokens.Burn = 1;
    character.finalAttributes.siz = 5;
    const ap = gameManager.beginActivation(character);
    expect(ap).toBeGreaterThan(0);
    expect(character.state.wounds).toBe(3);
  });

  it('should add delay tokens when charging an Awkward defender', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const attacker = characters[0];
    const defender = characters[1];
    defender.profile.items = [
      {
        name: 'Awkward Shield',
        class: 'Melee',
        classification: 'Melee',
        type: 'Shield',
        bp: 0,
        traits: ['Awkward'],
      },
    ];

    gameManager.placeCharacter(attacker, { x: 0, y: 0 });
    gameManager.placeCharacter(defender, { x: 2, y: 0 });

    const weapon = {
      name: 'Test Blade',
      class: 'Melee',
      classification: 'Melee',
      type: 'Melee',
      bp: 0,
      traits: [],
    };

    expect(defender.state.delayTokens).toBe(0);
    gameManager.executeCloseCombatAttack(attacker, defender, weapon as any, {
      moveStart: { x: 0, y: 0 },
      moveEnd: { x: 1, y: 0 },
      movedOverClear: true,
      wasFreeAtStart: true,
    });
    expect(defender.state.delayTokens).toBe(1);
  });

  it('should apply Awkward AP cost only when engaged', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const attacker = characters[0];
    const defender = characters[1];

    gameManager.placeCharacter(attacker, { x: 0, y: 0 });
    gameManager.placeCharacter(defender, { x: 1, y: 0 });

    const weapon = {
      name: 'Awkward Hammer',
      class: 'Melee',
      classification: 'Melee',
      type: 'Melee',
      bp: 0,
      traits: ['Awkward'],
    };

    expect(gameManager.getAttackApCost(attacker, weapon as any)).toBe(2);
    gameManager.moveCharacter(defender, { x: 5, y: 0 });
    expect(gameManager.getAttackApCost(attacker, weapon as any)).toBe(1);
  });

  it('should penalize fiddling when using one less hand', () => {
    const actor = characters[0];
    actor.finalAttributes.int = 0;

    const baseResult = gameManager.executeFiddle(actor, {
      attribute: 'int',
      difficulty: 0,
      spendAp: false,
      rolls: [6, 6],
      opponentRolls: [6, 6],
    });
    expect(baseResult.success).toBe(true);

    const penalizedResult = gameManager.executeFiddle(actor, {
      attribute: 'int',
      difficulty: 0,
      spendAp: false,
      rolls: [6, 6],
      opponentRolls: [6, 6, 6],
      usesOneLessHand: true,
    });
    expect(penalizedResult.success).toBe(false);
  });
});
