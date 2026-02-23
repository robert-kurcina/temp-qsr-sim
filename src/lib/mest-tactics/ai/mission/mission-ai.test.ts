/**
 * Mission AI Tests
 * 
 * Phase 5: Mission Specialization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../../core/Character';
import { Profile } from '../../core/Profile';
import { Battlefield } from '../../battlefield/Battlefield';
import { createMissionSide } from '../../mission/MissionSide';
import { buildAssembly } from '../../mission/assembly-builder';
import { MissionAIContext } from './MissionAI';
import {
  EliminationMissionAI,
  ConvergenceMissionAI,
  DominionMissionAI,
  RecoveryMissionAI,
  EscortMissionAI,
  AssaultMissionAI,
  TriumvirateMissionAI,
  BreachMissionAI,
  DefianceMissionAI,
  StealthMissionAI,
  createMissionAI,
} from './MissionAIs';

function makeTestProfile(name: string): Profile {
  return {
    name,
    archetype: { 
      name: 'Average',
      attributes: { 
        cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 4, siz: 3 
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
  startX: number = 0,
  vipIndex: number = -1
): any {
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
  const side = createMissionSide(name, [roster], { 
    startingIndex: 0,
    vipModelId: vipIndex >= 0 ? characters[vipIndex].id : undefined,
  });

  return { side, characters };
}

function makeMissionContext(
  side: any,
  enemySides: any[] | any,
  battlefield: Battlefield,
  missionState: Record<string, unknown> = {}
): MissionAIContext {
  const enemyArray = Array.isArray(enemySides) ? enemySides : [enemySides];
  return {
    currentTurn: 1,
    currentRound: 1,
    side,
    enemySides: enemyArray,
    battlefield,
    missionState,
  };
}

describe('MissionAI Factory', () => {
  it('should create EliminationMissionAI', () => {
    const ai = createMissionAI('QAI_1');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_1');
    expect(ai?.missionName).toBe('Elimination');
  });

  it('should create ConvergenceMissionAI', () => {
    const ai = createMissionAI('QAI_12');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_12');
    expect(ai?.missionName).toBe('Convergence');
  });

  it('should create AssaultMissionAI', () => {
    const ai = createMissionAI('QAI_13');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_13');
    expect(ai?.missionName).toBe('Assault');
  });

  it('should create DominionMissionAI', () => {
    const ai = createMissionAI('QAI_14');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_14');
    expect(ai?.missionName).toBe('Dominion');
  });

  it('should create RecoveryMissionAI', () => {
    const ai = createMissionAI('QAI_15');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_15');
    expect(ai?.missionName).toBe('Recovery');
  });

  it('should create EscortMissionAI', () => {
    const ai = createMissionAI('QAI_16');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_16');
    expect(ai?.missionName).toBe('Escort');
  });

  it('should create TriumvirateMissionAI', () => {
    const ai = createMissionAI('QAI_17');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_17');
    expect(ai?.missionName).toBe('Triumvirate');
  });

  it('should create StealthMissionAI', () => {
    const ai = createMissionAI('QAI_18');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_18');
    expect(ai?.missionName).toBe('Stealth');
  });

  it('should create DefianceMissionAI', () => {
    const ai = createMissionAI('QAI_19');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_19');
    expect(ai?.missionName).toBe('Defiance');
  });

  it('should create BreachMissionAI', () => {
    const ai = createMissionAI('QAI_20');
    expect(ai).toBeDefined();
    expect(ai?.missionId).toBe('QAI_20');
    expect(ai?.missionName).toBe('Breach');
  });

  it('should return undefined for unknown mission', () => {
    const ai = createMissionAI('UNKNOWN');
    expect(ai).toBeUndefined();
  });
});

describe('EliminationMissionAI', () => {
  it('should prioritize wounded targets', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    // Wound one enemy
    sideBResult.characters[0].state.wounds = 2;
    
    const context = makeMissionContext(sideAResult.side, sideBResult.side, battlefield);
    const ai = new EliminationMissionAI();
    
    const priorities = ai.getStrategicPriorities(context);
    // Wounded enemies should be in priority targets
    expect(priorities.priorityTargets).toBeDefined();
  });
});

describe('ConvergenceMissionAI', () => {
  it('should prioritize capturing uncontrolled zones', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    const zones = [
      { id: 'zone1', center: { x: 12, y: 12 }, controlledBy: undefined, contested: false },
    ];
    
    const context = makeMissionContext(sideAResult.side, sideBResult.side, battlefield, { zones });
    const ai = new ConvergenceMissionAI();
    
    const decision = ai.getDecision(sideAResult.characters[0], context);
    expect(decision).toBeDefined();
    expect(decision?.override?.type).toBe('move');
    expect(decision?.context).toContain('Capture');
  });

  it('should get strategic priorities for zones', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    const zones = [
      { id: 'zone1', center: { x: 12, y: 12 }, controlledBy: sideBResult.side.id, contested: false },
      { id: 'zone2', center: { x: 8, y: 12 }, controlledBy: undefined, contested: false },
    ];
    
    const context = makeMissionContext(sideAResult.side, sideBResult.side, battlefield, { zones });
    const ai = new ConvergenceMissionAI();
    
    const priorities = ai.getStrategicPriorities(context);
    expect(priorities.priorityZones).toContain('zone1');
    expect(priorities.priorityZones).toContain('zone2');
  });
});

describe('DominionMissionAI', () => {
  it('should capture uncontrolled zones', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    const zones = [
      { id: 'zone1', center: { x: 12, y: 12 }, controlledBy: undefined, contested: false },
    ];
    
    const context = makeMissionContext(sideAResult.side, sideBResult.side, battlefield, { zones });
    const ai = new DominionMissionAI();
    
    const decision = ai.getDecision(sideAResult.characters[0], context);
    expect(decision).toBeDefined();
    expect(decision?.override?.type).toBe('move');
  });
});

describe('RecoveryMissionAI', () => {
  it('should assign Guard role to non-VIP', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 10, 0);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    const context = makeMissionContext(sideAResult.side, sideBResult.side, battlefield);
    const ai = new RecoveryMissionAI();
    
    const role = ai.getCharacterRole(sideAResult.characters[1], context);
    expect(role).toBe('Guard');
  });
});

describe('EscortMissionAI', () => {
  it('should assign correct roles based on side', () => {
    const battlefield = new Battlefield(24, 24);
    const attackerResult = makeTestSide('Attacker', 3, battlefield, 2);
    const defenderResult = makeTestSide('Defender', 3, battlefield, 18);
    
    const context = makeMissionContext(attackerResult.side, defenderResult.side, battlefield);
    const ai = new EscortMissionAI();
    
    // Attacker side characters should be Assassins
    const attackerRole = ai.getCharacterRole(attackerResult.characters[0], context);
    expect(attackerRole).toBe('Assassin');
  });
});

describe('AssaultMissionAI', () => {
  it('should move to assault marker', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    const markers = [
      { id: 'm1', position: { x: 12, y: 12 }, assaulted: false },
    ];
    
    const context = makeMissionContext(sideAResult.side, sideBResult.side, battlefield, { markers });
    const ai = new AssaultMissionAI();
    
    const decision = ai.getDecision(sideAResult.characters[0], context);
    expect(decision).toBeDefined();
    expect(decision?.override?.type).toBe('move');
  });
});

describe('TriumvirateMissionAI', () => {
  it('should prioritize completing triad', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    const zones = [
      { id: 'z1', center: { x: 8, y: 12 }, controlledBy: sideAResult.side.id },
      { id: 'z2', center: { x: 16, y: 12 }, controlledBy: sideAResult.side.id },
      { id: 'z3', center: { x: 12, y: 6 }, controlledBy: undefined },
    ];
    
    const context = makeMissionContext(sideAResult.side, sideBResult.side, battlefield, { zones });
    const ai = new TriumvirateMissionAI();
    
    const decision = ai.getDecision(sideAResult.characters[0], context);
    expect(decision).toBeDefined();
    expect(decision?.context).toContain('triad');
  });

  it('should get strategic priorities for triad', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    const zones = [
      { id: 'z1', center: { x: 8, y: 12 }, controlledBy: sideAResult.side.id },
      { id: 'z2', center: { x: 16, y: 12 }, controlledBy: sideAResult.side.id },
      { id: 'z3', center: { x: 12, y: 6 }, controlledBy: undefined },
    ];
    
    const context = makeMissionContext(sideAResult.side, sideBResult.side, battlefield, { zones });
    const ai = new TriumvirateMissionAI();
    
    const priorities = ai.getStrategicPriorities(context);
    expect(priorities.objectives).toContain('complete_triad');
  });
});

describe('BreachMissionAI', () => {
  it('should position for switch turn', () => {
    const battlefield = new Battlefield(24, 24);
    const sideAResult = makeTestSide('Alpha', 3, battlefield, 2);
    const sideBResult = makeTestSide('Bravo', 3, battlefield, 18);
    
    const markers = [
      { id: 'm1', position: { x: 12, y: 12 }, controlledBy: sideBResult.side.id },
    ];
    
    const context = makeMissionContext(sideAResult.side, sideBResult.side, battlefield, { 
      markers, 
      switchTurns: [4, 8] 
    });
    context.currentTurn = 3; // Turn before switch
    
    const ai = new BreachMissionAI();
    
    const decision = ai.getDecision(sideAResult.characters[0], context);
    expect(decision).toBeDefined();
    expect(decision?.context).toContain('switch');
  });
});

describe('DefianceMissionAI', () => {
  it('should assign correct roles', () => {
    const battlefield = new Battlefield(24, 24);
    const defenderResult = makeTestSide('Defender', 3, battlefield, 12, 0);
    const attackerResult = makeTestSide('Attacker', 3, battlefield, 2);
    
    // Test from defender perspective
    const defenderContext = makeMissionContext(defenderResult.side, [attackerResult.side], battlefield);
    const ai = new DefianceMissionAI();
    
    // First character (index 0) is VIP for defender
    const vipRole = ai.getCharacterRole(defenderResult.characters[0], defenderContext);
    expect(vipRole).toBeDefined();
    
    // Test from attacker perspective
    const attackerContext = makeMissionContext(attackerResult.side, [defenderResult.side], battlefield);
    const attackerRole = ai.getCharacterRole(attackerResult.characters[0], attackerContext);
    expect(attackerRole).toBe('Attacker');
  });
});

describe('StealthMissionAI', () => {
  it('should assign Infiltrator role', () => {
    const battlefield = new Battlefield(24, 24);
    const infiltratorResult = makeTestSide('Infiltrator', 3, battlefield, 2, 0);
    const defenderResult = makeTestSide('Defender', 3, battlefield, 18);
    
    const context = makeMissionContext(infiltratorResult.side, defenderResult.side, battlefield);
    const ai = new StealthMissionAI();
    
    const role = ai.getCharacterRole(infiltratorResult.characters[0], context);
    expect(role).toBeDefined();
    expect(['Ghost VIP', 'Infiltrator']).toContain(role);
  });

  it('should prioritize detection for defender', () => {
    const battlefield = new Battlefield(24, 24);
    const infiltratorResult = makeTestSide('Infiltrator', 3, battlefield, 2, 0);
    const defenderResult = makeTestSide('Defender', 3, battlefield, 18);
    
    const context = makeMissionContext(defenderResult.side, infiltratorResult.side, battlefield, {
      vipDetected: false,
    });
    const ai = new StealthMissionAI();
    
    const priorities = ai.getStrategicPriorities(context);
    expect(priorities.objectives).toContain('detect_vip');
  });
});
