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
- **NavMesh Generation** — Walkable area identification from terrain
- **Constraint Handling** — Model base diameter, terrain impassability
- **Multi-Model Pathfinding** — Collision avoidance for squad movement

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

## Battle Runner CLI

The new unified battle runner CLI provides automated AI vs AI battles with preset configurations and extensive customization options.

### Quick Start

```bash
# Run default VERY_SMALL battle (QAI_11 Elimination)
npm run cli

# Run with preset configuration
npm run cli -- --config small
npm run cli -- --config medium
npm run cli -- --config very-large

# Custom mission
npm run cli -- --mission QAI_12
npm run cli -- --mission QAI_17

# Custom lighting and terrain
npm run cli -- --lighting "Night, Full Moon" --terrain 30

# Instrumentation levels (0=None, 1=Summary, 2=By Action, 3=With Tests, 4=With Dice, 5=Full Detail)
npm run cli -- --instrumentation 2

# JSON output for analysis
npm run cli -- --output json

# Reproducible battle with seed
npm run cli -- --seed 424242

# Show all options
npm run cli -- --help
```

### Example: VERY_SMALL Battle

Quick 3v3 melee battle for testing:

```bash
# Default VERY_SMALL battle (fastest)
npm run cli

# VERY_SMALL with custom settings
npm run cli -- --config very-small --mission QAI_11 --terrain 50 --lighting "Day, Clear" --instrumentation 2

# VERY_SMALL with JSON output for analysis
npm run cli -- --config very-small --output json --seed 12345
```

**Expected Output:**
- **Battlefield:** 24"×24"
- **Models:** 3 per side (6 total)
- **Archetype:** Average with Sword, Broad + Armor, Light + Shield, Small
- **Duration:** ~30-60 seconds
- **End-Game Trigger:** Starts Turn 3

### Configuration Presets

| Config | Sides | Models | Mission | Battlefield |
|--------|-------|--------|---------|-------------|
| `very-small` | 2 | 3 each | QAI_11 | 24"×24" |
| `small` | 2 | 4 each | QAI_11 | 36"×36" |
| `medium` | 2 | 6 each | QAI_11 | 48"×48" |
| `large` | 2 | 8 each | QAI_11 | 60"×60" |
| `very-large` | 2 | 16 each | QAI_11 | 72"×72" |
| `convergence-3side` | 3 | 4 each | QAI_12 | 36"×36" |
| `trinity` | 3 | 6 each | QAI_17 | 48"×48" |
| `trinity-4side` | 4 | 8 each | QAI_17 | 60"×60" |
| `ai-stress-test` | 4 | 6 each | QAI_12 | 48"×48" |

### Custom JSON Configuration

Create a JSON file with your battle configuration:

```json
{
  "gameSize": "VERY_SMALL",
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
- `scripts/run-full-game.ts` → Use `npm run cli -- --config [size]`
- `scripts/run-ai-melee-battle.ts` → Use `npm run cli -- --mission QAI_11`

# Full detail instrumentation (Grade 5)
npx tsx scripts/battle-generator.ts --instrumentation 5

# Combined example
npx tsx scripts/battle-generator.ts \
  --gameSize LARGE \
  --density 40 \
  --lighting "Twilight, Clear" \
  --mission QAI_14 \
  --instrumentation 4
```

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

