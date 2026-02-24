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
| Status Effects | `src/guides/docs/rules-status.md` | `src/lib/mest-tactics/status/*` | Partial | Runtime status system exists, but docs are incomplete. |
| Movement & Terrain | `src/guides/docs/rules-movement.md`, `src/guides/docs/rules-terrain.md`, `src/guides/docs/rules-movement-and-terrain.md` | `src/lib/mest-tactics/battlefield/*`, `src/lib/mest-tactics/actions/move-action.ts` | Partial | Movement validation is present; terrain heights and 3D volume are TODO. |
| Size & Base Diameter | `src/guides/docs/rules-size-base-diameter.md` | `src/lib/mest-tactics/battlefield/spatial/size-utils.ts` | Implemented | Base diameter from SIZ is implemented. |

## Missions, Keys, Objective Markers

| Source Topic | Rules Docs Mapping | Runtime Code Mapping | Status | Notes |
|---|---|---|---|---|
| Missions & Scenarios | `src/guides/docs/rules-missions.md` | `src/lib/mest-tactics/missions/*`, `src/lib/mest-tactics/mission/mission-engine.ts` | Partial | Mission flow exists, but doc includes sudden-death guidance not in QSR. |
| Mission Keys | `src/guides/docs/rules-mission-keys.md` | `src/lib/mest-tactics/missions/mission-keys.ts`, `src/lib/mest-tactics/missions/mission-scoring.ts` | Partial | Many keys implemented; some are event-driven and need wiring to gameplay. |
| Objective Markers (OMs) | `src/guides/docs/rules-objective-markers.md` | `src/lib/mest-tactics/mission/objective-markers.ts` | Partial | Existing OM system lacks QSR OM types and AP/Hands rules (being added). |
| QAI Missions | `src/guides/docs/rules-missions-qai.md` | `src/lib/mest-tactics/missions/*.ts` | Implemented | Mission definitions and tests are present. |

## Indirect Combat Supplemental (from `docs/MEST.Tactics.Indirect.txt`)

| Source Topic | Rules Docs Mapping | Runtime Code Mapping | Status | Notes |
|---|---|---|---|---|
| Indirect Hit Test | `src/guides/docs/rules-indirect.md` | `src/lib/mest-tactics/combat/indirect-ranged-combat.ts` | Implemented | Unopposed RCA test with modifiers. |
| Scatter | `src/guides/docs/rules-indirect.md`, `src/guides/docs/rules-scatter.md` | `src/lib/mest-tactics/combat/scatter.ts`, `src/lib/mest-tactics/actions/combat-actions.ts#executeIndirectAttack` | Implemented | Scatter direction and placement are integrated into indirect attack resolution. |
| Roll-down / Gravity | `src/guides/docs/rules-indirect.md`, `src/guides/docs/rules-scatter.md` | `src/lib/mest-tactics/combat/scatter.ts` | Partial | Basic logic exists; terrain elevation fidelity is limited. |
| Scrambling React | `src/guides/docs/rules-indirect.md`, `src/guides/docs/rules-advanced.md` | `src/lib/mest-tactics/actions/combat-actions.ts#executeIndirectAttack` | Partial | Scramble resolution exists when enabled; still needs react-system integration and default move rules. |
| AoE / Frag Resolution | `src/guides/docs/rules-indirect.md` | `src/lib/mest-tactics/actions/combat-actions.ts#executeIndirectAttack` | Implemented | AoE/Frag resolution is wired in indirect attack path. |
| Blind Attacks | `src/guides/docs/rules-indirect.md` | N/A | Missing | Spotter/Known validation and blind penalties not wired into indirect attack path. |

## Known Doc Mismatches to Resolve

| Item | Location | Mismatch |
|---|---|---|
| Sudden Death | `src/guides/docs/rules-missions.md` | Sudden death is not in QSR; should be an optional toggle. |
| Status Module Completeness | `src/guides/docs/rules-status.md` | Marked Planning; does not fully reflect QSR statuses. |
