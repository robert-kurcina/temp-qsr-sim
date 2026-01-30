// /src/engine/Pathfinder.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
import { MU_TO_METERS, TERRAIN_COSTS } from './Constants.js';
import { getTerrainTypeAtPosition } from './TerrainType.js';

/**
 * A* pathfinding with MEST QSR terrain costs
 */
export class Pathfinder {
  constructor(terrain, battlefieldSizeMU) {
    this.terrain = terrain;
    this.battlefieldSizeMU = battlefieldSizeMU;
    this.gridSize = 0.5;
    this.grid = this.buildGrid();
  }

  /**
   * Build navigation grid using correct MU measurements
   */
  buildGrid() {
    const size = Math.ceil(this.battlefieldSizeMU / this.gridSize);
    const grid = [];
    for (let x = 0; x < size; x++) {
      grid[x] = [];
      for (let y = 0; y < size; y++) {
        const worldX = (x - size / 2) * this.gridSize;
        const worldY = (y - size / 2) * this.gridSize;
        grid[x][y] = {
          x: worldX,
          y: worldY,
          cost: this.getTerrainCost(worldX, worldY),
          blocked: this.isPositionBlocked(worldX, worldY),
          g: 0, h: 0, f: 0, parent: null, visited: false
        };
      }
    }
    return grid;
  }

  /**
   * Get movement cost for position (QSR compliant)
   */
  getTerrainCost(x, y) {
    const terrainType = getTerrainTypeAtPosition(x, y, this.terrain);
    return TERRAIN_COSTS[terrainType];
  }

  isPositionBlocked(x, y) {
    return getTerrainTypeAtPosition(x, y, this.terrain) === 'impassable';
  }

  /**
   * Find optimal path using A* with correct terrain costs
   */
  findPath(start, end) {
    // Convert to grid coordinates
    const startX = Math.floor((start.x + this.battlefieldSizeMU / 2) / this.gridSize);
    const startY = Math.floor((start.y + this.battlefieldSizeMU / 2) / this.gridSize);
    const endX = Math.floor((end.x + this.battlefieldSizeMU / 2) / this.gridSize);
    const endY = Math.floor((end.y + this.battlefieldSizeMU / 2) / this.gridSize);

    // Validate grid bounds
    if (startX < 0 || startX >= this.grid.length ||
      startY < 0 || startY >= this.grid[0].length ||
      endX < 0 || endX >= this.grid.length ||
      endY < 0 || endY >= this.grid[0].length) {
      return null;
    }

    // Reset grid
    this.resetGrid();

    const openSet = [];
    const startNode = this.grid[startX][startY];
    const endNode = this.grid[endX][endY];

    startNode.g = 0;
    startNode.h = this.heuristic(startNode, endNode);
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    while (openSet.length > 0) {
      // Get node with lowest f score
      let current = openSet.reduce((lowest, node) =>
        node.f < lowest.f ? node : lowest
      );

      // Remove from open set
      const index = openSet.indexOf(current);
      openSet.splice(index, 1);
      current.visited = true;

      // Check if we reached the end
      if (current === endNode) {
        return this.reconstructPath(current);
      }

      // Check neighbors
      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        if (neighbor.visited || neighbor.blocked) continue;

        const tentativeG = current.g + neighbor.cost;
        if (tentativeG < neighbor.g || neighbor.g === 0) {
          neighbor.parent = current;
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, endNode);
          neighbor.f = neighbor.g + neighbor.h;

          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    return null; // No path found
  }

  /**
   * Find path with AP cost calculation
   */
  findPathWithCost(start, end) {
    const path = this.findPath(start, end);
    if (!path) return null;

    let totalCost = 0;
    for (let i = 1; i < path.length; i++) {
      const terrainType = getTerrainTypeAtPosition(path[i].x, path[i].y, this.terrain);
      totalCost += TERRAIN_COSTS[terrainType];
    }
    return { path, cost: totalCost };
  }

  heuristic(nodeA, nodeB) {
    return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y);
  }

  getNeighbors(node) {
    const neighbors = [];
    // 8-directional movement
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

    for (const [dx, dy] of directions) {
      const gridX = Math.floor((node.x + this.battlefieldSizeMU / 2) / this.gridSize) + dx;
      const gridY = Math.floor((node.y + this.battlefieldSizeMU / 2) / this.gridSize) + dy;

      if (gridX >= 0 && gridX < this.grid.length &&
        gridY >= 0 && gridY < this.grid[0].length) {
        neighbors.push(this.grid[gridX][gridY]);
      }
    }

    return neighbors;
  }

  reconstructPath(node) {
    const path = [];
    let current = node;

    while (current !== null) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }

    return path;
  }

  resetGrid() {
    for (let x = 0; x < this.grid.length; x++) {
      for (let y = 0; y < this.grid[x].length; y++) {
        this.grid[x][y].g = 0;
        this.grid[x][y].h = 0;
        this.grid[x][y].f = 0;
        this.grid[x][y].parent = null;
        this.grid[x][y].visited = false;
      }
    }
  }
}