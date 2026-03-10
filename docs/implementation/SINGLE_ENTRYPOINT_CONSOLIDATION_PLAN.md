# Single Entry Point Consolidation Plan

**Status:** In Progress  
**Date:** 2026-03-07  
**Goal:** One battle command surface, one canonical runner, full feature parity, no behavioral regressions.

## Progress

- [x] `scripts/sim.ts` added as universal entry point.
- [x] `package.json` command wrappers route through `sim` (`battle*`, `ai-battle*`).
- [x] Regression tests added for command/help/default parsing:
  - `scripts/sim.test.ts`
  - `scripts/ai-battle/cli/SetupCliParser.test.ts`
- [x] Battlefield generation CLI parsing consolidated and regression-tested:
  - `scripts/shared/BattlefieldLayerTokens.ts`
  - `scripts/generate-battlefield-data.test.ts`
  - `scripts/shared/BattlefieldLayerTokens.test.ts`
- [x] `sim battle` now routes standard battle execution through canonical `AIBattleRunner` (legacy `battle.ts` retained only for `--terrain-only`).
- [x] `run-battles` CLI now executes canonical `AIBattleRunner` (with preset/config adapter and side loadout seeding).
- [x] Shared canonical config adapter extracted (`scripts/shared/CanonicalBattleConfigAdapter.ts`) and reused by both `battle.ts` and `run-battles`.
- [x] Migrate remaining report-server call-sites to `sim` where appropriate (`serve:reports` now delegates via `sim serve-reports`).
- [x] Report server route modularization started (`scripts/serve/routes/*` + `scripts/serve/*`) with battle/battlefield/static handlers split from `serve-terrain-audit.ts`.
- [x] Added initial regression coverage for modularized server components (`BattleRoutes` + `ServerLifecycle` tests).
- [x] Added battlefield route regression coverage (`scripts/serve/routes/BattlefieldRoutes.test.ts`) for generate/pathfind/agility/LOS endpoints.
- [x] Added static route regression coverage (`scripts/serve/routes/StaticRoutes.test.ts`) and extracted CORS/error helpers into `scripts/serve/HttpUtils.ts`.
- [x] Added integration-style dispatch coverage via `scripts/serve/ReportServerDispatcher.test.ts` (ordering, preflight, fallback, error path).
- [x] Added request-level server app smoke coverage via `scripts/serve/ReportServerApp.test.ts` (dashboard, preflight, fallback) without requiring external port binding.
- [x] Complete runtime parity and remove legacy behavior drift (`battle.ts` now acts as a compatibility wrapper: canonical `AIBattleRunner` for battle execution, focused terrain-only artifact path only).
- [x] Mission metadata deduplicated through shared mission catalog (`scripts/shared/MissionCatalog.ts`) and reused by setup/validation/config adapters.
- [x] Report artifact writing unified with shared `runId` bundle writer (`writeBattleArtifacts`) to keep JSON/audit/viewer outputs aligned per run.
- [x] Deprecated legacy `battle-generator.ts` collapsed into a compatibility shim that forwards to `sim run-battles`.
- [x] Legacy `scripts/run-battles/battle-runner.ts` replaced with compatibility adapter that preserves exports but delegates execution to canonical `AIBattleRunner`.
- [x] Legacy `scripts/ai-battle/core/BattleOrchestrator.ts` replaced with compatibility wrapper that builds canonical config and uses shared artifact writer.
- [x] `battlefield:generate` now reuses the same `generateBattlefield` service path used by API generation (`scripts/battlefield-generator.ts`) to remove duplicate terrain/export logic.
- [x] Legacy heavy terrain utilities consolidated: `scripts/generate-svg-output.ts` now forwards to canonical `battlefield:svg`; `scripts/generate-test-battlefields.ts` now uses canonical generator service.
- [x] Battlefield generation CLI parsing consolidated into shared module (`scripts/shared/BattlefieldGenerateCli.ts`) and reused by both `generate-battlefield-data.ts` and `battlefield-generator.ts`.
- [x] Battlefield generation help/usage text consolidated into shared formatter (`scripts/shared/BattlefieldGenerateHelp.ts`) and reused by both battlefield CLI entry points.
- [x] `run-battles` CLI parsing/help extraction completed (`scripts/run-battles/RunBattlesCliParser.ts`) with regression tests for default preset, help aliases, and invalid output handling.
- [x] README command table updated to `sim`-first canonical usage with explicit compatibility alias rows for `battle*`, `ai-battle*`, `run-battles`, and `serve:reports`.
- [x] Deprecated shim scripts removed after cutover (`scripts/battle-generator.ts`, `scripts/generate-svg-output.ts`) now that all npm entry points route through canonical `sim` / `battlefield:*` commands.
- [x] Shared attack-commitment helper extracted (`src/lib/mest-tactics/ai/executor/TargetCommitment.ts`) and reused by both `AIGameLoop` and `AIBattleRunner` to remove duplicated focus-fire commitment logic.
- [x] Shared coordinator-context helper extracted (`src/lib/mest-tactics/ai/executor/CoordinatorContext.ts`) and reused by both `AIGameLoop` and `AIBattleRunner` to remove duplicated scoring/pressure mapping.
- [x] Shared AI-context builder extracted (`src/lib/mest-tactics/ai/executor/AIContextBuilder.ts`) and reused by both `AIGameLoop` and `AIBattleRunner` to remove duplicated `AIContext` assembly.
- [x] Shared knowledge bootstrap extracted (`src/lib/mest-tactics/ai/executor/Knowledge.ts`) and reused by both runners (with compatibility wrapper in validation metrics).
- [x] Shared side-resource snapshot helper extracted (`src/lib/mest-tactics/ai/executor/SideResourceSnapshot.ts`) and reused by both runners for VP/RP map snapshot logic.
- [x] Shared objective-marker AI snapshot helper extracted (`src/lib/mest-tactics/ai/executor/ObjectiveMarkerSnapshot.ts`) and reused by `AIBattleRunner`.
- [x] Shared AI decision-cycle helper extracted (`src/lib/mest-tactics/ai/executor/AIDecisionCycle.ts`) and reused by both runners for knowledge-update/decision sequencing.
- [x] Removed dead mission-runtime helper exports (`buildAiObjectiveMarkerSnapshot`, `getMarkerKeyIdsInHand`) from `MissionRuntimeIntegration.ts` after migration to executor-shared helpers.
- [x] Removed redundant passive-option and marker-key wrappers from `AIBattleRunner` by delegating to shared helpers/tracker APIs (`ObjectiveMarkerSnapshot.getMarkerKeyIdsInHand`, `StatisticsTracker.inspectPassiveOptions`).
- [x] Removed direct advanced-rule type-map mutation from `AIBattleRunner` (`detect_lean`) by routing through `StatisticsTracker.trackSituationalModifierType`.
- [x] Shared loadout classification helper extracted (`src/lib/mest-tactics/ai/executor/LoadoutProfile.ts`) and reused by both `AIGameLoop` and `CombatExecutor` (with `CombatExecutor` re-export compatibility), removing duplicate melee/ranged/loadout logic.
- [x] Runner doctrine/passive/lean helpers extracted from `AIBattleRunner` into shared decision-support module (`scripts/ai-battle/core/AIDecisionSupport.ts`) using dedicated exports (`*ForDoctrine`, `*WithCover`, `buildSpatialModelForCharacter`) to remove duplicated class-local logic.
- [x] Canonical executor validation now reused in `AIBattleRunner` via `AIActionExecutor.validateActionDecision(...)` for supported decision types, with standardized validation failures captured in audit step details.
- [x] Shared battle-audit helper module extracted (`scripts/ai-battle/reporting/BattleAuditHelpers.ts`) and reused by `AIBattleRunner` for usage-summary, movement vector sampling, opposed-test extraction, state-diff effects, and sanitized audit payloads.
- [x] Shared audit-trace payload builder extracted (`scripts/ai-battle/reporting/BattleAuditTraceBuilder.ts`) and reused by `AIBattleRunner` for canonical `audit.json` terrain/nav-mesh/session assembly.
- [x] Shared performance summary/minimax cache aggregator extracted (`scripts/ai-battle/instrumentation/PerformanceSummaryBuilder.ts`) and reused by `AIBattleRunner` to compose `performance.caches` consistently.
- [x] Shared coordinator trace serialization extracted (`scripts/ai-battle/core/CoordinatorTraceSerialization.ts`) and reused by `AIBattleRunner` for both side-strategy reporting and per-turn coordinator decision audit projection.
- [x] Shared battlefield setup/deployment module extracted (`scripts/ai-battle/core/BattlefieldSetup.ts`) and reused by `AIBattleRunner` for terrain generation/export, deployment bounds, and model placement.
- [x] Shared movement planning helpers extracted (`scripts/ai-battle/core/MovementPlanningSupport.ts`) and reused by `AIBattleRunner` for LOS checks, fallback movement destination selection, move-maximization, direct advance stepping, and endpoint snapping.
- [x] Shared react-resolution helper extracted (`scripts/ai-battle/core/ReactResolution.ts`) and reused by `AIBattleRunner` for standard react option resolution/audit payload normalization.
- [x] Shared elimination scoring helper extracted (`scripts/ai-battle/core/EliminationScoring.ts`) and reused by close/ranged combat paths to centralize BP elimination tracking and first-blood RP updates.
- [x] Shared combat runtime helper extracted (`scripts/ai-battle/core/CombatRuntimeSupport.ts`) and reused by `AIBattleRunner` for weapon selection, attack-result normalization, and damage-resolution extraction helpers.
- [x] Shared AP-stall fallback recovery helper extracted (`scripts/ai-battle/core/ActivationFallbackRecovery.ts`) and reused by `AIBattleRunner` to centralize forced-advance move/react execution and fallback audit-step construction.
- [x] Shared react outcome tracking helper extracted (`scripts/ai-battle/core/ReactOutcomeTracking.ts`) and reused by `AIBattleRunner` for mission-runtime react sync, react wound tracking, and step-level react audit merge.
- [x] Shared movement-opportunity attack helper extracted (`scripts/ai-battle/core/OpportunityAttackTracking.ts`) and reused by `AIBattleRunner` across `hold`/`move`/`charge` move paths to centralize disengage opportunity tracking, opposed-test merge, and mission runtime sync.
- [x] Shared wait-action resolution helper extracted (`scripts/ai-battle/core/WaitActionResolution.ts`) and reused by `AIBattleRunner` for `hold` fallback and direct `wait` action flow (toggle gating, tracking hooks, and audit payload shape).
- [x] Shared move-concluded passive processing helper method added in `AIBattleRunner` (`processMoveConcludedPassives`) to remove duplicate counter-charge/passive-option flow across normal and fallback move execution paths.
- [x] Shared move+opportunity execution helper method added in `AIBattleRunner` (`executeMoveAndTrackOpportunity`) to centralize destination move resolution, disengage opportunity processing, and step merge updates across `hold`/`move`/`charge` action paths.
- [x] Shared objective-marker fiddle action resolver extracted (`scripts/ai-battle/core/FiddleActionResolution.ts`) and reused by `AIBattleRunner` for acquire/share/transfer/destroy marker flows and generic fiddle fallback.
- [x] Shared support action resolver extracted (`scripts/ai-battle/core/SupportActionResolution.ts`) and reused by `AIBattleRunner` for AP-gated `rally`/`revive` target validation, execution, and audit result payload composition.
- [x] Shared concealment action resolver extracted (`scripts/ai-battle/core/ConcealmentActionResolution.ts`) and reused by `AIBattleRunner` for `detect`/`hide` execution (target/toggle gating, lean modifier tracking hooks, AP spend checks, and audit payload composition).
- [x] Shared tempo action resolver extracted (`scripts/ai-battle/core/TempoActionResolution.ts`) and reused by `AIBattleRunner` for `pushing`/`refresh` action gating, execution, and audit detail normalization.
- [x] Shared decision-loop support module extracted (`scripts/ai-battle/core/DecisionLoopSupport.ts`) and reused by `AIBattleRunner` for target-audit projection and executor validation pre-checks in `resolveCharacterTurn`.
- [x] Shared passive-combat follow-up module extracted (`scripts/ai-battle/core/PassiveCombatFollowups.ts`) and reused by `AIBattleRunner` for auto bonus-action application, failed-hit passive response resolution, carry-over cascade handling, and move-concluded counter-charge passive processing.
- [x] Shared combat action resolution module extracted (`scripts/ai-battle/core/CombatActionResolution.ts`) and reused by `AIBattleRunner` for close-combat/ranged-combat/disengage execution paths, including passive hooks, elimination scoring updates, and audit payload shaping.
- [x] Shared strategy-reporting support module extracted (`scripts/ai-battle/core/StrategyReportingSupport.ts`) and reused by `AIBattleRunner` for key-score normalization, predicted scoring serialization, side-strategy synthesis, and per-turn coordinator decision projection.
- [x] Report-finalization wrappers removed from `AIBattleRunner` by directly using shared reporting helpers (`BattleAuditTraceBuilder`, `NestedSectionsBuilder`, usage/performance builders) at report assembly call sites.
- [x] Shared mission-runtime support module extracted (`scripts/ai-battle/core/MissionRuntimeSupport.ts`) and reused by `AIBattleRunner` for mission side synthesis, mission model snapshots, runtime delta application, mission winner resolution, wait-start overrides, and attack-driven mission-runtime sync hooks.
- [x] Shared core decision execution support module extracted (`scripts/ai-battle/core/DecisionExecutionSupport.ts`) and reused by `AIBattleRunner` for `hold`/`wait`/`move`/`charge`/`close_combat`/`ranged_combat`/`disengage` action execution, reducing orchestration-file branch complexity while preserving combat/movement semantics.
- [x] Shared non-core decision execution support module extracted (`scripts/ai-battle/core/DecisionNonCoreExecutionSupport.ts`) and reused by `AIBattleRunner` for `detect`/`hide`/`pushing`/`refresh`/`rally`/`revive`/`fiddle` action execution, removing duplicated per-action wiring and tracker plumbing from the activation loop.
- [x] Shared stalled-decision outcome handler extracted (`scripts/ai-battle/core/StalledDecisionOutcomeSupport.ts`) and reused by `AIBattleRunner` to centralize forced-fallback move side effects (opportunity attack mission sync, tracker/log updates, react follow-up wiring, and fallback step sequencing).
- [x] Shared combat-action dependency builder extracted (`scripts/ai-battle/core/CombatActionResolutionDepsBuilder.ts`) and reused by `AIBattleRunner` to centralize combat dependency wiring (passive hooks, elimination scoring sync, doctrine lookup, LOS/LOF metrics, and mission-runtime callbacks).
- [x] Shared action execution react post-processor extracted (`scripts/ai-battle/core/ActionExecutionReactPostProcessing.ts`) and reused by `AIBattleRunner` to centralize moved-distance accounting, move-concluded passive processing, react resolution timing/merge, and step-level react audit updates.
- [x] Shared action-step finalization helper extracted (`scripts/ai-battle/core/ActionStepFinalizationSupport.ts`) and reused by `AIBattleRunner` to centralize model-effect synthesis, attack mission-sync hooks, opposed-test interaction stamping, planning detail serialization, and action-step audit object assembly.
- [x] Shared stalled-decision recovery orchestrator extracted (`scripts/ai-battle/core/StalledDecisionRecoverySupport.ts`) and reused by `AIBattleRunner` to centralize fallback advance trigger gating plus integration of fallback execution and fallback outcome handling.
- [x] Shared bonus-action planning heuristic stack extracted (`scripts/ai-battle/core/BonusActionPlanningHeuristics.ts`) and reused by `AIBattleRunner` for threat/engagement scoring, relocation/retreat selection, pushback selection, and auto-bonus option ordering/selection callbacks.
- [x] Shared decision validation rule helpers extracted (`scripts/ai-battle/core/DecisionValidationRules.ts`) and reused by `AIBattleRunner` for executor-validation gating and standardized validation-context construction.
- [x] Battlefield setup wrappers removed from `AIBattleRunner` in favor of direct canonical setup helpers (`createBattlefieldWithTerrain`, `loadBattlefieldFromPath`, `deployModelsIntoBattlefield`) at orchestration call sites.

## Recommendation

Yes, this is a good idea.

A single entry point is the right long-term direction because:
- It removes duplicated CLI/reporting logic.
- It eliminates drift between `battle`, `ai-battle`, and `run-battles`.
- It gives one place to enforce defaults, guardrails, and regression checks.

## Current Feature Parity Matrix

Legend: `✅` present, `⚠️` partial/different semantics, `❌` missing.

| Capability | `battle.ts` | `ai-battle-setup.ts` + `AIBattleRunner` | `run-battles` | Consolidation Decision |
|---|---|---|---|---|
| Quick single battle CLI | ✅ | ✅ | ✅ | Keep one canonical `quick` mode |
| Interactive setup (`-i`) | ❌ | ✅ | ❌ | Keep (canonical feature) |
| Render existing report (`-r`) | ❌ | ✅ | ❌ | Keep (canonical feature) |
| Validation batch (`-v`) | ❌ | ✅ | ❌ | Keep (canonical feature) |
| Config presets (`--config`, `--config-file`) | ⚠️ basic | ❌ | ✅ | Keep; merge into unified parser |
| Explicit battlefield JSON input | ✅ | ✅ | ✅ | Keep (already aligned) |
| Default pre-generated battlefield | ✅ | ✅ | ✅ | Keep |
| Terrain-only mode | ✅ (`--terrain-only`) | ❌ | ❌ | Keep |
| Core AI orchestration | `AIBattleRunner` (delegated) | `AIBattleRunner` | `AIBattleRunner` (delegated) | Canonicalized on `AIBattleRunner` |
| Strategic/tactical toggles | ✅ | ⚠️ implicit | ✅ | Expose consistently in unified config |
| Action validation + replanning loop | ✅ (`AIActionExecutor`) | ⚠️ custom per-action flow | ✅ (`AIGameLoop`) | Converge on one validation pipeline |
| Mission runtime adapter integration | ✅ (delegated) | ✅ | ✅ (delegated) | Keep `AIBattleRunner` implementation |
| Side coordinator scoring context updates | ✅ (delegated) | ✅ | ✅ (delegated) | Keep `AIBattleRunner` implementation |
| Predicted scoring in report | ❌ | ✅ | ❌ | Keep |
| Objective marker action flows | ⚠️ | ✅ | ⚠️ | Keep |
| Passive/bonus action cascades | ⚠️ | ✅ | ⚠️ | Keep |
| Pathfinding-based move optimization | ⚠️ (sanitized reachable destination) | ✅ (`PathfindingEngine` based) | ⚠️ (`AIGameLoop`) | Keep robust `AIBattleRunner` pathing |
| Performance profiling + cache summary | ❌ | ✅ | ⚠️ instrumentation grade only | Keep |
| Human-readable battle summary format | ⚠️ basic console | ✅ rich formatter | ⚠️ JSON/console result | Keep formatter path |
| Detailed battle JSON report | ⚠️ simpler | ✅ | ⚠️ custom result | Keep `BattleReport` schema |
| Audit + viewer export | ✅ | ✅ | ✅ | Keep one shared writer/export module |
| Deployment export artifact | ✅ | ⚠️ nested in report/audit | ✅ (indirect via runner output) | Keep as optional explicit artifact |
| Dashboard/report server compatibility | ✅ for current artifacts | ✅ primary source today | ✅ mixed | Keep backward compatibility during migration |

## Canonical Runtime Direction

Use `AIBattleRunner` as the canonical execution engine because it already contains:
- mission-runtime lifecycle hooks,
- coordinator scoring updates,
- richer decision/response flow,
- robust pathfinding integration,
- performance and cache instrumentation,
- richer report schema consumed by validation tooling.

What to preserve from `AIGameLoop`/`AIActionExecutor`:
- strict centralized action validation behavior,
- clean action-execution boundaries,
- reusable decision sanitization contracts.

## Target Architecture

Create one top-level entry point (proposed: `scripts/sim.ts`) with subcommands:
- `quick`
- `interactive`
- `validate`
- `render-report`
- `terrain-only`

Internally:
- Route all battle execution through a single `RunnerFacade`.
- `RunnerFacade` calls canonical `AIBattleRunner` code paths.
- `battle.ts`, `ai-battle-setup.ts`, and `run-battles/index.ts` become thin compatibility wrappers delegating to `sim.ts`.

## Redundancy Removal Rules

- Keep only one parser for battle CLI flags and defaults.
- Keep only one report writer path for JSON/audit/viewer artifacts.
- Keep only one battle-result schema (`BattleReport` + validation aggregate).
- Keep only one movement/pathing decision path for canonical runtime.
- Keep only one mission-runtime/scoring update path.
- Allow wrapper scripts only as aliases/adapters, not independent behavior owners.

## Migration Plan

### Phase 1: Lock Contracts (No Behavior Change)

1. Define and freeze unified CLI contract for `sim.ts`.
2. Define output contract:
   - canonical battle report JSON shape,
   - canonical audit/viewer paths,
   - optional deployment export.
3. Add regression fixtures from existing `ai-battle` and `battle` runs.

### Phase 2: Introduce Single Entry Point

1. Implement `scripts/sim.ts` parser and subcommands.
2. Wire `quick`, `interactive`, `validate`, `render-report` to existing `AIBattleRunner` routines.
3. Add `terrain-only` path:
   - either no-op battle with render only,
   - or extracted terrain/export module reused by canonical runner.

### Phase 3: Unify Existing Commands as Wrappers

1. Convert:
   - `battle` -> delegate to `sim.ts quick`
   - `battle:audit` -> delegate to `sim.ts quick --audit --viewer`
   - `battle:terrain` -> delegate to `sim.ts terrain-only`
   - `ai-battle` -> delegate to `sim.ts` equivalent mode
   - `run-battles` -> delegate to `sim.ts` preset/config mode
2. Ensure wrappers preserve legacy flags and print deprecation notice for mismatched options.

### Phase 4: Feature Parity Completion

1. Port missing useful features into canonical runner:
   - explicit centralized validation gates where `AIActionExecutor` is stricter,
   - any remaining useful instrumentation grade options from `run-battles`.
2. Remove duplicated code paths in legacy scripts after parity tests pass.

### Phase 5: Cutover and Cleanup

1. Update docs/scripts table to promote only `sim` commands.
2. Keep old command aliases for one stabilization cycle.
3. Remove dead paths after passing regression and validation benchmarks.

## Regression Gates (Must Pass Before Cutover)

- Functional:
  - quick run works for default `VERY_SMALL` with default battlefield.
  - audit+viewer generation works.
  - validation batch output unchanged in key metrics schema.
  - terrain-only output works.
- Behavioral:
  - no drop in action execution count for baseline seeds.
  - no increase in invalid decision execution.
  - no regression in coordinator trace availability.
- Performance:
  - no material regression in turn-1 elapsed, activation p95, cache hit rates.

## Known Risks

- Validation tooling currently assumes `AIBattleRunner` data structures.
- Report server indexing currently assumes specific directories/file naming.
- Mixing pathing/validation semantics from multiple runners can cause behavior drift if merged too early.

## Mitigations

- Keep wrappers until contract parity is proven.
- Add integration tests for:
  - CLI parsing,
  - report schema compatibility,
  - dashboard loading paths.
- Introduce a `--engine` debug option during transition (`canonical` only for release, legacy for diagnostics).

## Immediate Next Steps

1. Approve canonical command UX for `sim.ts` subcommands and flags.
2. Implement Phase 1 + Phase 2 first (entry point + routing), no removals yet.
3. Run seeded parity benchmark across old and new command surfaces.
