/**
 * Sudden-death turn-horizon helpers for AI scoring.
 *
 * End-game trigger uses accumulating dice where each die has 50% "safe" odds (4-6).
 * This models uncertainty after trigger turn without tying behavior to hard max-turn caps.
 */

import { aiTuning } from '../config/AITuningConfig';

const turnHorizonTuning = aiTuning.turnHorizon;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function resolvePositiveInteger(value: number | undefined, fallback: number): number {
  if (Number.isFinite(value) && value !== undefined && value > 0) {
    return Math.floor(value);
  }
  return fallback;
}

/**
 * Probability game survives the end-of-turn trigger check for a given die count.
 * Each die is safe on 4-6 => 0.5 survival per die.
 */
export function triggerSurvivalProbabilityForDice(diceCount: number): number {
  const dice = Math.max(0, Math.floor(diceCount));
  return Math.pow(0.5, dice);
}

/**
 * Expected turns remaining INCLUDING current turn under sudden-death trigger.
 *
 * If endGameTurn is omitted, falls back to deterministic max-turn horizon.
 * Max-turn is intentionally ignored when endGameTurn is present, because max-turn
 * is treated as a runtime safety cap rather than tactical planning horizon.
 */
export function estimateExpectedTurnsRemaining(
  currentTurn: number,
  maxTurns?: number,
  endGameTurn?: number
): number {
  const turn = resolvePositiveInteger(currentTurn, 1);
  const max = resolvePositiveInteger(maxTurns, Math.max(turn, turnHorizonTuning.fallbackMaxTurnsFloor));
  const triggerTurn = Number.isFinite(endGameTurn) && (endGameTurn ?? 0) > 0
    ? Math.floor(Number(endGameTurn))
    : undefined;

  if (!triggerTurn) {
    return Math.max(1, max - turn + 1);
  }

  const expectedAtTriggerDice = (startingDice: number): number => {
    let expected = 1; // current turn
    let survivalChain = 1;
    for (let step = 0; step < turnHorizonTuning.expectedSurvivalConvergenceSteps; step += 1) {
      const diceThisStep = startingDice + step;
      survivalChain *= triggerSurvivalProbabilityForDice(diceThisStep);
      expected += survivalChain;
    }
    return expected;
  };

  if (turn < triggerTurn) {
    const guaranteedTurnsBeforeTrigger = triggerTurn - turn;
    return guaranteedTurnsBeforeTrigger + expectedAtTriggerDice(1);
  }

  const startingDice = (turn - triggerTurn) + 1;
  return expectedAtTriggerDice(startingDice);
}

/**
 * Normalized pressure scalar (0..1) from sudden-death dynamics.
 *
 * Before trigger: ramps up gradually toward 0.6.
 * At/after trigger: uses end-this-turn probability, scaled into [0.6, 1.0].
 * Falls back to deterministic turn/maxTurns pressure when no trigger is provided.
 */
export function calculateSuddenDeathTimePressure(
  currentTurn: number,
  maxTurns?: number,
  endGameTurn?: number
): number {
  const turn = resolvePositiveInteger(currentTurn, 1);
  const max = resolvePositiveInteger(maxTurns, Math.max(turn, turnHorizonTuning.fallbackMaxTurnsFloor));
  const triggerTurn = Number.isFinite(endGameTurn) && (endGameTurn ?? 0) > 0
    ? Math.floor(Number(endGameTurn))
    : undefined;

  if (!triggerTurn) {
    return clamp01(turn / Math.max(1, max));
  }

  if (turn < triggerTurn) {
    const preTriggerProgress = (turn - 1) / Math.max(1, triggerTurn - 1);
    return clamp01(preTriggerProgress * turnHorizonTuning.preTriggerPressureCap);
  }

  const diceCount = (turn - triggerTurn) + 1;
  const endThisTurnProbability = 1 - triggerSurvivalProbabilityForDice(diceCount);
  return clamp01(turnHorizonTuning.preTriggerPressureCap + (endThisTurnProbability * turnHorizonTuning.postTriggerPressureRange));
}
