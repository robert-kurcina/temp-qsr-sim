---
dependencies: 
  - rule: rules-combat.md
    priority: 5
    status: DONE
  - rule: rules-damage-and-morale.md
    priority: 6
    status: DONE
  - rule: rules-movement-and-terrain.md
    priority: 3
    status: DONE
  - rule: rules-actions.md
    priority: 4
    status: DONE
---
# Situational Test Modifiers

There are common situations which arise that will affect the ability of characters to pass Tests. These are known as Situational Test Modifiers, and they are listed in a set of tables at the right under their commonly referenced name.

These entries will be explained in the proper context in the later sections of the rules. For now, consider these to be a reference used during game-play as a reminder.

All of the terms used are described in the next few sections.

*   Penalties are listed as -1, -1m, -1b, or -1w, and bonuses are listed as +1, +1m, +1b, or +1w.
*   Modifiers usually are set for the Active or Attacker character unless they specify the target or Defender. Some modifiers apply to both models within a test.
*   Every Test, except for the Damage Tests, will always require use of these Situational Test Modifiers.
*   The most commonly applied Situation Test Modifiers will be for Hindrances.

## Adjusted Rules Note

For these QSR Rules, the entries on the Situational Test Modifiers table have been adjusted by removing Snapshot and Suppression.

## Close Combat & Disengage

| Modifier | Description |
| :------- | :---------- |
| +1 | **Assist.** +1 Impact Attacker Damage Test per extra Attentive Friendly Ordered model with same target in Melee Range. |
| +1m | **Charge bonus.** Attacker Hit Test if moved into base-contact with target, over Clear terrain from a Free position at least base-diameter away. See "Charge Bonus Qualification" below for detailed rules. |
| +1m | **High Ground.** Disengage and Hit Tests to higher model if base is above half of the Opposing model's base-height, and base-height is above the Opposing model's volume. |
| +1m | **Size.** Disengage and Close Combat Hit Tests if in base-contact, and Opposing model is larger by 1, 2, 5, or 10 SIZ. Each is +1m. |
| +1b | **Defend.** Defender Hit Test if target chooses "Defend". |
| +1w | **Outnumber.** Disengage and Hit Tests for 1, 2, 5, or 10 more other Attentive Ordered Friendly models with the same target in Melee Range than the Opposing model. Each is +1w. |
| -1m | **Cornered.** Disengage and Hit Tests if Engaged to the Opposing model on one side of this model and in base-contact on the other side with a wall, precipice, or degraded terrain. |
| -1m | **Flanked.** Disengage and Hit Tests if Engaged to two Opposing models directly on either side of this model. |
| -1 | **Overreach.** Penalized -1 REF and -1 Attacker Close Combat Tests. |

---

## Charge Bonus Qualification

The **Charge bonus** is a **Situational Test Modifier** (+1m to Attacker Hit Test) earned through movement and positioning. This is **separate from** the **Charge trait** which may be assigned to weapons.

### Charge Bonus Requirements

All of the following conditions must be met:

| Requirement | Details |
|-------------|---------|
| **Movement Cost** | Move action must cost **at least 1 AP** |
| **Starting Position** | Must start **Free** (not Engaged) |
| **Starting Distance** | At least **base-diameter away** from target before becoming Engaged |
| **Movement Path** | Move **directly into target** and make **base-contact** |
| **Direction Changes** | **No direction changes** during Charge action |
| **Terrain** | Movement must be over **Clear terrain** (or terrain made Clear by traits/Agility) |
| **Target Visibility** | Target must **not be Hidden** and be **within LOS** at start of Action |
| **Target Range** | Target at no more than **Visibility × 3 ORM** |

### Charge Bonus vs. Charge Trait

| Feature | Charge Bonus | Charge Trait |
|---------|--------------|--------------|
| **Type** | Situational Test Modifier | Weapon/Item Trait (Attack Effect) |
| **Effect** | +1m to **Attacker Hit Test** | +1 Wild die to **Attacker Damage Test** + +1 Impact |
| **Source** | Earned through movement | Assigned to weapon/item |
| **Requirement** | Qualify through movement | Must be **Attentive** AND qualify for Charge bonus |
| **Stacking** | Cannot stack with itself | Stacks with Charge bonus (both apply if qualified) |

### Charge Bonus Examples

**Example 1: Successful Charge**
```
Character: Average (MOV 2), armed with Spear (Charge trait)
Starting: Free, 3" from enemy (more than base-diameter)
Action: Spend 1 AP Move, move 4" directly into base-contact
Result: 
  - Charge bonus: +1m to Hit Test ✓
  - Charge trait: +1 Wild die Damage Test + +1 Impact ✓
```

**Example 2: Failed Charge (Direction Change)**
```
Character: Average (MOV 2), armed with Sword
Starting: Free, 4" from enemy
Action: Move 2" forward, turn 90°, move 2" to flank
Result: 
  - Charge bonus: NO (direction change during action) ✗
  - Normal Hit Test applies
```

**Example 3: Failed Charge (Terrain)**
```
Character: Average (MOV 2), armed with Axe
Starting: Free, 3" from enemy, Rough terrain between
Action: Move into base-contact over Rough terrain
Result: 
  - Charge bonus: NO (not Clear terrain) ✗
  - Normal Hit Test applies
```

**Example 4: Charge Trait Without Charge Bonus**
```
Character: Average (MOV 2), armed with Spear (Charge trait)
Starting: Already Engaged with enemy
Action: Close Combat Attack (no movement)
Result: 
  - Charge bonus: NO (did not move) ✗
  - Charge trait: NO (requires Charge bonus) ✗
  - Normal Hit and Damage Tests apply
```

### Traits That Affect Charge

| Trait | Effect on Charge |
|-------|------------------|
| **Charge** (weapon trait) | +1 Wild die Damage Test + +1 Impact when Charge bonus applies |
| **Bash** | +1 cascade for Bonus Actions if Charging and in base-contact |
| **Surefooted X** | Can treat Rough/Difficult terrain as Clear, enabling Charge |
| **Sprint X** | Increased movement allows Charge from further away |
| **Leap X** | Can use Agility to bypass terrain, enabling Charge |

### Related Rules

- [[rules-traits-list|Rules: Traits List]] — Charge trait, Bash trait
- [[rules-movement|Rules: Movement]] — Movement actions, terrain
- [[rules-combat|Rules: Combat]] — Close Combat resolution

## Range Combat & Detect

| Modifier | Description                                                                                                                                                                                          |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| +1m      | **Point-blank.** Active model not Engaged to target receives +1 Modifier die for the Hit or Detect Tests if at half OR or less.                                                                           |
| +1m      | **Elevation.** Active character Hit or Detect Tests if higher than opponent by 1" for every 1" away.                                                                                                    |
| +1m      | **Size.** Range Combat Hit Test for every 3 SIZ difference to the smaller model if OR Multiple is at least 1.                                                                                           |
| -1m      | **Distance.** Attacker Hit or Detect Test for ORM to the target.                                                                                                                                     |
| -1m      | **Intervening Cover.** Attacker Hit or Detect Test if target has Intervening Cover.                                                                                                                    |
| -1m      | **Obscured.** Attacker Hit or Detect Tests for 1, 2, 5, or 10 other models within LOF to the target, and for non-Opposing models beyond but within 1 MU of LOF. Each is -1 Modifier die.                   |
| -1b      | **Direct Cover.** Attacker Hit or Detect Test if target in Direct Cover.                                                                                                                               |
| -1b      | **Leaning.** Penalize -1 Base die Detect and Range Combat Hit Tests if self or target is leaning from terrain in base-contact.                                                                          |
| -1w      | **Blind.** Attacker Hit Test if this is a Blind Indirect Attack.                                                                                                                                     |
| -1w      | **Hard Cover.** Attacker Damage Test if target behind Hard Cover.                                                                                                                                    |

## Miscellaneous

| Modifier | Description                                                                                                                                                                                          |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| +1       | **Waiting.** All characters in Wait status receive +1 REF when qualifying for a React.                                                                                                                 |
| +1       | **Solo.** A single model selected to perform React against a Group Action receives an effective +1 REF.                                                                                              |
| +1m      | **Suddenness.** Hit Test if Hidden at start of Action.                                                                                                                                               |
| +1m      | **Friendly.** Morale Tests when an Attentive Ordered Friendly model is within Cohesion.                                                                                                               |
| +1m      | **Help.** Each Free Attentive Ordered Friendly model in base-contact with the target of a Fiddle action if given a Delay token.                                                                          |
| +1w      | **Safety.** Morale Tests if behind Cover or out of LOS, and not within 2 AP Movement of Opposing models.                                                                                               |
| +1w      | **Concentrate.** For any Test associated with an Action if paired with the Concentrate action which itself requires 1 AP.                                                                                 |
| +1w      | **Focus.** Remove Wait status while Attentive to receive +1 Wild die for any Test instead of performing a React.                                                                                        |
| -1m      | **Hindrance.** Characters are penalized every Test except Damage Tests for every Hindrance type assigned; Wound, Fear, or Delay.                                                                         |
| -1m      | **Confined.** Penalize -1 Modifier die Close Combat Test or Defender Range Combat Hit Test if Confined by Terrain by any two; vertically, horizontally, or behind.                                        |