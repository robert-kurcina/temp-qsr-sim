---
title: Advanced Rules Index
description: Index of all Advanced Rules (▲) for MEST Tactics. These are optional rules for experienced players.
status: "PARTIAL - Source audit expanded; runtime implementation remains mostly deferred"
---

# Advanced Rules Index

**Status:** ⚠️ **PARTIAL** - Source mappings are being audited, but most advanced modules still require dedicated runtime ownership.

---

## Overview

Advanced Rules (marked with **▲**) are optional rules for experienced players seeking maximum detail and realism. These rules add significant complexity and should only be used after mastering the Basic and Intermediate rules.

**Prerequisites:**
- ✅ Core QSR rules implemented
- ⏳ Full trait system wired (many advanced traits not yet in `traits_descriptions.json`)
- ⏳ 3D terrain/height modeling (for some rules)
- ⏳ UI for marker management (Fire, ROF, Suppression, Gas, etc.)

---

## Advanced Rules Modules

| Module | Topic | Status | Dependencies |
|--------|-------|--------|--------------|
| [Advanced Fire](./rules-advanced-fire) | Fire markers, Scorch Tests, Spreading Fire | ⏳ DEFERRED | Fire trait, Gas markers, terrain flammability |
| [Advanced ROF](./rules-advanced-rof) | Rate-of-Fire weapons, ROF markers, Suppression | ⏳ DEFERRED | ROF trait, [Feed], [Jam], [Jitter] traits |
| [Advanced Suppression](./rules-advanced-suppression) | Suppression markers, Suppress action, Crossing Suppression | ⏳ DEFERRED | ROF, Explosion trait, Take Cover! |
| [Advanced Firelane](./rules-advanced-firelane) | Firelane markers, area denial | ⏳ DEFERRED | ROF, Suppression |
| [Advanced Effects](./rules-advanced-effects) | Special effects and conditions | ⏳ DEFERRED | Core status system |
| [Advanced Gas/Fume/Puffs](./rules-advanced-gas-fume-puffs) | Gas markers, Blacksmoke, Steam | ⏳ DEFERRED | Gas traits, Fire interaction |
| [Advanced Go](./rules-advanced-go) | [GO] trait and related mechanics | ⏳ DEFERRED | GO trait |
| [Advanced Champions](./rules-advanced-champions) | Champion system, character progression | ⏳ DEFERRED | Phase 5 feature (non-QSR) |
| [Advanced LoA](./rules-advanced-loa) | Level-of-Absurdity semantics | ⚠️ PARTIAL | Champions + technology age filters |
| [Advanced Technology](./rules-advanced-technology) | Tech level rules, equipment restrictions | ⏳ DEFERRED | Tech level system |
| [Advanced Terrain](./rules-advanced-terrain) | Advanced terrain features and effects | ⏳ DEFERRED | Core terrain system |
| [Advanced Buildings](./rules-advanced-buildings) | Building interior navigation, multi-level combat | ⏳ DEFERRED | 3D terrain, LOS |
| [Advanced Lighting](./rules-advanced-lighting) | Light sources, visibility modifiers | ⏳ DEFERRED | Visibility system, Light X trait |
| [Advanced Webbing](./rules-advanced-webbing) | Web markers, entanglement | ⏳ DEFERRED | Web trait, Grenade rules |

---

## Implementation Priority

### Phase 1: Core Advanced Rules (Post-QSR)
1. **ROF & Suppression** - Most commonly used advanced rules
2. **Fire** - Dynamic terrain feature
3. **Gas/Fume/Puffs** - Environmental effects

### Phase 2: Situational Advanced Rules
4. **Firelane** - Area denial tactics
5. **Effects** - Special conditions
6. **Terrain/Buildings** - Enhanced environment

### Phase 3: Specialized Advanced Rules
7. **Lighting** - Visibility enhancements
8. **Webbing** - Specialized weapon effects
9. **Go** - Command mechanics
10. **LoA** - Level-of-Absurdity campaign semantics

### Phase 5: Campaign Features (Non-QSR)
11. **Champions** - Character progression system

---

## Trait Dependencies

The following traits need to be added to `traits_descriptions.json`:

| Trait | Module | Description |
|-------|--------|-------------|
| **ROF X** | ROF | Rate of Fire - allows X ROF markers |
| **[Feed X]** | ROF | Weapon feeding mechanism |
| **[Jam X]** | ROF | Weapon jamming chance |
| **[Jitter]** | ROF | Recoil/instability |
| **Fire X** | Fire | Creates Fire markers |
| **Explosion X** | Suppression | Blast effect |
| **Frag X** | Suppression | Fragmentation effect |
| **Gas:Blacksmoke** | Gas/Fume | Black smoke cloud |
| **Gas:Steam** | Gas/Fume | Steam cloud |
| **Light X** | Lighting | Light source intensity |
| **Web X** | Webbing | Entanglement web |
| **[GO]** | Go | Command trait |

---

## Marker Requirements

Advanced rules require physical or digital markers:

| Marker Type | Size | Quantity | Notes |
|-------------|------|----------|-------|
| **Fire** | 0.75-3 MU diameter | 10-20 | 4 sizes (1-4 Fire points) |
| **ROF/Suppression** | 1" diameter | 20-30 | Double-sided markers |
| **Gas** | 1-3 MU diameter | 10-15 | Multiple types (Blacksmoke, Steam, etc.) |
| **Web** | 1-2 MU diameter | 5-10 | Entanglement markers |

---

## Related Documents

- [[rules-advanced|Rules: Advanced]] — Basic advanced rules (Reacts, etc.)
- [[rules-traits-list|Rules: Traits List]] — Core trait reference
- [[rules-terrain|Rules: Terrain]] — Terrain fundamentals
- [[rules-visibility|Rules: Visibility]] — Visibility and lighting basics

---

## Source References

**Primary Sources:**
- `docs/canonical/MEST.Tactics.Advanced-Fire.txt`
- `docs/canonical/MEST.Tactics.Advanced-ROF.txt`
- `docs/canonical/MEST.Tactics.Advanced-Suppression.txt`
- `docs/canonical/MEST.Tactics.Advanced-Firelane.txt`
- `docs/canonical/MEST.Tactics.Advanced-Effects.txt`
- `docs/canonical/MEST.Tactics.Advanced-Gas.Fume.Puffs.txt`
- `docs/canonical/MEST.Tactics.Advanced-Go.txt`
- `docs/canonical/MEST.Tactics.Advanced-Champions.txt`
- `docs/canonical/MEST.Tactics.Advanced-LoA.txt`
- `docs/canonical/MEST.Tactics.Advanced-Technology.txt`
- `docs/canonical/MEST.Tactics.Advanced-Terrain.txt`
- `docs/canonical/MEST.Tactics.Advanced-Buildings.txt`
- `docs/canonical/MEST.Tactics.Advanced-Lighting.txt`
- `docs/canonical/MEST.Tactics.Advanced-Webbing.txt`

---

**Last Updated:** March 4, 2026  
**Status:** Source-audit mappings expanded; runtime implementation remains mostly deferred
