# MEST Tactics Simulator

A tabletop wargame simulator for the MEST Tactics game rules, built to explore AI-assisted game development.

## Overview

This project is a collaborative effort between multiple AI engines (Qwen3-Max, Gemini, Copilot, and ChatGPT-Codex 5.2) to create a full-featured wargame simulator. The goal is to demonstrate that complex game logic can be developed through AI collaboration.

**Project Status:** ✅ Phase 1 & 2 Complete | 🔄 Phase 3 In Progress

**Architecture Goal:** The codebase is being structured to eventually separate into three distinct layers:
1. **AI System** — Generalizable AI framework for any tabletop wargame
2. **Artifact Framework** — Battlefield visualization and spatial reasoning (game-agnostic)
3. **MEST Tactics** — Game-specific rules, items, and mechanics

---

## Visual Audit System 🎬

**Interactive battle replay with timeline controls**

The Visual Audit system captures every action, movement, and combat resolution during a battle and generates an interactive HTML viewer for playback and analysis.

### Quick Start: View a Battle Replay

```bash
# Generate a VERY_SMALL battle with audit enabled
npm run cli -- --config very-small --audit --viewer

# Open the generated viewer in your browser
open generated/battle-reports/battle-report-*/battle-report.html
```

### Features

**Timeline Controls:**
- ⏹ **Stop** — Reset to Turn 1, Activation 0
- ⏯ **Play/Pause** — Toggle automatic playback
- ⏮ **Step Back** — Previous activation
- ⏭ **Step Forward** — Next activation
- 🎚 **Turn Slider** — Scrub through turns (1–N)
- ⚡ **Speed Control** — 0.33x, 0.5x, 1x, 2x playback speed

**Display Panels:**
- **Battle Info** — Mission name, current turn/activation, active side
- **Action Details** — Action type, AP spent, character ID, status tokens
- **Action Log** — Scrollable turn-by-turn event history

**Keyboard Shortcuts:**
- `Space` — Play/Pause
- `←` — Step Back
- `→` — Step Forward
- `Home` — Stop (reset to Turn 1)

### Example: Generate and View a Battle

```bash
# Step 1: Generate a battle with audit enabled
npm run cli -- --config very-small --audit --viewer --seed 12345

# Step 2: Open the viewer (output shows path)
# Generated: generated/battle-reports/battle-report-1740556789/
#   - battle-report.html    (interactive viewer)
#   - audit.json            (full audit data)
#   - frames.json           (pre-computed frame data)

# Step 3: Open in browser
open generated/battle-reports/battle-report-1740556789/battle-report.html

# Or serve locally and navigate:
npx serve generated/battle-reports/
# Then open: http://localhost:3000/battle-report-1740556789/battle-report.html
```

### Audit Data Structure

The audit system captures:

```json
{
  "version": "1.0",
  "session": {
    "missionId": "QAI_11",
    "missionName": "Elimination",
    "lighting": "Day, Clear",
    "visibilityOrMu": 16
  },
  "battlefield": {
    "widthMu": 24,
    "heightMu": 24
  },
  "turns": [
    {
      "turn": 1,
      "activations": [
        {
          "activationSequence": 1,
          "modelId": "char-001",
          "modelName": "AA-00",
          "steps": [
            {
              "actionType": "move",
              "apSpent": 2,
              "vectors": [
                { "kind": "movement", "from": { "x": 5, "y": 5 }, "to": { "x": 9, "y": 5 } }
              ],
              "affectedModels": [],
              "interactions": []
            }
          ]
        }
      ]
    }
  ]
}
```

### Status Token Visualization

Tokens are displayed radially around model bases:

| Token | Color | Meaning |
|-------|-------|---------|
| 🔴 Wound | Red | Model has taken damage |
| 🔵 Delay | Blue | Model has Delay token (pushing penalty) |
| 🟡 Fear | Yellow | Model is fleeing (failed Morale) |
| 🟢 Hidden | Green | Model is Hidden (concealed) |
| 🟣 Wait | Purple | Model is on Wait (reactive stance) |
| ⚫ KO | Gray | Model is Knocked Out |
| ⬛ Eliminated | Black | Model is Eliminated |

### Integration with Battle Runner

The `--audit` flag enables audit capture:

```bash
# Enable audit capture (default: true when --viewer is used)
npm run cli -- --audit

# Disable audit for performance
npm run cli -- --no-audit

# Generate viewer only (requires existing audit.json)
npm run cli -- --viewer --audit-file path/to/audit.json
```

### Output Files

| File | Description |
|------|-------------|
| `battle-report.html` | Interactive viewer with timeline controls |
| `audit.json` | Full audit trace (turn-by-turn actions) |
| `frames.json` | Pre-computed animation frames |
| `portraits.json` | Portrait clip metrics per model |

### Programmatic Usage

```typescript
import { AuditService } from './src/lib/mest-tactics/audit/AuditService';
import { mapAuditToSvgFrames } from './src/lib/mest-tactics/battlefield/rendering/SvgAnimationMapper';

// Create audit service
const auditService = new AuditService();

// Initialize for a battle
auditService.initialize({
  missionId: 'QAI_11',
  missionName: 'Elimination',
  lighting: 'Day, Clear',
  visibilityOrMu: 16,
  battlefieldWidth: 24,
  battlefieldHeight: 24,
});

// During game loop
auditService.startTurn(1);
auditService.startActivation({ /* activation data */ });
auditService.recordAction({ /* action data */ });
auditService.endActivation(/* end data */);
auditService.endTurn(/* side summaries */);

// Get audit data
const audit = auditService.getAudit();
const frames = auditService.getFrames();

// Convert to SVG frames
const svgOutput = mapAuditToSvgFrames(frames, {
  width: 24,
  height: 24,
  title: 'Battle Report',
});
```

---

---

## AI System Features 🤖

*Generalizable AI framework for tabletop wargames*

### Core AI Architecture
- **AIExecutor** — Action planning and execution pipeline
- **GOAP (Goal-Oriented Action Planning)** — Strategic decision-making
- **Behavior Trees** — Tactical behavior composition
- **HFSMs (Hierarchical Finite State Machines)** — State management for AI agents
- **Utility Scoring System** — Context-aware action evaluation with doctrine modifiers

### AI Decision-Making
- **Tactical Doctrine System** — 27 unique doctrines (Juggernaut, Sniper, Commander, etc.)
- **Stratagem Modifiers** — Doctrine-driven action preferences (melee/range, aggression, risk tolerance)
- **Predicted Scoring Integration** — Real-time VP/RP awareness for strategic planning
- **IP-Aware Decision Making** — Initiative Point spending evaluation (Refresh, Force Initiative)
- **Pushing Evaluation** — AP management with doctrine-based aggression

### Pathfinding & Navigation
- **Hybrid Pathfinding** — Mesh-based for open terrain, Grid-based for complex terrain
- **Adaptive Granularity Routing** — Performance-optimized path queries
- **Terrain-Aware Movement** — Rough, Difficult, Impassable terrain cost calculation
- **Engagement-Aware Pathing** — Avoids enemy engagement zones when appropriate

### Testing & Validation
- **CLI-Based AI vs AI Testing** — Automated battle simulation with configurable parameters
- **Battle Configurations** — 9 preset configurations (very-small through ai-stress-test)
- **Instrumentation System** — 6-grade detail levels for battle analysis (None → Full Detail)
- **Reproducible Battles** — Seeded random number generation for debugging

---

## Artifact Framework 🗺️

*Game-agnostic battlefield visualization and spatial reasoning*

### Battlefield Visualization
- **SVG Map Generator** — Primitive battlefield generation with terrain and model markers
- **Interactive Layer System** — Toggle terrain types, grid, models, LOS/LOF overlays
- **Professional Rendering** — Delaunay mesh, area terrain, buildings, walls, trees, rocks
- **Battle Report Integration** — SVG generation at battle start with model deployment

### Spatial Awareness
- **Line of Sight (LOS)** — Model-to-model visibility with terrain blocking
- **Line of Fire (LOF)** — Weapon arc validation with width-aware metadata
- **Field of Fire (FOF)** — Area coverage analysis for ranged weapons
- **Field of View (FOV)** — Character visibility cones with ORM limits

### Spatial Operations
- **Engagement Detection** — Base contact and melee range validation
- **Cover Classification** — Direct, intervening, hard, soft, blocking cover types
- **Movement Validation** — Path clearance and terrain cost calculation
- **Position Scoring** — Cover quality, exposure risk, lean opportunity evaluation

### 2D Navigation

**Hybrid A* Pathfinding System:**

The pathfinding engine uses a **hybrid approach** combining **grid-based A*** with **navmesh waypoints** for optimal performance and accuracy:

#### **Grid-Based A* Search**

**Grid Representation:**
- **Resolution:** Configurable (default 0.5 MU, auto-fines to 0.25 MU for small bases ≤0.5 MU)
- **Walkability:** Per-cell boolean grid with terrain collision checks
- **Edge Weights:** Terrain-based movement costs
  - Clear terrain: 1.0× cost
  - Rough terrain: 2.0× cost
  - Difficult terrain: 3.0× cost
  - Impassable: blocked (no path)

**A* Heuristic:**
```typescript
heuristic(a, b) = Euclidean distance = sqrt((a.x - b.x)² + (a.y - b.y)²)
```
- Admissible heuristic (never overestimates)
- Optimized for 8-directional movement (cardinal + diagonal)

**Edge Weights & Costs:**
```typescript
edgeCost = baseDistance × terrainMultiplier + turnPenalty

// Turn penalty applied when changing direction
if (useTheta && directionChanged) {
  edgeCost += turnPenalty; // Default: 0.1 MU
}

// Clearance penalty for tight spots
if (clearance < footprintDiameter) {
  edgeCost *= clearancePenalty; // Default: 1.25×
}
```

**Hierarchical Pathfinding:**
For large battlefields (>48 MU), uses **two-level hierarchical search**:
1. **Coarse level:** 8×8 cell chunks for long-distance planning
2. **Fine level:** Full resolution within chunk bounds
3. **Performance:** ~10× faster for 72×72 battlefields

#### **Navmesh Integration**

**Waypoint System:**
- **Constrained Delaunay Triangulation** of walkable areas
- **A* over triangles** for coarse path planning
- **Portal sequences** define corridor between triangles
- **String pulling** (Theta*) smooths path through portals

**Navmesh Edge Weights:**
```typescript
triangleCost = centroidDistance + narrowPortalPenalty

// Penalty for near-threshold portal crossings
if (portalWidth < footprintDiameter × portalNarrowThresholdFactor) {
  triangleCost += portalNarrowPenalty; // Default: 0.5 MU
}
```

**Hybrid Approach:**
```
Start → Navmesh A* → Waypoints → Grid A* (per segment) → End
      (coarse)              (fine, high-res)
```

#### **Path Caching**

**Two-Level Cache System:**

**1. Grid Cache (32 entries max):**
```typescript
gridCacheKey = `${terrainVersion}_${resolution}_${footprint}_${tightSpotFraction}_${clearancePenalty}`
```
- **Invalidation:** Terrain changes (version bump)
- **Hit Rate:** ~85% for repeated queries with same parameters
- **Eviction:** LRU (Least Recently Used)

**2. Path Cache (8000 entries max):**
```typescript
pathCacheKey = `${startQuantized}_${endQuantized}_${gridCacheKey}_${options}`
```
- **Quantization:** 3 decimal places (0.001 MU precision)
- **Options included:** useNavMesh, useHierarchical, useTheta, turnPenalty
- **Hit Rate:** ~70% for AI unit squad movement
- **Eviction:** LRU with touch-on-access

**Cache Statistics:**
```typescript
{
  terrainVersion: 5,
  gridCacheSize: 12,      // of 32 max
  pathCacheSize: 2847,    // of 8000 max
  gridHits: 1247,         // 87% hit rate
  gridMisses: 183,
  pathHits: 8934,         // 72% hit rate
  pathMisses: 3421
}
```

**Performance:**
- **Cache hit:** <0.1ms (memory lookup)
- **Cache miss (grid):** 2-5ms (A* search)
- **Cache miss (full):** 10-50ms (navmesh + grid A*)
- **Typical battle:** 500-2000 path queries per turn

#### **Footprint & Clearance**

**Model Footprint:**
```typescript
footprintDiameter = model.baseDiameter
tightSpotDiameter = footprintDiameter × tightSpotFraction  // Default: 0.5

// Auto-resolution for small bases
if (footprintDiameter <= 0.5 MU) {
  gridResolution = 0.25 MU;  // Fine grid
} else {
  gridResolution = 0.5 MU;   // Standard grid
}
```

**Clearance Checking:**
- **Full clearance:** Cell walkable with full footprint radius
- **Half clearance:** Cell walkable only with tight-spot radius (penalty applied)
- **No clearance:** Cell blocked

---

## MEST Tactics Features ⚔️

*Game-specific rules, items, and mechanics*

### Technology & Genre System
**Technological Periods & Ages:**

| Period | Tech Level | Age | Era | Status | Advanced Features |
|--------|------------|-----|-----|--------|-------------------|
| **Ancient** | 1 | Stone | Prehistory to ~3000 BCE | ✅ Complete | — |
| **Ancient** | 2 | Bronze | ~3000-1200 BCE | ✅ Complete | — |
| **Ancient** | 3 | Iron | ~1200 BCE-500 CE | ✅ Complete | — |
| **Archaic** | 5 | Medieval | ~500-1400 CE | ✅ Complete | — |
| **Archaic** | 6 | Renaissance | ~1400-1600 CE | ✅ Complete | — |
| **Archaic** | 7 | Colonial | ~1600-1750 CE | ✅ Complete | — |
| **Expansionist** | 8 | Sail | ~1750-1850 CE | ⏳ Partial | Suppression Fire |
| **Expansionist** | 9 | Industrial | ~1850-1900 CE | ⏳ Partial | Suppression Fire, Firelanes |
| **Expansionist** | 10 | Machine | ~1900-1920 CE | ⏳ Partial | Suppression Fire, Firelanes |
| **Modern** | 11 | Modern | ~1920-1950 CE | ⏳ Partial | Suppression Fire, Firelanes, Gas, Explosions |
| **Modern** | 12 | Atomic | ~1950-1970 CE | ⏳ Partial | Suppression Fire, Firelanes, Gas, Explosions |
| **Modern** | 13 | Information | ~1970-2000 CE | ⏳ Partial | Suppression Fire, Firelanes, Gas, Explosions |
| **Near** | 14 | Robotics | ~2000-2025 CE | ❌ Pending | Suppression Fire, Firelanes, Gas, Explosions, Fumes |
| **Near** | 15 | Fusion | ~2025-2050 CE | ❌ Pending | Suppression Fire, Firelanes, Gas, Explosions, Fumes |
| **Far** | 16 | Quantum | ~2050-2100 CE | ❌ Pending | Suppression Fire, Firelanes, Gas, Explosions, Fumes |
| **Far** | 17 | Energy | ~2100-2200 CE | ❌ Pending | Suppression Fire, Firelanes, Gas, Explosions, Fumes |
| **Far** | 18 | Gravity | ~2200-2500 CE | ❌ Pending | Suppression Fire, Firelanes, Gas, Explosions, Fumes |
| **Fantastic** | 19 | Symbolic (Low Magic) | ~2500 CE+ | ❌ Pending | Magic systems |
| **Fantastic** | 20 | Symbolic (High Magic) | ~2500 CE+ | ❌ Pending | Magic systems |

**Legend:**
- ✅ Complete — All rules implemented and tested
- ⏳ Partial — Basic items available, Advanced rules pending
- ❌ Pending — Requires MEST.Tactics.Advanced*.txt implementation

**Advanced Features Requiring Implementation:**
- **Suppression Fire** — Automatic weapon area denial (Tech 10+)
- **Firelanes** — Pre-sighted firing zones (Tech 10+)
- **Explosions** — Blast radius and shrapnel rules (Tech 11+)
- **Gas** — Gas clouds, drift, and effects (Tech 11+)
- **Fumes** — Lingering chemical effects (Tech 14+)

**Item Filtration by Age:**
- Automatic filtering of available weapons, armor, and equipment by technological period
- Profile generators respect technological constraints
- Assembly builders enforce era-appropriate loadouts

### Tactical Doctrine System
**27 Unique Doctrines** across three dimensions:
- **Engagement Style:** Melee, Ranged, Balanced
- **Planning Priority:** Aggression, Keys to Victory, Balanced
- **Aggression Level:** Aggressive, Balanced, Defensive

**Notable Doctrines:**
- **Juggernaut** — Melee aggression with charge bonuses
- **Sniper** — Ranged precision with Concentrate preference
- **Commander** — IP management for Force Initiative
- **Soldier** — Balanced elimination focus
- **Defender** — IP hoarding for defensive maneuvers

### Character & Assembly System
**Profile Generators:**
- Archetype-based character creation (Untrained, Militia, Average, Veteran, Elite)
- Item loadout generation with BP budget constraints
- Technological age filtering for equipment

**Assembly Builders:**
- Multi-character squad creation
- Side assignment with deployment zones
- Portrait system with callsign generation

**Variant Archetypes:**
- Specialized variants (Archer, Brawny, Scholarly, Cultist, etc.)
- Trait-based customization
- BP cost balancing

### Combat System
**Dice Mechanics:**
- d6-only success counting (Base, Modifier, Wild dice)
- Opposed Test resolution with cascades
- Carry-over dice for extended contests

**Combat Traits:**
- 43 trait implementations (Cleave, Parry, Reach, Conceal, etc.)
- 27 traits fully integrated into game systems
- Trait stacking and level management

**Status Effects:**
- Morale system (Fear, Bottle Tests, Rally)
- Concealment (Hidden, Detect actions)
- Delay tokens (Pushing penalty)
- KO and Elimination tracking

### Mission System
**10 Complete Missions:**
- QAI_11: Elimination — Default mission, last side standing
- QAI_12: Convergence — Zone control with 2-4 sides
- QAI_13: Dominion — Territory control
- QAI_14: Assault — Attack/defend scenario
- QAI_15: Recovery — Objective retrieval
- QAI_16: Escort — VIP protection
- QAI_17: Triumvirate — 3-4 side free-for-all
- QAI_18: Stealth — Covert operations
- QAI_19: Defiance — Hold position against waves
- QAI_20: Breach — Breakthrough scenario

**Mission Features:**
- Objective Markers (Physical, Intellectual, Moral)
- VIP and POI systems
- Zone control and contestation
- Reinforcement waves
- Mission-specific victory conditions

### Keys to Victory
- **Aggression** — First to cross midline (1 VP)
- **Elimination** — Each enemy model eliminated (1 VP each)
- **Bottled Out** — Enemy side fails Bottle Test (1 VP)
- **Outnumbered** — More models remaining at game end (1 VP)

---

## Project Structure

```
.
├── assets/                    # Visual assets
│   ├── portraits/             # Character portrait images
│   └── svg/
│       ├── terrain/           # Terrain SVG files
│       └── tokens/            # Game token/marker SVGs
├── data/                      # User-generated content
│   ├── assemblies/            # Team assemblies
│   ├── characters/            # Character instances
│   └── profiles/              # Character profiles
├── docs/                      # Documentation
│   ├── CONTRIBUTING.md        # Development guide
│   ├── CHANGELOG.md           # Version history
│   └── README.md              # This file
├── generated/                 # Generated output
│   └── svg-output/            # Generated battlefield SVGs
├── scripts/                   # Build and generation scripts
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── lib/
│   │   ├── mest-tactics/      # Core simulation engine
│   │   │   ├── actions/       # Game actions
│   │   │   ├── battlefield/   # Spatial systems
│   │   │   ├── combat/        # Combat resolution
│   │   │   ├── core/          # Domain models
│   │   │   ├── engine/        # Game engine
│   │   │   ├── mission/       # Mission system
│   │   │   ├── missions/      # Mission implementations
│   │   │   ├── status/        # Status effects
│   │   │   ├── subroutines/   # Low-level logic
│   │   │   ├── traits/        # Trait system
│   │   │   └── utils/         # Factories and helpers
│   │   └── portraits/         # Portrait logic
│   └── data/                  # Canonical JSON game data
└── blueprint.md               # Architecture and roadmap
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run unit tests (823 tests) |
| `npm run build` | Build the project |
| `npm run dev` | Start development server |
| `npm run generate:svg` | Generate SVG battlefields |
| `npm run generate:portraits` | Generate portrait index |
| `npm run validate:mission` | Validate mission JSON |
| `npm run cli` | **Run new battle runner CLI** |
| `npm run cli:combat` | Run interactive combat demo (legacy) |
| `npm run cli:side` | Run mission side demo (legacy) |
| `npm run cli:skirmish` | Run skirmish demo (legacy) |

## Battle Scripts

Two battle scripts are available, each optimized for different use cases:

### Quick Battles (`battle.ts`)

**Best for:** Rapid testing, iteration, quick validation

```bash
# Default VERY_SMALL battle (QAI_11 Elimination)
npm run battle

# With preset configuration
npm run battle -- --config small
npm run battle -- --config medium
npm run battle -- --config large
npm run battle -- --config very-large

# With visual audit and viewer
npm run battle -- --audit --viewer

# Terrain only (no battle execution)
npm run battle -- --terrain-only --seed 424242
```

**Output:**
```
generated/battle-reports/battle-report-TIMESTAMP/
├── battlefield.svg         # Terrain visualization
├── audit.json              # Battle audit (turns + activations)
├── deployment.json         # Deployment data
└── battle-report.html      # Interactive viewer
```

**Audit Level:** Basic (turns and activations captured, action steps empty)

### Full Battles (`ai-battle-setup.ts`)

**Best for:** Validation, detailed reports, visualization, AI behavior analysis

```bash
# Default battle with full audit
npm run ai-battle:audit

# With specific seed for reproducibility
npm run ai-battle:audit -- --seed 12345

# Interactive setup
npm run ai-battle:interactive
```

**Output:**
```
generated/battle-reports/battle-report-TIMESTAMP/
├── audit.json              # Full battle audit (action-by-action)
├── battle-report.html      # Interactive viewer
generated/ai-battle-reports/
└── battle-report-TIMESTAMP.json  # Complete battle report
```

**Audit Level:** Complete (turns, activations, AND detailed action steps)

### Both Scripts Include

- ✅ **Full AI vs AI** - Same AI stack (SideAI → AssemblyAI → CharacterAI)
- ✅ **Terrain placement** - Using TerrainPlacementService
- ✅ **Deployment zones** - QSR-compliant deployment
- ✅ **Interactive viewer** - HTML viewer with timeline controls
- ✅ **SVG battlefield** - Visual terrain layout

### Script Comparison

| Feature | `battle.ts` | `ai-battle-setup.ts` |
|---------|-------------|---------------------|
| **AI vs AI** | ✅ Full AI | ✅ Full AI |
| **Turn capture** | ✅ Yes | ✅ Yes |
| **Activation capture** | ✅ Yes | ✅ Yes |
| **Action step capture** | ❌ Empty | ✅ Detailed |
| **Decision reasoning** | ❌ Not captured | ✅ Captured |
| **Speed** | ~30 seconds | ~2-3 minutes |
| **Best for** | Quick testing | Validation/reports |

### Serve Battle Reports

```bash
# Start server on port 3001
npm run serve:reports

# Then open in browser:
# http://localhost:3001/terrain-audit
```

### Configuration Options
  "missionId": "QAI_11",
  "terrainDensity": 50,
  "lighting": {
    "name": "Day, Clear",
    "visibilityOR": 16
  },
  "sides": [
    {
      "id": "side-a",
      "name": "Side A",
      "assemblies": [{
        "name": "Assembly A",
        "archetypeName": "Average",
        "count": 3,
        "itemNames": ["Sword, Broad", "Armor, Light"]
      }],
      "ai": { "count": 1, "doctrine": "Balanced" }
    },
    {
      "id": "side-b",
      "name": "Side B",
      "assemblies": [{
        "name": "Assembly B",
        "archetypeName": "Average",
        "count": 3,
        "itemNames": ["Sword, Broad", "Armor, Light"]
      }],
      "ai": { "count": 1, "doctrine": "Balanced" }
    }
  ],
  "instrumentationGrade": 2
}
```

Run with: `npm run cli -- --config-file my-battle.json`

### Output Formats

- `console` (default): Human-readable console output
- `json`: Machine-readable JSON for analysis
- `both`: Both console and JSON output
- `audit`: Visual Audit JSON (for HTML viewer)
- `viewer`: Interactive HTML battle report

### Visual Audit Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `--audit` | (flag) | false | Enable audit capture during battle |
| `--no-audit` | (flag) | false | Disable audit capture (performance) |
| `--viewer` | (flag) | false | Generate HTML viewer from audit |
| `--audit-file` | path | null | Path to existing audit.json for viewer |

**Example:**
```bash
# Generate battle with audit and viewer
npm run cli -- --audit --viewer --seed 12345

# Generate viewer from existing audit
npm run cli -- --viewer --audit-file generated/battle-reports/audit-123.json

# Disable audit for faster simulation
npm run cli -- --no-audit --config large
```

### Winner Determination

The battle runner uses a deterministic winner resolution system:

1. **Victory Points (VP)** - Side with highest VP wins
2. **Resource Points (RP)** - If VP is tied, side with highest RP wins
3. **Tie** - If both VP and RP are tied, result is a tie
4. **Initiative Card** (optional) - If enabled, initiative card holder wins ties

**Example Output:**
```
🏆 FINAL RESULT
═══════════════════════════════════════
🏅 Winner: Side A (Victory Points)
Turns: 5
End Reason: End-game Trigger dice rolled miss (1-3) on Turn 5
```

**Tie Output:**
```
🏆 FINAL RESULT
═══════════════════════════════════════
🤝 Result: Tie
   Tied sides: side-a, side-b
   Tie-break: No tie-break applied
Turns: 6
End Reason: End-game Trigger dice rolled miss (1-3) on Turn 6
```

### JSON Output Example

```json
{
  "battleId": "battle-VERY_SMALL-1740556789",
  "turnsPlayed": 5,
  "gameEnded": true,
  "endGameReason": "End-game Trigger dice rolled miss (1-3) on Turn 5",
  "vpBySide": {
    "side-a": 3,
    "side-b": 1
  },
  "winnerSide": "side-a",
  "winnerReason": "vp",
  "tieSideIds": [],
  "stats": {
    "koBySide": { "side-a": 0, "side-b": 2 },
    "eliminatedBySide": { "side-a": 0, "side-b": 1 },
    "bottleTests": {
      "side-a": { "triggered": 0, "failed": 0 },
      "side-b": { "triggered": 1, "failed": 0 }
    }
  }
}
```

### Legacy Scripts (Deprecated)

The following scripts are deprecated and will be removed in a future version:

- `scripts/battle-generator.ts` → Use `npm run cli`

### Configuration Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `--gameSize` | VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE | VERY_SMALL | Battle scale |
| `--density` | 0-100 | 50 | Terrain density % |
| `--lighting` | "Day, Clear", "Night, Full Moon", etc. | "Day, Clear" | Lighting preset |
| `--mission` | QAI_11 through QAI_20 | QAI_11 | Mission ID |
| `--turns` | 1-20 | 10 | Max turns |
| `--instrumentation` | 0-5 | 3 | Detail level |

### Lighting Presets

| Preset | Visibility OR | Description |
|--------|---------------|-------------|
| "Day, Clear" | 16 MU | Full daylight |
| "Day, Hazy" | 14 MU | Hazy/foggy day |
| "Twilight, Clear" | 8 MU | Dawn/dusk |
| "Night, Full Moon" | 4 MU | Moonlit night |
| "Night, Half Moon" | 2 MU | Partial moon |
| "Night, New Moon" | 1 MU | Dark night |
| "Pitch-black" | 0 MU | Complete darkness |

### Instrumentation Grades

| Grade | Name | Output |
|-------|------|--------|
| 0 | None | No logging |
| 1 | Summary | Turn outcomes only |
| 2 | By Action | Actions with AP |
| 3 | With Tests | + Test results (pass/fail, cascades) |
| 4 | With Dice | + Individual dice rolls |
| 5 | Full Detail | + Traits, modifiers, AI reasoning |

### Default Profile

- **Archetype:** Average
- **Weapon:** Sword, Broad
- **Armor:** Shield, Small + Armor, Light + Armored Gear
- **Game Size:** VERY_SMALL (3 models per side, 24"×24" battlefield)
- **End-Game Trigger:** Turn 3 (per QSR Line 744)

## Documentation

- **[blueprint.md](blueprint.md)** - Project architecture, roadmap, and design decisions
- **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** - Development guidelines
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** - Version history
- **[src/guides/docs/](src/guides/docs/)** - Game rules reference

## Testing

All features are covered by unit tests. Currently **823 tests passing**.

```bash
# Run all tests
npm test

# Run specific test file
npx vitest src/lib/mest-tactics/combat/close-combat.test.ts
```

## Technology Stack

- **Runtime**: Node.js
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest
- **Build**: Astro + Vite
- **Styling**: Tailwind CSS
- **3D Graphics**: Three.js (planned)

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines.

## License

MIT

