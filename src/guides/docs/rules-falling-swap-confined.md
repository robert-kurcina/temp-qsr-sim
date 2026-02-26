---
title: Falling, Swap, and Confinement
description: Special movement rules for falling damage, swapping positions, and confined spaces.
priority: 6
---

# Falling, Swap, and Confinement

This module covers special movement situations: falling from heights, swapping positions in combat, and fighting in confined spaces.

---

## Falling

A model is considered **falling** if it goes downwards from a ledge for a distance **further than its Agility**.

### Falling Effects

| Distance Fallen | Effect |
|-----------------|--------|
| **Within last 0.5 MU of Agility or more** | Acquire **1 Wound token** |
| **More than Agility** | Acquire **1 Wound token** + **1 Delay token** |

### Falling Test

If falling **more than Agility**, perform a **Falling Test**:

**Test Type:** Unopposed FOR Test

**Difficulty Rating (DR):**
- **Base DR = SIZ**
- **Increase DR by +1 per 4 MU beyond Agility** fallen
- Round to nearest whole number

**On Failure:**
- Assign **misses as Delay tokens** (Stun damage)

**Example:**
```
Character: SIZ 3, FOR 2, Agility 1"
Falls: 5" (4" beyond Agility)
DR = SIZ 3 + (4 MU ÷ 4) = DR 4
Character rolls 2 Base dice + FOR 2 = needs 4+ to pass
If fails by 2: acquires 2 Delay tokens
```

### Collision

When falling **into other models**:

| Target | Effect |
|--------|--------|
| **Falling model** | May **ignore one miss** on Falling Test |
| **Target models** | Must perform **Falling Test** using **same DR** as falling model |

**Use Cases:**
- Falling onto allies
- Landing on enemies
- Multi-model pile-up

---

## Swap Positions

**Swap Positions** allows models to switch places in congested Scrum configurations, especially helpful within buildings or dense terrain.

### Swap Rules

**During movement**, a model may **swap positions** with:
- **Disordered Distracted** models in base-contact, OR
- **Attentive Friendly Free** models in base-contact

**AP Cost:**
- **First Swap** during an Initiative: **zero AP**
- **Additional Swaps**: **1 AP each**

**After Swap:**
- If any model was **Disordered**: apply **1 Delay token** to **one of the non-Opposing models** (player's choice)

### Swap Restrictions

**Do NOT allow Swap** if:
- Target model is **Engaged to an Attentive Ordered Opposing model**
- Target model is **Distracted or Engaged** (for Friendly swaps)
- Path is blocked by **locked entry-ways, traps, or Opposing models**

### Use Cases

| Situation | Swap Type | Purpose |
|-----------|-----------|---------|
| **Wounded fighter in front** | Swap with Fresh ally | Bring in fresh combatant |
| **Archer needs melee cover** | Swap with Friendly warrior | Protect vulnerable model |
| **Disordered ally blocking path** | Swap past them | Clear movement path |
| **VIP extraction** | Swap VIP to safety | Move protected character |

---

## Confinement

A model is **Confined** when in base-contact with or near certain terrain for **any two directions**:
- **Horizontally** (walls on two sides)
- **Vertically above** (low ceiling)
- **Behind** (wall or obstacle at back)

### Confined Conditions

| Condition | Details |
|-----------|---------|
| **Reach trait requirement** | Model with **Reach** must have **at least half the Reach ability clear** of Terrain for those directions |
| **Cornered + Confined** | Model could be **both Cornered and Confined** (stacking penalties) |
| **Difficult terrain** | Models **upon Difficult terrain** count towards being Confined |
| **Impassable terrain** | Models in **base-contact with Impassable terrain** count towards being Confined |
| **Precipice** | Models near precipice, with **base-diameter at or over** precipice are **always regarded as Confined** |

### Confined Penalty

**Penalty:** **-1m** (Modifier die) for:
- **Close Combat Test** (Attacker)
- **Defender Range Combat Hit Test**

**Note:** This is a **Situational Test Modifier** that applies to specific Tests, not all Tests.

### Confined vs. Similar Conditions

| Condition | Trigger | Penalty |
|-----------|---------|---------|
| **Confined** | Terrain in 2+ directions (vertical, horizontal, behind) | -1m CC Test or Defender Range Hit |
| **Cornered** | Engaged on one side, wall/precipice/degraded on other | -1m Disengage and Hit Tests |
| **Flanked** | Engaged to two Opposing models on either side | -1m Disengage and Hit Tests |

**Stacking:** A model can be **Confined AND Cornered** simultaneously (both penalties apply).

---

## Falling and Terrain Interaction

### Falling onto Different Terrain

| Terrain | Effect |
|---------|--------|
| **Clear** | Standard falling rules |
| **Rough** | +1 Wound token (sharp rocks, debris) |
| **Difficult** | +1 Wound token + automatic Delay token |
| **Water** | No Wound tokens; may still acquire Delay (submersion) |
| **Net/Soft** | Reduce falling distance by 1-2 MU (GM discretion) |

### Falling from Moving Platform

If falling from a **moving platform** (cart, flying creature, etc.):

1. Calculate **horizontal displacement** = platform's MOV × time falling
2. Determine **landing location** accordingly
3. Apply **Falling rules** at landing location

---

## Swap and Engagement

### Swap During Engagement

When swapping positions with a model **in engagement**:

| Swap Target | Result |
|-------------|--------|
| **Friendly Free** | You become Engaged; ally becomes Free |
| **Disordered Distracted** | You become Engaged; they move aside |
| **Attentive Ordered Opposing** | **Swap NOT allowed** |

### Opportunity Attack and Swap

**Swapping does NOT trigger Opportunity Attack!** because:
- Swap is not a Move action
- Swap is a special repositioning rule
- Models remain in combat throughout

---

## Confinement in Buildings

### Room Fighting

| Room Size | Confinement Status |
|-----------|-------------------|
| **Small room (4×4 MU)** | All models Confined |
| **Medium room (8×8 MU)** | Models near walls may be Confined |
| **Large room (12×12+ MU)** | Center models not Confined |

### Corridor Fighting

| Corridor Width | Confinement Status |
|----------------|-------------------|
| **Narrow (1-2 MU)** | All models Confined |
| **Medium (3-4 MU)** | Models may be Confined if near walls |
| **Wide (5+ MU)** | Models not Confined |

### Staircase Fighting

| Position | Confinement Status |
|----------|-------------------|
| **On stairs** | Confined (vertical + horizontal) |
| **Top of stairs** | May be Confined (precipice) |
| **Bottom of stairs** | May be Confined (overhead) |

---

## Quick Reference

### Falling Test Formula

```
DR = SIZ + (MU beyond Agility ÷ 4), round to nearest whole number
On fail: acquire misses as Delay tokens
```

### Falling Distance Effects

| Fallen Distance | Wounds | Delay | Falling Test |
|-----------------|--------|-------|--------------|
| **≤ Agility - 0.5 MU** | 0 | 0 | No |
| **Agility to Agility + 0.5 MU** | 1 | 0 | No |
| **> Agility + 0.5 MU** | 1 | 1 | Yes (DR = SIZ + extra MU ÷ 4) |

### Swap AP Cost

| Swap # | AP Cost |
|--------|---------|
| **First per Initiative** | 0 AP |
| **Additional** | 1 AP each |

### Confined Penalty

| Test Type | Penalty |
|-----------|---------|
| **Close Combat Test** | -1m |
| **Defender Range Combat Hit Test** | -1m |
| **All other Tests** | None |

---

## Related Rules

- [[rules-movement|Rules: Movement]] — Movement actions and Agility
- [[rules-terrain|Rules: Terrain]] — Terrain types and effects
- [[rules-situational-modifiers|Rules: Situational Modifiers]] — Combat modifiers
- [[rules-actions|Rules: Actions]] — Action types and costs

---

## Source Reference

**Source:** `MEST.Tactics.QSR.txt`
- **Falling:** Lines ~1200-1220
- **Swap Positions:** Lines ~1250-1270
- **Confinement:** Lines ~1270-1290
