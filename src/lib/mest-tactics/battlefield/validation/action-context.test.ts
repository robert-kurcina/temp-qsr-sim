import { describe, it, expect } from 'vitest';
import { Battlefield } from '../Battlefield';
import { TerrainElement } from '../terrain/TerrainElement';
import { buildRangedActionContext, resolveChargeSnapPosition } from './action-context';

describe('buildRangedActionContext', () => {
  it('should set point-blank when within half OR and not engaged', () => {
    const battlefield = new Battlefield(12, 12);
    const context = buildRangedActionContext({
      battlefield,
      attacker: { id: 'a', position: { x: 2, y: 6 }, baseDiameter: 2 },
      target: { id: 'b', position: { x: 7, y: 6 }, baseDiameter: 2 },
      optimalRangeMu: 8,
    });

    expect(context.isPointBlank).toBe(true);
  });

  it('should not set point-blank when engaged', () => {
    const battlefield = new Battlefield(12, 12);
    const context = buildRangedActionContext({
      battlefield,
      attacker: { id: 'a', position: { x: 2, y: 6 }, baseDiameter: 2 },
      target: { id: 'b', position: { x: 3, y: 6 }, baseDiameter: 2 },
      optimalRangeMu: 8,
    });

    expect(context.isPointBlank).toBe(false);
  });

  it('should include cover from battlefield', () => {
    const battlefield = new Battlefield(12, 12);
    const tree = new TerrainElement('Tree', { x: 6, y: 6 });
    battlefield.addTerrain(tree.toFeature());

    const context = buildRangedActionContext({
      battlefield,
      attacker: { id: 'a', position: { x: 2, y: 6 }, baseDiameter: 2 },
      target: { id: 'b', position: { x: 6, y: 6 }, baseDiameter: 2 },
      optimalRangeMu: 8,
    });

    expect(context.hasDirectCover).toBe(true);
  });

  it('should only grant hard cover for direct hard cover', () => {
    const battlefield = new Battlefield(12, 12);
    const rock = new TerrainElement('Small Rocks', { x: 6, y: 6 });
    battlefield.addTerrain(rock.toFeature());

    const directContext = buildRangedActionContext({
      battlefield,
      attacker: { id: 'a', position: { x: 2, y: 6 }, baseDiameter: 2, siz: 6 },
      target: { id: 'b', position: { x: 6, y: 6 }, baseDiameter: 2, siz: 6 },
    });

    expect(directContext.hasDirectCover).toBe(true);
    expect(directContext.hasHardCover).toBe(true);

    const interveningContext = buildRangedActionContext({
      battlefield,
      attacker: { id: 'a', position: { x: 2, y: 6 }, baseDiameter: 2, siz: 6 },
      target: { id: 'b', position: { x: 10, y: 6 }, baseDiameter: 2, siz: 6 },
    });

    expect(interveningContext.hasDirectCover).toBe(false);
    expect(interveningContext.hasInterveningCover).toBe(true);
    expect(interveningContext.hasHardCover).toBe(false);
  });

  it('should snap into base contact when within threshold and toggle enabled', () => {
    const attacker = { id: 'a', position: { x: 0, y: 0 }, baseDiameter: 2 };
    const target = { id: 'b', position: { x: 2.5, y: 0 }, baseDiameter: 2 };
    const snapped = resolveChargeSnapPosition(attacker, target, { enabled: true, remainingMu: 0.4 });
    expect(snapped).not.toBeNull();
    if (snapped) {
      expect(snapped.x).toBeCloseTo(0.5, 5);
      expect(snapped.y).toBeCloseTo(0, 5);
    }
  });

  it('should apply leaning toggles to ranged context', () => {
    const battlefield = new Battlefield(12, 12);
    const context = buildRangedActionContext({
      battlefield,
      attacker: { id: 'a', position: { x: 2, y: 6 }, baseDiameter: 2 },
      target: { id: 'b', position: { x: 7, y: 6 }, baseDiameter: 2 },
      isLeaning: true,
      isTargetLeaning: true,
    });

    expect(context.isLeaning).toBe(true);
    expect(context.isTargetLeaning).toBe(true);
  });

  it('should not snap into base contact when beyond threshold', () => {
    const attacker = { id: 'a', position: { x: 0, y: 0 }, baseDiameter: 2 };
    const target = { id: 'b', position: { x: 3, y: 0 }, baseDiameter: 2 };
    const snapped = resolveChargeSnapPosition(attacker, target, { enabled: true, remainingMu: 0.6 });
    expect(snapped).toBeNull();
  });
});
