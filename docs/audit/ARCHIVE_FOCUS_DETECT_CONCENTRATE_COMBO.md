# Focus + Detect + Concentrate Combo - Confirmed Understanding

**Date:** 2026-03-02
**Status:** ✅ **CONFIRMED**

---

## QSR Rules

### Wait Status (Line 857-860)
```
Wait () — Pay 2 AP if not Outnumbered to acquire Wait status and marker.
           Remove at the start of this character's next Initiative.
           If already in Wait status at the start of Initiative,
           pay 1 AP to maintain if Free, otherwise must remove.

           During Wait status, may remove it to perform a React.
           Even when in Done status.

           While in Wait status, double Visibility OR.
           All Hidden Opposing models in LOS but not in Cover are immediately Revealed.

           When in Wait status, and involuntarily acquire a Delay token,
           must remove both instead.

           "Focus" — Remove Wait status while Attentive to receive
                     +1 Wild die for any Test instead of performing a React.

           "Waiting" — All characters in Wait status receive +1 REF
                       when qualifying for a React.
```

### Concentrate Action (Line 826-831)
```
Concentrate — Pay 1 AP. Combine once with any other action.
              If that action has a Test, specify one Active Test to benefit as follows:

              Receive +1 Wild die for a specified Active Test such as the
              Attacker Hit Test, Attacker Damage Test, Active Rally Test,
              Attacker Link Test, etc. This choice must be declared before
              any Tests are performed.

              If for the Attacker Hit Test, ignore the Maximum OR Multiple,
              and double all ORs used for the Action; Visibility, Range Attack,
              Rally, Cohesion, etc.
```

### Detect Action (Line 855-856)
```
Detect — The first Detect costs zero AP. Otherwise 1 AP.
         If Free perform a Detect Test as an Opposed REF Test
         against a Hidden target within LOS to remove its
         Hidden status and make it Revealed.

         Detect OR is equal to Visibility.
         Apply Situational Test Modifiers as necessary.
```

---

## The Combo (Confirmed)

### Setup (Turn 1)
```
Character (2 AP):
1. Acquire Wait status (2 AP)
   - Now has Wait token
   - Visibility OR doubled (16 → 32 MU for Day/Clear)
   - +1 REF when qualifying for React
   - Can Focus for +1w instead of React
```

### Execute (Turn 2+)
```
Character has Hidden target at 24 MU (beyond normal 16 MU Visibility)
Character is Attentive, has Wait status

Option A: Focus + Detect (1 AP total)
1. Remove Wait status to Focus (+1w for Test)
2. Perform Detect (0 AP - first is free!)
3. Roll Opposed REF Test with +1 Wild die
4. On success: Target Revealed
5. Can attack Revealed target next activation

Option B: Focus + Concentrate + Detect (1 AP total)
1. Concentrate (1 AP) - declare +1w for Detect Test
2. Remove Wait status to Focus (+1w for Test)
3. Perform Detect (0 AP - first is free!)
4. Roll Opposed REF Test with +2 Wild dice (+1w Concentrate, +1w Focus)
5. On success: Target Revealed
6. Can attack Revealed target next activation

Option C: Concentrate + Detect (1 AP, keep Wait)
1. Concentrate (1 AP) - declare +1w for Detect Test
2. Perform Detect (0 AP - first is free!)
3. Roll Opposed REF Test with +1 Wild die (+1w Concentrate)
4. On success: Target Revealed
5. Keep Wait status for future React/Focus
```

---

## Why This Combo is Powerful

### 1. Extended Range
```
Normal Detect: 16 MU (Visibility OR for Day/Clear)
With Wait:     32 MU (doubled Visibility OR)

Target at 24 MU:
- Without Wait: Out of range, can't Detect
- With Wait:    In range (24 < 32), can Detect
```

### 2. Improved Success Rate
```
Normal Detect:    Base REF dice (e.g., REF 2 = 2 Base dice)
With Focus:       +1 Wild die
With Concentrate: +1 Wild die
With Both:        +2 Wild dice

Wild dice are powerful - each is potentially +3 successes with carry-over.
```

### 3. AP Efficient
```
Focus + Detect:        0 AP (Focus is free, first Detect is free)
Concentrate + Detect:  1 AP (Concentrate costs 1, first Detect is free)
Focus + Concentrate + Detect: 1 AP (Focus is free, Concentrate is 1 AP, first Detect is free)

All three options leave AP remaining for other actions!
```

### 4. Flexible Timing
```
Can execute:
- During own Initiative (normal activation)
- During enemy's Initiative (as React, but then use Focus instead)
- Even when in Done status (Wait allows React even when Done)
```

---

## Correct AI Behavior

### Turn 1: Setup
```
AI Character (2 AP, Hidden target at 24 MU):
1. Acquire Wait status (2 AP)
   - Doubles Visibility to 32 MU
   - Target now in range (24 < 32)
   - Can Focus for +1w later
```

### Turn 2: Execute Combo
```
AI Character (2 AP, has Wait status):

Priority 1: Focus + Concentrate + Detect (best success rate)
1. Concentrate (1 AP) - +1w for Detect
2. Focus (0 AP) - remove Wait, +1w for Detect
3. Detect (0 AP) - first is free!
4. Roll REF +2w vs enemy REF
5. Remaining AP: 1 (can Hold or use for something else)

Priority 2: Focus + Detect (AP efficient)
1. Focus (0 AP) - remove Wait, +1w for Detect
2. Detect (0 AP) - first is free!
3. Roll REF +1w vs enemy REF
4. Remaining AP: 2 (can Move, Attack if Revealed, etc.)

Priority 3: Concentrate + Detect (keep Wait)
1. Concentrate (1 AP) - +1w for Detect
2. Detect (0 AP) - first is free!
3. Roll REF +1w vs enemy REF
4. Remaining AP: 1
5. Keep Wait status for future use
```

---

## Implementation Status

| Feature | QSR Reference | Implementation | Status |
|---------|---------------|----------------|--------|
| Focus +1w | Line 859 | Need to verify | ⚠️ Check |
| Concentrate +1w | Line 827 | `combat-actions.ts` | ✅ Correct |
| First Detect free | Line 855 | `AIActionExecutor.ts:784` | ❌ Always spends 1 AP |
| Wait doubles Visibility | Line 860 | `concealment.ts:218` | ✅ Correct |
| Detect OR = Visibility | Line 856 | `concealment.ts:140-144` | ✅ Correct |

---

## Required Fixes

### Priority 1: Implement Focus Action
**File:** `AIActionExecutor.ts` - Add Focus execution

```typescript
case 'focus':
  return this.executeFocus(character, context);

private executeFocus(
  character: Character,
  context: AIExecutionContext
): ExecutionResult {
  if (!character.state.isWaiting) {
    return this.createFailure(
      { type: 'focus', reason: '', priority: 0, requiresAP: false },
      character,
      'Not in Wait status'
    );
  }
  if (!character.state.isAttentive) {
    return this.createFailure(
      { type: 'focus', reason: '', priority: 0, requiresAP: false },
      character,
      'Not Attentive'
    );
  }
  
  // Remove Wait status
  character.state.isWaiting = false;
  
  // Mark that character has Focus available for next Test
  character.state.hasFocus = true;
  
  return this.createSuccess(
    { type: 'focus', reason: 'Focus for +1w', priority: 2, requiresAP: false },
    character,
    'Removed Wait, gain +1w for next Test'
  );
}
```

### Priority 2: Apply Focus Bonus to Tests
**File:** `dice-roller.ts` or test resolution

```typescript
// When resolving Test, check for Focus
if (participant.character.state.hasFocus) {
  bonusDice[DiceType.Wild] = (bonusDice[DiceType.Wild] || 0) + 1;
  participant.character.state.hasFocus = false; // Consume Focus
}
```

### Priority 3: AI Should Use Focus + Detect Combo
**File:** `CharacterAI.ts` or `UtilityScorer.ts`

```typescript
// When Hidden target exists and character has Wait
const hiddenEnemies = enemies.filter(e => e.state.isHidden);
const hasWait = character.state.isWaiting;
const isAttentive = character.state.isAttentive;

if (hasWait && isAttentive && hiddenEnemies.length > 0) {
  // Focus + Detect is high priority
  // +1w from Focus, 0 AP cost, reveals enemy for combat
  
  // Check if Concentrate is also valuable
  const shouldConcentrate = apRemaining >= 1 && hiddenEnemies.length >= 1;
  
  const detectScore = 4.0; // High priority
  actions.push({
    type: 'detect',
    target: bestHiddenTarget,
    useFocus: true,
    useConcentrate: shouldConcentrate,
    score: detectScore,
  });
}
```

### Priority 4: First Detect is Free
**File:** `AIActionExecutor.ts:784`

```typescript
// Track per-activation Detect count
const hasDetectedThisActivation = character.state.hasDetectedThisActivation ?? false;
const apCost = hasDetectedThisActivation ? 1 : 0;

if (!this.manager.spendAp(character, apCost)) {
  return this.createFailure(..., 'Not enough AP');
}
character.state.hasDetectedThisActivation = true;
```

---

## Testing Plan

1. **Implement Focus action**
   - Remove Wait status
   - Grant +1w for next Test
   - Consume Focus on Test

2. **Verify Focus + Detect combo**
   - Character with Wait can Focus
   - Detect gets +1w from Focus
   - First Detect is 0 AP

3. **Verify Focus + Concentrate + Detect**
   - Concentrate (+1w) + Focus (+1w) stack
   - Total +2w to Detect Test
   - 1 AP total cost

4. **Run AI battles and track:**
   - Wait usage (should increase)
   - Focus usage (should see new action)
   - Detect success rate (should improve with +1w/+2w)
   - Combat after Detect (should increase)
   - VP from eliminations (should be > 0)

---

## Expected Outcome

### Before Fix
```
Turn 1: Hide (1 AP)
Turn 2: Detect (1 AP) → fails (~50%)
        Hold (waste 1 AP)
Turn 3-6: Repeat
Result: 0 combat, 0 VP
```

### After Fix
```
Turn 1: Wait (2 AP) - double Visibility to 32 MU
Turn 2: Focus (0 AP) + Concentrate (1 AP) + Detect (0 AP)
        = +2w to Detect, 1 AP total
        → succeeds (~70-80% with +2w)
        → Target Revealed
        → Attack Revealed target (1 AP)
Turn 3+: Combat continues
Result: Combat occurs, VP scored
```

---

## Conclusion

**Focus + Detect + Concentrate is a GAME-CHANGING combo:**

| Aspect | Value |
|--------|-------|
| **Range** | 16 MU → 32 MU (with Wait) |
| **Success Rate** | ~50% → ~70-80% (with +2w) |
| **AP Cost** | 1 AP total (Concentrate only) |
| **Tactical Impact** | Reveals enemies for combat |

**AI should prioritize this combo** when:
- Hidden enemies exist
- Character has Wait status
- Target is beyond normal Visibility OR
- Need to reveal enemies for VP-scoring attacks

**Implementation required:**
1. Focus action execution
2. Focus bonus application to Tests
3. First Detect is Free rule
4. AI tactical decision-making for combo
