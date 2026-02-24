---
title: "Rules: Character Status"
dependencies:
  - "Rules: Core Mechanics" # DONE
  - "Rules: Character Attributes" # DONE
  - "Rules: Damage & Wounds" # In-Progress
status: "Planning"
---

## Character Statuses

Statuses are derived from tokens, actions, and game flow. The primary token types in QSR are **Wound**, **Delay**, and **Fear** (Hindrance types).

### Core Activation Statuses

- **Ready:** The character can be activated this turn.
- **Done:** The character has completed its activation this turn.

### Awareness & Control Statuses

- **Attentive:** Default state; can React and use full options.
- **Distracted:** 1+ Delay tokens. Loses Attentive status.
- **Ordered:** Default state; not Disordered or Panicked.
- **Disordered:** 2+ Fear tokens; loses Ordered status.
- **Panicked:** 3+ Fear tokens; also Disordered.

### Concealment Statuses

- **Revealed:** Visible on the battlefield.
- **Hidden:** Concealed; opposing models must Detect to reveal.

### Hindrance Statuses (Wound, Delay, Fear)

Each Hindrance token imposes **−1 Modifier die** to Tests (except Damage Tests).  
Hindrance tokens create the following derived statuses:

| Status | Threshold | Notes |
| :--- | :--- | :--- |
| **Wounded** | 1+ Wound | Indicates injury and contributes to Hindrance. |
| **Delayed** | 1+ Delay | Character is Distracted. |
| **Stunned** | 2+ Delay | Character is unable to take most actions. |
| **Nervous** | 1+ Fear | No compulsory action. |
| **Disordered** | 2+ Fear | No longer Ordered. |
| **Panicked** | 3+ Fear | Disordered; may trigger compulsory behavior. |
| **Eliminated** | 4+ Fear | Automatic elimination (panic collapse). |

### KO / Eliminated

- **KO’d:** Wounds ≥ SIZ.
- **Eliminated:** Wounds ≥ SIZ + 3, or 4+ Fear tokens (panic collapse).

### Token Summary

- **Wound:** From Damage resolution.
- **Delay:** From Reactions, special actions, or traits.
- **Fear:** From failed Fear Tests, usually after Wounds or nearby KO/Elim events.
