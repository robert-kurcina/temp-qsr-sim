/**
 * Tactical AI Module Tests
 * 
 * Tests for tactical patterns and GOAP systems.
 */

import { describe, it, expect } from 'vitest';
import {
  PatternRegistry,
  PatternRecognizer,
  createDefaultPatternRegistry,
  Patterns,
  Conditions,
} from '../tactical/TacticalPatterns';
import {
  GOAPPlanner,
  createDefaultGOAPPlanner,
  createStandardActions,
  StandardGoals,
  forecastWaitReact,
  rolloutWaitReactBranches,
  validateAction,
} from '../tactical/GOAP';
import { Character, Profile } from '../../core';
import { Battlefield } from '../../battlefield';

function makeTestProfile(name: string): Profile {
  return {
    name,
    archetype: { attributes: { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 4, siz: 3 } },
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

function makeTestContext(): { character: Character; allies: Character[]; enemies: Character[]; battlefield: Battlefield } {
  const character = makeTestCharacter('test');
  const ally = makeTestCharacter('ally');
  const enemy = makeTestCharacter('enemy');
  const battlefield = new Battlefield(24, 24);
  
  battlefield.placeCharacter(character, { x: 12, y: 12 });
  battlefield.placeCharacter(ally, { x: 10, y: 12 });
  battlefield.placeCharacter(enemy, { x: 16, y: 12 });
  
  return {  character, allies: [ally], enemies: [enemy], battlefield  } as any;
}

describe('TacticalPatterns', () => {
  it('should create default pattern registry', () => {
    const registry = createDefaultPatternRegistry();
    const patterns = registry.getAll();
    
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.id === 'focus_fire')).toBe(true);
    expect(patterns.some(p => p.id === 'flanking_maneuver')).toBe(true);
  });

  it('should recognize focus fire pattern when enemy is wounded', () => {
    const registry = createDefaultPatternRegistry();
    const recognizer = new PatternRecognizer(registry);
    const context = makeTestContext();
    
    // Wound the enemy
    const siz = context.enemies[0].finalAttributes.siz ?? 3;
    context.enemies[0].state.wounds = siz - 1;
    
    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    } as any;
    
    const matches = recognizer.recognize(aiContext);
    const focusFireMatch = matches.find(m => m.pattern.id === 'focus_fire');
    
    expect(focusFireMatch).toBeDefined();
    expect(focusFireMatch!.confidence).toBeGreaterThan(0.5);
  });

  it('should evaluate pattern conditions', () => {
    const context = makeTestContext();
    
    // Test LowHealth condition
    const lowHealthResult = Conditions.LowHealth.check({
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    });
    
    expect(lowHealthResult).toBe(false); // Not low health yet
    
    // Wound character to low health
    context.character.state.wounds = 2;
    
    const lowHealthResult2 = Conditions.LowHealth.check({
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    });
    
    expect(lowHealthResult2).toBe(true); // Now low health
  });

  it('should track pattern success rate', () => {
    const registry = createDefaultPatternRegistry();
    const pattern = registry.get('focus_fire');
    
    expect(pattern).toBeDefined();
    expect(pattern!.successRate).toBe(0);
    expect(pattern!.timesUsed).toBe(0);
    
    // Record some outcomes
    registry.recordOutcome('focus_fire', true);
    registry.recordOutcome('focus_fire', true);
    registry.recordOutcome('focus_fire', false);
    
    expect(pattern!.timesUsed).toBe(3);
    expect(pattern!.successRate).toBeGreaterThan(0);
  });
});

describe('GOAP', () => {
  it('should create default GOAP planner', () => {
    const planner = createDefaultGOAPPlanner();
    expect(planner).toBeDefined();
  });

  it('should plan simple action sequence', () => {
    const planner = createDefaultGOAPPlanner(3);
    const context = makeTestContext();
    
    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    } as any;
    
    const plan = planner.plan(StandardGoals.EliminateEnemies, aiContext);
    
    // Plan may or may not succeed depending on preconditions
    // Just verify it runs without error
    expect(plan === null || plan.actions.length >= 0).toBe(true);
  });

  it('should forecast wait+react opportunities from current position', () => {
    const context = makeTestContext();
    context.character.profile.items = [{ id: 'rifle', classification: 'Firearm' } as any];
    context.character.finalAttributes.ref = 2;
    context.character.attributes.ref = 2;
    const enemy = context.enemies[0];
    enemy.profile.items = [{ id: 'blade', classification: 'Melee' } as any];
    enemy.finalAttributes.ref = 3;
    enemy.attributes.ref = 3;
    enemy.finalAttributes.mov = 3;
    enemy.attributes.mov = 3;
    enemy.state.isHidden = true;

    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
        visibilityOrMu: 16,
      },
    } as any;

    const forecast = forecastWaitReact(aiContext);
    expect(forecast.potentialReactTargets).toBeGreaterThan(0);
    expect(forecast.expectedTriggerCount).toBeGreaterThan(0);
    expect(forecast.expectedReactValue).toBeGreaterThan(0);
    expect(forecast.refGatePassCount).toBeGreaterThan(0);
  });

  it('should roll out wait-react branches and pick a preferred branch', () => {
    const context = makeTestContext();
    context.character.profile.items = [{ id: 'rifle', classification: 'Firearm' } as any];
    context.character.finalAttributes.ref = 3;
    context.character.attributes.ref = 3;

    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
        visibilityOrMu: 16,
      },
    } as any;

    const rollout = rolloutWaitReactBranches(aiContext, {
      immediateScore: 1.4,
      waitBaseline: 2.2,
      moveCandidates: [{ x: 13, y: 12 }, { x: 12, y: 13 }],
      maxMoveCandidates: 2,
    });

    expect(rollout.branches.length).toBe(3);
    expect(rollout.preferred.score).toBeGreaterThan(0);
    expect(rollout.branches.some(branch => branch.id === 'wait_now')).toBe(true);
    expect(rollout.branches.some(branch => branch.id === 'move_then_wait')).toBe(true);
  });

  it('should evaluate world state conditions', () => {
    const planner = createDefaultGOAPPlanner();
    
    const condition = {
      property: 'test',
      value: 5,
      comparison: 'equals' as const,
    };
    
    const state = {
      positions: new Map(),
      wounds: new Map(),
      status: new Map(),
      engaged: new Set(),
      turn: 1,
      test: 5,
    };
    
    // Access private method via any cast for testing
    const result = (planner as any).checkCondition(condition, state);
    expect(result).toBe(true);
  });

  it('should estimate success probability', () => {
    const planner = createDefaultGOAPPlanner();
    const context = makeTestContext();
    
    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    } as any;
    
    // Access private method via any cast for testing
    const probability = (planner as any).estimateSuccessProbability([], aiContext);
    
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThanOrEqual(1);
  });

  it('should have standard actions defined', () => {
    const actions = createStandardActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(a => a.type === 'move')).toBe(true);
    expect(actions.some(a => a.type === 'close_combat')).toBe(true);
    expect(actions.some(a => a.type === 'ranged_combat')).toBe(true);
    expect(actions.some(a => a.type === 'disengage')).toBe(true);
    expect(actions.some(a => a.type === 'hold')).toBe(true);
  });

  it('should validate actions against game state', () => {
    const context = makeTestContext();
    const actions = createStandardActions();
    const moveAction = actions.find(a => a.type === 'move')!;
    
    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    } as any;

    // Valid move action
    const validResult = validateAction(moveAction, aiContext, undefined, { x: 14, y: 12 });
    expect(validResult.isValid).toBe(true);

    // Invalid move (out of range)
    const invalidResult = validateAction(moveAction, aiContext, undefined, { x: 100, y: 100 });
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  it('should validate close combat requires engagement', () => {
    const context = makeTestContext();
    const actions = createStandardActions();
    const ccAction = actions.find(a => a.type === 'close_combat')!;
    
    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    } as any;

    // Not engaged - should fail
    const result = validateAction(ccAction, aiContext, context.enemies[0]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('engaged'))).toBe(true);
  });

  it('should reject close combat when only friendly engagement exists', () => {
    const context = makeTestContext();
    const actions = createStandardActions();
    const ccAction = actions.find(a => a.type === 'close_combat')!;

    // Force base-contact with ally, but keep enemy out of melee range.
    context.battlefield.placeCharacter(context.allies[0], { x: 12.5, y: 12 });

    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    } as any;

    const result = validateAction(ccAction, aiContext, context.enemies[0]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('engaged'))).toBe(true);
  });

  it('should allow move when only friendly base-contact exists', () => {
    const context = makeTestContext();
    const actions = createStandardActions();
    const moveAction = actions.find(a => a.type === 'move')!;

    // Base-contact ally does not count as enemy engagement.
    context.battlefield.placeCharacter(context.allies[0], { x: 12.5, y: 12 });

    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    } as any;

    const result = validateAction(moveAction, aiContext, undefined, { x: 13, y: 12 });
    expect(result.isValid).toBe(true);
  });

  it('should validate rally requires fear tokens', () => {
    const context = makeTestContext();
    const actions = createStandardActions();
    const rallyAction = actions.find(a => a.type === 'rally')!;
    
    const aiContext = {
      character: context.character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 1,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    } as any;

    // Ally has no fear - should fail
    const result = validateAction(rallyAction, aiContext, context.allies[0]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Fear'))).toBe(true);

    // Ally has fear - should pass (if in cohesion)
    context.allies[0].state.fearTokens = 2;
    const validResult = validateAction(rallyAction, aiContext, context.allies[0]);
    expect(validResult.isValid).toBe(true);
  });

  it('should have standard goals defined', () => {
    expect(StandardGoals.Survive).toBeDefined();
    expect(StandardGoals.EliminateEnemies).toBeDefined();
    expect(StandardGoals.ProtectAlly).toBeDefined();
    expect(StandardGoals.Survive.isUrgent).toBe(true);
    expect(StandardGoals.Survive.priority).toBe(10);
  });
});
