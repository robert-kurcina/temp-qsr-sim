---
title: Advanced Rules - Firelane
description: Complete rules for Fire-lane weapons, Braced/Emplaced status, and Suppressive Fire.
priority: 6
---

# Advanced Rules - Firelane

**Rule Level:** Advanced ()

Very powerful Modern Age "**Support**" weapons, such as Machine Guns, normally receive the **Fire-lane** trait.

---

## Prepare Fire-lane

### Prepare Action

Either:
- Spend **1 AP as a Fiddle action** and become **Braced**, OR
- Spend **2 AP** and be **Emplaced**

Mark with **Braced** or **Emplaced** status marker, by identifying and placing it in the "**front-half**" of the model. This creates and limits its "**Field-of-Fire**" [FOF] and which models can be targeted.

**Costs zero AP to maintain Braced or Emplaced.**

### Gunner

If a weapon has the **[Emplaced]** trait, it requires a Gunner.

- A **Friendly Free Ordered** model in **base-contact** with an **[Emplaced]** weapon to use it for Attacks is its "**Gunner**"
- In many sculpts, the weapon and the Gunner are modelled and placed upon the same base-diameter

### Loader

A **Loader** is an optional role, and is usually one of the models associated with **[Crewed]** weapons.

- An **Attentive Friendly Free Ordered** model in **base-contact** with the Gunner and also the weapon can be a "**Loader**"

---

## Constraints

### When Braced

When a Fire-lane weapon is **Braced**, the model associated with it (or the Gunner) is penalized:
- **-1 Modifier die Defender Combat Tests**

### When Emplaced

When a Fire-lane weapon is **Emplaced**, the model associated with it (or the Gunner) is penalized:
- **-1 Wild die Defender Combat Tests**

---

## Removal

Remove any **Braced** or **Emplaced** status at the end of an Action:
- Whenever the player controlling the Fire-lane weapon (or its Gunner) decides
- When the Gunner becomes **Engaged**, **repositions** or **moves**, is **KO'd** or **Eliminated**
- When the weapon is no longer Emplaced, is **Out-of-Play**, or otherwise unavailable

---

## General Benefits

While **Braced** or **Emplaced**, the Fire-lane weapon allows interrupts, and creates a new Passive Player Option known as "**Suppressive Fire!**"

Whenever any target enters or moves within **LOS** and within its **Field-of-Fire [FOF]**:

### Stability

Effectively **increase STR** by:
- **+1 if Braced**, or
- **+2 if Emplaced**

When affected by **[Recoil]** or **[Jitter]**.

### Suppressive Fire!

If **Attentive**, receive a number of **Suppression markers equal to the weapon's ROF X trait**.

1. **Place** at least one Suppression marker within range to the target, and LOS of the Gunner or weapon
2. **Place** the remaining Suppression markers among other Opposing models in LOS if they are within Cohesion to the LOF through the first target
3. When finished, **roll a Modifier die for each Suppression marker placed**. If any miss, acquire a Delay token. Remove any Wait token instead if present

---

## Emplaced Benefits

There are additional benefits while **Emplaced**.

### Steady

Receive **+1 Suppression effect**.

### Effective

When acquiring a Delay token after finishing the Suppress step above:
- Instead **roll 2 Modifier dice**
- Acquire a Delay token **only when all are misses**

### Team-work

A **Free Attentive Ordered Loader** may acquire a **Delay token** at any time to:
- Remove any one **Out-of-Ammo!** or **Jammed!** status markers, OR
- Receive the **Delay token from the Gunner**

---

## Related Traits

| Trait | Description |
|-------|-------------|
| **Fire-lane** | Weapon can be Braced or Emplaced for Suppressive Fire |
| **ROF X** | Rate of Fire - determines Suppression markers |
| **[Emplaced]** | Requires Gunner, provides Emplaced benefits |
| **[Crewed X]** | Requires X models to operate |
| **[Recoil]** | Attack Effect - push back attacker |
| **[Jitter]** | Attack Effect - extra AP if ROF > STR |

---

## Related Files

- [[rules-advanced-rof|Advanced Rules - ROF Weapons]] - ROF markers and attacks
- [[rules-advanced-suppression|Advanced Rules - Suppression]] - Suppression markers and effects
- `src/lib/mest-tactics/traits/combat-traits.ts` - Fire-lane trait implementations

---

**Source:** `docs/canonical/MEST.Tactics.Advanced-Firelane.txt`
