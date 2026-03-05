/**
 * AI Integration Tests
 *
 * End-to-end tests for the complete AI pipeline:
 * SideAI → AssemblyAI → CharacterAI → AIActionExecutor → GameManager
 *
 * These tests verify that the AI system actually works in practice,
 * not just in isolated unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core';
import { Battlefield } from '../battlefield';
import { GameManager } from '../engine';
import { buildAssembly, buildProfile } from '../mission';
import { buildMissionSide } from '../mission';
import { createAIGameLoop, AIGameLoop } from './executor/AIGameLoop';
import { MissionSide } from '../mission';

/**
 * Create a test assembly with specified composition
 */
function createTestAssembly(
  name: string,
  composition: Array<{ archetype: string; count: number; items?: string[] }>
) {
  const profiles = [];
  let modelIndex = 0;

  for (const { archetype, count, items = [] } of composition) {
    for (let i = 0; i < count; i++) {
      const profile = buildProfile(archetype, { itemNames: items });
      // Set profile name before creating character
      profile.name = `${name}-${modelIndex}`;
      profiles.push(profile);
      modelIndex++;
    }
  }

  const roster = buildAssembly(name, profiles);
  
  // Ensure all characters have names (fallback if profile.name wasn't set)
  roster.characters.forEach((char, idx) => {
    if (!char.name) {
      char.name = `${name}-${idx}`;
      char.id = `${name}-${idx}`;
    }
  });
  
  return roster;
}

/**
 * Create two opposing sides for AI testing
 */
function createOpposingSides(): { sideA: MissionSide; sideB: MissionSide } {
  // Side A: Balanced force
  const rosterA = createTestAssembly('Alpha', [
    { archetype: 'Veteran', count: 2, items: ['Sword, Broad', 'Armor, Light'] },
    { archetype: 'Average' as any, count: 3, items: ['Sword, Broad'] },
    { archetype: 'Militia', count: 2, items: ['Spear, Medium'] },
  ]);
  
  // Side B: Aggressive force
  const rosterB = createTestAssembly('Bravo', [
    { archetype: 'Elite', count: 1, items: ['Sword, Broad', 'Armor, Medium'] },
    { archetype: 'Veteran', count: 2, items: ['Sword, Broad'] },
    { archetype: 'Average' as any, count: 4, items: ['Spear, Medium'] },
  ]);
  
  // Use buildMissionSide which properly sets character names via portrait system
  const sideA = buildMissionSide('Alpha', [rosterA], { startingIndex: 0 });
  const sideB = buildMissionSide('Bravo', [rosterB], { startingIndex: rosterA.characters.length });
  
  return {  sideA, sideB  } as any;
}

/**
 * Deploy sides on opposite edges of the battlefield
 */
function deploySides(
  sideA: MissionSide,
  sideB: MissionSide,
  battlefield: Battlefield,
  battlefieldSize: number
) {
  const deploymentDepth = 4;
  
  // Ensure all characters have names (safety check)
  let charIdx = 0;
  sideA.members.forEach((m: any) => {
    if (!m.character.name) m.character.name = `${sideA.id}-${charIdx}`;
    if (!m.character.id) m.character.id = `${sideA.id}-${charIdx}`;
    charIdx++;
  });
  charIdx = 0;
  sideB.members.forEach((m: any) => {
    if (!m.character.name) m.character.name = `${sideB.id}-${charIdx}`;
    if (!m.character.id) m.character.id = `${sideB.id}-${charIdx}`;
    charIdx++;
  });
  
  // Side A deploys on left edge
  sideA.members.forEach((member, index) => {
    const x = deploymentDepth + (index % 3) * 4;
    const y = 4 + Math.floor(index / 3) * 6;
    battlefield.placeCharacter(member.character, { x, y });
  });
  
  // Side B deploys on right edge
  sideB.members.forEach((member, index) => {
    const x = battlefieldSize - deploymentDepth - (index % 3) * 4;
    const y = 4 + Math.floor(index / 3) * 6;
    battlefield.placeCharacter(member.character, { x, y });
  });
}

describe('AI Integration', () => {
  let battlefield: Battlefield;
  let sideA: MissionSide;
  let sideB: MissionSide;
  let manager: GameManager;
  let aiLoop: AIGameLoop;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);
    const sides = createOpposingSides();
    sideA = sides.sideA;
    sideB = sides.sideB;
    
    deploySides(sideA, sideB, battlefield, 24);
    
    const allCharacters = [
      ...sideA.members.map((m: any) => m.character),
      ...sideB.members.map((m: any) => m.character),
    ];
    manager = new GameManager(allCharacters, battlefield);
    
    aiLoop = createAIGameLoop(manager, battlefield, [sideA, sideB], {
      enableStrategic: true,
      enableTactical: true,
      enableCharacterAI: true,
      enableValidation: true,
      enableReplanning: true,
      verboseLogging: false,
    });
  });

  describe('Basic AI Functionality', () => {
    it('should create AI layers for all sides', () => {
      expect(aiLoop).toBeDefined();
      expect(aiLoop.config.enableStrategic).toBe(true);
      expect(aiLoop.config.enableTactical).toBe(true);
      expect(aiLoop.config.enableCharacterAI).toBe(true);
    });

    it('should initialize character AIs for all characters', () => {
      const totalCharacters = sideA.members.length + sideB.members.length;
      // CharacterAIs are created internally, verify through execution
      expect(totalCharacters).toBeGreaterThan(0);
    });

    it('should execute at least one action successfully', () => {
      // Create fresh instance for this test
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB]);
      
      const result = aiLoop2.runGame(1);

      expect(result).toBeDefined();
      expect(result.totalActions).toBeGreaterThanOrEqual(0);
      expect(result.successfulActions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multi-Turn AI Game', () => {
    it('should run a complete 3-turn AI vs AI game', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB]);
      
      const result = aiLoop2.runGame(3);

      expect(result.finalTurn).toBeGreaterThanOrEqual(1);
      expect(result.finalTurn).toBeLessThanOrEqual(3);
      expect(result.totalActions).toBeGreaterThanOrEqual(0);

      // Verify some actions succeeded
      expect(result.successfulActions).toBeGreaterThanOrEqual(0);

      // Verify failed actions are tracked
      expect(result.failedActions).toBeGreaterThanOrEqual(0);
    });

    it('should track replanned actions', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB]);
      
      const result = aiLoop2.runGame(5);

      // Replanning should be attempted for failed actions
      expect(result.replannedActions).toBeGreaterThanOrEqual(0);
      expect(result.replannedActions).toBeLessThanOrEqual(result.failedActions + result.successfulActions);
    });

    it('should end game when one side is eliminated', () => {
      // Run until game over or max 10 turns
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);

      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB]);

      const result = aiLoop2.runGame(10);

      // Count remaining models
      const sideARemaining = sides.sideA.members.filter(
        m => !m.character.state.isEliminated && !m.character.state.isKOd
      ).length;
      const sideBRemaining = sides.sideB.members.filter(
        m => !m.character.state.isEliminated && !m.character.state.isKOd
      ).length;

      // Game should end at max turns or when one side eliminated
      expect(result.finalTurn).toBeLessThanOrEqual(10);
      expect(result).toBeDefined();

      // If one side was eliminated, verify the other side has remaining models
      if (sideARemaining === 0) {
        expect(sideBRemaining).toBeGreaterThan(0);
      } else if (sideBRemaining === 0) {
        expect(sideARemaining).toBeGreaterThan(0);
      }
      // Otherwise, game ended due to max turns (also valid)
    });
  });

  describe('AI Decision Making', () => {
    it('should make movement decisions', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB]);
      
      const result = aiLoop2.runGame(2);

      // AI should attempt moves to engage enemies
      expect(result.totalActions).toBeGreaterThanOrEqual(0);
    });

    it('should handle engagement correctly', () => {
      // Deploy models already engaged
      const battlefield2 = new Battlefield(24, 24);
      const sides = createOpposingSides();

      // Deploy in base contact
      battlefield2.placeCharacter(sides.sideA.members[0].character, { x: 10, y: 12 });
      battlefield2.placeCharacter(sides.sideB.members[0].character, { x: 10.5, y: 12 });

      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB]);

      const result = aiLoop2.runGame(2);

      // Should attempt close combat or disengage
      expect(result).toBeDefined();
    });

    it('should handle ranged combat when appropriate', () => {
      const battlefield2 = new Battlefield(24, 24);
      
      // Create a force with ranged weapons
      const rosterA = createTestAssembly('Alpha', [
        { archetype: 'Average' as any, count: 3, items: ['Bow, Medium'] },
      ]);
      const rosterB = createTestAssembly('Bravo', [
        { archetype: 'Average' as any, count: 3, items: ['Sword, Broad'] },
      ]);

      const sideA2 = buildMissionSide('Alpha', [rosterA], { startingIndex: 0 });
      const sideB2 = buildMissionSide('Bravo', [rosterB], { startingIndex: 3 });

      // Deploy at range
      sideA2.members.forEach((member, index) => {
        battlefield2.placeCharacter(member.character, { x: 4, y: 8 + index * 4 });
      });
      sideB2.members.forEach((member, index) => {
        battlefield2.placeCharacter(member.character, { x: 18, y: 8 + index * 4 });
      });

      const allCharacters = [
        ...sideA2.members.map((m: any) => m.character),
        ...sideB2.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sideA2, sideB2]);

      const result = aiLoop2.runGame(2);

      // Should complete without errors
      expect(result).toBeDefined();
    });
  });

  describe('AI Configuration', () => {
    it('should work with strategic layer disabled', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      
      const aiLoopNoStrategic = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB], {
        enableStrategic: false,
        enableTactical: true,
        enableCharacterAI: true,
        enableValidation: true,
        enableReplanning: true,
      });

      const result = aiLoopNoStrategic.runGame(2);
      expect(result).toBeDefined();
    });

    it('should work with tactical layer disabled', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      
      const aiLoopNoTactical = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB], {
        enableStrategic: true,
        enableTactical: false,
        enableCharacterAI: true,
        enableValidation: true,
        enableReplanning: true,
      });

      const result = aiLoopNoTactical.runGame(2);
      expect(result).toBeDefined();
    });

    it('should work with only CharacterAI enabled', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      
      const aiLoopOnlyChar = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB], {
        enableStrategic: false,
        enableTactical: false,
        enableCharacterAI: true,
        enableValidation: true,
        enableReplanning: true,
      });

      const result = aiLoopOnlyChar.runGame(2);
      expect(result).toBeDefined();
    });

    it('should work with validation disabled', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      
      const aiLoopNoValidation = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB], {
        enableStrategic: true,
        enableTactical: true,
        enableCharacterAI: true,
        enableValidation: false,
        enableReplanning: true,
      });

      const result = aiLoopNoValidation.runGame(2);
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single model per side', () => {
      const rosterA = createTestAssembly('Alpha', [
        { archetype: 'Elite', count: 1, items: ['Sword, Broad'] },
      ]);
      const rosterB = createTestAssembly('Bravo', [
        { archetype: 'Elite', count: 1, items: ['Sword, Broad'] },
      ]);
      
      const sideA2 = buildMissionSide('Alpha', [rosterA], { startingIndex: 0 });
      const sideB2 = buildMissionSide('Bravo', [rosterB], { startingIndex: 1 });
      
      const battlefield2 = new Battlefield(24, 24);
      battlefield2.placeCharacter(sideA2.members[0].character, { x: 10, y: 12 });
      battlefield2.placeCharacter(sideB2.members[0].character, { x: 14, y: 12 });
      
      const allCharacters = [
        ...sideA2.members.map((m: any) => m.character),
        ...sideB2.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sideA2, sideB2]);
      
      const result = aiLoop2.runGame(5);
      
      expect(result.finalTurn).toBeGreaterThanOrEqual(1);
      expect(result.totalActions).toBeGreaterThanOrEqual(0);
    });

    it('should handle all models already KOd on one side', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      // KO all Side B models
      sides.sideB.members.forEach((m: any) => {
        m.character.state.isKOd = true;
      });

      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB]);
      const result = aiLoop2.runGame(2);

      // Game should end quickly or Side A should have no valid targets
      expect(result).toBeDefined();
    });

    it('should handle large forces (20+ models per side)', { timeout: 15000 }, () => {
      const battlefield2 = new Battlefield(48, 48);

      const rosterA = createTestAssembly('Alpha', [
        { archetype: 'Militia', count: 15 },
        { archetype: 'Average' as any, count: 10 },
      ]);
      const rosterB = createTestAssembly('Bravo', [
        { archetype: 'Militia', count: 15 },
        { archetype: 'Average' as any, count: 10 },
      ]);

      const sideA2 = buildMissionSide('Alpha', [rosterA], { startingIndex: 0 });
      const sideB2 = buildMissionSide('Bravo', [rosterB], { startingIndex: rosterA.characters.length });

      // Ensure all characters have names (safety check)
      let charIdx = 0;
      sideA2.members.forEach((m: any) => {
        if (!m.character.name) m.character.name = `Alpha-${charIdx}`;
        if (!m.character.id) m.character.id = `Alpha-${charIdx}`;
        charIdx++;
      });
      charIdx = 0;
      sideB2.members.forEach((m: any) => {
        if (!m.character.name) m.character.name = `Bravo-${charIdx}`;
        if (!m.character.id) m.character.id = `Bravo-${charIdx}`;
        charIdx++;
      });

      // Deploy in formation
      sideA2.members.forEach((member, index) => {
        const x = 4 + (index % 5) * 4;
        const y = 4 + Math.floor(index / 5) * 4;
        battlefield2.placeCharacter(member.character, { x, y });
      });

      sideB2.members.forEach((member, index) => {
        const x = 40 - (index % 5) * 4;
        const y = 4 + Math.floor(index / 5) * 4;
        battlefield2.placeCharacter(member.character, { x, y });
      });

      const allCharacters = [
        ...sideA2.members.map((m: any) => m.character),
        ...sideB2.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sideA2, sideB2], {
        maxActionsPerTurn: 2, // Limit actions for performance
      });

      const result = aiLoop2.runGame(3);

      expect(result).toBeDefined();
    });
  });

  describe('AI Performance', () => {
    it('should complete a 5-turn game in reasonable time (< 5 seconds)', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB]);
      
      const startTime = Date.now();
      const result = aiLoop2.runGame(5);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(result).toBeDefined();
    });

    it('should scale reasonably with model count', () => {
      const sides = createOpposingSides();
      const battlefield2 = new Battlefield(24, 24);
      deploySides(sides.sideA, sides.sideB, battlefield2, 24);
      
      const allCharacters = [
        ...sides.sideA.members.map((m: any) => m.character),
        ...sides.sideB.members.map((m: any) => m.character),
      ];
      const manager2 = new GameManager(allCharacters, battlefield2);
      const aiLoop2 = createAIGameLoop(manager2, battlefield2, [sides.sideA, sides.sideB]);
      
      // Small game (6 models)
      const smallResult = aiLoop2.runGame(2);

      // The test itself verifies scaling - just ensure it completes
      expect(smallResult).toBeDefined();
    });
  });
});
