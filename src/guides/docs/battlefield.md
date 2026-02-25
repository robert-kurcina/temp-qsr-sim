# Battlefield Framework

## Overview

This document outlines the architecture for the 2D battlefield, which will serve as the foundation for all spatial reasoning in the MEST Tactics game. The framework is designed to be extensible, with a clear path for future expansion into 3D.

## Core Components

### 1. Grid Layer

*   **Granularity:** 0.5 Measurement Units (MU).
*   **Purpose:** Provides a high-resolution coordinate system for precise placement of characters and terrain.

### 2. Terrain Elements

*   **Placement:** Terrain elements will be placeable objects on the grid.
*   **Rotation:** Each terrain element will support Z-axis rotation to allow for varied and dynamic battlefield layouts.
*   **Properties:** Terrain will have properties that affect gameplay, such as:
    *   `providesCover`: (boolean)
    *   `blocksLOS`: (boolean)
    *   `isDifficult`: (boolean)

### 2.1 Battlefield Factory (Procedural Placement)

Terrain placement can be generated using weighted categories and a density ratio (default 25):
- Weights for `area`, `shrub`, `tree`, `rocks`, `wall`, `building`
- `blockLOS` (default 25) controls how much of the battlefield blocks a clear LOS segment (1 MU wide, 8 MU long)
- `densityRatio` from 10–100 determines total terrain coverage as a proportion of battlefield area

Placement rules:
- Area terrain first (separate layer; other terrain may be placed atop it)
- Buildings next
- Walls next, aligned to the closest building (or perpendicular) or aligned to an existing wall
- Trees next (can be placed within 1 MU of buildings or walls)
- Rocks next
- Shrubs last

Minimum spacing between elements is 3 MU by default, except:
- Walls may be within 1 MU of buildings or other walls
- Trees may be within 1 MU of buildings or walls

Terrain elements may be rotated in 15-degree increments.

### 3. Delaunay Triangulation (Navigation Mesh)

*   **Technology:** We will use a TypeScript library for Delaunay triangulation (e.g., `d3-delaunay`) to generate a navigation mesh.
*   **Dynamic Generation:** The mesh will be dynamically generated and updated in response to the placement and rotation of terrain elements. The vertices of the terrain obstacles will be used as the vertices for the triangulation.

### 4. Pathfinding

*   **Algorithm:** We will implement an A* (A-star) pathfinding algorithm.
*   **Navigation:** The A* algorithm will use the Delaunay mesh to find the optimal path between two points, navigating around obstacles.
*   **Terrain Cost:** The pathfinding will account for terrain properties, with difficult terrain having a higher movement cost.

### 5. Line of Sight (LOS) & Field of View (FoV)

*   **2D LOS:** We will implement a 2D Line of Sight algorithm (e.g., Bresenham's line algorithm) to determine if there is an unobstructed line between two points.
*   **2D FoV:** We will implement an algorithm to calculate a character's field of view, which will be a cone-shaped area determined by the character's facing.
