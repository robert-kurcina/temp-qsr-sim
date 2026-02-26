import { describe, expect, it } from 'vitest';
import { Grid } from './Grid';

describe('Grid coordinate validation', () => {
  it('rejects non-integer coordinates as invalid', () => {
    const grid = new Grid(12, 12);

    expect(grid.isValid({ x: 2.5, y: 4 })).toBe(false);
    expect(grid.isValid({ x: 2, y: 4.5 })).toBe(false);
    expect(grid.getCell({ x: 2.5, y: 4 })).toBeUndefined();
    expect(grid.getCell({ x: 2, y: 4.5 })).toBeUndefined();
  });

  it('does not throw when queried with decimal coordinates', () => {
    const grid = new Grid(12, 12);

    expect(() => grid.getCell({ x: 10.292893218813452, y: 5.707106781186548 })).not.toThrow();
    expect(grid.setOccupant({ x: 10.292893218813452, y: 5.707106781186548 }, null)).toBe(false);
  });
});

