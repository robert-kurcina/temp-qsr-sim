# Contributing to MEST Tactics Simulator

This document provides guidelines for contributing to the MEST Tactics Simulator project.

## Development Setup

### Prerequisites

- Node.js v20+ 
- npm

### Installation

```bash
npm install
```

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

## Project Structure

```
.
├── assets/                    # Visual assets (portraits, SVG tokens, terrain)
├── data/                      # User-generated content (assemblies, characters, profiles)
├── docs/                      # External documentation
├── generated/                 # Generated output (SVG battlefields)
├── scripts/                   # Build and generation scripts
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── lib/
│   │   ├── mest-tactics/      # Core simulation engine
│   │   │   ├── actions/       # Game actions (Move, Attack, Disengage, etc.)
│   │   │   ├── battlefield/   # Spatial systems (LOS, pathfinding, terrain)
│   │   │   ├── combat/        # Combat resolution (CC, ranged, indirect)
│   │   │   ├── core/          # Domain models (Character, Profile, Item)
│   │   │   ├── engine/        # Core engine (GameManager, GameController)
│   │   │   ├── mission/       # Mission engine and scoring
│   │   │   ├── missions/      # Individual mission implementations
│   │   │   ├── status/        # Status effects (Morale, Concealment)
│   │   │   ├── subroutines/   # Low-level logic (damage, hit-test, dice)
│   │   │   ├── traits/        # Trait system
│   │   │   └── utils/         # Factories and test helpers
│   │   └── portraits/         # Portrait logic
│   └── data/                  # Canonical JSON game data
└── blueprint.md               # Project architecture and roadmap
```

## Code Style

- **TypeScript**: Strict mode enabled
- **Modules**: ES Modules
- **Formatting**: Consistent indentation (2 spaces)
- **Naming**: 
  - Classes: PascalCase
  - Functions/variables: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Files: kebab-case

## Testing Guidelines

1. **Unit tests** are required for all new features
2. Use **Vitest** as the testing framework
3. Follow the **systematic debugging approach**:
   - Fix least-dependent failing tests first
   - Use console.log for debugging (remove after fix)
   - Run full test suite before committing

## Git Workflow

1. Create a feature branch from `main`
2. Make atomic commits with clear messages
3. Run tests before pushing
4. Submit a pull request

### Commit Message Format

```
<type>: <subject>

<body - optional>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Example:
```
feat: add new disengage action

Implemented disengage action with situational modifiers.
All tests passing.
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run unit tests |
| `npm run build` | Build the project |
| `npm run dev` | Start development server |
| `npm run generate:svg` | Generate SVG battlefields |
| `npm run generate:portraits` | Generate portrait index |
| `npm run validate:mission` | Validate mission JSON |

## Architecture Principles

1. **Single Source of Truth**: All game data from `src/data/` JSON files
2. **No Fabrication**: Never invent data not in project files
3. **Headless First**: Focus on core simulation logic before UI
4. **SOLID Design**: Single Responsibility, modular components
5. **Unit Testing**: Every feature must have tests

## Questions?

Refer to `blueprint.md` for detailed architecture and roadmap.
