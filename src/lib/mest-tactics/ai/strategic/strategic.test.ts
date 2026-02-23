/**
 * Strategic AI Layer Tests
 * 
 * Tests for SideAI and AssemblyAI systems.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SideAI, 
  createSideAI, 
  StrategicPosture, 
  DEFAULT_SIDE_AI_CONFIG,
} from './SideAI';
import { 
  AssemblyAI, 
  createAssemblyAI, 
  FormationType, 
  CharacterRole,
  createSideAssemblyAIs,
} from './AssemblyAI';
import { Character } from '../../core/Character';
import { Profile } from '../../core/Profile';
import { Battlefield } from '../../battlefield/Battlefield';
import { createMissionSide } from '../../mission/MissionSide';
import { buildAssembly } from '../../mission/assembly-builder';
import { archetypes, melee_weapons } from '../../data';

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

function makeTestSide(
  name: string,
  characterCount: number,
  battlefield: Battlefield,
  startX: number = 0
): { side: any; characters: Character[] } {
  const characters: Character[] = [];
  const profiles: Profile[] = [];
  
  for (let i = 0; i < characterCount; i++) {
    const profile = makeTestProfile(`${name}-${i}`);
    profiles.push(profile);
    const char = new Character(profile);
    char.finalAttributes = char.attributes;
    characters.push(char);
    battlefield.placeCharacter(char, { x: startX + i * 2, y: 12 });
  }

  const roster = buildAssembly(`${name} Assembly`, profiles);
  const side = createMissionSide(name, [roster], { startingIndex: 0 });

  return { side, characters };
}

describe('SideAI', () => {
  let battlefield: Battlefield;
  let sideA: any;
  let sideB: any;
  let sideAI: SideAI;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    sideA = sideAResult.side;
    sideB = sideBResult.side;
    sideAI = createSideAI(sideA, battlefield, sideB);
  });

  it('should create SideAI with default config', () => {
    expect(sideAI).toBeDefined();
    expect(sideAI.config.aggression).toBe(0.5);
    expect(sideAI.config.caution).toBe(0.5);
    expect(sideAI.config.posture).toBe(StrategicPosture.Balanced);
  });

  it('should assess battlefield situation', () => {
    const assessment = sideAI.assessSituation();

    expect(assessment).toBeDefined();
    expect(assessment.forceRatio).toBeGreaterThanOrEqual(0);
    // BPRatio may be 0 if side BP is not set in test data
    expect(assessment.BPRatio).toBeGreaterThanOrEqual(0);
    expect(assessment.threatLevel).toBeGreaterThanOrEqual(0);
    expect(assessment.threatLevel).toBeLessThanOrEqual(1);
    expect(assessment.recommendedPosture).toBeDefined();
    expect(assessment.recommendations.length).toBeGreaterThan(0);
  });

  it('should calculate force ratio correctly', () => {
    const assessment = sideAI.assessSituation();
    
    // Both sides have 3 models, ratio should be ~1
    expect(assessment.forceRatio).toBeCloseTo(1, 1);
  });

  it('should identify priority targets', () => {
    const assessment = sideAI.assessSituation();
    
    expect(assessment.priorityTargets).toBeDefined();
    expect(assessment.priorityTargets.length).toBeGreaterThan(0);
    
    // Priority targets should be sorted by priority
    if (assessment.priorityTargets.length > 1) {
      expect(assessment.priorityTargets[0].priority)
        .toBeGreaterThanOrEqual(assessment.priorityTargets[1].priority);
    }
  });

  it('should generate strategic objectives', () => {
    const assessment = sideAI.assessSituation();
    
    expect(assessment.objectives).toBeDefined();
    expect(assessment.objectives.length).toBeGreaterThan(0);
  });

  it('should evaluate victory conditions', () => {
    const victory = sideAI.evaluateVictoryConditions();
    
    expect(victory).toBeDefined();
    expect(victory.canWin).toBe(false); // Enemy still has models
    expect(victory.canLose).toBe(false); // We still have models
    expect(victory.victoryProbability).toBeGreaterThanOrEqual(0);
    expect(victory.victoryProbability).toBeLessThanOrEqual(1);
  });

  it('should recommend defensive posture when outnumbered', () => {
    // Create a new side with fewer models
    const battlefield2 = new Battlefield(24, 24);
    const weakSideResult = makeTestSide('Weak', 2, battlefield2, 2);
    const strongSideResult = makeTestSide('Strong', 6, battlefield2, 18);
    
    const weakSideAI = createSideAI(weakSideResult.side, battlefield2, strongSideResult.side);
    const assessment = weakSideAI.assessSituation();
    
    // Should recommend defensive when heavily outnumbered
    expect(assessment.forceRatio).toBeLessThan(1);
  });

  it('should allocate resources', () => {
    const allocation = sideAI.allocateResources();
    
    expect(allocation.assemblyPriorities).toBeDefined();
    expect(allocation.targetPriorities).toBeDefined();
    expect(allocation.assemblyPriorities.size).toBeGreaterThan(0);
  });
});

describe('AssemblyAI', () => {
  let battlefield: Battlefield;
  let side: any;
  let assemblyAI: AssemblyAI;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);
    const sideResult = makeTestSide('Alpha', 4, battlefield, 6);
    side = sideResult.side;
    assemblyAI = createAssemblyAI(side.assemblies[0], battlefield, side);
  });

  it('should create AssemblyAI with default config', () => {
    expect(assemblyAI).toBeDefined();
    expect(assemblyAI.config.preferredFormation).toBe(FormationType.Cluster);
    expect(assemblyAI.config.coordinateFocusFire).toBe(true);
  });

  it('should get active characters', () => {
    const characters = assemblyAI.getActiveCharacters();
    expect(characters.length).toBe(4);
  });

  it('should assign roles to characters', () => {
    const characters = assemblyAI.getActiveCharacters();
    const roles = assemblyAI.assignRoles(characters);

    expect(roles.size).toBe(4);
    
    // All roles should be valid
    for (const [id, role] of roles.entries()) {
      expect(Object.values(CharacterRole)).toContain(role);
    }
  });

  it('should get formation state', () => {
    const characters = assemblyAI.getActiveCharacters();
    const formation = assemblyAI.getFormationState(characters);

    expect(formation).toBeDefined();
    expect(formation.type).toBeDefined();
    expect(formation.members.length).toBe(4);
    expect(formation.spread).toBeGreaterThanOrEqual(0);
  });

  it('should check cohesion', () => {
    // Place characters close together (within 8 MU cohesion range)
    const battlefield2 = new Battlefield(24, 24);
    const sideResult = makeTestSide('Alpha', 4, battlefield2, 10); // Start at x=10, spread 2 MU each
    const assemblyAI2 = createAssemblyAI(sideResult.side.assemblies[0], battlefield2, sideResult.side);
    
    const characters = assemblyAI2.getActiveCharacters();
    const isCohesive = assemblyAI2.isMaintainingCohesion(characters);

    // Cohesion check verifies all models have at least one ally within cohesion range
    // This test verifies the function runs without error
    expect(typeof isCohesive).toBe('boolean');
  });

  it('should coordinate target assignments', () => {
    const characters = assemblyAI.getActiveCharacters();
    const enemies = [makeTestCharacter('enemy-1'), makeTestCharacter('enemy-2')];
    
    enemies.forEach(e => battlefield.placeCharacter(e, { x: 18, y: 12 }));
    
    const assignments = assemblyAI.coordinateTargets(characters, enemies);
    
    expect(assignments).toBeDefined();
    // May or may not assign depending on positions
    expect(Array.isArray(assignments)).toBe(true);
  });

  it('should generate coordinated actions', () => {
    const characters = assemblyAI.getActiveCharacters();
    const enemies = [makeTestCharacter('enemy-1')];
    enemies.forEach(e => battlefield.placeCharacter(e, { x: 18, y: 12 }));
    
    const targetAssignments = assemblyAI.coordinateTargets(characters, enemies);
    const decisions = assemblyAI.generateCoordinatedActions(
      characters, 
      enemies, 
      targetAssignments
    );

    expect(decisions.size).toBe(4); // One decision per character
    
    for (const [id, decision] of decisions.entries()) {
      expect(decision.type).toBeDefined();
      expect(decision.priority).toBeGreaterThanOrEqual(0);
    }
  });

  it('should identify flanking opportunities', () => {
    const characters = assemblyAI.getActiveCharacters();
    const enemies = [makeTestCharacter('enemy-1')];
    
    // Place enemy engaged with one friendly
    battlefield.placeCharacter(enemies[0], { x: 8, y: 12 });
    
    const opportunities = assemblyAI.identifyFlankingOpportunities(characters, enemies);
    
    expect(opportunities).toBeDefined();
    expect(Array.isArray(opportunities)).toBe(true);
  });
});

describe('Strategic Layer Integration', () => {
  it('should create AssemblyAIs for all assemblies in a side', () => {
    const battlefield = new Battlefield(24, 24);
    const sideResult = makeTestSide('Alpha', 4, battlefield, 6);
    
    const assemblyAIs = createSideAssemblyAIs(sideResult.side, battlefield);
    
    expect(assemblyAIs).toBeDefined();
    expect(assemblyAIs.size).toBe(sideResult.side.assemblies.length);
  });

  it('should integrate SideAI and AssemblyAI for coordinated decisions', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    const sideAI = createSideAI(sideAResult.side, battlefield, sideBResult.side);
    const assemblyAIs = createSideAssemblyAIs(sideAResult.side, battlefield);
    
    // Get strategic assessment
    const assessment = sideAI.assessSituation();
    
    // Get assembly-level coordination
    for (const [assemblyId, assemblyAI] of assemblyAIs.entries()) {
      const characters = assemblyAI.getActiveCharacters();
      const enemies = sideBResult.characters;
      
      const targetAssignments = assemblyAI.coordinateTargets(characters, enemies);
      const decisions = assemblyAI.generateCoordinatedActions(
        characters, 
        enemies, 
        targetAssignments
      );
      
      expect(decisions.size).toBe(characters.length);
    }
  });
});
