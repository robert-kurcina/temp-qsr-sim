# QSR Master Index

**Purpose:** Map canonical sources to structured clause tracking and current verification status.

**Last Updated:** 2026-03-04
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
| **P2 Advanced/Edge Rules** | ⚠️ Indirect runtime closure done; Advanced source audit expanded; runtime ownership still partial |

**Current full-suite baseline:** `npx vitest run` → **149 files, 2302 tests passing**.
**Current coverage baseline:** `npx vitest run --coverage` → **149 files, 2302 tests passing** (`All files`: S 70.15 / B 58.40 / F 75.58 / L 71.54).

---

## Canonical Sources

### Primary Canonical (QSR)

| File | Lines | Topic | Priority | Status |
|------|-------|-------|----------|--------|
| `docs/canonical/MEST.Tactics.QSR.txt` | 1-1702 | Core rules | P0 | ✅ Audited (P0/P1 scope) |
| `docs/canonical/MEST.Tactics.Missions.txt` | 1-??? | Mission rules | P0 | ⚠️ Partially Audited |
| `docs/canonical/MEST.Tactics.Objectives.txt` | 1-??? | Objective rules | P1 | ⚠️ Partially Audited |
| `docs/canonical/MEST.Tactics.MissionKeys.txt` | 1-??? | Victory conditions | P0 | ⚠️ Partially Audited |
| `docs/canonical/MEST.Tactics.Indirect.txt` | 1-??? | Indirect combat | P2 | ⚠️ Partially Audited |
| `docs/canonical/MEST.KOd.txt` | 1-??? | KO rules | P1 | ⚠️ Partially Audited |
| `docs/canonical/MEST.Tactics.Advanced-*.txt` | Various | Advanced rules | P2 | ⚠️ Partially Audited (Expanded-Effects + Buildings + Champions + Fire + Firelane + Gas/Fume/Puffs + Go + Lighting + LoA + ROF + Suppression + Technology + Terrain + Webbing clause maps) |

### Canonical Data

| File | Topic | Priority | Status |
|------|-------|----------|--------|
| `src/data/archetypes.json` | Character archetypes | P0 | ⚠️ Partially Audited |
| `src/data/armors.json` | Armor definitions | P1 | ⚠️ Partially Audited |
| `src/data/bow_weapons.json` | Bow weapons | P1 | ⚠️ Partially Audited |
| `src/data/equipment.json` | Equipment items | P1 | ⚠️ Partially Audited |
| `src/data/game_sizes.json` | Game size definitions | P0 | ✅ Audited (canonical baseline) |
| `src/data/grenade_weapons.json` | Grenade weapons | P2 | ⚠️ Partially Audited |
| `src/data/item_classifications.json` | Item classifications | P1 | ⚠️ Partially Audited (runtime-integrated) |
| `src/data/item_tech_window.json` | Tech level windows | P2 | ⚠️ Partially Audited |
| `src/data/keyword_descriptions.json` | Keyword definitions | P1 | ⚠️ Partially Audited (runtime-integrated) |
| `src/data/melee_weapons.json` | Melee weapons | P0 | ⚠️ Partially Audited |
| `src/data/ranged_weapons.json` | Ranged weapons | P0 | ⚠️ Partially Audited |
| `src/data/support_weapons.json` | Support weapons | P2 | ⚠️ Partially Audited |
| `src/data/tech_level.json` | Tech levels | P2 | ⚠️ Partially Audited (runtime-integrated) |
| `src/data/terrain_info.json` | Terrain definitions | P1 | ⚠️ Partially Audited |

### Semi-Canonical Overrides

| File | Topic | Priority | Status |
|------|-------|----------|--------|
| `src/guides/docs/rules-overrides.md` | QSR deviations | P0 | ✅ Audited |

### Secondary Guidance Sources

| File | Topic | Priority | Status |
|------|-------|----------|--------|
| `src/guides/docs/rules.md` | General rules | P0 | ⚠️ Partially Audited |
| `src/guides/docs/rules-actions.md` | Action rules | P0 | ⚠️ Partially Audited |
| `src/guides/docs/rules-bonus-actions.md` | Bonus actions and passive/react options | P0 | ⚠️ Partially Audited |
| `src/guides/docs/rules-ai.md` | AI rules | P0 | ✅ Audited |
| `src/guides/docs/rules-characters-and-attributes.md` | Characters | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-combat.md` | Combat rules | P0 | ⚠️ Partially Audited |
| `src/guides/docs/rules-terrain.md` | Cover and terrain rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-tests-and-checks.md` | Dice and test-resolution rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rule-disengage.md` | Disengage and engagement-exit rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-general-terms.md` | General terms | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-kod.md` | KO rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-indirect.md` | Indirect range combat rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-effects.md` | Advanced effects/status rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-buildings.md` | Advanced building rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-champions.md` | Advanced champions and LoA rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-fire.md` | Advanced fire rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-firelane.md` | Advanced fire-lane rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-game.md` | Advanced module overview/index | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-gas-fume-puffs.md` | Advanced gas/fume/puff rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-go.md` | Advanced Go / Group Action rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-lighting.md` | Advanced lighting rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-loa.md` | Advanced LoA ownership index | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-rof.md` | Advanced rate-of-fire rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-suppression.md` | Advanced suppression rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-terrain.md` | Advanced terrain rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-technology.md` | Advanced technology and age rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-advanced-webbing.md` | Advanced webbing rules | P2 | ⚠️ Partially Audited |
| `src/guides/docs/rules-movement-and-terrain.md` | LOS/Cover and terrain movement rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-friendly-fire-los.md` | LOF and friendly-fire rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-missions-qai.md` | QAI missions | P0 | ⚠️ Partially Audited |
| `src/guides/docs/rules-damage-and-morale.md` | Morale and damage rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rule-direct-range-combat.md` | Direct range combat rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-status.md` | Status rules | P1 | ⚠️ Partially Audited |
| `src/guides/docs/rules-traits.md` | Trait rules | P1 | ⚠️ Partially Audited |
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
| Advanced Traits | `docs/qsr/08-advanced/08.01-traits.md` | ⚠️ Partially Audited (all Advanced canonical files clause-mapped; runtime ownership remains partial) |
| Indirect Combat | `docs/qsr/04-combat/04.04-indirect.md` | ✅ Runtime clause-verified (source audit partial) |
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

### 2026-03-04

- Replaced low-signal `p1-*` verification tests with runtime-backed suites.
- Closed targeted runtime gaps: `PN.5`, `EL.2`, `FT.5`, `DS.4`, `DS.5`, `PN.4`, `RL.4`, `RL.7`, `RL.8`, `BT.1`, `PS.1-PS.5`, `MV.2`, `MV.4`, `MV.5`, `MV.6-MV.10`, `SW.1-SW.6`, `CV.5`, `CV.1`, `CV.4`, `LOS.2`, `LOS.5`, `TR.1-TR.3`, `AG.2`, `IN.1`, `IN.3`, `IN.6`, `AC.4`, `AC.5`, `AC.6`.
- Fixed OVR-003 terrain canonical-name mapping in runtime (`TerrainElement.ts`) and added dedicated terrain-element verification tests.
- Implemented and runtime-verified DR.1-DR.5 doorway/window/low-ceiling traversal classification via `terrain/aperture-rules.ts` wired into `terrain/move-validator.ts`.
- Audited React-related secondary guidance coverage in `rules-actions.md` and `rules-bonus-actions.md`; corrected stale references to non-existent `rules-react.md`.
- Audited LOF/friendly-fire guidance coverage in `rules-friendly-fire-los.md` against `friendly-fire.ts` + `los-validator.ts` runtime suites.
- Audited combat guidance coverage in `rules-combat.md` against close/range/disengage runtime and verification suites.
- Audited direct-range guidance coverage in `rule-direct-range-combat.md` and corrected stale `rules-range.md` source pointers.
- Audited status guidance coverage in `rules-status.md` against morale/compulsory/concealment/status-system runtime suites.
- Audited KO guidance coverage in `rules-kod.md` against KO rules and KO attack runtime suites.
- Audited engagement/disengage guidance coverage in `rule-disengage.md` and corrected stale `rules-engagement.md` source pointers.
- Audited dice/test-resolution guidance coverage in `rules-tests-and-checks.md` and corrected stale `rules-dice.md` pointers.
- Audited rules index guidance in `rules.md` for precedence handling and live module link integrity.
- Audited character/attribute guidance coverage in `rules-characters-and-attributes.md` against profile generation, leader identification, and laden behavior suites.
- Audited glossary guidance coverage in `rules-general-terms.md` against sampled initiative/status/combat/movement terminology behavior suites.
- Audited trait guidance coverage in `rules-traits.md` against advanced trait, complex trait-set, and trait interaction suites.
- Added full clause-tracking baseline for indirect combat in `docs/qsr/04-combat/04.04-indirect.md` and reclassified `MEST.Tactics.Indirect.txt` from `Not Started` to `Partially Audited`.
- Tightened indirect spatial enforcement: `IC.1` (LOF gate) and `IC.9` (midpoint arc validation) are now runtime-gated with dedicated regression tests.
- Closed/improved indirect trait-marker gaps: `IC.8` (target-marker lifecycle output) and `WT.3` (Frag per-target fail gating) are now runtime-covered.
- Closed indirect spatial-direction gap `SD.2`: biased scatter now supports explicit desired-direction alignment for diagram "1" in runtime and tests.
- Closed thrown-OR clause `IC.5`: indirect entry now evaluates `STR` / `STR+X` OR expressions and rejects negative resolved values.
- Closed indirect gravity-roll-down clauses `SC.5`, `SC.7`, and `SC.8` by fixing target-to-final roll-down chaining and adding chained-slope/obstacle-stop regressions.
- Closed scrambling clause `SC.9`: scramble now enforces passive React availability (`reactedThisTurn`/`reactingNow`), preserves Attentive/Ordered gating, applies passive-option cost, and marks successful scramble moves as React-used for turn lifecycle enforcement.
- Closed non-Frag AoE unopposed-damage clause `WT.2` by introducing explicit unopposed damage resolution for indirect blast targets and validating high-FOR target behavior.
- Closed trait-order clause `WT.1`: indirect AoE/Frag trait flow now resolves before single-target fallback, with regression coverage for `targetCharacter` override and post-AoE status-trait application.
- Closed spotter qualification clause `BL.2` by requiring explicit Friendly qualification (side-derived or callback) alongside Free/Attentive/Ordered + Cohesion + LOS checks.
- Closed indirect situational-modifier clause `IC.12` by aligning hindrance sources to canonical Wounds/Fear/Delay tokens and adding explicit die-type regression coverage for Distance/Point-blank/Direct Cover/Intervening Cover.
- Reduced parser redundancy: centralized OR-expression evaluation into `utils/visibility.ts` and removed duplicate OR parsing logic from indirect action runtime.
- Reduced indirect pre-check redundancy in `executeIndirectAttack` by consolidating repeated failure payloads into a shared `buildIndirectFailure(...)` helper.
- Reduced GameManager side-check duplication by centralizing mission-side lookup and friendly-side checker derivation for Move/Rally/Indirect paths.
- Reduced damage-path duplication by converting `subroutines/damage.ts` into a compatibility wrapper that delegates to the canonical `subroutines/damage-test.ts` implementation.
- Removed duplicate backup guide `src/guides/docs/rules-characters-and-attributes.md.bak` after confirming no live references.
- Reduced CV namespace redundancy by designating `01.04-cover.md` as canonical `CV.*` owner and converting `01.03-visibility.md` cover rows to delegated references.
- Reduced indirect-doc duplication by removing the guide-level implementation-status table from `rules-indirect.md` and treating `docs/qsr/04-combat/04.04-indirect.md` as the single status source.
- Resolved Obscured-threshold drift by centralizing cumulative threshold logic in `combat/obscured.ts` and wiring both direct/indirect ranged modules to that shared helper.
- Aligned Obscured guidance and verification documentation to the same cumulative-threshold interpretation used at runtime.
- Added executable data-bundle drift enforcement by validating `src/lib/data.ts` against canonical `src/data/*.json` transforms in `canonical-data-integrity.test.ts`.
- Removed bundler/test transform duplication by exporting `loadBundledDataFromJson(...)` from `scripts/bundle-data.cjs` and reusing it in `canonical-data-integrity.test.ts`.
- Reduced core game-size duplication by introducing `mission/game-size-canonical.ts` and wiring `assembly-builder`, `end-game-trigger`, and `mission-scoring` to canonical `game_sizes` data.
- Resolved script-level game-size duplication by routing `battle.ts`, `BattleOrchestrator.ts`, `battle-generator.ts`, `battlefield-generator.ts`, `generate-test-battlefields.ts`, and `run-battles/battle-runner.ts` through shared canonical game-size config.
- Fixed `BattleOrchestrator.ts` import-path drift (`scripts/src/...`) and re-validated module importability.
- Reduced glossary drift risk by adding explicit derived-reference synchronization policy to `rules-general-terms.md`.
- Reduced glossary duplication surface further by converting `src/guides/docs/rules-general-terms.md` to an ownership-only index (removed duplicated thresholds/mechanics tables and stale cross-rule restatements).
- Corrected glossary owner-source mapping for `Physicality` and `Durability` to canonical `MEST.Tactics.QSR.txt` Common Terminology (lines 496-507), with traits docs treated as secondary usage references.
- Audited canonical General Terms coverage (`MEST.Tactics.QSR.txt` lines 496-531) and corrected glossary index omissions/mappings for `Scrum`, `Outnumbers`, `Agility`, `Core Damage`, and `Melee Range`.
- Started P2 Advanced canonical audit by extracting an initial clause map for `MEST.Tactics.Advanced-Effects.txt` in `docs/qsr/08-advanced/08.01-traits.md` and reclassifying `MEST.Tactics.Advanced-*.txt` from `Not Started` to `Partially Audited`.
- Extended the P2 Advanced canonical audit with initial clause maps for `MEST.Tactics.Advanced-ROF.txt` and `MEST.Tactics.Advanced-Suppression.txt`; both files are now tracked as `Partially Audited` with explicit runtime/test-gap annotations.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Firelane.txt`; firelane is now tracked as `Partially Audited` with explicit runtime ownership gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Fire.txt`; fire is now tracked as `Partially Audited` with explicit marker-lifecycle/runtime ownership gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Lighting.txt`; lighting is now tracked as `Partially Audited` with explicit runtime light-casting and point-light ownership gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Gas.Fume.Puffs.txt`; gas/fume/puffs is now tracked as `Partially Audited` with explicit spread/dissipation runtime ownership gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Webbing.txt`; webbing is now tracked as `Partially Audited` with explicit strand-marker runtime ownership gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Technology.txt`; technology is now tracked as `Partially Audited` with explicit tech-filter integration and narrative-semantics gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Buildings.txt`; buildings are now tracked as `Partially Audited` with explicit access-state/runtime ownership gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Champions.txt`; champions are now tracked as `Partially Audited` with explicit reputation/campaign-runtime ownership gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Go.txt`; Go/Group Actions are now tracked as `Partially Audited` with explicit Go-Point economy + turn-lifecycle ownership gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-LoA.txt`; LoA is now tracked as `Partially Audited` with explicit LoA-mechanics ownership gaps.
- Extended the P2 Advanced canonical audit with an initial clause map for `MEST.Tactics.Advanced-Terrain.txt`; advanced terrain is now tracked as `Partially Audited` with explicit Tricky-terrain keyword ownership gaps.
- Resolved Advanced LoA guide drift by converting `rules-advanced-loa.md` to a canonical LoA ownership index and aligning `rules-advanced-game.md` references to Level-of-Absurdity semantics.
- Fixed combat-traits attribute-resolution bug in Stun/Awkward/Brawn helpers by replacing invalid `profile.finalAttributes.SIZ/FOR/STR` reads with runtime `character.finalAttributes` lowercase attribute keys.
- Added Priority-2 tracker files `docs/qsr/08-advanced/08.01-traits.md` and `docs/qsr/09-edge-cases/09.01-index.md` to remove stale index references; advanced-effects extraction has now started while edge-cases remain `Not Started`.
- Normalized all advanced-guide `Source` pointers to canonical `docs/canonical/MEST.Tactics.Advanced-*.txt` paths and removed mixed legacy pointer forms.
- Added `src/lib/mest-tactics/utils/advanced-guide-integrity.test.ts` to enforce canonical Advanced-source pointers and advanced-guide wiki-link target validity.
- Expanded the Secondary Guidance inventory to include the full advanced guide set (`rules-advanced-effects/fire/firelane/gas-fume-puffs/lighting/rof/suppression/technology/webbing/game`), reducing audit inventory drift.
- Audited canonical data usage for `archetypes.json`, `melee_weapons.json`, and `ranged_weapons.json` against profile/assembly/combat/hit runtime suites.
- Audited canonical data usage for `armors.json`, `equipment.json`, `bow_weapons.json`, and `item_tech_window.json` against trait, passive-options, and tech-level filtering runtime suites.
- Audited canonical data usage for `support_weapons.json`, `grenade_weapons.json`, `item_classifications.json`, `keyword_descriptions.json`, and `tech_level.json` via new canonical-data integrity checks and tech/profile integration suites.
- Integrated canonical metadata tables into runtime paths via `utils/canonical-metadata.ts`:
  - `item_classifications.json` now normalizes profile item `classification/type`
  - `keyword_descriptions.json` now canonicalizes parsed trait keyword tokens
  - `tech_level.json` now feeds age-to-tech mapping in tech-level filtering
- Reduced AI-module duplication/warning noise by removing duplicate `isRangedWeapon`/`isMeleeWeapon` members and invalid const reassignment in `UtilityScorer.ts`, and by scoping stratagem descriptions by type in `AIStratagems.ts`.
- Audited objective-marker canonical coverage from `MEST.Tactics.Objectives.txt` against objective marker manager, mission objective, and GameManager mission-marker runtime suites.
- Corrected stale canonical-data pointer `item_classification.json` to `item_classifications.json`.
- Fixed canonical classification-map gap by adding `Vehicle` to `item_classifications.json`, then re-bundled `src/lib/data.ts`.
- Corrected stale `rules-morale.md` source pointers to `rules-damage-and-morale.md`.
- Re-based all current status numbers against live docs and a fresh full test run.
- Reduced script game-size config duplication in `scripts/ai-battle/AIBattleConfig.ts` by generating per-size rows from a shared builder and ordered size list.
- Reduced repeated run-battles symmetric elimination preset boilerplate by introducing `scripts/run-battles/configs/shared.ts:createSymmetricEliminationConfig(...)` and shrinking `very-small/small/medium/large/very-large` config files to knob-only definitions.
- Reduced multi-side run-battles preset duplication by extending `scripts/run-battles/configs/shared.ts` with generic `createPresetBattleConfig(...)` + `PresetSideTemplate[]` and refactoring `convergence-3side`, `trinity`, `trinity-4side`, and `ai-stress-test` configs.
- Removed test/runtime game-size table drift by deriving `full-game-simulation.test.ts` and `run-very-large-game.ts` size constants from canonical helpers/data.
- Fixed battle-report viewer game-size classification drift by replacing max-dimension heuristics with exact canonical dimension matching (including 18×24 vs 24×24 differentiation).
- Resolved redundancy flag 1 by removing legacy mission compatibility modules/tests (`mission/mission-engine.ts`, `missions/mission-runtime.ts`, `missions/mission-registry.ts`) and keeping `mission-runtime-adapter.ts` as the sole active mission runtime path.
- Published module-level P1 coverage metrics with `@vitest/coverage-v8` enabled and validated a full-suite coverage pass (`npx vitest run --coverage`, `149` files / `2302` tests, `All files` S `70.15` / B `58.40` / F `75.58` / L `71.54`).
- Resolved Advanced redundancy flag 1 by deleting unreferenced `traits/advanced-traits-stubs.ts` (duplicate TODO surface vs active trait logic).
- Resolved Advanced redundancy flag 2 by refactoring `traits/advanced-traits.test.ts` from clause-restatement assertions into runtime-backed trait/status helper tests.
- Fixed `Surefooted 3` terrain-upgrade ordering in `traits/combat-traits.ts` (`Difficult -> Clear` now correctly applies at level 3).
- Closed Advanced-effects hindrance integration gap by extending `subroutines/hindrances.ts` to count canonical advanced status hindrance tokens and wiring status-token sources through ranged/close/indirect combat pipelines with runtime-backed tests.

---

## Active Priorities

1. Keep `Not Started`/`Not Audited` inventories current as each source is audited.
2. Continue source-audit expansion across non-P1 canonical and guide files.
3. Continue redundancy reduction in stale tracker-history sections while preserving traceability and clause ownership clarity.
4. Raise targeted coverage in lower-coverage P1 support modules (`GameManager.ts`, `LOSOperations.ts`, `move-validator.ts`) with behavior-backed tests.
