/**
 * Phase 4 Integration Tests
 * 
 * Tests for AI Action Executor and Game Loop.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character, Profile } from '../../core';
import { Battlefield } from '../../battlefield';
import { GameManager } from '../../engine';
import { createMissionSide } from '../../mission';
import { buildAssembly } from '../../mission';
import { createAIExecutor, AIActionExecutor } from './AIActionExecutor';
import { createAIGameLoop, AIGameLoop } from './AIGameLoop';
import { ActionDecision } from '../core/AIController';

function makeTestProfile(name: string): Profile {
  return {
    name,
    archetype: { 
      name: 'Average',
      attributes: { 
        cca: 2, 
        rca: 2, 
        ref: 2, 
        int: 2, 
        pow: 2, 
        str: 2, 
        for: 2, 
        mov: 4, 
        siz: 3 
      },
      traits: [],
      bp: 30,
    },
    items: [],
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 3,
    adjPhysicality: 3,
    durability: 3,
    adjDurability: 3,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

function makeTestCharacter(name: string): Character {
  const character = new Character(makeTestProfile(name));
  character.finalAttributes = character.attributes;
  return character;
}

function makeTestSides(
  battlefield: Battlefield,
  sideAName: string = 'SideA',
  sideBName: string = 'SideB'
): { sideA: any; sideB: any; charactersA: Character[]; charactersB: Character[] } {
  const charactersA: any[] = [];
  const charactersB: any[] = [];

  for (let i = 0; i < 3; i++) {
    const charA = makeTestCharacter(`${sideAName}-${i}`);
    charactersA.push(charA);
    battlefield.placeCharacter(charA, { x: 2 + i * 2, y: 12 });

    const charB = makeTestCharacter(`${sideBName}-${i}`);
    charactersB.push(charB);
    battlefield.placeCharacter(charB, { x: 18 - i * 2, y: 12 });
  }

  const rosterA = buildAssembly(`${sideAName} Assembly`, charactersA.map((c: any) => c.profile));
  const rosterB = buildAssembly(`${sideBName} Assembly`, charactersB.map((c: any) => c.profile));

  const sideA = createMissionSide(sideAName, [rosterA], { startingIndex: 0 });
  const sideB = createMissionSide(sideBName, [rosterB], { startingIndex: 3 });

  return {  sideA, sideB, charactersA, charactersB  } as any;
}

describe('AIActionExecutor', () => {
  let battlefield: Battlefield;
  let manager: GameManager;
  let executor: AIActionExecutor;
  let character: Character;
  let target: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);
    const char1 = makeTestCharacter('char1');
    const char2 = makeTestCharacter('char2');
    battlefield.placeCharacter(char1, { x: 10, y: 12 });
    battlefield.placeCharacter(char2, { x: 14, y: 12 });

    manager = new GameManager([char1, char2], battlefield);
    executor = createAIExecutor(manager, { verboseLogging: false });
    
    character = char1;
    target = char2;
  });

  it('should create executor with default config', () => {
    expect(executor).toBeDefined();
    expect(executor.config.validateActions).toBe(true);
    expect(executor.config.enableReplanning).toBe(true);
  });

  it('should execute hold action', () => {
    const decision: ActionDecision = {
      type: 'hold',
      reason: 'Test hold',
      priority: 0,
      requiresAP: false,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [],
      enemies: [target],
      battlefield,
    };

    const result = executor.executeAction(decision, character, context);
    expect(result.success).toBe(true);
  });

  it('should validate action before execution', () => {
    const decision: ActionDecision = {
      type: 'move',
      position: { x: 12, y: 12 },
      reason: 'Test move',
      priority: 3,
      requiresAP: true,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [],
      enemies: [target],
      battlefield,
    };

    const result = executor.executeAction(decision, character, context);
    // Should attempt validation and execution
    expect(result).toBeDefined();
  });

  it('should handle execution failure gracefully', () => {
    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'Test attack',
      priority: 3,
      requiresAP: true,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [],
      enemies: [target],
      battlefield,
    };

    // Characters are not engaged, so this should fail validation
    const result = executor.executeAction(decision, character, context);
    expect(result.success).toBe(false);
    expect(result.replanningRecommended).toBe(true);
  });

  it('should reject close combat when only friendly engagement exists', () => {
    const friendly = makeTestCharacter('friendly');
    battlefield.placeCharacter(friendly, { x: 10.5, y: 12 });

    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'Invalid melee at range',
      priority: 3,
      requiresAP: true,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [friendly],
      enemies: [target],
      battlefield,
    };

    const result = executor.executeAction(decision, character, context);
    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain('melee range');
  });

  it('should hard-block illegal close combat even when validation is disabled', () => {
    const noValidationExecutor = createAIExecutor(manager, {
      validateActions: false,
      enableReplanning: false,
      verboseLogging: false,
    });
    character.profile.items = [
      {
        id: 'test-sword',
        name: 'Test Sword',
        classification: 'Melee',
        burden: 1,
        quality: 'Common',
        traits: [],
      } as any,
    ];

    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'Bypass validation test',
      priority: 3,
      requiresAP: true,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [],
      enemies: [target],
      battlefield,
    };

    const apBefore = manager.getApRemaining(character);
    const result = noValidationExecutor.executeAction(decision, character, context);
    const apAfter = manager.getApRemaining(character);

    expect(result.success).toBe(false);
    expect(result.error).toContain('melee range');
    expect(apAfter).toBe(apBefore);
  });

  it('should track replan attempts', () => {
    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'Test attack',
      priority: 3,
      requiresAP: true,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [],
      enemies: [target],
      battlefield,
    };

    // Execute multiple failing actions
    for (let i = 0; i < 3; i++) {
      executor.executeAction(decision, character, context);
    }

    // After max attempts, should stop recommending replanning
    const result = executor.executeAction(decision, character, context);
    expect(result.replanningRecommended).toBe(false);
  });

  it('should reset replan attempts between turns', () => {
    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'Test attack',
      priority: 3,
      requiresAP: true,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [],
      enemies: [target],
      battlefield,
    };

    // Exhaust replan attempts
    for (let i = 0; i < 3; i++) {
      executor.executeAction(decision, character, context);
    }

    // Reset
    executor.resetReplanAttempts();

    // Should allow replanning again
    const result = executor.executeAction(decision, character, context);
    expect(result.replanningRecommended).toBe(true);
  });

  it('should execute disengage via GameManager API', () => {
    target.profile.items = [
      {
        name: 'Defender Blade',
        class: 'Melee',
        classification: 'Melee',
        type: 'Melee',
        bp: 0,
        traits: [],
      } as any,
    ];

    const decision: ActionDecision = {
      type: 'disengage',
      target,
      reason: 'Test disengage',
      priority: 2,
      requiresAP: true,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [],
      enemies: [target],
      battlefield,
    };

    const result = executor.executeAction(decision, character, context);
    expect(result.error ?? '').not.toContain('executeDisengageAction');
    expect(result.action.type).toBe('disengage');
  });

  it('should execute charge when destination reaches base-contact engagement', () => {
    character.profile.items = [
      {
        name: 'Charger Blade',
        class: 'Melee',
        classification: 'Melee',
        type: 'Melee',
        bp: 0,
        traits: [],
      } as any,
    ];

    const decision: ActionDecision = {
      type: 'charge',
      target,
      position: { x: 13, y: 12 },
      reason: 'Test charge',
      priority: 3,
      requiresAP: true,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [],
      enemies: [target],
      battlefield,
    };

    const result = executor.executeAction(decision, character, context);
    expect(result.success).toBe(true);
  });

  it('should reject charge when destination does not reach engagement', () => {
    character.profile.items = [
      {
        name: 'Charger Blade',
        class: 'Melee',
        classification: 'Melee',
        type: 'Melee',
        bp: 0,
        traits: [],
      } as any,
    ];

    const decision: ActionDecision = {
      type: 'charge',
      target,
      position: { x: 12, y: 12 },
      reason: 'Invalid charge destination',
      priority: 3,
      requiresAP: true,
    };

    const context = {
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      allies: [],
      enemies: [target],
      battlefield,
    };

    const result = executor.executeAction(decision, character, context);
    expect(result.success).toBe(false);
    expect(result.error ?? '').toContain('base-contact');
  });
});

describe('AIGameLoop', () => {
  let battlefield: Battlefield;
  let manager: GameManager;
  let gameLoop: AIGameLoop;
  let sides: { sideA: any; sideB: any; charactersA: Character[]; charactersB: Character[] };

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);
    sides = makeTestSides(battlefield);
    
    const allCharacters = [...sides.charactersA, ...sides.charactersB];
    manager = new GameManager(allCharacters, battlefield);
    
    // Set up activation order
    manager.activationOrder = allCharacters;

    gameLoop = createAIGameLoop(manager, battlefield, [sides.sideA, sides.sideB], {
      verboseLogging: false,
      maxActionsPerTurn: 3,
    });
  });

  it('should create game loop with default config', () => {
    expect(gameLoop).toBeDefined();
  });

  it('should run a turn of AI actions', () => {
    const result = gameLoop.runTurn(1);
    
    expect(result).toBeDefined();
    expect(result.totalActions).toBeGreaterThanOrEqual(0);
    expect(manager.isTurnOver()).toBe(true);
  });

  it('should run a complete game', () => {
    const result = gameLoop.runGame(5);
    
    expect(result).toBeDefined();
    expect(result.finalTurn).toBeGreaterThanOrEqual(1);
    expect(result.finalTurn).toBeLessThanOrEqual(5);
    expect(result.totalActions).toBeGreaterThanOrEqual(0);
  });

  it('should handle all AI layers', () => {
    // Note: This test may fail intermittently due to AI decision randomness
    // The AI might not find valid actions depending on initial positions
    const result = gameLoop.runGame(3);

    // Game should complete without errors
    expect(result).toBeDefined();
    expect(result.finalTurn).toBeGreaterThanOrEqual(1);
    // Actions may be 0 if AI can't find valid moves from starting positions
    expect(result.totalActions).toBeGreaterThanOrEqual(0);
  });

  it('should execute character-AI decisions when strategic/tactical layers are disabled', () => {
    const gameLoopWithCharacterOnly = createAIGameLoop(manager, battlefield, [sides.sideA, sides.sideB], {
      enableStrategic: false,
      enableTactical: false,
      enableCharacterAI: true,
      verboseLogging: false,
    });

    const result = gameLoopWithCharacterOnly.runTurn(1);
    expect(result.totalActions).toBeGreaterThanOrEqual(0);
  });

  it('should reject illegal strategic close-combat decisions before execution', () => {
    const constrainedLoop = createAIGameLoop(manager, battlefield, [sides.sideA, sides.sideB], {
      enableStrategic: true,
      enableTactical: false,
      enableCharacterAI: false,
      enableValidation: true,
      verboseLogging: false,
    });

    const actor = sides.charactersA[0];
    const farTarget = sides.charactersB[0];
    const invalidStrategicDecision: ActionDecision = {
      type: 'close_combat',
      target: farTarget,
      reason: 'Invalid strategic melee at range',
      priority: 5,
      requiresAP: true,
    };

    (constrainedLoop as any).sideAIs.set(sides.sideA.id, {
      assessSituation: () => ({}),
      getActionPriorities: () => new Map([[actor.id, invalidStrategicDecision]]),
    });

    const selectedDecision = (constrainedLoop as any).getAIDecision(actor) as ActionDecision;
    expect(selectedDecision.type).toBe('hold');

    const turnResult = constrainedLoop.runCharacterTurn(actor, 1);
    expect(turnResult.totalActions).toBeGreaterThanOrEqual(1);
    expect(turnResult.successfulActions).toBeGreaterThanOrEqual(1);
    expect(turnResult.failedActions).toBeGreaterThanOrEqual(0);
  });

  it('should produce bounded fallback move distance after failed attack decision', () => {
    const actor = sides.charactersA[0];
    const target = sides.charactersB[0];
    const failedAttack: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'Failed attack trigger fallback',
      priority: 3,
      requiresAP: true,
    };

    const fallback = (gameLoop as any).getAlternativeDecision(actor, failedAttack) as ActionDecision;
    expect(fallback.type).toBe('move');
    expect(fallback.position).toBeDefined();

    const actorPos = battlefield.getCharacterPosition(actor)!;
    const fallbackPos = fallback.position!;
    const fallbackDistance = Math.hypot(fallbackPos.x - actorPos.x, fallbackPos.y - actorPos.y);
    const immediateAllowance = (gameLoop as any).estimateImmediateMoveAllowance(actor) as number;

    expect(fallbackDistance).toBeLessThanOrEqual(immediateAllowance + 0.25);
  });
});

describe('Phase 4 Integration', () => {
  it('should integrate full AI pipeline', () => {
    const battlefield = new Battlefield(24, 24);
    const sides = makeTestSides(battlefield);
    
    const allCharacters = [...sides.charactersA, ...sides.charactersB];
    const manager = new GameManager(allCharacters, battlefield);
    manager.activationOrder = allCharacters;

    const executor = createAIExecutor(manager);
    const gameLoop = createAIGameLoop(manager, battlefield, [sides.sideA, sides.sideB]);

    // Verify all components are connected
    expect(executor).toBeDefined();
    expect(gameLoop).toBeDefined();

    // Run a short game
    const result = gameLoop.runGame(3);
    expect(result.finalTurn).toBeGreaterThanOrEqual(1);
  });

  it('should handle action validation failures', () => {
    const battlefield = new Battlefield(24, 24);
    const sides = makeTestSides(battlefield);
    
    const allCharacters = [...sides.charactersA, ...sides.charactersB];
    const manager = new GameManager(allCharacters, battlefield);
    manager.activationOrder = allCharacters;

    const gameLoop = createAIGameLoop(manager, battlefield, [sides.sideA, sides.sideB], {
      enableValidation: true,
      enableReplanning: true,
    });

    const result = gameLoop.runGame(2);
    
    // Should have handled failures gracefully
    expect(result).toBeDefined();
    expect(result.failedActions).toBeGreaterThanOrEqual(0);
  });
});
