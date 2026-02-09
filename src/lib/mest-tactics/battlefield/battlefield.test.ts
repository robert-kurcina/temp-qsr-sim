
import { describe, it, expect, beforeEach } from 'vitest';
import { Battlefield } from './Battlefield';
import { Pathfinder } from './Pathfinder';
import { TerrainType } from './Terrain';
import { Character } from '../Character';
import { Profile } from '../Profile';

describe('Battlefield Framework', () => {
  let battlefield: Battlefield;
  let pathfinder: Pathfinder;
  let testProfile: Profile;

  beforeEach(() => {
    battlefield = new Battlefield(10, 10);
    pathfinder = new Pathfinder(battlefield);
    testProfile = {
      name: 'Test Profile',
      archetype: {},
      items: [],
      totalBp: 0,
      adjustedBp: 0,
      adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
      physicality: 0,
      adjPhysicality: 0,
      durability: 0,
      adjDurability: 0,
      burden: { totalLaden: 0, totalBurden: 0 },
      totalHands: 0,
      totalDeflect: 0,
      totalAR: 0,
      finalTraits: [],
      allTraits: [],
    };
  });

  it('should place and move a character', () => {
    const char = new Character('char1', 'Test Character', testProfile);
    const startPos = { x: 1, y: 1 };
    const endPos = { x: 2, y: 2 };

    expect(battlefield.placeCharacter(char, startPos)).toBe(true);
    expect(battlefield.grid.getCell(startPos)?.occupant?.id).toBe(char.id);

    expect(battlefield.moveCharacter(char, endPos)).toBe(true);
    expect(battlefield.grid.getCell(startPos)?.occupant).toBe(null);
    expect(battlefield.grid.getCell(endPos)?.occupant?.id).toBe(char.id);
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
