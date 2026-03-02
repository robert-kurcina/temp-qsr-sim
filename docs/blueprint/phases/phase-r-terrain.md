# Phase R (P1-HIGH): Terrain Placement Refactoring

**Source:** Extracted from `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (Lines 1641-1741)  
**Extraction Date:** 2026-03-02

---

**Status:** 📋 **PLANNED** (2026-02-28)

**Priority:** **P1-HIGH** - Code quality, SOLID compliance, dead code elimination

**Objective:** Externalize terrain placement logic into a shared module used by all three battle generation scripts. Eliminate redundant terrain generators and ensure consistent legal terrain placement across all modes.

### Problem Statement

**Current State:** Three independent terrain placement implementations:

| Script | Location | Quality | Shared? |
|--------|----------|---------|---------|
| **generate:svg** | `scripts/generate-svg-output.ts` (lines 257-600) | Thorough (overlap checks, watchdog timers) | ❌ No |
| **cli** | `scripts/run-battles/battle-runner.ts` (lines 407-428) | Basic (random rectangles, no validation) | ❌ No |
| **ai-battle** | `scripts/ai-battle-setup.ts` (lines 3848-3862) | Moderate (TerrainElement class, no collision) | ⚠️ Uses TerrainElement class |

**Issues:**
- ❌ **Violates DRY** - Same logic implemented 3 times
- ❌ **Inconsistent terrain** - CLI has illegal overlaps, others don't
- ❌ **Maintenance burden** - Fix bug in one place, still broken in 2 others
- ❌ **Dead code** - ~400 lines of redundant terrain placement logic
- ❌ **Not testable** - Terrain logic embedded in scripts, can't unit test

### Solution: Unified TerrainPlacement Module

**New Module Structure:**
```
src/lib/mest-tactics/battlefield/terrain/
├── TerrainPlacement.ts       # NEW: Shared placement logic
├── TerrainPlacement.test.ts  # NEW: Unit tests (50+ tests)
├── TerrainFitness.ts         # NEW: Legality validation
├── TerrainElement.ts         # EXISTING: Keep as-is
└── Terrain.ts                # EXISTING: Keep as-is
```

**API Design:**
```typescript
interface TerrainPlacementOptions {
  mode: 'fast' | 'balanced' | 'thorough';
  density: number;              // 0-100
  battlefieldWidth: number;     // MU
  battlefieldHeight: number;    // MU
  seed?: number;                // For reproducibility
}

interface TerrainPlacementResult {
  terrain: TerrainFeature[];
  stats: {
    placed: number;
    rejected: number;
    attempts: number;
  };
}

class TerrainPlacementService {
  placeTerrain(options: TerrainPlacementOptions): TerrainPlacementResult;
  validatePlacement(terrain: TerrainFeature[]): TerrainFitnessReport;
}
```

**Placement Modes:**

| Mode | Max Attempts | Overlap Check | Spacing Validation | Use Case |
|------|-------------|---------------|-------------------|----------|
| `fast` | 10 | No | No | CLI battles (speed priority) |
| `balanced` | 100 | Yes | Basic | AI battles (reasonable quality) |
| `thorough` | 1000+ | Yes + minimum spacing | Full | generate:svg (quality priority) |

### Migration Plan

**Phase R.1: Create TerrainPlacement Module** (1 day)
- [ ] Extract logic from `generate-svg-output.ts` (best implementation)
- [ ] Create `TerrainPlacementService` class
- [ ] Add configurable placement modes
- [ ] Write unit tests (50+ tests)

**Phase R.2: Migrate generate:svg** (0.5 days)
- [ ] Replace inline terrain logic with `TerrainPlacementService`
- [ ] Verify output matches current behavior
- [ ] Run visual regression tests

**Phase R.3: Migrate ai-battle** (0.5 days)
- [ ] Replace `createBattlefield()` terrain logic
- [ ] Use `balanced` mode for AI battles
- [ ] Verify battles run correctly

**Phase R.4: Migrate cli** (0.5 days)
- [ ] Replace `generateTerrain()` with `TerrainPlacementService`
- [ ] Use `fast` mode for CLI (preserve speed)
- [ ] Verify battles run correctly

**Phase R.5: Cleanup** (0.5 days)
- ✅ Delete old terrain code from all three scripts
- ✅ Delete legacy scripts (`run-full-game.ts`, `run-ai-melee-battle.ts`)
- ✅ Update documentation (README.md, blueprint.md)
- ✅ Run full test suite (1844 tests passing)

---

## Document Index

| File | Description |
|------|-------------|
| [../../blueprint.md](../../blueprint.md) | Master blueprint document |
| [../01-overview.md](../01-overview.md) | Overview, Operating Principles, Environment |
| [../02-game-docs.md](../02-game-docs.md) | Game Documentation, Implementation Details |
| [../03-current-task.md](../03-current-task.md) | Current Task, Gaps, Prioritized Plan |
| [phase-0-qsr-rules.md](phase-0-qsr-rules.md) | Phase 0: QSR Rules Gap Closure |
| [phase-1-engine.md](phase-1-engine.md) | Phase 1: Core Engine Stability |
| [phase-2-ai-foundation.md](phase-2-ai-foundation.md) | Phase 2: AI Foundation |
| [phase-2-subphases.md](phase-2-subphases.md) | Phase 2.1-2.7: AI Sub-phases |
| [phase-3-ai-tactical.md](phase-3-ai-tactical.md) | Phase 3: AI Tactical Intelligence |
| [phase-4-validation.md](phase-4-validation.md) | Phase 4: Validation & Testing |
| [phase-a0-visual-audit.md](phase-a0-visual-audit.md) | Phase A0: Visual Audit API |
| [phase-r-terrain.md](phase-r-terrain.md) | **This file** — Phase R: Terrain Placement Refactoring |
| [phase-s-consolidation.md](phase-s-consolidation.md) | Phase S: Battle Script Consolidation |
| [future-phases.md](future-phases.md) | Future Phases (I+) |
