import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateScatterDistance,
  determineScatterDirectionFromRoll,
  calculateScatterPosition,
  resolveScatter,
  isValidIndirectArc,
  calculateRollDown,
  checkBarrierCollision,
  calculateLOFAngle,
  rollScatterDirection,
  ScatterOptions,
} from './scatter';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';

// Helper to create a test battlefield with terrain
function createTestBattlefield(
  width: number = 24,
  height: number = 24,
  terrain: any[] = []
): Battlefield {
  const bf = new Battlefield(width, height);
  // Add terrain features directly
  bf.terrain = terrain;
  return bf;
}

describe('Scatter System - Distance Calculation', () => {
  describe('calculateScatterDistance', () => {
    it('should return minimum 1 MU for 0 misses', () => {
      expect(calculateScatterDistance(0)).toBe(1);
    });

    it('should calculate misses × 1"', () => {
      expect(calculateScatterDistance(1)).toBe(1);
      expect(calculateScatterDistance(2)).toBe(2);
      expect(calculateScatterDistance(5)).toBe(5);
    });

    it('should always return at least 1 MU', () => {
      expect(calculateScatterDistance(-1)).toBe(1);
    });
  });
});

describe('Scatter System - Direction', () => {
  describe('determineScatterDirectionFromRoll', () => {
    it('should return Forward (0°) for roll 1', () => {
      const result = determineScatterDirectionFromRoll(1);
      expect(result.directionIndex).toBe(0);
      expect(result.angleDegrees).toBe(0);
      expect(result.name).toBe('Forward');
    });

    it('should return Forward-Right (60°) for roll 2', () => {
      const result = determineScatterDirectionFromRoll(2);
      expect(result.directionIndex).toBe(1);
      expect(result.angleDegrees).toBe(60);
      expect(result.name).toBe('Forward-Right');
    });

    it('should return Backward-Right (120°) for roll 3', () => {
      const result = determineScatterDirectionFromRoll(3);
      expect(result.directionIndex).toBe(2);
      expect(result.angleDegrees).toBe(120);
      expect(result.name).toBe('Backward-Right');
    });

    it('should return Backward (180°) for roll 4', () => {
      const result = determineScatterDirectionFromRoll(4);
      expect(result.directionIndex).toBe(3);
      expect(result.angleDegrees).toBe(180);
      expect(result.name).toBe('Backward');
    });

    it('should return Backward-Left (240°) for roll 5', () => {
      const result = determineScatterDirectionFromRoll(5);
      expect(result.directionIndex).toBe(4);
      expect(result.angleDegrees).toBe(240);
      expect(result.name).toBe('Backward-Left');
    });

    it('should return Forward-Left (300°) for roll 6', () => {
      const result = determineScatterDirectionFromRoll(6);
      expect(result.directionIndex).toBe(5);
      expect(result.angleDegrees).toBe(300);
      expect(result.name).toBe('Forward-Left');
    });

    it('should clamp invalid rolls to 1-6', () => {
      const result1 = determineScatterDirectionFromRoll(0);
      expect(result1.directionIndex).toBe(0);

      const result2 = determineScatterDirectionFromRoll(7);
      expect(result2.directionIndex).toBe(5);
    });
  });

  describe('rollScatterDirection', () => {
    it('should keep unbiased rolls uniform', () => {
      const rng = () => 0.2;
      const unbiased = rollScatterDirection({ rng, bias: 'unbiased' });
      expect(unbiased).toBe(2);
    });

    it('should apply canonical biased reroll flow', () => {
      const sequence = [0.4, 0.6, 0.99]; // 3 -> reroll 4 -> reroll 6
      let i = 0;
      const rng = () => sequence[Math.min(i++, sequence.length - 1)];
      const biased = rollScatterDirection({ rng, bias: 'biased' });

      expect(biased).toBe(6);
    });

    it('should respect custom weights', () => {
      const rng = () => 0.1;
      const roll = rollScatterDirection({ rng, weights: [0, 0, 0, 0, 0, 1] });
      expect(roll).toBe(6);
    });
  });

  describe('calculateLOFAngle', () => {
    it('should calculate 0° for horizontal LOF (east)', () => {
      const attacker: Position = { x: 0, y: 0 };
      const target: Position = { x: 10, y: 0 };
      const angle = calculateLOFAngle(attacker, target);
      expect(angle).toBe(0);
    });

    it('should calculate 90° for vertical LOF (north)', () => {
      const attacker: Position = { x: 0, y: 0 };
      const target: Position = { x: 0, y: 10 };
      const angle = calculateLOFAngle(attacker, target);
      expect(angle).toBe(90);
    });

    it('should calculate 180° for horizontal LOF (west)', () => {
      const attacker: Position = { x: 10, y: 0 };
      const target: Position = { x: 0, y: 0 };
      const angle = calculateLOFAngle(attacker, target);
      expect(angle).toBe(180);
    });

    it('should calculate 270° for vertical LOF (south)', () => {
      const attacker: Position = { x: 0, y: 10 };
      const target: Position = { x: 0, y: 0 };
      const angle = calculateLOFAngle(attacker, target);
      expect(angle).toBe(270);
    });
  });
});

describe('Scatter System - Position Calculation', () => {
  describe('calculateScatterPosition', () => {
    it('should calculate position at 0° (east)', () => {
      const start: Position = { x: 0, y: 0 };
      const result = calculateScatterPosition(start, 5, 0);
      
      expect(result.x).toBeCloseTo(5, 5);
      expect(result.y).toBeCloseTo(0, 5);
    });

    it('should calculate position at 90° (south)', () => {
      const start: Position = { x: 0, y: 0 };
      const result = calculateScatterPosition(start, 5, 90);
      
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(5, 5);
    });

    it('should calculate position at 180° (west)', () => {
      const start: Position = { x: 0, y: 0 };
      const result = calculateScatterPosition(start, 5, 180);
      
      expect(result.x).toBeCloseTo(-5, 5);
      expect(result.y).toBeCloseTo(0, 5);
    });

    it('should calculate position at 270° (north)', () => {
      const start: Position = { x: 0, y: 0 };
      const result = calculateScatterPosition(start, 5, 270);
      
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(-5, 5);
    });
  });
});

describe('Scatter System - Full Resolution', () => {
  let battlefield: Battlefield;
  let attacker: Position;
  let target: Position;

  beforeEach(() => {
    battlefield = createTestBattlefield(24, 24);
    attacker = { x: 0, y: 0 };
    target = { x: 10, y: 0 };
  });

  describe('resolveScatter', () => {
    it('should scatter Forward (along LOF) with roll 1', () => {
      const options: ScatterOptions = {
        attackerPosition: attacker,
        targetPosition: target,
        misses: 2,
        battlefield,
        directionRoll: 1, // Forward
      };

      const result = resolveScatter(options);

      expect(result.scatterDistance).toBe(2);
      expect(result.scatterDirection).toBe(0); // Forward
      expect(result.misses).toBe(2);
    });

    it('should scatter Backward (toward attacker) with roll 4', () => {
      const options: ScatterOptions = {
        attackerPosition: attacker,
        targetPosition: target,
        misses: 2,
        battlefield,
        directionRoll: 4, // Backward
      };

      const result = resolveScatter(options);

      expect(result.scatterDistance).toBe(2);
      expect(result.scatterDirection).toBe(3); // Backward
      // Should scatter toward attacker (x should decrease)
      expect(result.finalPosition.x).toBeLessThan(target.x);
    });

    it('should scatter farther with more misses', () => {
      const options1: ScatterOptions = {
        attackerPosition: attacker,
        targetPosition: target,
        misses: 1,
        battlefield,
        directionRoll: 1,
      };

      const options2: ScatterOptions = {
        ...options1,
        misses: 5,
      };

      const result1 = resolveScatter(options1);
      const result2 = resolveScatter(options2);

      expect(result2.scatterDistance).toBe(5);
      expect(result2.scatterDistance).toBeGreaterThan(result1.scatterDistance);
    });

    it('should stay within battlefield bounds', () => {
      // Position near edge
      const targetNearEdge: Position = { x: 23, y: 12 };

      const result = resolveScatter({
        attackerPosition: attacker,
        targetPosition: targetNearEdge,
        misses: 5, // Large scatter
        battlefield,
        directionRoll: 1, // Forward (toward edge)
      });

      expect(result.finalPosition.x).toBeLessThanOrEqual(24);
      expect(result.finalPosition.y).toBeLessThanOrEqual(24);
      expect(result.finalPosition.x).toBeGreaterThanOrEqual(0);
      expect(result.finalPosition.y).toBeGreaterThanOrEqual(0);
    });

    it('should use correct LOF angle for scatter direction', () => {
      // LOF is 90° (north)
      const attacker2: Position = { x: 0, y: 0 };
      const target2: Position = { x: 0, y: 10 };

      const result = resolveScatter({
        attackerPosition: attacker2,
        targetPosition: target2,
        misses: 2,
        battlefield,
        directionRoll: 1, // Forward (should be north, 90°)
      });

      // Forward from 90° LOF should scatter north (y increases)
      expect(result.finalPosition.y).toBeGreaterThan(target2.y);
    });

    it('uses desired direction as the biased scatter "1" axis', () => {
      const result = resolveScatter({
        attackerPosition: { x: 0, y: 0 },
        targetPosition: { x: 10, y: 0 },
        misses: 2,
        battlefield,
        directionRoll: 1,
        bias: 'biased',
        desiredDirectionAngle: 90,
      });

      expect(result.finalPosition.x).toBeCloseTo(10, 5);
      expect(result.finalPosition.y).toBeGreaterThan(0);
    });

    it('keeps LOF axis for unbiased scatter even when desired direction is provided', () => {
      const result = resolveScatter({
        attackerPosition: { x: 0, y: 0 },
        targetPosition: { x: 10, y: 0 },
        misses: 2,
        battlefield,
        directionRoll: 1,
        bias: 'unbiased',
        desiredDirectionAngle: 90,
      });

      expect(result.finalPosition.x).toBeGreaterThan(10);
      expect(result.finalPosition.y).toBeCloseTo(0, 5);
    });

    it('reflects off a wall and continues with remaining distance', () => {
      const battlefieldWithWall = createTestBattlefield(24, 24, [
        { bounds: { x: 7, y: 4, width: 1, height: 2 }, type: 'Blocking' },
      ]);

      const result = resolveScatter({
        attackerPosition: { x: 0, y: 5 },
        targetPosition: { x: 5, y: 5 },
        misses: 5,
        battlefield: battlefieldWithWall,
        directionRoll: 1, // Forward, into wall
      });

      expect(result.blocked).toBe(true);
      expect(result.finalPosition.x).toBeLessThan(7);
    });

    it('stops at second barrier after wall reflection', () => {
      const battlefieldWithWalls = createTestBattlefield(24, 24, [
        { bounds: { x: 7, y: 4, width: 1, height: 2 }, type: 'Blocking' }, // first wall
        { bounds: { x: 5, y: 4, width: 0.5, height: 2 }, type: 'Blocking' }, // second wall after reflection
      ]);

      const result = resolveScatter({
        attackerPosition: { x: 0, y: 5 },
        targetPosition: { x: 5, y: 5 },
        misses: 5,
        battlefield: battlefieldWithWalls,
        directionRoll: 1,
      });

      expect(result.blocked).toBe(true);
      expect(result.finalPosition.x).toBeGreaterThanOrEqual(5);
      expect(result.finalPosition.x).toBeLessThanOrEqual(7);
    });

    it('chains roll-down distance across successive slope drops', () => {
      const slopedBattlefield = createTestBattlefield(40, 12, [
        { bounds: { x: 0, y: 0, width: 12, height: 12 }, type: 'Clear', elevation: 8 },
        { bounds: { x: 12, y: 0, width: 8, height: 12 }, type: 'Clear', elevation: 4 },
        { bounds: { x: 20, y: 0, width: 20, height: 12 }, type: 'Clear', elevation: 0 },
      ]);

      const result = resolveScatter({
        attackerPosition: { x: 0, y: 6 },
        targetPosition: { x: 11, y: 6 },
        misses: 6,
        battlefield: slopedBattlefield,
        directionRoll: 1, // Forward
      });

      expect(result.rollDownOccurred).toBe(true);
      expect(result.rollDownDistance).toBe(16);
      expect(result.finalPosition.x).toBeCloseTo(33, 5);
    });

    it('stops roll-down displacement when an obstacle is encountered', () => {
      const slopedBattlefield = createTestBattlefield(40, 12, [
        { bounds: { x: 0, y: 0, width: 12, height: 12 }, type: 'Clear', elevation: 8 },
        { bounds: { x: 12, y: 0, width: 8, height: 12 }, type: 'Clear', elevation: 4 },
        { bounds: { x: 20, y: 0, width: 20, height: 12 }, type: 'Clear', elevation: 0 },
        { bounds: { x: 26, y: 5, width: 1, height: 2 }, type: 'Rough' },
      ]);

      const result = resolveScatter({
        attackerPosition: { x: 0, y: 6 },
        targetPosition: { x: 11, y: 6 },
        misses: 6,
        battlefield: slopedBattlefield,
        directionRoll: 1, // Forward
      });

      expect(result.rollDownOccurred).toBe(true);
      expect(result.blocked).toBe(true);
      expect(result.blockingBarrier?.type).toBe('obstacle');
      expect(result.finalPosition.x).toBeGreaterThanOrEqual(26);
      expect(result.finalPosition.x).toBeLessThanOrEqual(27);
    });
  });
});

describe('Scatter System - Roll-down', () => {
  describe('calculateRollDown', () => {
    it('should not roll down on flat terrain', () => {
      const battlefield = createTestBattlefield(24, 24);
      const start: Position = { x: 5, y: 5 };
      const end: Position = { x: 10, y: 5 };

      const result = calculateRollDown(start, end, battlefield, 2);

      expect(result.occurred).toBe(false);
      expect(result.rollDownDistance).toBe(0);
    });

    it('should roll down from higher to lower elevation', () => {
      // Create battlefield with elevation
      const battlefield = createTestBattlefield(24, 24, [
        { bounds: { x: 0, y: 0, width: 12, height: 24 }, type: 'Clear', elevation: 5 },
        { bounds: { x: 12, y: 0, width: 12, height: 24 }, type: 'Clear', elevation: 0 },
      ]);

      const start: Position = { x: 10, y: 10 }; // Elevation 5
      const end: Position = { x: 14, y: 10 }; // Elevation 0

      const result = calculateRollDown(start, end, battlefield, 2);

      expect(result.occurred).toBe(true);
      // Roll-down: 0.5 MU per 1 MU dropped (5 MU drop = 2.5 MU) + 1 MU per miss (2 MU) = 4.5 MU
      expect(result.rollDownDistance).toBeGreaterThan(0);
    });

    it('should calculate roll-down as 0.5 per 1 MU dropped + misses', () => {
      const battlefield = createTestBattlefield(24, 24, [
        { bounds: { x: 0, y: 0, width: 12, height: 24 }, type: 'Clear', elevation: 10 },
        { bounds: { x: 12, y: 0, width: 12, height: 24 }, type: 'Clear', elevation: 0 },
      ]);

      const start: Position = { x: 10, y: 10 }; // Elevation 10
      const end: Position = { x: 14, y: 10 }; // Elevation 0

      const result = calculateRollDown(start, end, battlefield, 3);

      expect(result.occurred).toBe(true);
      // 10 MU drop × 0.5 + 3 misses = 5 + 3 = 8 MU
      expect(result.rollDownDistance).toBe(8);
    });
  });
});

describe('Scatter System - Collision Detection', () => {
  describe('checkBarrierCollision', () => {
    it('should not collide on clear terrain', () => {
      const battlefield = createTestBattlefield(24, 24);
      const start: Position = { x: 5, y: 5 };
      const end: Position = { x: 10, y: 5 };

      const result = checkBarrierCollision(start, end, battlefield);

      expect(result.collided).toBe(false);
    });

    it('should collide with blocking terrain', () => {
      const battlefield = createTestBattlefield(24, 24, [
        { bounds: { x: 7, y: 4, width: 1, height: 2 }, type: 'Blocking' },
      ]);

      const start: Position = { x: 5, y: 5 };
      const end: Position = { x: 10, y: 5 };

      const result = checkBarrierCollision(start, end, battlefield);

      expect(result.collided).toBe(true);
      expect(result.barrier).toBeDefined();
    });
  });
});

describe('Indirect Attack - Arc Validation', () => {
  describe('isValidIndirectArc', () => {
    let battlefield: Battlefield;
    let attacker: Position;
    let target: Position;

    beforeEach(() => {
      battlefield = createTestBattlefield(24, 24);
      attacker = { x: 0, y: 0 };
      target = { x: 10, y: 0 };
    });

    it('should validate valid arc', () => {
      const result = isValidIndirectArc(attacker, target, battlefield);

      expect(result.valid).toBe(true);
      expect(result.midpoint).toBeDefined();
      expect(result.arcHeight).toBeDefined();
    });

    it('should calculate midpoint correctly', () => {
      const result = isValidIndirectArc(attacker, target, battlefield);

      expect(result.midpoint?.x).toBe(5);
      expect(result.midpoint?.y).toBe(0);
    });

    it('should fail if midpoint has blocking terrain', () => {
      const battlefieldWithBlock = createTestBattlefield(24, 24, [
        { bounds: { x: 4, y: -1, width: 2, height: 2 }, type: 'Blocking' },
      ]);

      const result = isValidIndirectArc(attacker, target, battlefieldWithBlock);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('blocking');
    });

    it('should fail if arc height exceeds maximum', () => {
      // Very short max arc height
      const result = isValidIndirectArc(attacker, target, battlefield, 1.5, 2);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('arc height');
    });

    it('should allow arc height up to distance', () => {
      // Distance is 10, so max arc height is 10
      const result = isValidIndirectArc(attacker, target, battlefield, 1.5, 10);

      expect(result.valid).toBe(true);
    });
  });
});

describe('Scatter System - Edge Cases', () => {
  it('should handle zero distance scatter', () => {
    const battlefield = createTestBattlefield(24, 24);
    const attacker: Position = { x: 5, y: 5 };
    const target: Position = { x: 5, y: 5 };

    const result = resolveScatter({
      attackerPosition: attacker,
      targetPosition: target,
      misses: 1,
      battlefield,
      directionRoll: 1,
    });

    expect(result.scatterDistance).toBe(1);
    expect(result.finalPosition).toBeDefined();
  });

  it('should handle battlefield boundaries', () => {
    const battlefield = createTestBattlefield(24, 24);
    const attacker: Position = { x: 0, y: 0 };
    const target: Position = { x: 0.5, y: 0.5 };

    const result = resolveScatter({
      attackerPosition: attacker,
      targetPosition: target,
      misses: 10, // Large scatter
      battlefield,
      directionRoll: 1, // Forward
    });

    // Should clamp to battlefield
    expect(result.finalPosition.x).toBeGreaterThanOrEqual(0);
    expect(result.finalPosition.y).toBeGreaterThanOrEqual(0);
    expect(result.finalPosition.x).toBeLessThanOrEqual(24);
    expect(result.finalPosition.y).toBeLessThanOrEqual(24);
  });

  it('should handle same position attacker and target', () => {
    const battlefield = createTestBattlefield(24, 24);
    const position: Position = { x: 10, y: 10 };

    const result = resolveScatter({
      attackerPosition: position,
      targetPosition: position,
      misses: 1,
      battlefield,
      directionRoll: 1,
    });

    expect(result.originalTarget).toEqual(position);
    expect(result.finalPosition).toBeDefined();
  });
});
