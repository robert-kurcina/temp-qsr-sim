# Suddenness & React Interactions - Confirmed Understanding

**Date:** 2026-03-02
**Status:** ✅ **CONFIRMED**

---

## QSR Suddenness Rule (Lines 853, 1153)

```
"Suddenness" — Models which were Hidden at the start of an action 
               receive +1 Modifier die Combat Hit Tests.

Suddenness — A character receives a bonus of +1 Modifier die for the Hit Test 
             if it was Hidden at start of an Action.
```

---

## Key Insights (Confirmed)

### 1. Suddenness Benefits BOTH Active and Passive

**Active Character (Initiative Holder):**
```
Turn starts: Model is Hidden behind Cover
Action: Move out of Cover and Attack
Result: +1m to Hit Test (was Hidden at START of action)
```

**Passive Character (Reacting):**
```
Turn starts: Model is Hidden behind Cover, in Wait status
Opponent moves within LOS
React: Interrupt and Attack
Result: +1m to Hit Test (was Hidden at START of React action)
```

**Both sides benefit** from starting their action while Hidden.

---

### 2. Suddenness + Wait = Powerful Combo

**QSR Rule (Line 860):**
```
Wait () — Pay 2 AP if not Outnumbered to acquire Wait status and marker.
           ...
           While in Wait status, double Visibility OR.
           All Hidden Opposing models in LOS but not in Cover are immediately Revealed.
           ...
           "Waiting" — All characters in Wait status receive +1 REF when qualifying for a React.
```

**Combo:**
```
1. Model Hides behind Cover (1 AP or 0 AP)
2. Model acquires Wait status (2 AP)
   - Visibility OR doubles (16 → 32 MU)
   - +1 REF when qualifying for React
   - Auto-reveals Hidden enemies not in Cover
3. Enemy moves within LOS
4. React: Interrupt and Attack
   - +1m Suddenness (was Hidden at start)
   - +1 REF from Wait (better chance to qualify)
   - Enemy may be Revealed (if not in Cover)
```

**This is VERY powerful** and AI should use it.

---

### 3. React Interactions with Hidden

**QSR Rule (Line 1135):**
```
Move-only — These are Reacts against Opposing models which perform a Move action,
            but not involving the use of Agility at the time of declaring the intent
            to interrupt. Interrupt the action anywhere along its movement.
            If it was Hidden, it is Revealed and may reposition.
            If that model makes base-contact, this will be an Abrupt action.
```

**Mechanic:**
```
1. Active model is Hidden, starts Move action
2. Passive model in Wait status declares React
3. Active model is Revealed (loses Hidden status)
4. Active model may reposition up to MOV × 1"
5. React resolves (Opposed Test or Attack)
6. If React succeeds, Active model's action is interrupted
```

**Key Point:** Reacting **reveals** Hidden models, but they get to **reposition**.

---

### 4. Suddenness Applies to React Attacks

**QSR Rule (Line 1153):**
```
Suddenness — A character receives a bonus of +1 Modifier die for the Hit Test 
             if it was Hidden at start of an Action.
```

**React Scenario:**
```
1. Model is Hidden at start of Turn
2. Model is in Wait status
3. Enemy moves within LOS
4. Model Reacts (interrupts enemy)
5. Model performs Attack as part of React
6. +1m Suddenness applies (was Hidden at start of React action)
```

**The React action is still an "Action"** for Suddenness purposes.

---

### 5. Leaning + Hidden + Detect Interaction

**QSR Rule (Line 1137):**
```
Leaning () — When the Active character uses leaning and is interrupted,
              this is treated as non-movement for any Reacts.
              Reacts are allowed against the model at the leaning position
              as though it were the actual position.

A Detect action is required if the leaning model is in Hidden status;
upon pass, reposition it to the leaning position.
```

**Mechanic:**
```
1. Hidden model uses Leaning (extends from Cover)
2. Enemy declares React
3. React treats Leaning position as actual position
4. If React is Detect:
   - Opposed REF Test
   - On success: Hidden model is Revealed
   - Hidden model repositions to Leaning position
5. If React is Attack:
   - Can attack Leaning position
   - Hidden model may have cover penalties
```

---

## Correct AI Behavior

### Turn 1: Setup for Suddenness + Wait
```
AI Model (2 AP):
1. Hide behind Cover (0 AP if not in LOS, 1 AP if in LOS)
2. Acquire Wait status (2 AP)
   - Now: Hidden + Wait +1 REF for React
   - Visibility OR doubled (16 → 32 MU)
   - Auto-reveals Hidden enemies not in Cover
```

### Turn 2+: React with Suddenness
```
Enemy moves within LOS (32 MU with Wait)
AI Model Reacts:
1. Qualify for React (+1 REF from Wait)
2. Swap roles (AI becomes Active for React)
3. Perform Attack (1 AP from React)
   - +1m Suddenness (was Hidden at start)
   - Enemy may be Revealed (if not in Cover)
4. Return control to enemy
```

### Alternative: Move to Force Reveal
```
AI Model (2 AP, Hidden):
1. Move towards Hidden enemy (1 AP)
   - If this puts enemy without Cover → enemy loses Hidden
   - Enemy can reposition MOV × 1" to find Cover
2. If enemy stays Revealed: Attack (1 AP)
   OR
   If enemy re-Hides: Detect (0 AP - first is free!)
```

---

## Implementation Status

| Feature | QSR Reference | Implementation | Status |
|---------|---------------|----------------|--------|
| Suddenness +1m | Line 853, 1153 | `combat-actions.ts:378-379, 1117-1118` | ✅ Correct |
| Wait +1 REF for React | Line 860 | `concealment.ts:209-232` | ✅ Correct |
| Wait doubles Visibility | Line 860 | `concealment.ts:218` | ✅ Correct |
| React reveals Hidden | Line 1135 | Needs verification | ⚠️ Check |
| Hidden reposition on React | Line 1135 | `concealment.ts:235-270` | ✅ Correct |
| Leaning + Hidden + Detect | Line 1137 | Needs verification | ⚠️ Check |

---

## AI Tactical Recommendations

### Priority 1: Use Wait + Hidden Combo
```typescript
// UtilityScorer.ts - Increase Wait value when Hidden
if (character.state.isHidden && apRemaining >= 2) {
  const waitScore = 2.5; // High value for Hidden + Wait combo
  // +1 REF for React
  // +1m Suddenness on React attack
  // Doubles Visibility OR
  actions.push({ type: 'wait', score: waitScore });
}
```

### Priority 2: React with Suddenness
```typescript
// ReactsQSR.ts - Value Reacts when Hidden
if (character.state.isHidden && hasWaitStatus) {
  const reactPriority = 3.5; // High priority
  // +1m Suddenness on attack
  // +1 REF from Wait
  // Enemy may be revealed
  return { shouldReact: true, priority: reactPriority };
}
```

### Priority 3: Move to Force Reveal
```typescript
// CharacterAI.ts - Move when enemies Hidden
const hiddenEnemies = enemies.filter(e => e.state.isHidden);
if (hiddenEnemies.length > 0 && apRemaining >= 1) {
  // Move to put enemy without Cover
  // Forces them to lose Hidden or reposition
  const moveDecision = calculateMoveToForceReveal(character, hiddenEnemies);
  return moveDecision;
}
```

### Priority 4: Detect After Failed Move
```typescript
// CharacterAI.ts - Fallback to Detect
if (moveFailed || noValidMove) {
  // First Detect is FREE (0 AP)
  const detectDecision = evaluateDetect(context);
  if (detectDecision.shouldDetect) {
    return detectDecision;
  }
}
```

---

## Testing Plan

1. **Verify Suddenness implementation**
   - Check `combat-actions.ts` applies +1m correctly
   - Verify it works for both Active and Reacting models

2. **Verify Wait + Hidden combo**
   - Wait status doubles Visibility OR
   - +1 REF for React qualification
   - Auto-reveals Hidden not in Cover

3. **Verify React reveals Hidden**
   - When Reacting to Hidden model's Move
   - Hidden model loses Hidden status
   - Hidden model can reposition

4. **Run AI battles and track:**
   - Wait usage when Hidden (should increase)
   - React success rate with Suddenness (should improve)
   - Combat actions after Wait (should increase)
   - VP from eliminations (should be > 0)

---

## Conclusion

**Suddenness is a KEY tactical element** that:
- ✅ Benefits BOTH Active and Passive characters
- ✅ Combos powerfully with Wait status
- ✅ Applies to React attacks
- ✅ Interacts with Leaning and Detect

**AI should prioritize:**
1. Hide + Wait combo for defensive Reacts
2. React with Suddenness when enemy moves
3. Move to force Hidden enemies out of Cover
4. Detect as fallback (first is free!)

**Implementation is mostly correct**, but AI tactical decision-making doesn't fully leverage these mechanics yet.
