# Game Engine

This directory contains the core game engine components that orchestrate simulation.

## Files

- **`EventLogger.ts`** - Event logging service for game actions and state changes
- **`GameController.ts`** - High-level game flow controller (turns, activations, mission flow)
- **`GameManager.ts`** - Central game state manager with action execution methods
- **`MetricsService.ts`** - Performance metrics and telemetry collection

## Responsibilities

### GameController
- Manages overall game flow
- Coordinates between sides and missions
- Handles turn transitions and end-game conditions
- Processes mission deltas and bottle test results

### GameManager
- Tracks character states (Ready, Done, Waiting, KO, Eliminated)
- Executes actions (Move, Attack, Disengage, React, etc.)
- Manages activation flow and AP tracking
- Provides position lookup and spatial queries

### EventLogger
- Records all game events for replay and debugging
- Supports structured event data
- Timestamps all events

### MetricsService
- Collects performance metrics
- Tracks action execution times
- Provides telemetry for optimization

## Usage

```typescript
import { GameManager } from './engine/GameManager';
import { Battlefield } from './battlefield/Battlefield';
import { Character } from './core/Character';

const characters: Character[] = [...];
const battlefield = new Battlefield(24, 24);
const gameManager = new GameManager(characters, battlefield);

// Execute actions
gameManager.beginActivation(character);
gameManager.spendAP(character, 1);
gameManager.endActivation(character);
```

## Dependencies

- `core/` - Domain models
- `battlefield/` - Spatial systems
- `actions/` - Action implementations
- `mission/` - Mission system
