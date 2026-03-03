# QSR Master Index

**Purpose:** Map canonical sources to structured clause tracking and current verification status.

**Last Updated:** 2026-03-03
**Status:** ⚠️ **P1 runtime closure complete; source-audit inventory in progress**

> Current truth source for core P1 runtime progress:
> `docs/qsr/P1_RULES_STATUS.md`

---

## Project Summary

| Category | Status |
|----------|--------|
| **P0 Non-AI Rules** | ✅ Clause tracked and behavior-verified |
| **P1 Core Files (Visibility/Cover/Initiative+Activation/Move/Morale)** | ✅ Runtime-verified for full tracked clause scope |
| **P0 AI Decision Rules** | ⚠️ Partially verified |
| **P2 Advanced/Edge Rules** | ⚪ Not Started |

**Current full-suite baseline:** `npx vitest run` → **147 files, 2364 tests passing**.

---

## Canonical Sources

### Primary Canonical (QSR)

| File | Lines | Topic | Priority | Status |
|------|-------|-------|----------|--------|
| `docs/canonical/MEST.Tactics.QSR.txt` | 1-1702 | Core rules | P0 | ✅ Audited (P0/P1 scope) |
| `docs/canonical/MEST.Tactics.Missions.txt` | 1-??? | Mission rules | P0 | ⚠️ Partially Audited |
| `docs/canonical/MEST.Tactics.Objectives.txt` | 1-??? | Objective rules | P1 | ⚪ Not Started |
| `docs/canonical/MEST.Tactics.MissionKeys.txt` | 1-??? | Victory conditions | P0 | ⚠️ Partially Audited |
| `docs/canonical/MEST.Tactics.Indirect.txt` | 1-??? | Indirect combat | P2 | ⚪ Not Started |
| `docs/canonical/MEST.KOd.txt` | 1-??? | KO rules | P1 | ⚠️ Partially Audited |
| `docs/canonical/MEST.Tactics.Advanced-*.txt` | Various | Advanced rules | P2 | ⚪ Not Started |

### Canonical Data

| File | Topic | Priority | Status |
|------|-------|----------|--------|
| `src/data/archetypes.json` | Character archetypes | P0 | ⚪ Not Audited |
| `src/data/armors.json` | Armor definitions | P1 | ⚪ Not Audited |
| `src/data/bow_weapons.json` | Bow weapons | P1 | ⚪ Not Audited |
| `src/data/equipment.json` | Equipment items | P1 | ⚪ Not Audited |
| `src/data/game_sizes.json` | Game size definitions | P0 | ✅ Audited (canonical baseline) |
| `src/data/grenade_weapons.json` | Grenade weapons | P2 | ⚪ Not Audited |
| `src/data/item_classification.json` | Item classifications | P1 | ⚪ Not Audited |
| `src/data/item_tech_window.json` | Tech level windows | P2 | ⚪ Not Audited |
| `src/data/keyword_descriptions.json` | Keyword definitions | P1 | ⚪ Not Audited |
| `src/data/melee_weapons.json` | Melee weapons | P0 | ⚪ Not Audited |
| `src/data/ranged_weapons.json` | Ranged weapons | P0 | ⚪ Not Audited |
| `src/data/support_weapons.json` | Support weapons | P2 | ⚪ Not Audited |
| `src/data/tech_level.json` | Tech levels | P2 | ⚪ Not Audited |
| `src/data/terrain_info.json` | Terrain definitions | P1 | ⚠️ Partially Audited |

### Semi-Canonical Overrides

| File | Topic | Priority | Status |
|------|-------|----------|--------|
| `src/guides/docs/rules-overrides.md` | QSR deviations | P0 | ✅ Audited |

### Secondary Guidance Sources

| File | Topic | Priority | Status |
|------|-------|----------|--------|
| `src/guides/docs/rules.md` | General rules | P0 | ⚪ Not Audited |
| `src/guides/docs/rules-actions.md` | Action rules | P0 | ⚠️ Partially Audited |
| `src/guides/docs/rules-bonus-actions.md` | Bonus actions and passive/react options | P0 | ⚠️ Partially Audited |
| `src/guides/docs/rules-ai.md` | AI rules | P0 | ✅ Audited |
| `src/guides/docs/rules-characters-and-attributes.md` | Characters | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-combat.md` | Combat rules | P0 | ⚪ Not Audited |
| `src/guides/docs/rules-terrain.md` | Cover and terrain rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-dice.md` | Dice rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-engagement.md` | Engagement rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-general-terms.md` | General terms | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-kod.md` | KO rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-movement-and-terrain.md` | LOS/Cover and terrain movement rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-friendly-fire-los.md` | LOF and friendly-fire rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-missions-qai.md` | QAI missions | P0 | ⚠️ Partially Audited |
| `src/guides/docs/rules-morale.md` | Morale rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-range.md` | Range rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-status.md` | Status rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-traits.md` | Trait rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-visibility.md` | Visibility rules | P1 | ⚠️ Partially Audited |

---

## QSR Structure

### Priority 0 (AI-Critical)

| Section | File | Status |
|---------|------|--------|
| Actions: Wait | `docs/qsr/03-actions/03.06-wait.md` | ✅ Clause tracked |
| Actions: Hide | `docs/qsr/03-actions/03.04-hide.md` | ✅ Clause tracked |
| Actions: Detect | `docs/qsr/03-actions/03.05-detect.md` | ✅ Clause tracked |
| Actions: Focus | `docs/qsr/03-actions/03.07-focus.md` | ✅ Clause tracked |
| Combat: Close Combat | `docs/qsr/04-combat/04.01-close-combat.md` | ✅ Clause tracked |
| Combat: Range Combat | `docs/qsr/04-combat/04.02-range-combat.md` | ✅ Clause tracked |
| Combat: Damage | `docs/qsr/04-combat/04.03-damage.md` | ✅ Clause tracked |
| Missions: Elimination | `docs/qsr/05-missions/05.01-elimination.md` | ✅ Clause tracked |
| AI: Decision Rules | `docs/qsr/06-ai/06.01-decision-rules.md` | ⚠️ Partial verification |

### Priority 1 (Core Gameplay)

| Section | File | Status |
|---------|------|--------|
| Visibility | `docs/qsr/01-basics/01.03-visibility.md` | ✅ Runtime verified |
| Cover | `docs/qsr/01-basics/01.04-cover.md` | ✅ Runtime verified |
| Initiative & Activation | `docs/qsr/02-initiative/02.01-initiative-activation.md` | ✅ Runtime verified |
| Movement | `docs/qsr/03-actions/03.01-move.md` | ✅ Runtime verified |
| Morale | `docs/qsr/07-morale/07.01-morale.md` | ✅ Runtime verified |

### Priority 2 (Advanced/Edge)

| Section | File | Status |
|---------|------|--------|
| Advanced Traits | `docs/qsr/08-advanced/08.01-traits.md` | ⚪ Not Started |
| Indirect Combat | `docs/qsr/04-combat/04.04-indirect.md` | ⚪ Not Started |
| Edge Cases | `docs/qsr/09-edge-cases/09.01-index.md` | ⚪ Not Started |

---

## P1 Runtime Snapshot

| File | Clause Rows | ✅ Verified/Complete | ⚠️ Partial | ❌ Missing | ⚠️ Not Audited |
|------|-------------|----------------------|------------|------------|----------------|
| `01-basics/01.03-visibility.md` | 14 | 14 | 0 | 0 | 0 |
| `01-basics/01.04-cover.md` | 16 | 16 | 0 | 0 | 0 |
| `02-initiative/02.01-initiative-activation.md` | 21 | 21 | 0 | 0 | 0 |
| `03-actions/03.01-move.md` | 18 | 18 | 0 | 0 | 0 |
| `07-morale/07.01-morale.md` | 38 | 38 | 0 | 0 | 0 |
| **Total** | **107** | **107** | **0** | **0** | **0** |

P1-labeled partial clause IDs currently open: **None**

---

## Recent Progress

### 2026-03-03

- Replaced low-signal `p1-*` verification tests with runtime-backed suites.
- Closed targeted runtime gaps: `PN.5`, `EL.2`, `FT.5`, `DS.4`, `DS.5`, `PN.4`, `RL.4`, `RL.7`, `RL.8`, `BT.1`, `PS.1-PS.5`, `MV.2`, `MV.4`, `MV.5`, `MV.6-MV.10`, `SW.1-SW.6`, `CV.5`, `CV.1`, `CV.4`, `LOS.2`, `LOS.5`, `TR.1-TR.3`, `AG.2`, `IN.1`, `IN.3`, `IN.6`, `AC.4`, `AC.5`, `AC.6`.
- Fixed OVR-003 terrain canonical-name mapping in runtime (`TerrainElement.ts`) and added dedicated terrain-element verification tests.
- Implemented and runtime-verified DR.1-DR.5 doorway/window/low-ceiling traversal classification via `terrain/aperture-rules.ts` wired into `terrain/move-validator.ts`.
- Audited React-related secondary guidance coverage in `rules-actions.md` and `rules-bonus-actions.md`; corrected stale references to non-existent `rules-react.md`.
- Audited LOF/friendly-fire guidance coverage in `rules-friendly-fire-los.md` against `friendly-fire.ts` + `los-validator.ts` runtime suites.
- Re-based all current status numbers against live docs and a fresh full test run.

---

## Active Priorities

1. Publish module-level coverage metrics for P1 rule modules once coverage provider is enabled (currently blocked in this environment: `ENOTFOUND registry.npmjs.org` when installing `@vitest/coverage-v8`).
2. Keep `Not Started`/`Not Audited` inventories current as each source is audited.
3. Continue source-audit expansion across non-P1 canonical and guide files.
4. Reconcile Obscured-threshold rule drift across guidance, verification docs, and runtime implementation.
