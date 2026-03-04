# QSR Compliance Project - Session Handoff

**Date:** 2026-03-04
**Session:** Priority 1 Runtime Coverage Hardening
**Status:** ⚠️ **IN PROGRESS (tracked P1 rows fully verified; broader source audits remain)**

---

## Executive Snapshot

- Clause catalogs for core P1 files are in place.
- Runtime hardening replaced low-signal verification suites with behavior-backed tests.
- Current P1 file snapshot: **107 clause rows total**, **107 verified**, **0 partial**, **0 missing**, **0 not-audited**.
- Full test baseline: **149 test files, 2297 tests passing**.

---

## Completed In This Pass

### Runtime/Code

- Added first-class runtime action path for Pushing:
  - `src/lib/mest-tactics/engine/GameManager.ts` (`executePushing`)
- Closed targeted movement-sequencing gaps:
  - `MV.6-MV.9` in `src/lib/mest-tactics/actions/move-action.ts`
- Closed move engagement gate:
  - `MV.2` in `src/lib/mest-tactics/engine/GameManager.ts` (engaged models must Disengage before Move)
- Closed terrain-cost move validation:
  - `MV.4` via runtime difficult-terrain movement-cost assertions in `GameManager.test.ts`
- Closed agility-limited move extension:
  - `MV.5` via Leap start/end-of-movement gating tests in `move-action-rules.test.ts`
- Closed swap-position movement gaps:
  - `MV.10`, `SW.1-SW.6` in `src/lib/mest-tactics/actions/move-action.ts`
- Closed cover distance gate:
  - `CV.5` in `src/lib/mest-tactics/battlefield/spatial/spatial-rules.ts`
- Closed LOS/Cover geometry partials:
  - `LOS.2`, `LOS.5` in `src/lib/mest-tactics/battlefield/los/LOSOperations.ts`
  - `CV.1`, `CV.4` in `src/lib/mest-tactics/battlefield/spatial/spatial-rules.ts`
- Closed OVR-003 terrain-name mismatch:
  - `TerrainElement.ts` now maps canonical names (`Small Building`, `Short Wall`, rocks) to height/enterability rules correctly
- Implemented DR.1-DR.5 doorway/window/low-ceiling traversal classification:
  - `src/lib/mest-tactics/battlefield/terrain/aperture-rules.ts`
  - integrated with movement blocking in `src/lib/mest-tactics/battlefield/terrain/move-validator.ts`
- Closed remaining terrain semantics in P1 Cover:
  - `TR.1-TR.3` via `spatial-rules.test.ts`
- Closed agility-for-LOS integration:
  - `AG.2` via leaning-aware LOS probing in `battlefield/validation/action-context.ts` wired from `combat-actions.ts`
- Closed initiative special-ability spend path:
  - `IN.6` via runtime coverage of `maintainInitiative`, `forceInitiative`, `refresh`
- Closed initiative leader/tie semantics:
  - `IN.1`, `IN.3` via designated-leader side initiative resolution and tie-path runtime tests
- Closed activation lifecycle semantics:
  - `AC.4`, `AC.5`, `AC.6` via per-turn initiative-slot uniqueness and React active-model handoff runtime behavior
- Hardened morale paths:
  - `FT.2-FT.7`, `DS.4`, `DS.5`, `PN.4`, `RL.1-RL.8`, `BT.7`, `PN.5`, `EL.2`
  - added turn-cycle fear-test reset verification for `FT.5`
- Closed rally friendly/cohesion gate:
  - `RL.4` in `src/lib/mest-tactics/actions/simple-actions.ts` with dedicated rally runtime tests
- Closed bottle-test scheduling path:
  - `BT.1` via `GameManager.endTurn()` and activation-to-turn-end phase flow tests
- Tightened indirect spatial gates:
  - `IC.1` via explicit LOF gate (`SpatialRules.hasLineOfFire`) in `executeIndirectAttack`
  - `IC.9` via default-on midpoint arc validation (`isValidIndirectArc`) in `executeIndirectAttack`
- Closed additional indirect clause gaps:
  - `IC.8` via target-marker lifecycle output (`targetMarker`) in indirect attack results
  - `WT.3` via per-target Frag fail-gating and damage routing in `executeIndirectAttack`
  - `IC.12` via canonical hindrance-token sourcing (Wounds/Fear/Delay) and explicit die-type regression coverage for Distance/Point-blank/Direct Cover/Intervening Cover
  - `SC.9` by wiring scramble eligibility through passive React-availability state (`reactedThisTurn` / `reactingNow`), plus marking successful scramble use as React-consumed for turn lifecycle enforcement
  - `WT.1` by making indirect AoE/Frag flow explicitly resolve before single-target fallback and adding regression coverage including `targetCharacter` override + post-AoE status-trait application
- Closed additional indirect spatial-direction gap:
  - `SD.2` via desired-direction-aware biased scatter axis support in `scatter.ts` and indirect attack wiring
- Closed additional indirect OR-expression gap:
  - `IC.5` via indirect-entry evaluation of thrown `STR` / `STR+X` OR expressions with negative-result rejection coverage
- Closed additional indirect gravity roll-down gaps:
  - `SC.5` via target-to-final roll-down displacement wiring in `resolveScatter`
  - `SC.7` via chained slope accumulation coverage in `scatter.test.ts`
  - `SC.8` via explicit obstacle-stop validation along roll-down displacement paths
- Closed additional indirect AoE damage-flow gap:
  - `WT.2` via explicit unopposed non-Frag blast damage resolution in `damage-test.ts` and indirect attack routing
- Closed additional indirect spotter-qualification gap:
  - `BL.2` via explicit Friendly qualification requirements (side-derived or callback) plus Free/Attentive/Ordered + Cohesion + LOS gates
- Integrated canonical metadata tables directly into runtime logic:
  - added `src/lib/mest-tactics/utils/canonical-metadata.ts`
  - wired `item_classifications.json` usage into `utils/profile-generator.ts`
  - wired `keyword_descriptions.json` usage into `traits/trait-parser.ts`
  - wired `tech_level.json` usage into `utils/tech-level-filter.ts`
- Removed active AI warning sources in core modules:
  - fixed mutable wait tactical bonus handling and removed duplicate weapon-classifier members in `ai/core/UtilityScorer.ts`
  - eliminated duplicate `balanced` description key by type-scoping in `ai/stratagems/AIStratagems.ts`

### Tests

- Added/updated runtime suites:
  - `initiative-points.test.ts`
  - `action-context.test.ts`
  - `activation-rules.test.ts`
  - `move-action-rules.test.ts`
  - `simple-actions-rally.test.ts`
  - `compulsory-actions-safety.test.ts`
  - `react-actions.test.ts`
  - `morale.test.ts`
  - `morale-cohesion-visibility.test.ts`
  - `bottle-tests.test.ts`
  - `spatial-rules.test.ts`
  - `terrain/TerrainElement.test.ts`
  - `terrain/aperture-rules.test.ts`
  - `terrain/move-validator.test.ts`
  - `canonical-data-integrity.test.ts`

### Redundancy Reduction

- Removed low-signal P1 verification files:
  - `p1-visibility-verification.test.ts`
  - `p1-cover-verification.test.ts`
  - `p1-initiative-verification.test.ts`
  - `p1-movement-verification.test.ts`
  - `p1-morale-verification.test.ts`
- Corrected stale QSR secondary-source references to non-existent `rules-react.md`:
  - `docs/qsr/00-index.md`
  - `docs/qsr/03-actions/03.06-wait.md`
  - `docs/qsr/03-actions/03.07-focus.md`
- Consolidated duplicated OR-expression parsing:
  - centralized parser into `src/lib/mest-tactics/utils/visibility.ts:evaluateWeaponOrExpressionMu()`
  - removed duplicated indirect-runtime parsing logic from `src/lib/mest-tactics/actions/combat-actions.ts`
- Consolidated duplicated indirect pre-check failure payloads:
  - `src/lib/mest-tactics/actions/combat-actions.ts:executeIndirectAttack` now uses shared `buildIndirectFailure(...)` helper
- Consolidated duplicated mission-side friendliness derivation in `GameManager`:
  - centralized side lookup and friendly-check creation via shared helpers used by Move/Rally/Indirect paths
- Consolidated duplicated damage resolution logic:
  - converted `src/lib/mest-tactics/subroutines/damage.ts` into a legacy compatibility wrapper that delegates to `src/lib/mest-tactics/subroutines/damage-test.ts`
  - retained `resolveDamageTest(...)` surface for compatibility while removing duplicate damage algorithm implementation
- Removed duplicate backup guidance file:
  - deleted `src/guides/docs/rules-characters-and-attributes.md.bak` after dependency scan confirmed no references
- Reduced indirect documentation status duplication:
  - removed guide-level implementation-status table from `src/guides/docs/rules-indirect.md`
  - `docs/qsr/04-combat/04.04-indirect.md` remains the single authoritative clause-status tracker
- Reduced CV namespace duplication across Visibility/Cover trackers:
  - designated `docs/qsr/01-basics/01.04-cover.md` as canonical owner of `CV.*` clauses
  - converted `docs/qsr/01-basics/01.03-visibility.md` cover rows to delegated references
- Added executable data-bundle drift enforcement:
  - `src/lib/mest-tactics/utils/canonical-data-integrity.test.ts` now validates bundled `src/lib/data.ts` against canonical `src/data/*.json` transforms
- Removed bundler/test transform duplication:
  - `scripts/bundle-data.cjs` now exports `loadBundledDataFromJson(...)` and runs in write mode only when executed directly
  - `canonical-data-integrity.test.ts` now reuses that exported bundler transform instead of re-implementing it
- Reduced core game-size duplication:
  - added canonical helper `src/lib/mest-tactics/mission/game-size-canonical.ts`
  - wired `assembly-builder.ts`, `engine/end-game-trigger.ts`, and `missions/mission-scoring.ts` to canonical `src/data/game_sizes.json` via shared helper
- Resolved script-level game-size duplication:
  - centralized script game-size config through `scripts/ai-battle/AIBattleConfig.ts` (fed from canonical game-size helpers)
  - wired `scripts/battle.ts`, `scripts/ai-battle/core/BattleOrchestrator.ts`, `scripts/battle-generator.ts` to shared `GAME_SIZE_CONFIG`
  - wired `scripts/battlefield-generator.ts`, `scripts/generate-test-battlefields.ts`, and `scripts/run-battles/battle-runner.ts` to canonical game-size dimensions (`game-size-canonical.ts`)
  - updated `scripts/ai-battle/interactive-setup.ts` game-size prompt text to render from live `GAME_SIZE_CONFIG` values instead of hardcoded dimensions
- Resolved script import-path drift:
  - corrected `scripts/ai-battle/core/BattleOrchestrator.ts` relative imports and verified module load with `node --import tsx`
- Reduced glossary duplication risk:
  - added explicit derived-reference synchronization policy to `src/guides/docs/rules-general-terms.md`
- Resolved glossary duplication flag:
  - refactored `src/guides/docs/rules-general-terms.md` into a non-authoritative term-ownership index
  - removed duplicated thresholds/mechanics matrices to keep rule behavior authoritative in domain guides only
- Corrected glossary owner-source mapping:
  - `Physicality` / `Durability` now point to canonical `MEST.Tactics.QSR.txt` Common Terminology (lines 496-507); trait docs are treated as secondary usage references
- Audited canonical General Terms mapping coverage:
  - reconciled `rules-general-terms.md` against `MEST.Tactics.QSR.txt` lines 496-531
  - added missing term ownership rows for `Scrum`, `Outnumbers`, `Agility`, `Core Damage`, and linked `Melee Range` under Standard Conditions
- Fixed combat-traits attribute-resolution bug:
  - `calculateStunEffect`, `checkAwkwardChargeDelay`, and `getEffectiveStr` now read `Character.finalAttributes`/`attributes` (lowercase keys) instead of invalid `profile.finalAttributes` uppercase-key paths
- Reduced script game-size config duplication:
  - `scripts/ai-battle/AIBattleConfig.ts` now builds `GAME_SIZE_CONFIG` from a single size-order + shared row builder instead of repeated per-size blocks
- Reduced run-battles preset boilerplate:
  - added `scripts/run-battles/configs/shared.ts:createSymmetricEliminationConfig(...)`
  - refactored `very-small.ts`, `small.ts`, `medium.ts`, `large.ts`, and `very-large.ts` to knob-only config definitions
- Reduced multi-side run-battles preset duplication:
  - extended `scripts/run-battles/configs/shared.ts` with generic `createPresetBattleConfig(...)` and `PresetSideTemplate[]`
  - refactored `convergence-3side.ts`, `trinity.ts`, `trinity-4side.ts`, and `ai-stress-test.ts` to declarative side templates
- Reduced simulation-table drift:
  - `src/lib/mest-tactics/full-game-simulation.test.ts` now derives game-size matrix values from canonical game-size + assembly defaults
  - `scripts/run-very-large-game.ts` now sources VERY_LARGE dimensions/limits/trigger from canonical helpers
- Resolved viewer game-size classification drift:
  - `src/lib/mest-tactics/viewer/battle-report-viewer.html` now maps exact canonical battlefield dimensions (18×24, 24×24, 36×36, 48×48, 72×48) instead of max-dimension heuristics
- Resolved mission compatibility-layer redundancy:
  - removed legacy `src/lib/mest-tactics/mission/mission-engine.ts`
  - removed legacy `src/lib/mest-tactics/missions/mission-runtime.ts`
  - removed duplicate lookup layer `src/lib/mest-tactics/missions/mission-registry.ts`
  - removed legacy-only tests `mission-engine.test.ts` and `mission-runtime.test.ts`
  - retained `mission-runtime-adapter.ts` as the single active runtime integration path
- Resolved Advanced-LoA guide drift/duplication:
  - converted `src/guides/docs/rules-advanced-loa.md` into a canonical Level-of-Absurdity ownership index (instead of non-canonical “Lines of Action” content)
  - updated `src/guides/docs/rules-advanced-game.md` LoA module references/status wording to match canonical scope

### Source Audit Inventory Progress

- Reclassified primary canonical source status from `⚪ Not Started` to `⚠️ Partially Audited` for:
  - `docs/canonical/MEST.Tactics.Objectives.txt` (objective marker types/actions/concerns cross-checked)
  - `docs/canonical/MEST.Tactics.Indirect.txt` (full indirect clause map cross-checked against indirect attack/scatter runtime and tests)
  - `docs/canonical/MEST.Tactics.Advanced-*.txt` (initial clause extraction/audit now includes `Advanced-Effects`, `Advanced-Buildings`, `Advanced-Champions`, `Advanced-Fire`, `Advanced-Firelane`, `Advanced-Gas.Fume.Puffs`, `Advanced-Go`, `Advanced-Lighting`, `Advanced-LoA`, `Advanced-ROF`, `Advanced-Suppression`, `Advanced-Technology`, `Advanced-Terrain`, and `Advanced-Webbing` in `docs/qsr/08-advanced/08.01-traits.md`)
- Added indirect combat clause-tracking artifact:
  - `docs/qsr/04-combat/04.04-indirect.md` (32 clauses with runtime/test traceability and explicit gap flags)
- Reclassified secondary guidance source statuses from `⚪ Not Audited` to `⚠️ Partially Audited` for:
  - `src/guides/docs/rules.md` (precedence rules + module link integrity cross-checked)
  - `src/guides/docs/rules-actions.md` (Wait/Focus/React sections cross-checked)
  - `src/guides/docs/rules-bonus-actions.md` (React/passive-option sections cross-checked)
  - `src/guides/docs/rules-characters-and-attributes.md` (attribute and model-size guidance cross-checked)
  - `src/guides/docs/rules-combat.md` (close/range/disengage sections cross-checked)
  - `src/guides/docs/rule-direct-range-combat.md` (direct range sections cross-checked)
  - `src/guides/docs/rules-friendly-fire-los.md` (LOF/friendly-fire rules cross-checked)
  - `src/guides/docs/rules-general-terms.md` (glossary term usage sampled against runtime behavior)
  - `src/guides/docs/rule-disengage.md` (engagement-exit and disengage sections cross-checked)
  - `src/guides/docs/rules-status.md` (morale/compulsory/concealment/status-system sections cross-checked)
  - `src/guides/docs/rules-kod.md` (KO attack and elimination sections cross-checked)
  - `src/guides/docs/rules-indirect.md` (indirect combat section cross-checked against executeIndirectAttack/scatter behavior)
  - `src/guides/docs/rules-traits.md` (trait semantics and leveled-trait behavior cross-checked)
  - `src/guides/docs/rules-tests-and-checks.md` (dice/test-resolution sections cross-checked)
- Reclassified canonical data source statuses from `⚪ Not Audited` to `⚠️ Partially Audited` for:
  - `src/data/archetypes.json` (profile and assembly construction paths cross-checked)
  - `src/data/armors.json` (armor trait aggregation and defensive-resolution paths cross-checked)
  - `src/data/bow_weapons.json` (bow reload/range and passive-option behavior paths cross-checked)
  - `src/data/equipment.json` (item trait and tech-window filtering paths cross-checked)
  - `src/data/grenade_weapons.json` (profile generation + weapon-pool integration paths cross-checked)
  - `src/data/item_classifications.json` (class-label coverage integrity cross-checked)
  - `src/data/item_tech_window.json` (tech-level window lookup/filtering paths cross-checked)
  - `src/data/keyword_descriptions.json` (keyword-table integrity and core classifier presence cross-checked)
  - `src/data/melee_weapons.json` (close-combat and hit-test paths cross-checked)
  - `src/data/ranged_weapons.json` (range-combat and hit-test paths cross-checked)
  - `src/data/support_weapons.json` (profile generation + weapon-pool integration paths cross-checked)
  - `src/data/tech_level.json` (age-to-tech mapping consistency cross-checked)
- Corrected stale source pointers:
  - `item_classification.json` → `item_classifications.json`
  - `rules-morale.md` → `rules-damage-and-morale.md`
  - `rules-dice.md` → `rules-tests-and-checks.md`
- Resolved Obscured-threshold source/runtime drift:
  - introduced shared cumulative-threshold helper (`combat/obscured.ts`) used by direct and indirect ranged combat modules
  - aligned guidance text and verification expectations to the same threshold interpretation
- Resolved metadata source/runtime scope gap:
  - metadata tables (`item_classifications.json`, `keyword_descriptions.json`, `tech_level.json`) are now consumed by runtime helpers and covered by dedicated metadata tests.
- Resolved stale Priority-2 file-path references by adding placeholder trackers:
  - `docs/qsr/08-advanced/08.01-traits.md`
  - `docs/qsr/09-edge-cases/09.01-index.md`
- Normalized Advanced guide source pointers:
  - updated `src/guides/docs/rules-advanced-*.md` `Source` blocks to canonical `docs/canonical/MEST.Tactics.Advanced-*.txt` paths
  - added `src/lib/mest-tactics/utils/advanced-guide-integrity.test.ts` to enforce canonical source-pointer and advanced wiki-link integrity
- Reduced advanced trait redundancy surface:
  - deleted unreferenced `src/lib/mest-tactics/traits/advanced-traits-stubs.ts`
  - replaced logic-only `src/lib/mest-tactics/traits/advanced-traits.test.ts` with a runtime-backed helper/status suite

---

## Remaining Priority 1 Clause Gaps

Open **P1-labeled** partial clause IDs: **None**

Counts:
- P1-labeled rows in core files: **33**
- Verified/Complete: **33**
- Partial: **0**
- Missing: **0**

---

## Current Source of Truth

- Master index: `docs/qsr/00-index.md`
- P1 runtime tracker: `docs/qsr/P1_RULES_STATUS.md`
- Redundancy tracker: `docs/qsr/REDUNDANCY_REPORT.md`

---

## Known Non-Blocking Warnings

- None currently tracked from the latest targeted AI test pass (`ai.test.ts`, `stratagems.test.ts`).

---

## Next Recommended Actions

1. Continue tightening `Not Started`/`Not Audited` inventories as each source audit completes.
2. Expand source-audit coverage outside the current P1 core-file set.
3. Continue redundancy reduction in stale tracker-history sections while preserving traceability.
4. Raise targeted coverage in lower-coverage P1 support modules (`GameManager.ts`, `LOSOperations.ts`, `move-validator.ts`) with behavior-backed tests.
