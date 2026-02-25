---
title: Performing Direct Range Combat
description: Rules for performing direct range combat attacks in MEST Tactics QSR.
---

# Performing Direct Range Combat

Direct Range Attacks must be against **Revealed** targets which are characters that are within **LOS** (Line of Sight). Range Combat is intense, and each Hit Test resolved merely highlights one of perhaps several aims, sweeps, ducks, and shots attempted or taken during the course of each Turn and Round.

## Overview

### Weapon Requirements
- Announce a **Ranged weapon** to be used
- The weapon must have an **OR** (Optimal Range) value, be a **Thrown** weapon, or have the **Throwable** trait
- Otherwise, it must be used as an **"Improvised Thrown"** weapon

### Range Rules
- **Thrown** or **Bow** weapons have an OR written as **STR** or **STR + X"** to indicate that it is equal to the Attacker's STR
- If OR is **zero**, it becomes **0.5 MU**
- If OR is **negative**, disallow the Attack

### Reveal Trait
If the weapon has the **[Reveal]** trait, remove the Attacker's **Hidden** status if in LOS. This applies to all **Firearms** weapons.

### Ammunition Rules
- **Thrown weapons** always replenish after usage
- Weapons with the **Throwable** trait do **not** replenish and use the rules for the **[Discard]** trait when thrown

### Delay Tokens
Unless using a Natural weapon, the Active character acquires a **Delay token** if this is not its first attack this Initiative.

### Target Selection
- Announce a **Revealed** model within **LOS** as the target for the Range Combat Attack
- This target is the **Passive** character and the **Defender** for this attack
- It can be a Friendly model, but have another player roll any dice for it

### Line of Sight (LOS)
- **LOS to a target is blocked** if it passes through the volume of a model of **higher SIZ** than the Active model or target
- To measure distances greater than a single measuring stick, use multiple sticks, or a measuring tape

## Resolving Direct Range Attacks

### Step 1: Hit Test
Resolve this attack by performing the **Range Combat Hit Test** using **Opposed RCA vs. REF** (Attacker's RCA vs. Defender's REF).

**Tie Rule:** If the Attacker's score equals the Defender's score, the **Attacker wins** (Active model advantage). The Attacker receives **1 cascade** minimum on a tie or win.

### Step 2: Apply Situational Modifiers
Apply any Situational Test Modifiers as necessary:

| Modifier | Effect | Condition |
|----------|--------|-----------|
| **Hindrance** | -1m per | Wound, Fear, or Delay tokens on Attacker |
| **Distance** | -1m per OR Multiple | Target beyond Optimal Range |
| **Point-blank** | +1m | Target at very close range |
| **Direct Cover** | +1b | Defender has direct cover |
| **Intervening Cover** | +1m | Cover between Attacker and Defender |
| **Defend** | +1b | Defender using Defend action |
| **Suddenness** | +1m | Attacker has Suddenness status |
| **Elevation** | +1m | Attacker higher than opponent by 1" for every 1" away |
| **Confined** | -1m | Confined by Terrain (vertical, horizontal, or behind) |
| **Obscuring Models** | -1m per threshold | 1, 2, 5, or 10 models obscuring target |
| **Leaning** | -1b | Attacker or target is leaning |

### Step 3: Add Weapon Accuracy
Add the weapon's **Accuracy** bonus. This appears as **"Acc"** on the weapon's stat line on the Weapons list.

## To the Damage Test

If the Hit Test was **passed** (Attacker score ≥ Defender score), cascades are generated:
- **Tie (score difference = 0):** Attacker wins and receives **1 cascade**
- **Win (score difference > 0):** Attacker receives cascades equal to the score difference (minimum 1)

These cascades carry over to the Damage Test and contribute to wounds.

### Step 4: Damage Test
Perform the **Range Combat Damage Test** using the weapon's **Damage Rating** vs. target **FOR** (Fortitude).

- Hit Test cascades are added as carry-over dice to the Damage Test
- Upon **pass**, the target is **Wounded** (wounds = cascades - effective Armor Rating)
- See the [Damage & Morale](./rules-damage-and-morale) section for more information

## Related Rules

- [Combat](./rules-combat) - General combat resolution
- [Damage & Morale](./rules-damage-and-morale) - Damage resolution and injuries
- [Actions](./rules-actions) - Character actions including Attack actions
- [Traits List](./rules-traits-list) - Weapon and character traits
- [Indirect Combat](./rules-indirect) - Indirect range combat rules
- [Friendly Fire & LOF](./rules-friendly-fire-los) - Friendly fire and line of fire rules
- [Scatter Diagram](./rules-scatter) - Scatter for indirect attacks

## Source

MEST Tactics Quick Start Rules (MEST.Tactics.QSR.txt), Lines 932-954
