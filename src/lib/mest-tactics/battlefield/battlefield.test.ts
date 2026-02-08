import { describe, it, expect, beforeEach } from 'vitest';
import { Battlefield } from './Battlefield';
import { Pathfinder } from './Pathfinder';
import { TerrainType } from './Terrain';

describe('Battlefield Framework', () => {
  let battlefield: Battlefield;
  let pathfinder: Pathfinder;

  beforeEach(() => {
    battlefield = new Battlefield(10, 10);
    pathfinder = new Pathfinder(battlefield);
  });

  it('should place and move a character', () => {
    const charId = 'char1';
    const startPos = { x: 1, y: 1 };
    const endPos = { x: 2, y: 2 };

    expect(battlefield.placeCharacter(charId, startPos)).toBe(true);
    expect(battlefield.grid.getCell(startPos)?.occupantId).toBe(charId);

    expect(battlefield.moveCharacter(charId, startPos, endPos)).toBe(true);
    expect(battlefield.grid.getCell(startPos)?.occupantId).toBe(null);
    expect(battlefield.grid.getCell(endPos)?.occupantId).toBe(charId);
  });

  it('should block LOS with an obstacle', () => {
    const obstacle = {
      id: 'obs1',
      type: TerrainType.Obstacle,
      vertices: [{ x: 3, y: 0 }, { x: 3, y: 5 }],
    };
    battlefield.addTerrain(obstacle);

    const start = { x: 1, y: 2 };
    const end = { x: 5, y: 2 };

    expect(battlefield.hasLineOfSight(start, end)).toBe(false);
  });

  it('should not block LOS when no obstacle is present', () => {
    const start = { x: 1, y: 2 };
    const end = { x: 5, y: 2 };
    expect(battlefield.hasLineOfSight(start, end)).toBe(true);
  });

  it('should find a path around an obstacle', () => {
    const obstacle = {
        id: 'obs1',
        type: TerrainType.Obstacle,
        vertices: [
          { x: 4, y: 2 }, 
          { x: 6, y: 2 }, 
          { x: 6, y: 6 }, 
          { x: 4, y: 6 }
        ],
    };
    battlefield.addTerrain(obstacle);

    const start = { x: 1, y: 4 };
    const end = { x: 8, y: 4 };

    const path = pathfinder.findPath(start, end);
    
    // Check that the path is not a straight line and is not empty
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(0);

    // A simple check to see if the path goes around the obstacle
    // A more robust test would check if any point in the path is inside the obstacle
    const goesAround = path.some(p => p.y !== 4);
    expect(goesAround).toBe(true);
  });

  it('should return an empty path if no path exists', () => {
    // Create a complete wall as a thin rectangle polygon
    const wall = {
        id: 'wall',
        type: TerrainType.Obstacle,
        vertices: [
            { x: 5, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 10 },
            { x: 5, y: 10 },
        ],
    };
    battlefield.addTerrain(wall);

    const start = { x: 2, y: 4 };
    const end = { x: 8, y: 4 };

    const path = pathfinder.findPath(start, end);
    expect(path.length).toBe(0);
  });
});
