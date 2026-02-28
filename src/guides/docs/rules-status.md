---
title: "Rules: Character Status"
dependencies:
  - "Rules: Core Mechanics"
  - "Rules: Character Attributes"
  - "Rules: Damage & Wounds"
status: "Complete"
---

## Character Statuses

Statuses are created by tokens, action flow, and mission state. The core Hindrance token types are **Wound**, **Delay**, and **Fear**.

### Token Colors (QSR Line 48-53)

| Token | Color | Size |
|-------|-------|------|
| **Done** | Blue | Largest |
| **Wait** | White or clear | Big |
| **Hidden** | Dark | Small |
| **Wound** | Red | Small |
| **Delay** | White or clear | Small |
| **Fear** | Yellow | Small |

### Standard Conditions (Paired)

Each of the Standard Conditions usually have a pairing (QSR Line 517):

- **Friendly / Opposing**
- **Revealed / Hidden**
- **Attentive / Distracted**
- **Ordered / Disordered**
- **Ready / Done**
- **In-Play / Out-of-Play**
- **Free / Engaged**

### Turn Flow Statuses

- **Ready:** All models begin each Mission as Ready. Can be activated in the current Turn.
- **Done:** Characters that have completed all of their activities are Done. These models are marked with a Done token.
- At Turn start, remove all Done tokens from all models; this makes all In-Play characters become Ready.
- **KO'd characters are never Ready**; always Done, and never Active.

### In-Play State

- **In-Play:** A character that is not KO'd or Eliminated is In-Play.
- **Out-of-Play:** A character not In-Play. Usually KO'd or Eliminated.

### Hindrance-Derived States

Hindrance penalty: **-1 Modifier die to Tests (except Damage Tests) per Hindrance type present** (Wound/Fear/Delay).

| Status | Threshold | Notes |
| :--- | :--- | :--- |
| **Wounded** | 1+ Wound | Hindrance type present. |
| **Distracted** | 1+ Delay | Opposite of Attentive. Models with Delay tokens are Distracted. |
| **Stunned** | Delay >= AP allotment | Additional Delay converts to Wound as Stun damage. |
| **Nervous** | 1+ Fear | No compulsory action by itself. |
| **Disordered** | 2+ Fear | No longer Ordered. Characters with 2 or more Fear tokens are Disordered. |
| **Panicked** | 3+ Fear | Disordered; compulsory movement behavior applies. |
| **Eliminated (Fear)** | 4+ Fear | Immediate elimination condition. |

### KO'd and Eliminated

- **KO'd:** A model is KO'd when it has received Wound tokens matching its SIZ.
  - KO'd models never cause Opposing models to be Engaged.
  - KO'd models are never Ready; always Done, and never Active.
- **Eliminated (Wounds):** Wound tokens >= SIZ + 3.
- **Eliminated (Fear):** 4+ Fear tokens.
- **Eliminated (Movement):** Exiting the battlefield is automatic Elimination.
- **Eliminated (Other):** Characters which have been removed from play as result of movement, combat, fear, or other means.

### KO'd Model Rules

KO'd models:
- Are Out-of-Play and never Ready.
- Do not cause engagement (Opposing models are not Engaged by KO'd models).
- Lose Done/Wait/Hidden and most status markers per KO cleanup rules.
- Can be treated as terrain for movement/cover interactions per QSR.

### Detailed Status Definitions

#### Friendly / Opposing (QSR Line 519)
- **Friendly:** All models controlled by the same player, or by players of the same Side, are Friendly.
- **Opposing:** Models which are not Friendly are Opposing.

#### Ready / Done (QSR Line 519)
- **Ready:** All models begin each Mission as Ready.
- **Done:** Characters that have completed all of their activities are Done. These models are marked with a Done token.

#### In-Play / Out-of-Play (QSR Line 520-521)
- **In-Play:** A character that is not KO'd or Eliminated is In-Play.
- **Out-of-Play:** A character not In-Play. Usually KO'd or Eliminated.

#### Revealed / Hidden (QSR Line 525)
- **Revealed:** Characters that are not Hidden are instead Revealed.
- **Hidden:** Some characters may become Hidden during the course of the game. Each model not in LOS of any Opposing models, or behind Cover, may start as Hidden.

#### Attentive / Distracted (QSR Line 526)
- **Attentive:** Characters are usually Attentive unless Knocked-out [ KO'd ].
- **Distracted:** The opposite of Attentive is Distracted. Models with Delay tokens are Distracted.

#### Ordered / Disordered (QSR Line 527)
- **Ordered:** Characters which are not Disordered are instead Ordered.
- **Disordered:** Characters with 2 or more Fear tokens are Disordered.

#### Free / Engaged (QSR Line 528-529)
- **Free:** Models that are not Engaged are Free.
- **Engaged:** A model is considered Engaged if it is within the Melee Range of an Opposing model.
- **Melee Range:** A target is within Melee Range if its volume is in base-contact with an Opposing model's volume.

### Token Summary

- **Done:** Activation completion marker.
- **Wait:** Enables React windows and related modifiers.
- **Hidden:** Concealment marker.
- **Wound / Delay / Fear:** Hindrance status tokens.

### Notes

 Delay, Fear, and Wound tokens are a Hindrance status type (QSR Line 531).
