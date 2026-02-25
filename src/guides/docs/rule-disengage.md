---
title: Performing Disengage
description: Rules for performing disengage actions to escape close combat in MEST Tactics QSR.
---

# Performing Disengage

The **Disengage** action is performed when a character is **Engaged** during Close Combat with an **Ordered Opposing** target. It is performed similar to a Close Combat Attack action.

## Overview

### Weapon Requirements
- Announce a weapon to be used
- The character must be armed with a weapon of class **Melee** or **Natural**, or have the **Melee** trait
- If the weapon is not of class Melee or Natural, the attack must be used as an **"Improvised Melee"** weapon
- All characters are otherwise considered **"Unarmed"**

### Delay Tokens
Unless using a Natural weapon, the Active character acquires a **Delay token** if this is not its first Disengage action this Initiative.

### Target Selection
- Announce an **Ordered Opposing** model that has the Active model within **Melee Range** as the target
- This target is the **Passive** character and the **Defender** for this action

### Action Point (AP) Cost
- **Standard Cost**: 1 AP
- **Zero AP Conditions** (any of the following):
  - If the Active model has a **higher Physicality** than any of its Opposing models to which it is Engaged, then the **first Disengage action** this Initiative costs **zero AP**
    - *Physicality = higher of STR or SIZ*
  - **Automatic pass**; do not perform Test if target is **Outnumbered** by use of a Friendly Attentive model which is not itself Outnumbered
  - **Automatic pass**; do not perform Test if there are **no Ordered Opposing targets**

## Resolving Disengage

### Step 1: Disengage Test
Resolve the Disengage action as though performing a Close Combat Hit Test, but using **Opposed REF versus CCA**:
- **REF** for the **Active** character (the disengager)
- **CCA** for the **target** character (the Defender)

This is the **"Disengage Test"**.

### Step 2: Presume Defender Status
Presume that the **Active character is the Defender** for modifier purposes.

### Step 3: Apply Situational Modifiers
Apply any Situational Test Modifiers as necessary:

| Modifier | Effect | Condition |
|----------|--------|-----------|
| **Assist** | Bonus | Friendly models assisting |
| **Cornered** | -1m | Engaged on one side, wall/precipice on other |
| **Defend** | +1b | Defender using Defend action |
| **High Ground** | +1m | Base above half of Opposing model's base-height |
| **Flanked** | -1m | Engaged by two Opposing models on either side |
| **Hindrance** | -1m per | Wound, Fear, or Delay tokens |
| **Outnumber** | +1w per | More Friendly models in Melee Range |
| **Overreach** | -1m | Declared Overreach with attack |
| **Size** | +1m per | Opposing model larger by 1, 2, 5, or 10 SIZ |
| **Suddenness** | +1m | Disengager has Suddenness status |
| **Confined** | -1m | Confined by Terrain (vertical, horizontal, or behind) |

### Step 4: Add Weapon Accuracy
The target applies their weapon's **Accuracy** bonus. This appears as **"Acc"** on the weapon's stat line on the Weapons list.

## Determine the Results

### Upon Failure
- The Active character **stays in place**
- Disallow Opposing model any **Passive Player Options**

### Upon Pass
- Reposition the Active model up to **MOV × 1"**
- The character is now **Free** (no longer Engaged)

## Related Rules

- [Combat](./rules-combat) - General combat resolution
- [Actions](./rules-actions) - Character actions including Disengage action
- [Movement & Terrain](./rules-movement-and-terrain) - Movement rules after successful disengage
- [Status](./rules-status) - Delay tokens and other status effects
- [Performing Close Combat](./rule-close-combat) - Close combat attack rules

## Source

MEST Tactics Quick Start Rules (MEST.Tactics.QSR.txt), Lines 955-973
