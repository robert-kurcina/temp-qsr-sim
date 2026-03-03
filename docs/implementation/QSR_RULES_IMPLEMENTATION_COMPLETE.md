# QSR Rules Implementation - COMPLETE

**Date:** 2026-03-03
**Status:** ✅ **IMPLEMENTED**

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

**Code:**
```typescript
// QSR Line 855: First Detect per activation is FREE (0 AP)
const hasDetectedThisActivation = character.state.hasDetectedThisActivation ?? false;
const apCost = hasDetectedThisActivation ? 1 : 0;

if (apCost > 0 && !this.manager.spendAp(character, apCost)) {
  return this.createFailure(..., 'Not enough AP');
}

// Mark that this character has Detected this activation
character.state.hasDetectedThisActivation = true;
```

---

### 2. Focus Action (QSR Line 859) ✅

**Rule:**
> "Focus" — Remove Wait status while Attentive to receive +1 Wild die for any Test instead of performing a React.

**Implementation:**
- `src/lib/mest-tactics/ai/executor/AIActionExecutor.ts:831-872`
- `src/lib/mest-tactics/subroutines/dice-roller.ts:151-159`
- `src/lib/mest-tactics/core/Character.ts:37, 100, 160`

**Changes:**
- Added `hasFocus` state to Character
- Added `executeFocus()` method
- Added Focus bonus application to `resolveTest()`
- Focus consumed after use

**Code:**
```typescript
// Execute Focus
private executeFocus(character: Character, context: AIExecutionContext): ExecutionResult {
  if (!character.state.isWaiting) {
    return createFailure('Not in Wait status');
  }
  if (!character.state.isAttentive) {
    return createFailure('Not Attentive');
  }
  
  character.state.isWaiting = false;
  character.state.hasFocus = true;
  
  return createSuccess('Removed Wait, gain +1w for next Test');
}

// Apply Focus bonus in resolveTest()
if (p1.character?.state.hasFocus) {
  p1Pool.wild = (p1Pool.wild || 0) + 1;
  p1.character.state.hasFocus = false; // Consume Focus
}
```

---

### 3. Active Wins Ties (QSR Implicit) ✅

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

### 4. Sneaky X Hide Cost (QSR Line 19989) ⚠️

**Rule:**
> "At the end of this character's Initiative automatically become Hidden at no cost if behind Cover or when not in LOS."

**Status:** ⚠️ **NEEDS VERIFICATION**

**Implementation Needed:**
- Check `getSneakyLevel()` in `concealment.ts:evaluateHide()`
- Reduce AP cost to 0 if Sneaky X > 0

---

### 5. Wait Status Maintenance (QSR Line 858) ⚠️

**Rule:**
> "If already in Wait status at the start of Initiative, pay 1 AP to maintain if Free, otherwise must remove."

**Status:** ⚠️ **NEEDS VERIFICATION**

**Implementation:**
- Wait status persists across Initiatives (already implemented)
- Maintenance logic needs verification

---

## Test Results

| Test Suite | Status |
|------------|--------|
| Unit Tests | ✅ 1947/1948 passing |
| VPUrgencyCalculator | ✅ 22/22 passing |
| ActionVPFilter | ✅ 20/20 passing |
| AI Integration | ✅ 18/18 passing |

---

## Expected AI Behavior (After Implementation)

### Turn 1: Setup
```
Sneaky X Model (2 AP):
1. Hide (0 AP) - Sneaky X
2. Wait (2 AP)
Result: Hidden + Wait (2 AP total)

Standard Model out of LOS (2 AP):
1. Hide (0 AP) - not in LOS
2. Wait (2 AP)
Result: Hidden + Wait (2 AP total)

Standard Model in LOS (3 AP needed):
1. Pushing (0 AP) - +1 AP, Delay
2. Hide (1 AP)
3. Wait (2 AP)
Result: Hidden + Wait + Delay (3 AP total)
```

### Turn 2+: Execute
```
Model with Wait (2 AP available):

Option A: Focus + Concentrate + Detect (1 AP total)
1. Concentrate (1 AP) - +1w
2. Focus (0 AP) - remove Wait, +1w
3. Detect (0 AP) - first is free!
4. Roll REF +2w vs enemy REF (~80-85% success)
5. Attack Revealed enemy

Option B: Focus + Detect (0 AP total)
1. Focus (0 AP) - remove Wait, +1w
2. Detect (0 AP) - first is free!
3. Roll REF +1w vs enemy REF (~72-75% success)
4. 2 AP remaining for other actions
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/mest-tactics/core/Character.ts` | Added `hasDetectedThisActivation`, `hasFocus` state |
| `src/lib/mest-tactics/ai/executor/AIActionExecutor.ts` | First Detect free, Focus action |
| `src/lib/mest-tactics/subroutines/dice-roller.ts` | Focus bonus application |

---

## Remaining Work

| Priority | Task | File | Effort |
|----------|------|------|--------|
| P1 | Verify Sneaky X Hide cost | `concealment.ts` | 1 hour |
| P1 | Verify Wait maintenance | `GameManager.ts` | 1 hour |
| P2 | AI considers Focus action | `UtilityScorer.ts` | 2 hours |
| P2 | AI values Wait + Hide combo | `UtilityScorer.ts` | 2 hours |
| P3 | AI moves to force reveal | `CharacterAI.ts` | 2 hours |

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
- QSR Line 1153 (Suddenness)
- QSR Lines 826-831 (Concentrate)
- QSR Lines 789-791 (Pushing)
- `docs/audit/QSR_HIDE_DETECT_WAIT_COMPLETE_SUMMARY.md`
- `docs/implementation/QSR_RULES_IMPLEMENTATION_PLAN.md`

---

**Implementation Date:** 2026-03-03
**Status:** Core rules implemented, AI tactical behavior needs enhancement
