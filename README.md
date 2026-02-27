# MEST Tactics Simulator

A tabletop wargame simulator for the MEST Tactics game rules, built to explore AI-assisted game development.

## Overview

This project is a collaborative effort between multiple AI engines (Qwen3-Max, Gemini, Copilot, and ChatGPT-Codex 5.2) to create a full-featured wargame simulator. The goal is to demonstrate that complex game logic can be developed through AI collaboration.

**Project Status:** ✅ Phase 1 & 2 Complete | 🔄 Phase 3 In Progress

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Generate SVG battlefields
npm run generate:svg

# Build the project
npm run build
```

## Features

### Implemented ✅

1. **Headless Simulation Engine**
   - Full dice rolling mechanics (Base, Modifier, Wild dice)
   - Combat resolution (Close Combat, Ranged, Indirect)
   - Action system (Move, Attack, Disengage, React, etc.)
   - Status effects (Morale, Concealment, Fear, KO, etc.)

2. **Spatial Awareness**
   - 2D battlefield with measurement utilities
   - Line of Sight (LOS) and Line of Fire (LOF) validation
   - Engagement and melee range checks
   - Cover classification (direct/intervening, hard/soft/blocking)
   - Pathfinding and terrain navigation

3. **AI Movement & Cover-Seeking (R3)** ✅
   - Board-scale route selection with strategic positioning
   - Cover quality evaluation (LOS-based)
   - Lean opportunity detection for ranged models
   - Exposure risk assessment
   - Doctrine-aware scoring (ranged vs melee preferences)
   - Size-agnostic behavior across all game sizes

4. **Mission System**
   - 10 complete missions (Elimination, Convergence, Dominion, Assault, Recovery, Escort, Triumvirate, Stealth, Defiance, Breach)
   - Data-driven mission engine
   - Objective Markers, VIP, POI/Zone Control
   - Reinforcements and Mission Event Hooks

5. **Combat Traits**
   - 43 trait implementations (Cleave, Parry, Reach, Conceal, etc.)
   - 27 traits fully integrated into game systems

6. **Assembly System**
   - Profile builder from archetypes + items
   - Assembly creation with BP budget
   - Side assignment with position tracking

### Planned 📋

**Phase 3: Web UI for Local Play**
- 2D SVG battlefield renderer
- Model selection and action panel
- Deployment phase with drag-and-drop
- Full local play with hotseat mode

**Phase 4: Online Multiplayer**
- User authentication and profiles
- Real-time WebSocket gameplay
- Leaderboards and statistics
- Cloud deployment

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

# JSON output for analysis
npm run cli -- --output json

# Reproducible battle with seed
npm run cli -- --seed 424242

# Show all options
npm run cli -- --help
```

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

