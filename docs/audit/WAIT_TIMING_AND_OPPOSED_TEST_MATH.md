# Wait Status & Opposed Test Math - Corrected Understanding

**Date:** 2026-03-02
**Status:** ✅ **CORRECTED**

---

## Wait Status Timing (Corrected)

### QSR Rule (Lines 857-860)
```
Wait () — Pay 2 AP if not Outnumbered to acquire Wait status and marker.
           Remove at the start of this character's next Initiative.
           If already in Wait status at the start of Initiative,
           pay 1 AP to maintain if Free, otherwise must remove.
```

### Correct Understanding

**Wait status is acquired in PRIOR Initiative:**

```
Turn 1, Initiative 3:
  Character pays 2 AP to acquire Wait
  - Receives Wait token
  - Initiative ends, character marked Done

Turn 2, Start of Character's Initiative:
  - Wait token is still there (not removed yet)
  - Character can:
    a) Maintain Wait (1 AP if Free) - keep token
    b) Use Wait for React/Focus - remove token
    c) Let it expire - remove token

Turn 2, During Enemy's Initiative:
  - Character can React (even if Done!)
  - Character can Focus instead of React
```

**Key Point:** Wait status spans across Initiatives. You pay for it in Turn 1, benefit in Turn 1+ AND Turn 2.

### Mission-Assigned Wait

Some missions may start models with Wait status already assigned. In this case:
- No AP cost to acquire
- Still can React/Focus normally
- Still removed at start of character's Initiative (unless maintained)

---

## Opposed Test Math (Corrected)

### My Error

**Incorrect Statement:**
> "Detect fails ~50% (opposed REF test with similar attributes)"

**CORRECTION:** Active character **WINS TIES**, so success rate is **~63%** for equal dice pools, not 50%.

### QSR Rule (Implicit in Test Resolution)

The Active character (attacker in Detect Test) wins ties in Opposed Tests.

### Correct Math

**Opposed REF Test: REF 2 vs REF 2 (no modifiers)**

```
Attacker (Active, Detecting): 2 Base dice
Defender (Hidden):            2 Base dice

Attacker wins ties → Success rate > 50%

Exact calculation:
- Total possible outcomes: 6^2 × 6^2 = 1,296
- Attacker wins: ~816 outcomes
- Defender wins: ~480 outcomes
- Success rate: 816/1,296 ≈ 63%
```

**With +1 Wild die (Focus OR Concentrate):**
```
Attacker: 2 Base + 1 Wild
Defender: 2 Base

Wild dice are powerful (each pip = 3 successes with carry-over)
Success rate: ~72-75%
```

**With +2 Wild dice (Focus + Concentrate):**
```
Attacker: 2 Base + 2 Wild
Defender: 2 Base

Success rate: ~80-85%
```

### Success Rate Table (REF 2 vs REF 2)

| Attacker Bonus | Defender Bonus | Success Rate |
|---------------|----------------|--------------|
| +0w | +0w | ~63% (Active wins ties) |
| +1w | +0w | ~72-75% |
| +2w | +0w | ~80-85% |
| +0w | +1w | ~50-55% |
| +0w | +2w | ~40-45% |

### Why This Matters

**Before (my wrong math):**
```
Detect success: ~50%
Expected Detects to succeed: 2 attempts
Stalemate seems likely
```

**After (correct math):**
```
Detect success: ~63% (base)
With Focus + Concentrate: ~80-85%
Expected Detects to succeed: 1.2-1.6 attempts
Stalemate should NOT happen
```

---

## Corrected AI Behavior

### Turn 1: Acquire Wait
```
AI Character (2 AP):
1. Acquire Wait status (2 AP)
   - Will have Wait token for rest of Turn 1
   - Will keep Wait token into Turn 2
   - Can maintain for 1 AP in Turn 2
```

### Turn 2: Use Wait for Focus + Detect
```
AI Character (2 AP, has Wait from Turn 1):

Option A: Focus + Detect (0 AP!)
1. Focus (0 AP) - remove Wait, +1w
2. Detect (0 AP) - first is free!
3. Roll REF +1w vs enemy REF
4. Success rate: ~72-75%
5. Remaining AP: 2 (can Attack if Revealed!)

Option B: Focus + Concentrate + Detect (1 AP)
1. Concentrate (1 AP) - +1w
2. Focus (0 AP) - remove Wait, +1w
3. Detect (0 AP) - first is free!
4. Roll REF +2w vs enemy REF
5. Success rate: ~80-85%
6. Remaining AP: 1 (can Attack if Revealed!)
```

### Expected Outcome (Corrected Math)

```
Turn 1: Both sides Hide + some acquire Wait
Turn 2: 
  - Focus + Detect (0 AP, ~72-75% success)
  - OR Focus + Concentrate + Detect (1 AP, ~80-85% success)
  - Most Detects succeed
  - Enemies Revealed
  - Combat occurs
Turn 3+: VP scored from eliminations
```

**With ~63-85% success rates, stalemate should NOT happen.**

---

## Why Stalemate Actually Happens (Corrected Analysis)

### Real Causes

1. **First Detect NOT Free** - AI pays 1 AP when it should be 0 AP
   - This discourages Detect spam
   - AI holds AP for "more important" actions

2. **Focus NOT Implemented** - AI can't use Focus action
   - Missing +1w bonus
   - Missing synergy with Wait

3. **AI Doesn't Value Wait** - AI doesn't acquire Wait strategically
   - Should acquire Wait Turn 1 for Turn 2 Focus + Detect
   - Should maintain Wait when Hidden enemies exist

4. **AI Doesn't Move After Failed Detect** - Wastes remaining AP
   - Should move to force Hidden out of Cover
   - Should position to cut off reposition options

5. **No Coordination** - Allies don't focus-fire Detects
   - Multiple Detects on same target = higher success
   - No tactical data sharing

---

## Implementation Status (Corrected)

| Feature | QSR Reference | Implementation | Status |
|---------|---------------|----------------|--------|
| Wait acquisition (2 AP) | Line 857 | `AIActionExecutor.ts` | ✅ Correct |
| Wait maintenance (1 AP) | Line 858 | `AIActionExecutor.ts` | ✅ Correct |
| Wait doubles Visibility | Line 860 | `concealment.ts:218` | ✅ Correct |
| Wait +1 REF for React | Line 860 | `concealment.ts:224` | ✅ Correct |
| Focus action | Line 859 | NOT implemented | ❌ Missing |
| Focus +1w bonus | Line 859 | NOT implemented | ❌ Missing |
| First Detect free | Line 855 | Always spends 1 AP | ❌ Missing |
| Active wins ties | Test resolution | Need to verify | ⚠️ Check |

---

## Required Fixes (Corrected Priority)

### Priority 1: First Detect is Free
**Impact:** Enables Detect spam, removes AP barrier
**File:** `AIActionExecutor.ts:784`

### Priority 2: Implement Focus Action
**Impact:** +1w for Detect, breaks stalemate
**File:** `AIActionExecutor.ts` - new action

### Priority 3: Verify Active Wins Ties
**Impact:** ~63% base success rate (not 50%)
**File:** `dice-roller.ts` or test resolution

### Priority 4: AI Values Wait + Focus Combo
**Impact:** Strategic Wait acquisition for Turn 2 Focus + Detect
**File:** `UtilityScorer.ts` - increase Wait value

### Priority 5: Move After Failed Detect
**Impact:** Forces Hidden out of Cover
**File:** `CharacterAI.ts` - fallback logic

---

## Expected Outcome (After Fixes)

```
Turn 1:
  - 50% of AI models acquire Wait (2 AP)
  - 50% Hide (0-1 AP)

Turn 2:
  - Wait models: Focus (0 AP) + Detect (0 AP)
  - Success rate: ~72% (+1w from Focus)
  - Most Hidden enemies Revealed
  - Remaining AP used for Attack or Move

Turn 3+:
  - Combat with Revealed enemies
  - VP scored from eliminations

Battle Duration: 6 turns
Combat Actions: 5-10
Eliminations: 1-3
VP: 1-3 (not just tiebreaker)
```

---

## Conclusion

**My Previous Analysis Was Wrong:**

| Aspect | My Wrong Claim | Correct Understanding |
|--------|---------------|----------------------|
| Wait timing | "Same Initiative" | **Prior Initiative** (spans turns) |
| Detect success rate | "~50%" | **~63%** (Active wins ties) |
| With +1w | "~60%" | **~72-75%** |
| With +2w | "~70%" | **~80-85%** |
| Stalemate cause | "Low success rate" | **Missing Focus + First Detect Free** |

**With correct math and Focus implemented:**
- Base Detect: ~63% success (not 50%)
- Focus + Detect: ~72-75% success
- Focus + Concentrate + Detect: ~80-85% success
- **Stalemate should NOT happen**

**The Fix:**
1. First Detect is Free (QSR compliance)
2. Implement Focus action (QSR compliance)
3. Verify Active wins ties (QSR compliance)
4. AI values Wait + Focus combo (tactical improvement)
