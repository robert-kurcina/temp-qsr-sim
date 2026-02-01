
import { metricsService } from './MetricsService';

// --- Core Types --- //

export enum DiceType {
  Modifier = 'Modifier',
  Base = 'Base',
  Wild = 'Wild',
}

export type DicePool = {
  [DiceType.Modifier]?: number;
  [DiceType.Base]?: number;
  [DiceType.Wild]?: number;
};

export interface TestParticipant {
  attributeValue: number;
  bonusDice?: DicePool;
  penaltyDice?: DicePool;
  isSystemPlayer?: boolean;
}

export interface TestResult {
  pass: boolean;
  cascades: number;
  misses: number;
  activePlayerTestScore: number;
  passivePlayerTestScore: number;
  carryOverDice: DicePool;
}

// --- Roller Abstraction for Mocking --- //

/** Defines the signature for a function that can roll a dice pool. */
export type Roller = (pool: DicePool) => number;

/** The default, random roller implementation. */
const _randomRoll: Roller = (pool) => {
  let successes = 0;
  for (const key in pool) {
    const type = key as DiceType;
    for (let i = 0; i < (pool[type] || 0); i++) {
      const value = Math.floor(Math.random() * 6) + 1;
      switch (type) {
        case DiceType.Modifier:
          if (value >= 4) successes += 1;
          break;
        case DiceType.Base:
          if (value >= 4 && value <= 5) successes += 1;
          if (value === 6) successes += 2;
          break;
        case DiceType.Wild:
          if (value >= 4 && value <= 5) successes += 1;
          if (value === 6) successes += 3;
          break;
      }
    }
  }
  return successes;
};

/** The active roller used by the system. Defaults to the random one. */
let activeRoller: Roller = _randomRoll;

/**
 * Sets the active dice roller for the system. Used to inject mocks for testing.
 * @param newRoller The new roller function to use.
 */
export function setRoller(newRoller: Roller) {
  activeRoller = newRoller;
}

/** Resets the active dice roller to the default random implementation. */
export function resetRoller() {
  activeRoller = _randomRoll;
}

// --- Main Test Resolution Logic --- //

export function resolveTest(
  activeParticipant: TestParticipant,
  passiveParticipant: TestParticipant,
  difficultyRating: number = 0,
): TestResult {
  const p1_totalBonus = activeParticipant.bonusDice || {};
  const p2_totalBonus = passiveParticipant.bonusDice || {};
  const p1_totalPenalty = activeParticipant.penaltyDice || {};
  const p2_totalPenalty = passiveParticipant.penaltyDice || {};

  // Cancellation logic
  const p1FinalBonus: DicePool = { ...p1_totalBonus };
  const p2FinalBonus: DicePool = { ...p2_totalBonus };
  for (const key in p1_totalBonus) {
    const type = key as DiceType;
    const p1b = p1FinalBonus[type] || 0;
    const p2p = p2_totalPenalty[type] || 0;
    const cancelCount = Math.min(p1b, p2p);
    p1FinalBonus[type] = p1b - cancelCount;
    p2_totalPenalty[type] = (p2_totalPenalty[type] || 0) - cancelCount;
  }
  for (const key in p2_totalBonus) {
    const type = key as DiceType;
    const p2b = p2FinalBonus[type] || 0;
    const p1p = p1_totalPenalty[type] || 0;
    const cancelCount = Math.min(p2b, p1p);
    p2FinalBonus[type] = p2b - cancelCount;
    p1_totalPenalty[type] = (p1_totalPenalty[type] || 0) - cancelCount;
  }

  const p1Pool: DicePool = { ...p1FinalBonus, [DiceType.Base]: 2 };
  const p2Pool: DicePool = { ...p2FinalBonus, [DiceType.Base]: 2 };

  const p1Successes = activeRoller(p1Pool);
  const p2Successes = activeRoller(p2Pool);

  const activePlayerTestScore = activeParticipant.attributeValue + p1Successes;
  const passiveBaseAttribute = passiveParticipant.isSystemPlayer ? 2 : passiveParticipant.attributeValue;
  const passivePlayerTestScore = passiveBaseAttribute + p2Successes + difficultyRating;
  
  const scoreDifference = activePlayerTestScore - passivePlayerTestScore;

  const pass = scoreDifference >= 0;
  let cascades = 0;
  if (pass) {
    cascades = scoreDifference === 0 ? 1 : scoreDifference;
  }
  const misses = !pass ? Math.abs(scoreDifference) : 0;

  const carryOverDice: DicePool = {};
  if (pass && cascades > 1 && !activeParticipant.isSystemPlayer) {
    carryOverDice[DiceType.Base] = cascades - 1;
  }

  const result: TestResult = {
    pass,
    cascades,
    misses,
    activePlayerTestScore,
    passivePlayerTestScore,
    carryOverDice,
  };

  // Log the event to our new metrics service
  metricsService.logEvent('diceTestResolved', {
    inputs: {
        activeParticipant,
        passiveParticipant,
        difficultyRating
    },
    finalPools: {
        p1FinalBonus,
        p2FinalBonus,
        p1FinalPenalty: p1_totalPenalty,
        p2FinalPenalty: p2_totalPenalty
    },
    result,
  });

  return result;
}
