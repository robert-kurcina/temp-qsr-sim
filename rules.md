# MEST Tactics QSR - Core Rules

This document contains the core rules for the MEST Tactics Quick Start Rules (QSR) system.

---

## 1. Performing Tests

### Dice & Modifiers
MEST Tactics uses three kinds of dice for all Tests; Base, Modifier, and Wild dice. These are regular six-sided dice with faces numbered 1, 2, 3, 4, 5, and 6.
- **Modifier dice (red, +1m/-1m):** Face values 1, 2, 3 is zero successes, and 4, 5, 6 is one success.
- **Base dice (white, +1b/-1b):** Face values 1, 2, 3 is zero successes, 4, 5 is one success, and 6 is two successes.
- **Wild dice (yellow, +1w/-1w):** Face values 1, 2, 3 is zero successes, 4, 5 is one success, and 6 is three successes.

### Types of Tests
Tests are either **Opposed** or **Unopposed**.
- The character performing an action is the **Active** character. The target is the **Passive** character.
- The player with the Active character is the **Attacker**. The other player is the **Defender**.
- Some tests have familiar names, e.g., "Morale Test" is an Unopposed POW Test.

### Opposed Tests
- Each player rolls two Base dice and adds their character’s value for the matching attribute.
- For tests with two attributes (e.g., RCA vs. REF), the Active character uses the first attribute, and the Passive character uses the second.

### Unopposed Tests
- The Passive player rolls dice for the game **System** and adds 2 to the total.
- The Active player adds their relevant Attribute value.

### Bonus and Penalty Dice
- Traits and Situational Modifiers can add bonus or penalty dice.
- A penalty die for one character is awarded to the opposing character as a bonus die.
- The scope of the modifier is important (e.g., `+1m Attacker Range Combat Hit Test` is very specific, while `+1m Test` is general).

### Flattening Dice
- If both players receive the same kind of bonus dice, they cancel each other out one-for-one.
- Flattening happens last, after all other modifications.
- The last two Base dice for each player are never flattened. A test always involves at least two Base dice per player.

### Scoring Tests
- **Test Score = Character's Attribute value + successes from all dice.**
- A die is a **miss** if the roll is 1, 2, or 3.
- **Successes per die:**
  - **Modifier:** 4-6 = 1 success.
  - **Base:** 4-5 = 1 success, 6 = 2 successes.
  - **Wild:** 4-5 = 1 success, 6 = 3 successes.
- **Passing a Test:** A Test is passed when the Active character has an equal to or greater Test Score than the other player. **Ties are won by the Active character.**

### Cascades, Misses, and Carry-overs
- **Cascades:** The difference in Test Scores in favor of the Active character on a passed test.
- **Misses:** The number of additional successes that would have been needed to pass a failed test.
- **Carry-overs:** Bonus dice for the *next test within the same action*.
  - **Modifier die (roll of 6):** Carries over as +1 Modifier die.
  - **Base die (roll of 6):** Carries over as +1 Base die.
  - **Wild die (roll of 4, 5, or 6):** Carries over as +1 Wild die.
  - Carry-overs only apply from Hit Tests to Damage Tests (Combat) or Link Tests to Weave Tests (Magic).
  - The System player never receives carry-overs.

### Difficulty Rating [DR]
- A rule may specify a Difficulty Rating (DR) of 1, 2, or 3. This value is added to the System or Opposing player's Test Score.

---

## 2. Situational Test Modifiers

Every Test, except for Damage Tests, will always require use of these modifiers. Modifiers usually apply to the Active/Attacker character unless specified otherwise.

### General Modifiers
| Modifier | Effect |
| :--- | :--- |
| **Hindrance** | -1m for *every* Test (except Damage) for each Hindrance status (Wound, Fear, Delay). |
| **Focus** | Remove Wait status while Attentive to receive +1w for any Test instead of performing a React. |
| **Suddenness** | +1m for the Hit Test if the character was Hidden at the start of the Action. |
| **Friendly**  | +1m Morale Tests when an Attentive Ordered Friendly model is in Cohesion. |
| **Help**      | +1m Each Free Attentive Ordered Friendly model in base-contact with the target of a Fiddle action if given a Delay token. |
| **Safety**    | +1w Morale Tests if behind Cover or out of LOS, and not within 2 AP Movement of Opposing models. |
| **Concentrate** | +1w For any Test associated with an Action if paired with the Concentrate action which itself requires 1 AP. |
| **Confined**  | -1m Close Combat Test or Defender Range Combat Hit Test if Confined by Terrain by any two; vertically, horizontally, or behind. |


### Close Combat & Disengage Modifiers
| Modifier | Effect |
| :--- | :--- |
| **Assist** | +1 Impact to Attacker's Damage Test per extra Attentive, Ordered, Friendly model in Melee Range with the same target. |
| **Cornered** | -1m for Disengage and Hit Tests if Engaged with an opponent on one side and blocked by terrain on the other. |
| **Defend** | +1b to the Defender's Hit Test if they chose the "Defend" Passive Player Option. |
| **High Ground** | +1m for Disengage and Hit Tests to the higher model. |
| **Flanked** | -1m for Disengage and Hit Tests if Engaged by two opponents on opposite sides. |
| **Outnumber** | +1w for Disengage and Hit Tests for 1, 2, 5, or 10 more Friendly models engaged with the target. Each is +1w. |
| **Overreach** | -1m to Attacker Close Combat Tests. |
| **Size** | +1m for Disengage and Close Combat Hit Tests if the Opposing model is larger by 1, 2, 5, or 10 SIZ. Each is +1m. |
| **Charge** | +1m Attacker Hit Test if moved into base-contact with target, over Clear terrain from a Free position at least base-diameter. |

### Range Combat & Detect Modifiers
| Modifier | Effect |
| :--- | :--- |
| **Concentrate** | Penalizes Opposing models -1w Attacker Range Combat Hit Test when targeted. |
| **Direct Cover** | -1b penalty to the Attacker's Hit or Detect Test. |
| **Distance** | -1m penalty to the Attacker's Hit or Detect Test for each OR Multiple to the target (max ORM 3 unless using Concentrate). |
| **Elevation** | +1m for Hit or Detect Tests if the attacker is higher than the target. |
| **Hard Cover** | -1w penalty to the Attacker's Damage Test. |
| **Intervening Cover** | -1m penalty to the Attacker's Hit or Detect Test. |
| **Leaning** | -1b penalty to Detect and Range Combat Hit Tests. |
| **Obscured** | -1m penalty to Attacker Hit or Detect Tests for each model obscuring the line of sight. |
| **Point-blank** | +1m for Hit or Detect Tests if at half OR or less. |
| **Size (Ranged)** | +1m for the Hit Test to the smaller model per 3 SIZ difference (if range is >= 1 ORM). |
| **Snapshot** | When using ROF X for a React or with Agility, or after performing the Move action; reduce X by 1. |
| **Blind** | -1w Attacker Hit Test if this is a Blind Indirect Attack. |

---

## 3. Combat Actions

### Performing Close Combat
This is an Attack action. The Active character acquires a Delay token if this is not its first attack this Initiative (unless using a Natural weapon).
1.  **Announce Weapon:** Attacker and Defender announce Melee/Natural/Improvised weapons.
2.  **Announce Target:** Announce a Revealed model within Melee Range and LOS.
3.  **Overreach (Optional):** Attacker may increase Melee Range by +1 MU for their first action, taking a -1 REF and -1 penalty to the Close Combat Test.
4.  **Resolve Hit Test:** Perform an **Opposed CCA Test**. Apply relevant modifiers and weapon Accuracy.
5.  **Proceed to Damage Test:** On a pass, proceed to the Damage Test.

### Performing Direct Range Combat
This is an Attack action. The Active character acquires a Delay token if this is not its first attack this Initiative (unless using a Natural weapon).
1.  **Announce Weapon:** Announce a Ranged weapon (one with an OR value, or Thrown/Throwable).
2.  **Announce Target:** Announce a Revealed model within LOS.
3.  **Resolve Hit Test:** Perform an **Opposed RCA vs. REF Test**. Apply relevant modifiers and weapon Accuracy.
4.  **Proceed to Damage Test:** On a pass, proceed to the Damage Test.

### Performing Disengage
This action is performed when an Engaged character wants to break away.
1.  **Conditions:** Character must be Engaged with an Ordered Opposing target. Costs zero AP if Physicality > all engaged opponents, or if target is Outnumbered, or if no Ordered opponents exist.
2.  **Announce Weapon & Target.**
3.  **Resolve Disengage Test:** Perform an **Opposed REF vs. CCA Test** (Disengager uses REF, Defender uses CCA).
4.  **Determine Results:**
    -   **Pass:** The Active character repositions up to MOV x 1".
    -   **Failure:** The Active character stays in place.

---

## 4. Damage & Injury

### Damage Test
- If a Hit Test passes, the attacker performs a Damage Test.
- This is an **Opposed `Damage Rating` vs. `target FOR` Test**.

### Wound Damage
- If the Damage Test passes, the target becomes Wounded.
- If cascades > current Wound tokens, set Wound tokens = cascades.
- Otherwise, target gains 1 Wound token.
- Wound tokens are a **Hindrance**.

### Stun Damage
- A character can have Delay tokens up to their AP allotment (delt 2).
- Any additional Delay tokens convert to 1 Wound damage each.
- A character with max Delay tokens is **Stunned**. Delay tokens are a **Hindrance**.

### Armor vs. Impact
- **Armor Rating [AR]:** Reduces Wound damage received by 1 per AR point.
- **Impact Rating [I]:** Reduces the target's AR by an equal amount for that attack.
- Wound damage from Stun is not stopped by Armor.

### Knocked-Out [KO’d]
- A character with Wound tokens ≥ SIZ is Knocked-Out.
- Place model face-down. They are "Out-of-Play", block LOS slightly, and are considered Rough terrain.

### Elimination
- A character is Eliminated if Wound tokens ≥ SIZ + 3.
- Remove the model and all tokens from play.

---

## 5. Morale & Psychology

### Morale, Fear, and Rally Tests
- **Morale Tests** are Unopposed POW Tests.

### Fear Tests
- A type of Morale Test required when a character:
    - Receives a Wound token.
    - Is Free/Distracted and a nearby Friendly model is KO'd or Eliminated.
- Not required if already Disordered or Engaged (unless Distracted). Max one per Turn.
- **On Failure (Misses):**
    - If misses > current Fear tokens, set Fear tokens = misses.
    - Otherwise, gain 1 Fear token.
- Fear tokens are a **Hindrance**. Having 2+ makes a character **Disordered**.

### Rally Tests
- A type of Morale Test (Unopposed POW).
- Passing removes one Fear token per cascade.

---

## 6. General Terms

MEST Tactics requires the use of many game-specific terminologies to make rules precise and clear.

### Common Terminology
*   **Initiative** — The character (its model and player) whose turn it is or was at the start of a Turn.
*   **Target** — A target is either a model, a battlefield location, or terrain elements such as a tree or building.
*   **Active** — The character (its model and player) whose turn it is at the moment to complete an Action.
*   **Passive** — The character (its model and player) which is the target of an action by the Active character.
*   **Attacker** — The character (its model and player) performing an Attack action.
*   **Defender** — The character (its model and player) which is the target of an Attack action.
*   **Scrum** — A Scrum is when three or more Opposing models are Engaged or within Melee Range of others.
*   **Outnumbers** — A model Outnumbers its target if it has more Attentive Ordered Friendly models with the same Opposing model in Melee Range.
*   **Agility** — Agility is a feature of movement and can be used in combination with it. It is equal to half a character’s MOV, keeping fractions.
*   **Physicality & Durability**— Physicality is the higher of SIZ or STR. Durability is the higher of SIZ or FOR.
*   **base-contact** — A model is in base-contact if its base touches and it is anywhere within the height of the other model.
*   **Facing** — How a model faces or its “facing” is not a factor in game-play.
*   **Core Damage** — This is a weapon’s flat value for Damage rating plus the number of dice it would roll.
*   **Hindrance** — Hindrances are status tokens such as Wound, Delay, and Fear. Each type of Hindrance assigned to a character causes it to be penalized at -1 Modifier die all Tests except for the Damage Test.

### Standard Conditions
*   **Friendly / Opposing** — Models controlled by the same side / different sides.
*   **Ready / Done** — Characters that can still act / have finished their actions.
*   **In-Play / Out-of-Play** — A character that is on the board and active / KO’d or Eliminated.
*   **KO’d / Eliminated** — A model that is temporarily out of action / permanently removed from play.
*   **Revealed / Hidden** — Characters that can be seen / cannot be seen.
*   **Attentive / Distracted** — Characters that are aware / have Delay tokens.
*   **Ordered / Disordered** — Characters with less than 2 Fear tokens / 2 or more Fear tokens.
*   **Free / Engaged** — Models not in base-contact with an enemy / in base-contact with an enemy.
*   **Melee Range** — The area where a character's volume is in base-contact with an Opposing model's volume.

---

## 7. Visibility & Line of Sight (LOS)

A model must have Line of Sight (LOS) to a target to perform many actions.
*   **Line of Sight (LOS):** An imaginary straight line drawn from any part of the active model's volume to any part of the target model's volume.
*   **Revealed:** The default state for all models. A Revealed model can be targeted by actions that require LOS.
*   **Hidden:** A model that is not Revealed is Hidden. A Hidden model cannot be targeted by most actions until it becomes Revealed.

---

## 8. Properties

### Weapon Properties
*   **Name, Class:** The weapon's name and classification (e.g., Melee, Ranged).
*   **OR:** Optimal Range for ranged attacks.
*   **Acc:** Accuracy bonus for Attacker Hit Tests.
*   **Impact:** Impact rating [I], reduces target's Armor Rating [AR].
*   **Damage:** The Damage Rating for Damage Tests.
*   **Traits:** Special properties of the weapon.
*   **BP:** Build Points cost.

### Armor Properties
*   **Name, Type:** The armor's name and classification.
*   **AR:** Armor Rating, reduces Wound damage.
*   **Traits:** Special properties of the armor.
*   **BP:** Build Points cost.

### Trait Syntax
Traits are special qualities represented as structured strings.
*   **Basic:** `Sturdy 3` (Name and Level)
*   **Disability:** `[Awkward]` (Enclosed in square brackets)
*   **Typed:** `Damper 4 > Fear` (Has a specific application)
*   **List:** `Augment 2 > {Grit, Fight}` (Applies to a list of keywords)
*   **Nested:** `[Distracted > {Focus, [Aim]}]` (Traits can contain other traits)
