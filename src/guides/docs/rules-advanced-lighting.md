---
title: "Advanced Rules: Lighting"
description: Light sources and visibility modifiers.
status: "DEFERRED - Requires QSR implementation first"
---

# Advanced Rules: Lighting (▲)

**Status:** ⏳ **DEFERRED** - Requires visibility system completion plus Light trait support.

---

## Overview

Advanced lighting rules cover light sources, visibility modifiers, and low-light combat.

---

## Light Sources

| Source | Light X | Duration |
|--------|---------|----------|
| **Torch** | 4-6 | 10 Turns |
| **Lantern** | 6-8 | 30 Turns |
| **Fire** | 7-10 | Variable |
| **Searchlight** | 10-12 | Concentrated |

---

## Light Effects

### Visibility Modification

- **Light X** extends Visibility OR by X MU
- **Darkness** reduces Visibility OR

### Concealment

- **Shadowed areas** provide concealment
- **Illuminated targets** easier to hit

---

## Implementation Requirements

### Traits Needed
- **Light X** — Light source intensity

### Runtime Components
- Dynamic lighting
- Shadow calculation
- Low-light visibility

---

## Related Rules

- [[rules-visibility|Rules: Visibility]]
- [[rules-advanced-fire|Rules: Advanced Fire]]

---

**Source:** `docs/MEST.Tactics.Advanced-Lighting.txt`  
**Status:** ⏳ **DEFERRED**
