---
title: "Advanced Rules: Suppression"
description: Suppression markers, Suppress action, and Crossing Suppression.
status: "DEFERRED - Requires QSR implementation first"
dependencies:
  - "Rules: Combat"
  - "Rules: Advanced ROF"
---

# Advanced Rules: Suppression (▲)

**Status:** ⏳ **DEFERRED** - Requires core QSR implementation plus Suppression/ROF trait support.

---

## Overview

**Suppression** is an **area deterrent** forcing models to either stay in position behind Cover or move away from their position. Attacks using **ROF** and attacks with the **Explosion trait** enable use of Suppression rules.

**Suppression markers** are normally on the **reverse side of an ROF marker**.

---

## ROF Marker Conversion

### Flipping ROF Markers

At the **very end of an Attack action** involving ROF, **after Morale Tests**:

1. **Remove** ROF markers **in range of the model that created them**
2. **Flip** remaining ROF markers to **Suppression side**
3. **Do NOT flip** if **all models in range are Done**

### Explosion Attacks

After resolving an attack with **Explosion trait**:
- Place **Suppression marker** at **each model** subject to **Blast Effect 1+** or **Frag Effect 1+**
- Model must have **LOS to attack location**
- Place marker **just before Direct Cover** or **just after/in base-contact with Soft Cover**

---

## Suppression Marker Removal

Suppression **dissipates slowly**. Removal requires vigilance by all players.

### Removal Timing

**At the end of any model's Initiative**, after it receives a **Done token**, or when it is **no longer In-Play**:

| Condition | Action |
|-----------|--------|
| **No In-Play models within range** | Remove all Suppression markers |
| **Only Initiative player's models in range** (unless also in range of Ready model) | Remove all Suppression markers |

**At the start of a Turn** (when Done tokens removed):
- **Flip all ROF markers** to show **Suppression side**

---

## Suppress Action

Models with ROF weapons may use a new **"Suppression Attack"**.

### Action Cost

| Option | Cost |
|--------|------|
| **Standard** | 2 AP |
| **Quick** | 1 AP + receive 1 Delay token |

### Resolution

1. **Announce** "Suppression Attack" (variation on Direct Range Combat Attack)
2. **Place ROF markers** and perform **Range Combat Hit Test**
3. **After Test**: Attacker receives:
   - **+1 ROF marker** base bonus
   - **+1 ROF marker** for every **two markers** placed before Test
4. **Place** new markers **within range of existing ROF markers**
5. **Follow Placement rules** to flip markers

---

## Effects of Suppression

### Suppression Range

Each Suppression marker has **Suppression range of 1" from its center**.
- Includes **1" vertically upwards** (can be jumped over/ignored at different elevations)
- Extends to **all models within range**
- Extends **through Soft Cover** but **NOT through Hard Cover**

### Suppression Effect

When a character **begins within range** of one or more Suppression markers and performs a **Test** (excluding Damage Test):

| Markers in Range | DR (Suppression Effect) |
|------------------|------------------------|
| **1** | DR 1 |
| **2** | DR 2 |
| **5** | DR 3 |
| **10+** | DR 4 (max) |

**Targeting:**
- If target is **within Suppression range AND behind Cover**: **penalize its Attacker**
- If **Active character** is **within Suppression range**: **penalize that character**

### Take Cover!

**Attentive Passive Ordered models behind Cover** may **immediately become Hidden status**.

See [[rules-bonus-actions|Rules: Bonus Actions]] for Passive Player Options.

---

## Attempting & Crossing Suppression

### Crossing Suppression

At the **start** and **during** an Active model's action, determine **total Suppression effect** within range if model would or could cross.

**Crossing Suppression happens when:**
- **Moving across or within** its 1" range (but **NOT away from**)
- **Performing any other Action except Hide** while within 1" range

### Suppression Test

When **Crossing Suppression**:
1. **Count total markers** that would be in range during action
2. **Apply DR** based on marker count (1/2/5/10 → DR 1/2/3/4)
3. **Perform Unopposed Test** (typically REF or POW)
4. **On fail**: Apply effects (Delay, Fear, or action cancellation)

---

## Implementation Requirements

### Traits Needed

| Trait | Source | Status |
|-------|--------|--------|
| **Explosion X** | weapons/items | ⏳ Not in traits_descriptions.json |
| **Blast X** | weapons/items | ⏳ Not in traits_descriptions.json |
| **Frag X** | weapons/items | ⏳ Not in traits_descriptions.json |
| **Suppress** | action | ⏳ Not in traits_descriptions.json |

### Markers Required

- **ROF/Suppression markers** (double-sided, 20-30 count)

### Runtime Components

- Suppression marker management
- ROF-to-Suppression conversion
- Suppression range detection (including 3D)
- Suppression Effect DR calculation
- Take Cover! automation
- Crossing Suppression detection
- Suppress action implementation

---

## Related Rules

- [[rules-advanced-rof|Rules: Advanced ROF]] — ROF weapons and markers
- [[rules-bonus-actions|Rules: Bonus Actions]] — Take Cover! Passive Option
- [[rules-advanced-game|Rules: Advanced Game]] — Advanced rules index
- [[rules-terrain|Rules: Terrain]] — Cover types (Soft/Hard)

---

## Source Reference

**Source:** `docs/MEST.Tactics.Advanced-Suppression.txt` (118 lines)

**Status:** ⏳ **DEFERRED** — Pending QSR completion and trait system expansion
