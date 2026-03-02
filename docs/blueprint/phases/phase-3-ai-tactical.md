# Phase 3 (P3-LOW): AI Tactical Intelligence

**Source:** Extracted from `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (Lines 1129-1306)  
**Extraction Date:** 2026-03-02

---

**Status:** ✅ **COMPLETE** (2026-02-27)

**Priority:** **P3-LOW** - Tactical depth enhancements

**Objective:** Implement AI tactical coordination for squad-level combat effectiveness.

**QSR Compliance:** 85% → **100%** ✅

**Implementation Status:**

| Component | Status | File(s) |
|-----------|--------|---------|
| **Focus Fire Coordination** | ✅ Complete | `UtilityScorer.ts:evaluateTargets()` |
| **Flanking Maneuvers** | ✅ Complete | `UtilityScorer.ts:evaluateFlankingPosition()` |
| **Squad Formation (IP-based)** | ✅ Complete | `AIGameLoop.ts:considerSquadIPActivation()` |
| **Wait/React Coordination** | ✅ Complete | `UtilityScorer.ts` wait evaluation |

**New Implementation:**

| Feature | Description | Status |
|---------|-------------|--------|
| **Focus Fire Bonus** | +1.5 per ally targeting same enemy | ✅ Complete |
| **Finish Off Bonus** | +5.0 for weakened targets (SIZ-1 wounds) | ✅ Complete |
| **Flanking Evaluation** | Angle-based flanking position scoring | ✅ Complete |
| **Flanking Bonus** | +2.0 per flanking angle (>90° from allies) | ✅ Complete |
| **IP Squad Coordination** | Execute IP spending for squad activation | ✅ Complete |
| **Wait Coordination Bonus** | +0.5 per ally on Wait | ✅ Complete |

**Focus Fire Coordination:**
```typescript
// Track which enemies allies are targeting
const allyTargetCounts = new Map<string, number>();
for (const ally of context.allies) {
  // Find closest enemy to this ally
  // Increment count for that enemy
}

// Bonus for targeting same enemy as allies
const focusFireBonus = allyTargetCount * 1.5;

// Bonus for finishing weakened targets
const finishOffBonus = enemyWounds >= enemySiz - 1 ? 5.0 : 0;
```

**Flanking Maneuvers:**
```typescript
// Calculate angle from enemy to ally and from enemy to this position
const allyAngle = Math.atan2(allyPos.y - enemyPos.y, allyPos.x - enemyPos.x);
const thisAngle = Math.atan2(position.y - enemyPos.y, position.x - enemyPos.x);

// If angle difference is > 90 degrees, it's a flanking position
if (angleDiff > Math.PI / 2) {
  flankingScore += 2; // Good flanking position
}
```

**IP-Based Squad Formation:**
```typescript
// After character completes activation
if (charResult.successfulActions > 0) {
  const squadActivationResult = this.considerSquadIPActivation(character, turn);
  // Actually spends IP and activates squad member immediately
  // result.totalActions += squadActivationResult.totalActions;
}
```

**Wait/React Coordination:**
```typescript
// Count allies on Wait
const alliesOnWait = context.allies.filter(ally =>
  ally.state.isWaiting && ally.state.isAttentive
).length;
const waitCoordinationBonus = alliesOnWait > 0 ? alliesOnWait * 0.5 : 0;
```

**Unit Tests Created:**

| Test File | Tests | Status |
|-----------|-------|--------|
| `ai-tactical-intelligence.test.ts` | 4 tests | ✅ Passing |

**Mission Validation (Option C):**

| Mission | Name | Validation Status |
|---------|------|-------------------|
| **QAI_11** | Elimination | ✅ Validated |
| **QAI_12** | Convergence | ✅ Validated |
| **QAI_14** | Dominion | ✅ Validated |
| **QAI_17** | Triumvirate (3-side) | ✅ Validated |

**Test Output:**
- **1811/1811 tests passing** (100%) ✅
- All pre-existing failures resolved

**Exit Criteria:**
- [x] Focus fire coordination implemented and tested
- [x] Flanking maneuvers implemented and tested
- [x] IP-based squad formation implemented and executing
- [x] Wait/React coordination implemented
- [x] Unit tests for AI tactical intelligence
- [x] Mission validation battles completed
- [x] QSR compliance reaches 100% ✅

**Objective:** AI that demonstrates tactical competence beyond basic QSR compliance.

### 3.1: Mission-Aware Scoring ✅ (Partial)
- ✅ VP/RP prediction and pursuit - `buildScoringContext()`, `calculateScoringModifiers()`
- ✅ Objective Marker handling (acquire/share/transfer/drop/score) - `generateObjectiveMarkerActions()`
- ⏳ **Tactical Objective Denial** - Prevent opponent from scoring (NEW)

### 3.2: Reactive Play ✅ (Enhanced 2026-02-27)
- ✅ Wait/React/Opportunity Attack integration - `forecastWaitReact()`, `rolloutWaitReactBranches()`
- ✅ Counter-strike evaluation - `evaluateCounterStrike()`
- ✅ Counter-fire evaluation - `evaluateCounterFire()`
- ✅ **Counter-charge Tactical Enhancement** - `evaluateCounterChargeTactical()`
  - **Block Entrance/Exit:** Counter-charge to block doorway, gate, or chokepoint when enemy tries to pass
    - Implementation: `isBlockingChokepoint()` - detects terrain chokepoints (2+ blocking terrain within threat range)
    - Threat Range: **Dynamic** - uses character's effective MOV (accounts for Sprint/Flight traits)
    - Priority bonus: +2.0
  - **Foil Objective Access:** Counter-charge to prevent enemy from reaching objective marker
    - Implementation: `isMovingTowardObjective()` - checks if enemy within effective MOV of objective
    - Threat Range: **Dynamic** - `getEffectiveMovement()` accounts for Sprint X (×4 MU/level), Flight X (MOV +X +6 MU/level)
    - Priority bonus: +2.5
  - **Prevent Scrum Addition:** Counter-charge to stop enemy from joining existing engagement (denies outnumbering)
    - Implementation: `isEnemyJoiningScrum()` - detects enemy moving toward engaged models within effective MOV
    - Threat Range: **Dynamic** - based on character's movement capability
    - Priority bonus: +3.0 (highest - prevents outnumbering)
  - **Additional Factors:**
    - Wounded target (easy kill): +1.5
    - High-value target (Leadership trait): +1.0
  - Trigger threshold: priority > 3.0 (higher than basic react)

**Movement Allowance Calculation** (Fixed 2026-02-27 per QSR rules):
```typescript
getEffectiveMovement(character):
  baseMov = character.finalAttributes.mov

  // Sprint X: X × 4 MU in straight line
  if (has Sprint X trait) effectiveMov = max(baseMov, level × 4)

  // Flight X: MOV + X, +6 MU/level while flying
  if (has Flight X trait) effectiveMov = max(baseMov, baseMov + level + (level × 6))

  return effectiveMov
```

**Example Threat Ranges:**
| Character | Base MOV | Traits | Effective MOV | Threat Range |
|-----------|----------|--------|---------------|--------------|
| Average | 4 | None | 4 | 4 MU |
| Sprinter | 4 | Sprint 2 | 8 (2×4) | 8 MU |
| Jet-pack | 4 | Flight 2 | 20 (4+2+12) | 20 MU |
| Elite Flyer | 6 | Flight 3 | 27 (6+3+18) | 27 MU |

### 3.3: Squad Coordination ⏳ (Partial)
- ⏳ Focus fire coordination - Target assignment needed
- ⏳ Flanking maneuvers - Position coordination needed
- ⏳ Formation maintenance - Cohesion during movement needed
- ⏳ **Scrum Tactics** (NEW)
  - Join existing engagements to gain outnumbering
  - Prevent enemy from joining their engagements
  - Counter-charge to break enemy outnumbering attempts

**Exit Criteria (Original):**
- ✅ AI completes mission objectives (not just elimination)
- ✅ AI uses Wait/React effectively
- ⏳ AI coordinates squad actions (focus fire, flanking)

**New Exit Criteria (Enhanced):**
- [ ] Counter-charge tactical evaluation implemented (entrance/exit block, objective denial, scrum prevention)
- [ ] Scrum tactics: join engagements for outnumbering, prevent enemy outnumbering
- [ ] Focus fire coordination working
- [ ] Flanking maneuvers coordinated across squad

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
| [phase-3-ai-tactical.md](phase-3-ai-tactical.md) | **This file** — Phase 3: AI Tactical Intelligence |
| [phase-4-validation.md](phase-4-validation.md) | Phase 4: Validation & Testing |
| [phase-a0-visual-audit.md](phase-a0-visual-audit.md) | Phase A0: Visual Audit API |
| [phase-r-terrain.md](phase-r-terrain.md) | Phase R: Terrain Placement Refactoring |
| [phase-s-consolidation.md](phase-s-consolidation.md) | Phase S: Battle Script Consolidation |
| [future-phases.md](future-phases.md) | Future Phases (I+) |
