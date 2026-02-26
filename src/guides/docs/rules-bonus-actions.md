---
title: Bonus Actions & Passive Player Options
description: Complete rules for spending cascades on Bonus Actions and using Passive Player Options during combat.
priority: 5
---

# Bonus Actions & Passive Player Options

This module details the special actions available after successful combat tests and the defensive options available to passive players.

---

## Bonus Actions

**Bonus Actions** are a key feature of MEST Tactics and enable players to create a more dynamic response to any situation involving two or more combatants.

### Bonus Assignment

During the current Initiative, an **Active character** is given a **single Bonus Action** to be used directly after:
- A **successful Disengage Test**, OR
- A **successful Combat Test** (before applying any Damage) against any of its targets

**IF** the character has **not yet performed one** during this Action.

**Key Rules:**
- The model **spends cascades** to pay for the Bonus Action. This **doesn't affect** the cascades received for Damage.
- If **Distracted**, receive **one less cascade** for Bonus Actions.
- If the Bonus Action used for a **Close Combat Hit Test** causes the Active character to **no longer have the target within Melee Range**, **do not perform the Damage Test**.
- The Active character performs **any Bonus Action before removing** their KO'd or Eliminated target.

### Available Bonus Actions

| Bonus Action | Base Cascade Cost | Effect | Clause |
|--------------|-------------------|--------|--------|
| **Circle** | 1 cascade | Adjust separation by up to base-diameter of larger model | ◆✷ |
| **Disengage** | 1 cascade | Become Free from engagement | — |
| **Hide** | 1 cascade | Become Hidden (if conditions met) | — |
| **Push-back** | 1 cascade | Reposition target 1" directly away | ◆➔ |
| **Pull-back** | 1 cascade | Reposition self 1" directly away after attack | ➔ |
| **Reversal** | 1 cascade | Switch positions with target | ◆✷ |
| **Reposition** | 1 cascade | Reposition up to base-diameter | — |
| **Refresh** | 1 cascade | Remove 1 Delay token | — |

**Note:** Base cost is **1 cascade** for all Bonus Actions. **Additional Clauses** may add to this cost.

### Additional Clauses

Some Bonus Actions have additional clauses identified by special symbols:

#### ◆ Diamond-Star Clause (Circle, Push-back, Pull-back, Reversal)

Bonus Actions marked with a **"diamond-star" (◆)** are **harder to perform unless in base-contact** with the target.

**Rules:**
- Require **an additional cascade** unless in **base-contact** with the target
- If there are **not enough cascades** to spend than what are available, then these Bonus Actions **may not be used**

**Affected Actions:** Circle, Push-back, Pull-back, Reversal

---

#### ➔ Arrow Clause (Push-back, Pull-back)

Bonus Actions marked with an **"arrow" (➔)** are **harder for smaller SIZ or STR characters** to perform against larger SIZ or STR characters.

**Physicality** = Higher of **STR** or **SIZ**

**Rules:**
- If **Attacker's Physicality < Target's Physicality**: requires **+1 cascade per point of difference**
- If **Attacker's Physicality > Target's SIZ** and this is a **Pull-back**: spend **target's SIZ cascades** to move target an **additional base-diameter each**
- If there are **not enough cascades** to spend than what are available, then these Bonus Actions **may not be used**

**Affected Actions:** Push-back, Pull-back

---

#### ✷ Starburst Clause (Circle, Reversal)

Bonus Actions marked with a **"starburst" (✷)** allow adjustment of separation.

**Rules:**
- Spend **1 cascade** to adjust separation by up to the **base-diameter of the larger model**
- If the Active model was **Engaged and becomes Free**, this requires **2 cascades**

**Affected Actions:** Circle, Reversal

---

### Cascade Spending Priority

1. **Hit Test cascades** → Determine if attack connected
2. **Spend on Bonus Actions** → Before Damage Test
3. **Damage Test cascades** → Determine Wound damage
4. **Remaining cascades** → Lost (do not carry over except as noted)

**Note:** **Carry-over dice** from Hit Test (dice showing 6) may be used for the Damage Test. Bonus Actions must be declared **before** the Damage Test.

---

## Bonus Action Details

### Circle (1 Cascade) ◆✷

**Effect:** Adjust separation between you and the target by up to the **base-diameter of the larger model**.

**Base Cost:** 1 cascade

**Diamond-Star Clause (◆):** Requires **+1 cascade** unless in **base-contact** with the target.

**Starburst Clause (✷):** Spend **+1 cascade** to adjust separation by up to the base-diameter. If the Active model was **Engaged and becomes Free**, this requires **+2 cascades** instead.

**Total Cost Examples:**
- In base-contact, not Engaged→Free: **1 cascade**
- Not in base-contact: **2 cascades** (1 base + 1 Diamond-Star)
- Engaged→Free: **3 cascades** (1 base + 2 Starburst)
- Not in base-contact AND Engaged→Free: **4 cascades** (1 base + 1 Diamond-Star + 2 Starburst)

**Use Cases:**
- Move to target's flank
- Create space for weapon swing
- Position for ally assistance

---

### Disengage (1 Cascade)

**Effect:** Immediately become **Free** from engagement with the target.

**Base Cost:** 1 cascade

**Use Cases:**
- Escape to perform Range Combat
- Move to assist another ally
- Retreat to safety

**Note:** This is an **alternative** to the Disengage Action. Does not require a Test.

---

### Hide (1 Cascade)

**Effect:** Become **Hidden** if conditions are met.

**Base Cost:** 1 cascade

**Requirements:**
- Must be **behind Cover** OR **out of LOS** from all Revealed Opposing models
- Must not be in base-contact with Attentive Ordered Opposing models

**Use Cases:**
- Escape after successful attack
- Set up for Suddenness bonus on next attack
- Avoid enemy Range Combat

---

### Push-back (1 Cascade) ◆➔

**Effect:** Reposition the **target 1" directly away** from you.

**Base Cost:** 1 cascade

**Diamond-Star Clause (◆):** Requires **+1 cascade** unless in **base-contact** with the target.

**Arrow Clause (➔):**
- If **Attacker's Physicality < Target's Physicality**: requires **+1 cascade per point of difference**
- If **Attacker's Physicality > Target's SIZ**: spend **target's SIZ cascades** per **additional base-diameter**

**Additional Distance:**
- For every **2 additional cascades** spent: push target an **additional 1"**

**Collision:**
- If target is pushed into a **wall, obstacle, or another character**: target receives **1 Delay token**

**Total Cost Examples:**
- In base-contact, equal Physicality: **1 cascade**
- Not in base-contact: **2 cascades** (1 base + 1 Diamond-Star)
- Physicality difference of 2: **3 cascades** (1 base + 2 Arrow)
- Not in base-contact AND Physicality difference of 1: **3 cascades** (1 base + 1 Diamond-Star + 1 Arrow)

**Use Cases:**
- Create space for safety
- Push enemy into hazardous terrain
- Set up for ally's attack

---

### Pull-back (1 Cascade) ➔

**Effect:** After the attack is **fully resolved**, reposition **your character 1" directly away** from the target.

**Base Cost:** 1 cascade

**Arrow Clause (➔):**
- If **Attacker's Physicality < Target's Physicality**: requires **+1 cascade per point of difference**
- If **Attacker's Physicality > Target's SIZ**: spend **target's SIZ cascades** to move target an **additional base-diameter each**

**Difference from Push-back:**
- **You** move instead of the target
- Occurs **after** Damage Test (not before)
- Does not cause collision effects

**Total Cost Examples:**
- Equal Physicality: **1 cascade**
- Physicality difference of 2: **3 cascades** (1 base + 2 Arrow)

**Use Cases:**
- Retreat after killing enemy
- Create space without pushing enemy
- Reposition for defensive stance

---

### Reversal (1 Cascade) ◆✷

**Effect:** **Switch positions** with the target, maintaining the **same distance of separation**.

**Base Cost:** 1 cascade

**Diamond-Star Clause (◆):** Requires **+1 cascade** unless in **base-contact** with the target.

**Starburst Clause (✷):** If the Active model was **Engaged and becomes Free**, this requires **+2 cascades** instead of +1.

**Total Cost Examples:**
- In base-contact, not Engaged→Free: **1 cascade**
- Not in base-contact: **2 cascades** (1 base + 1 Diamond-Star)
- Engaged→Free: **3 cascades** (1 base + 2 Starburst)
- Not in base-contact AND Engaged→Free: **4 cascades** (1 base + 1 Diamond-Star + 2 Starburst)

**Use Cases:**
- Move enemy into hazardous terrain
- Swap with ally to fresh fighter
- Gain high ground position

---

### Reposition (1 Cascade)

**Effect:** Reposition **up to one base-diameter** in any direction.

**Base Cost:** 1 cascade

**Difference from Circle:**
- **Circle** adjusts separation (distance between models)
- **Reposition** moves you to any adjacent position

**Use Cases:**
- Move to flank position
- Step around obstacle
- Align for ally's attack

---

### Refresh (1 Cascade)

**Effect:** Remove **1 Delay token** from your character.

**Base Cost:** 1 cascade

**Use Cases:**
- Recover after intense combat
- Prepare for next activation
- Remove Stun damage effects

---

## Leaving Engagement

After performing a Bonus Action, one or both models may cause Opposing models to become newly **Free** (no longer Engaged).

### Shift Rule

When models become newly Free from engagement:

1. **Alternating order**, starting with the **Passive player**
2. **Attentive Ordered Opposing models** may:
   - **Acquire a Delay token** to **"Shift"**
   - **Reposition up to a base-diameter** to become Engaged with the Active model again

**Purpose:** Prevents characters from easily escaping engagement without consequence.

**Note:** **Bonus Actions never trigger an Opportunity Attack!** (per Passive Player Options rules)

---

## Passive Player Options

**Passive Player Options** are defensive reactions available to the **Defender** during an **Attack** or **Disengage action**. These are declared **before** the Attacker rolls their Hit Test.

### Optional Tactics

| Option | Effect | Cost |
|--------|--------|------|
| **Defend!** | +1b Defender Hit Test | 1 Delay token (after attack) |
| **Take Cover!** | Move to nearest Cover | Context-dependent |
| **Opportunity Attack!** | Close Combat Attack vs. non-CC action | 1 AP |

### Optional Responses

| Response | Effect | Cost | Source |
|----------|--------|------|--------|
| **Counter-strike!** | CC Attack vs. opponent who missed | 1 AP | Counter-strike! trait |
| **Counter-fire!** | Range Attack vs. attacker | 1 AP | Ranged equivalent |
| **Counter-charge!** | Attack vs. charging enemy | 1 AP | Charge response |
| **Counter-action!** | General response action | 1 AP | Universal response |

---

## Passive Player Option Details

### Defend!

**When:** Declared **before** Attacker rolls Hit Test

**Effect:**
- **+1b** (Bonus Base Die) for **Defender Hit Test**
- After attack is **fully resolved**: acquire **1 Delay token**

**Use Cases:**
- Surviving against superior opponent
- Stalling for time
- Protecting VIP or objective

**Trade-off:** Better defense now, but less ready for next activation (Delay token).

---

### Take Cover!

**When:** Declared **before** Attacker rolls Hit Test (Range Combat)

**Effect:**
- Move to **nearest Cover** within movement distance
- Gain Cover bonus (-1b or -1m to attacker, depending on Cover type)

**Use Cases:**
- Caught in open by archer
- Retreating to defensive position
- Protecting wounded character

**Note:** Specific rules vary by terrain and situation. GM discretion may apply.

---

### Opportunity Attack!

**When:** Engaged enemy performs **any action other than**:
- Close Combat Attack
- Disengage
- Fiddle action against you

**Effect:**
- Immediately perform **Close Combat Attack** against the Opposing character

**Cost:** **1 AP**

**Use Cases:**
- Enemy tries to cast spell
- Enemy tries to move away (without Disengage)
- Enemy tries to pick up item

**Note:** This is a **React action** and follows React rules.

---

### Counter-strike!

**When:** Opponent makes a **Close Combat Attack** against you and **misses** (fails Hit Test)

**Effect:**
- Perform **Close Combat Attack** back at the original Attacker

**Cost:** **1 AP**

**Source:** **Counter-strike!** trait

**Use Cases:**
- Punishing missed attacks
- Turning defense into offense
- Finishing off weakened enemy

**Note:** Requires the **Counter-strike!** trait (found on some weapons and archetypes).

---

### Counter-fire!

**When:** Targeted by **Range Combat Attack**

**Effect:**
- Perform **Range Combat Attack** back at the attacker

**Cost:** **1 AP**

**Source:** Ranged equivalent of Counter-strike!

**Use Cases:**
- Dueling archers
- Suppressing enemy fire
- Returning fire from cover

**Note:** May require specific trait or GM approval.

---

### Counter-charge!

**When:** Targeted by enemy using **Charge bonus**

**Effect:**
- Perform **Close Combat Attack** against the charging enemy
- May negate Charge bonus

**Cost:** **1 AP**

**Source:** Charge response rule

**Use Cases:**
- Meeting charge with spear brace
- Intercepting before enemy reaches you
- Denying Charge bonus

**Note:** Timing is critical; must be declared before Charge resolves.

---

### Counter-action!

**When:** Any enemy action that targets you or affects your position

**Effect:**
- Perform **appropriate response action**

**Cost:** **1 AP**

**Source:** Universal response rule

**Use Cases:**
- Interrupting enemy Fiddle action
- Responding to enemy Rally attempt
- Countering enemy maneuver

**Note:** GM discretion on appropriate response.

---

## React Actions and Passive Player Options

**Reacts** and **Passive Player Options** are related but distinct:

| Feature | React | Passive Player Option |
|---------|-------|----------------------|
| **Trigger** | Move action or Abrupt action | Attack or Disengage action |
| **Timing** | Before any Tests begin | Before Attacker rolls Hit Test |
| **AP Cost** | 1 AP (from React) | 1 AP (from next activation or current) |
| **Wait Required** | Yes (for Standard React) | No |
| **Effect** | Full action (Move, Attack, etc.) | Specific defensive bonus or counter |

**Both:**
- Interrupt the Active character's action
- Fully resolve before original action continues
- Can cause original action to be cancelled (if Attacker KO'd or acquires Delay)

---

## Quick Reference

### Bonus Actions by Cascade Cost

| Cost | Actions |
|------|---------|
| **1 cascade** | Circle, Disengage, Hide, Push-back, Pull-back, Reposition, Refresh |
| **2 cascades** | Reversal |

### Passive Player Options by Type

| Type | Options |
|------|---------|
| **Optional Tactics** | Defend!, Take Cover!, Opportunity Attack! |
| **Optional Responses** | Counter-strike!, Counter-fire!, Counter-charge!, Counter-action! |

### Cascade Spending Order

```
1. Hit Test → Pass?
2. Spend cascades on Bonus Actions (optional)
3. Damage Test → Pass?
4. Apply Wounds
```

---

## Related Rules

- [[rules-combat|Rules: Combat]] — Combat resolution
- [[rules-advanced|Rules: Advanced]] — Reacts and advanced tactics
- [[rules-actions|Rules: Actions]] — Action types and AP costs
- [[rules-traits-list|Rules: Traits List]] — Counter-strike! trait

---

## Source Reference

**Source:** `MEST.Tactics.QSR.txt` lines ~1050-1200 (Bonus Actions, Passive Player Options, Reacts)
