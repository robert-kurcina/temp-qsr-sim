# Mission Domain Core

This directory contains shared mission-domain primitives used by the active mission runtime adapter stack.

## Primary Domain Modules

- `MissionSide.ts` - Side/member state model and score projection helpers
- `MissionSideBuilder.ts` - Builder utilities for side construction
- `assembly-builder.ts` - Profile/assembly construction and game-size defaults
- `objective-markers.ts` - Objective-marker lifecycle and OM interaction primitives
- `deployment-system.ts` - Mission deployment zones and placement utilities
- `special-rules.ts` - Special-rule handlers used by mission flows and tests
- `scoring-rules.ts` - Scoring rule evaluators
- `victory-conditions.ts` - Victory-condition evaluators
- `balance-validator.ts` - Mission/balance checks
- `zone-factory.ts` - POI/zone construction helpers
- `side-spatial-binding.ts` - Side/member spatial binding helpers

## Runtime Authority

- Active runtime integration is `src/lib/mest-tactics/missions/mission-runtime-adapter.ts`.
- Core mission orchestration entry points are in:
  - `src/lib/mest-tactics/engine/GameController.ts`
  - `src/lib/mest-tactics/engine/GameManager.ts`

## Notes

- This folder intentionally focuses on reusable mission-domain building blocks.
- Mission-specific managers and mission configuration loading live under `src/lib/mest-tactics/missions/`.
