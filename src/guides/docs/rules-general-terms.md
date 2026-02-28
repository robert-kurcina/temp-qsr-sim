---
title: General Terms & Glossary
description: Comprehensive glossary of all MEST Tactics terminology, conditions, and game concepts.
priority: 1
---

# General Terms & Glossary

MEST Tactics requires the use of many game-specific terminologies to make rules precise and clear. This document serves as the comprehensive glossary for all game terms.

**Quick Navigation:**
- [Common Terminology](#common-terminology)
- [Standard Conditions](#standard-conditions)
- [Status & Tokens](#status--tokens)
- [Combat Terms](#combat-terms)
- [Movement & Terrain](#movement--terrain)
- [Tests & Dice](#tests--dice)
- [Mission & Victory](#mission--victory)
- [AI & Automation](#ai--automation)

---

## Common Terminology

| Term | Definition | Related |
|------|------------|---------|
| **Initiative** | The character (its model and player) whose turn it is or was at the start of a Turn. | [[rules-initiative\|Rules: Initiative]] |
| **Target** | A target is either a model, a battlefield location, or terrain elements such as a tree or building. | [[rules-combat\|Rules: Combat]] |
| **Active** | The character (its model and player) whose turn it is at the moment to complete an Action. | [[rules-actions\|Rules: Actions]] |
| **Passive** | The character (its model and player) which is the target of an action by the Active character. | [[rules-combat\|Rules: Combat]] |
| **Attacker** | The character (its model and player) performing an Attack action. | [[rules-combat\|Rules: Combat]] |
| **Defender** | The character (its model and player) which is the target of an Attack action. | [[rules-combat\|Rules: Combat]] |
| **Scrum** | When three or more Opposing models are Engaged or within Melee Range of others. | [[rules-situational-modifiers\|Rules: Situational Modifiers]] |
| **Outnumbers** | A model Outnumbers its target if it has more Attentive Ordered Friendly models with the same Opposing model in Melee Range. | [[rules-situational-modifiers\|Rules: Situational Modifiers]] |
| **Agility** | A feature of movement equal to half a character's MOV (keeping fractions up to 0.5"). Used for navigating difficult terrain. | [[rules-movement\|Rules: Movement]] |
| **Physicality** | The higher of SIZ or STR. Used for burden calculations and some trait effects. | [[rules-traits-list\|Rules: Traits List]] |
| **Durability** | The higher of SIZ or FOR. Used for Stun Tests and damage resistance. | [[rules-traits-list\|Rules: Traits List]] |
| **base-contact** | A model is in base-contact if its base touches and it is anywhere within the height of the other model. Bases should not overlap. | [[rules-size-base-diameter\|Rules: Size & Base Diameter]] |
| **Facing** | How a model faces or its "facing" is **not** a factor in game-play. | — |
| **Core Damage** | **Advanced Rule (Not in QSR).** A weapon's flat value for Damage rating plus the number of dice it would roll. Used with Advanced Rules involving Suppression. | — |
| **Hindrance** | Status tokens such as Wound, Delay, and Fear. Each type causes -1m to all Tests except Damage Tests. | [[rules-status\|Rules: Status]] |

---

## Standard Conditions

Each of the Standard Conditions usually have a pairing. Friendly and Opposing are pairs, same as Hidden or Revealed.

| Condition | Description | Related |
|-----------|-------------|---------|
| **Friendly** | All models controlled by the same player, or by players of the same Side, are Friendly. | [[rules-assemblies-and-setup\|Rules: Assemblies & Setup]] |
| **Opposing** | Models which are not Friendly are Opposing. | [[rules-assemblies-and-setup\|Rules: Assemblies & Setup]] |
| **Ready** | All models begin each Mission as Ready. Ready models can be activated. | [[rules-actions\|Rules: Actions]] |
| **Done** | Characters that have completed all of their activities are Done. Marked with a Done token. KO'd characters are never Ready; always Done, and never Active. | [[rules-actions\|Rules: Actions]] |
| **In-Play** | A character that is not KO'd or Eliminated is In-Play. | [[rules-status\|Rules: Status]] |
| **Out-of-Play** | A character not In-Play. Usually KO'd or Eliminated. | [[rules-status\|Rules: Status]] |
| **KO'd** | A model is KO'd when it has received Wound tokens matching its SIZ. KO'd models never cause Opposing models to be Engaged. | [[rules-status\|Rules: Status]] |
| **Eliminated** | Characters which have been removed from play. A character is Eliminated when it is no longer in play as result of movement, combat, fear, or other means. Exiting the battlefield is automatic Elimination. | [[rules-status\|Rules: Status]] |
| **Revealed** | Characters that are not Hidden are instead Revealed. | [[rules-actions\|Rules: Actions]] |
| **Hidden** | Characters may become Hidden during the course of the game (via Hide action or Sneaky trait). Hidden models have halved Visibility and Cohesion. | [[rules-actions\|Rules: Actions]] |
| **Attentive** | Characters are usually Attentive unless Knocked-out [KO'd]. The opposite of Distracted. | [[rules-status\|Rules: Status]] |
| **Distracted** | The opposite of Attentive. Models with Delay tokens are Distracted. | [[rules-status\|Rules: Status]] |
| **Ordered** | Characters which are not Disordered are instead Ordered. | [[rules-status\|Rules: Status]] |
| **Disordered** | Characters with 2 or more Fear tokens are Disordered. Must perform Compulsory Actions. | [[rules-status\|Rules: Status]] |
| **Free** | Models that are not Engaged are Free. | [[rules-combat\|Rules: Combat]] |
| **Melee Range** | A target is within Melee Range if its volume is in base-contact with an Opposing model's volume. | [[rules-combat\|Rules: Combat]] |
| **Engaged** | A model is considered Engaged if it is within the Melee Range of an Opposing model. | [[rules-combat\|Rules: Combat]] |

---

## Status & Tokens

| Token/Status | Type | Effect | Removal |
|--------------|------|--------|---------|
| **Wound** | Hindrance | -1m to all Tests except Damage Tests. At SIZ Wounds = KO'd. At SIZ+3 Wounds = Eliminated. | Revive action |
| **Delay** | Hindrance | -1m to all Tests except Damage Tests. Costs 1 AP to remove per token. | Start of Initiative (1 AP each) |
| **Fear** | Hindrance | -1m to all Tests except Damage Tests. 2+ = Disordered. 3+ = Panicked. 4+ = Eliminated. | Rally action |
| **Done** | Flow | Marks completion of activation. Removed at start of Turn. | Start of Turn |
| **Wait** | Flow | Enables React actions. Doubles Visibility OR. Maintained at 0 AP if Free, 1 AP if not Free. | Start of next Initiative |
| **Hidden** | Flow | Halves Visibility and Cohesion. Lost when out of Cover or Revealed. | Detect action, out of Cover |
| **Out-of-Ammo!** | Item | Weapon unavailable until reloaded. | Reload (Fiddle action) |
| **Jammed!** | Item | Weapon unavailable until cleared. | Clear Jam (Fiddle action) |
| **Addicted** | Status | Penalty dice based on substance type (Drunkard, Euphorics, etc.). | Withdrawal or treatment |
| **Berserker** | Status | Compulsory attack behavior. Ignores standard Fear compulsions. | End of Turn |

### Fear States

| Fear Tokens | State | Compulsory Actions |
|-------------|-------|-------------------|
| **0** | Calm | None |
| **1** | Nervous | None |
| **2** | Disordered | First AP: Disengage if Engaged, Move to Safety if Free |
| **3** | Panicked | All AP: Disengage or Move to Safety |
| **4+** | Eliminated | Removed from play |

---

## Combat Terms

| Term | Definition | Related |
|------|------------|---------|
| **Hit Test** | Opposed Test to determine if an attack connects. CCA vs CCA (Close Combat) or RCA vs REF (Range Combat). | [[rules-combat\|Rules: Combat]] |
| **Damage Test** | Opposed Test to determine Wound damage. Weapon Damage vs FOR. | [[rules-damage-and-morale\|Rules: Damage & Morale]] |
| **Cascades** | The difference in Test Scores in favor of the winner. Used for Bonus Actions and Wound count. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **Misses** | What would have been needed to pass a Test. Used for Falling Tests and Friendly Fire. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **Carry-over** | Dice that generate bonuses for subsequent Tests (Hit → Damage). 6s on Base/Modifier, 4+ on Wild. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **Impact [I]** | Weapon rating that reduces target's Armor Rating for that attack. | [[rules-items\|Rules: Items]] |
| **Armor Rating [AR]** | Reduces Wound damage received. Provided by Armor X trait. | [[rules-traits-list\|Rules: Traits List]] |
| **Bonus Actions** | Special maneuvers after successful Hit/Damage Test. Cost cascades. | [[rules-bonus-actions\|Rules: Bonus Actions]] |
| **Passive Player Options** | Defensive reactions available to Defender (Defend!, Counter-strike!, etc.). | [[rules-bonus-actions\|Rules: Bonus Actions]] |
| **Charge Bonus** | +1m to Attacker Hit Test when moving into base-contact over Clear terrain from Free position. | [[rules-situational-modifiers\|Rules: Situational Modifiers]] |
| **Charge Trait** | Weapon trait: +1 Wild die Damage Test + +1 Impact when Charge bonus applies. | [[rules-traits-list\|Rules: Traits List]] |

### Bonus Actions

| Action | Cascade Cost | Effect |
|--------|--------------|--------|
| **Circle** | 1 | Adjust separation by base-diameter |
| **Disengage** | 1 | Become Free from engagement |
| **Hide** | 1 | Become Hidden (if conditions met) |
| **Push-back** | 1 | Push target 1" away |
| **Pull-back** | 1 | Reposition self 1" away after attack |
| **Reversal** | 2 | Switch positions with target |
| **Reposition** | 1 | Reposition up to base-diameter |
| **Refresh** | 1 | Remove 1 Delay token |

---

## Movement & Terrain

| Term | Definition | Related |
|------|------------|---------|
| **MU (Measured Unit)** | 1 MU = 1" = base diameter of SIZ 3 model. | [[rules-size-base-diameter\|Rules: Size & Base Diameter]] |
| **MOV** | Movement attribute. Determines how far a model can move per AP. | [[rules-characters-and-attributes\|Rules: Characters & Attributes]] |
| **Movement Allowance** | Distance a model can move per AP: MOV + 2". | [[rules-movement\|Rules: Movement]] |
| **Clear Terrain** | No movement penalty. 1" per 1". | [[rules-terrain\|Rules: Terrain]] |
| **Rough Terrain** | 2" movement cost per 1" crossed. | [[rules-terrain\|Rules: Terrain]] |
| **Difficult Terrain** | 2" movement cost per 1" crossed. Must stop or acquire Delay token. | [[rules-terrain\|Rules: Terrain]] |
| **Impassable Terrain** | Cannot be moved through. Walls, cliff-faces. | [[rules-terrain\|Rules: Terrain]] |
| **LOS (Line of Sight)** | Line traced between model volumes not blocked by terrain. | [[rules-visibility\|Rules: Visibility]] |
| **LOF (Line of Fire)** | Line between two models and beyond the target. | [[rules-friendly-fire-los\|Rules: Friendly Fire & LOF]] |
| **Visibility OR** | Maximum range for visibility. Day/Clear = 16", Twilight/Overcast = 8". | [[rules-visibility\|Rules: Visibility]] |
| **ORM (OR Multiple)** | floor(distance / OR). Each point beyond first = -1m penalty. Max ORM 3 (normal). | [[rules-visibility\|Rules: Visibility]] |
| **Cover** | Terrain that blocks attacks. Direct Cover = -1b, Intervening Cover = -1m. | [[rules-situational-modifiers\|Rules: Situational Modifiers]] |
| **Falling Test** | Unopposed FOR Test when falling > Agility. DR = SIZ + (MU beyond Agility ÷ 4). | [[rules-falling-swap-confined\|Rules: Falling, Swap, & Confinement]] |

---

## Tests & Dice

| Term | Definition | Related |
|------|------------|---------|
| **Base Die (b)** | White die. 4-5 = 1 success, 6 = 2 successes + carry-over. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **Modifier Die (m)** | Red die. 4-6 = 1 success, 6 = carry-over. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **Wild Die (w)** | Yellow die. 4-5 = 1 success, 6 = 3 successes + carry-over. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **Opposed Test** | Both players roll dice + Attribute. Higher score wins. Active wins ties. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **Unopposed Test** | Active rolls vs System (2 Base + 2). | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **Test Score** | Attribute value + dice successes. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **DR (Difficulty Rating)** | Added to System/Opposing player's Test Score. 1, 2, or 3. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |
| **Flattening Dice** | Canceling equal dice from both players. Last 2 Base dice per player never removed. | [[rules-tests-and-checks\|Rules: Tests & Checks]] |

### Random Selection Methods

| Method | Dice | Range | Use Case |
|--------|------|-------|----------|
| **Y/N** | 1d6 | Yes (4-6) / No (1-3) | Binary checks |
| **D6** | 1d6 | 1-6 | 6-entry tables |
| **D66** | 2d6 (R+W) | 11-66 | 36-entry tables |
| **D666** | 3d6 (R+W+Y) | 111-666 | 216-entry tables |

---

## Mission & Victory

| Term | Definition | Related |
|------|------------|---------|
| **Mission** | A game scenario with specific objectives and victory conditions. | [[rules-missions\|Rules: Missions]] |
| **Side** | A faction in the game. Multiple players can belong to the same Side. | [[rules-assemblies-and-setup\|Rules: Assemblies & Setup]] |
| **Assembly** | A player's collection of characters purchased with BP. | [[rules-assemblies-and-setup\|Rules: Assemblies & Setup]] |
| **BP (Build Points)** | Points used to purchase characters and equipment. | [[rules-assemblies-and-setup\|Rules: Assemblies & Setup]] |
| **VP (Victory Points)** | Points awarded for achieving mission objectives. Most VP wins. | [[rules-mission-keys\|Rules: Mission Keys]] |
| **RP (Resource Points)** | Secondary scoring. Most RP breaks VP ties. | [[rules-mission-keys\|Rules: Mission Keys]] |
| **OM (Objective Marker)** | Mission-specific objectives (Switches, Keys, Ideas, Physical OMs). | [[rules-objective-markers\|Rules: Objective Markers]] |
| **Keys to Victory** | Common victory conditions (Elimination, Dominance, Bottled, etc.). | [[rules-mission-keys\|Rules: Mission Keys]] |
| **Bottle Test** | Unopposed POW Test when half or more models are KO'd/Eliminated. Fail = Bottled Out. | [[rules-damage-and-morale\|Rules: Damage & Morale]] |
| **Initiative Points [IP]** | Spendable resource held by Sides (not characters). Used for Maintain, Force, Refresh. | [[rules-initiative\|Rules: Initiative]] |

### Keys to Victory

| Key | VP | Description |
|-----|-----|-------------|
| **Elimination** | +1 | Most BP of KO'd+Eliminated enemies |
| **Bottled** | +1 | Opposing Side fails Bottle Test |
| **Outnumbered** | +1/+2 | Outnumbered 3:2 or 2:1 at game start |
| **Dominance** | +1/turn | Control designated zones/objectives |
| **Courier** | +1+ | Reach designated location |
| **First Blood** | +1 | First to Wound/KO/Eliminate enemy |
| **Sabotage** | +2 | Destroy Sabotage Points (QAI_13) |
| **Harvest** | +1 | Extract Intelligence Caches (QAI_15) |

---

## AI & Automation

| Term | Definition | Related |
|------|------------|---------|
| **AI Controller** | Assigned per Player (not per Side). Controls models autonomously. | [[rules-ai\|Rules: AI]] |
| **Tactical Doctrine** | AI strategic preference (27 combinations: 3×3×3). | [[rules-ai\|Rules: AI]] |
| **Engagement Style** | Melee-Centric, Ranged-Centric, or Balanced. | [[rules-ai\|Rules: AI]] |
| **Planning Priority** | Keys to Victory, Aggression, or Balanced. | [[rules-ai\|Rules: AI]] |
| **Aggression Level** | Defensive, Balanced, or Aggressive. | [[rules-ai\|Rules: AI]] |
| **Predicted Scoring** | VP/RP a Side would score if game ended now. Used for AI decision-making. | [[rules-ai\|Rules: AI]] |
| **Confidence Metric** | 0.0-1.0 rating of how secure a scoring lead is. | [[rules-ai\|Rules: AI]] |
| **GOAP** | Goal-Oriented Action Planning. AI multi-turn planning system. | [[rules-ai\|Rules: AI]] |
| **Utility Scoring** | Continuous action evaluation and selection. | [[rules-ai\|Rules: AI]] |
| **Behavior Tree** | Flexible decision-making with fallback behaviors. | [[rules-ai\|Rules: AI]] |
| **HFSM** | Hierarchical Finite State Machine. Structured action execution. | [[rules-ai\|Rules: AI]] |

---

## Quick Reference by Category

### Character Attributes
| Abbreviation | Full Name | Used For |
|--------------|-----------|----------|
| **CCA** | Close Combat Ability | Attacker/Defender Close Combat Hit, Disengage |
| **RCA** | Range Combat Ability | Attacker Range Combat Hit |
| **REF** | Reflexes | Defender Range Combat Hit, Disengage, Detect, Reacts |
| **INT** | Intellect | Initiative Tests |
| **POW** | Willpower | Morale Tests, Rally |
| **STR** | Strength | Damage, Throw OR, some Bow OR |
| **FOR** | Fortitude | Defender Damage, Revive |
| **MOV** | Movement | Movement rate, Agility, React distance |
| **SIZ** | Size | Wounds threshold, base diameter |

### Common Abbreviations
| Abbreviation | Meaning |
|--------------|---------|
| **AP** | Action Points |
| **BP** | Build Points |
| **VP** | Victory Points |
| **RP** | Resource Points |
| **OM** | Objective Marker |
| **IP** | Initiative Points |
| **MU** | Measured Unit (1" = 1 MU) |
| **OR** | Optimal Range |
| **ORM** | OR Multiple |
| **LOS** | Line of Sight |
| **LOF** | Line of Fire |
| **DR** | Difficulty Rating |
| **AR** | Armor Rating |
| **I** | Impact |
| **NA** | Not Applicable |
| **QSR** | Quick Start Rules |

---

## Source References

**Primary Source:** `MEST.Tactics.QSR.txt` - General Terms section (lines ~500-550)

**Related Documents:**
- [[rules-status\|Rules: Status]] — Character status tokens and conditions
- [[rules-tests-and-checks\|Rules: Tests & Checks]] — Dice and test mechanics
- [[rules-combat\|Rules: Combat]] — Combat terminology
- [[rules-movement\|Rules: Movement]] — Movement and Agility terms
- [[rules-mission-keys\|Rules: Mission Keys]] — Victory and scoring terms
- [[rules-ai\|Rules: AI]] — AI and automation terms
