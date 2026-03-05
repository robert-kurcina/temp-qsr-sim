import { GameManager } from './GameManager';
import { Character } from '../core/Character';
import { CharacterStatus, TurnPhase } from '../core/types';
import { describe, it, expect, beforeEach } from 'vitest';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainElement } from '../battlefield/terrain/TerrainElement';
import { TerrainType } from '../battlefield/terrain/Terrain';
import { MissionSide } from '../mission/MissionSide';
import { ObjectiveMarkerKind, ObjectiveMarkerManager, createObjectiveMarker } from '../mission/objective-markers';
import { createMissionRuntimeAdapter } from '../missions/mission-runtime-adapter';
import { applyFearFromWounds } from '../status/morale';

describe('GameManager', () => {
  let characters: Character[];
  let gameManager: GameManager;

  const buildMissionSide = (id: string, character: Character): MissionSide => ({
    id,
    name: id,
    assemblies: [],
    members: [
      {
        id: character.id,
        character,
        profile: character.profile,
        assembly: { name: `${id}-assembly`, characters: [character.id], totalBP: 0, totalCharacters: 1 },
        portrait: { sheet: 'default', column: 0, row: 0, name: `${id}-portrait` } as any,
        status: CharacterStatus.Ready as any,
        isVIP: false,
        objectiveMarkers: [],
      },
    ],
    totalBP: 0,
    deploymentZones: [],
    state: {
      currentTurn: 1,
      activatedModels: new Set<string>(),
      readyModels: new Set<string>([character.id]),
      woundsThisTurn: 0,
      eliminatedModels: [],
      victoryPoints: 0,
      resourcePoints: 0,
      predictedVp: 0,
      predictedRp: 0,
      keyScores: {},
      initiativePoints: 0,
      missionState: {},
    },
    objectiveMarkerManager: new ObjectiveMarkerManager(),
  });

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
      burden: { totalLaden: 0, totalBurden: 0 } as any,
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

  it('should assign each character a single initiative slot per turn', () => {
    gameManager.startTurn(() => 0);

    const orderIds = gameManager.activationOrder.map((character: any) => character.id);
    expect(orderIds).toHaveLength(characters.length);
    expect(new Set(orderIds).size).toBe(orderIds.length);
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

  it('should prevent wait acquisition while outnumbered in engagement', () => {
    const battlefield = new Battlefield(12, 12);
    const actor = characters[0];
    const enemyA = characters[1];
    const enemyB = new Character({
      ...enemyA.profile,
      name: 'Charlie',
    });
    const localManager = new GameManager([actor, enemyA, enemyB], battlefield);

    localManager.placeCharacter(actor, { x: 5, y: 5 });
    localManager.placeCharacter(enemyA, { x: 6, y: 5 });
    localManager.placeCharacter(enemyB, { x: 5, y: 6 });

    const wait = localManager.executeWait(actor, { spendAp: true, opponents: [enemyA, enemyB] });
    expect(wait.success).toBe(false);
    expect(wait.reason).toContain('outnumbered');
  });

  it('should pay 1 AP to maintain wait when not free at activation start', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const actor = characters[0];
    const enemy = characters[1];
    actor.state.isWaiting = true;
    actor.state.delayTokens = 1;

    gameManager.placeCharacter(actor, { x: 5, y: 5 });
    gameManager.placeCharacter(enemy, { x: 6, y: 5 });

    const ap = gameManager.beginActivation(actor);
    expect(ap).toBe(0);
    expect(actor.state.isWaiting).toBe(true);
  });

  it('should maintain wait for free model with zero AP upkeep', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const actor = characters[0];
    actor.state.isWaiting = true;
    actor.state.isAttentive = false;
    actor.state.delayTokens = 0;
    gameManager.placeCharacter(actor, { x: 2, y: 2 });

    const ap = gameManager.beginActivation(actor);
    expect(ap).toBe(gameManager.apPerActivation);
    expect(actor.state.isWaiting).toBe(true);
  });

  it('should remove wait when not free and unable to pay upkeep AP', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const actor = characters[0];
    const enemy = characters[1];
    actor.state.isWaiting = true;
    actor.state.delayTokens = 2;

    gameManager.placeCharacter(actor, { x: 5, y: 5 });
    gameManager.placeCharacter(enemy, { x: 6, y: 5 });

    const ap = gameManager.beginActivation(actor);
    expect(ap).toBe(0);
    expect(actor.state.isWaiting).toBe(false);
  });

  it('should reveal hidden opponents when wait is acquired', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const actor = characters[0];
    const enemy = characters[1];
    enemy.state.isHidden = true;
    gameManager.placeCharacter(actor, { x: 2, y: 6 });
    gameManager.placeCharacter(enemy, { x: 10, y: 6 });

    const wait = gameManager.executeWait(actor, {
      spendAp: true,
      opponents: [enemy],
      visibilityOrMu: 16,
      allowRevealReposition: false,
    });

    expect(wait.success).toBe(true);
    expect('revealedCount' in wait ? wait.revealedCount : 0).toBe(1);
    expect(enemy.state.isHidden).toBe(false);
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

  it('should resolve bottle tests when ending a turn with mission sides', () => {
    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    characters[0].state.isKOd = true;
    characters[0].refreshStatusFlags();

    gameManager.endTurn([sideA, sideB]);

    expect(gameManager.phase).toBe(TurnPhase.TurnEnd);
    expect(gameManager.lastBottleTestResults).not.toBeNull();
    expect(gameManager.lastBottleTestResults?.SideA?.bottledOut).toBe(true);
  });

  it('should resolve bottle tests through activation-to-turn-end phase advance', () => {
    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    characters[0].state.isKOd = true;
    characters[0].refreshStatusFlags();
    gameManager.setSides([sideA, sideB]);
    gameManager.phase = TurnPhase.Activation;
    gameManager.setCharacterStatus(characters[0].id, CharacterStatus.Done);
    gameManager.setCharacterStatus(characters[1].id, CharacterStatus.Done);

    const phase = gameManager.advancePhase({ roundsPerTurn: 1, sides: [sideA, sideB] });

    expect(phase).toBe(TurnPhase.TurnEnd);
    expect(gameManager.lastBottleTestResults).not.toBeNull();
    expect(gameManager.lastBottleTestResults?.SideA?.bottledOut).toBe(true);
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

  it('should place and flip ROF markers into suppression during ranged attacks', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const attacker = characters[0];
    const defender = characters[1];

    gameManager.placeCharacter(attacker, { x: 0, y: 0 });
    gameManager.placeCharacter(defender, { x: 6, y: 0 });

    const weapon = {
      name: 'Test SMG',
      class: 'Range',
      classification: 'Range',
      type: 'Ranged',
      bp: 0,
      or: 8,
      accuracy: '-',
      impact: 0,
      dmg: '1',
      traits: ['ROF 2'],
    };

    const outcome = gameManager.executeRangedAttack(attacker, defender, weapon as any);

    expect(outcome.rof.baseMarkersPlaced).toBeGreaterThan(0);
    expect(outcome.rof.flippedToSuppression).toBeGreaterThanOrEqual(0);
    expect(outcome.rof.retainedAsROF + outcome.rof.flippedToSuppression).toBeGreaterThan(0);
  });

  it('should execute Suppression Attack with AP/delay costs and bonus marker placement', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const attacker = characters[0];
    const defender = characters[1];

    gameManager.placeCharacter(attacker, { x: 0, y: 0 });
    gameManager.placeCharacter(defender, { x: 6, y: 0 });

    const weapon = {
      name: 'Suppressive Carbine',
      class: 'Range',
      classification: 'Range',
      type: 'Ranged',
      bp: 0,
      or: 8,
      accuracy: '-',
      impact: 0,
      dmg: '1',
      traits: ['ROF 3'],
    };

    const result = gameManager.executeSuppressAction(attacker, defender, weapon as any, {
      costMode: 'one_ap_plus_delay',
    });

    expect(result.executed).toBe(true);
    expect(result.apSpent).toBe(1);
    expect(result.delayAdded).toBe(1);
    expect(result.baseMarkersPlaced).toBeGreaterThan(0);
    expect(result.bonusMarkersPlaced).toBeGreaterThanOrEqual(1);
    expect(result.baseMarkersPlaced + result.bonusMarkersPlaced).toBeGreaterThan(0);
  });

  it('should cull suppression markers with no in-play models in range on round start', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const attacker = characters[0];
    const defender = characters[1];

    gameManager.placeCharacter(attacker, { x: 0, y: 0 });
    gameManager.placeCharacter(defender, { x: 6, y: 0 });

    (gameManager as any).suppressionMarkers = [{
      id: 'suppression-test-1',
      position: { x: 0, y: 0 },
      range: 1,
      creatorId: attacker.id,
    }];
    expect(gameManager.getSuppressionMarkers().length).toBe(1);

    attacker.state.isKOd = true;
    defender.state.isKOd = true;
    attacker.refreshStatusFlags();
    defender.refreshStatusFlags();

    gameManager.startRound();
    expect(gameManager.getSuppressionMarkers().length).toBe(0);
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

  it('should reset per-turn fear test counters when a new turn starts', () => {
    const character = characters[0];
    character.finalAttributes.pow = 0;

    const firstFear = applyFearFromWounds(character, 1, [1, 1]);
    expect(firstFear.pass).toBe(false);
    expect(character.state.fearTestsThisTurn).toBe(1);

    character.state.fearTokens = 0;
    character.refreshStatusFlags();
    const blockedSameTurn = applyFearFromWounds(character, 1, [1, 1]);
    expect(blockedSameTurn.pass).toBe(true);
    expect(blockedSameTurn.fearAdded).toBe(0);

    gameManager.startTurn(() => 0);
    character.state.fearTokens = 0;
    character.refreshStatusFlags();
    const allowedNextTurn = applyFearFromWounds(character, 1, [1, 1]);
    expect(allowedNextTurn.pass).toBe(false);
    expect(character.state.fearTestsThisTurn).toBe(1);
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

  it('should apply terrain movement cost when executing move', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain({
      id: 'rough-square',
      type: TerrainType.Rough,
      vertices: [
        { x: 2, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 2, y: 2 },
      ],
    });
    gameManager.setBattlefield(battlefield);

    const mover = characters[0];
    mover.finalAttributes.mov = 2;
    gameManager.placeCharacter(mover, { x: 0, y: 1 });

    const blocked = gameManager.executeMove(mover, { x: 3, y: 1 });
    expect(blocked.moved).toBe(false);
    expect(blocked.reason).toContain('out of range');

    mover.finalAttributes.mov = 6;
    const allowed = gameManager.executeMove(mover, { x: 3, y: 1 });
    expect(allowed.moved).toBe(true);
  });

  it('should apply difficult terrain multipliers when executing move', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain({
      id: 'difficult-lane',
      type: TerrainType.Difficult,
      vertices: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 2 },
        { x: 0, y: 2 },
      ],
    });
    gameManager.setBattlefield(battlefield);

    const mover = characters[0];
    gameManager.placeCharacter(mover, { x: 0, y: 1 });

    mover.finalAttributes.mov = 6;
    const blocked = gameManager.executeMove(mover, { x: 3, y: 1 });
    expect(blocked.moved).toBe(false);
    expect(blocked.reason).toContain('out of range');

    mover.finalAttributes.mov = 10;
    const allowed = gameManager.executeMove(mover, { x: 3, y: 1 });
    expect(allowed.moved).toBe(true);
  });

  it('should require Disengage before Move when the mover starts engaged to an opposing model', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const mover = characters[0];
    const opposing = characters[1];
    gameManager.placeCharacter(mover, { x: 1, y: 1 });
    gameManager.placeCharacter(opposing, { x: 2, y: 1 });

    const blocked = gameManager.executeMove(mover, { x: 4, y: 1 }, {
      opponents: [opposing],
    });

    expect(blocked.moved).toBe(false);
    expect(blocked.reason).toContain('Disengage');
    expect(gameManager.getCharacterPosition(mover)).toEqual({ x: 1, y: 1 });
  });

  it('should apply first-free and additional-cost swap position behavior during move', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const mover = characters[0];
    const friendly = characters[1];
    mover.finalAttributes.mov = 4;
    friendly.finalAttributes.mov = 4;
    friendly.state.isAttentive = true;

    gameManager.placeCharacter(mover, { x: 1, y: 1 });
    gameManager.placeCharacter(friendly, { x: 2, y: 1 });
    gameManager.beginActivation(mover);

    const firstSwap = gameManager.executeMove(mover, { x: 2, y: 1 }, {
      swapTarget: friendly,
      isFriendlyToMover: () => true,
      opponents: [],
    });
    expect(firstSwap.moved).toBe(true);
    expect(firstSwap.swapApCost).toBe(0);
    expect(gameManager.getCharacterPosition(mover)).toEqual({ x: 2, y: 1 });
    expect(gameManager.getCharacterPosition(friendly)).toEqual({ x: 1, y: 1 });
    expect(gameManager.getApRemaining(mover)).toBe(2);

    const secondSwap = gameManager.executeMove(mover, { x: 1, y: 1 }, {
      swapTarget: friendly,
      isFriendlyToMover: () => true,
      opponents: [],
    });
    expect(secondSwap.moved).toBe(true);
    expect(secondSwap.swapApCost).toBe(1);
    expect(gameManager.getCharacterPosition(mover)).toEqual({ x: 1, y: 1 });
    expect(gameManager.getCharacterPosition(friendly)).toEqual({ x: 2, y: 1 });
    expect(gameManager.getApRemaining(mover)).toBe(1);
  });

  it('should block swapping with a target engaged to an Attentive Ordered opposing model', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const mover = characters[0];
    const friendly = characters[1];
    const opposing = new Character({
      ...friendly.profile,
      name: 'Opposing',
    });
    opposing.finalAttributes = opposing.attributes;
    opposing.state.isAttentive = true;
    opposing.state.isOrdered = true;
    gameManager.characters.push(opposing);

    gameManager.placeCharacter(mover, { x: 1, y: 1 });
    gameManager.placeCharacter(friendly, { x: 2, y: 1 });
    gameManager.placeCharacter(opposing, { x: 3, y: 1 });

    const swap = gameManager.executeMove(mover, { x: 2, y: 1 }, {
      swapTarget: friendly,
      isFriendlyToMover: () => true,
      opponents: [opposing],
    });

    expect(swap.moved).toBe(false);
    expect(swap.reason).toContain('Attentive Ordered opposing');
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

  it('should acquire objective markers through mission runtime APIs and spend AP', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    const runtime = createMissionRuntimeAdapter('QAI_11', [sideA, sideB]);
    gameManager.setMissionRuntimeAdapter(runtime);

    runtime.addObjectiveMarker(
      createObjectiveMarker({
        id: 'om-1',
        position: { x: 2, y: 2 },
        omTypes: [ObjectiveMarkerKind.Tiny],
      })
    );

    gameManager.placeCharacter(characters[0], { x: 2, y: 2 });
    gameManager.beginActivation(characters[0]);

    const result = gameManager.executeAcquireObjectiveMarker(characters[0], 'om-1', 'SideA');

    expect(result.success).toBe(true);
    expect(gameManager.getApRemaining(characters[0])).toBe(0);
    expect(gameManager.getObjectiveMarkers().find(marker => marker.id === 'om-1')?.carriedBy).toBe(characters[0].id);
  });

  it('should block destroying switch markers unless mission allows it', () => {
    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    const runtime = createMissionRuntimeAdapter('QAI_11', [sideA, sideB]);
    gameManager.setMissionRuntimeAdapter(runtime);

    runtime.addObjectiveMarker(
      createObjectiveMarker({
        id: 'switch-1',
        position: { x: 1, y: 1 },
        omTypes: [ObjectiveMarkerKind.Switch],
      })
    );

    const blocked = gameManager.executeDestroyObjectiveMarker(characters[0], 'switch-1', { spendAp: false });
    expect(blocked.success).toBe(false);
    expect(blocked.reason).toContain('cannot be destroyed');

    const allowed = gameManager.executeDestroyObjectiveMarker(characters[0], 'switch-1', {
      spendAp: false,
      allowDestroySwitch: true,
    });
    expect(allowed.success).toBe(true);
  });

  it('should project mission-manager zones into objective marker snapshots', () => {
    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    const runtime = createMissionRuntimeAdapter('QAI_12', [sideA, sideB]);
    gameManager.setMissionRuntimeAdapter(runtime);

    const projected = gameManager
      .getObjectiveMarkers()
      .filter((marker: any) => marker.id.startsWith('mission:QAI_12:'));

    expect(projected.length).toBeGreaterThan(0);
    expect(projected.every(marker => marker.metadata['projectedFromMissionManager'] === true)).toBe(true);
    // Zone markers are now interactable for AI movement scoring
    expect(projected.every(marker => marker.metadata['aiInteractable'] === true)).toBe(true);
  });

  it('should allow zone-control mission-projected marker interactions (automatic control)', () => {
    const battlefield = new Battlefield(12, 12);
    gameManager.setBattlefield(battlefield);

    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    const runtime = createMissionRuntimeAdapter('QAI_12', [sideA, sideB]);
    gameManager.setMissionRuntimeAdapter(runtime);

    const markerId = gameManager
      .getObjectiveMarkers()
      .find(marker => marker.id.startsWith('mission:QAI_12:'))?.id;

    expect(markerId).toBeDefined();
    gameManager.placeCharacter(characters[0], { x: 12, y: 12 });
    gameManager.beginActivation(characters[0]);

    // Zone-control missions allow acquire but it's a no-op (control is automatic by positioning)
    const result = gameManager.executeAcquireObjectiveMarker(characters[0], markerId!, 'SideA');
    expect(result.success).toBe(true);
    expect(result.reason).toContain('automatic');
    expect(gameManager.getApRemaining(characters[0])).toBe(1);
  });

  it('should resolve projected assault marker interactions through mission semantics', () => {
    const battlefield = new Battlefield(24, 24);
    gameManager.setBattlefield(battlefield);

    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    const runtime = createMissionRuntimeAdapter('QAI_13', [sideA, sideB]);
    gameManager.setMissionRuntimeAdapter(runtime);

    const markerId = gameManager
      .getObjectiveMarkers()
      .find(marker =>
        marker.metadata['projectedFromMissionManager'] === true &&
        marker.metadata['missionSource'] === 'assault' &&
        marker.metadata['aiInteractable'] === true
      )?.id;

    expect(markerId).toBeDefined();
    gameManager.placeCharacter(characters[0], { x: 6, y: 6 });
    gameManager.beginActivation(characters[0]);

    const result = gameManager.executeAcquireObjectiveMarker(characters[0], markerId!, 'SideA');
    expect(result.success).toBe(true);
    expect(gameManager.getApRemaining(characters[0])).toBe(1);

    const markerAfter = gameManager.getObjectiveMarkers().find(marker => marker.id === markerId);
    expect(markerAfter?.controlledBy).toBe('SideA');
    expect(markerAfter?.switchState).toBe('On');
    expect(markerAfter?.metadata['aiInteractable']).toBe(false);
    expect(markerAfter?.carriedBy).toBeUndefined();
  });

  it('should block destroy on projected assault markers', () => {
    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    const runtime = createMissionRuntimeAdapter('QAI_13', [sideA, sideB]);
    gameManager.setMissionRuntimeAdapter(runtime);

    const markerId = gameManager
      .getObjectiveMarkers()
      .find(marker =>
        marker.metadata['projectedFromMissionManager'] === true &&
        marker.metadata['missionSource'] === 'assault'
      )?.id;

    expect(markerId).toBeDefined();
    const blocked = gameManager.executeDestroyObjectiveMarker(characters[0], markerId!, { spendAp: false });
    expect(blocked.success).toBe(false);
    expect(blocked.reason).toContain('do not support destroy');
  });

  it('should resolve projected breach marker interactions through mission semantics', () => {
    const battlefield = new Battlefield(24, 24);
    gameManager.setBattlefield(battlefield);

    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    const runtime = createMissionRuntimeAdapter('QAI_20', [sideA, sideB]);
    gameManager.setMissionRuntimeAdapter(runtime);

    const markerId = gameManager
      .getObjectiveMarkers()
      .find(marker =>
        marker.metadata['projectedFromMissionManager'] === true &&
        marker.metadata['missionSource'] === 'breach' &&
        marker.metadata['aiInteractable'] === true
      )?.id;

    expect(markerId).toBeDefined();
    gameManager.placeCharacter(characters[0], { x: 12, y: 6 });
    gameManager.beginActivation(characters[0]);

    const result = gameManager.executeAcquireObjectiveMarker(characters[0], markerId!, 'SideA');
    expect(result.success).toBe(true);
    expect(gameManager.getApRemaining(characters[0])).toBe(1);

    const markerAfter = gameManager.getObjectiveMarkers().find(marker => marker.id === markerId);
    expect(markerAfter?.controlledBy).toBe('SideA');
    expect(markerAfter?.switchState).toBe('On');
  });

  it('should block projected breach marker interaction when contested', () => {
    const battlefield = new Battlefield(24, 24);
    gameManager.setBattlefield(battlefield);

    const sideA = buildMissionSide('SideA', characters[0]);
    const sideB = buildMissionSide('SideB', characters[1]);
    const runtime = createMissionRuntimeAdapter('QAI_20', [sideA, sideB]);
    gameManager.setMissionRuntimeAdapter(runtime);

    const markerId = gameManager
      .getObjectiveMarkers()
      .find(marker =>
        marker.metadata['projectedFromMissionManager'] === true &&
        marker.metadata['missionSource'] === 'breach' &&
        marker.metadata['aiInteractable'] === true
      )?.id;

    expect(markerId).toBeDefined();
    gameManager.placeCharacter(characters[0], { x: 12, y: 6 });
    gameManager.placeCharacter(characters[1], { x: 13, y: 6 });
    gameManager.beginActivation(characters[0]);

    const result = gameManager.executeAcquireObjectiveMarker(characters[0], markerId!, 'SideA');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('contested');
    expect(gameManager.getApRemaining(characters[0])).toBe(2);
  });
});
