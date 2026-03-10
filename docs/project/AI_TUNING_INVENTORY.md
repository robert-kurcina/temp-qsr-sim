# AI Tuning Inventory

Generated on March 10, 2026.

## Category Key Blocks (Human-Discoverable)

Primary tuning file: `src/data/ai_tuning.json`

- `utilityScorer` (17 keys)
  - default utility weights + action mask cache sizing
  - consumed by `src/lib/mest-tactics/ai/core/UtilityScorer.ts`
- `sideCoordinator` (12 keys)
  - target commitment and pressure continuity tuning
  - consumed by `src/lib/mest-tactics/ai/core/SideAICoordinator.ts`
- `actionVpFilter` (30 keys)
  - VP contribution map, urgency multipliers, passive penalties, filter cutoffs
  - consumed by `src/lib/mest-tactics/ai/core/ActionVPFilter.ts`
- `turnHorizon` (4 keys)
  - sudden-death horizon convergence and pressure ramp controls
  - consumed by `src/lib/mest-tactics/ai/core/TurnHorizon.ts`
- `ai_battle_tuning.json` category blocks (6 blocks, 216 leaves)
  - `performance`, `passiveness`, `combatActivity`, `pressureContinuity`, `attackGateTelemetry`, `validationRunner`
  - consumed by `scripts/ai-battle/cli/EnvConfig.ts` via `scripts/ai-battle/cli/EnvGateTuningConfig.ts`
  - `validationRunner` fallbacks consumed by `scripts/ai-battle/validation/ValidationRunner.ts`
- `mission_tuning.json` category blocks (4 blocks, 8 leaves)
  - `aggression`, `sanctuary`, `specialRules`, `heuristicScorer`
  - consumed by `src/lib/mest-tactics/mission/MissionTuningConfig.ts`
  - wired into mission runtime/scoring modules (`mission-scoring`, `mission-keys`, `special-rules`, mission managers)

Externalized tuning so far: **63 core AI keys + 6 AI-battle blocks (216 leaves) + 4 mission blocks (8 leaves)**

## Exact Inventory Artifact

Generated inventory file:

- `generated/inventories/keyword-constant-inventory.json`

Guard commands:

- `npm run tuning:inventory` (regenerates inventory artifact)
- `npm run tuning:guard` (fails if new embedded tuning constants are introduced in `ai-core`, `ai-battle-script`, or `missions` domains)

Scope used for this inventory:

- roots: `src`, `scripts`
- excludes: tests (`**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`)
- match rule: any `const` declaration with one of
  - `weight`, `threshold`, `trigger`, `filter`, `bonus`, `penalty`, `factor`, `multiplier`, `gate`

Current totals from the artifact:

- declarations: **85**
- files: **48**
- AI/battle subset (`ai-core` + `ai-battle-script`): **36 declarations across 15 files**

## Refactor Speed / Token Impact (Estimated)

This improves *tuning iteration speed* rather than runtime performance.

- Runtime effect: near-zero to negligible (single JSON load + object lookups)
- Refactor file-touch reduction for the already-externalized set:
  - from up to 4 code files (`UtilityScorer`, `SideAICoordinator`, `ActionVPFilter`, `TurnHorizon`)
  - to 1 JSON file (`src/data/ai_tuning.json`)
  - approximate file-touch reduction: **75%**
- Token/edit cost estimate for a typical balancing pass of 10 values:
  - before (multi-file code edits): ~500-900 tokens
  - after (single JSON tuning edit): ~120-250 tokens
  - estimated reduction: **~70-80%**

## Next Externalization Priorities

1. Optional: split `ai_battle_tuning.json` by domain if file size starts slowing edits
2. Optional: externalize heuristic scorer weight matrix into mission tuning
3. Optional: externalize additional special-rule defaults (if ruleset expands)
