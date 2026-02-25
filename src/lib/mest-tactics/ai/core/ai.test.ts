/**
 * AI Module Tests
 * 
 * Tests for the hierarchical AI system foundation.
 */

import { describe, it, expect } from 'vitest';
import {
  BehaviorTree,
  SelectorNode,
  SequenceNode,
  ConditionNode,
  ActionNode,
  NodeStatus,
  FSM,
  HierarchicalState,
  IdleState,
  MovingState,
  AttackingState,
  UtilityScorer,
  KnowledgeBase,
  CharacterAI,
  DEFAULT_AI_CONFIG,
} from '../core';
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

describe('BehaviorTree', () => {
  it('should execute a simple selector tree', () => {
    let actionExecuted = false;
    
    const root = new SelectorNode('Root', [
      new ConditionNode('AlwaysFail', () => false),
      new ActionNode('Succeed', () => {
        actionExecuted = true;
        return NodeStatus.SUCCESS;
      }),
    ]);
    
    const tree = new BehaviorTree(root);
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
      config: DEFAULT_AI_CONFIG,
    };
    
    const status = tree.execute(aiContext);
    
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(actionExecuted).toBe(true);
  });

  it('should execute a sequence tree', () => {
    let step1 = false;
    let step2 = false;
    
    const root = new SequenceNode('Root', [
      new ActionNode('Step1', () => {
        step1 = true;
        return NodeStatus.SUCCESS;
      }),
      new ActionNode('Step2', () => {
        step2 = true;
        return NodeStatus.SUCCESS;
      }),
    ]);
    
    const tree = new BehaviorTree(root);
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
      config: DEFAULT_AI_CONFIG,
    };
    
    const status = tree.execute(aiContext);
    
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(step1).toBe(true);
    expect(step2).toBe(true);
  });
});

describe('HierarchicalFSM', () => {
  it('should transition between states', () => {
    const fsm = new FSM(new HierarchicalState('Root'));
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
      config: DEFAULT_AI_CONFIG,
    };
    
    fsm.start(aiContext);
    const status = fsm.update(aiContext);
    
    expect(status).toBeDefined();
  });

  it('should track state path', () => {
    const fsm = new FSM(new HierarchicalState('Root'));
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
      config: DEFAULT_AI_CONFIG,
    };
    
    fsm.start(aiContext);
    const path = fsm.getStatePath();
    
    expect(path).toContain('Root');
  });
});

describe('UtilityScorer', () => {
  it('should score actions', () => {
    const scorer = new UtilityScorer();
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
      config: DEFAULT_AI_CONFIG,
    };
    
    const actions = scorer.evaluateActions(aiContext);
    
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should respect aggression weight', () => {
    const aggressiveScorer = new UtilityScorer({ aggression: 1.0 });
    const cautiousScorer = new UtilityScorer({ aggression: 0.0 });
    
    expect(aggressiveScorer.weights.aggression).toBe(1.0);
    expect(cautiousScorer.weights.aggression).toBe(0.0);
  });
});

describe('KnowledgeBase', () => {
  it('should track enemy knowledge in god mode', () => {
    const kb = new KnowledgeBase({ godMode: true });
    const context = makeTestContext();
    
    const knowledge = kb.updateKnowledge(
      context.character,
      context.allies,
      context.enemies,
      context.battlefield,
      1
    );
    
    expect(knowledge.knownEnemies.size).toBe(1);
  });

  it('should identify threat zones', () => {
    const kb = new KnowledgeBase({ godMode: true });
    const context = makeTestContext();
    
    const knowledge = kb.updateKnowledge(
      context.character,
      context.allies,
      context.enemies,
      context.battlefield,
      1
    );
    
    // Should have threat zones from enemies
    expect(knowledge.threatZones.length).toBeGreaterThan(0);
  });
});

describe('CharacterAI', () => {
  it('should create AI with default config', () => {
    const ai = new CharacterAI();
    const config = ai.getConfig();
    
    expect(config.godMode).toBe(true);
    expect(config.aggression).toBe(0.5);
    expect(config.caution).toBe(0.5);
  });

  it('should decide actions', async () => {
    const ai = new CharacterAI();
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
      config: DEFAULT_AI_CONFIG,
    };
    
    const result = await ai.decideAction(aiContext);
    
    expect(result.decision).toBeDefined();
    expect(result.decision.type).toBeDefined();
  });

  it('should evaluate react opportunities', () => {
    const ai = new CharacterAI();
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
      config: DEFAULT_AI_CONFIG,
    };
    
    const result = ai.evaluateReact(aiContext, {
      trigger: 'move-only',
      actor: context.enemies[0],
      actorPosition: { x: 14, y: 12 },
      isZeroAPAction: false,
      isReposition: false,
      usedAgility: false,
      isLeaning: false,
    });

    expect(result).toBeDefined();
  });

  it('should update config', () => {
    const ai = new CharacterAI();
    ai.setConfig({ aggression: 0.8, caution: 0.3 });
    
    const config = ai.getConfig();
    expect(config.aggression).toBe(0.8);
    expect(config.caution).toBe(0.3);
  });
});
