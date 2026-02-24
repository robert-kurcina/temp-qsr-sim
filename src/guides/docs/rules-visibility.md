---
title: Visibility, Lighting, and OR Multiples
description: QSR visibility and distance rules for lighting, OR, ORM, and concentrate interactions.
---

# Visibility, Lighting, and OR Multiples

This module captures the QSR measuring and visibility rules that control ranged targeting distance.

## Core Terms

- **OR (Optimal Range):** Distance band used for tests and attack methods.
- **ORM (OR Multiple):** Distance penalty scale derived from OR.
- **Max ORM:** Under normal conditions, OR-based tests are capped at ORM 3.
- **Visibility OR:** Global range cap from atmospheric lighting; also participates in OR/ORM resolution.

## Lighting Presets (QSR)

- **Day, Clear:** Visibility OR = **16 MU**
- **Twilight, Overcast:** Visibility OR = **8 MU**

Visibility limits all other OR and range values. For ranged attacks, use the smaller OR between visibility and weapon/method OR when computing ORM.

## ORM Resolution

- Compute ORM from distance and effective OR (the smaller OR in effect).
- Normal checks use **Max ORM 3**.
- Point-blank remains based on half-OR behavior.

## Concentrate Interaction

When Concentrate is applied to the Attacker Hit Test:

- Double all OR values used by the action (including visibility-based OR effects).
- Ignore the normal Max ORM cap for that action.

## Wait Interaction

While in Wait status:

- Visibility OR is doubled.
- Hidden opposing models in LOS and not in cover can be revealed immediately.

## Session Configuration Mapping

Current simulation/session controls:

- `lighting`: `"Day, Clear"` (default) or `"Twilight, Overcast"`
- `visibilityOrMu`: derived from lighting preset
- `maxOrm`: default `3`
- `allowConcentrateRangeExtension`: default `true`
- `perCharacterFovLos`: default `false`

When `perCharacterFovLos` is `false`, AI planning can reason across full-board targets/paths. When `true`, per-character LOS/FOV gating is enforced in AI target/path selection.
