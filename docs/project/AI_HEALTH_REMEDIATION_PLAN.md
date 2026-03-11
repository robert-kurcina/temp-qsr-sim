# AI Health Remediation Plan

Updated: March 11, 2026 (validation refresh: 08:31 UTC).

## Scope

Track and remediate AI system health across:

- unit test integrity
- TypeScript type safety (`tsc --noEmit`)
- decoupling and modularization
- redundancy reduction
- runtime efficiency and validation gate stability

## Current Baseline (March 11, 2026)

- `npx vitest --run`: pass (`237` files, `2679` tests)
- `npx tsc --noEmit`: pass
- Validation profile (`QAI_11`, `VERY_SMALL`, density `50`, seed `424242`): all gates passing
  - performance
  - coordinator trace
  - pressure continuity
  - combat activity
  - passiveness
  - attack-gate telemetry
  - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T08-31-24-033Z.json`

## Status Bands

- `green`: verified and stable
- `amber`: working but structurally risky (high coupling/size/redundancy)
- `red`: failing checks or known regression risk requiring immediate fix

## Current Health Matrix

- unit tests: `green`
- type-check: `green`
- efficiency/runtime gates: `green`
- decoupling/modularization: `amber`
  - large core modules still present (notably `UtilityScorer.ts`, `CharacterAI.ts`)
- redundancy: `amber`
  - major threat/loadout duplication removed, but additional repeated scoring patterns remain

## Progress Log

### Completed (March 11, 2026)

1. Minimax cache key/signature extraction
   - `CharacterAI` minimax key/state-signature logic moved to:
     - `src/lib/mest-tactics/ai/core/MinimaxCacheKey.ts`
2. Threat/loadout deduplication
   - shared classifier added:
     - `src/lib/mest-tactics/ai/shared/ThreatProfileSupport.ts`
   - `CharacterAI` and `UtilityScorer` now consume shared threat/loadout logic
3. UtilityScorer action-mask/session extraction
   - action legality mask keying/computation and evaluation session builders moved to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerSessionSupport.ts`
4. UtilityScorer pressure/survival extraction
   - fractional VP/RP pressure and conditional survival helpers moved to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerPressureSupport.ts`
   - `UtilityScorer.ts` now delegates to support modules for:
     - action-mask/session concerns
     - fractional scoring potential calculations
     - out-of-play risk and conditional survival factors
5. UtilityScorer target/action pressure extraction
   - moved helper logic from `UtilityScorer.ts` to `UtilityScorerPressureSupport.ts`:
     - enemy out-of-play pressure helper
     - target VP/RP pressure breakdown helper
     - action fractional VP/RP scoring helper
   - `UtilityScorer.ts` now delegates to support implementations for these scoring primitives
6. UtilityScorer position-helper extraction (cover/exposure cluster)
   - moved position-scoring helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerPositionSupport.ts`
   - extracted helpers:
     - cover scoring
     - lean opportunity scoring
     - cover-edge detection
     - exposure risk scoring
     - enemy sight-line counting
     - threat relief scoring
   - `UtilityScorer.ts` now delegates to support implementations for this cluster
7. UtilityScorer action post-processing extraction
   - moved action post-processing helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts`
   - extracted helpers:
     - elimination approach pressure adjustments
     - VP urgency filter/scoring adjustments
     - fractional VP/RP scoring adjustments
   - `UtilityScorer.ts` now delegates to support implementations for this action-scoring cluster
8. UtilityScorer push/refresh action builder extraction
   - moved large inline evaluate-actions blocks from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts`
   - extracted helpers:
     - `buildPushingAction(...)`
     - `buildRefreshAction(...)`
   - `UtilityScorer.ts` now delegates pushing/refresh scoring construction to support helpers
9. UtilityScorer wait action builder extraction
   - moved large inline wait-scoring block from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts`
   - extracted helper:
     - `buildWaitAction(...)`
   - `UtilityScorer.ts` now delegates wait branch rollout/baseline scoring construction to support helper
10. UtilityScorer attack action builder extraction
   - moved large inline attack candidate scoring loop from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts`
   - extracted helper:
     - `buildAttackActions(...)`
   - `UtilityScorer.ts` now delegates close-combat / charge / ranged candidate assembly to support helper
11. UtilityScorer movement action builder extraction
   - moved large inline movement scoring block from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts`
   - extracted helper:
     - `buildMoveActions(...)`
   - `UtilityScorer.ts` now delegates move candidate scoring assembly to support helper
12. UtilityScorer non-combat action cluster extraction
   - moved objective/disengage/support/weapon-swap orchestration from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts`
   - extracted helper:
     - `appendAuxiliaryActions(...)`
   - `UtilityScorer.ts` now delegates this non-combat action cluster to support helper
13. UtilityScorer modifier-stack + finalization-tail extraction
   - moved doctrine/scoring modifier orchestration and end-stage action finalization from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts`
   - extracted helpers:
     - `applyDoctrineScoringModifiers(...)`
     - `finalizeActionScores(...)`
   - `UtilityScorer.ts` now delegates:
     - stratagem + predicted-scoring modifier application
     - fallback hold insertion
     - VP urgency/fractional scoring finalization
14. UtilityScorer modifier+tempo orchestration extraction
   - moved post-modifier sequencing from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts`
   - extracted helper:
     - `applyModifiersAndAppendTempoActions(...)`
   - `UtilityScorer.ts` now delegates:
     - modifier application + ordering
     - pushing/refresh insertion sequencing
15. UtilityScorer target orchestration extraction
   - moved target-evaluation orchestration from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerTargetSupport.ts`
   - extracted helpers:
     - `buildAllyTargetCounts(...)`
     - `evaluatePrioritizedTargets(...)`
   - `UtilityScorer.ts` now delegates:
     - focus-fire ally target count construction
     - cohesion-prioritized target traversal and pruning orchestration
16. UtilityScorer single-target score assembly extraction
   - moved single-target score/factor composition from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerTargetSupport.ts`
   - extracted helper:
     - `evaluateSingleTargetScore(...)`
   - `UtilityScorer.ts` now delegates:
     - target factor assembly (health/threat/distance/visibility/mission)
     - focus-fire/pressure bonus composition and final score calculation
17. UtilityScorer target primitive scorer extraction
   - moved primitive target scoring helpers from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerTargetSupport.ts`
   - extracted helpers:
     - `evaluateTargetHealthScore(...)`
     - `evaluateTargetThreatScore(...)`
     - `evaluateTargetDistanceScore(...)`
   - `UtilityScorer.ts` now delegates these primitive target scoring computations to support helpers
18. UtilityScorer mission-priority + ROF target-value composition extraction
   - moved mission-priority and ROF target-value composition from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerTargetSupport.ts`
   - extracted helpers:
     - `evaluateMissionPriorityScore(...)`
     - `evaluateROFTargetValueScore(...)`
   - `UtilityScorer.ts` now delegates this target-composition logic to support helpers
19. UtilityScorer jump-down + threat-immediacy bonus composition extraction
   - moved jump-down bonus and threat-immediacy bonus composition to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerTargetSupport.ts`
   - extracted helpers:
     - `evaluateJumpDownBonusScore(...)`
     - `evaluateThreatImmediacyBonusScore(...)`
   - `UtilityScorer.ts` now delegates jump-down bonus composition to target support helper
20. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T06-12-10-718Z.json`
21. UtilityScorer support + weapon-swap candidate extraction
   - moved support/weapon-swap candidate builders from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts`
   - extracted helpers:
     - `evaluateSupportActionCandidates(...)`
     - `evaluateWeaponSwapActionCandidates(...)`
   - `UtilityScorer.ts` now delegates:
     - rally/revive candidate construction
     - weapon-swap (fiddle/unstow) candidate construction
   - removed duplicate item/hand-distance helper cluster from `UtilityScorer.ts`
22. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T06-29-02-993Z.json`
23. UtilityScorer charge/ranged opportunity extraction
   - moved charge/ranged opportunity geometry from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerCombatSupport.ts`
   - extracted helpers:
     - `evaluateChargeOpportunity(...)`
     - `estimateChargeMovementAllowance(...)`
     - `evaluateRangedOpportunity(...)`
   - `UtilityScorer.ts` now delegates:
     - charge opportunity evaluation to combat support helper
     - ranged opportunity evaluation to combat support helper (retaining LOS callback/cache usage)
24. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T06-45-50-892Z.json`
25. UtilityScorer ROF/suppression position helper extraction
   - moved ROF/suppression position helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerPositionSupport.ts`
   - extracted helpers:
     - `evaluatePositionSafetyFromROF(...)`
     - `evaluateSuppressionZoneControlAtPosition(...)`
   - `UtilityScorer.ts` now delegates:
     - ROF/suppression position safety scoring
     - suppression zone control scoring
26. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T06-50-46-846Z.json`
27. UtilityScorer ranged in-range helper extraction
   - moved ranged distance/visibility in-range helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerCombatSupport.ts`
   - extracted helper:
     - `isRangedTargetInRange(...)`
   - `UtilityScorer.ts` now delegates:
     - `isInRange(...)` to combat support helper (retaining LOS callback/cache usage)
   - removed now-redundant `getRangedWeapons(...)` helper from `UtilityScorer.ts`
28. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T06-54-59-324Z.json`
29. UtilityScorer LOS helper extraction
   - moved LOS helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerSessionSupport.ts`
   - extracted helpers:
     - `hasCharacterLineOfSight(...)`
     - `hasPositionLineOfSight(...)`
   - `UtilityScorer.ts` now delegates:
     - `hasLOS(...)` to session support helper
     - `hasLineOfSightBetweenPositions(...)` to session support helper
30. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T07-12-10-794Z.json`
31. UtilityScorer doctrine/mission-bias helper extraction
   - moved doctrine and mission bias helpers from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerDoctrineSupport.ts`
   - extracted helpers:
     - `getDoctrinePlanning(...)`
     - `getDoctrineEngagement(...)`
     - `getMissionBias(...)`
   - `UtilityScorer.ts` now delegates doctrine and mission-bias resolution to support helper
32. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T07-17-53-500Z.json`
33. UtilityScorer melee trait/AP-cost helper extraction
   - moved melee trait/AP-cost helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerMeleeSupport.ts`
   - extracted helpers:
     - `getMeleeWeapons(...)`
     - `hasChargeTraitMeleeWeapon(...)`
     - `estimateMeleeAttackApCost(...)`
   - `UtilityScorer.ts` now delegates this melee helper cluster to support helper
34. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T07-28-38-854Z.json`
35. UtilityScorer strategic path sampling + dedupe extraction
   - moved strategic path sampling + dedupe helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerStrategicPathSupport.ts`
   - extracted helpers:
     - `sampleStrategicPositions(...)`
     - `snapToBoardCell(...)`
     - `dedupePositions(...)`
   - `UtilityScorer.ts` now delegates this strategic movement sampling cluster to support helper
36. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T07-35-37-239Z.json`
37. UtilityScorer bonus-action geometry/tactical scoring extraction
   - moved bonus-action geometry/tactical scoring helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerBonusActionSupport.ts`
   - extracted helpers:
     - `evaluateBonusActions(...)`
     - `evaluateJumpDownAttack(...)`
     - `evaluatePushOffLedge(...)`
     - `evaluateGapCrossing(...)`
   - `UtilityScorer.ts` now delegates this bonus-action geometry/tactical scoring cluster to support helper
38. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T07-48-04-117Z.json`
39. UtilityScorer local melee advantage/flanking extraction
   - moved local melee advantage/flanking helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerMeleeSupport.ts`
   - extracted helpers:
     - `countFriendlyInMeleeRange(...)`
     - `countEnemyInMeleeRange(...)`
     - `evaluateOutnumberAdvantage(...)`
     - `evaluateFlankingPosition(...)`
   - `UtilityScorer.ts` now delegates this local melee advantage/flanking cluster to support helper
40. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T08-02-27-400Z.json`
41. UtilityScorer objective-marker interaction/advance extraction
   - moved objective-marker interaction/advance helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerObjectiveSupport.ts`
   - extracted helpers:
     - `getInteractableObjectiveMarkers(...)`
     - `evaluateObjectiveMarkerActions(...)`
     - `evaluateObjectiveAdvance(...)`
   - `UtilityScorer.ts` now delegates this objective-marker interaction/advance cluster to support helper
42. UtilityScorer wait tactical-condition extraction
   - moved wait tactical-condition helper logic from `UtilityScorer.ts` to:
     - `src/lib/mest-tactics/ai/core/UtilityScorerWaitSupport.ts`
   - extracted helper:
     - `evaluateWaitTacticalConditions(...)`
   - `UtilityScorer.ts` now delegates this wait tactical-condition cluster to support helper
43. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`236` files, `2675` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T08-11-30-261Z.json`
44. Verification snapshot refresh
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`237` files, `2679` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T08-15-10-003Z.json`
45. AI module guardrail checks (module size + duplicate helper detection)
   - added `scripts/ai-tuning/AIModuleGuardrails.test.ts` with enforced checks for:
     - line-count budgets for high-coupling AI modules (`UtilityScorer`, `CharacterAI`, support modules)
     - thin-wrapper guard on extracted `UtilityScorer` delegation methods (prevents helper re-embedding)
     - duplicate exported helper-name detection across AI support modules
     - duplicate substantial helper-body fingerprint detection across AI support modules
   - added direct run script:
     - `npm run tuning:guard:modules`
46. Verification snapshot refresh
   - `npm run tuning:guard:modules`: pass (`1` file, `4` tests)
   - `npx tsc --noEmit`: pass
   - `npx vitest --run`: pass (`237` files, `2679` tests)
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T08-27-18-971Z.json`
47. Added consolidated AI health gate command
   - added npm script:
     - `npm run ai:health:gate`
   - command sequence:
     - `npx tsc --noEmit`
     - `npm run tuning:guard:modules`
     - `npx tsx scripts/ai-battle-setup.ts --validate VERY_SMALL 50 1 424242`
48. Verification snapshot refresh
   - `npm run ai:health:gate`: pass
   - validation profile pass:
     - report: `generated/ai-battle-reports/qai-11-validation-2026-03-11T08-31-24-033Z.json`

## Priority Backlog (Amber -> Green)

1. Extract UtilityScorer domain helpers
   - status: `completed` (session/mask + pressure/survival + target/action pressure + position cover/exposure + action post-processing + push/refresh + wait + attack + movement + non-combat cluster + modifier/finalization tail + modifier/tempo orchestration + target orchestration + single-target score assembly + target primitive scorer + mission/ROF target composition + jump-down/threat-immediacy bonus composition + support/weapon-swap candidate builders + charge/ranged opportunity helpers + ROF/suppression position helpers + ranged in-range helper + LOS helpers + doctrine/mission-bias helpers + melee trait/AP-cost helpers + strategic path sampling/dedupe helpers + bonus-action geometry/tactical scoring cluster + local melee advantage/flanking cluster + objective-marker interaction/advance cluster + wait tactical-condition cluster extracted)
   - remaining extraction slices (estimated `0`): none
2. Consolidate threat/loadout classification into shared helper(s) (`completed`)
   - remove duplicate ranged/melee classification logic
3. Isolate cache/key/state-signature helpers from decision engines (`completed`)
   - keep behavior-identical, reduce class surface area
4. Add guardrail checks for module size and duplicate helper detection (`completed`)
   - `scripts/ai-tuning/AIModuleGuardrails.test.ts`
   - `npm run tuning:guard:modules`
5. Add consolidated AI health gate command (`completed`)
   - `npm run ai:health:gate`
6. TODO: side-level Support weapon assignment (`pending`, deferred sequencing)
   - policy: Support-class weapons are not assigned to individual model loadouts
   - sequencing: schedule after 2D UX stabilization and before 3D terrain/asset implementation
   - next implementation slice:
     - add side asset selection phase during battle setup/assembly creation
     - assign Support weapons to `Side` inventory/pool (not `Character.items`)
     - define side-level usage rules (crew/emplacement eligibility, placement, activation ownership)
     - keep assignment disabled until side-asset execution path is implemented and validated

## Acceptance Criteria Per Change

Each remediation change must preserve:

- `npx tsc --noEmit` pass
- `npx vitest --run` pass
- validation profile gate pass (`QAI_11`, `VERY_SMALL`, density `50`)

If any criterion regresses, change is rolled back or corrected before merge.
