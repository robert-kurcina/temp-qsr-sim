# Hardcoded Distances Audit

**Date:** 2026-02-27  
**Purpose:** Identify hardcoded distances/ranges that should be dynamic based on QSR rules (Movement Allowance, Visibility, Traits, etc.)

---

## Summary

| Category | Status | Count | Priority |
|----------|--------|-------|----------|
| ✅ **Fixed** | Dynamic (uses MOV/Visibility) | 8 | - |
| ⚠️ **Needs Fix** | Hardcoded values | 15 | P2-MEDIUM |
| ℹ️ **Acceptable** | Rule-defined constants | 12 | - |

---

## ✅ Fixed (Dynamic Values)

### Counter-charge Tactical Evaluation
**File:** `src/lib/mest-tactics/ai/tactical/ReactsAndBonusActions.ts`

| Function | Before | After | Notes |
|----------|--------|-------|-------|
| `isBlockingChokepoint()` | Fixed 2 MU | `min(6, effective MOV)` | Uses character's movement |
| `isMovingTowardObjective()` | Fixed 6 MU | `effective MOV` | Accounts for Sprint/Flight |
| `isEnemyJoiningScrum()` | Fixed 6 MU | `effective MOV` | Prevents outnumbering |

**Implementation:**
```typescript
getEffectiveMovement(character):
  baseMov = character.finalAttributes.mov
  if (has Sprint X) effectiveMov = max(baseMov, level × 4)
  if (has Flight X) effectiveMov = max(baseMov, baseMov + level + (level × 6))
  return effectiveMov
```

### LOS Quality Evaluation
**File:** `src/lib/mest-tactics/engine/DeploymentScorer.ts`

| Function | Before | After | Notes |
|----------|--------|-------|-------|
| `evaluateLOSQuality()` | Fixed distances [8, 16, 24] | Filtered by `effectiveVisibilityOR` | Uses Situational Awareness |

**Implementation:**
```typescript
effectiveVisibilityOR = lighting.visibilityOR × awarenessMultiplier
// awarenessMultiplier: ×3 Attentive, ×2 Ready, ×1 Distracted
checkDistances = [8, 16, 24].filter(d => d <= effectiveVisibilityOR)
```

---

## ⚠️ Needs Fix (Hardcoded Values)

### 1. Cohesion / Morale / Rally
**Priority:** P2-MEDIUM

| File | Line | Hardcoded | Should Be | QSR Reference |
|------|------|-----------|-----------|---------------|
| `vip-system.ts` | 251 | `cohesionRangeMu ?? 4` | `visibilityOR / 2` (max 8) | Cohesion = half Visibility |
| `leader-identification.ts` | ? | `awarenessRange = visibilityOR × 3` | ✅ Correct | Situational Awareness |
| `morale.ts` | ? | `cohesion = 4 MU` | `visibilityOR / 2` | Cohesion range |
| `rally-action.ts` | ? | `cohesion = 4 MU` | `visibilityOR / 2` | Rally range |

**Fix Required:**
```typescript
// Current
const cohesion = options.cohesionRangeMu ?? 4;

// Should be
const cohesion = Math.min(8, (visibilityOrMu ?? 16) / 2);
```

### 2. Hidden / Detect
**Priority:** P2-MEDIUM

| File | Line | Hardcoded | Should Be | QSR Reference |
|------|------|-----------|-----------|---------------|
| `concealment.ts` | ? | `visibilityOrMu ?? 16` | Parameter from context | Visibility varies by lighting |
| `concealment.ts` | ? | Detection OR hardcoded | `visibilityOR` | Detection limited by Visibility |

**Fix Required:**
- Pass `visibilityOrMu` from game context (lighting conditions)
- Detection tests should use current Visibility OR, not default 16

### 3. ROF / Suppression / Firelane
**Priority:** P2-LOW (Advanced Rules)

| File | Line | Hardcoded | Should Be | QSR Reference |
|------|------|-----------|-----------|---------------|
| `rof-suppression-spatial.ts` | ? | `suppressionRange = 1 MU` | ✅ Rule-defined | Suppression is always 1" |
| `rof-suppression-spatial.ts` | ? | `markerSpacing = 1 MU` | ✅ Rule-defined | ROF markers 1" apart |
| `rof-suppression-spatial.ts` | ? | `fofArcWidth = 90°` | ✅ Rule-defined | Firelane FOF is 90° arc |

**Note:** These are **rule-defined constants**, not hardcoded values needing fixes.

### 4. Pathfinding
**Priority:** P2-LOW

| File | Line | Hardcoded | Should Be | QSR Reference |
|------|------|-----------|-----------|---------------|
| `PathfindingEngine.ts` | 48 | `defaultGridResolution = 0.5` | ✅ Acceptable | Grid resolution for A* |
| `PathfindingEngine.ts` | 49 | `MAX_GRID_CACHE_ENTRIES = 32` | ✅ Acceptable | Performance optimization |
| `PathfindingEngine.ts` | 50 | `MAX_PATH_CACHE_ENTRIES = 8000` | ✅ Acceptable | Performance optimization |

**Note:** These are **implementation constants**, not QSR rules.

### 5. Squad Cohesion (Deployment)
**Priority:** P2-MEDIUM

| File | Line | Hardcoded | Should Be | QSR Reference |
|------|------|-----------|-----------|---------------|
| `DeploymentScorer.ts` | 417-426 | `ideal cohesion: 4-8"` | `visibilityOR / 4` to `visibilityOR / 2` | Cohesion scales with Visibility |

**Fix Required:**
```typescript
// Current
const idealCohesionMin = 4;
const idealCohesionMax = 8;

// Should be
const visibilityOrMu = lighting.visibilityOR ?? 16;
const idealCohesionMin = visibilityOrMu / 4;  // 4 MU at Day Clear
const idealCohesionMax = visibilityOrMu / 2;  // 8 MU at Day Clear
```

### 6. Wait Status - Reactive Range
**Priority:** P2-MEDIUM

| File | Line | Hardcoded | Should Be | QSR Reference |
|------|------|-----------|-----------|---------------|
| `wait-action.ts` | ? | `reactRange = 16 MU` | `visibilityOR` | Wait react limited by Visibility |
| `HierarchicalFSM.ts` | ? | `waitRefBonus` hardcoded | Based on REF attribute | Wait REF bonus |

### 7. Objective Marker Interactions
**Priority:** P2-MEDIUM

| File | Line | Hardcoded | Should Be | QSR Reference |
|------|------|-----------|-----------|---------------|
| `objective-markers.ts` | ? | `acquireRange = 1 MU` | ✅ Rule-defined | Base contact required |
| `objective-markers.ts` | ? | `shareRange = 4 MU` | `visibilityOR / 4` | Share within Cohesion |
| `objective-markers.ts` | ? | `transferRange = 1 MU` | ✅ Rule-defined | Base contact required |

### 8. Group Actions
**Priority:** P2-MEDIUM

| File | Line | Hardcoded | Should Be | QSR Reference |
|------|------|-----------|-----------|---------------|
| `group-actions.ts` | ? | `cohesionCheck = 4 MU` | `visibilityOR / 4` | Group cohesion |
| `group-actions.test.ts` | 138-139 | `within 4 MU` | `visibilityOR / 4` | Test uses hardcoded value |

### 9. VIP Detection
**Priority:** P2-MEDIUM

| File | Line | Hardcoded | Should Be | QSR Reference |
|------|------|-----------|-----------|---------------|
| `vip-system.ts` | ? | `detectionRange` | `visibilityOR` | VIP detection by Visibility |
| `vip-system.ts` | ? | `alertLevel thresholds` | Based on `visibilityOR` | Alert levels scale with Visibility |

### 10. Leadership / Awareness Range
**Priority:** P1-HIGH (Already Correct)

| File | Line | Value | Status | QSR Reference |
|------|------|-------|--------|---------------|
| `leader-identification.ts` | ? | `awarenessRange = visibilityOR × 3` | ✅ Correct | Situational Awareness |
| `leader-identification.ts` | ? | `awarenessRange = visibilityOR × 1` (Distracted) | ✅ Correct | Distracted penalty |

---

## ℹ️ Acceptable (Rule-Defined Constants)

These values are **defined by QSR rules** and should remain constant:

| Constant | Value | Source | Notes |
|----------|-------|--------|-------|
| **Suppression Range** | 1 MU | `rules-advanced-suppression.md` | Fixed by rule |
| **ROF Marker Spacing** | 1 MU | `rules-advanced-rof.md` | Fixed by rule |
| **Firelane FOF Arc** | 90° | `rules-advanced-firelane.md` | Fixed by rule |
| **Base Contact** | 0 MU (touching) | QSR Line 108 | Fixed by rule |
| **Melee Range** | Base contact | QSR Line 108 | Fixed by rule |
| **Point-blank Range** | OR / 2 | QSR Line 1150 | Calculated from weapon OR |
| **Max ORM** | 3 | QSR Line 1148 | Fixed by rule |
| **End-Game Trigger** | 1-3 on d6 | QSR Line 748 | Fixed by rule |

---

## Remediation Plan

### Phase 2.1 (P2-MEDIUM): Visibility-Aware Ranges
**Estimated Effort:** 2-3 days

1. **Cohesion Range** - Fix in `vip-system.ts`, `morale.ts`, `rally-action.ts`
   - Change from hardcoded 4 MU to `visibilityOR / 2`
   - Update tests to use dynamic visibility

2. **Detection Range** - Fix in `concealment.ts`
   - Pass `visibilityOrMu` from game context
   - Update Hide/Detect tests

3. **Squad Cohesion (Deployment)** - Fix in `DeploymentScorer.ts`
   - Change ideal cohesion to scale with visibility
   - Update deployment tests

4. **Wait Reactive Range** - Fix in `wait-action.ts`
   - Use `visibilityOR` instead of hardcoded 16 MU

5. **Objective Marker Share Range** - Fix in `objective-markers.ts`
   - Change from 4 MU to `visibilityOR / 4`

6. **Group Actions Cohesion** - Fix in `group-actions.ts`
   - Change from 4 MU to `visibilityOR / 4`

7. **VIP Detection** - Fix in `vip-system.ts`
   - Use `visibilityOR` for detection thresholds

### Phase 2.2 (P2-LOW): Advanced Rules Verification
**Estimated Effort:** 1-2 days

1. **ROF/Suppression/Firelane** - Verify constants match QSR
2. **Pathfinding constants** - Document as implementation details
3. **Add unit tests** for visibility-aware ranges

---

## Testing Strategy

For each fix:

1. **Unit Tests** - Test with different visibility conditions:
   - Day Clear (16 MU)
   - Twilight (8 MU)
   - Night Full Moon (4 MU)
   - Night New Moon (1 MU)

2. **Integration Tests** - Verify AI behavior changes with visibility:
   - Cohesion tighter at night
   - Detection harder at night
   - Wait less effective at night

3. **Battle Validation** - Run battles with different lighting:
   ```bash
   npm run cli -- --lighting "Day, Clear"
   npm run cli -- --lighting "Night, Full Moon"
   ```

---

## QSR References

| Rule | QSR Line | Description |
|------|----------|-------------|
| **Cohesion** | Line 1168 | Half Visibility, max 8 MU |
| **Situational Awareness** | Line 720 | Visibility ×3 (Attentive), ×1 (Distracted) |
| **Visibility OR** | Line 1142 | Day Clear 16 MU, Twilight 8 MU, Night 4 MU |
| **Detection** | Line 978 | Limited by Visibility OR |
| **Hide** | Line 985 | Requires Cover, broken by LOS |

---

## Summary

**Total Issues Found:** 15 hardcoded values needing fixes  
**Priority:** P2-MEDIUM (core stability, not blockers)  
**Estimated Effort:** 3-5 days  
**Risk:** Low (backwards compatible, improves QSR compliance)

**Recommendation:** Fix in Phase 2.1 before UI development begins.
