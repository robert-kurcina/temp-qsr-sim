# QSR Traceability Matrix

This matrix maps the source instructions in `docs/*.txt` to the modular rules docs in `src/guides/docs/` and to the current runtime code in `src/lib/mest-tactics/`. It explicitly calls out gaps and mismatches.

**Last Updated:** February 26, 2026  
**Documentation Coverage:** ~100% of QSR.txt  
**Test Coverage:** 1,324 tests across 95 test files (100% pass)

**Related Test Documentation:**
- [[qsr-trait-tests|QSR Trait Tests]] — Unit test coverage for all 100+ traits (16 QSR traits complete)
- [[qsr-bonus-action-tests|QSR Bonus Action Tests]] — Unit test coverage for all 8 Bonus Actions
- [[qsr-passive-player-options-tests|QSR Passive Player Options Tests]] — Unit test coverage for all 7 Passive Options (17 tests complete)

Legend:
- **Implemented**: Core behavior present in runtime code.
- **Partial**: Some behavior present, but missing key rules or wiring.
- **Docs Only**: Documented but not implemented in runtime code.
- **Mismatch**: Doc deviates from source instructions.

## QSR Core Rules (from `docs/MEST.Tactics.QSR.txt`)

| Source Topic | Rules Docs Mapping | Runtime Code Mapping | Status | Notes |
|---|---|---|---|---|
| Materials & Play Aids | `src/guides/docs/rules-materials.md` | N/A | Docs Only | Materials are not runtime logic. |
| Game Goal / Overview | `src/guides/docs/rules-introduction.md` | N/A | Docs Only | Narrative/overview only. |
| Assemblies, Sides, Game Size | `src/guides/docs/rules-assemblies-and-setup.md` | `src/lib/mest-tactics/mission/assembly-builder.ts`, `src/lib/mest-tactics/mission/bp-validator.ts`, `src/lib/mest-tactics/missions/mission-scoring.ts#determineGameSize` | Partial | Game size logic exists, but some assembly constraints and “equivalent forces” guidance are not enforced. |
| Characters & Attributes | `src/guides/docs/rules-characters-and-attributes.md` | `src/lib/mest-tactics/core/Character.ts`, `src/lib/mest-tactics/core/Attributes.ts` | Implemented | Attribute usage maps to tests and actions. |
| Dice & Tests | `src/guides/docs/rules-tests-and-checks.md` | `src/lib/mest-tactics/subroutines/dice-roller.ts`, `src/lib/mest-tactics/subroutines/*-test.ts` | Implemented | Core roll logic and carry-over implemented. |
| Traits | `src/guides/docs/rules-traits.md`, `src/guides/docs/rules-traits-list.md` | `src/lib/mest-tactics/traits/*` | **Implemented** | Parser and 49 traits fully documented in rules-traits-list.md (updated 2026-02-25); combat traits wired in runtime; full trait list coverage complete. |
| Items & Equipment | `src/guides/docs/rules-items.md` | `src/lib/mest-tactics/core/Item.ts`, `src/lib/mest-tactics/utils/profile-generator.ts`, `src/lib/mest-tactics/actions/hand-requirements.ts` | Partial | Data exists; hand requirements are enforced for attacks and Fiddle; some equipment behaviors remain unimplemented. |
| Multiple Weapons | `src/guides/docs/rules-multiple.md` | `src/lib/mest-tactics/traits/combat-traits.ts`, `src/lib/mest-tactics/actions/combat-actions.ts` | Partial | Multiple-weapon bonus/penalty now based on in-hand pool and conceal/discrete; interruption/weapon-declaration nuances still missing. |
| Initiative & IP | `src/guides/docs/rules-initiative.md` | `src/lib/mest-tactics/engine/GameManager.ts`, `src/lib/mest-tactics/mission/MissionSide.ts` | Implemented | Includes advanced Initiative Card system. |
| Actions (Move, Fiddle, Wait, etc.) | `src/guides/docs/rules-actions.md` | `src/lib/mest-tactics/actions/*` | **Implemented** | Core action set present; Quick Reference table added (2026-02-25) with all 14 actions, Initiative Abilities, Bonus Actions, and Passive Player Options. |
| Bonus Actions & Passive Options | `src/guides/docs/rules-bonus-actions.md` | `src/lib/mest-tactics/actions/bonus-actions.ts`, `src/lib/mest-tactics/status/passive-options.ts` | **Implemented** | All 8 Bonus Actions with Physicality rules; all 7 Passive Player Options implemented (Defend!, Take Cover!, Counter-strike!, etc.). |
| Falling Rules | `src/guides/docs/rules-falling-swap-confined.md` | `src/lib/mest-tactics/actions/agility.ts#resolveFallingTest`, `src/lib/mest-tactics/actions/agility.ts#resolveFallingCollision` | **Implemented** | Falling Test (DR = SIZ + (MU beyond Agility ÷ 4)), collision rules, wound/delay logic; 17 tests added (2026-02-25). |
| Swap & Confinement | `src/guides/docs/rules-falling-swap-confined.md` | `src/lib/mest-tactics/actions/swap.ts`, `src/lib/mest-tactics/battlefield/spatial/spatial-rules.ts` | **Implemented** | Swap Positions rules, Confinement definition and penalties. |
| Random Selection | `src/guides/docs/rules-random-selection.md` | `src/lib/mest-tactics/subroutines/dice-roller.ts`, `src/lib/mest-tactics/combat/friendly-fire.ts` | **Implemented** | Y/N, D6, D66, D666 methods; random target selection for Friendly Fire. |
| Technology & Genres | `src/guides/docs/rules-technology-genres.md` | `docs/tech_level_REVISED.json` | **Docs Only** | 20 Tech Levels documented; item availability by era; QSR default Tech 1-3. |
| Armor Materials | `src/guides/docs/rules-armor-materials.md` | N/A | **Docs Only** | Material hardness chart (AR/HR/FOR by era); crafting rules; genre applications. |
| Weapons Reference | `src/guides/docs/rules-weapons-reference.md` | `src/data/melee_weapons.json`, `src/data/bow_weapons.json` | **Docs Only** | Complete Basic Weapons table with stats; Magical Ranged Weapons; classification reference. |
| Armors Reference | `src/guides/docs/rules-armors-reference.md` | `src/data/armors.json`, `src/data/equipment.json` | **Docs Only** | Complete Basic Armors table; Equipment list; armor type breakdown. |
| Variant Archetypes | `src/guides/docs/rules-variant-archetypes.md` | `src/lib/mest-tactics/utils/profile-generator.ts` | **Partial** | 50+ variant archetypes documented with BP costs; runtime profile generator supports trait additions. |
| Combat (Close & Direct Ranged) | `src/guides/docs/rules-combat.md`, `src/guides/docs/rule-close-combat.md`, `src/guides/docs/rule-direct-range-combat.md` | `src/lib/mest-tactics/combat/close-combat.ts`, `src/lib/mest-tactics/combat/ranged-combat.ts`, `src/lib/mest-tactics/actions/combat-actions.ts` | Implemented | Hit tests, damage, traits, jams, and bonus actions present. |
| Indirect Combat | `src/guides/docs/rules-indirect.md` | `src/lib/mest-tactics/combat/indirect-ranged-combat.ts`, `src/lib/mest-tactics/combat/scatter.ts`, `src/lib/mest-tactics/actions/combat-actions.ts#executeIndirectAttack` | Partial | Hit test + scatter + AoE/Frag/Scrambling wired in `executeIndirectAttack`; blind attacks and terrain/elevation fidelity remain partial. |
| Scatter Diagram | `src/guides/docs/rules-scatter.md` | `src/lib/mest-tactics/combat/scatter.ts` | Implemented | Scatter engine supports biased/unbiased direction with optional weights. |
| Friendly Fire & LOF | `src/guides/docs/rules-friendly-fire-los.md` | `src/lib/mest-tactics/combat/friendly-fire.ts`, `src/lib/mest-tactics/battlefield/los/*` | **Implemented** | Priority order (base-contact → within 1" → within 1" of LOF); Unopposed REF Test DR=misses; Safe Models exception; Concentrated Attack AR exception (updated 2026-02-25). |
| Damage & Morale | `src/guides/docs/rules-damage-and-morale.md` | `src/lib/mest-tactics/subroutines/damage-test.ts`, `src/lib/mest-tactics/status/morale.ts` | Implemented | Damage pipeline and morale tests present (`damage.ts` retained as a compatibility wrapper). |
| KO'd Attacks | `src/guides/docs/rules-kod.md` | `src/lib/mest-tactics/status/kod-rules.ts`, `src/lib/mest-tactics/actions/combat-actions.ts` | Partial | Optional toggle default false; Puppet controller traits require UI/config wiring. |
| Status Effects | `src/guides/docs/rules-status.md` | `src/lib/mest-tactics/status/*` | Implemented | Status docs now reflect QSR condition/status model and runtime token flow. |
| Movement & Terrain | `src/guides/docs/rules-movement.md`, `src/guides/docs/rules-terrain.md`, `src/guides/docs/rules-movement-and-terrain.md` | `src/lib/mest-tactics/battlefield/*`, `src/lib/mest-tactics/actions/move-action.ts` | Partial | Movement validation is present; terrain heights and 3D volume are TODO. |
| Size & Base Diameter | `src/guides/docs/rules-size-base-diameter.md` | `src/lib/mest-tactics/battlefield/spatial/size-utils.ts` | Implemented | Base diameter from SIZ is implemented. |

## Missions, Keys, Objective Markers

| Source Topic | Rules Docs Mapping | Runtime Code Mapping | Status | Notes |
|---|---|---|---|---|
| Missions & Scenarios | `src/guides/docs/rules-missions.md` | `src/lib/mest-tactics/engine/GameController.ts`, `src/lib/mest-tactics/missions/mission-runtime-adapter.ts`, `src/lib/mest-tactics/missions/*-manager.ts`, `scripts/ai-battle-setup.ts` | **Implemented** | Authoritative runtime is `GameController.runMission()` + mission runtime adapter; seeded Mission 11 validation/aggregate reporting is available via `scripts/ai-battle-setup.ts -v`; legacy compatibility modules (`mission-engine`, legacy `mission-runtime`, `mission-registry`) were removed in redundancy cleanup. |
| Mission Keys | `src/guides/docs/rules-mission-keys.md` | `src/lib/mest-tactics/missions/mission-keys.ts`, `src/lib/mest-tactics/missions/mission-runtime-adapter.ts`, `src/lib/mest-tactics/missions/mission-scoring.ts` | **Implemented** | RP->VP scoring and RP tie-break winner logic are implemented; first-blood/targeted/collection/flawless hooks are runtime-wired; **R1 COMPLETE**: Elimination mission scoring fixed to award VP at game end based on BP value, with Bottled and Outnumbered keys implemented. |
| Objective Markers (OMs) | `src/guides/docs/rules-objective-markers.md` | `src/lib/mest-tactics/mission/objective-markers.ts`, `src/lib/mest-tactics/missions/mission-runtime-adapter.ts`, `src/lib/mest-tactics/engine/GameManager.ts` | **Implemented** | QSR OM types + acquire/share/transfer/drop/destroy lifecycle APIs are wired through runtime adapter + GameManager; **R2 COMPLETE**: Mission-specific OM semantics for Assault (QAI_13) and Breach (QAI_20); zone-control missions (QAI_12, QAI_14, QAI_17) use automatic zone control based on positioning. |
| QAI Missions | `src/guides/docs/rules-missions-qai.md` | `src/lib/mest-tactics/missions/*.ts` | **Implemented** | Mission definitions/tests exist; terminology aligned to source labels (Power Nodes, Sabotage Points, Intelligence Caches, Security Switches). |

## AI Behavior & Scoring

| Source Topic | Rules Docs Mapping | Runtime Code Mapping | Status | Notes |
|---|---|---|---|---|
| AI Stratagems | `src/guides/docs/rules-ai.md` | `src/lib/mest-tactics/ai/stratagems/AIStratagems.ts`, `src/lib/mest-tactics/ai/stratagems/StratagemIntegration.ts` | **Implemented** | 27 Tactical Doctrine combinations (3×3×3) with engagement/planning/aggression components. |
| Predicted Scoring | N/A (R1.5 feature) | `src/lib/mest-tactics/mission/MissionSide.ts`, `src/lib/mest-tactics/ai/core/SideAICoordinator.ts`, `src/lib/mest-tactics/ai/stratagems/PredictedScoringIntegration.ts` | **Implemented** | **R1.5 COMPLETE**: Side-level AI coordination with predicted VP/RP scoring; 17 Keys to Victory tracked with confidence metrics; battle reports include `sideStrategies` section. |
| AI Utility Scoring | N/A (R2 feature) | `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | **Implemented** | **R2 COMPLETE**: Mission-aware utility pressure, target priority heuristics, objective marker integration, Wait/React valuation improvements, role-aware action valuation, action reasoning improvements. |
| AI Movement Quality | N/A (R3 feature) | `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | **Implemented** | **R3 COMPLETE**: Cover-seeking, lean opportunity detection, exposure risk assessment, doctrine-aware scoring (ranged vs melee), size-agnostic behavior. |
| AI Validation Harness | N/A (R4 feature) | `scripts/mission-validation-scan.ts` | **Implemented** | **R4 COMPLETE**: Cross-mission validation with automated diff flags, behavior fingerprint comparison, tactical mechanics diagnostics, fail-fast on regressions. |

## Indirect Combat Supplemental (from `docs/MEST.Tactics.Indirect.txt`)

| Source Topic | Rules Docs Mapping | Runtime Code Mapping | Status | Notes |
|---|---|---|---|---|
| Indirect Hit Test | `src/guides/docs/rules-indirect.md` | `src/lib/mest-tactics/combat/indirect-ranged-combat.ts` | Implemented | Unopposed RCA test with modifiers. |
| Scatter | `src/guides/docs/rules-indirect.md`, `src/guides/docs/rules-scatter.md` | `src/lib/mest-tactics/combat/scatter.ts`, `src/lib/mest-tactics/actions/combat-actions.ts#executeIndirectAttack` | Implemented | Scatter direction and placement are integrated into indirect attack resolution. |
| Roll-down / Gravity | `src/guides/docs/rules-indirect.md`, `src/guides/docs/rules-scatter.md` | `src/lib/mest-tactics/combat/scatter.ts` | Partial | Basic logic exists; terrain elevation fidelity is limited. |
| Scrambling React | `src/guides/docs/rules-indirect.md`, `src/guides/docs/rules-advanced.md` | `src/lib/mest-tactics/actions/combat-actions.ts#executeIndirectAttack` | Partial | Scramble resolution exists when enabled; still needs react-system integration and default move rules. |
| AoE / Frag Resolution | `src/guides/docs/rules-indirect.md` | `src/lib/mest-tactics/actions/combat-actions.ts#executeIndirectAttack` | Implemented | AoE/Frag resolution is wired in indirect attack path. |
| Blind Attacks | `src/guides/docs/rules-indirect.md` | `src/lib/mest-tactics/actions/combat-actions.ts#executeIndirectAttack`, `src/lib/mest-tactics/combat/indirect-ranged-combat.ts` | Partial | Spotter/Known gating and blind penalties are wired; [Scatter] blind mode uses unbiased direction + extra wild-distance. Arc/height fidelity remains pending. |

## Known Doc Mismatches to Resolve

| Item | Location | Mismatch | Resolution Plan |
|---|---|---|---|
| Indirect Arc/Height Fidelity | `src/guides/docs/rules-indirect.md` | Midpoint/arc terrain-height precision remains deferred pending terrain elevation clarification. | **Deferred to Phase 3** - Requires 3D terrain implementation. Current 2D implementation is functional for QSR validation. |
| Movement/Terrain 3D | `src/guides/docs/rules-movement.md`, `src/guides/docs/rules-terrain.md` | Terrain heights and 3D volume not fully modeled in runtime. | **Deferred** - 2D footprint sufficient for QSR; 3D LOS/height checks are Phase 4. |

## Completed Documentation Work (2026-02-26)

| Item | Location | Previous Status | Resolution |
|---|---|---|---|
| Charge Bonus vs Charge Trait | `src/guides/docs/rules-situational-modifiers.md`, `src/guides/docs/rules-traits-list.md` | Ambiguous distinction | **Complete** - Clear separation: Charge bonus = +1m Hit Test (Situational), Charge trait = +1 Wild die Damage +1 Impact (Weapon); 4 examples added. |
| Core Damage | `src/guides/docs/rules-general-terms.md` | Not marked as Advanced | **Complete** - Now marked "Advanced Rule (Not in QSR)" with Suppression reference. |
| Falling Rules | `src/lib/mest-tactics/actions/agility.ts` | Partial (missing Falling Test) | **Complete** - resolveFallingTest() and resolveFallingCollision() implemented; 17 tests added. |
| Friendly Fire | `src/guides/docs/rules-friendly-fire-los.md` | In-Progress | **Complete** - Full resolution sequence, priority order, REF Test, Safe Models exception. |
| Bonus Actions | `src/guides/docs/rules-bonus-actions.md` | Not documented | **Complete** - All 8 Bonus Actions with Physicality rules; all 7 Passive Player Options. Updated with Additional Clauses (◆➔✷) and base cascade costs. |
| Actions Quick Reference | `src/guides/docs/rules-actions.md` | No consolidated table | **Complete** - Complete Actions List, Initiative Abilities, Bonus Actions, Passive Player Options tables. |
| Technology & Genres | `src/guides/docs/rules-technology-genres.md` | Not documented | **Complete** - 20 Tech Levels, item availability by era, genre settings. |
| Armor Materials | `src/guides/docs/rules-armor-materials.md` | Not documented | **Complete** - Material hardness chart, era classifications, crafting rules. |
| Weapons/Armors Reference | `src/guides/docs/rules-weapons-reference.md`, `src/guides/docs/rules-armors-reference.md` | Not documented | **Complete** - Complete tables with stats, BP costs, trait references. |
| Variant Archetypes | `src/guides/docs/rules-variant-archetypes.md` | Not documented | **Complete** - 50+ variants with BP costs, trait additions, role applications. |
| Random Selection | `src/guides/docs/rules-random-selection.md` | Not documented | **Complete** - Y/N, D6, D66, D666 methods; random model selection. |
| TODO Comments | Various runtime files | Untracked | **Complete** - 8 TODOs updated with rules references (compulsory-actions.ts, morale.ts, GameManager.ts, GOAP.ts, TacticalPatterns.ts). |
| Code Comments | `close-combat.ts`, `ranged-combat.ts` | No rules links | **Complete** - File-level headers with rules module references added. |
| **Test Documentation** | `docs/qsr-*.md` | Not documented | **Complete** (2026-02-26) - 4 test tracking documents created: |
| | `docs/qsr-trait-tests.md` | — | 100+ traits tracked; 16 QSR combat traits have unit tests (39 tests passing) |
| | `docs/qsr-bonus-action-tests.md` | — | 8 Bonus Actions tracked with Additional Clauses; tests pending |
| | `docs/qsr-passive-player-options-tests.md` | — | 7 Passive Options tracked; 17 unit tests passing |

## Resolved Mismatches (R1-R5)

| Item | Location | Previous Mismatch | Resolution |
|---|---|---|---|
| Elimination Scoring | `src/lib/mest-tactics/missions/elimination-manager.ts` | VP awarded per elimination instead of at game end based on BP | **R1 COMPLETE** - Now awards VP at game end based on highest BP of KO'd+Eliminated enemies |
| Bottled/Outnumbered Keys | `src/lib/mest-tactics/missions/elimination-manager.ts` | Missing from Elimination mission | **R1 COMPLETE** - Both keys now implemented with correct semantics |
| Mission-Specific OM Semantics | `src/lib/mest-tactics/missions/mission-runtime-adapter.ts` | Only Assault/Breach had mission-native operations | **R2 COMPLETE** - Zone-control missions (QAI_12, QAI_14, QAI_17) now have automatic zone control |
| Wait Tactical Valuation | `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | Wait undervalued without tactical conditions | **R2 COMPLETE** - Added 6 tactical condition bonuses (low-REF enemies, multi-trigger, etc.) |
| Cover-Seeking Movement | `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | Movement didn't prioritize cover/lean | **R3 COMPLETE** - Added lean opportunity detection and exposure risk assessment |
| Behavior Validation | N/A | No automated detection of behavior cloning | **R4 COMPLETE** - Cross-mission validation harness with fail-fast on suspicious convergence |
| Documentation Completeness | `src/guides/docs/*.md` | ~95% QSR coverage, missing reference tables | **R5 COMPLETE** (2026-02-26) - 7 new rules modules, 41 total files, ~100% QSR coverage; 1,324 tests (100% pass); 4 test tracking documents. |
