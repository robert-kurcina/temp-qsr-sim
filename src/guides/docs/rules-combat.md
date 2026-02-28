---
title: Combat
description: Detailed rules for resolving close-quarters and ranged combat.
priority: 5
---

# Combat

This module details the rules for resolving attacks, from close-quarters brawls to ranged firefights. All attacks are considered Actions.

## 1. The Anatomy of an Attack

Every attack, whether Close Combat or Range Combat, follows the same fundamental sequence:

1.  **Declare Attack:** The Active player chooses a character, an appropriate weapon, and a valid target.
2.  **Hit Test:** The Attacker and Defender engage in an Opposed Test to see if the attack connects.
3.  **Spend Cascades (Optional):** If the Hit Test is successful, the Attacker may spend cascades on Combat Maneuvers.
4.  **Damage Test:** If the Hit Test was successful, the Attacker makes a Damage Test against the Defender to determine if any Wounds are inflicted.

## 2. Close Combat

Close Combat involves direct, hand-to-hand fighting.

### Performing a Close Combat Attack

*   **Requirements:** The target must be within the Attacker's **Melee Range** (typically base-to-base contact unless a weapon has the `Reach` trait) and Line of Sight (LOS).
*   **The Hit Test:** This is an **Opposed CCA vs. CCA Test**. Both players roll using their character's Close Combat Attribute.
*   **Modifiers:** Apply any relevant Situational Test Modifiers, such as those for being Flanked, having High Ground, or using the Defend! passive action.

### Combat Maneuvers (Spending Cascades)

If the Attacker succeeds on their Hit Test, they may spend cascades *before* the Damage Test to perform special maneuvers called **Bonus Actions**.

**For complete Bonus Action rules, see:** [[rules-bonus-actions|Rules: Bonus Actions & Passive Player Options]]

**Quick Reference:**

*   **Push-back:** Reposition the target 1" directly away from the attacker. Base cost: 1 cascade. Additional clauses may apply (◆➔).
*   **Reversal:** Switch positions with the target, maintaining the same distance of separation. Base cost: 1 cascade. Additional clauses may apply (◆✷).
*   **Pull-back:** After the attack is fully resolved, reposition your character 1" directly away from the target. Base cost: 1 cascade. Additional clauses may apply (➔).

**Additional Clauses:**

| Symbol | Name | Effect |
|--------|------|--------|
| **◆** | Diamond-Star | +1 cascade unless in base-contact with target |
| **➔** | Arrow | +1 cascade per point of Physicality difference (if Attacker < Target) |
| **✷** | Starburst | +1 cascade (+2 if Engaged→Free) |

**Physicality** = Higher of **STR** or **SIZ**

**Note:** If the Bonus Action causes the Active character to no longer have the target within Melee Range, **do not perform the Damage Test**.

## 3. Range Combat

Range Combat involves attacking a target from a distance with a projectile or thrown weapon.

### Performing a Range Combat Attack

*   **Requirements:** The target must be Revealed and within the Attacker's Line of Sight (LOS).
*   **The Hit Test:** This is an **Opposed RCA vs. REF Test**. The Attacker rolls using their Range Combat Attribute, and the Defender rolls using their Reflex Attribute.

### Range and Modifiers

Distance is a critical factor in range combat.

*   **Optimal Range (OR):** Every ranged weapon has an Optimal Range value in inches. This is the effective range of the weapon.
*   **Optimal Range Multiple (ORM):** The distance to the target determines the difficulty of the shot. The ORM is a penalty calculated by dividing the total distance to the target by the weapon's OR, and rounding down. The formula is: `ORM = floor(distance in inches / OR)`
    *   The Attacker suffers a **-1m penalty** to their Hit Test for **each point of ORM beyond the first**. An attack within the weapon's OR has an ORM of 1 and suffers no penalty.
    *   *Example:* A rifle with OR 12" shoots at a target 30" away. `floor(30 / 12) = 2`. The ORM is 2. The penalty is -1m (for the second multiple). If the target was 40" away, the ORM would be 3 (`floor(40/12) = 3`) and the penalty would be -2m.
*   **Point-blank:** If the Attacker is within half of the weapon's OR, they receive a **+1m bonus** to their Hit Test.
*   **Cover:** Targets may benefit from Cover, which imposes a penalty on the Attacker's Hit Test (see `rules-situational-modifiers.md`).

## 4. The Disengage Action

A character Engaged in Close Combat must perform a Disengage action to move away.

*   **The Disengage Test:** This is resolved like a Close Combat attack, but the character attempting to disengage uses their **REF** attribute instead of CCA. It is an **Opposed REF vs. CCA Test**, with the character disengaging considered the "Attacker" for the test.
*   **Success:** If the disengaging character wins the test, they are now Free and may immediately perform a Move action up to their full MOV allowance.
*   **Failure:** The character remains Engaged and cannot move. The AP for the Disengage action is lost.