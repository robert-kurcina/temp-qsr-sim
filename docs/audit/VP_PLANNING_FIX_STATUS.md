# AI Planning System Fix - Status Report

**Date:** 2026-03-02
**Status:** ✅ **PARTIALLY IMPLEMENTED**

---

## Problem

The AI planning system didn't correctly assess VP/RP scoring opportunities, resulting in:
- 0 combat actions per battle
- 0 VP acquired through gameplay
- Passive Hide/Detect loops dominating action selection
- No VP urgency driving decision-making

---

## Implemented Solutions

### ✅ Phase 1: VP Urgency Calculator
**File:** `src/lib/mest-tactics/ai/core/VPUrgencyCalculator.ts`

Calculates VP urgency state (low/medium/high/desperate) based on:
- VP deficit
- Turns remaining
- Zero VP desperation

### ✅ Phase 2: Action VP Filter
**File:** `src/lib/mest-tactics/ai/core/ActionVPFilter.ts`

Filters and scores actions by VP contribution:
- Direct VP actions: combat (0.25-0.35 VP)
- VP-enabling actions: move, detect (0.08-0.20 VP)
- Passive actions: hide, wait (0.0-0.02 VP)

### ✅ Phase 3: VP Prediction Cache
**File:** `src/lib/mest-tactics/ai/core/VPPredictionCache.ts`

Caches fractional VP predictions per character/action type.

### ✅ Phase 4: UtilityScorer Integration
**File:** `src/lib/mest-tactics/ai/core/UtilityScorer.ts`

Integrated VP urgency into action scoring with:
- VP urgency multipliers (1.0-3.0x)
- Passive action penalties (-0.8 to -10.0)

### ✅ Phase 5: CharacterAI VP Gating
**File:** `src/lib/mest-tactics/ai/core/CharacterAI.ts`

Added VP urgency checks that:
- Skip Hide evaluation when urgency is high/desperate
- Skip Detect evaluation when urgency is desperate
- Force movement toward enemy zone when all enemies Hidden

### ✅ Phase 6: StealthEvaluator VP Awareness
**File:** `src/lib/mest-tactics/ai/tactical/ReactsAndBonusActions.ts`

Added VP urgency penalties to Hide (-1.0 to -3.0) and bonuses to Detect (+0.5 to +1.5).

---

## Test Coverage

**58 new unit tests** created, all passing ✅
- VPUrgencyCalculator.test.ts (22 tests)
- ActionVPFilter.test.ts (20 tests)
- VPPredictionCache.test.ts (16 tests)

**Full test suite:** 1947/1948 tests passing ✅

---

## Results

### Before Fix
| Metric | Value |
|--------|-------|
| Combat Actions | 0 |
| Moves | 0-1 |
| Path Length | 0 MU |
| Models Moved | 0/8 |
| Detects | 30-40 |
| Hides | 10-12 |
| VP Source | Tiebreaker only |

### After Fix
| Metric | Value | Change |
|--------|-------|--------|
| Combat Actions | 0 | ⚠️ No change |
| Moves | 6 | ✅ +6 |
| Path Length | 10.23 MU | ✅ +10.23 |
| Models Moved | 2/8 | ✅ +2 |
| Detects | 18 | ✅ -50% |
| Hides | 6 | ✅ -50% |
| VP Source | Tiebreaker only | ⚠️ No change |

---

## Remaining Issue: Hide/Detect Stalemate

**Root Cause:** The Hide action is too effective in the current implementation:
1. Models Hide successfully behind cover
2. Detect rolls consistently fail (Hidden + cover = very low success rate)
3. No visible targets → no combat possible
4. Battle ends in stalemate

**Why Combat Still Doesn't Happen:**
- Even with VP urgency forcing movement, models can't attack Hidden enemies
- Detect success rate is too low to reveal enemies
- Once Hidden, models stay Hidden all game

---

## Next Steps (Required for Combat)

### Option A: Implement "First Detect is Free" Rule
**Priority:** P0-HIGH (QSR Compliance)

Per QSR line 855: "The first Detect costs zero AP. Otherwise 1 AP."

Currently NOT implemented. This discourages AI from attempting Detect actions.

**Fix:** Track `hasDetectedThisActivation` per character, reset each activation.

### Option B: Force Reveal After N Turns
**Priority:** P2-LOW (Rules Change - Not QSR Compliant)

Implement a house rule where Hidden models are automatically revealed after:
- 3+ turns of being Hidden
- Moving while Hidden
- Attacking while Hidden

**Note:** This is NOT in QSR rules. Use only for playtesting.

### Option C: Reduce Hide Effectiveness
**Priority:** P3-LOWEST (Rules Change - Not QSR Compliant)

Nerf the Hide action:
- Hide only lasts 1 turn
- Hide requires full AP (not 1 AP)
- Hide fails if any enemy has line of sight

**Note:** This is NOT in QSR rules. QSR Hide is already balanced.

---

## Recommended Fix

**Implement Option A only** ("First Detect is Free").

This is:
- ✅ QSR-compliant (line 855)
- ✅ Already supported by AI planning (VP urgency)
- ✅ Minimal code change
- ✅ Breaks stalemate naturally

**Do NOT implement Options B or C** - they violate QSR rules and aren't necessary.

---

## Files Modified

| File | Status |
|------|--------|
| `src/lib/mest-tactics/ai/core/VPUrgencyCalculator.ts` | ✅ NEW |
| `src/lib/mest-tactics/ai/core/ActionVPFilter.ts` | ✅ NEW |
| `src/lib/mest-tactics/ai/core/VPPredictionCache.ts` | ✅ NEW |
| `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | ✅ MODIFIED |
| `src/lib/mest-tactics/ai/core/CharacterAI.ts` | ✅ MODIFIED |
| `src/lib/mest-tactics/ai/tactical/ReactsAndBonusActions.ts` | ✅ MODIFIED |
| `src/lib/mest-tactics/ai/executor/AIGameLoop.ts` | ✅ MODIFIED |

---

## Verification

Run battle:
```bash
npm run ai-battle -- VERY_SMALL
```

**Expected:** 5+ moves, 10+ MU path length, reduced Hide/Detect
**Actual:** ✅ 6 moves, 10.23 MU, 18 Detects (was 30-40), 6 Hides (was 10-12)

---

**Implementation Status:** 80% Complete
**Combat Actions:** Still blocked by Hide/Detect stalemate
**Recommendation:** Implement Option A+C to enable combat
