# Damage and Morale

This module covers how characters are injured, the effects of those injuries, and how their will to fight is tested.

## 1. Injury & Damage

A successful attack consists of two steps: a Hit Test and a Damage Test. If the Hit Test passes, the Attacker proceeds to the Damage Test.

### Damage Test

This is an Opposed Test pitting the weapon's **Damage rating** against the target's **FOR (Fortitude)** attribute.

*   The Damage rating is specified by the weapon being used (e.g., a Sword might have a Damage of `STR + 2m`).
*   If the Attacker wins the Damage Test, the target suffers Wounds.

### Taking Wounds

The number of cascades from a successful Damage Test determines the number of Wound tokens the target receives.

*   The target acquires a number of **Wound tokens** equal to the cascades of the Damage Test.
*   **Wound tokens are a Hindrance.** Each Hindrance type (Wound, Delay, Fear) gives a -1m penalty to all Tests except Damage Tests.

### Armor vs. Impact

Armor can prevent Wounds.

*   **Armor Rating (AR):** Reduce the number of Wound tokens received by the character's AR. The `Armor X` trait provides this.
*   **Impact (I):** The Attacker's weapon may have an Impact rating. This value reduces the target's AR for that specific attack. For example, an attack with Impact 2 against a target with Armor 3 would treat the target as having Armor 1 (3 - 2).

### Knocked-Out (KO’d)

A character is KO’d when their total number of Wound tokens equals or exceeds their **SIZ (Size)** attribute.

*   A KO’d model is placed face-down. It is no longer In-Play and cannot perform actions.
*   KO’d models block Line of Sight (LOS) and are considered Rough terrain.

### Elimination

A character is Eliminated (removed from play) if they receive Wound tokens equal to or greater than their **SIZ + 3**.

## 2. Morale System

Characters can become scared, leading to unpredictable behavior. Morale is tracked with **Fear tokens**.

### Fear Tests

A Fear Test is an **Unopposed POW (Power) Test** that a character must make under certain conditions:

*   **Trigger:**
    1.  Upon receiving one or more Wound tokens.
    2.  If a Friendly model within Cohesion is KO’d or Eliminated.
*   **Result:** If the Fear Test is failed, the character gains **1 Fear token**. If the test is failed with multiple cascades, they gain Fear tokens equal to the number of cascades.
*   **Fear tokens are a Hindrance.**

### States of Fear

The number of Fear tokens a character has determines their state:

*   **Nervous (1 Fear token):** The character is shaken but suffers no compulsory actions.
*   **Disordered (2 Fear tokens):** The character is actively trying to escape danger. On their activation, they must spend their first AP on a Compulsory Action (see below).
*   **Panicked (3 Fear tokens):** The character is routing. They must spend all their AP on Compulsory Actions.
*   **Eliminated (4+ Fear tokens):** The character is removed from play as they flee the battlefield.

### Compulsory Actions for Disordered/Panicked Characters

1.  **If Engaged:** Perform Disengage actions until Free.
2.  **If Free:** Perform Move actions toward the nearest position of Safety (i.e., out of LOS and far from enemies).
3.  **If in Safety:** Perform a Rally action on themself to try and remove Fear tokens.

### Rally Tests

A character can perform the **Rally** action (see `rules-actions.md`), which is an Unopposed POW Test. If successful, the character removes one Fear token for each cascade.

## 3. Breakpoint & Bottle Tests

An entire force can lose its will to fight if it suffers heavy casualties. This is determined through Bottle Tests.

*   **Breakpoint:** A player's force reaches its Breakpoint when half or more of its starting characters have been KO’d or Eliminated.
*   **Bottle Test:** At the end of each Game Round, if a player's force is at its Breakpoint, they must perform a **Bottle Test**.
    *   **How to Test:** The player chooses one of their remaining Ordered characters to make an **Unopposed POW Test**.
    *   **Failure:** If the test is failed, OR if the player has no Ordered characters left to take the test, the force has **Bottled Out**. All of that player's remaining characters are immediately Eliminated from the game.
    *   **Success:** If the test is passed, the force holds its nerve and may continue to fight in the next round.