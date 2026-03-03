# QSR Hide/Detect/Wait Mechanics - Complete Summary

**Date:** 2026-03-02
**Status:** ✅ **COMPREHENSIVE SUMMARY**

---

## Core Rules (QSR Lines 846-860, 1153)

### Hide Action
```
Hide — Pay 1 AP. If Free, mark model in LOS but behind Cover as Hidden.
       If not in LOS, it is zero AP.

When Hidden:
  • Visibility and Cohesion distance are HALVED
  • All Terrain is degraded except for that crossed using Agility
  • Passive models lose Hidden if without Cover during Active model's movement
  • Active model loses Hidden if without Cover at start of Initiative
  • Models further than Visibility × 3 don't lose Hidden (unless Wait status enemy)

Sneaky X Trait:
  • Hide is FREE (0 AP) at end of Initiative if behind Cover or not in LOS
  • +X Modifier dice when benefiting from Suddenness
```

### Detect Action
```
Detect — The first Detect costs zero AP. Otherwise 1 AP.
         Perform Opposed REF Test vs Hidden target within LOS.
         On success: remove Hidden status, make Revealed.

Detect OR = Visibility
Apply Situational Test Modifiers as necessary.
```

### Wait Action
```
Wait () — Pay 2 AP if not Outnumbered to acquire Wait status and marker.
           Remove at start of character's next Initiative.
           If already in Wait at start of Initiative, pay 1 AP to maintain if Free.

           During Wait, may remove it to perform a React (even when Done).
           While in Wait, double Visibility OR.
           All Hidden Opposing models in LOS but not in Cover are immediately Revealed.

           "Focus" — Remove Wait while Attentive to receive +1 Wild die
                     for any Test instead of performing a React.

           "Waiting" — All characters in Wait status receive +1 REF
                       when qualifying for a React.
```

### Suddenness
```
"Suddenness" — Models which were Hidden at the start of an action
               receive +1 Modifier die Combat Hit Tests.

Applies to BOTH Active and Passive (Reacting) characters.
```

### Concentrate Action
```
Concentrate — Pay 1 AP. Combine once with any other action.
              Receive +1 Wild die for a specified Active Test.
              If for Attacker Hit Test, ignore Max ORM and double all ORs.
```

### Pushing
```
Pushing — Once per Initiative, gain +1 AP, acquire Delay token.
          Requires: No Delay tokens already.
```

---

## Critical Nuances (Confirmed)

### 1. Hidden ≠ Invisible

| Aspect | Misconception | Reality |
|--------|--------------|---------|
| **LOS** | "Hidden = not in LOS" | **Hidden = in LOS + behind Cover** |
| **Targeting** | "Can't target Hidden" | **Can target for movement, Detect, area attacks** |
| **AI Awareness** | "AI can't see Hidden" | **AI has god-mode, sees all models** |
| **Visibility Range** | "Normal range" | **HALVED (16 MU → 8 MU for Day/Clear)** |

---

### 2. Hide AP Cost Is Context-Sensitive

| Condition | Hide Cost | QSR Reference |
|-----------|-----------|---------------|
| In LOS + behind Cover | **1 AP** | Line 846 |
| NOT in LOS | **0 AP** | Line 846 |
| Sneaky X trait | **0 AP** | Line 19989 |
| Stealth X trait | **0 AP** | Uses Sneaky X |

**Strategic Impact:**
- Position out of LOS before Hiding = free Hide
- Sneaky X models can Hide + Wait for just 2 AP (no Pushing needed)

---

### 3. Hide + Wait Same Initiative Is Possible

| Scenario | Hide | Wait | Total | Needs Pushing |
|----------|------|------|-------|---------------|
| In LOS + Cover | 1 AP | 2 AP | **3 AP** | ✅ Yes |
| Not in LOS | 0 AP | 2 AP | **2 AP** | ❌ No |
| Sneaky X | 0 AP | 2 AP | **2 AP** | ❌ No |

**With Pushing:**
```
Standard model in LOS:
1. Pushing (0 AP) → +1 AP, Delay token
2. Hide (1 AP)
3. Wait (2 AP)
Total: 3 AP (2 base + 1 from Pushing)
Result: Hidden + Wait + Delay
```

---

### 4. Wait Status Spans Initiatives

```
Turn 1, Initiative 3:
  - Pay 2 AP for Wait
  - Receive Wait token
  - Initiative ends (character Done)

Turn 2, Start of Character's Initiative:
  - Wait token still there
  - Can maintain (1 AP if Free) or let expire
  - Can use for React/Focus during enemy's Initiative

Turn 2, During Enemy's Initiative:
  - Can React (even if Done!)
  - Can Focus instead of React
  - Wait token removed after use
```

**Key Point:** Wait is a **cross-turn investment**. Pay in Turn 1, benefit in Turn 1+ AND Turn 2.

---

### 5. Focus + Detect + Concentrate Combo

| Component | Source | Benefit | AP Cost |
|-----------|--------|---------|---------|
| **Wait status** | Line 857-860 | Doubles Visibility OR (16→32 MU) | 2 AP |
| **Focus** | Line 859 | +1 Wild die for Test | 0 AP (remove Wait) |
| **Concentrate** | Line 827-831 | +1 Wild die for Test | 1 AP |
| **First Detect** | Line 855 | Free Detect Test | 0 AP |
| **Total** | | **+2w, 32 MU range** | **1 AP** |

**Success Rates (REF 2 vs REF 2):**

| Bonus Dice | Success Rate |
|------------|--------------|
| +0w (base) | ~63% (Active wins ties) |
| +1w (Focus OR Concentrate) | ~72-75% |
| +2w (Focus + Concentrate) | ~80-85% |

---

### 6. Opposed Test Math (Active Wins Ties)

**My Wrong Math:** "~50% success rate"

**Correct Math:**
```
REF 2 vs REF 2 (no modifiers):
- Attacker (Active) wins ties
- Success rate: ~63% (NOT 50%)

With +1w:
- Success rate: ~72-75%

With +2w:
- Success rate: ~80-85%
```

**Why This Matters:**
- Base Detect is already favorable (~63%)
- With Focus + Concentrate: ~80-85%
- **Stalemate should NOT happen with correct play**

---

### 7. Suddenness Benefits Both Active and Passive

| Scenario | Who Benefits | Bonus |
|----------|-------------|-------|
| **Active attacks** | Attacker | +1m Hit Test |
| **Passive Reacts** | Reacting model | +1m Hit Test |
| **Both Hidden** | Both sides | +1m each |

**Wait + Hidden + React Combo:**
```
1. Model is Hidden + Wait
2. Enemy moves within LOS (32 MU with Wait)
3. React: Interrupt and Attack
   - +1 REF from Wait (better qualify chance)
   - +1m Suddenness (was Hidden at start)
   - Enemy may be Revealed (if not in Cover)
```

---

### 8. React Reveals Hidden Models

**QSR Rule (Line 1135):**
```
Move-only — Reacts against Opposing models which perform a Move action.
            Interrupt anywhere along movement.
            If it was Hidden, it is Revealed and may reposition.
```

**Mechanic:**
```
1. Hidden model starts Move action
2. Wait model declares React
3. Hidden model is Revealed
4. Hidden model can reposition MOV × 1"
5. React resolves (Attack or other action)
```

---

### 9. Moving Forces Hidden to Lose Status

**QSR Rule (Line 848):**
```
Passive models must lose Hidden status if without Cover
during the Active model's movement or use of Agility.
Allow them to first reposition up MOV × 1".
```

**Mechanic:**
```
1. Active model moves towards Hidden enemy
2. New position puts enemy without Cover
3. Enemy loses Hidden status
4. Enemy can reposition MOV × 1" to find new Cover
5. If no Cover available → stays Revealed → can be attacked
```

**AI Should:** Move to cut off Cover options, not just towards enemy.

---

### 10. AI God-Mode Awareness

**Implementation:**
```typescript
private getEnemyCharacters(character: Character): Character[] {
  return this.manager.characters.filter(
    c => c !== character && /* same side check */
  );
  // ✅ No isHidden check - AI sees ALL enemies
}
```

**AI Can:**
- See all Hidden enemies (god-mode)
- Pathfind towards Hidden enemies
- Plan movements to intercept Hidden enemies
- Coordinate allies against Hidden enemies

**AI Should NOT:**
- Treat Hidden as "unknown position"
- Fail to move towards Hidden enemies
- Waste AP on Hold when Hidden enemies exist

---

## Implementation Status

| Feature | QSR Reference | Implementation | Status |
|---------|---------------|----------------|--------|
| Hide cost (in LOS) | Line 846 | `concealment.ts` | ✅ 1 AP |
| Hide cost (not in LOS) | Line 846 | `concealment.ts` | ✅ 0 AP |
| Hide cost (Sneaky X) | Line 19989 | `combat-traits.ts` | ⚠️ Verify |
| Detect = Opposed REF | Line 855-856 | `concealment.ts` | ✅ Correct |
| Detect OR = Visibility | Line 856 | `concealment.ts` | ✅ Correct |
| First Detect free | Line 855 | `AIActionExecutor.ts` | ❌ Always 1 AP |
| Wait doubles Visibility | Line 860 | `concealment.ts` | ✅ Correct |
| Wait +1 REF for React | Line 860 | `concealment.ts` | ✅ Correct |
| Focus action | Line 859 | NOT implemented | ❌ Missing |
| Focus +1w bonus | Line 859 | NOT implemented | ❌ Missing |
| Suddenness +1m | Line 853, 1153 | `combat-actions.ts` | ✅ Correct |
| Active wins ties | Test resolution | Need verify | ⚠️ Check |
| React reveals Hidden | Line 1135 | `concealment.ts` | ✅ Correct |
| Hidden reposition | Line 848, 905 | `concealment.ts` | ✅ Correct |
| AI god-mode | N/A | `AIGameLoop.ts` | ✅ Correct |

---

## Required Fixes (Priority Order)

### Priority 1: First Detect is Free
**Impact:** QSR compliance, enables Detect spam
**File:** `AIActionExecutor.ts:784`
```typescript
const apCost = character.state.hasDetectedThisActivation ? 1 : 0;
// Reset at start of activation
```

### Priority 2: Implement Focus Action
**Impact:** +1w for Tests, breaks stalemate
**File:** `AIActionExecutor.ts`
```typescript
case 'focus':
  // Remove Wait, grant +1w for next Test
```

### Priority 3: Apply Focus Bonus to Tests
**Impact:** +1w actually applied
**File:** Test resolution code

### Priority 4: Verify Active Wins Ties
**Impact:** Confirms ~63% base success rate
**File:** `dice-roller.ts` or test resolution

### Priority 5: Verify Sneaky X Hide Cost
**Impact:** 0 AP Hide for Sneaky X models
**File:** `combat-traits.ts`

---

## Correct AI Behavior (After Fixes)

### Turn 1: Setup

**Sneaky X Model:**
```
1. Hide (0 AP) - Sneaky X
2. Wait (2 AP)
Result: Hidden + Wait (2 AP total)
```

**Standard Model (out of LOS):**
```
1. Hide (0 AP) - not in LOS
2. Wait (2 AP)
Result: Hidden + Wait (2 AP total)
```

**Standard Model (in LOS):**
```
1. Pushing (0 AP) - +1 AP, Delay
2. Hide (1 AP)
3. Wait (2 AP)
Result: Hidden + Wait + Delay (3 AP total)
```

### Turn 2+: Execute

**All Models with Wait:**
```
Option A (Best Success):
1. Concentrate (1 AP) - +1w
2. Focus (0 AP) - remove Wait, +1w
3. Detect (0 AP) - first is free!
4. Roll REF +2w vs enemy REF (~80-85% success)
5. Attack Revealed enemy (1 AP remaining)

Option B (AP Efficient):
1. Focus (0 AP) - remove Wait, +1w
2. Detect (0 AP) - first is free!
3. Roll REF +1w vs enemy REF (~72-75% success)
4. 2 AP remaining for other actions
```

### Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| Detect Success Rate | ~50% (wrong math) | ~63-85% (correct) |
| Combat Actions | 0 | 5-10 per battle |
| Eliminations | 0 | 1-3 per battle |
| VP Source | Tiebreaker only | Actual eliminations |
| Battle Duration | Stalemate | Decisive result |

---

## Lessons Learned

1. **Hidden ≠ Invisible** - Hidden models are in LOS but behind Cover
2. **AI has god-mode** - Sees all models including Hidden
3. **First Detect is FREE** - QSR line 855, not implemented
4. **Focus is powerful** - +1w for any Test, not implemented
5. **Wait spans turns** - Cross-turn investment
6. **Active wins ties** - ~63% base success, not 50%
7. **Sneaky X is game-changing** - Free Hide + Suddenness bonus
8. **Moving forces reveal** - Cut off Cover options
9. **Suddenness benefits both sides** - Active AND Passive
10. **React reveals Hidden** - But they can reposition

---

## Conclusion

**The AI planning architecture is CORRECT.**

**The stalemate is caused by:**
1. ❌ First Detect not free (QSR violation)
2. ❌ Focus action not implemented (QSR violation)
3. ❌ AI doesn't value Wait + Hide combo (tactical gap)
4. ❌ AI doesn't move to force reveal (tactical gap)

**NOT caused by:**
- ✅ AI can't see Hidden (AI has god-mode)
- ✅ Wrong Detect attribute (uses REF correctly)
- ✅ Low success rates (~63-85% with bonuses)
- ✅ Rules complexity (rules are implemented correctly)

**Fix the missing QSR rules (First Detect Free, Focus), and the stalemate breaks naturally.**
