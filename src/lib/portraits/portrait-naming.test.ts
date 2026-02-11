import { describe, it, expect } from 'vitest';
import {
  createPortraitAssignmentFromIndex,
  createPortraitAssignmentFromName,
  createPortraitName,
  parsePortraitName,
} from './portrait-naming';

describe('portrait-naming', () => {
  it('creates AA-00 for index 0', () => {
    const index = 0;
    const result = createPortraitAssignmentFromIndex(index);
    const expectedName = 'AA-00';
    const expectedColumn = 0;
    const expectedRow = 0;

    expect(result.name).toBe(expectedName);
    expect(result.column).toBe(expectedColumn);
    expect(result.row).toBe(expectedRow);
  });

  it('advances columns before rows', () => {
    const index = 8;
    const name = createPortraitName(index);
    const coordinates = parsePortraitName(name);
    const expectedName = 'AA-01';
    const expectedColumn = 0;
    const expectedRow = 1;

    expect(name).toBe(expectedName);
    expect(coordinates.column).toBe(expectedColumn);
    expect(coordinates.row).toBe(expectedRow);
  });

  it('parses BA-32 as column 3 row 2', () => {
    const name = 'BA-32';
    const parsed = createPortraitAssignmentFromName(name);
    const expectedColumn = 3;
    const expectedRow = 2;

    expect(parsed.column).toBe(expectedColumn);
    expect(parsed.row).toBe(expectedRow);
  });

  it('rejects out-of-range digits', () => {
    const badName = 'AA-78';
    const parse = () => parsePortraitName(badName);

    expect(parse).toThrow();
  });
});
