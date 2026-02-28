---
title: "Rules: Friendly Fire & LOF"
dependencies:
  - "Rules: Terrain"
  - "Rules: Combat"
  - "Rules: Random Selection"
status: "Complete"
---

## Friendly Fire

**Friendly Fire** occurs when a **Direct Range Attack** misses its intended target. One randomly selected model (Opposing or Friendly) may become the new target.

### Friendly Fire Resolution Sequence

**When:** Direct Range Attack **misses** (Hit Test fails)

**Step 1: Identify Potential Targets**

Find models in the following **priority order**:

| Priority | Location | Description |
|----------|----------|-------------|
| **1st** | **In base-contact** with target | Models touching the intended target |
| **2nd** | **Within 1"** of target | Models within 1 MU radius of target |
| **3rd** | **Within 1" of LOF** to target | Models within 1 MU of Line of Fire corridor |

**Step 2: Select Random Target**

From the **highest priority group** that has models:
- Use **random selection** (see [[rules-random-selection|Rules: Random Selection]])
- If multiple models in same priority: roll 1d6 to select

**Step 3: Resolve Friendly Fire Attack**

The new target's controlling player performs:
- **Unopposed REF Test** as **Defender Hit Test**
- **DR = misses** from the failed Attack
- **Example:** Attack missed by 3 → DR 3 Unopposed REF Test

**On Pass:** Attack misses the new target (no effect)

**On Fail:** Attack hits the new target
- Proceed to **Damage Test** using original weapon's Damage rating
- Resolve damage normally

### Friendly Fire Exceptions

**Safe Models** (never at risk):
- **Friendly Attentive Ordered models in base-contact** with the **attacking model**
- These models are considered "behind" the attacker and out of the line of fire

### Concentrated Attack Exception

If the original attack was a **Concentrated Attack**:
- **Do NOT reduce Armor Rating** for the Friendly Fire damage resolution
- Normal AR reduction rules apply for all other cases

### Obscured Modifier

**Obscured** applies a **-1m penalty** to Attacker Hit or Detect Tests:

| Models in LOF | Penalty |
|---------------|---------|
| 1 model | -1m |
| 2 models | -1m |
| 5 models | -1m |
| 10 models | -1m |

**Count:**
- Models **within LOF** to the target
- **Non-Opposing models beyond** target but **within 1 MU of LOF**

---

## LOF & Obscured

### Line of Fire (LOF)

**LOF** is the line between two models and **beyond the target** (not necessarily in LOS).

**LOF Width:** Treated as a **1 MU wide corridor** for overlap checks.

### Obscured Rules

**Obscured** penalizes **-1m** to:
- **Attacker Hit Tests**
- **Detect Tests**

**Sources of Obscured:**
1. **Models within LOF** to target (1, 2, 5, or 10 models = -1m each)
2. **Non-Opposing models beyond target** but within 1 MU of LOF (-1m each)

**Example:**
```
Attacker → Model A → Model B → Target
           (Friendly) (Neutral)
           
Model A: Within LOF = -1m
Model B: Beyond target, within 1 MU of LOF = -1m
Total: -2m to Attacker Hit Test
```

---

## LOF Operations (Implementation Anchor)

### LOS/LOF Blockers

**Models as Blockers:**
- Models can block LOF for Friendly Fire and Obscured calculations
- LOF queries should return **all models** along the LOF segment

### Selection Order Summary

When determining Friendly Fire targets:

```
1. Check: Models in base-contact with target
   ↓ (if none)
2. Check: Models within 1" of target
   ↓ (if none)
3. Check: Models within 1" of LOF to target
   ↓ (if none)
No Friendly Fire occurs
```

### Random Selection Method

For Friendly Fire target selection:

**Method 1: Numbering**
1. Number each eligible model (1, 2, 3...)
2. Roll 1d6 (re-roll if over)
3. Select matching model

**Method 2: Closest Model**
1. Prefer base-contact
2. Then within 1"
3. Then within 1" of LOF
4. Tie-breaker: Roll 1d6 among tied models

---

## Quick Reference

### Friendly Fire Flowchart

```
Direct Range Attack misses?
         ↓
   Find models in priority order:
   1. Base-contact with target
   2. Within 1" of target  
   3. Within 1" of LOF
         ↓
   Select random model from highest priority
         ↓
   Target's player rolls: Unopposed REF Test
   DR = misses from original attack
         ↓
   Pass: Attack misses new target
   Fail: Attack hits → Damage Test
```

### Friendly Fire Modifiers

| Situation | Modifier |
|-----------|----------|
| **Concentrated Attack** | No AR reduction |
| **Friendly in base-contact with attacker** | Immune (safe) |
| **Obscured (per model)** | -1m to Hit Test |

---

## Related Rules

- [[rules-combat|Rules: Combat]] — Range Combat resolution
- [[rules-random-selection|Rules: Random Selection]] — Random target selection
- [[rules-situational-modifiers|Rules: Situational Modifiers]] — Obscured modifier
- [[rules-terrain|Rules: Terrain]] — LOF and terrain

---

## Source Reference

**Source:** `MEST.Tactics.QSR.txt` lines ~1300-1320 (Friendly Fire rules)
