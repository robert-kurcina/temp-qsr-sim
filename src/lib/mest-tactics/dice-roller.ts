
import { TestContext } from "./TestContext";

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

function _roll(pool: DicePool): number {
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
}

export function calculateSituationalModifiers(context: TestContext): { active: { bonus: DicePool, penalty: DicePool }, passive: { bonus: DicePool, penalty: DicePool } } {
  const active = { bonus: {}, penalty: {} };
  const passive = { bonus: {}, penalty: {} };
  if (context.isDefending) {
    passive.bonus[DiceType.Base] = (passive.bonus[DiceType.Base] || 0) + 1;
  }
  return { active, passive };
}

export function resolveTest(
  activeParticipant: TestParticipant,
  passiveParticipant: TestParticipant,
  difficultyRating: number = 0,
  context: TestContext = {},
  p1ScoreOverride?: () => number,
  p2ScoreOverride?: () => number
): TestResult {
  // For simplicity in this example, we assume no situational modifiers.
  const p1_totalBonus = activeParticipant.bonusDice || {};
  const p2_totalBonus = passiveParticipant.bonusDice || {};
  const p1_totalPenalty = activeParticipant.penaltyDice || {};
  const p2_totalPenalty = passiveParticipant.penaltyDice || {};

  const p1FinalBonus: DicePool = { ...p1_totalBonus, ...p2_totalPenalty };
  const p2FinalBonus: DicePool = { ...p2_totalBonus, ...p1_totalPenalty };

  for (const key in p1FinalBonus) {
    const type = key as DiceType;
    const minCount = Math.min(p1FinalBonus[type] || 0, p2FinalBonus[type] || 0);
    p1FinalBonus[type] = (p1FinalBonus[type] || 0) - minCount;
    p2FinalBonus[type] = (p2FinalBonus[type] || 0) - minCount;
  }

  const p1Pool: DicePool = { ...p1FinalBonus, [DiceType.Base]: 2 };
  const p2Pool: DicePool = { ...p2FinalBonus, [DiceType.Base]: 2 };

  const p1Successes = _roll(p1Pool);
  const p2Successes = _roll(p2Pool);

  const activePlayerTestScore = p1ScoreOverride ? p1ScoreOverride() : activeParticipant.attributeValue + p1Successes;

  const passiveBaseAttribute = passiveParticipant.isSystemPlayer ? 2 : passiveParticipant.attributeValue;
  const passivePlayerTestScore = p2ScoreOverride ? p2ScoreOverride() : passiveBaseAttribute + p2Successes + difficultyRating;
  
  const scoreDifference = activePlayerTestScore - passivePlayerTestScore;

  // *** CORRECTED RULE: Attacker wins on a tie. ***
  const pass = scoreDifference >= 0;
  let cascades = 0;
  if (pass) {
    // On a tie, cascades = 1. Otherwise, it's the score difference.
    cascades = scoreDifference === 0 ? 1 : scoreDifference;
  }
  const misses = !pass ? Math.abs(scoreDifference) : 0;

  const carryOverDice: DicePool = {};
  if (pass && cascades > 1 && !activeParticipant.isSystemPlayer) {
    carryOverDice[DiceType.Base] = cascades - 1;
  }

  return {
    pass,
    cascades,
    misses,
    activePlayerTestScore,
    passivePlayerTestScore,
    carryOverDice,
  };
}
