import { describe, expect, it } from 'vitest';
import { TerrainElement } from './TerrainElement';

describe('TerrainElement OVR-003 mapping', () => {
  it('maps building names to non-enterable building height data', () => {
    const small = new TerrainElement('Small Building', { x: 5, y: 5 });
    const large = new TerrainElement('Large Building', { x: 5, y: 5 });

    expect(small.getHeight()).toBe(3);
    expect(small.isEnterable()).toBe(false);
    expect(large.getHeight()).toBe(4);
    expect(large.isEnterable()).toBe(false);
  });

  it('maps wall names to wall climb data', () => {
    const wall = new TerrainElement('Short Wall', { x: 5, y: 5 });

    expect(wall.getHeight()).toBe(1);
    expect(wall.canStandAtop()).toBe(true);
    expect(wall.getClimbHandRequirement(true)).toBe(2);
    expect(wall.getClimbHandRequirement(false)).toBe(1);
  });

  it('maps rock names to rocky height data', () => {
    const rocks = new TerrainElement('Small Rocks', { x: 5, y: 5 });

    expect(rocks.getHeight()).toBe(0.5);
    expect(rocks.canStandAtop()).toBe(true);
    expect(rocks.canJumpDown()).toBe(false);
  });
});
