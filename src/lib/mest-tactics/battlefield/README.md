# Battlefield System

This directory contains the spatial awareness and battlefield management subsystem.

## Subdirectories

### `los/` - Line of Sight
- **`LOSOperations.ts`** - Line of Sight calculations
- **`LOFOperations.ts`** - Line of Fire calculations  
- **`los-validator.ts`** - LOS validation between models

### `pathfinding/` - Navigation
- **`Grid.ts`** - Battlefield grid representation
- **`Cell.ts`** - Individual grid cells
- **`ConstrainedNavMesh.ts`** - Navigation mesh with constraints
- **`OccupancyField.ts`** - Model occupancy tracking
- **`Pathfinder.ts`** - A* pathfinding implementation
- **`PathfindingEngine.ts`** - Pathfinding orchestration

### `rendering/` - SVG Output
- **`BattlefieldFactory.ts`** - Battlefield creation with terrain
- **`SvgRenderer.ts`** - SVG generation for battlefields

### `spatial/` - Spatial Rules
- **`engagement-manager.ts`** - Engagement state tracking
- **`model-registry.ts`** - Model registration and lookup
- **`spatial-rules.ts`** - Core spatial rules (LOS, cohesion)
- **`size-utils.ts`** - Base diameter and SIZ calculations

### `terrain/` - Terrain System
- **`Terrain.ts`** - Terrain definitions
- **`TerrainElement.ts`** - Individual terrain elements
- **`move-validator.ts`** - Movement validation with terrain costs

### `validation/` - Action Validation
- **`action-context.ts`** - Action context building and validation

## Core Files

- **`Battlefield.ts`** - Main battlefield class with character placement
- **`Position.ts`** - 2D position type (`{ x, y }`)
- **`spatial-helpers.ts`** - Spatial utility functions
- **`spatial.ts`** - Spatial model definitions
- **`index.ts`** - Barrel exports

## Battlefield Model

```
24×24 MU (Small)
36×36 MU (Medium)
48×48 MU (Large)

Each MU ≈ 1 inch (25.4mm)
Model base diameter = SIZ-based (SIZ 3 = 30mm/1.25")
```

## Usage

```typescript
import { Battlefield } from './battlefield/Battlefield';
import { Position } from './battlefield/Position';

const battlefield = new Battlefield(24, 24);

// Place characters
battlefield.placeCharacter(character, { x: 12, y: 12 });

// Get position
const pos = battlefield.getCharacterPosition(character);

// Check engagement
const engaged = battlefield.isEngaged(character);

// Check LOS
const hasLOS = battlefield.hasLOS(attacker, defender);
```

## Spatial Awareness Features

1. **Model Registry** - Track all models with positions and base sizes
2. **Engagement** - Detect engaged models and melee range
3. **LOS/LOF** - Line of Sight and Line of Fire validation
4. **Cover** - Direct and intervening cover classification
5. **Movement** - Terrain costs and move validation
6. **Pathfinding** - A* navigation around obstacles

## Dependencies

- `core/` - Character model
- `data/` - Terrain definitions
