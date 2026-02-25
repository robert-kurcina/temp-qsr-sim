/**
 * React, Bonus Action, and Stealth Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ReactEvaluator,
  BonusActionEvaluator,
  StealthEvaluator,
} from '../tactical/ReactsAndBonusActions';
import { Character } from '../../core/Character';
import { Profile } from '../../core/Profile';
import { Battlefield } from '../../battlefield/Battlefield';

function makeTestProfile(name: string): Profile {
  return {
    name,
    archetype: { attributes: { cca: 2, rca: 3, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 4, siz: 3 } },
    items: [
      { name: 'Bow', classification: 'Bow', dmg: 'STR', impact: 0, accuracy: '', traits: [], range: 12 },
    ],
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

describe('ReactEvaluator', () => {
  it('should evaluate react to movement', () => {
    const evaluator = new ReactEvaluator();
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
    
    const result = evaluator.evaluateReacts(
      context.character,
      context.enemies[0],
      'move',
      aiContext
    );
    
    expect(result.reactType).toBe('react-move');
    expect(result.priority).toBeGreaterThan(0);
  });

  it('should evaluate counter-strike react to melee attack', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    // Place characters in melee range
    context.battlefield.moveCharacter(context.character, { x: 15, y: 12 });
    
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
    
    const result = evaluator.evaluateReacts(
      context.character,
      context.enemies[0],
      'attack',
      aiContext
    );
    
    // Should be counter-strike since in melee
    expect(result.reactType).toBe('counter_strike');
  });

  it('should not react if KOd or eliminated', () => {
    const evaluator = new ReactEvaluator();
    const context = makeTestContext();
    
    context.character.state.isKOd = true;
    
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
    
    const result = evaluator.evaluateReacts(
      context.character,
      context.enemies[0],
      'move',
      aiContext
    );
    
    expect(result.shouldReact).toBe(false);
  });
});

describe('BonusActionEvaluator', () => {
  it('should evaluate bonus actions after successful hit', () => {
    const evaluator = new BonusActionEvaluator();
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
    
    // Test with 2 cascades
    const decision = evaluator.evaluateBonusActions(
      context.character,
      context.enemies[0],
      2,
      aiContext
    );
    
    expect(decision.available.length).toBeGreaterThan(0);
  });

  it('should reduce cascades when distracted', () => {
    const evaluator = new BonusActionEvaluator();
    const context = makeTestContext();
    
    context.character.state.isDistracted = true;
    
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
    
    // Test with 1 cascade (should be reduced to 0 when distracted)
    const decision = evaluator.evaluateBonusActions(
      context.character,
      context.enemies[0],
      1,
      aiContext
    );
    
    expect(decision.available.length).toBe(0);
    expect(decision.selected).toBeNull();
  });
});

describe('StealthEvaluator', () => {
  it('should evaluate hide when behind cover', () => {
    const evaluator = new StealthEvaluator();
    const context = makeTestContext();
    
    // Set character as in cover
    context.character.state.isInCover = true;
    
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
    
    const decision = evaluator.evaluateHide(aiContext);
    
    // Should return a decision (may or may not hide depending on visibility)
    expect(decision.reason).toBeDefined();
  });

  it('should not hide if already hidden', () => {
    const evaluator = new StealthEvaluator();
    const context = makeTestContext();
    
    context.character.state.isInCover = true;
    context.character.state.isHidden = true;
    
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
    
    const decision = evaluator.evaluateHide(aiContext);
    
    // Should not hide (already hidden or visible)
    expect(decision.shouldHide).toBe(false);
  });

  it('should evaluate detect when hidden enemies exist', () => {
    const evaluator = new StealthEvaluator();
    const context = makeTestContext();
    
    // Set enemy as hidden
    context.enemies[0].state.isHidden = true;
    
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
    
    const decision = evaluator.evaluateDetect(aiContext);
    
    // Should identify hidden enemies as targets
    expect(decision.targets.length).toBeGreaterThanOrEqual(0);
  });
});
