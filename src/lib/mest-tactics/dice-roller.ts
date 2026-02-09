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
      if (faceValue >= 4) successes = 1;
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

export interface TestDice {
  [DiceType.Base]?: number;
  [DiceType.Modifier]?: number;
  [DiceType.Wild]?: number;
}

export interface PerformTestResult {
  score: number;
  carryOverDice: TestDice;
}

export function performTest(dice: TestDice, attributeValue: number, rolls: number[]): PerformTestResult {
  const allRolls = [...rolls];
  let totalSuccesses = 0;
  const carryOverCounts: TestDice = { base: 0, modifier: 0, wild: 0 };

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
    score: totalSuccesses + attributeValue,
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
    bonusDice?: TestDice;
    penaltyDice?: TestDice;
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

export function mergeTestDice(...pools: (TestDice | undefined)[]): TestDice {
  const merged: TestDice = { base: 0, modifier: 0, wild: 0 };
  for (const pool of pools) {
      if (!pool) continue;
      for (const key in pool) {
          const dieType = key as DiceType;
          merged[dieType] = (merged[dieType] || 0) + (pool[dieType] || 0);
      }
  }
  return merged;
}

export function resolveTest(p1: TestParticipant, p2: TestParticipant, p1Rolls: number[] | null = null, p2Rolls: number[] | null = null): ResolveTestResult {
  let p1Pool: TestDice = { base: 2, modifier: 0, wild: 0 };
  let p2Pool: TestDice = { base: 2, modifier: 0, wild: 0 };

  const p1Bonuses = mergeTestDice(p1.bonusDice, p2.penaltyDice);
  const p2Bonuses = mergeTestDice(p2.bonusDice, p1.penaltyDice);

  p1Pool.base = (p1Pool.base || 0) + (p1Bonuses.base || 0);
  p1Pool.modifier = (p1Pool.modifier || 0) + (p1Bonuses.modifier || 0);
  p1Pool.wild = (p1Pool.wild || 0) + (p1Bonuses.wild || 0);

  p2Pool.base = (p2Pool.base || 0) + (p2Bonuses.base || 0);
  p2Pool.modifier = (p2Pool.modifier || 0) + (p2Bonuses.modifier || 0);
  p2Pool.wild = (p2Pool.wild || 0) + (p2Bonuses.wild || 0);

  const commonBase = Math.min(p1Pool.base || 0, p2Pool.base || 0);
  p1Pool.base = (p1Pool.base || 0) - commonBase;
  p2Pool.base = (p2Pool.base || 0) - commonBase;

  const commonModifier = Math.min(p1Pool.modifier || 0, p2Pool.modifier || 0);
  p1Pool.modifier = (p1Pool.modifier || 0) - commonModifier;
  p2Pool.modifier = (p2Pool.modifier || 0) - commonModifier;

  const commonWild = Math.min(p1Pool.wild || 0, p2Pool.wild || 0);
  p1Pool.wild = (p1Pool.wild || 0) - commonWild;
  p2Pool.wild = (p2Pool.wild || 0) - commonWild;

  const p1TotalDice = (p1Pool.base || 0) + (p1Pool.modifier || 0) + (p1Pool.wild || 0);
  const p2TotalDice = (p2Pool.base || 0) + (p2Pool.modifier || 0) + (p2Pool.wild || 0);

  const p1FinalRolls = p1Rolls ?? roller(p1TotalDice);
  const p2FinalRolls = p2Rolls ?? (p2.isSystemPlayer ? [] : roller(p2TotalDice));

  if (p1FinalRolls.length < p1TotalDice) throw new Error('Not enough dice rolls provided for p1');
  if (!p2.isSystemPlayer && p2FinalRolls.length < p2TotalDice) throw new Error('Not enough dice rolls provided for p2');

  const p1AttributeValue = p1.attributeValue !== undefined ? p1.attributeValue : (p1.character && p1.attribute ? p1.character.finalAttributes[p1.attribute] || 0 : 0);
  const p2AttributeValue = p2.isSystemPlayer ? 2 : (p2.attributeValue !== undefined ? p2.attributeValue : (p2.character && p2.attribute ? p2.character.finalAttributes[p2.attribute] || 0 : 0));

  const p1Result = performTest(p1Pool, p1AttributeValue, p1FinalRolls);
  const p2Result = p2.isSystemPlayer ? { score: p2AttributeValue, carryOverDice: { base: 0, modifier: 0, wild: 0 } } : performTest(p2Pool, p2AttributeValue, p2FinalRolls);

  const p1FinalScore = p1Result.score;
  const p2FinalScore = p2Result.score;

  const scoreDifference = p1FinalScore - p2FinalScore;
  const pass = p1FinalScore >= p2FinalScore;

  return {
    pass,
    score: scoreDifference,
    cascades: pass ? Math.floor(scoreDifference) : 0,
    p1FinalScore,
    p2FinalScore,
    p1Result,
    p2Result,
  };
}
