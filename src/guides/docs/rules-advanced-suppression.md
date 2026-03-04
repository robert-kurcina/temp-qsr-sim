---
title: Advanced Rules - Suppression
description: Complete rules for Suppression markers, Suppression Tests, and area denial tactics.
priority: 6
---

# Advanced Rules - Suppression

**Rule Level:** Advanced ()

Attacks using **ROF**, and attacks with the **Explosion** trait enable use of the Suppression rules. Suppression is an area deterrent forcing models to either stay in position in behind Cover or to move away from their position.

Suppression markers are used to identify where Suppression exists. These are normally on the reverse side of an ROF marker.

---

## Flipping ROF Markers

At the very end of an Attack action involving ROF, after performing any Morale Tests:

1. **Remove** any ROF markers which were placed in range of the model that created (and placed) them
2. **Flip** any remaining ROF markers to show their Suppression marker side. Do not do this if all models in range are Done

### Placement for Explosion Attacks

After resolving an attack which used the **Explosion** trait, place a Suppression marker at each model that was subject to a **Blast Effect of 1 or more**, or **Frag Effect of 1 or more**, and have LOS to the attack location.

Place the Suppression marker:
- Just before any Direct Cover, or
- Just after but in base-contact with any Soft Cover

---

## Removal

Suppression tends to dissipate slowly. Removing Suppression markers requires vigilance by all players.

At the end of any model's Initiative, after it receives a Done token, or when it is no longer In-Play:

1. **Remove** all Suppression markers which have no In-Play models within range
2. **Remove** all Suppression markers in range of the Initiative player's models unless they are also in range of a Ready model
3. At the start of a Turn, when Done tokens are removed, **flip** all ROF markers to show their Suppression marker side

---

## Suppress Action

Models with ROF weapons may use a new "**Suppression Attack**" which allows more Suppression markers.

### Suppress Action Rules

- **Announce** "Suppression Attack" which is a variation on the Direct Range Combat Attack
- **Cost:** Either **2 AP**, or **1 AP and receive a Delay token**
- **Place** the ROF markers and perform the Range Combat Hit Test as an Attack action
- **Afterwards**, the Attacker receives:
  - **+1 ROF marker**, and
  - **+1 ROF marker for every two** it placed before performing the Test
- **Place** these within range of any existing ROF markers
- Follow the Placement rules above to flip markers

---

## Effects of Suppression

Each Suppression marker has a **Suppression range of 1" from its center**. This includes 1" vertically upwards so that it can be jumped over or ignored by models at different elevations.

**Coverage:**
- Suppression extends to all models within range
- It extends through **Soft Cover** but **not Hard Cover**

### Suppression Effect

When a character begins within range of one or more Suppression markers and performs a Test (excluding the Damage Test), apply the Suppression effect as a **DR** as follows:

| Markers in Range | Suppression Effect (DR) |
|------------------|------------------------|
| 1 | DR 1 |
| 2 | DR 2 |
| 5 | DR 3 |
| 10+ | DR 4 (maximum) |

- If the target is within Suppression range and **behind Cover**, penalize its Attacker
- If the **Active character** is within Suppression range, penalize that character

### Take Cover!

**Attentive Passive Ordered** models behind Cover may immediately become **Hidden** status. See Passive Player Options for more information.

---

## Attempting & Crossing Suppression

At the start and during an Active model's action, determine the total amount of Suppression effect within range if a model would or could cross. This includes along the path of any attempted move.

### Crossing Suppression Happens When:

- **Moving across or within** its 1" range, but **not away from**
- Performing any **other Action except Hide** while within 1" range
- Being **forcibly repositioned or moved** into Suppression range
- Characters merely involved in a Test are **never** Crossing

---

## Morale Test

A model within Suppression range attempting to voluntarily cross must perform a **Fiddle action** with an **Unopposed POW Test**.

1. **Adjust** for the Suppression effect. It is a DR
2. **Apply** any Situational Test Modifiers for Morale Tests
3. If that **fails**, the model may not cross. Allow additional attempts
4. Otherwise, continue to the **Suppression Test** with any carryovers

---

## Suppression Test

When Suppression is crossed, a "Suppression Test" is required. This is required at most **once per Action**, but **never for the same Suppression markers** for any Initiative.

1. Perform the Suppression Test as **Unopposed REF Test** DR the Suppression effect
2. **Apply** Situational Test Modifiers for Defender Range Hit Combat
3. For each **miss**, receive a **Delay token as Stun damage**, up to the number of Suppression markers actually in range
4. Afterwards, perform the desired action

---

## Ignoring Suppression

Some models are so well armored or powerful that they might not experience Suppression. For each model, have the Opposing player check as follows:

### Core Damage

For the attack used, add **flat value plus number of dice** of the Damage Rating for the weapon.

### Core Defense

For the target:
1. **Reduce** its Armor Rating by Impact
2. **Reduce** by 3 for Concentrate if just placed
3. **Reduce** the total by **1 per ROF or Suppression marker** in range

### Compare

If **Core Damage < Core Defense**:
- Do **not** place Suppression markers
- Do **not** perform Suppression Tests
- Do **not** apply Suppression effects for that model

---

## Related Traits

| Trait | Description |
|-------|-------------|
| **ROF X** | Rate of Fire - enables Suppression |
| **Explosion** | Attack Effect - enables Suppression on Blast/Frag |
| **Suppress X** | Attack Effect - places Suppression tokens |

---

## Related Files

- [[rules-advanced-rof|Advanced Rules - ROF Weapons]] - ROF markers and attacks
- [[rules-advanced-firelane|Advanced Rules - Firelane]] - Fire-lane weapons and Suppressive Fire
- `src/lib/mest-tactics/traits/combat-traits.ts` - Suppression trait implementations

---

**Source:** `docs/canonical/MEST.Tactics.Advanced-Suppression.txt`
