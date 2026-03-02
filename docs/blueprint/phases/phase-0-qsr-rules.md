# Phase 0: QSR Rules Gap Closure

> **Extracted from:** `/Users/kitrok/projects/temp-qsr-sim/blueprint.md`
> **Original Lines:** 269-309
> **Extraction Date:** 2026-03-02

---

## Phase 0 (P0-CRITICAL): QSR Rules Gap Closure

**Status:** ✅ **COMPLETE** (2026-02-27)

**Objective:** Close critical QSR rules compliance gaps before building AI on unstable foundations.

**Rationale:** Tests and AI are useless if the underlying rules implementation is incorrect.

### P0-HIGH Gaps (Must Complete First) - ALL COMPLETE ✅

| Gap | QSR Reference | Status | Implementation |
|-----|---------------|--------|----------------|
| **IP Award Mechanics** | Lines 691-692 | ✅ Fixed | Winner gets (score - lowest), others get 1 IP per carry-over Base die |
| **Initiative Card Mechanics** | Mission rules | ✅ Complete | Full implementation with tie-break, transfer, return penalty |
| **Multiple Weapons Penalty** | Combat rules | ✅ Complete | -1m for consecutive same weapon use |
| **Natural Weapons Multi-Attack** | Combat rules | ✅ Complete | Exemption from Delay token on multi-attack |

### P0-MEDIUM Gaps - ALL COMPLETE ✅

| Gap | QSR Reference | Status | Implementation |
|-----|---------------|--------|----------------|
| **Optimized Initiative** | Turn 1 rule | ✅ Complete | +1 Base die for side with least BP (Turn 1 only) |
| **Situational Awareness** | INT bonus rule | ✅ Complete | Leader LOS check for INT bonus when <50% force remaining |

### P0-LOW Gaps (Edge Cases) - ALL COMPLETE ✅

| Gap | QSR Reference | Status | Implementation |
|-----|---------------|--------|----------------|
| **Multi-Side Initiative (3+)** | QAI_12, QAI_17 | ✅ Complete | Full initiative order for 3-4 sides |
| **Building Entry/Navigation** | Terrain rules | ✅ Complete | Building entry, navigation, combat rules |

**Exit Criteria:** ✅ MET
- ✅ All P0-HIGH gaps closed with unit tests
- ✅ QSR traceability matrix shows 100% core rules coverage
- ✅ Battle runner produces QSR-compliant game states for all missions
- ✅ **1748 tests passing** (full suite green)

**Files Modified:**
- `src/lib/mest-tactics/engine/GameManager.ts` - Fixed IP award to count carry-over Base dice correctly
- `src/lib/mest-tactics/initiative/initiative-card.ts` - Already complete
- `src/lib/mest-tactics/traits/combat-traits.ts` - Already complete (Multiple Weapons, Natural Weapons)

---

## Document Index

**Blueprint Document Collection**

| Document | Path | Description |
|----------|------|-------------|
| **01 - Overview** | `/docs/blueprint/01-overview.md` | Project overview and core principles |
| **02 - Implementation Plan** | `/docs/blueprint/02-implementation-plan.md` | Full prioritized implementation plan |
| **03 - Current Task** | `/docs/blueprint/03-current-task.md` | Current task and tracking |
| **Phase 0 - QSR Rules** | `/docs/blueprint/phases/phase-0-qsr-rules.md` | Phase 0: QSR Rules Gap Closure (this document) |
| **Phase 1 - Engine** | `/docs/blueprint/phases/phase-1-engine.md` | Phase 1: Core Engine Stability |
| **Phase 2 - AI Foundation** | `/docs/blueprint/phases/phase-2-ai-foundation.md` | Phase 2: AI Foundation |

---

*Extracted from `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (9449 lines)*
