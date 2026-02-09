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
