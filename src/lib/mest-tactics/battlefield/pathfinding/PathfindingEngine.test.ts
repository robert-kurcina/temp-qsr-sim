import { describe, expect, it } from 'vitest';
import { Battlefield } from '../Battlefield';
import { PathfindingEngine } from './PathfindingEngine';
import { TerrainType } from '../terrain/Terrain';

function createRectObstacle(id: string, minX: number, minY: number, maxX: number, maxY: number) {
  return {
    id,
    type: TerrainType.Obstacle,
    vertices: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  };
}

describe('PathfindingEngine caching', () => {
  it('should reuse grid and path results for repeated identical queries', () => {
    const battlefield = new Battlefield(20, 20);
    battlefield.addTerrain(createRectObstacle('obs-a', 8, 6, 10, 14));
    const engine = new PathfindingEngine(battlefield);
    const start = { x: 2, y: 10 };
    const end = { x: 18, y: 10 };

    const first = engine.findPath(start, end, {
      footprintDiameter: 1,
      useNavMesh: true,
      useHierarchical: true,
      optimizeWithLOS: true,
    });
    const afterFirst = engine.getCacheStats();

    const second = engine.findPath(start, end, {
      footprintDiameter: 1,
      useNavMesh: true,
      useHierarchical: true,
      optimizeWithLOS: true,
    });
    const afterSecond = engine.getCacheStats();

    expect(first.vectors.length).toBeGreaterThan(0);
    expect(second.totalLength).toBeCloseTo(first.totalLength, 6);
    expect(afterFirst.gridMisses).toBe(1);
    expect(afterFirst.pathMisses).toBe(1);
    expect(afterSecond.gridHits).toBeGreaterThanOrEqual(1);
    expect(afterSecond.pathHits).toBeGreaterThanOrEqual(1);
  });

  it('should invalidate caches when terrain version changes', () => {
    const battlefield = new Battlefield(20, 20);
    battlefield.addTerrain(createRectObstacle('obs-a', 8, 6, 10, 14));
    const engine = new PathfindingEngine(battlefield);
    const start = { x: 2, y: 10 };
    const end = { x: 18, y: 10 };

    engine.findPath(start, end, {
      footprintDiameter: 1,
      useNavMesh: true,
      useHierarchical: true,
      optimizeWithLOS: true,
    });
    const before = engine.getCacheStats();

    battlefield.addTerrain(createRectObstacle('obs-b', 11, 6, 13, 14));
    engine.findPath(start, end, {
      footprintDiameter: 1,
      useNavMesh: true,
      useHierarchical: true,
      optimizeWithLOS: true,
    });
    const after = engine.getCacheStats();

    expect(after.terrainVersion).toBeGreaterThan(before.terrainVersion);
    expect(after.gridMisses).toBeGreaterThan(before.gridMisses);
    expect(after.pathMisses).toBeGreaterThan(before.pathMisses);
  });
});

