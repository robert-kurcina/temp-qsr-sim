# Changelog

All notable changes to the MEST Tactics Simulator project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Directory structure consolidation (Phase 1)
  - Created `assets/` for visual assets (portraits, SVG tokens, terrain)
  - Created `data/` for user-generated content (assemblies, characters, profiles)
  - Created `generated/` for generated output (SVG battlefields)
  - Moved `portraits/` → `assets/portraits/`
  - Moved `svg/` → `assets/svg/` (renamed `play-aides/` → `tokens/`)
  - Moved `svg-output/` → `generated/svg-output/`
  - Moved `assemblies/` → `data/assemblies/`
  - Moved `characters/` → `data/characters/`
  - Moved `profiles/` → `data/profiles/`

### Changed
- **Major directory restructure** of `src/lib/mest-tactics/`
  - Organized 191 files into 12 logical modules
  - Created `core/` for domain models
  - Created `engine/` for core engine components
  - Created `actions/` for all action logic
  - Created `combat/` for combat subsystem
  - Split `battlefield/` into 6 subdirectories (los/, pathfinding/, rendering/, spatial/, terrain/, validation/)
  - Created `status/` for status effects
  - Created `traits/` for trait system
  - Created `mission-system/` for mission engine
  - Created `subroutines/` for low-level logic
  - Created `utils/` for factories and test helpers
- Added barrel exports (`index.ts`) for clean module boundaries
- Updated all import paths (80+ files)

### Fixed
- Fixed import paths in all scripts after directory moves
- Fixed `executeReactAction` function missing from `react-actions.ts`
- Fixed mock paths in test files

### Technical
- All 823 unit tests passing
- Build process verified
- Generation scripts updated and tested

## [2024.02] - 2024-02-22

### Added
- 10 of 10 missions implemented (Elimination, Convergence, Dominion, Assault, Recovery, Escort, Triumvirate, Stealth, Defiance, Breach)
- Combat traits framework with 43 trait implementations
- 27 traits fully integrated into game systems
- Mission Side wiring with assembly support
- Objective Markers system
- VIP system
- POI/Zone Control system
- Reinforcements system
- Mission Event Hooks
- Spatial awareness system (LOS, engagement, cover, model registry)

### Changed
- Renamed all missions from QAI names to sci-fi themed names
- Refactored missions to be modular and configuration-driven

## [2024.01] - 2024-01-15

### Added
- Headless simulation engine with spatial awareness
- Mission system (4 of 10 missions)
- Profile/assembly pipeline
- Character class refactoring
- Types separation (`types.ts`)

### Changed
- Refactored `Character.ts` to a class structure
- Implemented damage parser using string manipulation (no regex)

## [2023.12] - 2023-12-01

### Added
- Initial project setup
- Basic dice rolling mechanics
- Core action system
- Unit testing framework (Vitest)
