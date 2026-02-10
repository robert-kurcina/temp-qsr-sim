---
title: "Rules: Friendly Fire & LOF"
dependencies:
  - "Rules: Terrain"
status: "In-Progress"
---

## Friendly Fire ()

Whenever the target of a Direct Range Attack is missed; one randomly selected model, Opposing or Friendly, is subject to being attacked starting with those closest to the target as follows in this order:

1. If it is in base-contact with the target
2. If it is within 1" of the target
3. If it is within 1" of LOF to the target

Once the new target is determined, have the player of the new target perform an Unopposed REF Test as a Defender Hit Test DR misses from the failed Attack.

- Do not Reduce Armor Rating if a Concentrated attack.
- Friendly Attentive Ordered models in base-contact with the model performing a Direct Range Attack are never in risk of “Friendly Fire”.

## LOF & Obscured

Obscured — Attacker Hit or Detect Tests for 1, 2, 5, or 10 other models within LOF to the target, and for non-Opposing models beyond but within 1 MU of LOF. Each is -1 Modifier die.

## LOF Operations (Implementation Anchor)

### LOS/LOF Blockers

Models can be blockers. LOF queries should return all models along the LOF segment so rules like Friendly Fire and Obscured can be resolved.

### Selection Order

When determining Friendly Fire:
- Prefer base-contact with the target
- Then within 1" of the target
- Then within 1" of LOF to the target

### LOF Width

LOF is treated as a 1 MU wide corridor for overlap checks.
