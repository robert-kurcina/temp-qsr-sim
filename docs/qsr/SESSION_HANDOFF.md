# QSR Compliance Project - Session Handoff

**Date:** 2026-03-03
**Session:** Priority 1 Runtime Coverage Hardening
**Status:** ⚠️ **IN PROGRESS (tracked P1 rows fully verified; broader source audits remain)**

---

## Executive Snapshot

- Clause catalogs for core P1 files are in place.
- Runtime hardening replaced low-signal verification suites with behavior-backed tests.
- Current P1 file snapshot: **107 clause rows total**, **107 verified**, **0 partial**, **0 missing**, **0 not-audited**.
- Full test baseline: **147 test files, 2364 tests passing**.

---

## Completed In This Pass

### Runtime/Code

- Added first-class runtime action path for Pushing:
  - `src/lib/mest-tactics/engine/GameManager.ts` (`executePushing`)
- Closed targeted movement-sequencing gaps:
  - `MV.6-MV.9` in `src/lib/mest-tactics/actions/move-action.ts`
- Closed move engagement gate:
  - `MV.2` in `src/lib/mest-tactics/engine/GameManager.ts` (engaged models must Disengage before Move)
- Closed terrain-cost move validation:
  - `MV.4` via runtime difficult-terrain movement-cost assertions in `GameManager.test.ts`
- Closed agility-limited move extension:
  - `MV.5` via Leap start/end-of-movement gating tests in `move-action-rules.test.ts`
- Closed swap-position movement gaps:
  - `MV.10`, `SW.1-SW.6` in `src/lib/mest-tactics/actions/move-action.ts`
- Closed cover distance gate:
  - `CV.5` in `src/lib/mest-tactics/battlefield/spatial/spatial-rules.ts`
- Closed LOS/Cover geometry partials:
  - `LOS.2`, `LOS.5` in `src/lib/mest-tactics/battlefield/los/LOSOperations.ts`
  - `CV.1`, `CV.4` in `src/lib/mest-tactics/battlefield/spatial/spatial-rules.ts`
- Closed OVR-003 terrain-name mismatch:
  - `TerrainElement.ts` now maps canonical names (`Small Building`, `Short Wall`, rocks) to height/enterability rules correctly
- Implemented DR.1-DR.5 doorway/window/low-ceiling traversal classification:
  - `src/lib/mest-tactics/battlefield/terrain/aperture-rules.ts`
  - integrated with movement blocking in `src/lib/mest-tactics/battlefield/terrain/move-validator.ts`
- Closed remaining terrain semantics in P1 Cover:
  - `TR.1-TR.3` via `spatial-rules.test.ts`
- Closed agility-for-LOS integration:
  - `AG.2` via leaning-aware LOS probing in `battlefield/validation/action-context.ts` wired from `combat-actions.ts`
- Closed initiative special-ability spend path:
  - `IN.6` via runtime coverage of `maintainInitiative`, `forceInitiative`, `refresh`
- Closed initiative leader/tie semantics:
  - `IN.1`, `IN.3` via designated-leader side initiative resolution and tie-path runtime tests
- Closed activation lifecycle semantics:
  - `AC.4`, `AC.5`, `AC.6` via per-turn initiative-slot uniqueness and React active-model handoff runtime behavior
- Hardened morale paths:
  - `FT.2-FT.7`, `DS.4`, `DS.5`, `PN.4`, `RL.1-RL.8`, `BT.7`, `PN.5`, `EL.2`
  - added turn-cycle fear-test reset verification for `FT.5`
- Closed rally friendly/cohesion gate:
  - `RL.4` in `src/lib/mest-tactics/actions/simple-actions.ts` with dedicated rally runtime tests
- Closed bottle-test scheduling path:
  - `BT.1` via `GameManager.endTurn()` and activation-to-turn-end phase flow tests

### Tests

- Added/updated runtime suites:
  - `initiative-points.test.ts`
  - `action-context.test.ts`
  - `activation-rules.test.ts`
  - `move-action-rules.test.ts`
  - `simple-actions-rally.test.ts`
  - `compulsory-actions-safety.test.ts`
  - `react-actions.test.ts`
  - `morale.test.ts`
  - `morale-cohesion-visibility.test.ts`
  - `bottle-tests.test.ts`
  - `spatial-rules.test.ts`
  - `terrain/TerrainElement.test.ts`
  - `terrain/aperture-rules.test.ts`
  - `terrain/move-validator.test.ts`

### Redundancy Reduction

- Removed low-signal P1 verification files:
  - `p1-visibility-verification.test.ts`
  - `p1-cover-verification.test.ts`
  - `p1-initiative-verification.test.ts`
  - `p1-movement-verification.test.ts`
  - `p1-morale-verification.test.ts`
- Corrected stale QSR secondary-source references to non-existent `rules-react.md`:
  - `docs/qsr/00-index.md`
  - `docs/qsr/03-actions/03.06-wait.md`
  - `docs/qsr/03-actions/03.07-focus.md`

### Source Audit Inventory Progress

- Reclassified secondary guidance source statuses from `⚪ Not Audited` to `⚠️ Partially Audited` for:
  - `src/guides/docs/rules-actions.md` (Wait/Focus/React sections cross-checked)
  - `src/guides/docs/rules-bonus-actions.md` (React/passive-option sections cross-checked)
  - `src/guides/docs/rules-friendly-fire-los.md` (LOF/friendly-fire rules cross-checked)
- Flagged a remaining source/runtime drift for follow-up:
  - Obscured threshold interpretation differs across guidance text, verification expectations, and runtime penalty accumulation (`ranged-combat.ts` / `indirect-ranged-combat.ts`).

---

## Remaining Priority 1 Clause Gaps

Open **P1-labeled** partial clause IDs: **None**

Counts:
- P1-labeled rows in core files: **33**
- Verified/Complete: **33**
- Partial: **0**
- Missing: **0**

---

## Current Source of Truth

- Master index: `docs/qsr/00-index.md`
- P1 runtime tracker: `docs/qsr/P1_RULES_STATUS.md`
- Redundancy tracker: `docs/qsr/REDUNDANCY_REPORT.md`

---

## Known Non-Blocking Warnings

- `src/lib/mest-tactics/ai/core/UtilityScorer.ts`
  - constant reassignment warning
  - duplicate class member warnings
- `src/lib/mest-tactics/ai/stratagems/AIStratagems.ts`
  - duplicate key warning

---

## Next Recommended Actions

1. Publish module-level coverage metrics for P1 rule modules once coverage provider is enabled (currently blocked in this environment: `ENOTFOUND registry.npmjs.org` while installing `@vitest/coverage-v8`).
2. Continue tightening `Not Started`/`Not Audited` inventories as each source audit completes.
3. Expand source-audit coverage outside the current P1 core-file set.
4. Reconcile Obscured-threshold interpretation drift across guidance docs, runtime logic, and verification tests.
