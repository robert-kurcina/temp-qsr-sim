# Phase 1: Core Engine Stability

> **Extracted from:** `/Users/kitrok/projects/temp-qsr-sim/blueprint.md`
> **Original Lines:** 311-442
> **Extraction Date:** 2026-03-02

---

## Phase 1 (P1-HIGH): Core Engine Stability

**Status:** ✅ **COMPLETE** (2026-02-27)

**Objective:** Establish stable, QSR-compliant engine that AI can leverage.

### 1.1: Unified Battle Runner

**Status:** ✅ **COMPLETE**

**Objective:** Single authoritative game loop exercising all QSR rules.

**Components:**
- ✅ Proper initiative/IP/activation lifecycle (per `rules-initiative.md`)
- ✅ Mission runtime integration (all 10 missions QAI_11–QAI_20)
- ✅ End-Game Trigger dice mechanics (cumulative d6, Lines 744-750)
- ✅ Morale/Bottle Tests with Breakpoint tracking

**Files:**
- `scripts/run-battles/battle-runner.ts` (consolidated)
- `src/lib/mest-tactics/engine/GameController.ts` (verified complete)
- `src/lib/mest-tactics/missions/mission-runtime-adapter.ts` (verified complete)

**Exit Criteria:** ✅ MET
- ✅ One battle runner supports all game sizes (VERY_SMALL → VERY_LARGE)
- ✅ One battle runner supports all missions (QAI_11 → QAI_20)
- ✅ All QSR mechanics exercised per turn
- ✅ Battle logs capture full game state for audit

---

### 1.2: Intelligent Deployment System

**Status:** ✅ **COMPLETE** (2026-02-27)

**Objective:** QSR-compliant deployment with terrain/objective awareness.

**Why P1-HIGH:** Current even-spacing is **not QSR-compliant** (ignores terrain, objectives, roles). Deployment is a **core engine feature** (pre-game setup), not AI tactical behavior.

**QSR Deployment Rules** (from `MEST.Tactics.QSR.txt`):
- Deploy within 2"/4"/8" of battlefield edge (Small/Medium/Large)
- Models not in LOS of Opposing models, or behind Cover, may start Hidden
- Mission Defender picks edge, Mission Attacker decides who deploys first
- Models must be placed in legal deployment zones per mission

**Components Implemented:**

| Component | Description | QSR Reference |
|-----------|-------------|---------------|
| **DeploymentScorer** | Terrain, objective, role, cohesion scoring | `rules-cover.md`, `rules-los.md` |
| **DeploymentPlacer** | Greedy assignment algorithm | Mission setup rules |
| **DeploymentDoctrine** | 4 doctrines (Balanced, Aggressive, Defensive, Objective) | Tactical doctrine |
| **Alternating Deployment** | QSR-compliant turn-based placement | Deployment sequence |

**Files Created:**
- `src/lib/mest-tactics/engine/DeploymentScorer.ts` - Position evaluation (5 scoring dimensions)
- `src/lib/mest-tactics/engine/DeploymentPlacer.ts` - Assignment algorithm + integration
- Integrated into `scripts/run-battles/battle-runner.ts`

**Scoring Dimensions:**
1. **Cover Score (0-10)** - Terrain type evaluation (blocking, hard, soft, clear)
2. **Objective Proximity (0-10)** - Distance to mission objectives
3. **LOS Quality (0-10)** - Visibility to key battlefield areas
4. **Role Alignment (0-10)** - Melee forward, ranged rear positioning
5. **Squad Cohesion (0-10)** - 4-8" ideal spacing between allies

**Doctrines:**
- **Balanced:** Equal weights on all factors
- **Aggressive:** Forward melee, high objective rush, low cover preference
- **Defensive:** Deep deployment, high cover preference, low aggression
- **Objective:** Maximum objective rush, moderate forward bias

**Integration:**
- `scripts/run-battles/battle-runner.ts` — Intelligent deployment with fallback
- Automatic doctrine mapping from battle config
- Fallback to simple deployment if intelligent fails

**Exit Criteria:** ✅ MET
- ✅ Deployment respects mission zone constraints
- ✅ Models placed with terrain awareness (cover, LOS)
- ✅ Melee/ranged roles affect positioning
- ✅ Doctrine-aware deployment (aggressive vs defensive)
- ✅ **Situational Awareness:** Visibility OR ×3 when Attentive, ×1 when Distracted
- ✅ **Movement Cost:** Rough/Difficult terrain penalized (2× movement cost)
- ✅ **Impassable Terrain:** Blocked from candidate positions
- ✅ Unit tests verify deployment quality metrics (existing: 23 tests in `deployment-system.test.ts`)
- ✅ **1748 tests passing** (full suite green)

**Scoring Dimensions (6 total):**
1. **Cover Score (0-10)** - Terrain type (blocking, hard, soft, rough, difficult, clear)
2. **Objective Proximity (0-10)** - Distance to mission objectives
3. **LOS Quality (0-10)** - Visibility with Situational Awareness (×3 Attentive, ×1 Distracted)
4. **Role Alignment (0-10)** - Melee forward, ranged rear positioning
5. **Squad Cohesion (0-10)** - 4-8" ideal spacing between allies
6. **Movement Cost (0-10)** - Terrain movement penalty (Rough/Difficult = 2× cost)

---

### 1.3: Mission Runtime Verification

**Status:** ✅ **COMPLETE** (2026-02-27)

**Objective:** Verify all 10 missions (QAI_11–QAI_20) produce QSR-compliant outcomes with intelligent deployment.

**Verification Results:**

| Mission | Name | Sides | Status | Notes |
|---------|------|-------|--------|-------|
| **QAI_11** | Elimination | 2 | ✅ Verified | VP/RP scoring works with intelligent deployment |
| **QAI_12** | Convergence | 2-4 | ✅ Verified | Reinforcement waves, POI control, multi-side support |
| **QAI_13** | Assault | 2 | ✅ Verified | Sabotage actions, defender reinforcements (tests pass) |
| **QAI_14** | Dominion | 2 | ✅ Verified | Beacon control, courier rules, sanctuary zones |
| **QAI_15** | Recovery | 2 | ✅ Verified | Intelligence cache placement, extraction (tests pass) |
| **QAI_16** | Escort | 2 | ✅ Verified | VIP protection, extraction zones (tests pass) |
| **QAI_17** | Triumvirate | 3-4 | ✅ Verified | 3-side free-for-all with intelligent deployment |
| **QAI_18** | Stealth | 2 | ✅ Verified | Covert operations, detection (tests pass) |
| **QAI_19** | Defiance | 2 | ✅ Verified | Hold position, wave defense (tests pass) |
| **QAI_20** | Breach | 2 | ✅ Verified | Breakthrough, fortification (tests pass) |

**Test Coverage:**
- **240 mission tests passing** across 12 test files
- All missions validated with intelligent deployment integration
- Multi-side support (2-4 sides) verified

**Exit Criteria:** ✅ MET
- ✅ All 10 missions validated against QSR mission specs
- ✅ Mission-specific VP/RP awarded correctly
- ✅ Mission events (reinforcements, special rules) trigger correctly
- ✅ Intelligent deployment integrates with mission-specific zones
- ✅ 2-4 side support working (QAI_12, QAI_17 verified)

---

## Document Index

**Blueprint Document Collection**

| Document | Path | Description |
|----------|------|-------------|
| **01 - Overview** | `/docs/blueprint/01-overview.md` | Project overview and core principles |
| **02 - Implementation Plan** | `/docs/blueprint/02-implementation-plan.md` | Full prioritized implementation plan |
| **03 - Current Task** | `/docs/blueprint/03-current-task.md` | Current task and tracking |
| **Phase 0 - QSR Rules** | `/docs/blueprint/phases/phase-0-qsr-rules.md` | Phase 0: QSR Rules Gap Closure |
| **Phase 1 - Engine** | `/docs/blueprint/phases/phase-1-engine.md` | Phase 1: Core Engine Stability (this document) |
| **Phase 2 - AI Foundation** | `/docs/blueprint/phases/phase-2-ai-foundation.md` | Phase 2: AI Foundation |

---

*Extracted from `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (9449 lines)*
