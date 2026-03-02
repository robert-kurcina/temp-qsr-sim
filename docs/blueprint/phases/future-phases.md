# Future Phases (I+)

**Source:** Extracted from `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (Lines 2046+)  
**Extraction Date:** 2026-03-02

---

## Phase 3 (P3-LOW): Web UI for Local Play

**Status:** 📋 **DEFERRED** (After Visual Audit API complete)

**Priority:** **P3-LOW** - Visual Audit provides visualization without UI complexity

### Phase A (P0): Mission Outcome Correctness
**Objective:** Ensure mission results are always resolved correctly and deterministically.

**Status:** ✅ **COMPLETE** (2026-02-26)

**Implementation:**
1. ✅ Added explicit winner/tie resolution to mission outcome computation after VP totals are finalized
2. ✅ Enforce RP tie-break winner (`most RP wins`) when VP remains tied after RP→VP bonus application
3. ✅ Initiative-card tie-breaker already exists as optional setup flag (`initiativeCardTieBreakerOnTie`, default: `false`)
4. ✅ `winnerSideId`, `tie`, `tieSideIds`, and tie-break metadata always populated consistently in mission outputs

**Files Modified:**
- `scripts/run-battles/battle-runner.ts` - Enhanced winner determination with VP → RP → tie logic
- `scripts/run-battles/index.ts` - Updated CLI output to show winner reason and tie information
- `src/lib/mest-tactics/missions/mission-scoring.ts` - Already has `resolveMissionWinner()` with RP tie-break
- `src/lib/mest-tactics/engine/GameController.ts` - Already has `applyInitiativeCardTieBreakerIfEnabled()`

**Exit Criteria:** ✅ MET
- ✅ Unit tests cover: clear VP winner, RP tie-break winner, unresolved tie with optional toggle off, optional Initiative-card tie-break with toggle on
- ✅ `runMission()` returns deterministic outcome metadata for all cases
- ✅ 11 new unit tests in `mission-outcome.test.ts` all passing

### Phase B (P0): AI Runtime Execution Integrity
**Objective:** Make the AI game loop execute legal actions through correct engine APIs and lifecycle.

**Status:** ✅ **COMPLETE** (2026-02-26) - Verified existing implementation

**Verification Results:**
1. ✅ Async decision flow in AI loop - `ai-battle-setup.ts` correctly uses `await aiController.decideAction(context)`
2. ✅ AI executor call-sites - `AIActionExecutor.ts` correctly calls `manager.executeDisengage()`, `manager.executeMove()`, etc.
3. ✅ Activation lifecycle - Both `ai-battle-setup.ts` and `AIGameLoop.ts` properly use `beginActivation()` / `endActivation()`
4. ✅ AI action types alignment - All declared action types in `ActionDecision` have corresponding handlers in `AIActionExecutor.executeDecision()`

**Exit Criteria:** ✅ MET
- ✅ AI loop runs without API/runtime errors
- ✅ AI activation/AP behavior matches manager lifecycle constraints
- ✅ Disengage path, async decision path, and action handlers all verified

### Phase C (P1): Source-Parity Documentation Fixes
**Objective:** Restore one-to-one terminology and rules mapping between `docs/*.txt` and `rules*.md`.

1. Complete `rules-status.md` to match QSR status model.
2. Correct mission terminology mismatches in `rules-missions-qai.md` (Power Nodes, Sabotage Points, Intelligence Caches, Security Switches, etc.).
3. Add missing Mission 19 archetype restrictions.
4. Fix scatter-direction documentation typo in `rules-scatter.md`.
5. Update `qsr-traceability.md` entries that are now stale.

**Exit Criteria**
- Source-to-doc diff pass has no known terminology mismatches.
- `qsr-traceability.md` status entries match current runtime behavior.

### Phase D (P2): Indirect + Reactive Rule Completeness
**Objective:** Complete missing QSR/Indirect rule behavior in runtime.

1. Implement Blind indirect gating (`Spotter` / `Known`) and blind penalties.
2. Apply blind scatter behavior (`unbiased` direction behavior and blind distance handling).
3. Enforce midpoint/arc validation in indirect attack execution.
4. Consolidate react naming to `React`/`Standard react` in engine-facing pathways.
5. Extend declared-weapon constraints across reactive/interrupt/passive attack pathways.

**Exit Criteria**
- New tests cover blind attacks, spotter-known validation, arc validation, and reactive declared-weapon constraints.

### Phase E (P3): Mission Runtime Consolidation
**Objective:** Remove split mission execution paths and route mission runs through one authoritative runtime.

1. Select one authoritative mission execution path and deprecate duplicate pathways.
2. Wire `missionId` into runtime behavior so mission-specific mechanics execute in real runs.
3. Wire mission keys/event-driven deltas to gameplay events instead of test-only paths.
4. Ensure Objective Marker lifecycle is mission-wired (acquire/share/transfer/drop/destroy/scoring hooks).

**Exit Criteria**
- Mission execution for QAI_11..QAI_20 runs through one runtime path.
- Mission-key VP/RP effects are driven by actual mission events.

### Phase F (P4): VERY_LARGE Mission Validation
**Objective:** Validate that AI-vs-AI produces tactically credible outcomes for Mission 11 at scale.

1. Provide a repeatable script/config profile for `VERY_LARGE` + `QAI_11` with both sides using balanced doctrine.
2. Validate movement, pathing, ranged, close combat, react, wait, detect, LOS/LOF under long-run sessions.
3. Emit reproducible battle reports and aggregate outcome metrics.

**Exit Criteria**
- Scripted runs complete without runtime errors.
- Outcome metrics show non-trivial combat resolution (not only movement/holds).

### Phase G (P5): Data + Type Hygiene
**Objective:** Reduce maintenance risk and close known compile/runtime drift.

1. Establish explicit policy for currently-unused `gameData` keys: wire, defer, or remove from runtime expectations.
2. Address high-value TypeScript drift in active runtime + scripts used for validation workflows.
3. Keep unit suite green while improving type safety in the mission/AI paths.

**Exit Criteria**
- Documented disposition for each currently-unused data category.
- Core runtime and required validation scripts are type-clean (or tracked exceptions are explicitly documented).

### Phase H (P6): QSR Unit Test Implementation
**Objective:** Complete unit test coverage for all QSR rules to ensure runtime behavior matches documentation and enables regression testing.

**Priority Order:**

1. **QSR Traits Unit Tests** (P6-HIGH) — ✅ **COMPLETE** (24/24)
   - **Status:** 139 tests passing (39 combat traits + 100 item traits)
   - **Combat Traits:** `src/lib/mest-tactics/traits/combat-traits.test.ts` - 39 tests ✅
   - **Item Traits:** `src/lib/mest-tactics/traits/item-traits.test.ts` - 100 tests ✅
   - **Coverage:** All 24 QSR traits tested
   - **Exit Criteria:** ✅ MET — All 24 QSR traits have unit tests; 100% pass rate

2. **Bonus Actions Unit Tests** (P6-MEDIUM) — ✅ **COMPLETE** (8/8)
   - **Status:** 28 tests passing for all 8 Bonus Actions
   - **Exit Criteria:** ✅ MET — All 8 Bonus Actions tested with clause variations

3. **Passive Player Options Unit Tests** (P6-MEDIUM) — ✅ COMPLETE
   - **Status:** 17 tests passing for all 7 Passive Options
   - **Exit Criteria:** ✅ MET — All options tested with availability conditions

4. **Advanced Traits Unit Tests** (P6-LOW) — **TIERED PRIORITY**
   - **Phase H.4a - Documented Traits (P6-MEDIUM):** 45 traits documented — ✅ **COMPLETE** (2026-02-26)
   - **Phase H.4b - Partial Traits (P6-LOW):** 20 traits with stubs — ✅ **COMPLETE** (2026-02-26)
   - **Phase H.4c - DEFERRED Traits (P6-LOWEST):** 25 traits needing user context

5. **Complex Set Integration Tests** (P6-MEDIUM) — ✅ **COMPLETE** (4/4)
   - **Status:** 26 tests passing

---

## Phase I: Full AI Battle Runner (P1-HIGH)

**Status:** 📋 Planned (Not Started)

**Issue:** Current `scripts/battle-generator.ts` uses simplified "move toward enemy, then attack" AI logic that does NOT test:
- Full CharacterAI decision-making
- Mission objective scoring and completion
- Wait/React/Bonus Action mechanics
- Trait interactions in live gameplay
- Initiative system with IP spending
- Proper action resolution through GameManager
- End-game trigger dice mechanics
- Morale/Bottle Test resolution

**Goal:** Create comprehensive battle runner that exercises full AI System + Mission + Engine integration for testing and validation.

### I.1: Battle Runner Architecture

**Objective:** Replace simplified AI with full CharacterAI + GameManager integration

**Tasks:**
- [ ] **I.1.1:** Integrate CharacterAI.decideAction() for each model activation
- [ ] **I.1.2:** Use GameManager.beginActivation()/endActivation() lifecycle
- [ ] **I.1.3:** Execute actions through GameManager action handlers
- [ ] **I.1.4:** Implement proper Initiative rolling and IP award/spending
- [ ] **I.1.5:** Add Wait status maintenance and React resolution
- [ ] **I.1.6:** Implement Bonus Action cascade spending
- [ ] **I.1.7:** Add End-Game Trigger dice rolling per QSR Line 744-750

**Estimated Effort:** 2-3 days

### I.2: Mission Integration

**Objective:** Run actual mission logic with scoring, objectives, and victory conditions

**Tasks:**
- [ ] **I.2.1:** Integrate mission runtime via GameController.runMission()
- [ ] **I.2.2:** Track Objective Marker actions and scoring
- [ ] **I.2.3:** Calculate VP/RP per turn (predicted and final)
- [ ] **I.2.4:** Implement mission-specific victory conditions
- [ ] **I.2.5:** Add mission event hooks (reinforcements, special rules)
- [ ] **I.2.6:** Generate mission completion report with scoring breakdown

**Estimated Effort:** 2-3 days

### I.3: Comprehensive Instrumentation

**Objective:** Enhance instrumentation to capture full game state for analysis

**Tasks:**
- [ ] **I.3.1:** Capture full dice roll details (Base/Modifier/Wild per test)
- [ ] **I.3.2:** Track trait activation and source (archetype vs item)
- [ ] **I.3.3:** Log situational modifiers applied to each test
- [ ] **I.3.4:** Record AI decision reasoning (utility scores, doctrine influence)
- [ ] **I.3.5:** Track model state changes
- [ ] **I.3.6:** Capture position changes with vectors for movement analysis
- [ ] **I.3.7:** Log LOS/LOF checks and cover determinations
- [ ] **I.3.8:** Export battle logs in analysis-friendly format (JSONL)

**Estimated Effort:** 1-2 days

### I.4: Validation & Analysis Tools

**Objective:** Provide tools to analyze battle results for AI behavior validation

**Tasks:**
- [ ] **I.4.1:** Create battle log viewer (CLI or web-based)
- [ ] **I.4.2:** Implement behavior fingerprinting (action patterns per doctrine)
- [ ] **I.4.3:** Add statistical analysis (hit rates, casualty ratios, turn duration)
- [ ] **I.4.4:** Create regression test suite
- [ ] **I.4.5:** Build performance profiler
- [ ] **I.4.6:** Generate AI behavior reports

**Estimated Effort:** 2-3 days

### I.5: Test Scenarios & Benchmarks

**Objective:** Create standardized test scenarios for validation

**Tasks:**
- [ ] **I.5.1:** Define test scenarios per mission (QAI_11 through QAI_20)
- [ ] **I.5.2:** Create doctrine matchup matrix
- [ ] **I.5.3:** Establish performance benchmarks
- [ ] **I.5.4:** Create regression test baselines
- [ ] **I.5.5:** Document scenario configurations and expected outcomes

**Estimated Effort:** 1-2 days

### Phase I Summary

| Component | Effort | Priority | Dependencies |
|-----------|--------|----------|--------------|
| I.1: Battle Runner Architecture | 2-3 days | P1-HIGH | None |
| I.2: Mission Integration | 2-3 days | P1-HIGH | I.1 |
| I.3: Comprehensive Instrumentation | 1-2 days | P1-HIGH | I.1 |
| I.4: Validation & Analysis Tools | 2-3 days | P2-MEDIUM | I.2, I.3 |
| I.5: Test Scenarios & Benchmarks | 1-2 days | P2-MEDIUM | I.2, I.3 |

**Total Estimated Effort:** 8-13 days

---

## Execution Status Snapshot (2026-02-26)

**Implemented and validated in runtime/tests:**
- Phase A0: initial visual-audit API implemented
- Phase A: A1, A2, A3, A4 ✅
- Phase B: B1, B2, B3 ✅
- Phase C: C1, C2, C3, C4, C5 ✅
- Phase D: D1, D2, D4, D5 ✅
- Phase E: E1, E2, E3, E4 ✅
- Phase F: F2 and F3 ✅
- Phase G: G2 and G3 partially completed

**Active Development:**
- ROF/Suppression/Firelane Spatial Geometry — ✅ **COMPLETE**
- AI ROF Scoring Module — ✅ **COMPLETE**
- AI UtilityScorer Integration — ✅ **COMPLETE**
- Technology Level Filtering — ✅ **COMPLETE**
- QSR Instrumentation System — ✅ **COMPLETE**

**Next Priority:** Phase H Remaining Tasks
- **H4c (P6-LOWEST):** DEFERRED traits awaiting user context
  - Magic/Arcanics (17), Psychology/Behavior (19), Technology/Equipment (8)
  - Movement/Positioning (13), Combat/Attack (10), Status/Condition (10), Special (12)

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
| [phase-r-terrain.md](phase-r-terrain.md) | Phase R: Terrain Placement Refactoring |
| [phase-s-consolidation.md](phase-s-consolidation.md) | Phase S: Battle Script Consolidation |
| [future-phases.md](future-phases.md) | **This file** — Future Phases (I+) |
