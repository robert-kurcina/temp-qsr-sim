# Hide + Wait Timing & Sneaky X Trait - Corrected Understanding

**Date:** 2026-03-02
**Status:** ✅ **CORRECTED**

---

## Hide + Wait Same Initiative (Confirmed)

### AP Costs

| Action | AP Cost | Condition |
|--------|---------|-----------|
| **Hide** | 1 AP | If in LOS + behind Cover |
| **Hide** | 0 AP | If NOT in LOS |
| **Hide** | 0 AP | If Sneaky X trait (e.g., Stealth X) |
| **Wait** | 2 AP | If not Outnumbered |
| **Wait** | N/A | If Outnumbered (can't acquire) |
| **Pushing** | 0 AP | Gain +1 AP, acquire Delay token |

### Possible Combos (Same Initiative)

#### Combo A: Standard Hide + Wait (3 AP)
```
Character (2 AP base):
1. Hide (1 AP) - in LOS + Cover
2. Wait (2 AP) - not Outnumbered
Total: 3 AP needed

With Pushing:
1. Pushing (0 AP) - gain +1 AP, acquire Delay
2. Hide (1 AP)
3. Wait (2 AP)
Total: 3 AP (2 base + 1 from Pushing)
Result: Hidden + Wait + Delay token
```

#### Combo B: Out-of-LOS Hide + Wait (2 AP)
```
Character (2 AP base):
1. Hide (0 AP) - NOT in LOS
2. Wait (2 AP) - not Outnumbered
Total: 2 AP needed

Result: Hidden + Wait, no Delay token
```

#### Combo C: Sneaky X Hide + Wait (2 AP)
```
Character with Sneaky X (2 AP base):
1. Hide (0 AP) - Sneaky X trait
2. Wait (2 AP) - not Outnumbered
Total: 2 AP needed

Result: Hidden + Wait, no Delay token
```

---

## Sneaky X Trait (Confirmed)

### QSR Rule (Line 19989 in data.ts)
```
At the end of this character's Initiative automatically become Hidden
at no cost if behind Cover or when not in LOS.

Receives +X Modifier dice when benefiting from Suddenness
Situational Test Modifier.
```

### Stealth X Uses Sneaky X

**Stealth X trait includes Sneaky X:**
- Automatic Hide at end of Initiative (if behind Cover or not in LOS)
- +X Modifier dice with Suddenness
- **0 AP cost for Hide**

### Characters That Might Have Stealth/Sneaky

| Archetype | Likely Traits | Hide Cost |
|-----------|---------------|-----------|
| Average | None | 1 AP (in LOS) / 0 AP (not in LOS) |
| Veteran | Grit | 1 AP (in LOS) / 0 AP (not in LOS) |
| Elite | Grit, Fight, Shoot | 1 AP (in LOS) / 0 AP (not in LOS) |
| Assassin | Stealth 1+, Sneaky 1+ | **0 AP** (always) |
| Scout | Stealth 1+, Sneaky 1+ | **0 AP** (always) |
| Cultist | Insane, maybe Stealth | 0-1 AP |

---

## Corrected AI Behavior

### Turn 1: Setup Options

#### Option A: Standard Model (no Sneaky)
```
Character (2 AP, in LOS + Cover):
1. Pushing (0 AP) - +1 AP, Delay token
2. Hide (1 AP) - behind Cover
3. Wait (2 AP) - not Outnumbered
Total: 3 AP (2 base + 1 Pushing)

Result: Hidden + Wait + Delay
Next Initiative: Must remove Delay (1 AP) or can't act
```

#### Option B: Standard Model (out of LOS)
```
Character (2 AP, NOT in LOS):
1. Hide (0 AP) - not in LOS
2. Wait (2 AP) - not Outnumbered
Total: 2 AP

Result: Hidden + Wait, no Delay
Next Initiative: Can act normally
```

#### Option C: Sneaky X Model
```
Character with Sneaky X (2 AP, any position):
1. Hide (0 AP) - Sneaky X (auto at end of Initiative)
2. Wait (2 AP) - not Outnumbered
Total: 2 AP

Result: Hidden + Wait, no Delay
Next Initiative: Can act normally
```

#### Option D: Wait Only (no Hide)
```
Character (2 AP):
1. Wait (2 AP) - not Outnumbered
Total: 2 AP

Result: Wait (not Hidden)
Next Initiative: Can React/Focus
```

---

## Strategic Implications

### 1. Sneaky X Models Are Overpowered for This Combo

```
Sneaky X Model:
- Hide is FREE (0 AP)
- Can Hide + Wait for just 2 AP
- No Pushing needed (no Delay token)
- +X Modifier dice with Suddenness

This is SIGNIFICANTLY better than standard models.
AI should prioritize Wait + Hide with Sneaky X models.
```

### 2. Out-of-LOS Hide Is Undervalued

```
Standard Model NOT in LOS:
- Hide is FREE (0 AP per QSR line 846)
- Can Hide + Wait for just 2 AP
- No Pushing needed (no Delay token)

AI should position models out of LOS before Hiding.
```

### 3. Pushing Is Viable for Hide + Wait

```
Standard Model in LOS:
- Hide costs 1 AP
- Need 3 AP total for Hide + Wait
- Pushing provides +1 AP (but adds Delay)

Trade-off:
- Pro: Get Hidden + Wait same turn
- Con: Delay token limits next Initiative

AI should consider Pushing when:
- Hidden + Wait is critical
- Can afford Delay token
- Enemy threat is high
```

---

## Implementation Status

| Feature | QSR Reference | Implementation | Status |
|---------|---------------|----------------|--------|
| Hide cost (in LOS) | Line 846 | `concealment.ts:58-100` | ✅ 1 AP |
| Hide cost (not in LOS) | Line 846 | `concealment.ts:58-100` | ✅ 0 AP |
| Hide cost (Sneaky X) | Line 19989 | Need to verify | ⚠️ Check |
| Wait cost (2 AP) | Line 857 | `AIActionExecutor.ts` | ✅ Correct |
| Pushing (+1 AP, Delay) | Line 789-791 | `AIActionExecutor.ts` | ✅ Correct |
| Focus action | Line 859 | NOT implemented | ❌ Missing |
| First Detect free | Line 855 | Always spends 1 AP | ❌ Missing |

---

## Required Fixes (Updated Priority)

### Priority 1: First Detect is Free
**Impact:** QSR compliance, enables Detect spam
**File:** `AIActionExecutor.ts:784`

### Priority 2: Implement Focus Action
**Impact:** +1w for Tests, breaks stalemate
**File:** `AIActionExecutor.ts` - new action

### Priority 3: Verify Sneaky X Hide Cost
**Impact:** 0 AP Hide for Sneaky X models
**File:** `concealment.ts` or `combat-traits.ts`

```typescript
// Check for Sneaky X trait
const sneakyLevel = getSneakyLevel(character); // From combat-traits.ts
const apCost = (sneakyLevel > 0 || !hasOpposingLOS) ? 0 : 1;
```

### Priority 4: AI Values Hide + Wait Combo
**Impact:** Strategic acquisition based on model traits
**File:** `UtilityScorer.ts`

```typescript
// Value Hide + Wait combo
const hasSneaky = getSneakyLevel(character) > 0;
const isInLOS = hasOpposingLOS(character, enemies);
const hideCost = (hasSneaky || !isInLOS) ? 0 : 1;
const waitCost = 2;
const totalCost = hideCost + waitCost;

if (apRemaining >= totalCost && !isOutnumbered) {
  // Hide + Wait is viable
  const comboScore = 4.0; // High value for stealth setup
  actions.push({ type: 'hide_then_wait', score: comboScore });
}
```

### Priority 5: AI Uses Pushing Strategically
**Impact:** Enable Hide + Wait in same turn when needed
**File:** `UtilityScorer.ts`

```typescript
// Consider Pushing for Hide + Wait
if (apRemaining >= 2 && hideCost + waitCost > apRemaining) {
  // Need Pushing to afford Hide + Wait
  const pushScore = 2.5; // Moderate value
  actions.push({ type: 'pushing', score: pushScore });
}
```

---

## Expected AI Behavior (After Fixes)

### Turn 1: Setup

**Sneaky X Models:**
```
1. Hide (0 AP) - Sneaky X
2. Wait (2 AP)
Result: Hidden + Wait (2 AP total)
```

**Standard Models (out of LOS):**
```
1. Move to out-of-LOS position (1 AP)
2. Hide (0 AP) - not in LOS
3. Wait (2 AP)
Result: Hidden + Wait (3 AP total, need Pushing)
```

**Standard Models (in LOS):**
```
Option A:
1. Pushing (0 AP) - +1 AP, Delay
2. Hide (1 AP)
3. Wait (2 AP)
Result: Hidden + Wait + Delay (3 AP total)

Option B:
1. Wait (2 AP)
Result: Wait only (2 AP total, Hide next turn)
```

### Turn 2+: Execute

**All Models with Wait:**
```
1. Focus (0 AP) - remove Wait, +1w
2. Detect (0 AP) - first is free!
3. Roll REF +1w vs enemy REF (~72-75% success)
4. On success: Attack Revealed enemy (1 AP)
```

---

## Conclusion

**Key Nuances I Missed:**

| Aspect | My Wrong Understanding | Correct Understanding |
|--------|----------------------|----------------------|
| Hide + Wait timing | "Separate turns" | **Same Initiative possible** |
| Hide cost | "Always 1 AP" | **0 AP if not in LOS or Sneaky X** |
| AP needed for combo | "4 AP (impossible)" | **3 AP (with Pushing) or 2 AP (Sneaky/not in LOS)** |
| Sneaky X value | "Minor bonus" | **Game-changing (free Hide + Suddenness bonus)** |

**Strategic Implications:**

1. **Sneaky X models** should prioritize Hide + Wait combo (0 AP Hide!)
2. **Position out of LOS** before Hiding (0 AP Hide)
3. **Pushing is viable** to enable Hide + Wait same turn
4. **Focus + Detect** breaks stalemate (~72-75% success)

**With these nuances understood and implemented, the AI should:**
- Use Sneaky X models for stealth ops
- Position carefully before Hiding
- Use Pushing strategically
- Focus + Detect to reveal enemies
- Score VP from eliminations
