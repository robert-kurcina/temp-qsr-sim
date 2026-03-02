# Section 10: Current Task - Capture Spatially Aware Game Requirements

> **Extracted from:** `/Users/kitrok/projects/temp-qsr-sim/blueprint.md`
> **Original Lines:** 150-265
> **Extraction Date:** 2026-03-02

---

## 10. Current Task: Capture Spatially Aware Game Requirements

### Completed Steps

1.  **Corrected `dice-roller.ts` and `dice-roller.test.ts`:** The core dice-rolling logic is now fixed and validated.
2.  **Established `blueprint.md`:** This document has been created and refined to serve as our single source of truth.
3.  **Corrected `hit-test.test.ts`:** All tests related to hit resolution are now passing.
4.  **Implemented `damage-parser.ts`:** The damage formula parser has been rewritten to use robust string manipulation instead of regular expressions.
5.  **Implemented `damage.ts` and `damage.test.ts`:** The core damage subroutine and its tests are now fully implemented and passing, ensuring correct wound calculation, status effects (KO/Elimination), and dice modifier handling.
6.  **Refactored `Character.ts` to a class:** `Character.ts` is now a class that takes a `Profile` in its constructor.
7.  **Created `types.ts`:** `FinalAttributes` and `ArmorState` are now in a separate file.
8.  **Updated `battlefield.test.ts`:** The test now uses the new `Character` class structure.
9.  **All unit tests passing:** Full suite is green.
10. **Implemented profile/assembly pipeline:** Added profile builder and assembly creation helpers to turn archetypes + items into characters within an assembly.

### Next Steps

Define and implement the minimum game loop and spatial model required by the QSR to make the simulator "spatially aware" and playable:

1.  **Battlefield Model (Spatial Awareness Core)**
    Represent a battlefield with measurable MU distances, model base sizes (diameter/height), and model volumes for LOS checks. Support LOS/LOF rules, including blocking terrain, cover determination (direct/intervening), and visibility OR constraints.
2.  **Terrain & Movement Rules**
    Encode terrain categories (Clear, Rough, Difficult, Blocking) and movement costs, including base-contact constraints, engagement, and agility-based movement exceptions.
3.  **Mission Setup & Game Size**
    Implement mission configuration for the default "Elimination" mission, including game size assumptions (Small), model count, and BP budget constraints.
4.  **Turn & Action Loop (Playable Flow)**
    Implement turn structure with Ready/Done statuses, core actions (Move, Close Combat Attack, Ranged Attack, Disengage), and basic status token handling (Hidden, Wound, Delay, Fear, KO, Eliminated).

### Spatial Awareness Priorities (2D Footprint Placeholder)

Model volume is temporarily treated as a 2D footprint (base circle/mesh). Priorities are ordered from least-dependent to most-dependent:

1.  **Model registry + measurement utilities**
2.  **Engagement + melee range checks**
3.  **LOS + LOF integration (2D footprint)**
4.  **Cover classification (direct/intervening, hard/soft/blocking)**
5.  **Cohesion + situational awareness**
6.  **Safety + compulsory actions**
7.  **Hidden/Detect/Wait spatial interactions**

### Mission Side Wiring (Near-Term Plan)

1.  **MissionSide bindings**
    Establish a side-level container that binds Assemblies to a Side and assigns portrait call signs, model slots, positions, and per-character status. This is the primary home for side-specific state.
2.  **Assembly merge builder**
    Provide a helper to combine multiple Assemblies into a single composite roster (e.g., 250 BP + 500 BP → 750 BP) before assigning to a Side.
3.  **Side assignment flow**
    Allow multiple Assemblies to be assigned to a Side (with or without merging) and maintain a single roster with consistent identifiers.

### Future UI Flow (Non-Blocking)

At some point a UI will be needed to:
- Build Profiles
- Build Characters from Profiles
- Build Assemblies from Characters
- Assign Assemblies to Mission Sides

## 10.1 Gaps, Mismatches, and Unused Data (Tracking)

These are known gaps/mismatches to be addressed later and treated as a prioritized backlog.

### Doc Mismatches
- **Sudden Death:** QSR does **not** include sudden-death; it is an optional setup toggle. Default must be **false**.
- **Status Docs:** `rules-status.md` is incomplete vs QSR and must be filled out.

### Engine Gaps (Partial Implementations)
- **LOS/LOF fidelity:** 2D footprint; lacks 3D/height-based checks.
- **Traits:** Parser exists, but full trait logic coverage is incomplete.
- **Objective Markers:** QSR OM types/actions consolidated; remaining gaps are per-mission wiring and UI exposure.
- **Indirect Combat:** Scatter/AoE/Frag/Scrambling are implemented; remaining gap is terrain/elevation fidelity for roll-down.
- **Mission Keys Wiring:** Several keys exist but are not fully wired into gameplay events.
- **Mission AI objective behavior:** Mission runtime scoring now updates in AI validation runs, but AI action-selection remains mostly objective-agnostic in several missions (e.g., QAI_12/14/15/17 showed QAI_11-like action profiles under identical seed/loadout). See `generated/ai-battle-reports/mission-scan-summary-qai11-20.json`.
- **Mission scoring parity:** Current mission scan shows empty mission VP payloads for QAI_11 and QAI_13 (`vp: {}`), which must be resolved by rule-confirmed scoring semantics or explicit mission-level no-VP documentation.
- **Mission event hook coverage:** Mission runtime hooks are still strongest on direct-attack paths; reactive/passive/interrupt attack consequences are not yet fully reflected into mission event/scoring updates.
- **Movement/Terrain:** ✅ **FIXED** (2026-03-02) — `isMovementBlocking` now correctly distinguishes between blocking terrain (trees, buildings, walls) vs. difficult/rough terrain (shrubs, rocks). Previously, `initialMovement: "Impassable"` was incorrectly treated as fully blocking instead of only preventing movement initiation.

### Optional Rule Toggle (Required)
- **VP Tie-Breaker:** Optional flag. If enabled, the **Initiative Card holder wins ties after RP→VP adjustment**. Default: `false`.
- **KO'd Attacks:** Optional flag. If enabled, allows attacking KO'd models per `rules-kod.md`. Default: `false`.

### Unused Data in `src/lib/data.ts`
The runtime does **not** currently consume these categories:
- `active_options`
- `game_rules`
- `game_sizes`
- `grenade_weapons`
- `item_classifications`
- `keyword_descriptions`
- `missions`
- `page_content`
- `rules`
- `sample_characters`
- `support_weapons`
- `tech_level`
- `thrown_weapons`

## 10.2 Prioritized Implementation Plan (Rebalanced for Core Stability)

**This plan supersedes all previous priority orderings (2026-02-27).**

The priority structure has been rebalanced to establish **core simulator stability** before building AI capabilities on top. The guiding principle is: **QSR Rules Compliance → Engine Stability → AI System**.

### Priority Levels (Rebalanced)

| Priority | Focus | Description |
|----------|-------|-------------|
| **P0-CRITICAL** | QSR Rules Gaps | Core rules compliance blockers (Initiative, IP, deployment) |
| **P1-HIGH** | Engine Stability | Unified battle runner, deployment system, mission runtime |
| **P2-MEDIUM** | AI Foundation | Utility scoring, CharacterAI, tactical doctrine |
| **P3-LOW** | AI Intelligence | Mission-aware AI, squad coordination, reactive play |
| **P4-LOWEST** | Validation | Test coverage, regression suites, battle analysis tools |

**Key Change:** Deployment intelligence moves from "AI feature" to **P1-HIGH engine feature** — it's a QSR rule requirement, not optional AI polish.

---

## Document Index

**Blueprint Document Collection**

| Document | Path | Description |
|----------|------|-------------|
| **01 - Overview** | `/docs/blueprint/01-overview.md` | Project overview and core principles |
| **02 - Implementation Plan** | `/docs/blueprint/02-implementation-plan.md` | Full prioritized implementation plan |
| **03 - Current Task** | `/docs/blueprint/03-current-task.md` | Current task and tracking (this document) |
| **Phase 0 - QSR Rules** | `/docs/blueprint/phases/phase-0-qsr-rules.md` | Phase 0: QSR Rules Gap Closure |
| **Phase 1 - Engine** | `/docs/blueprint/phases/phase-1-engine.md` | Phase 1: Core Engine Stability |
| **Phase 2 - AI Foundation** | `/docs/blueprint/phases/phase-2-ai-foundation.md` | Phase 2: AI Foundation |

---

*Extracted from `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (9449 lines)*
