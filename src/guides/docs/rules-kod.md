---
title: "Rules: KO'd Attacks"
dependencies:
  - "Rules: Combat"
  - "Rules: Status"
status: "In-Progress"
---

# Attacking KO'd Models (△)

Attacking KO’d characters is **disallowed** for the **Basic** and **Introductory** games. This rule prevents anti-thematic attacks on most KO’d characters.

> **UI Toggle:** This ruleset is **optional** and must be explicitly enabled. Default is **false**.

## Exceptions by Attacker/Target Classification

### Panicked
Characters which are **Panicked** may **always** perform attacks against opposing KO’d models.

### Amoral
Characters which are **“evil” or “dishonorable”** may attack KO’d characters. These attackers must have **one or more** of:

- `[Delusional]`
- `[Coward]`
- `[Ravenous]`
- `[Treacherous]`
- `[Vitriol]`
- **Fear**
- **Insane**
- **Poisoner**
- **Terrifying**
- **Torment**

### Primal
Animal characters with **[Beast]**, **[Beast!]**, or **[Beast+]** may **not** attack KO’d models **unless** they also have one of:

- `[Ravenous]`
- **Fear**
- **Insane**
- **Terrifying**

### Puppet
Characters with **Automaton** or **[Mindless]** may attack KO’d models **only if** their **Controller/Coordinator** has one or more of:

- `[Delusional]`
- `[Coward]`
- `[Treacherous]`
- **Insane**

### Unnatural (Target Trait)
Targets with any of the following traits may **always** be attacked if they are KO’d:

- `[Automaton]`
- **Invader**
- **Outsider**
- **Supernatural**
- **Mythos**
- **Fear**
- **Machine**
- `[Mindless]`
- `[Ravenous]`

---

## Resolving Attacks Against KO’d Models

When KO’d models are attacked, do the following:

1. **KO’d models may be attacked to cause Elimination.**
2. **Range attacks** against KO’d models use an **Unopposed RCA Test** and **award +3** to the Attacker Range Combat Hit Test.
3. **Melee attacks** against KO’d targets in Melee Range are **automatic hits**; perform only the **Damage Test** with **+3 Damage**.
4. KO’d models **reduce each Armor Rating by 3**.
5. **Elimination Threshold:** If the attack causes **Wound damage** that is **at least SIZ − 3**, the model is **Eliminated**. Otherwise, **nothing happens**.

---

## Related Rules

- [[rules-combat|Rules: Combat]]
- [[rules-status|Rules: Status]]
- [[rules-traits-list|Rules: Traits List]]
