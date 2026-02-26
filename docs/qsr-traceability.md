# QSR Traceability Matrix

This matrix maps the source instructions in `docs/*.txt` to the modular rules docs in `src/guides/docs/` and to the current runtime code in `src/lib/mest-tactics/`. It explicitly calls out gaps and mismatches.

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
| Traits | `src/guides/docs/rules-traits.md`, `src/guides/docs/rules-traits-list.md` | `src/lib/mest-tactics/traits/*` | Partial | Parser and several combat traits implemented, full trait list not wired. |
| Items & Equipment | `src/guides/docs/rules-items.md` | `src/lib/mest-tactics/core/Item.ts`, `src/lib/mest-tactics/utils/profile-generator.ts`, `src/lib/mest-tactics/actions/hand-requirements.ts` | Partial | Data exists; hand requirements are enforced for attacks and Fiddle; some equipment behaviors remain unimplemented. |
| Multiple Weapons | `src/guides/docs/rules-multiple.md` | `src/lib/mest-tactics/traits/combat-traits.ts`, `src/lib/mest-tactics/actions/combat-actions.ts` | Partial | Multiple-weapon bonus/penalty now based on in-hand pool and conceal/discrete; interruption/weapon-declaration nuances still missing. |
| Initiative & IP | `src/guides/docs/rules-initiative.md` | `src/lib/mest-tactics/engine/GameManager.ts`, `src/lib/mest-tactics/mission/MissionSide.ts` | Implemented | Includes advanced Initiative Card system. |
| Actions (Move, Fiddle, Wait, etc.) | `src/guides/docs/rules-actions.md` | `src/lib/mest-tactics/actions/*` | Implemented | Core action set present. |
| Combat (Close & Direct Ranged) | `src/guides/docs/rules-combat.md`, `src/guides/docs/rule-close-combat.md`, `src/guides/docs/rule-direct-range-combat.md` | `src/lib/mest-tactics/combat/close-combat.ts`, `src/lib/mest-tactics/combat/ranged-combat.ts`, `src/lib/mest-tactics/actions/combat-actions.ts` | Implemented | Hit tests, damage, traits, jams, and bonus actions present. |
| Indirect Combat | `src/guides/docs/rules-indirect.md` | `src/lib/mest-tactics/combat/indirect-ranged-combat.ts`, `src/lib/mest-tactics/combat/scatter.ts`, `src/lib/mest-tactics/actions/combat-actions.ts#executeIndirectAttack` | Partial | Hit test + scatter + AoE/Frag/Scrambling wired in `executeIndirectAttack`; blind attacks and terrain/elevation fidelity remain partial. |
| Scatter Diagram | `src/guides/docs/rules-scatter.md` | `src/lib/mest-tactics/combat/scatter.ts` | Implemented | Scatter engine supports biased/unbiased direction with optional weights. |
| Friendly Fire & LOF | `src/guides/docs/rules-friendly-fire-los.md` | `src/lib/mest-tactics/combat/friendly-fire.ts`, `src/lib/mest-tactics/battlefield/los/*` | Partial | LOF/LOS logic is 2D; full cover fidelity is incomplete. |
| Damage & Morale | `src/guides/docs/rules-damage-and-morale.md` | `src/lib/mest-tactics/subroutines/damage.ts`, `src/lib/mest-tactics/status/morale.ts` | Implemented | Damage pipeline and morale tests present. |
| KO'd Attacks | `src/guides/docs/rules-kod.md` | `src/lib/mest-tactics/status/kod-rules.ts`, `src/lib/mest-tactics/actions/combat-actions.ts` | Partial | Optional toggle default false; Puppet controller traits require UI/config wiring. |
| Status Effects | `src/guides/docs/rules-status.md` | `src/lib/mest-tactics/status/*` | Implemented | Status docs now reflect QSR condition/status model and runtime token flow. |
| Movement & Terrain | `src/guides/docs/rules-movement.md`, `src/guides/docs/rules-terrain.md`, `src/guides/docs/rules-movement-and-terrain.md` | `src/lib/mest-tactics/battlefield/*`, `src/lib/mest-tactics/actions/move-action.ts` | Partial | Movement validation is present; terrain heights and 3D volume are TODO. |
| Size & Base Diameter | `src/guides/docs/rules-size-base-diameter.md` | `src/lib/mest-tactics/battlefield/spatial/size-utils.ts` | Implemented | Base diameter from SIZ is implemented. |

## Missions, Keys, Objective Markers

| Source Topic | Rules Docs Mapping | Runtime Code Mapping | Status | Notes |
|---|---|---|---|---|
| Missions & Scenarios | `src/guides/docs/rules-missions.md` | `src/lib/mest-tactics/engine/GameController.ts`, `src/lib/mest-tactics/missions/mission-runtime-adapter.ts`, `src/lib/mest-tactics/missions/*-manager.ts`, `scripts/ai-battle-setup.ts` | **Implemented** | Authoritative runtime is now `GameController.runMission()` + mission runtime adapter; seeded Mission 11 validation/aggregate reporting is available via `scripts/ai-battle-setup.ts -v`; legacy mission-engine/runtime modules remain on disk for compatibility/tests. |
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

## Resolved Mismatches (R1-R4)

| Item | Location | Previous Mismatch | Resolution |
|---|---|---|---|
| Elimination Scoring | `src/lib/mest-tactics/missions/elimination-manager.ts` | VP awarded per elimination instead of at game end based on BP | **R1 COMPLETE** - Now awards VP at game end based on highest BP of KO'd+Eliminated enemies |
| Bottled/Outnumbered Keys | `src/lib/mest-tactics/missions/elimination-manager.ts` | Missing from Elimination mission | **R1 COMPLETE** - Both keys now implemented with correct semantics |
| Mission-Specific OM Semantics | `src/lib/mest-tactics/missions/mission-runtime-adapter.ts` | Only Assault/Breach had mission-native operations | **R2 COMPLETE** - Zone-control missions (QAI_12, QAI_14, QAI_17) now have automatic zone control |
| Wait Tactical Valuation | `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | Wait undervalued without tactical conditions | **R2 COMPLETE** - Added 6 tactical condition bonuses (low-REF enemies, multi-trigger, etc.) |
| Cover-Seeking Movement | `src/lib/mest-tactics/ai/core/UtilityScorer.ts` | Movement didn't prioritize cover/lean | **R3 COMPLETE** - Added lean opportunity detection and exposure risk assessment |
| Behavior Validation | N/A | No automated detection of behavior cloning | **R4 COMPLETE** - Cross-mission validation harness with fail-fast on suspicious convergence |
