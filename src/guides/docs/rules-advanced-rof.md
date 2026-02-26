---
title: "Advanced Rules: ROF (Rate of Fire)"
description: ROF weapons, ROF markers, and area attack resolution.
status: "DEFERRED - Requires QSR implementation first"
dependencies:
  - "Rules: Combat"
  - "Rules: Traits List"
---

# Advanced Rules: ROF (▲)

**Status:** ⏳ **DEFERRED** - Requires core QSR implementation plus ROF trait support in `traits_descriptions.json`.

---

## Overview

**Rate-of-Fire (ROF)** weapons such as machine guns shoot many bullets or projectiles rapidly at any target and the swath of area near them. This allows many targets to be hit at once using **ROF markers**.

**ROF markers** are normally on the **reverse side of a Suppression marker**.

---

## ROF Trait

**ROF X** — Weapon trait that allows **X ROF markers** to be placed between potential targets.

**Common ROF Disability Traits:**
| Trait | Effect |
|-------|--------|
| **[Feed X]** | Weapon feeding mechanism |
| **[Jam X]** | Weapon jamming chance |
| **[Jitter]** | Recoil/instability |

**Note:** [Feed] and [Jam] can be ignored when learning (+5 BP per ignored trait).

---

## ROF Markers

### Placement

**Place up to X ROF markers** with these rules:

1. **Between targets** within LOS along the LOF
2. **Each marker** must not be more than **Cohesion** apart from the last
3. **Within LOS** — blocked by models
4. **May choose** to use fewer than X markers

**Restrictions:**
- **NOT within range** of Friendly models
- **NOT within range** of the Attacker
- **NOT within range** of target in **base-contact with Friendly model**

**Range of Effect:** **1" from marker center**

### Marker Management

- Place markers **on battlefield** and **atop Obstacles**
- **NOT upon model bases** (except SIZ 6+ or Vehicles)
- May attach to **Walls** for area-specific attacks
- Use **small d6** to count multiple markers in same location
- **Flip to Suppression** side if markers from prior Action exist in range

### ROF Degradation

Each additional time the Attacker uses ROF **this Initiative**, **reduce X by 1**.

---

## Resolving ROF Attacks

### Step 1: Identify Primary Target

- Choose **one target** as **Primary** (defaults to **closest**)
- Mark with **reminder pawn**
- **Cascades for Bonus Actions** come from Tests against Primary target

### Step 2: Resolve Attacks

For **every model** (Friendly or Opposing) **within LOS** and **within range of one or more ROF markers**:

1. **Resolve Attacker Range Combat** starting with **Primary target**
2. **Add +1 Wild die ("ROF die")** for **every marker in range** for Hit Test
3. **Concentrate bonuses** apply to **Primary target only**
4. Roll Concentrate bonus Wild die **separate from ROF dice**

### Step 3: Complete Resolution

- **Do NOT perform Bonus Actions** until all attacks resolved
- **Do NOT perform Morale Tests** until all attacks resolved
- **Remove ROF markers** afterwards (unless using Suppression rules)

---

## Situational Test Modifiers

| Modifier | Effect |
|----------|--------|
| **Obscured** | -1m per 1/2/5/10 models within LOF |
| **Snap-shot** | Reduce ROF available by 1 when using ROF during: React, Counter-fire, with Agility, or after Move action |

---

## Implementation Requirements

### Traits Needed

| Trait | Source | Status |
|-------|--------|--------|
| **ROF X** | weapons | ⏳ Not in traits_descriptions.json |
| **[Feed X]** | weapons | ⏳ Not in traits_descriptions.json |
| **[Jam X]** | weapons | ⏳ Not in traits_descriptions.json |
| **[Jitter]** | weapons | ⏳ Not in traits_descriptions.json |
| **[Jitter+]** | weapons | ⏳ Not in traits_descriptions.json |

### Markers Required

- **ROF/Suppression markers** (double-sided, 20-30 count)
- **Reminder pawns** for Primary target

### Runtime Components

- ROF marker placement system
- Multi-target attack resolution
- ROF die tracking
- Marker-to-Suppression conversion
- Snap-shot detection

---

## Related Rules

- [[rules-combat|Rules: Combat]] — Range Combat fundamentals
- [[rules-advanced-suppression|Rules: Advanced Suppression]] — Suppression markers
- [[rules-advanced-game|Rules: Advanced Game]] — Advanced rules index
- [[rules-situational-modifiers|Rules: Situational Modifiers]] — Obscured modifier

---

## Source Reference

**Source:** `docs/MEST.Tactics.Advanced-ROF.txt` (partial, ~80 lines reviewed)

**Status:** ⏳ **DEFERRED** — Pending QSR completion and trait system expansion
