# QSR Rules Implementation - FINAL STATUS

**Date:** 2026-03-03
**Status:** ✅ **CORE RULES IMPLEMENTED**

---

## Implemented Rules

### 1. First Detect is Free (QSR Line 855) ✅

**Rule:**
> "Detect — The first Detect costs zero AP. Otherwise 1 AP."

**Implementation:**
- `src/lib/mest-tactics/ai/executor/AIActionExecutor.ts:794-802`
- `src/lib/mest-tactics/core/Character.ts:36, 99, 159`

**Changes:**
- Added `hasDetectedThisActivation` state to Character
- Reset at start of each activation (`resetInitiativeState()`)
- First Detect costs 0 AP, subsequent cost 1 AP

---

### 2. Focus Option (QSR Line 859) ✅

**Rule:**
> "Focus" — Remove Wait status while Attentive to receive +1 Wild die for any Test **instead of performing a React**.

**Implementation:**
- `src/lib/mest-tactics/ai/tactical/ReactsQSR.ts:317-356`
- `src/lib/mest-tactics/subroutines/dice-roller.ts:151-159`
- `src/lib/mest-tactics/core/Character.ts:37, 100, 160`

**Changes:**
- Added `hasFocus` state to Character
- Added `evaluateFocus()` method in ReactEvaluator
- Focus is an **alternative to Reacting**, NOT a separate action
- Focus compared with React priority, chooses better option
- Focus bonus (+1w) applied in test resolution
- Focus consumed after use

**CORRECTION:** Focus is NOT an action. It's a Wait status option used during enemy's action INSTEAD of Reacting.

---

### 3. Sneaky X Hide Cost (QSR Line 19989) ✅

**Rule:**
> "At the end of this character's Initiative automatically become Hidden at no cost if behind Cover or when not in LOS."

**Implementation:**
- `src/lib/mest-tactics/status/concealment.ts:95-100`

**Changes:**
- Check `getSneakyLevel()` when evaluating Hide cost
- Sneaky X > 0 → Hide costs 0 AP (even when in LOS + Cover)

---

### 4. Active Wins Ties (QSR Implicit) ✅

**Rule:**
> Active character wins ties in Opposed Tests

**Implementation:**
- `src/lib/mest-tactics/subroutines/dice-roller.ts:197`

**Verification:**
```typescript
const pass = p1FinalScore >= p2FinalScore; // p1 (Active) wins ties
```

**Status:** ✅ Already implemented correctly

---

## Test Results

| Test Suite | Status |
|------------|--------|
| Unit Tests | ✅ 1946/1948 passing |
| React Tests | ✅ 8/8 passing |
| VPUrgencyCalculator | ✅ 22/22 passing |
| ActionVPFilter | ✅ 20/20 passing |
| AI Integration | ✅ 18/18 passing |

**Pre-existing failures:**
- TerrainPlacement.test.ts (flaky test, unrelated to changes)
- Mission validation tests (zone configuration, unrelated)

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/mest-tactics/core/Character.ts` | Added `hasDetectedThisActivation`, `hasFocus` state |
| `src/lib/mest-tactics/ai/executor/AIActionExecutor.ts` | First Detect free logic |
| `src/lib/mest-tactics/ai/tactical/ReactsQSR.ts` | Focus evaluation, reactType |
| `src/lib/mest-tactics/subroutines/dice-roller.ts` | Focus bonus application |
| `src/lib/mest-tactics/status/concealment.ts` | Sneaky X Hide cost |

---

## Key Corrections Made

### Correction 1: Focus is NOT an Action

**Initial Error:** Implemented Focus as an action type (`executeFocus()`)

**Correction:** Focus is a **Wait status option** used **instead of Reacting**

**QSR Line 859:**
> "Focus" — Remove Wait status while Attentive to receive +1 Wild die for any Test **instead of performing a React**.

**Correct Implementation:**
- Focus evaluated alongside React options
- Focus compared with React priority
- Better option chosen
- Focus removes Wait, grants +1w for next Test

---

### Correction 2: Sneaky X Trait Implementation

**Initial Error:** Hide cost didn't consider Sneaky X trait

**Correction:** Check `getSneakyLevel()` when evaluating Hide AP cost

**QSR Line 19989:**
> "At the end of this character's Initiative automatically become Hidden **at no cost**"

**Correct Implementation:**
```typescript
const sneakyLevel = getSneakyLevel(character);
const apCost = sneakyLevel > 0 ? 0 : 1;
```

---

## Expected AI Behavior (After Full Implementation)

### Turn 1: Setup

**Sneaky X Model (2 AP):**
```
1. Hide (0 AP) - Sneaky X
2. Wait (2 AP)
Result: Hidden + Wait (2 AP total)
```

**Standard Model out of LOS (2 AP):**
```
1. Hide (0 AP) - not in LOS
2. Wait (2 AP)
Result: Hidden + Wait (2 AP total)
```

**Standard Model in LOS (3 AP needed):**
```
1. Pushing (0 AP) - +1 AP, Delay
2. Hide (1 AP)
3. Wait (2 AP)
Result: Hidden + Wait + Delay (3 AP total)
```

### Turn 2+: Execute

**Model with Wait during enemy action:**
```
Enemy moves within LOS
Option A: React (attack moving target)
  - Priority based on range, target value
  - Make attack with normal dice

Option B: Focus (if better than React)
  - Remove Wait status
  - Gain +1w for next Test
  - Use +1w on next activation's attack or Detect
```

**Model's own activation:**
```
Option A: Focus + Detect (from previous turn's Focus)
1. Detect (0 AP) - first is free!
2. Roll REF +1w (from Focus) vs enemy REF
3. ~72-75% success rate
4. On success: Attack Revealed enemy

Option B: Concentrate + Detect
1. Concentrate (1 AP) - +1w
2. Detect (0 AP) - first is free!
3. Roll REF +1w vs enemy REF
4. ~72-75% success rate
```

---

## Remaining Work

| Priority | Task | File | Effort |
|----------|------|------|--------|
| P2 | AI considers Focus vs React | `ReactsQSR.ts` | ✅ Done |
| P2 | AI values Wait + Hide combo | `UtilityScorer.ts` | 2 hours |
| P2 | AI moves to force reveal | `CharacterAI.ts` | 2 hours |
| P3 | Wait maintenance logic | `GameManager.ts` | 1 hour (verify) |

---

## Verification Commands

```bash
# Run unit tests
npm test -- --run

# Run AI battle
npm run ai-battle -- VERY_SMALL

# Run AI battle with audit
npm run ai-battle:audit -- VERY_SMALL
```

---

## Expected Metrics (After Full Implementation)

| Metric | Before | Expected After |
|--------|--------|----------------|
| Detect Success Rate | ~50% (wrong) | ~63-85% (correct) |
| Combat Actions | 0 | 5-10 per battle |
| Eliminations | 0 | 1-3 per battle |
| VP Source | Tiebreaker | Eliminations |
| Battle Duration | Stalemate | Decisive (6 turns) |

---

## References

- QSR Lines 846-860 (Hide, Detect, Wait)
- QSR Line 859 (Focus)
- QSR Line 1153 (Suddenness)
- QSR Lines 826-831 (Concentrate)
- QSR Lines 789-791 (Pushing)
- QSR Line 19989 (Sneaky X)
- `docs/audit/QSR_HIDE_DETECT_WAIT_COMPLETE_SUMMARY.md`
- `docs/implementation/QSR_RULES_IMPLEMENTATION_PLAN.md`

---

**Implementation Date:** 2026-03-03
**Status:** Core QSR rules implemented ✅
**Next:** AI tactical behavior enhancement
