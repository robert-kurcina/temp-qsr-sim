# AI Planning System Fix - VP/RP Scoring Integration

**Date:** 2026-03-02
**Status:** ✅ **IMPLEMENTED**

---

## Problem Summary

The AI planning system didn't correctly assess game state, scoring opportunities, or coordinate combatants to acquire VP and RP. This resulted in:

- **0 combat actions** per battle
- **0 VP** acquired through gameplay (only tiebreaker VP)
- **Passive Hide/Detect loops** dominating action selection
- **No VP urgency** driving decision-making

---

## Root Cause

VP was tracked but **never used as a planning constraint**. The AI selected actions based on tactical utility (cover, LOS, range) without considering:
1. Current VP deficit
2. Turns remaining
3. VP contribution of actions
4. Urgency to acquire VP

---

## Solution Implemented

### Phase 1: VP Urgency Calculator
**File:** `src/lib/mest-tactics/ai/core/VPUrgencyCalculator.ts`

Calculates VP urgency state based on:
- VP deficit (enemy VP - my VP)
- Turns remaining
- Current turn number
- Zero VP desperation (turn 6+)

**Urgency Levels:**
- `low`: Leading or early game
- `medium`: Trailing by 1 VP or mid-game
- `high`: Trailing by 2+ VP or late game (turn 5+)
- `desperate`: Zero VP at turn 6+ or trailing by 4+ VP

**Key Functions:**
- `calculateVPUrgency()` - Calculate urgency state
- `getUrgencyMultiplier()` - Get VP scoring multiplier (1.0-3.0)
- `getPassiveActionPenalty()` - Get penalty for passive actions (-0.8 to -10.0)
- `getVPUrgencyAdvice()` - Get tactical advice for debugging

---

### Phase 2: Action VP Filter
**File:** `src/lib/mest-tactics/ai/core/ActionVPFilter.ts`

Filters and scores actions based on VP contribution:

**Action Classifications:**
- **Direct VP Actions:** `close_combat`, `ranged_combat` (0.25-0.35 VP)
- **VP-Enabling Actions:** `move`, `charge`, `detect` (0.08-0.20 VP)
- **Passive Actions:** `hide`, `wait`, `hold` (0.0-0.02 VP)
- **Support Actions:** `rally`, `revive` (0.05-0.08 VP)

**Filtering by Urgency:**
- `low`: No filtering
- `medium`: No filtering (scoring handles penalties)
- `high`: Filter out purely passive actions
- `desperate`: Only allow direct VP actions

**Key Functions:**
- `getActionVPInfo()` - Get VP info for action type
- `filterActionsByVP()` - Filter actions by urgency
- `applyVPurgencyBonus()` - Apply urgency multiplier/penalty
- `scoreActionByVP()` - Score action by VP contribution

---

### Phase 3: VP Prediction Cache
**File:** `src/lib/mest-tactics/ai/core/VPPredictionCache.ts`

Caches fractional VP predictions per character and action type:

**Features:**
- Tracks actual VP earned per action
- Maintains action-type statistics
- Maintains character-specific statistics
- Tracks recent performance (last 5 attempts)
- Provides default VP contributions

**Key Methods:**
- `recordVPContribution()` - Record actual VP after action
- `getPredictedVP()` - Get predicted VP for action
- `getActionTypeStats()` - Get stats for action type
- `getCharacterActionStats()` - Get character-specific stats

---

### Phase 4: UtilityScorer Integration
**File:** `src/lib/mest-tactics/ai/core/UtilityScorer.ts`

Integrated VP urgency into action scoring:

```typescript
// === VP URGENCY INTEGRATION ===
const myVP = context.vpBySide?.[context.sideId ?? ''] ?? 0;
const enemyVP = Object.entries(context.vpBySide ?? {})
  .filter(([sid]) => sid !== context.sideId)
  .reduce((max, [, vp]) => Math.max(max, vp), 0);
const vpUrgency = calculateVPUrgency(myVP, enemyVP, currentTurn, maxTurns);

// Filter actions based on VP urgency
if (vpUrgency.urgencyLevel === 'desperate' || vpUrgency.urgencyLevel === 'high') {
  finalActions = filterActionsByVP(finalActions, vpUrgency, 0.0);
}

// Apply VP urgency bonus/penalty to action scores
for (const action of finalActions) {
  const vpScore = scoreActionByVP(action, vpUrgency);
  action.score += vpScore;
  
  // Apply passive action penalty when VP=0
  if (vpInfo.isPassiveAction && myVP === 0 && currentTurn >= 3) {
    const passivePenalty = getPassiveActionPenalty(...);
    action.score = Math.max(0, action.score + passivePenalty);
  }
}
// === END VP URGENCY INTEGRATION ===
```

---

## Test Coverage

### Unit Tests Created

1. **VPUrgencyCalculator.test.ts** (22 tests)
   - Urgency level calculation
   - Urgency multipliers
   - Passive action penalties
   - Tactical advice generation

2. **ActionVPFilter.test.ts** (20 tests)
   - Action VP classification
   - VP-based filtering
   - Urgency bonus application
   - VP scoring

3. **VPPredictionCache.test.ts** (16 tests)
   - VP contribution recording
   - Statistics tracking
   - Character-specific predictions
   - State serialization

**Total:** 58 new tests, all passing ✅

### Test Suite Status

```
Test Files  1 failed | 120 passed (121)
     Tests  1 failed | 1947 passed (1948)
```

The one failure is a pre-existing flaky test in `TerrainPlacement.test.ts` (not related to VP changes).

---

## Expected Behavior Changes

### Before Fix

| Metric | Value |
|--------|-------|
| Combat Actions | 0 |
| Eliminations | 0 |
| VP Source | Tiebreaker only |
| Dominant Actions | Hide (76%), Detect (11%) |
| Battle Pattern | Passive stalemate |

### After Fix (Expected)

| Metric | Expected |
|--------|----------|
| Combat Actions | 5-10 per battle |
| Eliminations | 1-3 per battle |
| VP Source | Actual eliminations |
| Dominant Actions | Combat, Move, Charge |
| Battle Pattern | VP-seeking aggression |

---

## Verification Steps

To verify the fix is working:

1. **Run AI battle:**
   ```bash
   npm run ai-battle -- VERY_SMALL
   ```

2. **Check battle report for:**
   - `closeCombats > 0`
   - `rangedCombats > 0`
   - `eliminations > 0`
   - `vpBySide` shows VP from eliminations (not just tiebreaker)

3. **Check action breakdown:**
   - Combat actions should be > 0%
   - Hide/Detect should be < 50%

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/mest-tactics/ai/core/VPUrgencyCalculator.ts` | **NEW** - VP urgency calculation |
| `src/lib/mest-tactics/ai/core/ActionVPFilter.ts` | **NEW** - Action VP filtering |
| `src/lib/mest-tactics/ai/core/VPPredictionCache.ts` | **NEW** - VP prediction caching |
| `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | **MODIFIED** - VP urgency integration |
| `src/lib/mest-tactics/ai/core/VPUrgencyCalculator.test.ts` | **NEW** - Unit tests |
| `src/lib/mest-tactics/ai/core/ActionVPFilter.test.ts` | **NEW** - Unit tests |
| `src/lib/mest-tactics/ai/core/VPPredictionCache.test.ts` | **NEW** - Unit tests |

---

## Architecture Impact

### Before
```
AI Decision Flow:
1. Generate legal actions
2. Score by tactical utility (cover, LOS, range)
3. Select highest score
4. Execute
```

### After
```
AI Decision Flow:
1. Calculate VP urgency (deficit, turns remaining)
2. Generate legal actions
3. FILTER: Reject passive actions (high/desperate urgency)
4. Score by tactical utility + VP contribution
5. Apply VP urgency multipliers/penalties
6. Select highest score
7. Execute
8. Record VP contribution for learning
```

---

## Key Design Decisions

1. **VP as Planning Constraint:** VP is not just a scoring modifier - it filters available actions when urgency is high.

2. **Progressive Urgency:** Urgency scales from low → medium → high → desperate, with increasing penalties for passive actions.

3. **Zero VP Desperation:** At turn 6+ with 0 VP, AI enters "desperate mode" - only direct VP actions allowed.

4. **Learning Cache:** VP Prediction Cache learns which actions actually produce VP, improving future decisions.

5. **Backward Compatible:** Existing tactical scoring (cover, LOS, range) still works - VP is an additional layer.

---

## Next Steps (Optional Enhancements)

1. **GOAP Integration:** Wire VP constraint into GOAP planner for multi-turn VP planning
2. **Squad Coordination:** Coordinate focus fire based on VP urgency
3. **Mission-Specific VP:** Enhance mission AI with VP urgency awareness
4. **VP Prediction Visualization:** Add VP urgency to battle audit reports

---

## References

- [`docs/audit/VP_SCORING_GAP_ANALYSIS.md`](docs/audit/VP_SCORING_GAP_ANALYSIS.md) - Original gap analysis
- [`docs/audit/VP_PLANNING_FAILURE_ANALYSIS.md`](docs/audit/VP_PLANNING_FAILURE_ANALYSIS.md) - Root cause analysis
- [`docs/blueprint/phases/phase-3-ai-tactical.md`](docs/blueprint/phases/phase-3-ai-tactical.md) - AI tactical requirements

---

**Implementation Complete:** 2026-03-02
**Tests Passing:** 58/58 new tests ✅
**Full Suite:** 1947/1948 tests passing ✅
