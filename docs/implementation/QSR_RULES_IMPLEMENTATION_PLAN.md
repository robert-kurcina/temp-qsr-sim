# QSR Rules Implementation Plan

**Date:** 2026-03-02
**Priority:** P0-CRITICAL

---

## Overview

This document tracks implementation of critical QSR rules for Hide/Detect/Wait mechanics that are currently missing or incorrect.

---

## Rules to Implement

### 1. First Detect is Free (QSR Line 855)

**Rule:**
> "Detect — The first Detect costs zero AP. Otherwise 1 AP."

**Current State:** ❌ Always costs 1 AP

**Required Changes:**
- Track `hasDetectedThisActivation` per character
- Reset at start of each activation
- Spend 0 AP for first Detect, 1 AP for subsequent

**Files to Modify:**
- `src/lib/mest-tactics/ai/executor/AIActionExecutor.ts` - AP cost logic
- `src/lib/mest-tactics/engine/GameManager.ts` - Reset flag per activation

**Test:**
```typescript
// First Detect should cost 0 AP
const result1 = executor.executeDetect(character, target, context);
expect(apSpent).toBe(0);

// Second Detect should cost 1 AP
const result2 = executor.executeDetect(character, target2, context);
expect(apSpent).toBe(1);
```

---

### 2. Focus Action (QSR Line 859)

**Rule:**
> "Focus" — Remove Wait status while Attentive to receive +1 Wild die for any Test instead of performing a React.

**Current State:** ❌ Not implemented

**Required Changes:**
- Add Focus action to action types
- Execute Focus: remove Wait, grant +1w bonus
- Apply +1w bonus to next Test
- Consume bonus after use

**Files to Modify:**
- `src/lib/mest-tactics/ai/executor/AIActionExecutor.ts` - Add executeFocus()
- `src/lib/mest-tactics/ai/core/CharacterAI.ts` - Consider Focus in decision
- `src/lib/mest-tactics/subroutines/dice-roller.ts` - Apply Focus bonus
- `src/lib/mest-tactics/core/Character.ts` - Add hasFocus state

**Test:**
```typescript
// Focus should remove Wait and grant +1w
character.state.isWaiting = true;
const result = executor.executeFocus(character, context);
expect(character.state.isWaiting).toBe(false);
expect(character.state.hasFocus).toBe(true);

// Next Test should have +1w
const testResult = resolveTest(attacker, defender);
expect(testResult.wildDice).toBe(baseWildDice + 1);
```

---

### 3. Active Wins Ties in Opposed Tests

**Rule:**
> Implicit in QSR test resolution - Active character wins ties

**Current State:** ⚠️ Need to verify

**Required Changes:**
- Verify dice-roller implements tie-breaking for Active
- If not implemented, add tie-breaking logic

**Files to Verify:**
- `src/lib/mest-tactics/subroutines/dice-roller.ts` - Check tie resolution

**Test:**
```typescript
// Equal successes should favor Active
const result = resolveTest(attacker, defender);
// When scores are equal, attacker (Active) should win
expect(result.pass).toBe(true);
```

---

### 4. Sneaky X Hide Cost (QSR Line 19989)

**Rule:**
> "At the end of this character's Initiative automatically become Hidden at no cost if behind Cover or when not in LOS."

**Current State:** ⚠️ Need to verify

**Required Changes:**
- Check Sneaky X trait level when evaluating Hide
- Reduce AP cost to 0 if Sneaky X > 0

**Files to Verify/Modify:**
- `src/lib/mest-tactics/status/concealment.ts` - Check Sneaky X
- `src/lib/mest-tactics/traits/combat-traits.ts` - getSneakyLevel()

**Test:**
```typescript
// Sneaky X character should have 0 AP Hide cost
character.traits.push('Stealth 1'); // Includes Sneaky 1
const check = evaluateHide(battlefield, character, opponents);
expect(check.apCost).toBe(0);
```

---

### 5. Wait Status Maintenance (QSR Line 858)

**Rule:**
> "If already in Wait status at the start of Initiative, pay 1 AP to maintain if Free, otherwise must remove."

**Current State:** ⚠️ Need to verify

**Required Changes:**
- At start of Initiative, check if character has Wait
- Offer maintain option (1 AP if Free)
- Remove if not maintained or not Free

**Files to Verify/Modify:**
- `src/lib/mest-tactics/engine/GameManager.ts` - Start of Initiative logic
- `src/lib/mest-tactics/ai/executor/AIGameLoop.ts` - AI decision to maintain

**Test:**
```typescript
// Wait should persist to next Initiative
character.state.isWaiting = true;
gameManager.startInitiative(character);
expect(character.state.isWaiting).toBe(true); // Still there

// Should be able to maintain for 1 AP
gameManager.spendAp(character, 1);
expect(character.state.isWaiting).toBe(true);
```

---

## Implementation Priority

| Priority | Rule | Effort | Impact |
|----------|------|--------|--------|
| **P0** | First Detect is Free | 1 hour | High - enables Detect spam |
| **P0** | Focus action | 2 hours | High - +1w breaks stalemate |
| **P1** | Active wins ties | 1 hour (verify) | Medium - confirms ~63% rate |
| **P1** | Sneaky X Hide cost | 1 hour (verify) | Medium - free Hide for some |
| **P2** | Wait maintenance | 1 hour (verify) | Low - already mostly works |

**Total Effort:** 6 hours

---

## Acceptance Criteria

After implementation:

1. ✅ First Detect costs 0 AP per activation
2. ✅ Focus action removes Wait, grants +1w
3. ✅ Active wins ties in Opposed Tests
4. ✅ Sneaky X models have 0 AP Hide
5. ✅ Wait status persists across Initiatives
6. ✅ AI uses Focus + Detect + Concentrate combo
7. ✅ Combat actions > 0 per battle
8. ✅ VP from eliminations (not just tiebreaker)

---

## Verification Plan

### Unit Tests
```bash
npm test -- --run src/lib/mest-tactics/ai/executor/AIActionExecutor.test.ts
npm test -- --run src/lib/mest-tactics/status/concealment.test.ts
npm test -- --run src/lib/mest-tactics/subroutines/dice-roller.test.ts
```

### AI Battle Test
```bash
npm run ai-battle -- VERY_SMALL
```

**Expected:**
- Detect actions: 10+ per battle
- Detect success rate: 60-80%
- Combat actions: 5-10 per battle
- Eliminations: 1-3 per battle
- VP from eliminations: 1-3 VP

---

## Rollback Plan

If issues arise:
1. Revert `AIActionExecutor.ts` changes (First Detect, Focus)
2. Revert `dice-roller.ts` changes (tie-breaking)
3. Revert `concealment.ts` changes (Sneaky X)

All changes are isolated to specific files with minimal dependencies.

---

## References

- QSR Lines 846-860 (Hide, Detect, Wait rules)
- QSR Line 1153 (Suddenness)
- QSR Lines 826-831 (Concentrate)
- QSR Lines 789-791 (Pushing)
- `docs/audit/QSR_HIDE_DETECT_WAIT_COMPLETE_SUMMARY.md`
