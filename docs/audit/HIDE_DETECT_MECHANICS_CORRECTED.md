# Hide/Detect Mechanics - Corrected Understanding

**Date:** 2026-03-02
**Status:** ✅ **CORRECTED**

---

## QSR Rules (Lines 846-854)

### Hide Action
```
Hide — Pay 1 AP. If Free, mark model in LOS but behind Cover as Hidden. 
       If not in LOS, it is zero AP.

When Hidden:
  • Visibility and Cohesion distance are HALVED 
    (unless not within Opposing LOS)
  • All Terrain is degraded except for that crossed using Agility
  • Ignore this rule if entire path is out of LOS from all Revealed Opposing models

Passive models must lose Hidden status if:
  • Without Cover during Active model's movement or Agility use
  • After it uses reposition
  • Allow them to first reposition up to MOV × 1"

Active model loses Hidden status if:
  • Without Cover at start of its Initiative (allow reposition)
  • Active model and Passive models become without Cover from each other
    (Passive models reposition first, all lose Hidden, Active may NOT reposition)
  • Out of Cover at start or end of Action (no reposition)

Models further than Visibility × 3:
  • Do NOT automatically lose Hidden status
  • UNLESS within LOS of Opposing models in Wait status

Suddenness:
  • Models Hidden at start of action receive +1 Modifier die Combat Hit Tests
```

### Detect Action
```
Detect — First Detect costs 0 AP. Otherwise 1 AP.
         Perform Opposed REF Test vs Hidden target within LOS.
         On success: remove Hidden status, make Revealed.

Detect OR = Visibility
Apply Situational Test Modifiers as necessary.
```

---

## My Errors (Corrected)

### Error 1: AI Can't Target Hidden for Movement

**My Incorrect Statement:**
> "AI has no visible targets → can't attack"

**CORRECTION:** AI **CAN** pathfind and move towards Hidden models.

**QSR Rule:** Hidden models are **IN LOS but behind Cover**. The AI (with god-mode) knows their position and can:
- Move towards them
- Pathfind to intercept
- Position to cut off reposition options

**Implementation:** `getEnemyCharacters()` in `AIGameLoop.ts` returns ALL enemies including Hidden:
```typescript
private getEnemyCharacters(character: Character): Character[] {
  return this.manager.characters.filter(
    c => c !== character && /* ... same side check ... */
  );
  // ✅ No isHidden check - AI sees Hidden enemies
}
```

---

### Error 2: Moving Doesn't Help Reveal Hidden

**My Incorrect Assumption:**
> "Detect fails ~50%, moving doesn't help"

**CORRECTION:** Moving CAN force Hidden models to lose Hidden status.

**QSR Rule (Line 848):**
> "Passive models must lose Hidden status if without Cover during the Active model's movement"

**Mechanic:**
1. Active model moves towards Hidden enemy
2. If movement causes Hidden enemy to be **without Cover** from Active model's new position
3. Hidden enemy **must lose Hidden status**
4. Hidden enemy can **reposition up to MOV × 1"** to find new Cover
5. If no Cover available → stays Revealed → can be attacked

---

### Error 3: Wait Doesn't Help

**My Incorrect Statement:**
> "AI doesn't use Wait strategically"

**CORRECTION:** Wait is **VERY powerful** vs Hidden models.

**QSR Rule (Line 860):**
> "While in Wait status, double Visibility OR. 
>  All Hidden Opposing models in LOS but not in Cover are immediately Revealed."

**Mechanic:**
1. Model acquires Wait status (2 AP, or 1 AP to maintain)
2. Visibility OR doubles (16 MU → 32 MU for Day/Clear)
3. **ALL Hidden models in LOS but not in Cover are auto-Revealed**
4. No Detect test needed - automatic

---

### Error 4: Hidden = Invisible

**My Incorrect Assumption:**
> "Hidden models can't be targeted"

**CORRECTION:** Hidden models are **concealed, not invisible**.

**QSR Rules:**
- Hidden = In LOS + Behind Cover
- Visibility to Hidden models is **HALVED** (16 MU → 8 MU)
- Can still be targeted for:
  - Movement (pathfinding)
  - Detect tests (Opposed REF)
  - Area attacks (if qualified)
  - Wait status (auto-reveal if not in Cover)

---

## Correct AI Behavior

### Turn 1: Both sides Hide
```
Alpha models: Hide behind Cover (1 AP each, or 0 AP if not in LOS)
Bravo models: Hide behind Cover (1 AP each)
Remaining AP: 1 per model
```

### Turn 2+: AI Should Do This

**Option A: Move to Force Reveal**
```
Character has 2 AP
1. Move towards Hidden enemy (1 AP)
   - If this puts enemy without Cover → enemy loses Hidden
   - Enemy can reposition MOV × 1" to find new Cover
   - If no Cover available → enemy stays Revealed
2. Attack Revealed enemy (1 AP)
   OR
   Detect if still Hidden (0 AP - first Detect is free!)
```

**Option B: Wait to Auto-Reveal**
```
Character has 2 AP
1. Acquire Wait status (2 AP if not Outnumbered)
   - Visibility OR doubles (16 → 32 MU)
   - All Hidden enemies in LOS but not in Cover auto-Reveal
2. Next Initiative: Maintain Wait (1 AP) or Attack Revealed enemies
```

**Option C: Detect Then Attack**
```
Character has 2 AP
1. Detect (0 AP - first is free!)
   - Opposed REF Test
   - On success: enemy Revealed
2. Attack Revealed enemy (1 AP)
   OR
   Move closer if Detect failed (1 AP)
```

**Option D: Coordinate with Allies**
```
Multiple allies target same Hidden enemy:
1. Ally 1: Detect (0 AP) - may fail
2. Ally 2: Detect (0 AP) - may succeed
3. Ally 3: Move to cut off reposition (1 AP)
4. Ally 4: Wait to double Visibility (2 AP)
```

---

## Why Stalemate Happens

### Current AI Behavior (Wrong)
```
Turn 1: All models Hide (1 AP each)
Turn 2: 
  - Detect (1 AP - WRONG, should be 0 AP)
  - Detect fails (~50%)
  - 1 AP remaining → Hold (wasted)
Turn 3-6: Repeat Turn 2
```

### Correct AI Behavior
```
Turn 1: All models Hide (1 AP each)
Turn 2:
  - Detect (0 AP - first is free!)
  - If fails: Move closer (1 AP)
    - Forces enemy to reposition or lose Hidden
  - If succeeds: Attack (1 AP)
Turn 3:
  - Some models: Wait (2 AP) to double Visibility
  - Some models: Move to cut off reposition (1 AP)
  - Some models: Detect revealed targets (0 AP)
Turn 4-6: Combat occurs
```

---

## Required Fixes

### Priority 1: First Detect is Free
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

**Reset at start of activation:**
```typescript
// GameManager.ts: beginActivation()
character.state.hasDetectedThisActivation = false;
```

---

### Priority 2: Move After Failed Detect
**File:** `CharacterAI.ts` - Add fallback logic

```typescript
if (detectDecision.shouldDetect) {
  const result = attemptDetect(...);
  if (!result.success) {
    // Failed Detect - move closer to force reveal
    const moveDecision = calculateMoveToForceReveal(character, target, context);
    return moveDecision;
  }
}
```

---

### Priority 3: Wait as Strategic Option
**File:** `UtilityScorer.ts` - Increase Wait value vs Hidden

```typescript
const hiddenEnemyCount = enemies.filter(e => e.state.isHidden).length;
if (hiddenEnemyCount > 0) {
  // Wait is valuable - doubles Visibility, auto-reveals Hidden not in Cover
  waitScore += hiddenEnemyCount * 1.5;
}
```

---

### Priority 4: Pathfind Towards Hidden
**File:** `CharacterAI.ts` - Force movement towards Hidden

```typescript
// When all enemies are Hidden, move towards nearest
const hiddenEnemies = enemies.filter(e => e.state.isHidden);
if (hiddenEnemies.length > 0 && apRemaining >= 1) {
  const nearest = findNearest(hiddenEnemies, characterPos);
  const moveDecision = calculateMoveTowards(character, nearest.position);
  return moveDecision;
}
```

---

### Priority 5: Coordinate Ally Detects
**File:** `TacticalPatterns.ts` - Focus fire Detect

```typescript
// Track which Hidden enemies allies are Detecting
const detectTargets = new Map<string, number>();
for (const ally of allies) {
  if (ally.lastAction === 'detect' && ally.lastTarget) {
    const count = detectTargets.get(ally.lastTarget) || 0;
    detectTargets.set(ally.lastTarget, count + 1);
  }
}

// Prioritize targets with multiple Detects (likely to succeed soon)
const priorityTarget = findMax(detectTargets);
if (priorityTarget && priorityTarget.count >= 2) {
  // Join the Detect effort
  return { type: 'detect', target: priorityTarget };
}
```

---

## Testing Plan

1. **Implement Fix 1** (First Detect is Free)
2. **Run AI battles** and track:
   - Detect actions per turn (should increase)
   - AP utilization (should improve)
   - Movement after failed Detect (should see more)
   - Wait usage vs Hidden (should increase)
   - Combat actions (should be > 0)

3. **Expected outcome:**
   - Turn 1: Both sides Hide
   - Turn 2: Free Detects, some succeed, some Move closer
   - Turn 3: Wait status reveals more Hidden
   - Turn 4+: Combat occurs, VP scored

---

## Conclusion

**The AI planning architecture is CORRECT.**

**The issue is tactical decision quality:**
1. ❌ Not using "First Detect is Free" rule
2. ❌ Not moving to force Hidden models out of Cover
3. ❌ Not using Wait to auto-reveal Hidden
4. ❌ Not coordinating ally Detects
5. ❌ Wasting remaining AP on Hold instead of Move

**Fixes are tactical behavior adjustments, not architectural changes.**
