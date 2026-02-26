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

3. **Mission System**
   - 10 complete missions (Elimination, Convergence, Dominion, Assault, Recovery, Escort, Triumvirate, Stealth, Defiance, Breach)
   - Data-driven mission engine
   - Objective Markers, VIP, POI/Zone Control
   - Reinforcements and Mission Event Hooks

4. **Combat Traits**
   - 43 trait implementations (Cleave, Parry, Reach, Conceal, etc.)
   - 27 traits fully integrated into game systems

5. **Assembly System**
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
| `npm run cli` | Run CLI interface |
| `npx tsx scripts/battle-generator.ts` | Run AI vs AI battle simulation |

## Battle Generator

The battle generator runs automated AI vs AI battles with configurable parameters. Perfect for testing, validation, and observing AI behavior.

### Quick Start

```bash
# Run default VERY_SMALL battle (QAI_11 Elimination)
npx tsx scripts/battle-generator.ts
```

### Command Line Options

```bash
# Show help
npx tsx scripts/battle-generator.ts --help

# SMALL battle with 30% terrain density
npx tsx scripts/battle-generator.ts --gameSize SMALL --density 30

# MEDIUM battle with night lighting
npx tsx scripts/battle-generator.ts --gameSize MEDIUM --lighting "Night, Full Moon"

# Specific mission (QAI_12 Convergence)
npx tsx scripts/battle-generator.ts --mission QAI_12

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

