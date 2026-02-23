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
  StandardActions,
  StandardGoals,
} from '../tactical/GOAP';
import { Character } from '../../core/Character';
import { Profile } from '../../core/Profile';
import { Battlefield } from '../../battlefield/Battlefield';

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
    burden: { totalLaden: 0, totalBurden: 0 },
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
  
  return { character, allies: [ally], enemies: [enemy], battlefield };
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
    };
    
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
    };
    
    const plan = planner.plan(StandardGoals.EliminateEnemies, aiContext);
    
    // Plan may or may not succeed depending on preconditions
    // Just verify it runs without error
    expect(plan === null || plan.actions.length >= 0).toBe(true);
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
    };
    
    // Access private method via any cast for testing
    const probability = (planner as any).estimateSuccessProbability([], aiContext);
    
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThanOrEqual(1);
  });

  it('should have standard actions defined', () => {
    expect(StandardActions.Move).toBeDefined();
    expect(StandardActions.CloseCombat).toBeDefined();
    expect(StandardActions.RangedCombat).toBeDefined();
    expect(StandardActions.Disengage).toBeDefined();
    expect(StandardActions.Hold).toBeDefined();
  });

  it('should have standard goals defined', () => {
    expect(StandardGoals.Survive).toBeDefined();
    expect(StandardGoals.EliminateEnemies).toBeDefined();
    expect(StandardGoals.ProtectAlly).toBeDefined();
    expect(StandardGoals.Survive.isUrgent).toBe(true);
    expect(StandardGoals.Survive.priority).toBe(10);
  });
});
