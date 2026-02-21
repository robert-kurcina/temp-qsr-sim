import { describe, it, expect, beforeEach } from 'vitest';
import { createBeaconMission, BeaconMissionManager } from './beacon-manager';
import { buildOpposingSides } from '../MissionSideBuilder';
import { ModelSlotStatus } from '../MissionSide';
import { Position } from '../battlefield/Position';

describe('Beacon Mission', () => {
  let manager: BeaconMissionManager;
  let sideA: ReturnType<typeof buildOpposingSides>['sideA'];
  let sideB: ReturnType<typeof buildOpposingSides>['sideB'];

  const toSpatialModel = (member: { id: string; position?: Position | null }) => ({
    id: member.id,
    position: member.position ?? { x: 0, y: 0 },
    baseDiameter: 1,
    siz: 3,
  });

  beforeEach(() => {
    const result = buildOpposingSides(
      'Side A',
      [{ archetypeName: 'Veteran', count: 3 }],
      'Side B',
      [{ archetypeName: 'Militia', count: 3 }]
    );
    sideA = result.sideA;
    sideB = result.sideB;

    const beaconPositions: Position[] = [
      { x: 12, y: 6 },   // Top center
      { x: 6, y: 12 },   // Left center
      { x: 18, y: 12 },  // Right center
      { x: 12, y: 18 },  // Bottom center
    ];

    manager = createBeaconMission([sideA, sideB], beaconPositions);
  });

  describe('createBeaconMission', () => {
    it('should create mission manager with sides', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);
    });

    it('should create beacon zones', () => {
      const beacons = manager.getBeacons();
      expect(beacons.length).toBe(4);
      expect(beacons[0].name).toBe('Beacon 1');
      expect(beacons[0].type).toBe('Beacon' as any);
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });
  });

  describe('updateBeaconControl', () => {
    it('should control beacon with single side present', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // In beacon 1

      const models: Position[] = [sideA.members[0].position!];
      manager.updateBeaconControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);

      expect(manager.getBeaconController('beacon-1')).toBe(sideA.id);
    });

    it('should contest beacon with multiple sides present', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideB.members[0].position = { x: 12, y: 6 };

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);

      expect(manager.getBeaconController('beacon-1')).toBeNull(); // Contested
    });

    it('should uncontrol beacon with no models', () => {
      sideA.members[0].position = { x: 20, y: 20 }; // Outside all beacons

      manager.updateBeaconControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);

      expect(manager.getBeaconController('beacon-1')).toBeNull();
    });

    it('should track first control', () => {
      sideA.members[0].position = { x: 12, y: 6 };

      manager.updateBeaconControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);

      expect(manager.getFirstController('beacon-1')).toBe(sideA.id);
    });

    it('should not change first control after beacon is lost and regained', () => {
      // Side A controls first
      sideA.members[0].position = { x: 12, y: 6 };
      manager.updateBeaconControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);
      expect(manager.getFirstController('beacon-1')).toBe(sideA.id);

      // Beacon becomes uncontrolled
      sideA.members[0].position = { x: 20, y: 20 };
      manager.updateBeaconControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);

      // Side B controls
      sideB.members[0].position = { x: 12, y: 6 };
      manager.updateBeaconControl([toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position })]);

      // First controller should still be Side A
      expect(manager.getFirstController('beacon-1')).toBe(sideA.id);
    });
  });

  describe('awardTurnVP', () => {
    it('should award 2 VP per controlled beacon', () => {
      // Side A controls 2 beacons
      sideA.members[0].position = { x: 12, y: 6 }; // Beacon 1
      sideA.members[1].position = { x: 6, y: 12 }; // Beacon 2

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);

      const vpAwarded = manager.awardTurnVP();

      // awardTurnVP returns 2 VP per beacon = 4 VP
      // First control bonus (2 VP per beacon) was already awarded in updateBeaconControl
      expect(vpAwarded.get(sideA.id)).toBe(4);
      // Total VP = 4 (turn) + 4 (first control: 2 beacons × 2 VP) = 8
      expect(manager.getVictoryPoints(sideA.id)).toBe(8);
    });

    it('should not award VP for contested beacons', () => {
      // Beacon is contested
      sideA.members[0].position = { x: 12, y: 6 };
      sideB.members[0].position = { x: 12, y: 6 };

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(0);
      expect(vpAwarded.get(sideB.id)).toBe(0);
    });

    it('should award VP to multiple sides for different beacons', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // Beacon 1 - Side A
      sideB.members[0].position = { x: 6, y: 12 }; // Beacon 2 - Side B

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(2);
      expect(vpAwarded.get(sideB.id)).toBe(2);
    });

    it('should reset beacons controlled count each turn', () => {
      sideA.members[0].position = { x: 12, y: 6 };

      manager.updateBeaconControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);
      manager.awardTurnVP();

      expect(manager.getBeaconsControlledThisTurn(sideA.id)).toBe(1);

      // Next turn, no beacons controlled
      sideA.members[0].position = { x: 20, y: 20 };
      manager.updateBeaconControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);
      manager.awardTurnVP();

      expect(manager.getBeaconsControlledThisTurn(sideA.id)).toBe(0);
    });
  });

  describe('checkForVictory', () => {
    it('should detect victory when controlling all beacons', () => {
      // Use only 3 beacons for simpler test
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 1 }]
      );

      const beaconPositions: Position[] = [
        { x: 12, y: 6 },
        { x: 6, y: 12 },
        { x: 18, y: 12 },
      ];

      const testManager = createBeaconMission([result.sideA, result.sideB], beaconPositions, 3);

      result.sideA.members[0].position = { x: 12, y: 6 }; // Beacon 1
      result.sideA.members[1].position = { x: 6, y: 12 }; // Beacon 2
      result.sideA.members[2].position = { x: 18, y: 12 }; // Beacon 3

      testManager.updateBeaconControl([
        { id: result.sideA.members[0].id, position: result.sideA.members[0].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideA.members[1].id, position: result.sideA.members[1].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideA.members[2].id, position: result.sideA.members[2].position!, baseDiameter: 1, siz: 3 },
      ]);

      testManager.checkForVictory();

      expect(testManager.hasEnded()).toBe(true);
      expect(testManager.getWinner()).toBe(result.sideA.id);
      expect(testManager.getEndReason()).toBe('Controlled all beacon zones');
    });

    it('should not end if any beacon is contested', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // Beacon 1
      sideA.members[1].position = { x: 6, y: 12 }; // Beacon 2
      sideA.members[2].position = { x: 18, y: 12 }; // Beacon 3
      sideB.members[0].position = { x: 18, y: 12 }; // Contest Beacon 3

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
        toSpatialModel({ id: sideA.members[2].id, position: sideA.members[2].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(false);
    });

    it('should not end if any beacon is uncontrolled', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // Beacon 1
      sideA.members[1].position = { x: 6, y: 12 }; // Beacon 2
      // Beacon 3 and 4 are empty

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(false);
    });
  });

  describe('endMission', () => {
    it('should end mission with winner', () => {
      manager.endMission(sideA.id, 'Test victory');

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
      expect(manager.getEndReason()).toBe('Test victory');
    });

    it('should determine VP winner if no winner specified', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);
      manager.awardTurnVP();

      manager.endMission(undefined, 'Turn limit');

      expect(manager.getWinner()).toBe(sideA.id);
    });

    it('should only consider active models for VP victory', () => {
      // Side A has more VP but is eliminated
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);
      manager.awardTurnVP();

      sideA.members.forEach(m => m.status = ModelSlotStatus.Eliminated);
      manager.endMission(undefined, 'Turn limit');

      // Side B should win by default (only active side)
      expect(manager.getWinner()).toBe(sideB.id);
    });
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };
      sideB.members[0].position = { x: 18, y: 12 };

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].sideId).toBe(sideA.id);
      // Side A: 2 beacons × 2 VP + 2 beacons × 2 VP first control = 8 VP
      expect(standings[0].vp).toBe(8);
      // Side B: 1 beacon × 2 VP + 1 beacon × 2 VP first control = 4 VP
      expect(standings[1].vp).toBe(4);
    });

    it('should include beacons controlled this turn', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };

      manager.updateBeaconControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings[0].beaconsControlled).toBe(2);
    });
  });
});

describe('Beacon Mission - Edge Cases', () => {
  describe('Beacon denial', () => {
    it('should prevent enemy victory with single model', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 1 }]
      );

      const beaconPositions: Position[] = [
        { x: 12, y: 6 },
        { x: 6, y: 12 },
        { x: 18, y: 12 },
      ];

      const manager = createBeaconMission([result.sideA, result.sideB], beaconPositions);

      // Side A controls 2 beacons, Side B denies 1
      result.sideA.members[0].position = { x: 12, y: 6 }; // Beacon 1
      result.sideA.members[1].position = { x: 6, y: 12 }; // Beacon 2
      result.sideB.members[0].position = { x: 18, y: 12 }; // Beacon 3 - denial

      manager.updateBeaconControl([
        { id: result.sideA.members[0].id, position: result.sideA.members[0].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideA.members[1].id, position: result.sideA.members[1].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideB.members[0].id, position: result.sideB.members[0].position!, baseDiameter: 1, siz: 3 },
      ]);

      manager.checkForVictory();

      // Side A should NOT win because Beacon 3 is contested
      expect(manager.hasEnded()).toBe(false);
    });
  });

  describe('Multiple beacons', () => {
    it('should handle 5 beacons', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 5 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 5 }]
      );

      const beaconPositions: Position[] = [
        { x: 12, y: 6 },   // Top center
        { x: 6, y: 12 },   // Left center
        { x: 18, y: 12 },  // Right center
        { x: 12, y: 18 },  // Bottom center
        { x: 12, y: 12 },  // Center
      ];

      const manager = createBeaconMission([result.sideA, result.sideB], beaconPositions, 5);

      const beacons = manager.getBeacons();
      expect(beacons.length).toBe(5);

      // Control all 5 beacons
      result.sideA.members.forEach((m, i) => {
        m.position = beaconPositions[i];
      });

      // Update all at once
      const models = result.sideA.members.map(m => ({
        id: m.id,
        position: m.position!,
        baseDiameter: 1,
        siz: 3,
      }));
      manager.updateBeaconControl(models);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(result.sideA.id);
    });
  });
});
