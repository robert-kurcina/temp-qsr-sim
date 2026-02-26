---
title: "Advanced Rules: Firelane"
description: Firelane markers and area denial tactics.
status: "DEFERRED - Requires QSR implementation first"
---

# Advanced Rules: Firelane (▲)

**Status:** ⏳ **DEFERRED** - Requires core QSR implementation plus Firelane trait support.

---

## Overview

**Firelane** markers represent pre-sighted areas of fire coverage that deny enemy movement through specific zones.

---

## Firelane Markers

### Placement

Firelane markers are placed to cover:
- **Chokepoints** (doorways, bridges, narrow passages)
- **Approach lanes** to defensive positions
- **Objective approaches**

### Coverage Area

| Marker Type | Coverage |
|-------------|----------|
| **Light Firelane** | 1" wide × 8" long |
| **Heavy Firelane** | 2" wide × 12" long |

---

## Firelane Effects

### Crossing Firelane

Models **crossing a Firelane** are subject to **automatic attacks**:

1. **Unopposed Attack** at -1m per Firelane marker
2. **No Hit Test** — automatically hits
3. **Damage Test** resolved normally

### Suppressing Firelane

Firelanes create **Suppression effects** in covered area:
- **DR 1** per Firelane marker
- **Maximum DR 4**

---

## Implementation Requirements

### Traits Needed
- **Firelane X** — Creates Firelane markers

### Markers Required
- **Firelane markers** (Light and Heavy templates)

---

## Related Rules

- [[rules-advanced-suppression|Rules: Advanced Suppression]]
- [[rules-advanced-rof|Rules: Advanced ROF]]

---

**Source:** `docs/MEST.Tactics.Advanced-Firelane.txt`  
**Status:** ⏳ **DEFERRED**
