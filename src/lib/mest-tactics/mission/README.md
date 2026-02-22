# Mission System

This directory contains the mission engine and supporting systems.

## Files

### Core Engine
- **`MissionSide.ts`** - Side representation with member tracking and status
- **`MissionSideBuilder.ts`** - Builder for creating mission sides from assemblies
- **`assembly-builder.ts`** - Build assemblies from profiles and archetypes
- **`mission-engine.ts`** - Core mission state machine and event processing
- **`mission-flow.ts`** - Mission flow orchestration
- **`mission-scoring.ts`** - Victory point calculation and scoring
- **`mission-runtime.ts`** - Runtime mission state and special rules
- **`mission-config.ts`** - Mission configuration and setup

### Mission Features
- **`objective-markers.ts`** - OM system (Switch, Lock, Key, Physical, Idea)
- **`poi-zone-control.ts`** - Point of Interest and zone control
- **`vip-system.ts`** - VIP protection and extraction
- **`reinforcements-system.ts`** - Reinforcement waves and arrival
- **`special-rules.ts`** - Mission-specific special rules
- **`victory-conditions.ts`** - Victory condition definitions
- **`scoring-rules.ts`** - Scoring rule definitions
- **`balance-validator.ts`** - Assembly balance validation
- **`heuristic-scorer.ts`** - AI heuristic scoring
- **`zone-factory.ts`** - Zone creation utilities
- **`side-spatial-binding.ts`** - Side-to-spatial binding

## Mission Types

| ID | Name | Sides | Description |
|----|------|-------|-------------|
| QAI_1 | Elimination | 2 | Destroy enemy forces |
| QAI_12 | Convergence | 2-4 | Multi-sided objective control |
| QAI_13 | Assault | 2 | Attacker vs Defender sabotage |
| QAI_14 | Dominion | 2 | Beacon zone control |
| QAI_15 | Recovery | 2 | Intelligence cache extraction |
| QAI_16 | Escort | 2 | VIP extraction |
| QAI_17 | Triumvirate | 3 | Three-way power struggle |
| QAI_18 | Stealth | 2 | Infiltration mission |
| QAI_19 | Defiance | 2 | Last stand defense |
| QAI_20 | Breach | 2 | Switch-based objective |

## Keys to Victory

- **Elimination** - Most BP eliminated
- **Dominance** - Zone control per turn
- **Courier** - Edge contact/delivery
- **Sanctuary** - Reserve force maintenance
- **POI** - Point of Interest control
- **Collection** - Objective Marker acquisition
- **Catalyst** - Battlefield condition trigger
- **First Blood** - First wound/KO
- **Bottled** - Enemy bottle test failure
- **Targeted** - Specific model elimination
- **VIP** - VIP protection/elimination
- **Harvest** - Resource acquisition
- **Acquisition** - OM extraction

## Usage

```typescript
import { buildMissionSide } from './mission/MissionSideBuilder';
import { MissionSide } from './mission/MissionSide';

const side = buildMissionSide({
  id: 'side-a',
  name: 'Attacker',
  roster: assemblyRoster,
  mergeAssemblies: true,
});

// Access members
side.members.forEach(member => {
  console.log(member.character.name);
  console.log(member.status); // Ready, Done, Waiting, KO, Eliminated
});
```

## Dependencies

- `core/` - Character, Assembly, Profile
- `battlefield/` - Spatial binding, positioning
- `mission/missions/` - Individual mission implementations
