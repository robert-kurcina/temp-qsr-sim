---
title: "Rules: Movement"
dependencies:
  - "Rules: Actions"
  - "Rules: Terrain"
  - "Rules: Tests and Checks"
status: "Complete"
---

# Movement Rules

## Overview

Movement in MEST Tactics uses the **MOV attribute** to relocate models across the battlefield. Movement is measured in **Measured Units (MU)**, where 1 MU = 1 inch = base diameter of a SIZ 3 model.

## Movement Allowance

### Base Movement

| Action | AP Cost | Distance |
|--------|---------|----------|
| **Move** | 1 AP | **MOV + 2"** |
| **Move (both AP)** | 2 AP | **(MOV + 2") × 2** |

**Examples:**
| MOV | Per AP | Per Turn (2 AP) | Per Turn (Push) |
|-----|--------|-----------------|-----------------|
| 1 | 3" | 6" | 9" |
| 2 (Average) | 4" | 8" | 12" |
| 3 (Elite) | 5" | 10" | 15" |
| 4 | 6" | 12" | 18" |

### Pushing

Once per Initiative, characters with no Delay tokens may **Push**:
- **Gain:** +1 AP
- **Cost:** Acquire 1 Delay token
- **Result:** Can move **(MOV + 2") × 3** in one turn

---

## Movement Mechanics

### Direction Changes

- Move in **straight segments**
- **Up to MOV direction changes** per Move action
- **Additional facing change** allowed before using Movement keyword traits

**Example (MOV 2):**
```
Start → 4" straight → turn → 4" straight → turn → done
```

### Measuring

- Measure from **leading edge** of base in direction of movement
- Use measuring stick with 1" segments
- All models move in straight lines per AP spent

### Interrupts

When a model's movement is interrupted by a React:
- Place a **pawn/marker** at current position for reference
- Resume from that position after React resolves

---

## Terrain Effects on Movement

### Terrain Categories

| Terrain | Movement Cost | Notes |
|---------|---------------|-------|
| **Clear** | 1" per 1" | Default for Fields |
| **Rough** | 2" per 1" | Rocky areas, uphill |
| **Difficult** | 2" per 1" | Must stop or acquire Delay token |
| **Impassable** | Cannot cross | Walls, cliff-faces |

### Terrain Defaults

| Feature | Default Terrain |
|---------|-----------------|
| **Fields** | Clear |
| **Walls** | Impassable |
| **Hills/Ramps** | Rough (1 MU rise per 2 MU run) |
| **Staircases** | Rough |
| **Ladders** | Rough (up or down) |
| **Ropes** | Difficult (climb up) |
| **Open Doorways** | Clear |
| **Small Doorways** | Rough (≤ half base-height) |
| **Open Windows** | Difficult |
| **Small Windows** | Impassable (≤ half base-diameter) |

### Movement Cost Examples

**MOV 2 character crossing different terrain:**

| Terrain | Distance Crossed | AP Cost |
|---------|-----------------|---------|
| Clear (8") | 8" | 1 AP |
| Rough (4") | 4" | 2 AP (2" per 1") |
| Difficult (2") | 2" | 1 AP + Delay token |

---

## Agility (Advanced Rule)

**Agility = MOV × ½"** (keep fractions up to 0.5")

### Agility Uses

| Action | Agility Cost | Effect |
|--------|--------------|--------|
| **Bypass** | Up to Agility | Make Rough/Difficult terrain Clear |
| **Climb** | As needed | Reach across gaps, climb up/down |
| **Jump Up** | Up to ½ Agility | Clear terrain |
| **Jump Down** | Up to Agility | Clear terrain |
| **Jump Across** | Up to Agility | Clear (if Attentive) |
| **Running Jump** | Bonus Agility | +¼ distance moved for jump |
| **Leaning** | Up to Agility | Establish LOS from behind Cover |

### Jump Rules

**Jump Down:**
- Clear terrain up to Agility
- **Wound** if within last 0.5 MU of Agility or more

**Jump Across:**
- Requires **Attentive** status
- Clear terrain up to Agility
- **+0.5 MU across per 1 MU down**
- **Delay token** if ledge grab needed

**Running Jump:**
- **Bonus Agility = ¼ of straight distance moved** (single Action)
- Horizontal or downwards only
- Can reach upwards at base-height if ledge available before mid-point

### Climbing

| Action | Hand Requirement | Notes |
|--------|-----------------|-------|
| **Climb Up** | [2H] | Acquire Delay token |
| **Climb Down** | [1H] | No Delay token |
| **Rope Climb Up** | [2H] | Difficult terrain |
| **Rope Climb Down** | [1H] | Rough terrain |

---

## Engaged Movement

### Disengage Required

An Active model that is **Engaged** must:
1. **Perform Disengage action** (1 AP), OR
2. **Cannot leave** engagement

### Movement Ends When

- Become **Engaged** with Attentive Ordered Opposing model
- Enter **Difficult terrain** (without Agility bypass)
- **AP exhausted**

### Crossing Bases

| Model Status | Can Cross As | Limit |
|--------------|--------------|-------|
| **Friendly** | Degraded terrain | Once per Initiative |
| **Friendly (Distracted/Engaged)** | Cannot cross | — |
| **Opposing (Disordered/Distracted)** | Degraded terrain | Once per Initiative |
| **Opposing (Attentive/Ordered)** | Cannot cross | — |
| **KO'd Models** | Degraded terrain | Reposition as needed |

---

## Repositioning

**Reposition** = Relocate model without triggering Reacts

### When Repositioning Occurs

| Trigger | Distance | Restrictions |
|---------|----------|--------------|
| **Hidden → Revealed** | MOV × 1" radius | Must be behind Cover or out of LOS |
| **Disengage (Success)** | MOV × 1" | Away from engaging model |
| **Suddenness** | MOV × 1" | When losing Hidden status |

### Repositioning Rules

- **Does not trigger Reacts**
- Must be reachable path (not through locked doors, traps, or Opposing models)
- **Hidden repositioning:**
  - Must be location reachable with 2 AP (Move + Fiddle)
  - Path must be behind Cover or out of LOS
  - Can be into base-contact or LOS of Active model

---

## Tight Spot Navigation

### Narrow Areas

| Situation | Rule |
|-----------|------|
| **Narrow gaps** | Can cross at ½ base-diameter |
| **Narrow walls** | Can cross at ½ base-diameter |
| **Wide walls** | Must jump down if < ½ base-diameter wide |

### Low Obstacles

- **Crouch below** obstacles no lower than ½ base-height
- Treat as **degraded terrain**

---

## Movement Examples

### Example 1: Average Character (MOV 2) Clear Terrain

**Turn 1:**
- **AP 1:** Move 4" (MOV 2 + 2")
- **AP 2:** Move 4" (MOV 2 + 2")
- **Total:** 8" movement

**Turn 2 (with Push):**
- **AP 1:** Move 4"
- **AP 2:** Move 4"
- **Push:** +1 AP, gain Delay token
- **AP 3:** Move 4"
- **Total:** 12" movement

### Example 2: Elite Character (MOV 3) Rough Terrain

**Turn 1:**
- **AP 1:** Move 2.5" in Rough (5" cost for 2.5")
- **AP 2:** Move 2.5" in Rough (5" cost for 2.5")
- **Total:** 5" movement (cost 10")

### Example 3: Crossing Mixed Terrain (MOV 2)

**Starting position → 2" Clear → 2" Rough → 2" Clear → Goal**

**AP Cost:**
- 2" Clear = 2" movement cost = 0.5 AP
- 2" Rough = 4" movement cost = 1 AP
- 2" Clear = 2" movement cost = 0.5 AP
- **Total:** 2 AP for 6" total distance

---

## Quick Reference

### Movement Distance Table

| MOV | Clear (per AP) | Clear (2 AP) | Push (3 AP) | Rough (per AP) |
|-----|----------------|--------------|-------------|----------------|
| 1 | 3" | 6" | 9" | 1.5" |
| 2 | 4" | 8" | 12" | 2" |
| 3 | 5" | 10" | 15" | 2.5" |
| 4 | 6" | 12" | 18" | 3" |

### Terrain Movement Costs

| Terrain | Cost | Must Stop? | Delay Token Option |
|---------|------|------------|-------------------|
| Clear | 1" per 1" | No | N/A |
| Rough | 2" per 1" | No | N/A |
| Difficult | 2" per 1" | Yes | Yes, continue |
| Impassable | Cannot enter | N/A | N/A |

---

## Related Rules

- [[rules-actions|Rules: Actions]] — Move action, Pushing
- [[rules-terrain|Rules: Terrain]] — Terrain types and effects
- [[rules-combat|Rules: Combat]] — Engagement rules
- [[rules-advanced|Rules: Advanced]] — Agility, Repositioning

---

## QSR References

- **Move Action:** Lines 805-812
- **Pushing:** Lines 775-778
- **Movement Allowance:** Lines 865-868
- **Direction Changes:** Lines 869-872
- **Terrain Effects:** Lines 640-660
- **Agility:** Lines 880-900
- **Repositioning:** Lines 910-925
