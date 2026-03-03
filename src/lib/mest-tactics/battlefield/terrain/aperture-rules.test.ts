import { describe, expect, it } from 'vitest';
import { TerrainType } from './Terrain';
import { resolveApertureTraversalTerrain } from './aperture-rules';

describe('aperture-rules', () => {
  it('classifies full open doorway as Clear (DR.1)', () => {
    const feature = {
      id: 'doorway',
      type: TerrainType.Impassable,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      meta: {
        name: 'Doorway',
        movement: 'Impassable',
        los: 'Clear',
        shape: 'rectangle',
        dimensions: { width: 1.2, height: 1.2 },
        apertureKind: 'doorway',
        openingWidthMu: 1.2,
        openingHeightMu: 1.2,
        isOpen: true,
      },
    } as any;

    expect(resolveApertureTraversalTerrain(feature, 1)).toBe(TerrainType.Clear);
  });

  it('classifies small doorway as Rough (DR.2)', () => {
    const feature = {
      id: 'small-doorway',
      type: TerrainType.Impassable,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      meta: {
        name: 'Small Doorway',
        movement: 'Impassable',
        los: 'Clear',
        shape: 'rectangle',
        dimensions: { width: 0.4, height: 0.4 },
        apertureKind: 'doorway',
        openingWidthMu: 0.4,
        openingHeightMu: 0.4,
        isOpen: true,
      },
    } as any;

    expect(resolveApertureTraversalTerrain(feature, 1)).toBe(TerrainType.Rough);
  });

  it('classifies open full window as Difficult and small window as Impassable (DR.3/DR.4)', () => {
    const largeWindow = {
      id: 'window-large',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      meta: {
        name: 'Window',
        movement: 'Obstacle',
        los: 'Clear',
        shape: 'rectangle',
        dimensions: { width: 1, height: 1 },
        apertureKind: 'window',
        openingWidthMu: 1,
        openingHeightMu: 1,
        isOpen: true,
      },
    } as any;

    const smallWindow = {
      ...largeWindow,
      id: 'window-small',
      meta: {
        ...largeWindow.meta,
        openingWidthMu: 0.4,
        openingHeightMu: 0.4,
      },
    } as any;

    expect(resolveApertureTraversalTerrain(largeWindow, 1)).toBe(TerrainType.Difficult);
    expect(resolveApertureTraversalTerrain(smallWindow, 1)).toBe(TerrainType.Impassable);
  });

  it('classifies low-ceiling traversal by half base-height threshold (DR.5)', () => {
    const lowCeiling = {
      id: 'low-ceiling',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      meta: {
        name: 'Low Ceiling',
        movement: 'Obstacle',
        los: 'Clear',
        shape: 'rectangle',
        dimensions: { width: 1, height: 1 },
        apertureKind: 'low-ceiling',
        ceilingHeightMu: 0.6,
      },
    } as any;

    expect(resolveApertureTraversalTerrain(lowCeiling, 1)).toBe(TerrainType.Difficult);
    expect(resolveApertureTraversalTerrain(lowCeiling, 1.4)).toBe(TerrainType.Impassable);
  });
});
