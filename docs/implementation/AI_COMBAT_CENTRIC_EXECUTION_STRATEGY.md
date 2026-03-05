# AI Combat-Centric Execution Strategy

Date: 2026-03-05
Scope: QSR-system-mastery AI behavior for maneuver, terrain leverage, initiative/activation flow, melee+ranged combat, morale, cover management, LOS, and mission-key scoring via VP/RP with in-turn fractional potentials.

## 1) Rules Assumptions to Implement

This strategy assumes:

1. Combat-centric play is primary. Maneuver, terrain, initiative/activation, melee/ranged action, morale, cover, and LOS drive decisions.
2. VP/RP are awarded by mission/end-game rules, but AI must track fractional VP/RP potential continuously during play.
3. Every mission type has explicit Keys to Victory that must directly influence planning and tactical choices.
4. AI is side-level ("god mode"): side strategy coordinates all character activations.

QSR anchors already present in canonical docs:

- Alternating activations with initiative order and side rotations (`MEST.Tactics.QSR.txt`, lines 677, 723, 733).
- LOS/Cover as core combat constraints (lines 553-617).
- End-game VP/RP winner logic and default Elimination keys (lines 761-767).
- Mission keys and VP/RP semantics (`MEST.Tactics.MissionKeys.txt`, lines 52-61, 151-171).

## 2) Current-State Evidence (Code + Runtime)

Fresh runtime baseline (`VERY_SMALL`):

- Command: `npm run ai-battle:audit -- VERY_SMALL 30 --seed 424242`
- Report: `generated/ai-battle-reports/battle-report-2026-03-05T10-35-01-962Z.json`
- Audit: `generated/battle-reports/battle-report-2026-03-05T10-35-01-964Z/audit.json`

Observed behavior:

- 32 total actions: `detect=18`, `hide=4`, `move=1`, `pushing=9`
- `0` ranged attacks, `0` close-combat attacks, `0` KO, `0` eliminations
- 9 unsupported actions: `pushing=false:unsupported`
- Detect loop quality issue: 6 out-of-range detect failures and 8 detect test failures
- Planning attribution in audit steps: almost entirely `planning.source = utility`

Validation evidence:

- Command: `npm run ai-battle -- -v VERY_SMALL 30 1 424242 DAY DEFAULT operative watchman QAI_11`
- Report: `generated/ai-battle-reports/qai-11-validation-2026-03-05T10-34-26-837Z.json`
- Runtime coverage includes movement/pathfinding, but no melee/ranged combat.
- Performance gate failed on activation p95 (observed 5194ms vs threshold 2100ms).

## 3) Gap Analysis (Intended vs Actual)

### G1. Planner-Executor mismatch for selected actions

- `UtilityScorer` emits `pushing` and `refresh` actions (`src/lib/mest-tactics/ai/core/UtilityScorer.ts:883-988`).
- `AIBattleRunner` decision switch has no `pushing`/`refresh` cases; default marks unsupported (`scripts/ai-battle/AIBattleRunner.ts:3288-3290`).
- Runtime consequence: repeated top-choice waste and no combat progress.

### G2. Side-level coordination architecture exists but is not wired in ai-battle loop

- Side coordinator APIs exist in `GameManager` (`initializeSideCoordinators`, `getSideStrategies`) (`src/lib/mest-tactics/engine/GameManager.ts:816-858`).
- `AIBattleRunner` checks coordinator manager but does not initialize coordinators.
- `AIBattleRunner` AI context does not pass `scoringContext` (`scripts/ai-battle/AIBattleRunner.ts:2756-2772`), while `AIGameLoop` does (`src/lib/mest-tactics/ai/executor/AIGameLoop.ts:725-745`).
- Reported `sideStrategies` are keyed by character with empty advice, not side strategy (`scripts/ai-battle/AIBattleRunner.ts:283-313`).

### G3. AI stack downgraded in runner path

- `AIBattleRunner` instantiates `CharacterAI` with `enablePatterns: false`, `enableGOAP: false` (`scripts/ai-battle/AIBattleRunner.ts:2198-2202`).
- `CharacterAI` has behavior-tree/FSM members initialized but not executed in decision path (only defined/constructed) (`src/lib/mest-tactics/ai/core/CharacterAI.ts:93-94,141-143,192`).
- Practical effect: no side-coherent planning depth and weak tactical chaining.

### G4. Hide/Detect preemption starves combat

- `CharacterAI.decideAction` returns early on hide/detect before utility attack ranking (`src/lib/mest-tactics/ai/core/CharacterAI.ts:254-297`).
- Detect thresholding is permissive and target list is not constrained to best-feasible target first (`src/lib/mest-tactics/ai/tactical/ReactsAndBonusActions.ts:741-829`).
- Runtime shows repeated detect failures and no attack transitions.

### G5. Initiative/activation handling diverges from side-level QSR intent

- `AIBattleRunner` calls `gameManager.startTurn()` without passing `sides` (`scripts/ai-battle/AIBattleRunner.ts:2224`), so coordinator scoring update and side-aware initiative context are not fully engaged in turn start path.
- Activations are then processed by fixed side loop + intra-side INT sort (`scripts/ai-battle/AIBattleRunner.ts:2304-2331`), bypassing `GameManager` activation-order services used in `AIGameLoop`.

### G6. Fractional VP/RP potential exists but is underused in coordinator feed

- Mission runtime updates predicted key scores (`src/lib/mest-tactics/missions/mission-runtime-adapter.ts:760-813`).
- `AIBattleRunner` feeds side coordinator with hand-built pseudo key scores (`scripts/ai-battle/AIBattleRunner.ts:2237-2282`) instead of mission-manager computed `side.state.keyScores`.

## 4) Prioritized Implementation Plan

### Phase P0 (Immediate, 1-2 days): Stop Non-Combat Deadlocks

Goal: Remove no-op loops and restore valid combat-capable action execution.

Tasks:

1. Wire `pushing` and `refresh` execution in ai-battle runner.
2. Prefer shared execution path from `AIActionExecutor` to avoid switch drift.
3. Add regression guard: no `unsupported` action results in battle logs.

Primary files:

- `scripts/ai-battle/AIBattleRunner.ts`
- `src/lib/mest-tactics/ai/executor/AIActionExecutor.ts`
- `src/lib/mest-tactics/engine/GameManager.ts` (existing `executePushing`, `refreshForCharacter` APIs)

Acceptance:

- `unsupported_actions = 0` in `VERY_SMALL` audit runs.
- `pushing` and `refresh` success/failure semantics are explicit and testable.

### Phase P1 (High, 2-4 days): Restore Side-Level God-Mode Coordination

Goal: Make ai-battle use the same side-strategy model as designed.

Tasks:

1. Initialize side coordinators when mission sides are created.
2. Pass `scoringContext` from side coordinator into each `AIContext`.
3. Replace character-keyed `sideStrategies` with side-keyed strategy export.
4. Route turn start scoring-context refresh through mission-side key states, not ad-hoc estimates.

Primary files:

- `scripts/ai-battle/AIBattleRunner.ts`
- `src/lib/mest-tactics/engine/GameManager.ts`
- `src/lib/mest-tactics/ai/core/SideAICoordinator.ts`

Acceptance:

- Battle reports show side-level strategy objects with doctrine + advice + context.
- Character decisions include side context fields when available.

### Phase P2 (High, 3-5 days): Combat-First Action Policy

Goal: Ensure models attack when tactically/legal opportunities exist.

Tasks:

1. Rebalance `CharacterAI` decision order: do not allow hide/detect to preempt attack opportunities unconditionally.
2. Detect feasibility filter: rank hidden targets by detect feasibility (range/LOS/probability), skip impossible first-choice targets.
3. Add anti-stall heuristic: cap consecutive detect/hide chains per activation unless mission-specific stealth objective justifies them.
4. Add explicit "attack intent" uplift in utility when legal attack is available and side is not already winning by safe margin.

Primary files:

- `src/lib/mest-tactics/ai/core/CharacterAI.ts`
- `src/lib/mest-tactics/ai/tactical/ReactsAndBonusActions.ts`
- `src/lib/mest-tactics/ai/core/UtilityScorer.ts`

Acceptance:

- In Elimination `VERY_SMALL` baseline: at least one attack action by Turn 2 under seed suite.
- Detect out-of-range failure rate reduced below 20% of detect attempts.

### Phase P3 (Medium, 4-7 days): Initiative/Activation Fidelity

Goal: Align ai-battle flow with initiative/IP-driven side activation structure.

Tasks:

1. Move ai-battle turn/activation flow toward `GameManager` activation APIs (or reuse `AIGameLoop` execution model).
2. Ensure turn start passes `sides` and mission options to `startTurn`.
3. Validate IP spending (`refresh`, `forceInitiative`) affects next activations as intended.

Primary files:

- `scripts/ai-battle/AIBattleRunner.ts`
- `src/lib/mest-tactics/ai/executor/AIGameLoop.ts`
- `src/lib/mest-tactics/engine/GameManager.ts`

Acceptance:

- Activation order can be explained by initiative state rather than fixed side iteration.
- IP expenditures are reflected in side state and tactical outcomes.

### Phase P4 (Medium, 3-6 days): Fractional VP/RP Potentials and Mission Keys

Goal: Make mission-key fractional scoring the primary strategic signal.

Tasks:

1. Canonical mission-key contract: each mission must declare active keys and scoring model.
2. Feed `side.state.keyScores` from mission runtime directly into side coordinator each turn.
3. Extend utility scoring to use per-key projected deltas (`my delta`, `deny opponent delta`) rather than coarse VP difference only.
4. Add mission-level tests ensuring key-specific actions alter predicted key potentials.

Primary files:

- `src/lib/mest-tactics/missions/mission-runtime-adapter.ts`
- `src/lib/mest-tactics/missions/*-manager.ts`
- `src/lib/mest-tactics/ai/stratagems/PredictedScoringIntegration.ts`
- `src/lib/mest-tactics/ai/core/UtilityScorer.ts`

Acceptance:

- Per-turn report shows non-trivial fractional key potentials by side where mission supports them.
- Mission scans differentiate action profiles by mission keys (no QAI_11-like collapse across missions).

### Phase P5 (Validation, continuous): Metrics Gates and Regression Protection

Goal: Prevent future regressions in combat behavior and planning quality.

Tasks:

1. Add deterministic seed suite (`VERY_SMALL`, `SMALL`) for Elimination + at least two objective missions.
2. Add gates to CI/reporting:
   - Unsupported actions = 0
   - Attack action share >= 20% in Elimination baseline
   - Detect out-of-range failures <= 20% of detect attempts
   - Activation p95 <= configured threshold
   - Runtime coverage includes melee or ranged in combat-centric missions
3. Add "stall detector": fail if no wounds and no key-progress for N turns while actions > 0.

Primary files:

- `scripts/ai-battle/validation/*`
- `scripts/ai-battle/reporting/*`
- `generated/ai-battle-reports/*` (golden baseline snapshots)

## 5) Execution Sequencing and Ownership

Recommended order:

1. P0
2. P1
3. P2
4. P3
5. P4
6. P5 (ongoing from P0 onward)

Rationale:

- P0 removes immediate execution defects.
- P1/P2 restore coherent combat behavior before deeper mission optimization.
- P3/P4 bring full QSR-fidelity turn economy and mission-key planning depth.
- P5 locks gains with repeatable evidence.

## 6) Definition of Done (Combat-Centric AI)

System is considered complete for this strategy when:

1. ai-battle runs produce attack-capable behaviors under Elimination without unsupported-action loops.
2. Side-level strategy context is present and reflected in character decisions.
3. Fractional mission-key potentials are updated every turn and visibly influence action choice.
4. Initiative/IP and activation flow are auditable and QSR-consistent.
5. Validation gates pass across deterministic seed suites for both combat and objective missions.
