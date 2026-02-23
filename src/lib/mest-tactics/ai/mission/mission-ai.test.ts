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
  enemySide: any,
  battlefield: Battlefield,
  missionState: Record<string, unknown> = {}
): MissionAIContext {
  return {
    currentTurn: 1,
    currentRound: 1,
    side,
    enemySides: [enemySide],
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
