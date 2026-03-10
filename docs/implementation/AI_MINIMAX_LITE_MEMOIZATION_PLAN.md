# AI Minimax-Lite Planning and Memoization Plan (Draft)

Date: 2026-03-06  
Status: In progress (P0/P1 partial implementation landed)

## 1. Goal

Reduce AI passiveness and improve mission-aware decision quality by adding:

1. A bounded adversarial planner (minimax-lite / beam search).
2. BP-equivalent potential scoring (including deny-opponent potential).
3. Explicit side-level coordination directives.
4. Stronger memoization for repeated spatial/action/planner/coordinator queries.

This document is a planning artifact only.

## 2. Baseline (Current Behavior)

Recent validation and audit runs show passive outcomes:

1. `QAI_11 VERY_SMALL` (2026-03-05T19:00:18Z):
   - `totalActions=62`, `moves=25`, `rangedCombats=0`, `closeCombats=0`, `kos=0`, `eliminations=0`
2. `QAI_11 VERY_SMALL` (2026-03-05T10:34:26Z):
   - `detects=18`, `hides=4`, no combat
   - activation p95 observed `5194ms` (threshold `2100ms`) for that run profile

## 3. Target State

## 3.1 Planning Model

Use a bounded adversarial search at activation level:

1. Generate legal candidate actions via rule masks.
2. Keep top-K candidates (beam).
3. Evaluate short horizon:
   - own action
   - sampled opponent reply
   - optional second own action (depth by game size)
4. Return action with highest expected node value.

## 3.2 Node Evaluator (BP-Equivalent)

Single utility currency for planning:

`NodeScore = +MyVPPotentialDelta - OppVPPotentialDelta + OutOfPlayBPDelta + ExpectedWoundBP - ExpectedSelfLossBP + PatchControlBPDelta`

Where:

1. `OutOfPlayBPDelta = enemy(KO+Eliminated BP) - friendly(KO+Eliminated BP)`
2. `ExpectedWoundBP = P(wound) * 5` (using wound BP value 5)
3. Dice BP constants are used as fast priors for situational modifier valuation (when full probabilistic expansion is too expensive).

## 3.3 Fractional VP Dynamics

Support monotonic key progress by maintaining per-side, per-key progress ledgers:

1. `currentPotential` (monotonic accumulation toward key completion where applicable)
2. `deniedPotential` (opponent potential reduced by actions)
3. `confidence` (stability under foreseeable opponent replies)

This is stricter than current per-turn snapshot recomputation and is intended to match progressive potential semantics.

## 3.4 Spatial Patch Layer

Introduce lightweight tactical patches:

1. Friendly-dominant
2. Enemy-dominant
3. Mixed / contested
4. Scrum
5. Objective-relevant
6. Lane/LOS-dominant

Each patch tracks weighted occupancy (BP), risk, mobility, and key pressure.

## 3.5 Coordinator Decision Instrumentation

Add explicit observability for high-level side AI thinking:

1. Per-turn coordinator decision trace entries with:
   - observations (VP margin, winning/losing keys, top opponent pressure keys, target commitment snapshot)
   - response directives (priority class, strategic advice, focus targets)
2. Trace surfaced in battle reports for replay/debug:
   - side-level strategy context
   - per-turn rationale trail (what was observed, why priority changed, what was directed)
3. Bounded retention to avoid unbounded memory growth.

Primary purpose: make coordinator cognition auditable and diagnose passiveness causes.

## 4. Memoization Audit (Current)

## 4.1 Spatial: Present

1. Battlefield LOS cache exists (terrain-version keyed, bounded): `Battlefield.ts`
2. Pathfinding grid/path caches exist (WeakMap per battlefield, terrain-version invalidation, bounded LRU-like maps): `PathfindingEngine.ts`
3. UtilityScorer per-evaluation session caches exist:
   - cover, visibility, exposure, objective advance, nearest enemy distance, LOS pair
   - strategic path query budget control

## 4.2 Action Filter: Partial

1. Target pruning heuristics exist (`TacticalHeuristics.ts`), including skip rules and cohesion-aware filtering.
2. No dedicated memoized action legality cache across repeated same-state checks.
3. No persistent cache keyed by `(model state, context mask) -> legal action set`.

## 4.3 Planner: Limited

1. GOAP exists but no memoized plan-state cache is used in decision flow.
2. Wait/react forecast rollouts are recalculated per call; no transposition table.
3. `VPPredictionCache` exists as a standalone system but is not actively wired into `UtilityScorer` scoring flow.

## 4.4 Coordinator: Minimal

1. Side coordinator stores scoring context per turn.
2. No persistent cache for:
   - target assignment history
   - scrum continuity
   - stable firelane opportunities
   - per-patch ownership trajectories

## 5. Memoization Plan (Proposed)

## 5.1 Spatial Cache Extensions

1. Patch graph cache keyed by:
   - terrain version
   - coarse model occupancy hash
   - visibility profile
2. LOS/LOF stability cache:
   - pairwise state signatures
   - invalidated by movement crossing threshold or terrain mutation

## 5.2 Action Filter Cache

1. `LegalActionMaskCache` keyed by:
   - actor status tuple (engaged/free, AP/IP, tokens, hidden state)
   - local tactical signature (scrum id, LOS signature, cover state)
2. Returns:
   - valid action set
   - filtered candidate targets
   - invalidation reason flags

## 5.3 Planner Cache

1. Node transposition table:
   - key: compressed tactical state hash
   - value: evaluated score and best action
2. Beam frontier reuse between consecutive friendly activations when local patch state unchanged.
3. Cached opponent reply samples by opponent archetype + patch context.

## 5.4 Coordinator Cache

1. `TargetCommitmentCache`:
   - per side turn: target -> assigned attackers and expected turns-to-neutralize
2. `ScrumContinuityCache`:
   - stable scrum IDs, local BP ratios, disengage risk
3. `LanePressureCache`:
   - stable ranged pressure windows while LOS/cover unchanged

## 6. Focus Fire / Scrum Caching Policy

For the scenario of repeated attacks on a single model:

1. Close combat scrum:
   - cache scrum ID and attacker order while engagement topology is unchanged
   - invalidation: KO/elimination/disengage/base-contact break
2. Ranged focus fire:
   - cache lane viability and expected wound BP while LOS/LOF/cover signatures are unchanged
   - invalidation: attacker or target moves, blocker moves, cover state change, hidden state change

Expected result: less recomputation and more coherent consecutive pressure.

## 7. Performance Budget and Predictions

Predictions assume strict bounded search and cache hit-rate improvements.

1. `VERY_SMALL`:
   - current activation p95 seen from ~106ms to >5s depending on behavior path
   - projected steady-state after bounded planner + caching: `200-450ms`
2. `SMALL/MEDIUM`:
   - projected activation p95: `350-900ms`
3. `LARGE/VERY_LARGE`:
   - projected activation p95: `900-1800ms` with depth/beam caps

Cost deltas:

1. Planner insertion without memoization: +40% to +180%
2. Memoization recovery: -25% to -55% vs uncached planner path

## 8. Predicted Gameplay Benefit

1. Combat action share should rise from near-zero baseline toward meaningful levels in elimination missions.
2. Detect/hide-only loops should drop due to stronger deny/kill potential pressure.
3. Side behavior should become more coherent (focus fire persistence, scrum pressure continuity).
4. Mission differentiation should improve by key-specific potential weighting.

## 9. Will This Ameliorate Coordinator Passiveness?

Yes, if coordinator directives are added as first-class outputs.

Not sufficient:

1. Improving only local utility weights.
2. Improving only pathfinding speed.

Necessary:

1. Side-level target commitments.
2. Patch ownership intents.
3. Deny-opponent potential directives.
4. Directive-aware per-model planner scoring.

## 10. Rollout Phases

1. P0: Instrumentation and cache observability
   - add per-layer cache hit/miss diagnostics and planner budget traces
   - add coordinator high-level observation/response trace instrumentation
2. P1: Action legality masks + patch graph
3. P2: Potential evaluator (BP-equivalent terms)
4. P3: Minimax-lite (depth-2 default, size-aware caps)
5. P4: Coordinator directives + focus-fire/scrum continuity
6. P5: Regression gates and mission-seed benchmark suite

## 10.1 Current Progress Snapshot

Implemented:

1. P0 (partial): action-mask cache observability (hits/misses/bypasses, global counters).
2. P0 (partial): coordinator high-level decision trace in side strategies output.
3. P0 (partial): coordinator turn-level trace snapshots attached to audit turn records.
4. P1 (partial): action legality mask cache in `UtilityScorer`.
5. P4 (partial): target commitment tracking/decay wired through execution loops.
6. P5 (partial): validation regression gates for coordinator trace coverage (run/turn/side).
7. P5 (partial): combat-activity regression gates with mission profiles and turn-horizon guardrails.
8. P5 (partial): passiveness regression gates (detect/hide/wait ratios) with mission/size/density profiles.
9. P5 (partial): validation benchmark calibration utility for deriving threshold suggestions from report sets.
10. P5 (partial): combat-activity threshold derivation upgraded to mission/size/density-aware profiles.
11. P2 (partial): fractional VP/RP potential + denial terms integrated into `UtilityScorer` target/action scoring.
12. P0 (partial): coordinator trace now captures fractional potential snapshot + potential directive classification.
13. P3 (partial): bounded minimax-lite re-ranker (depth<=2, beam caps, opponent reply sampling) integrated in `CharacterAI`.
14. P3 (partial): minimax-lite transposition cache with bounded retention and cache hit/miss instrumentation.
15. P1/P3 (partial): lightweight tactical patch classification (`friendly/enemy/contested/scrum/objective/lane`) now influences minimax node weighting and cache keys.
16. P0/P5 (partial): battle/validation reporting now includes minimax-lite cache telemetry and gate evaluation alongside LOS/path/grid caches.
17. P4 (partial): coordinator continuity caches for scrum (`close_combat`/`charge`) and lane (`ranged_combat`) pressure are tracked/decayed per target and injected into tactical scoring contexts.
18. P3 (partial): minimax transposition keys now include a compact tactical state signature (ally/enemy occupancy, projected engagement pressure, LOS/cover threat bits, objective-control state) instead of enemy-only snapshots.
19. P3 (partial): minimax node evaluation now applies lightweight tactical state transitions (projected wound/out-of-play BP swing, fractional VP/RP pressure, sampled opponent reply simulation, and follow-up simulation blend).
20. P1/P3 (partial): hard legality guards now filter impossible action candidates before final selection in `CharacterAI` and reject invalid strategic/tactical directives in `AIGameLoop` prior to executor dispatch.
21. P3 (partial): opponent reply simulation now includes bounded move+attack projections (projected advance distance, LOS re-check, movement commitment penalty) instead of purely static-distance retaliation scoring.
22. P1 (partial): tactical patch graph cache keyed by terrain version + coarse occupancy hash + visibility profile is now wired into `CharacterAI` patch classification with bounded retention and hit/miss/eviction telemetry in battle/validation reporting.
23. P1 (partial): tactical patch classification now reuses a cached neighborhood bucket graph per tactical state and evaluates exact-distance pressure over neighborhood candidates instead of scanning all units each patch query.
24. P5 (partial): performance gates now include minimax patch-cache hit-rate thresholds/observations/pass status (configurable via `AI_BATTLE_GATE_MINIMAX_PATCH_HIT_MIN`) and surfaced in validation console/human reports.
25. P3 (partial): minimax patch-control delta now blends neighborhood-flow terms (support balance, adjacency control, lane threat score, scrum pressure, objective progress) so topology continuity affects node weighting directly.
26. P4 (partial): coordinator pressure continuity now tracks topology signatures (scrum engagement topology and ranged LOS/cover lane signatures) and applies stability bonuses / signature-break penalties before persisting continuity scores.
27. P0/P5 (partial): pressure continuity diagnostics (scrum/lane/combined signature coverage and break-rate summaries) are now surfaced via side strategy reports and validation aggregates for tuning.
28. P5 (partial): pressure continuity regression gates (runs-with-data, signature coverage, scrum/lane/combined break-rate thresholds) are now evaluated in validation output and honored by `AI_BATTLE_ENFORCE_GATES`.
29. P5 (partial): benchmark calibration utility now emits suggested continuity gate env thresholds (`AI_BATTLE_CONTINUITY_*`) from validation report populations.
30. P2 (partial): side-level per-key fractional potential ledger is now persisted across turns with monotonic key progress + denial accumulation, exposed through coordinator context/trace, and consumed by `UtilityScorer` for VP pressure/urgency.
31. P1/P2 (partial): `VERY_SMALL` elimination-profile evaluations now retain a minimal strategic path-probe budget (instead of zero) to reduce short-horizon movement drift and improve approach-path quality toward engagement.
32. P1/P3 (partial): AI now has an explicit `charge` path end-to-end (utility candidate generation with base-contact destination projection, legality gating in `CharacterAI`/`AIGameLoop`, and executor-level charge move+attack execution with charge-context melee resolution).
33. P1/P2 (partial): long-lane engagement setup now keeps nearest-enemy tactical relevance when all threats are outside visibility range, preserves strategic enemy path probes without immediate LOS, and adds explicit move scoring for distance-closing vs retreat drift.

Pending:

1. Spatial patch graph cache and patch-aware planning (cache baseline is wired; patch graph expansion and broader planner reuse still pending).
2. BP-equivalent potential evaluator completion (ledger weighting/normalization calibration by mission profile and turn horizon still pending).
3. Minimax-lite bounded adversarial planner and transposition table (rules-complete tactical state simulation + patch-aware node expansion pending; lightweight tactical transition simulation + compact state hashing + bounded enemy move+attack reply projection now wired).
4. Coordinator directive caches now include lane/scrum topology signatures, continuity break penalties, diagnostics, and regression gates; remaining work is threshold calibration by mission/size and seed baseline stabilization.
5. Full benchmark/regression gate suite with per-mission/per-size threshold calibration and seed baselines (ongoing tuning).

## 11. Acceptance Gates

1. Unsupported action results remain zero.
2. Combat-capable missions produce attack actions by Turn 2 in baseline seeds.
3. Activation p95 remains under per-size budget.
4. Cache hit-rate thresholds are met for LOS/path/action-mask/transposition caches.
5. Mission-level predicted potential traces show coherent progression and denial effects.
6. Coordinator decision trace is present per turn with valid observation + response payloads.
