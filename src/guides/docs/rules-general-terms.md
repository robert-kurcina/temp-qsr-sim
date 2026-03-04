---
title: General Terms & Glossary
description: Non-authoritative glossary index for MEST Tactics terminology and cross-rule navigation.
priority: 1
---

# General Terms & Glossary

This document is an index for term ownership. It should not carry canonical thresholds, formulas, or rule exceptions.

## Synchronization Policy

- Numeric thresholds, formulas, and edge cases are authoritative only in the owner documents linked below.
- If a rule behavior changes, update the owner document first; then update glossary wording only if the term meaning changed.
- Keep entries concise and descriptive. Avoid reproducing procedural steps or modifier math here.

---

## Core Terminology

| Term | Short Meaning | Rule Owner |
|------|---------------|------------|
| Initiative | The character whose turn it is, or who held it at Turn start. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, lines 496-507), `rules-initiative.md` |
| Target | A model, location, or terrain element selected for an action. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, lines 496-507), `rules-actions.md`, `rules-combat.md` |
| Active | The character currently resolving an action. | `rules-actions.md` |
| Passive | The character targeted by an active character's action. | `rules-actions.md` |
| Attacker | The acting character in an attack resolution. | `rules-combat.md` |
| Defender | The target character in an attack resolution. | `rules-combat.md` |
| Scrum | Three or more Opposing models engaged/in Melee Range interaction cluster. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, lines 503-504), `rule-close-combat.md` |
| Outnumbers | Relative Friendly-vs-Opposing count condition around the same melee target. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, line 504), `rules-situational-modifiers.md` |
| Agility | Movement feature derived from MOV and used during movement/LOS interactions. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, line 505), `rules-actions.md`, `rules-movement.md` |
| Physicality | Derived profile metric based on character attributes. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, lines 496-507) |
| Durability | Derived profile metric based on character attributes. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, lines 496-507) |
| Base-contact | Model-volume contact state used in melee interactions. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, line 507), `rules-size-base-diameter.md`, `rule-close-combat.md` |
| Facing | Model facing does not affect standard gameplay unless explicitly stated by variant rules. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, line 508) |
| Core Damage | Weapon flat damage value plus count of dice in its damage expression. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, lines 509-511), `rules-items.md` |
| Hindrance | Status-token category impacting many tests. | `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology, lines 512-514), `rules-status.md` |

---

## Standard Conditions (Pairs and Linked Terms)

| Pair | Rule Owner |
|------|------------|
| Friendly / Opposing | `rules-assemblies-and-setup.md` |
| Ready / Done | `rules-actions.md`, `rules-status.md` |
| In-Play / Out-of-Play | `rules-status.md` |
| Revealed / Hidden | `rules-actions.md`, `rules-visibility.md` |
| Attentive / Distracted | `rules-status.md` |
| Ordered / Disordered | `rules-status.md`, `rules-damage-and-morale.md` |
| Free / Melee Range / Engaged | `docs/canonical/MEST.Tactics.QSR.txt` (Standard Conditions, lines 528-530), `rule-close-combat.md`, `rule-disengage.md`, `rules-status.md` |

---

## Status and Flow Markers

| Marker | Scope | Rule Owner |
|--------|-------|------------|
| Wound | Hindrance/status | `rules-status.md`, `rules-damage-and-morale.md` |
| Delay | Hindrance/status | `rules-status.md`, `rules-actions.md` |
| Fear | Hindrance/status | `rules-status.md`, `rules-damage-and-morale.md` |
| Done | Turn flow | `rules-actions.md` |
| Wait | Turn flow/react flow | `rules-actions.md`, `rules-bonus-actions.md` |
| Hidden | Visibility/combat flow | `rules-actions.md`, `rules-visibility.md` |
| KO'd | Out-of-play state | `rules-status.md`, `rules-kod.md` |
| Eliminated | Removal state | `rules-status.md`, `rules-damage-and-morale.md` |

---

## Combat Vocabulary

| Term | Short Meaning | Rule Owner |
|------|---------------|------------|
| Hit Test | Attack-connection test. | `rule-close-combat.md`, `rule-direct-range-combat.md`, `rules-tests-and-checks.md` |
| Damage Test | Wound-resolution test after a valid hit path. | `rules-damage-and-morale.md`, `rules-tests-and-checks.md` |
| Cascades | Test-score margin used by multiple mechanics. | `rules-tests-and-checks.md` |
| Carry-over | Dice outcome transfer across linked tests. | `rules-tests-and-checks.md` |
| Bonus Actions | Cascade-spend maneuvers and related clauses. | `rules-bonus-actions.md` |
| Passive Options | Defender-side action options in opposed flows. | `rules-bonus-actions.md` |
| Impact (`I`) | Attack property interacting with defensive values. | `rules-items.md`, `rules-traits-list.md` |
| Armor Rating (`AR`) | Defensive value from armor/traits. | `rules-traits-list.md`, `rules-items.md` |
| Charge Bonus | Situational close-combat bonus condition. | `rules-situational-modifiers.md` |

---

## Movement, Visibility, and Terrain Vocabulary

| Term | Short Meaning | Rule Owner |
|------|---------------|------------|
| MU | Core movement measurement unit. | `rules-size-base-diameter.md`, `rules-movement-and-terrain.md` |
| MOV | Primary movement attribute. | `rules-characters-and-attributes.md` |
| LOS | Visibility line validation between model volumes. | `rules-visibility.md` |
| LOF | Fire-line concept used in ranged interactions. | `rules-friendly-fire-los.md` |
| OR / ORM | Range reference and distance multiple concept. | `rules-visibility.md`, `rule-direct-range-combat.md` |
| Point-blank | Short-range bracket concept. | `rule-direct-range-combat.md`, `rules-visibility.md` |
| Cover | Defensive terrain interaction. | `rules-terrain.md`, `rules-situational-modifiers.md`, `rules-friendly-fire-los.md` |
| Cohesion | Friendly-model proximity/visibility requirement. | `rules-visibility.md`, `rules-damage-and-morale.md` |

---

## Tests and Dice Vocabulary

| Term | Short Meaning | Rule Owner |
|------|---------------|------------|
| Base / Modifier / Wild dice | Core dice classes used in tests. | `rules-tests-and-checks.md` |
| Opposed Test | Two-sided test-resolution flow. | `rules-tests-and-checks.md` |
| Unopposed Test | Active-vs-system test-resolution flow. | `rules-tests-and-checks.md` |
| Test Score | Resulting value used for pass/fail and cascades. | `rules-tests-and-checks.md` |
| DR | Difficulty rating contribution in checks. | `rules-tests-and-checks.md` |

---

## Mission and Victory Vocabulary

| Term | Short Meaning | Rule Owner |
|------|---------------|------------|
| Mission | Scenario definition and win conditions. | `rules-missions.md`, `rules-missions-qai.md` |
| Side | Team/faction grouping for players and models. | `rules-assemblies-and-setup.md` |
| Assembly | Build-point roster for a player/side. | `rules-assemblies-and-setup.md` |
| BP | Build-point economy for roster construction. | `rules-assemblies-and-setup.md` |
| VP / RP | Primary and secondary scoring tracks. | `rules-mission-keys.md` |
| OM | Objective Marker entities and interactions. | `rules-objective-markers.md` |
| Keys to Victory | Shared mission scoring categories. | `rules-mission-keys.md` |
| Bottle Test | Morale-loss check impacting mission outcomes. | `rules-damage-and-morale.md`, `rules-mission-keys.md` |
| IP | Side-level initiative resource. | `rules-initiative.md` |

---

## AI and Automation Vocabulary

| Term | Short Meaning | Rule Owner |
|------|---------------|------------|
| AI Controller | Player-side automation controller. | `rules-ai.md` |
| Tactical Doctrine | AI preference profile. | `rules-ai.md` |
| Planning Priority | Mission-vs-combat planning bias. | `rules-ai.md` |
| Aggression Level | AI risk posture selector. | `rules-ai.md` |
| Predicted Scoring | Projected mission score signal for AI. | `rules-ai.md` |
| GOAP / Utility / Behavior Tree / HFSM | AI planning and action-selection layers. | `rules-ai.md` |

---

## Common Abbreviations

| Abbreviation | Meaning | Rule Owner |
|--------------|---------|------------|
| AP | Action Points | `rules-actions.md` |
| BP | Build Points | `rules-assemblies-and-setup.md` |
| VP / RP | Victory / Resource Points | `rules-mission-keys.md` |
| OM | Objective Marker | `rules-objective-markers.md` |
| IP | Initiative Points | `rules-initiative.md` |
| MU | Measured Unit | `rules-size-base-diameter.md` |
| OR / ORM | Optimal Range / Optimal Range Multiple | `rules-visibility.md`, `rule-direct-range-combat.md` |
| LOS / LOF | Line of Sight / Line of Fire | `rules-visibility.md`, `rules-friendly-fire-los.md` |
| DR | Difficulty Rating | `rules-tests-and-checks.md` |
| AR | Armor Rating | `rules-traits-list.md` |

---

## Canonical Source Reference

- Primary canonical source: `docs/canonical/MEST.Tactics.QSR.txt` (Common Terminology / Standard Conditions, lines 496-531).
- Related owner rules are listed in each table above.
