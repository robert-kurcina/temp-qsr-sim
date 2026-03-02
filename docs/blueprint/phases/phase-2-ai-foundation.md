# Phase 2: AI Foundation

> **Extracted from:** `/Users/kitrok/projects/temp-qsr-sim/blueprint.md`
> **Original Lines:** 444-491
> **Extraction Date:** 2026-03-02

---

## Phase 2 (P2-MEDIUM): AI Foundation

**Status:** ✅ **COMPLETE** (Verified 2026-02-27)

**Objective:** Build AI decision-making core that leverages stable QSR-compliant engine.

### 2.1: Utility Scorer (QSR-Aware) ✅

**Components:**
- ✅ Cover quality evaluation (per `rules-cover.md`) - `evaluateCover()`, `evaluateLeanOpportunity()`, `evaluateExposureRisk()`
- ✅ LOS/LOF assessment (per `rules-los.md`, `rules-lof.md`) - `hasLineOfSightBetweenPositions()`
- ✅ Range bands (Short/Optimal/Long/Extreme per `rules-range.md`) - `evaluateRangeWithVisibility()`, `parseWeaponOptimalRangeMu()`
- ✅ Engagement status (per `rules-engagement.md`) - `isEngaged`, `getEngagedEnemies()`
- ✅ Position safety evaluation - `evaluatePositionSafety()`
- ✅ Doctrine-aware scoring - `calculateStratagemModifiers()`, `applyCombinedModifiersToActions()`

**Test Coverage:** 71 tests passing across 5 test files

### 2.2: CharacterAI (Legal Action Selection) ✅

**Components:**
- ✅ Uses `GameManager` action handlers (not direct manipulation)
- ✅ Respects AP costs (2 AP per activation)
- ✅ Waits/Reacts correctly (per `rules-react.md`) - `forecastWaitReact()`, `rolloutWaitReactBranches()`
- ✅ Bonus Action cascades (per `rules-bonus-actions.md`)
- ✅ Action validation before execution

**Test Coverage:** CharacterAI tests passing in `ai.test.ts`

### 2.3: Tactical Doctrine (27 Doctrines) ✅

**Components:**
- ✅ 27 doctrines (Aggressive/Defensive/Balanced × Melee/Ranged/Objective)
- ✅ Stratagem modifiers (action preferences) - `calculateStratagemModifiers()`
- ✅ Doctrine engagement (melee/ranged/balanced) - `getDoctrineEngagement()`
- ✅ Predicted scoring integration - `buildScoringContext()`, `calculateScoringModifiers()`

**Test Coverage:** Stratagem tests in `stratagems.test.ts`, `PredictedScoringIntegration.test.ts`

**Exit Criteria:** ✅ MET
- ✅ AI actions are QSR-legal (validated by GameManager)
- ✅ AI evaluates positions using QSR rules (cover, LOS, range)
- ✅ AI doctrine affects behavior (melee vs ranged preference)
- ✅ 71 AI core tests passing
- ✅ R3: Movement + Cover-Seeking Quality implemented (11 tests)
- ✅ ROF/Suppression scoring integrated (15 tests in `UtilityScorer.ROF.test.ts`)

---

## Document Index

**Blueprint Document Collection**

| Document | Path | Description |
|----------|------|-------------|
| **01 - Overview** | `/docs/blueprint/01-overview.md` | Project overview and core principles |
| **02 - Implementation Plan** | `/docs/blueprint/02-implementation-plan.md` | Full prioritized implementation plan |
| **03 - Current Task** | `/docs/blueprint/03-current-task.md` | Current task and tracking |
| **Phase 0 - QSR Rules** | `/docs/blueprint/phases/phase-0-qsr-rules.md` | Phase 0: QSR Rules Gap Closure |
| **Phase 1 - Engine** | `/docs/blueprint/phases/phase-1-engine.md` | Phase 1: Core Engine Stability |
| **Phase 2 - AI Foundation** | `/docs/blueprint/phases/phase-2-ai-foundation.md` | Phase 2: AI Foundation (this document) |

---

*Extracted from `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (9449 lines)*
