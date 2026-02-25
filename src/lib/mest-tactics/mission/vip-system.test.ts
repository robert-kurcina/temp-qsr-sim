import { describe, it, expect, beforeEach } from 'vitest';
import {
  VIPManager,
  VIP,
  VIPState,
  DetectionLevel,
  VIPType,
  createVIP,
  createMissionVIPs,
} from './vip-system';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';

const createTestCharacter = (name: string): Character => {
  const profile: Profile = {
    name,
    archetype: 'Average',
    attributes: {
      cca: 2, rca: 2, ref: 2, int: 2, pow: 2,
      str: 2, for: 2, mov: 2, siz: 3,
    },
    traits: [],
    items: [],
  };
  return new Character(profile);
};

describe('VIPManager', () => {
  let manager: VIPManager;
  let vip: VIP;

  beforeEach(() => {
    manager = new VIPManager();
    const character = createTestCharacter('VIP1');
    vip = createVIP('vip-1', character, 'SideA', {
      extractingSide: 'SideA',
      extractionVP: 5,
      eliminationVP: 3,
    });
    manager.addVIP(vip);
  });

  describe('addVIP / getVIP', () => {
    it('should add and retrieve a VIP', () => {
      const retrieved = manager.getVIP('vip-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('vip-1');
    });

    it('should return undefined for unknown VIP', () => {
      const retrieved = manager.getVIP('unknown');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllVIPs', () => {
    it('should return all VIPs', () => {
      const character2 = createTestCharacter('VIP2');
      const vip2 = createVIP('vip-2', character2, 'SideB');
      manager.addVIP(vip2);

      const all = manager.getAllVIPs();
      expect(all.length).toBe(2);
    });
  });

  describe('getVIPsByState', () => {
    it('should return VIPs with specified state', () => {
      const active = manager.getVIPsByState(VIPState.Active);
      expect(active.length).toBe(1);
      expect(active[0].id).toBe('vip-1');
    });

    it('should return empty for states with no VIPs', () => {
      const extracted = manager.getVIPsByState(VIPState.Extracted);
      expect(extracted.length).toBe(0);
    });
  });

  describe('getVIPsByAffiliation', () => {
    it('should return VIPs affiliated with a side', () => {
      const sideAVIPs = manager.getVIPsByAffiliation('SideA');
      expect(sideAVIPs.length).toBe(1);
    });
  });

  describe('getActiveVIPs', () => {
    it('should return only active VIPs', () => {
      const character2 = createTestCharacter('VIP2');
      const vip2 = createVIP('vip-2', character2, 'SideB');
      vip2.state = VIPState.Eliminated;
      manager.addVIP(vip2);

      const active = manager.getActiveVIPs();
      expect(active.length).toBe(1);
      expect(active[0].id).toBe('vip-1');
    });
  });

  describe('syncVIPState', () => {
    it('should update VIP state from character elimination', () => {
      const character = createTestCharacter('VIP3');
      const vip3 = createVIP('vip-3', character, 'SideA');
      manager.addVIP(vip3);

      character.state.isEliminated = true;
      manager.syncVIPState('vip-3');

      expect(manager.getVIP('vip-3')?.state).toBe(VIPState.Eliminated);
    });

    it('should update VIP state from character KO', () => {
      const character = createTestCharacter('VIP4');
      const vip4 = createVIP('vip-4', character, 'SideA');
      manager.addVIP(vip4);

      character.state.isKOd = true;
      manager.syncVIPState('vip-4');

      expect(manager.getVIP('vip-4')?.state).toBe(VIPState.InTransit);
    });
  });

  describe('detectVIP', () => {
    it('should increase detection level from Undetected to Suspected', () => {
      const character = createTestCharacter('HiddenVIP');
      const hiddenVIP = createVIP('hidden-1', character, 'SideA');
      hiddenVIP.detectionLevel = DetectionLevel.Undetected;
      manager.addVIP(hiddenVIP);

      const result = manager.detectVIP('hidden-1', 'SideB');

      expect(result.detected).toBe(true);
      expect(result.newLevel).toBe(DetectionLevel.Suspected);
    });

    it('should increase detection level from Suspected to Confirmed', () => {
      const character = createTestCharacter('SuspectVIP');
      const suspectVIP = createVIP('suspect-1', character, 'SideA');
      suspectVIP.detectionLevel = DetectionLevel.Suspected;
      manager.addVIP(suspectVIP);

      const result = manager.detectVIP('suspect-1', 'SideB');

      expect(result.newLevel).toBe(DetectionLevel.Confirmed);
    });

    it('should stay Confirmed if already Confirmed', () => {
      const result = manager.detectVIP('vip-1', 'SideB');

      expect(result.newLevel).toBe(DetectionLevel.Confirmed);
      expect(result.previousLevel).toBe(DetectionLevel.Confirmed);
    });
  });

  describe('hideVIP', () => {
    it('should decrease detection level from Confirmed to Suspected', () => {
      const result = manager.hideVIP('vip-1');

      expect(result.newLevel).toBe(DetectionLevel.Suspected);
    });

    it('should decrease detection level from Suspected to Undetected', () => {
      const character = createTestCharacter('SuspectVIP');
      const suspectVIP = createVIP('suspect-1', character, 'SideA');
      suspectVIP.detectionLevel = DetectionLevel.Suspected;
      manager.addVIP(suspectVIP);

      const result = manager.hideVIP('suspect-1');

      expect(result.newLevel).toBe(DetectionLevel.Undetected);
    });

    it('should set state to Hidden when undetected', () => {
      const character = createTestCharacter('SuspectVIP');
      const suspectVIP = createVIP('suspect-1', character, 'SideA');
      suspectVIP.detectionLevel = DetectionLevel.Suspected;
      manager.addVIP(suspectVIP);

      manager.hideVIP('suspect-1');

      expect(manager.getVIP('suspect-1')?.state).toBe(VIPState.Hidden);
    });
  });

  describe('extractVIP', () => {
    it('should successfully extract a VIP', () => {
      const result = manager.extractVIP('vip-1', 'SideA');

      expect(result.success).toBe(true);
      expect(result.victoryPointsAwarded).toBe(5);
      expect(result.vip.state).toBe(VIPState.Extracted);
    });

    it('should fail for eliminated VIP', () => {
      const character = createTestCharacter('DeadVIP');
      const deadVIP = createVIP('dead-1', character, 'SideA');
      deadVIP.state = VIPState.Eliminated;
      manager.addVIP(deadVIP);

      const result = manager.extractVIP('dead-1', 'SideA');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('VIP is eliminated');
    });

    it('should fail for already extracted VIP', () => {
      manager.extractVIP('vip-1', 'SideA');
      const result = manager.extractVIP('vip-1', 'SideA');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('VIP already extracted');
    });

    it('should fail if not authorized to extract', () => {
      const result = manager.extractVIP('vip-1', 'SideB');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Not authorized to extract this VIP');
    });
  });

  describe('eliminateVIP', () => {
    it('should eliminate a VIP', () => {
      const result = manager.eliminateVIP('vip-1', 'SideB');

      expect(result.eliminated).toBe(true);
      expect(result.vip.state).toBe(VIPState.Eliminated);
    });

    it('should award elimination VP to enemy', () => {
      const result = manager.eliminateVIP('vip-1', 'SideB');

      expect(result.victoryPointsAwarded).toBe(3);
    });

    it('should not award VP for self-elimination', () => {
      const result = manager.eliminateVIP('vip-1', 'SideA');

      expect(result.victoryPointsAwarded).toBe(0);
    });
  });

  describe('setExtractionPoint', () => {
    it('should set extraction point for a VIP', () => {
      const result = manager.setExtractionPoint('vip-1', { x: 10, y: 10 });

      expect(result).toBe(true);
      expect(manager.getVIP('vip-1')?.extractionPoint).toEqual({ x: 10, y: 10 });
    });

    it('should fail for unknown VIP', () => {
      const result = manager.setExtractionPoint('unknown', { x: 10, y: 10 });
      expect(result).toBe(false);
    });
  });

  describe('getExtractableVIPs', () => {
    it('should return VIPs that can be extracted by a side', () => {
      const extractable = manager.getExtractableVIPs('SideA');

      expect(extractable.length).toBe(1);
      expect(extractable[0].id).toBe('vip-1');
    });

    it('should not return VIPs for wrong side', () => {
      const extractable = manager.getExtractableVIPs('SideB');
      expect(extractable.length).toBe(0);
    });

    it('should not return eliminated VIPs', () => {
      const character = createTestCharacter('DeadVIP');
      const deadVIP = createVIP('dead-1', character, 'SideA', { extractingSide: 'SideA' });
      deadVIP.state = VIPState.Eliminated;
      manager.addVIP(deadVIP);

      const extractable = manager.getExtractableVIPs('SideA');
      expect(extractable.length).toBe(1); // Only vip-1, not dead-1
    });
  });

  describe('exportState / importState', () => {
    it('should export and import VIP state', () => {
      const exported = manager.exportState();
      const newManager = new VIPManager();
      newManager.importState(exported);

      expect(newManager.getVIP('vip-1')?.affiliatedSide).toBe('SideA');
      expect(newManager.getVIP('vip-1')?.extractionVP).toBe(5);
    });
  });

  describe('clear', () => {
    it('should remove all VIPs', () => {
      const character2 = createTestCharacter('VIP2');
      const vip2 = createVIP('vip-2', character2, 'SideB');
      manager.addVIP(vip2);

      manager.clear();

      expect(manager.getAllVIPs().length).toBe(0);
    });
  });
});

describe('createVIP', () => {
  it('should create a VIP with defaults', () => {
    const character = createTestCharacter('VIP');
    const vip = createVIP('vip-1', character, 'SideA');

    expect(vip.type).toBe(VIPType.Standard);
    expect(vip.extractionVP).toBe(5);
    expect(vip.eliminationVP).toBe(3);
    expect(vip.detectionLevel).toBe(DetectionLevel.Confirmed);
  });

  it('should create a VIP with custom options', () => {
    const character = createTestCharacter('Scientist');
    const vip = createVIP('scientist-1', character, 'SideA', {
      name: 'Dr. Scientist',
      type: VIPType.Scientist,
      extractionVP: 10,
      eliminationVP: 5,
      extractingSide: 'SideA',
    });

    expect(vip.name).toBe('Dr. Scientist');
    expect(vip.type).toBe(VIPType.Scientist);
    expect(vip.extractionVP).toBe(10);
    expect(vip.eliminationVP).toBe(5);
    expect(vip.extractingSide).toBe('SideA');
  });
});

describe('createMissionVIPs', () => {
  it('should create multiple VIPs for a mission', () => {
    const character1 = createTestCharacter('VIP1');
    const character2 = createTestCharacter('VIP2');

    const vips = createMissionVIPs([
      {
        id: 'vip-1',
        character: character1,
        affiliatedSide: 'SideA',
        extractingSide: 'SideA',
        type: VIPType.Commander,
        extractionVP: 5,
      },
      {
        id: 'vip-2',
        character: character2,
        affiliatedSide: 'SideB',
        extractingSide: 'SideA',
        type: VIPType.Scientist,
        extractionVP: 10,
      },
    ]);

    expect(vips.length).toBe(2);
    expect(vips[0].type).toBe(VIPType.Commander);
    expect(vips[1].type).toBe(VIPType.Scientist);
    expect(vips[1].extractionVP).toBe(10);
  });
});
