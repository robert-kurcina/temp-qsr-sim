/**
 * TerrainPlacement Service Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { placeTerrain, exportTerrainForReport, importTerrainFromReport } from './TerrainPlacement';
import { validateTerrainFitness, checkOverlap } from './TerrainFitness';
import { distance } from './BattlefieldUtils';

describe('TerrainPlacement', () => {
  describe('placeTerrain', () => {
    it('should place terrain in fast mode without overlap checks', () => {
      const result = placeTerrain({
        mode: 'fast',
        density: 50,
        battlefieldSize: 24,
        seed: 12345,
        terrainTypes: ['Tree', 'Shrub', 'Small Rocks'],
      });

      expect(result.terrain.length).toBeGreaterThan(0);
      expect(result.stats.placed).toBeGreaterThan(0);
      expect(result.stats.attempts).toBeLessThanOrEqual(result.terrain.length * 10);
    });

    it('should place terrain in balanced mode with overlap checks', () => {
      const result = placeTerrain({
        mode: 'balanced',
        density: 50,
        battlefieldSize: 24,
        seed: 12345,
        terrainTypes: ['Tree', 'Shrub', 'Small Rocks'],
      });

      expect(result.terrain.length).toBeGreaterThan(0);
      expect(result.stats.placed).toBeGreaterThan(0);
      // Balanced mode should have reasonable overlap checking
      // (overlaps should not exceed placed count significantly)
      expect(result.stats.overlaps).toBeLessThan(result.stats.placed * 2);
    });

    it('should place terrain in thorough mode with full validation', () => {
      const result = placeTerrain({
        mode: 'thorough',
        density: 50,
        battlefieldSize: 24,
        seed: 12345,
        terrainTypes: ['Tree', 'Shrub', 'Small Rocks'],
      });

      expect(result.terrain.length).toBeGreaterThan(0);
      expect(result.stats.placed).toBeGreaterThan(0);
      expect(result.fitness.overall).toBeGreaterThanOrEqual(80);
    });

    it('should respect density setting', () => {
      // Use rough patch terrain types which are controlled by the main density parameter
      const lowDensity = placeTerrain({
        mode: 'balanced',
        density: 25,
        battlefieldSize: 24,
        seed: 12345,
        terrainTypes: ['Small Rough Patch', 'Medium Rough Patch', 'Large Rough Patch'],
      });

      const highDensity = placeTerrain({
        mode: 'balanced',
        density: 75,
        battlefieldSize: 24,
        seed: 12345,
        terrainTypes: ['Small Rough Patch', 'Medium Rough Patch', 'Large Rough Patch'],
      });

      expect(highDensity.terrain.length).toBeGreaterThan(lowDensity.terrain.length);
    });

    it('should respect battlefield size', () => {
      const small = placeTerrain({
        mode: 'balanced',
        density: 50,
        battlefieldSize: 24,
        seed: 12345,
        terrainTypes: ['Tree', 'Shrub', 'Small Rocks'],
      });

      const large = placeTerrain({
        mode: 'balanced',
        density: 50,
        battlefieldSize: 48,
        seed: 12345,
        terrainTypes: ['Tree', 'Shrub', 'Small Rocks'],
      });

      expect(large.terrain.length).toBeGreaterThan(small.terrain.length);
    });

    it('should produce reproducible results with seed', () => {
      const result1 = placeTerrain({
        mode: 'balanced',
        density: 50,
        battlefieldSize: 24,
        seed: 42424,
        terrainTypes: ['Tree', 'Shrub', 'Small Rocks'],
      });

      const result2 = placeTerrain({
        mode: 'balanced',
        density: 50,
        battlefieldSize: 24,
        seed: 42424,
        terrainTypes: ['Tree', 'Shrub', 'Small Rocks'],
      });

      expect(result1.terrain.length).toBe(result2.terrain.length);
      expect(result1.stats).toEqual(result2.stats);
    });

    it('should keep terrain within bounds', () => {
      const result = placeTerrain({
        mode: 'thorough',
        density: 50,
        battlefieldSize: 24,
        seed: 12345,
        terrainTypes: ['Tree', 'Shrub', 'Small Rocks'],
      });

      for (const terrain of result.terrain) {
        for (const vertex of terrain.vertices) {
          expect(vertex.x).toBeGreaterThanOrEqual(0);
          expect(vertex.x).toBeLessThanOrEqual(24);
          expect(vertex.y).toBeGreaterThanOrEqual(0);
          expect(vertex.y).toBeLessThanOrEqual(24);
        }
      }
    });
  });

  describe('exportTerrainForReport', () => {
    it('should export terrain with correct structure', () => {
      const placement = placeTerrain({
        mode: 'balanced',
        density: 25,
        battlefieldSize: 24,
        seed: 12345,
      });

      const exported = exportTerrainForReport(placement.terrain);

      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBe(placement.terrain.length);

      for (const terrain of exported) {
        expect(terrain).toHaveProperty('id');
        expect(terrain).toHaveProperty('type');
        expect(terrain).toHaveProperty('vertices');
        expect(Array.isArray(terrain.vertices)).toBe(true);
      }
    });
  });

  describe('importTerrainFromReport', () => {
    it('should import terrain and match original', () => {
      const placement = placeTerrain({
        mode: 'balanced',
        density: 25,
        battlefieldSize: 24,
        seed: 12345,
      });

      const exported = exportTerrainForReport(placement.terrain);
      const imported = importTerrainFromReport(exported);

      expect(imported.length).toBe(exported.length);

      for (let i = 0; i < imported.length; i++) {
        expect(imported[i].id).toBe(exported[i].id);
        expect(imported[i].type).toBe(exported[i].type);
        expect(imported[i].vertices.length).toBe(exported[i].vertices.length);
      }
    });
  });
});

describe('TerrainFitness', () => {
  describe('validateTerrainFitness', () => {
    it('should return 100 score for empty terrain', () => {
      const fitness = validateTerrainFitness([], 24, 0.5);
      expect(fitness.overall).toBe(100);
      expect(fitness.issues.length).toBe(0);
    });

    it('should detect overlaps', () => {
      const overlappingTerrain = [
        {
          id: 't1',
          type: 'Tree',
          vertices: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }],
        },
        {
          id: 't2',
          type: 'Tree',
          vertices: [{ x: 5.5, y: 5 }, { x: 6.5, y: 5 }, { x: 6.5, y: 6 }, { x: 5.5, y: 6 }],
        },
      ];

      const fitness = validateTerrainFitness(overlappingTerrain as any, 24, 0.5);
      expect(fitness.overall).toBeLessThan(100);
      expect(fitness.issues.some(i => i.type === 'overlap')).toBe(true);
    });

    it('should detect out of bounds terrain', () => {
      const outOfBoundsTerrain = [
        {
          id: 't1',
          type: 'Tree',
          vertices: [{ x: 23, y: 23 }, { x: 25, y: 23 }, { x: 25, y: 25 }, { x: 23, y: 25 }],
        },
      ];

      const fitness = validateTerrainFitness(outOfBoundsTerrain as any, 24, 0.5);
      expect(fitness.stats.outOfBounds).toBeGreaterThan(0);
      expect(fitness.issues.some(i => i.type === 'bounds')).toBe(true);
    });

    it('should detect spacing violations', () => {
      const closeTerrain = [
        {
          id: 't1',
          type: 'Tree',
          vertices: [{ x: 5, y: 5 }, { x: 5.5, y: 5 }, { x: 5.5, y: 5.5 }, { x: 5, y: 5.5 }],
        },
        {
          id: 't2',
          type: 'Tree',
          vertices: [{ x: 5.6, y: 5 }, { x: 6.1, y: 5 }, { x: 6.1, y: 5.5 }, { x: 5.6, y: 5.5 }],
        },
      ];

      const fitness = validateTerrainFitness(closeTerrain as any, 24, 0.5);
      expect(fitness.issues.some(i => i.type === 'spacing')).toBe(true);
    });
  });

  describe('checkOverlap', () => {
    it('should return false for non-overlapping terrain', () => {
      const t1 = {
        id: 't1',
        type: 'Tree',
        vertices: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }],
      };
      const t2 = {
        id: 't2',
        type: 'Tree',
        vertices: [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 11, y: 11 }, { x: 10, y: 11 }],
      };

      expect(checkOverlap(t1 as any, t2 as any)).toBe(false);
    });

    it('should return true for overlapping terrain', () => {
      const t1 = {
        id: 't1',
        type: 'Tree',
        vertices: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }],
      };
      const t2 = {
        id: 't2',
        type: 'Tree',
        vertices: [{ x: 5.5, y: 5 }, { x: 6.5, y: 5 }, { x: 6.5, y: 6 }, { x: 5.5, y: 6 }],
      };

      expect(checkOverlap(t1 as any, t2 as any)).toBe(true);
    });
  });

  describe('distance', () => {
    it('should calculate distance between positions', () => {
      const a = { x: 0, y: 0 };
      const b = { x: 3, y: 4 };

      expect(distance(a, b)).toBe(5);
    });

    it('should return 0 for same position', () => {
      const a = { x: 5, y: 5 };
      const b = { x: 5, y: 5 };

      expect(distance(a, b)).toBe(0);
    });
  });
});
