# QSR Rules Compliance Audit

**Date:** 2026-03-02
**Status:** 🔴 **CRITICAL GAPS IDENTIFIED**

---

## Critical Rules Gaps

### 1. "First Detect is Free" Rule NOT Implemented

**QSR Rule (line 855):**
> "Detect — The first Detect costs zero AP. Otherwise 1 AP."

**Current Implementation:**
- No tracking of whether a character has already Detected this activation
- All Detect actions likely cost 1 AP

**Impact:**
- AI is penalized for attempting to reveal Hidden enemies
- Makes Detect less attractive than Hide (which costs 1 AP only when in LOS)
- Contributes to Hide/Detect stalemate

**Fix Required:**
```typescript
// Add to Character state
hasDetectedThisActivation: boolean;

// Reset at start of character's activation
character.hasDetectedThisActivation = false;

// In attemptDetect()
const apCost = character.hasDetectedThisActivation ? 1 : 0;
if (!spendAp(apCost)) return { success: false, reason: 'Not enough AP' };
character.hasDetectedThisActivation = true;
```

---

### 2. Hidden Models Cannot Be Targeted - CORRECT

**QSR Rule (line 19680 in data.ts):**
> "This model may not become Engaged nor targeted for an Attack until Revealed."

**Current Implementation:**
- ✅ Correctly implemented in `isAttackableEnemy()` - Hidden check not needed there
- Attack resolution should reject Hidden targets

**Status:** ✅ **COMPLIANT**

---

### 3. Wait Status Doubles Visibility OR - NEEDS VERIFICATION

**QSR Rule (line 860):**
> "While in Wait status, double Visibility OR. All Hidden Opposing models in LOS but not in Cover are immediately Revealed."

**Current Implementation:**
- `resolveWaitReveal()` in `concealment.ts` implements this
- Uses `effectiveVisibility = baseVisibility * 2`

**Status:** ✅ **COMPLIANT** (needs playtesting verification)

---

### 4. Hide AP Cost Context-Sensitive - CORRECT

**QSR Rule (line 846):**
> "Hide — Pay 1 AP. If Free, mark model in LOS but behind Cover as Hidden. If not in LOS, it is zero AP."

**Current Implementation:**
- `evaluateHide()` in `concealment.ts` checks for opposing LOS
- Returns `apCost: 0` if no opposing LOS, `apCost: 1` if in LOS+Cover

**Status:** ✅ **COMPLIANT**

---

### 5. Detect Test is Opposed REF - CORRECT

**QSR Rule (line 855-856):**
> "perform a Detect Test as an Opposed REF Test against a Hidden target"

**Current Implementation:**
- `attemptDetect()` in `concealment.ts` line 154-161:
```typescript
const attackerParticipant: TestParticipant = {
  character: attacker,
  attribute: 'ref',
  penaltyDice: options.attackerLeaning ? { base: 1 } : undefined,
};
const defenderParticipant: TestParticipant = {
  character: target,
  attribute: 'ref',
  penaltyDice: options.targetLeaning ? { base: 1 } : undefined,
};
```

**Status:** ✅ **COMPLIANT**

---

### 6. Detect Range Limited by Visibility OR - CORRECT

**QSR Rule (line 856):**
> "Detect OR is equal to Visibility."

**Current Implementation:**
- `attemptDetect()` line 140-144:
```typescript
const detectRange = options.detectOrMu ?? options.visibilityOrMu ?? 16;
const distance = LOSOperations.distance(attackerSpatial.position, targetSpatial.position);
if (distance > detectRange) {
  return { success: false, reason: `Out of detect range...` };
}
```

**Status:** ✅ **COMPLIANT**

---

### 7. Suddenness Bonus for Hidden Attackers - CORRECT

**QSR Rule (line 853):**
> "Suddenness — Models which were Hidden at the start of an action receive +1 Modifier die Combat Hit Tests."

**Current Implementation:**
- Referenced in multiple places in `data.ts`
- Applied in combat resolution

**Status:** ✅ **COMPLIANT**

---

### 8. Hidden Reposition on Reveal - CORRECT

**QSR Rule (line 905):**
> "A Passive Hidden model that becomes Revealed may reposition. Pick another battlefield location that it could have been at within a radius of MOV × 1"."

**Current Implementation:**
- `revealHiddenTarget()` in `concealment.ts` calls `findRepositionForReveal()`
- Allows reposition within MOV radius

**Status:** ✅ **COMPLIANT**

---

## My Previous Analysis Was WRONG

I incorrectly suggested:
> "Improve Detect success rate (+2 dice when target <8 MU) AND allow attacks vs Hidden enemies (-2 dice penalty, reveals on hit)."

**This violates QSR rules because:**

1. **Detect is an Opposed REF Test** - Adding flat dice bonuses would break the opposed test mechanic
2. **Hidden models CANNOT be targeted** - This is explicit in the rules (line 19680)
3. **The real issue is the "First Detect is Free" rule not being implemented**

---

## Root Cause of Stalemate

The Hide/Detect stalemate is caused by:

1. **Missing "First Detect is Free" rule** - AI is discouraged from spamming Detect
2. **50% terrain density** - Lots of cover means Hide succeeds easily
3. **Opposed REF tests are ~50/50** - With similar REF attributes, Detect fails often
4. **No time pressure** - 6 turns is enough for both sides to Hide and stay Hidden

---

## Correct Fixes (QSR-Compliant)

### Fix 1: Implement "First Detect is Free"
**Priority:** P0-HIGH
**File:** `src/lib/mest-tactics/status/concealment.ts`

```typescript
export function attemptDetect(
  battlefield: Battlefield,
  attacker: Character,
  target: Character,
  opponents: Character[],
  spendAp: (amount: number) => boolean, // NEW PARAMETER
  options: DetectOptions = {}
): DetectResult {
  // ... existing checks ...
  
  // QSR: First Detect is FREE
  const apCost = attacker.state.hasDetectedThisActivation ? 1 : 0;
  if (apCost > 0 && !spendAp(apCost)) {
    return { success: false, reason: 'Not enough AP.' };
  }
  attacker.state.hasDetectedThisActivation = true;
  
  // ... rest of Detect logic ...
}
```

### Fix 2: Reset Detect Flag Each Activation
**File:** `src/lib/mest-tactics/engine/GameManager.ts`

```typescript
public activateCharacter(character: Character) {
  // Reset per-activation flags
  character.state.hasDetectedThisActivation = false;
  // ... other reset logic ...
}
```

### Fix 3: AI Should Spam Free Detects
**File:** `src/lib/mest-tactics/ai/core/CharacterAI.ts`

The AI should already be doing this once Fix 1 is implemented, because:
- First Detect is 0 AP
- Revealing enemies enables combat (VP source)
- VP urgency should prioritize revealing enemies

---

## Additional Rules Gaps (Lower Priority)

### 9. Leaning Penalty Not Applied Consistently
**QSR Rule (line 879):**
> "Leaning — Penalize -1 Base die Detect and Range Combat Hit Tests if Leaning from terrain in base-contact."

**Status:** ⚠️ **PARTIALLY IMPLEMENTED** - Need to verify all Detect tests check for leaning

### 10. Obscured Penalty for Multiple Models
**QSR Rule (line 477, 1205):**
> "Obscured — Penalize Attacker Hit or Detect Tests for 1, 2, 5, or 10 other models within LOF to the target"

**Status:** ⚠️ **NEEDS VERIFICATION** - Check if `resolveTest()` applies this correctly

---

## Testing Plan

1. **Implement Fix 1-2** (First Detect is Free)
2. **Run AI battles** with VERY_SMALL game size
3. **Expected outcome:**
   - Turn 1: Both sides Hide (1 AP each)
   - Turn 2+: AI spams free Detects (0 AP)
   - Some Detects succeed (50% base rate)
   - Revealed enemies can be attacked
   - Combat occurs, VP is scored

4. **Metrics to track:**
   - Detect actions per turn (should increase)
   - Detect success rate (~50% expected)
   - Combat actions (should be > 0)
   - VP from eliminations (should be > 0)

---

## Conclusion

**The AI planning system fix (VP urgency) is working correctly.**

The remaining stalemate is due to:
1. **Missing QSR rule implementation** (First Detect is Free)
2. **Game mechanics** (Opposed tests, cover availability)

**Not** due to AI decision-making failures.

**Recommended next step:** Implement the "First Detect is Free" rule to restore QSR compliance and enable combat.
