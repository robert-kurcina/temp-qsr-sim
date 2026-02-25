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

### Standard Conditions (Paired)

- **Revealed / Hidden**
- **Attentive / Distracted**
- **Ordered / Disordered**
- **Ready / Done**

### Turn Flow Statuses

- **Ready:** Can be activated in the current Turn.
- **Done:** Activation completed for the current Turn.
- At Turn start, Done tokens are removed from In-Play models; they become Ready.
- **KO'd models are never Ready** (always Done / non-active).

### In-Play State

- **In-Play:** Not KO'd and not Eliminated.
- **Out-of-Play:** KO'd or Eliminated.

### Hindrance-Derived States

Hindrance penalty: **-1 Modifier die to Tests (except Damage Tests) per Hindrance type present** (Wound/Fear/Delay).

| Status | Threshold | Notes |
| :--- | :--- | :--- |
| **Wounded** | 1+ Wound | Hindrance type present. |
| **Distracted** | 1+ Delay | Opposite of Attentive. |
| **Stunned** | Delay >= AP allotment | Additional Delay converts to Wound as Stun damage. |
| **Nervous** | 1+ Fear | No compulsory action by itself. |
| **Disordered** | 2+ Fear | No longer Ordered. |
| **Panicked** | 3+ Fear | Disordered; compulsory movement behavior applies. |
| **Eliminated (Fear)** | 4+ Fear | Immediate elimination condition. |

### KO'd and Eliminated

- **KO'd:** Wound tokens >= SIZ.
- **Eliminated (Wounds):** Wound tokens >= SIZ + 3.
- **Eliminated (Fear):** 4+ Fear tokens.
- Exiting battlefield can also cause Elimination (mission/context dependent).
- KO'd models:
  - Are Out-of-Play and never Ready.
  - Do not cause engagement.
  - Lose Done/Wait/Hidden and most status markers per KO cleanup rules.
  - Can be treated as terrain for movement/cover interactions per QSR.

### Token Summary

- **Done:** Activation completion marker.
- **Wait:** Enables React windows and related modifiers.
- **Hidden:** Concealment marker.
- **Wound / Delay / Fear:** Hindrance status tokens.
