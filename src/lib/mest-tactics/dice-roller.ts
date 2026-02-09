
import { Character } from './Character';

export enum DiceType {
  Base = 'base',
  Modifier = 'modifier',
  Wild = 'wild',
}

export interface RollResult {
  successes: number;
  carryOver: DiceType | null;
}

export type Roller = (diceCount: number) => number[];

let roller: Roller = defaultRoller;

// Simulate a single d6 roll
export function d6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Correctly calculates successes and carry-overs based on the rules.
 * Modifier dice succeed on 4, 5, 6.
 */
export function getDieSuccesses(type: DiceType, faceValue: number): RollResult {
  let successes = 0;
  let carryOver: DiceType | null = null;

  switch (type) {
    case DiceType.Base:
      if (faceValue >= 4) successes = 1;
      if (faceValue === 6) {
        successes = 2;
        carryOver = DiceType.Base;
      }
      break;
    case DiceType.Modifier:
      if (faceValue >= 4) successes = 1; // Corrected: 4, 5, 6 is one success
      if (faceValue === 6) {
        carryOver = DiceType.Modifier;
      }
      break;
    case DiceType.Wild:
      if (faceValue >= 4) {
        successes = 1;
        carryOver = DiceType.Wild;
      }
      if (faceValue === 6) successes = 3;
      break;
  }

  return { successes, carryOver };
}

export interface DicePool {
  [DiceType.Base]?: number;
  [DiceType.Modifier]?: number;
  [DiceType.Wild]?: number;
}

export interface PerformTestResult {
  score: number;
  carryOverDice: DicePool;
}

/**
 * Calculates the score and carry-over dice from a given pool and rolls.
 * This function does not handle attribute values.
 */
export function performTest(dice: DicePool, rolls: number[]): PerformTestResult {
  const allRolls = [...rolls];
  let totalSuccesses = 0;
  const carryOverCounts: DicePool = { base: 0, modifier: 0, wild: 0 };

  const rollAndProcess = (count: number, type: DiceType) => {
    for (let i = 0; i < count; i++) {
      const roll = allRolls.shift();
      if (roll === undefined) {
        throw new Error(`Not enough dice rolls provided for the test. Expected ${count} ${type} rolls, but ran out.`);
      }
      const result = getDieSuccesses(type, roll);
      totalSuccesses += result.successes;
      if (result.carryOver) {
        carryOverCounts[result.carryOver] = (carryOverCounts[result.carryOver] || 0) + 1;
      }
    }
  };

  rollAndProcess(dice.base || 0, DiceType.Base);
  rollAndProcess(dice.modifier || 0, DiceType.Modifier);
  rollAndProcess(dice.wild || 0, DiceType.Wild);

  return {
    score: totalSuccesses,
    carryOverDice: carryOverCounts,
  };
}

function defaultRoller(diceCount: number): number[] {
    return Array.from({ length: diceCount }, d6);
}

export function setRoller(newRoller: Roller) {
    roller = newRoller;
}

export function resetRoller() {
    roller = defaultRoller;
}

export interface TestParticipant {
    character?: Character;
    attributeValue?: number;
    attribute?: keyof Character['finalAttributes'];
    bonusDice?: DicePool;
    penaltyDice?: DicePool;
    isSystemPlayer?: boolean; // For Unopposed tests
}

export interface ResolveTestResult {
  score: number; // Final difference between p1 and p2 scores
  p1FinalScore: number;
  p2FinalScore: number;
  cascades: number;
  p1Result: PerformTestResult;
  p2Result: PerformTestResult;
  pass: boolean;
}

export function mergeDicePools(...pools: (DicePool | undefined)[]): DicePool {
  const merged: DicePool = { base: 0, modifier: 0, wild: 0 };
  for (const pool of pools) {
      if (!pool) continue;
      for (const key in pool) {
          const dieType = key as DiceType;
          merged[dieType] = (merged[dieType] || 0) + (pool[dieType] || 0);
      }
  }
  return merged;
}

/**
 * Rewritten resolveTest function to correctly implement game rules.
 */
export function resolveTest(p1: TestParticipant, p2: TestParticipant, p1Rolls: number[] | null = null, p2Rolls: number[] | null = null): ResolveTestResult {
  // 1. Initialize dice pools. Each player starts with 2 base dice.
  const p1Pool: DicePool = { base: 2, modifier: 0, wild: 0 };
  const p2Pool: DicePool = { base: 2, modifier: 0, wild: 0 };

  // 2. Apply bonuses and penalties. Penalties for one are bonuses for the other.
  const p1Bonuses = mergeDicePools(p1.bonusDice, p2.penaltyDice);
  const p2Bonuses = mergeDicePools(p2.bonusDice, p1.penaltyDice);

  p1Pool.base = (p1Pool.base || 0) + (p1Bonuses.base || 0);
  p1Pool.modifier = (p1Pool.modifier || 0) + (p1Bonuses.modifier || 0);
  p1Pool.wild = (p1Pool.wild || 0) + (p1Bonuses.wild || 0);

  p2Pool.base = (p2Pool.base || 0) + (p2Bonuses.base || 0);
  p2Pool.modifier = (p2Pool.modifier || 0) + (p2Bonuses.modifier || 0);
  p2Pool.wild = (p2Pool.wild || 0) + (p2Bonuses.wild || 0);

  // 3. Flatten dice pools (except for the core 2 base dice).
  const flattenableP1Base = Math.max(0, (p1Pool.base || 0) - 2);
  const flattenableP2Base = Math.max(0, (p2Pool.base || 0) - 2);
  const commonBase = Math.min(flattenableP1Base, flattenableP2Base);
  p1Pool.base = (p1Pool.base || 0) - commonBase;
  p2Pool.base = (p2Pool.base || 0) - commonBase;

  const commonModifier = Math.min(p1Pool.modifier || 0, p2Pool.modifier || 0);
  p1Pool.modifier = (p1Pool.modifier || 0) - commonModifier;
  p2Pool.modifier = (p2Pool.modifier || 0) - commonModifier;

  const commonWild = Math.min(p1Pool.wild || 0, p2Pool.wild || 0);
  p1Pool.wild = (p1Pool.wild || 0) - commonWild;
  p2Pool.wild = (p2Pool.wild || 0) - commonWild;

  // 4. Determine rolls
  const p1TotalDice = (p1Pool.base || 0) + (p1Pool.modifier || 0) + (p1Pool.wild || 0);
  const p2TotalDice = (p2Pool.base || 0) + (p2Pool.modifier || 0) + (p2Pool.wild || 0);

  const p1FinalRolls = p1Rolls ?? roller(p1TotalDice);
  const p2FinalRolls = p2Rolls ?? (p2.isSystemPlayer ? [] : roller(p2TotalDice));

  if (p1FinalRolls.length < p1TotalDice) throw new Error('Not enough dice rolls provided for p1');
  if (!p2.isSystemPlayer && p2FinalRolls.length < p2TotalDice) throw new Error('Not enough dice rolls provided for p2');

  // 5. Perform the test by rolling dice and getting successes
  const p1Result = performTest(p1Pool, p1FinalRolls);
  const p2Result = p2.isSystemPlayer ? { score: 0, carryOverDice: {} } : performTest(p2Pool, p2FinalRolls);

  // 6. Calculate final score by adding attribute values.
  const p1AttributeValue = p1.attributeValue !== undefined ? p1.attributeValue : (p1.character && p1.attribute ? p1.character.finalAttributes[p1.attribute] || 0 : 0);
  const p2AttributeValue = p2.isSystemPlayer ? 2 : (p2.attributeValue !== undefined ? p2.attributeValue : (p2.character && p2.attribute ? p2.character.finalAttributes[p2.attribute] || 0 : 0));
  
  const p1FinalScore = p1Result.score + p1AttributeValue;
  const p2FinalScore = p2Result.score + p2AttributeValue;

  const scoreDifference = p1FinalScore - p2FinalScore;
  const pass = p1FinalScore >= p2FinalScore;

  return {
    pass,
    score: scoreDifference,
    cascades: pass ? scoreDifference : 0,
    p1FinalScore,
    p2FinalScore,
    p1Result,
    p2Result,
  };
}
