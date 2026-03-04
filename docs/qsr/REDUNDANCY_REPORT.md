# Documentation Redundancy Report

**Date:** 2026-03-04
**Status:** ✅ **UPDATED (P1 redundancy actions applied)**

---

## Executive Summary

**Objective:** Identify and consolidate redundant documentation while preserving differentiated content.

**Findings:**
- **7 files archived** (prefixed with `ARCHIVE_`)
- **0 unresolved high-confidence code duplications**
- **5 low-signal P1 verification test files removed** (replaced by runtime-backed suites)
- **2 legacy compatibility mission test files removed** (redundant with active mission runtime path)

### Addendum - Priority 1 Resume (2026-03-04)

New redundancy/quality finding from P1 audit:

| File | Finding | Action |
|------|---------|--------|
| `src/lib/mest-tactics/actions/p1-visibility-verification.test.ts` | High count of tautological constant assertions | ✅ Removed; runtime visibility/spatial tests retained |
| `src/lib/mest-tactics/actions/p1-cover-verification.test.ts` | Mixed quality; many constant-only checks duplicate rule text | ✅ Removed; runtime cover/spatial tests retained |
| `src/lib/mest-tactics/actions/p1-initiative-verification.test.ts` | Clause labeling present, behavioral evidence partial | ✅ Removed; `initiative-points` + `activation-rules` retained |
| `src/lib/mest-tactics/actions/p1-movement-verification.test.ts` | Significant overlap with rule prose, limited engine-path validation | ✅ Removed; `move-action-rules` retained |
| `src/lib/mest-tactics/actions/p1-morale-verification.test.ts` | Broad clause tags but many non-executable assertions | ✅ Removed; replaced by runtime-backed morale tests |
| `docs/qsr/00-index.md`, `docs/qsr/P1_RULES_STATUS.md`, `docs/qsr/SESSION_HANDOFF.md` | Conflicting state narratives ("complete" vs "in progress") and duplicated historical snapshots | ✅ Consolidated to a single in-progress narrative with aligned counts and closed tracked P1 partials |
| `docs/qsr/00-index.md`, `docs/qsr/01-basics/01.03-visibility.md`, `docs/qsr/01-basics/01.04-cover.md`, `docs/qsr/03-actions/03.04-hide.md`, `docs/qsr/04-combat/04.01-close-combat.md`, `docs/qsr/04-combat/04.02-range-combat.md`, `docs/qsr/07-morale/07.01-morale.md` | References to non-existent guide files (`rules-los.md`, `rules-cover.md`, `rules-lof.md`, `rules-range.md`, `rules-engagement.md`, `rules-dice.md`, `rules-morale.md`) caused stale source pointers | ✅ Corrected to `rules-movement-and-terrain.md` / `rules-friendly-fire-los.md` / `rule-direct-range-combat.md` / `rule-disengage.md` / `rules-tests-and-checks.md` / `rules-damage-and-morale.md` |
| `docs/qsr/00-index.md`, `docs/qsr/03-actions/03.06-wait.md`, `docs/qsr/03-actions/03.07-focus.md` | References to non-existent `src/guides/docs/rules-react.md` caused stale React source pointers | ✅ Corrected to `rules-actions.md` / `rules-bonus-actions.md` |
| `docs/qsr/00-index.md` | Secondary guidance inventory omitted existing `src/guides/docs/rules-indirect.md`, creating source-audit drift for indirect rule work | ✅ Corrected by adding `rules-indirect.md` to tracked guidance sources |
| `docs/qsr/00-index.md` | Priority-2 rows referenced non-existent files (`docs/qsr/04-combat/04.04-indirect.md`, `docs/qsr/08-advanced/08.01-traits.md`, `docs/qsr/09-edge-cases/09.01-index.md`) | ✅ Resolved by creating all three missing tracker files (Indirect clause map + Advanced/Edge placeholders) |
| `docs/qsr/00-index.md` | Canonical data pointer referenced non-existent `src/data/item_classification.json` (singular) instead of on-disk `item_classifications.json` | ✅ Corrected to `src/data/item_classifications.json` |
| `docs/qsr/01-basics/01.03-visibility.md` + `docs/qsr/01-basics/01.04-cover.md` | Split/overlapping CV clause namespaces across two files could drift | ✅ Resolved by declaring `01.04-cover.md` as canonical `CV.*` owner and converting `01.03-visibility.md` CV rows to delegated references |
| `src/guides/docs/rules-friendly-fire-los.md`, `src/lib/mest-tactics/combat/ranged-combat.ts`, `src/lib/mest-tactics/combat/indirect-ranged-combat.ts`, `src/lib/mest-tactics/actions/ranged-combat-cover-verification.test.ts` | Obscured-threshold interpretation drift (`1/2/5/10`) created inconsistent guidance/runtime/test encodings | ✅ Resolved by codifying shared `combat/obscured.ts` cumulative-threshold logic and aligning guide + verification docs/tests to the same interpretation |
| `src/lib/mest-tactics/subroutines/damage.ts` vs `src/lib/mest-tactics/subroutines/damage-test.ts` | Parallel damage-resolution modules overlapped in domain scope while runtime combat paths used `damage-test.ts` | ✅ Resolved by converting `damage.ts` to a compatibility wrapper over `damage-test.ts` and removing duplicated damage logic |
| `src/guides/docs/rules-characters-and-attributes.md.bak` | Backup copy duplicated active character/attribute guidance and could silently drift from the maintained source | ✅ Removed after dependency check (no live references found) |
| `src/guides/docs/rules-general-terms.md` vs domain guides (`rules-status.md`, `rules-combat.md`, `rules-movement*.md`, `rules-tests-and-checks.md`) | Aggregated glossary restated distributed rule clauses, creating a duplicate maintenance surface for thresholds/definitions | ✅ Resolved by reducing glossary content to a non-authoritative term-ownership index with rule-owner pointers only |
| `src/data/*.json` vs generated `src/lib/data.ts` | Canonical data is duplicated into a bundled TypeScript artifact; edits can drift if regeneration is skipped | ✅ Resolved by adding executable sync enforcement in `canonical-data-integrity.test.ts` (bundled artifact must match source JSON transforms) |
| `scripts/bundle-data.cjs` vs `canonical-data-integrity.test.ts` | Canonical JSON transform logic was duplicated in the bundler and in test code | ✅ Resolved by exporting `loadBundledDataFromJson(...)` from `bundle-data.cjs` and reusing it directly in `canonical-data-integrity.test.ts` |
| `src/lib/mest-tactics/mission/assembly-builder.ts`, `engine/end-game-trigger.ts`, `missions/mission-scoring.ts` | Game-size thresholds/defaults were hardcoded in multiple core modules | ✅ Reduced by centralizing canonical game-size reads in `mission/game-size-canonical.ts` and wiring these consumers to it |
| `scripts/battle.ts`, `scripts/ai-battle/core/BattleOrchestrator.ts`, `scripts/battle-generator.ts`, `scripts/battlefield-generator.ts`, `scripts/generate-test-battlefields.ts`, `scripts/run-battles/battle-runner.ts` | Script-level game-size numeric tables were duplicated outside the core canonical helper path | ✅ Resolved by centralizing script game-size values through `scripts/ai-battle/AIBattleConfig.ts` + canonical `game-size-canonical.ts` (dynamic prompts, canonical dimensions, shared `GAME_SIZE_CONFIG`) |
| `scripts/ai-battle/AIBattleConfig.ts` | `GAME_SIZE_CONFIG` had repeated per-size blocks for canonical reads, midpoints, and ranges | ✅ Resolved by generating config rows from a single ordered size list + shared builder (`buildGameSizeConfig`) |
| `scripts/run-battles/configs/very-small.ts`, `small.ts`, `medium.ts`, `large.ts`, `very-large.ts` | Symmetric two-side elimination presets repeated near-identical side/assembly/AI boilerplate | ✅ Resolved by introducing `configs/shared.ts:createSymmetricEliminationConfig(...)` and reducing per-file definitions to size/count knobs |
| `src/lib/mest-tactics/full-game-simulation.test.ts` | Test-local `GAME_SIZES` matrix duplicated canonical game-size dimensions/BP/model limits | ✅ Resolved by deriving simulation configs from `game-size-canonical.ts` + `gameSizeDefaults` |
| `scripts/run-very-large-game.ts` | VERY_LARGE constants duplicated canonical dimensions/limits/trigger values | ✅ Resolved by sourcing config from `CANONICAL_GAME_SIZES`, `gameSizeDefaults`, and `getEndGameTriggerTurn(...)` |
| `src/lib/mest-tactics/viewer/battle-report-viewer.html` | Battlefield max-dimension heuristic could misclassify canonical 24×24 `SMALL` reports as `VERY_SMALL` | ✅ Resolved by exact canonical dimension-key mapping (`18x24`, `24x24`, `36x36`, `48x48`, `48x72`) |
| `scripts/run-battles/configs/ai-stress-test.ts`, `convergence-3side.ts`, `trinity.ts`, `trinity-4side.ts` | Multi-side presets repeated substantial side-assembly boilerplate patterns | ✅ Resolved via generic preset builder in `configs/shared.ts:createPresetBattleConfig(...)` + `PresetSideTemplate[]` side descriptors (including `aiCount` and instrumentation-grade overrides) |
| `scripts/ai-battle/core/BattleOrchestrator.ts` import graph | Relative imports had drifted (`scripts/src/...` resolution), leaving the orchestrator module non-loadable | ✅ Resolved by correcting import paths and verifying module importability via `node --import tsx` |
| `src/data/item_classifications.json` vs item pools (`equipment.json` etc.) | Class dictionary missed `Vehicle` while equipment used class `Vehicle`, creating canonical classification drift | ✅ Resolved by adding `Vehicle` mapping and re-bundling `src/lib/data.ts` |
| `src/data/item_classifications.json`, `src/data/keyword_descriptions.json`, `src/data/tech_level.json` | Metadata tables had been integrity-tested but not consumed in runtime decision paths, creating a docs/test-only maintenance surface | ✅ Resolved by introducing `utils/canonical-metadata.ts` and wiring canonical reads into `profile-generator.ts`, `trait-parser.ts`, and `tech-level-filter.ts` |
| `src/lib/mest-tactics/battlefield/terrain/TerrainElement.ts` | Generic OVR-003 keys (`building`, `wall`, `rocky`) duplicated semantic mapping with canonical terrain names (`Small Building`, `Short Wall`, `Small Rocks`) and caused lookup drift | ✅ Resolved with canonical-name normalization mapping + `TerrainElement.test.ts` |
| `src/lib/mest-tactics/actions/combat-actions.ts` (`executeIndirectAttack`) | Multiple pre-check branches returned near-identical failure payload structures, creating a duplicated maintenance surface for indirect validation reasons | ✅ Resolved by consolidating to a shared `buildIndirectFailure(...)` helper |
| `docs/qsr/04-combat/04.04-indirect.md` vs `src/guides/docs/rules-indirect.md` | Parallel implementation-status summaries duplicated indirect state and could drift when only one file was updated | ✅ Reduced by removing the guide-level implementation status table and deferring status truth to `docs/qsr/04-combat/04.04-indirect.md` |
| `src/lib/mest-tactics/engine/GameManager.ts` (`executeMove`, `executeRally`, `executeIndirectAttack`, `refreshForCharacter`) | Mission-side membership lookup and friendly-side checker derivation were duplicated across action-entry paths | ✅ Resolved by centralizing into `getMissionSideForCharacter()` and `getFriendlySideChecker()` helpers |
| `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | Duplicate `isRangedWeapon`/`isMeleeWeapon` class members and invalid const reassignment created warning noise and duplicated logic surfaces | ✅ Resolved by removing duplicate members and making `waitTacticalBonus` mutable where adjusted |
| `src/lib/mest-tactics/ai/stratagems/AIStratagems.ts` | `getStratagemDescription` used duplicate `balanced` keys for different dimensions, causing overwrite ambiguity | ✅ Resolved with type-scoped description maps (`tactical`/`strategic`/`aggression`) |
| `src/lib/mest-tactics/traits/combat-traits.ts` | Trait helpers read invalid `profile.finalAttributes` uppercase-key paths (`SIZ`, `FOR`, `STR`), duplicating attribute source assumptions and risking zeroed calculations | ✅ Resolved by normalizing to `Character.finalAttributes`/`attributes` lowercase reads in Stun/Awkward/Brawn helpers |
| `src/guides/docs/rules-general-terms.md` | `Physicality`/`Durability` owner pointers included `rules-characters-and-attributes.md`, which does not define those derived terms | ✅ Resolved by assigning owner pointers to canonical `MEST.Tactics.QSR.txt` Common Terminology (lines 496-507); trait docs remain secondary references |
| `src/guides/docs/rules-general-terms.md` | Canonical General Terms coverage omitted `Scrum`, `Outnumbers`, `Agility`, `Core Damage`, and `Melee Range` linkage, creating index-level terminology drift against QSR lines 496-531 | ✅ Resolved by adding missing term rows and canonical-linked ownership mappings |
| `src/lib/mest-tactics/mission/mission-engine.ts`, `src/lib/mest-tactics/missions/mission-runtime.ts`, `src/lib/mest-tactics/missions/mission-registry.ts` | Legacy compatibility layers duplicated mission-runtime-adapter responsibility and were not used by active runtime paths | ✅ Resolved by removing legacy modules and legacy-only tests; mission runtime authority remains `mission-runtime-adapter.ts` |
| `scripts/run-battles/battle-runner.ts` | Imported non-existent/unused `missions/mission-engine` path, preserving stale compatibility assumption | ✅ Resolved by removing dead import |

These files are useful as clause catalogs but should not be treated as full behavioral coverage proof without runtime-backed assertions.

---

## Archived Files

### Implementation Directory (3 files)

| Original File | Reason | Replacement |
|---------------|--------|-------------|
| `ARCHIVE_QSR_RULES_IMPLEMENTATION_PLAN.md` | Sequential snapshot | `docs/qsr/03-actions/*.md` (clause tracking) |
| `ARCHIVE_QSR_RULES_IMPLEMENTATION_FINAL.md` | Sequential snapshot | `docs/qsr/03-actions/*.md` (clause tracking) |
| `ARCHIVE_QSR_RULES_IMPLEMENTATION_COMPLETE.md` | Sequential snapshot | `docs/qsr/03-actions/*.md` (clause tracking) |

**Content:** All three documented First Detect Free, Focus, and Sneaky X implementations with identical code references. Superseded by clause-level tracking in `docs/qsr/`.

### Audit Directory (4 files)

| Original File | Reason | Replacement |
|---------------|--------|-------------|
| `ARCHIVE_QSR_HIDE_DETECT_WAIT_COMPLETE_SUMMARY.md` | Cross-rule summary | Content merged into individual clause files |
| `ARCHIVE_HIDE_DETECT_MECHANICS_CORRECTED.md` | Corrected understanding | Superseded by `docs/qsr/03-actions/03.04-hide.md` |
| `ARCHIVE_FOCUS_DETECT_CONCENTRATE_COMBO.md` | Combo analysis | Content merged into `docs/qsr/03-actions/03.07-focus.md` System Mastery section |
| `ARCHIVE_HIDE_WAIT_TIMING_AND_SNEAKY_X.md` | Timing analysis | Superseded by `docs/qsr/03-actions/03.04-hide.md` |

**Content:** Deep-dive analyses now incorporated into structured clause tracking files with QSR line references.

---

## Retained Files (Differentiated)

### Audit Directory - Active (16 files)

| File | Purpose | Status |
|------|---------|--------|
| `QSR_MASTER_COMPLIANCE_TRACKER.md` | Master compliance overview | ✅ Active |
| `QSR_RULES_COMPLIANCE_AUDIT.md` | Compliance audit results | ✅ Active |
| `AI_BATTLE_AUDIT_ANALYSIS.md` | AI battle behavior analysis | ✅ Active |
| `AI_PLANNING_CORRECTIONS.md` | AI planning corrections | ✅ Active |
| `ASYNC_LOGGING_ANALYSIS.md` | Logging analysis | ✅ Active |
| `SUDDENNESS_REACT_INTERACTIONS.md` | Specific mechanic analysis | ✅ Active |
| `VP_*.md` (5 files) | VP scoring analysis/fixes | ✅ Active |
| `WAIT_TIMING_AND_OPPOSED_TEST_MATH.md` | Timing analysis | ✅ Active |
| `falling-tactics.md` | Falling rules analysis | ✅ Active |
| `agility-hands.md` | Agility hands analysis | ✅ Active |
| `hardcoded-distances.md` | Distance audit | ✅ Active |
| `running-jump.md` | Jump analysis | ✅ Active |

### Implementation Directory - Active (3 files)

| File | Purpose | Status |
|------|---------|--------|
| `QSR_RULES_CONFIRMED.md` | Confirmed rules reference | ✅ Active |
| `AI_BATTLE_AUDIT_STATUS.md` | AI battle audit status | ✅ Active |
| `SCORER_PLANNER_FIXES.md` | Scorer fixes | ✅ Active |

### QSR Directory - Active (11 files)

| File | Purpose | Status |
|------|---------|--------|
| `00-index.md` | Master index | ✅ Active |
| `99-rule-template.md` | Clause tracking template | ✅ Active |
| `03-actions/03.04-hide.md` | Hide rule (21 clauses) | ✅ Active |
| `03-actions/03.05-detect.md` | Detect rule (10 clauses) | ✅ Active |
| `03-actions/03.06-wait.md` | Wait rule (11 clauses) | ✅ Active |
| `03-actions/03.07-focus.md` | Focus rule (4 clauses) | ✅ Active |
| `trait-tests.md` | Trait test tracking | ✅ Active |
| `bonus-action-tests.md` | Bonus action test tracking | ✅ Active |
| `passive-options-tests.md` | Passive options test tracking | ✅ Active |
| `traceability.md` | Code-to-rules traceability | ✅ Active |
| `SESSION_HANDOFF.md` | Session context | ✅ Active |

---

## Code Redundancy Assessment

### UtilityScorer Module

| File | Purpose | Verdict |
|------|---------|---------|
| `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | Main implementation (3,565 lines) | ✅ Single source |
| `src/lib/mest-tactics/ai/core/UtilityScorer.R3.test.ts` | R3 feature tests (321 lines) | ✅ Differentiated |
| `src/lib/mest-tactics/ai/core/UtilityScorer.ROF.test.ts` | ROF feature tests (335 lines) | ✅ Differentiated |

**Assessment:** No code duplication. Test files are feature-scoped suites for different capabilities (Movement/Cover-Seeking vs. ROF/Suppression/Firelane).

### Legacy Modules (Removed)

| Module/File | Status | Notes |
|-------------|--------|-------|
| `src/lib/mest-tactics/mission/mission-engine.ts` | ✅ Removed | Legacy compatibility layer, unused by active runtime |
| `src/lib/mest-tactics/missions/mission-runtime.ts` | ✅ Removed | Legacy runtime wrapper, unused by active runtime |
| `src/lib/mest-tactics/missions/mission-registry.ts` | ✅ Removed | Duplicate mission lookup APIs; unused internally |
| `src/lib/mest-tactics/mission/mission-engine.test.ts` | ✅ Removed | Legacy-only test for removed compatibility layer |
| `src/lib/mest-tactics/mission/mission-runtime.test.ts` | ✅ Removed | Legacy-only test for removed compatibility layer |

---

## Test Redundancy Assessment

**Total:** 148 test files, 2,381 tests (100% pass)

**Assessment:** No overlapping test coverage identified. Test files are:
- **Feature-scoped** (e.g., `UtilityScorer.R3.test.ts`, `UtilityScorer.ROF.test.ts`)
- **Domain-specific** (e.g., `concealment.test.ts`, `combat.test.ts`, `react-actions.test.ts`)
- **Mission-specific** (e.g., `elimination.test.ts`, `assault.test.ts`)

**Recommendation:** Clause-to-test mapping will reveal any gaps, not redundancies.

---

## Documentation Hierarchy (Post-Cleanup)

```
docs/
├── qsr/                          # ✅ PRIMARY: QSR clause tracking
│   ├── 00-index.md
│   ├── 03-actions/*.md           # Hide, Detect, Wait, Focus
│   ├── 04-combat/                # TODO: Close Combat, Range, Damage
│   ├── 05-missions/              # TODO: Elimination
│   ├── 06-ai/                    # TODO: AI Decision Rules
│   └── 99-rule-template.md
│
├── audit/                        # ✅ SECONDARY: Analysis reports
│   ├── QSR_MASTER_COMPLIANCE_TRACKER.md
│   ├── QSR_RULES_COMPLIANCE_AUDIT.md
│   └── [specialized analyses]
│
├── implementation/               # ✅ TERTIARY: Technical notes
│   ├── QSR_RULES_CONFIRMED.md
│   └── [fix notes]
│
├── blueprint/                    # 📋 PLANNING: Project roadmap
│   ├── 01-overview.md
│   ├── 02-game-docs.md
│   ├── 03-current-task.md
│   └── phases/
│
└── canonical/                    # 📜 SOURCE: QSR source files
    ├── MEST.Tactics.QSR.txt
    └── [other canonical docs]
```

---

## Next Steps

1. Continue tightening `Not Started`/`Not Audited` source inventories as audits complete.
2. Continue reducing duplicated tracker-history prose while keeping single-source status ownership.
3. Raise targeted coverage in lower-coverage P1 support modules (`GameManager.ts`, `LOSOperations.ts`, `move-validator.ts`) with behavior-backed tests.

---

## Current Baseline

- Test suite baseline: `npx vitest run` → **148 files, 2381 tests passing**.
- Coverage baseline: `npx vitest run --coverage` → **148 files, 2381 tests passing**.
- Master status source: `docs/qsr/00-index.md`.
- P1 runtime tracker: `docs/qsr/P1_RULES_STATUS.md`.

---

## Open Redundancy Flags

No high-confidence code-level redundancy flags are currently open.

---

## Historical Notes

Detailed Stage 1-5 historical narratives were removed from this file to prevent stale status duplication. Historical progress remains available in git history and archived reports.
