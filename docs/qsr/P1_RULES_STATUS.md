# QSR P1 Rules Status

**Purpose:** Track executable coverage progress for Priority 1 core rules files (Visibility, Cover, Initiative/Activation, Movement, Morale).

**Last Updated:** 2026-03-04
**Status:** ⚠️ **IN PROGRESS (P1 runtime partials closed; source audits still ongoing)**

---

## Current Snapshot

| File | Clause Rows | ✅ Verified/Complete | ⚠️ Partial | ❌ Missing | ⚠️ Not Audited |
|------|-------------|----------------------|------------|------------|----------------|
| `docs/qsr/01-basics/01.03-visibility.md` | 14 | 14 | 0 | 0 | 0 |
| `docs/qsr/01-basics/01.04-cover.md` | 16 | 16 | 0 | 0 | 0 |
| `docs/qsr/02-initiative/02.01-initiative-activation.md` | 21 | 21 | 0 | 0 | 0 |
| `docs/qsr/03-actions/03.01-move.md` | 18 | 18 | 0 | 0 | 0 |
| `docs/qsr/07-morale/07.01-morale.md` | 38 | 38 | 0 | 0 | 0 |
| **Total** | **107** | **107** | **0** | **0** | **0** |

Notes:
- There are currently **0 `❌ Missing` rows** in the P1 rule files.
- There are currently **0 `⚠️ Partial` rows** in the 5 tracked P1 files.

---

## P1-Labeled Clause Snapshot

| Scope | Count |
|------|-------|
| P1-labeled clauses in these 5 files | 33 |
| ✅ Verified/Complete | 33 |
| ⚠️ Partial | 0 |
| ❌ Missing | 0 |

Open P1-labeled partial clause IDs:
- None currently open.

---

## Runtime Tests Added/Updated (This Hardening Pass)

| File | Focus |
|------|-------|
| `src/lib/mest-tactics/engine/initiative-points.test.ts` | Initiative/IP scoring, carry-over, tie flows, and special-ability spending (`IN.1`, `IN.3`, `IN.6`) |
| `src/lib/mest-tactics/actions/activation-rules.test.ts` | Activation AP/delay/done behavior + compulsory push enforcement (`DS.4`) |
| `src/lib/mest-tactics/actions/pushing-and-maneuvers.test.ts` | `PS.1-PS.5` via runtime action path |
| `src/lib/mest-tactics/actions/move-action-rules.test.ts` | `MV.5-MV.10`, `SW.1-SW.6`, EL.2 fear-exit elimination, core move/swap constraints |
| `src/lib/mest-tactics/battlefield/validation/action-context.test.ts` | Leaning + agility LOS integration (`AG.2`) |
| `src/lib/mest-tactics/status/morale-cohesion-visibility.test.ts` | Cohesion/visibility morale interactions |
| `src/lib/mest-tactics/status/morale.test.ts` | Fear test gates and token application |
| `src/lib/mest-tactics/actions/simple-actions-rally.test.ts` | Rally rules (`RL.*`) |
| `src/lib/mest-tactics/status/bottle-tests.test.ts` | Breakpoint/Bottle/Forfeit flow |
| `src/lib/mest-tactics/status/compulsory-actions-safety.test.ts` | Disordered/Panicked safety targeting (`DS.5`, `PN.4`) |
| `src/lib/mest-tactics/battlefield/spatial/spatial-rules.test.ts` | `PN.5`, `CV.1`, `CV.4`, `CV.5`, `LOS.2`, `LOS.5`, `TR.1-TR.3` behavior |
| `src/lib/mest-tactics/battlefield/terrain/TerrainElement.test.ts` | OVR-003 terrain name mapping hardening (building/wall/rocks canonical behavior) |
| `src/lib/mest-tactics/battlefield/terrain/aperture-rules.test.ts` | Doorway/window/low-ceiling terrain classification (`DR.1-DR.5`) |
| `src/lib/mest-tactics/battlefield/terrain/move-validator.test.ts` | Runtime movement pass/block integration for aperture terrain (`DR.1`, `DR.4`) |
| `src/lib/mest-tactics/actions/react-actions.test.ts` | React active-model handoff and repeat activation behavior (`AC.5`, `AC.6`) |

---

## Code Fixes Applied During Coverage Work

| File | Change |
|------|--------|
| `src/lib/mest-tactics/engine/GameManager.ts` | Fixed carry-over IP attribution, added runtime `executePushing()` path, designated-leader initiative/tie handling, end-turn bottle-test scheduling (`BT.1`), move-gate Disengage enforcement (`MV.2`), and React active-model tracking (`AC.6`) |
| `src/lib/mest-tactics/actions/react-actions.ts` | Added explicit temporary active-character handoff during React execution and restoration after completion (`AC.5`, `AC.6`) |
| `src/lib/mest-tactics/actions/activation.ts` | Added compulsory morale auto-push enforcement when AP is insufficient and push is legal (`DS.4`) |
| `src/lib/mest-tactics/status/compulsory-actions.ts` | Added runtime disordered/panicked safety resolution for cover/LOS and edge-exit targeting (`DS.5`, `PN.4`) |
| `src/lib/mest-tactics/status/morale.ts` | Hardened `FT.2-FT.7` behavior and per-turn fear-test tracking |
| `src/lib/mest-tactics/core/Character.ts` | Added `fearTestsThisTurn` and `swapsThisInitiative` state tracking fields |
| `src/lib/mest-tactics/actions/simple-actions.ts` | Rally AP/free gates + friendly/cohesion targeting (`RL.4`) and `RL.7`/`RL.8` modifiers |
| `src/lib/mest-tactics/status/bottle-tests.ts` | Added explicit forfeit option (`BT.7`) |
| `src/lib/mest-tactics/actions/move-action.ts` | Added path-segment costing (`MV.6-MV.9`) and runtime swap enforcement (`MV.10`, `SW.1-SW.6`) |
| `src/lib/mest-tactics/engine/GameManager.test.ts` | Added runtime manager-path assertions for first-free/additional-cost swaps, turn reset of fear-test gating, difficult-terrain move cost enforcement (`MV.4`), and per-turn initiative-slot uniqueness (`AC.4`) |
| `src/lib/mest-tactics/battlefield/spatial/spatial-rules.ts` | Added `PN.5` engagement exclusion, `CV.5` distance gating, and explicit visible-area obscuration fraction checks for `CV.1`/`CV.4` |
| `src/lib/mest-tactics/battlefield/los/LOSOperations.ts` | Added explicit visible-area sampling (`LOS.2`) and half-base-height terrain blocking threshold (`LOS.5`) |
| `src/lib/mest-tactics/battlefield/terrain/TerrainElement.ts` | Fixed OVR-003 terrain height/enterability mapping for canonical names (`Small/Large Building`, `Short/Medium/Large Wall`, rocks) |
| `src/lib/mest-tactics/battlefield/terrain/aperture-rules.ts` | Added doorway/window/low-ceiling traversal classification with half-base threshold rules (`DR.1-DR.5`) |
| `src/lib/mest-tactics/battlefield/terrain/move-validator.ts` | Wired aperture traversal resolution into move blocking with model-size-aware thresholds |
| `src/lib/mest-tactics/battlefield/validation/action-context.ts` | Added leaning-aware agility LOS probing to codify `AG.2` |
| `src/lib/mest-tactics/actions/combat-actions.ts` | Wired attacker agility budget into ranged/indirect LOS context when leaning |

---

## Redundancy Actions (Completed)

| File | Action |
|------|--------|
| `src/lib/mest-tactics/actions/p1-visibility-verification.test.ts` | Removed (low-signal/tautological) |
| `src/lib/mest-tactics/actions/p1-cover-verification.test.ts` | Removed (low-signal/tautological) |
| `src/lib/mest-tactics/actions/p1-initiative-verification.test.ts` | Removed (replaced by runtime tests) |
| `src/lib/mest-tactics/actions/p1-movement-verification.test.ts` | Removed (replaced by runtime tests) |
| `src/lib/mest-tactics/actions/p1-morale-verification.test.ts` | Removed (replaced by runtime tests) |

---

## Validation Baseline

- Full suite passes locally: **148 files, 2381 tests passing** (`npx vitest run`).
- Full suite with coverage passes locally: **148 files, 2381 tests passing** (`npx vitest run --coverage`).
- Previously observed AI-module warning sources were removed:
  - `UtilityScorer.ts` (`waitTacticalBonus` reassignment + duplicate weapon-classifier members)
  - `AIStratagems.ts` (duplicate `balanced` description key)

---

## P1 Module Coverage Snapshot (Vitest V8)

| Module | Stmts | Branch | Funcs | Lines |
|--------|-------|--------|-------|-------|
| `src/lib/mest-tactics/utils/visibility.ts` | 79.22 | 55.28 | 100.00 | 81.82 |
| `src/lib/mest-tactics/battlefield/los/LOSOperations.ts` | 64.17 | 53.28 | 84.00 | 65.29 |
| `src/lib/mest-tactics/battlefield/spatial/spatial-rules.ts` | 92.81 | 89.08 | 96.00 | 92.99 |
| `src/lib/mest-tactics/actions/activation.ts` | 96.15 | 84.85 | 85.71 | 97.96 |
| `src/lib/mest-tactics/actions/move-action.ts` | 84.54 | 74.25 | 100.00 | 85.56 |
| `src/lib/mest-tactics/status/morale.ts` | 81.90 | 72.16 | 88.89 | 89.01 |
| `src/lib/mest-tactics/engine/GameManager.ts` | 58.31 | 48.97 | 61.09 | 60.36 |
| `src/lib/mest-tactics/battlefield/terrain/move-validator.ts` | 65.13 | 60.95 | 64.29 | 67.65 |
| `src/lib/mest-tactics/battlefield/validation/action-context.ts` | 79.20 | 74.75 | 78.57 | 85.59 |

---

## Next Priority 1 Steps

1. Continue tightening `Not Started`/`Not Audited` inventories as source audits advance.
2. Expand source-audit coverage outside the 5 tracked P1 files.
3. Raise targeted coverage in lower-coverage P1 support modules (`GameManager.ts`, `LOSOperations.ts`, `move-validator.ts`) with behavior-backed tests.
