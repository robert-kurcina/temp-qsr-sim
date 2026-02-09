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
      if (faceValue >= 5) successes = 1;
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

export function performTest(dice: DicePool, rolls: number[] | number): PerformTestResult {
  const allRolls = Array.isArray(rolls) ? [...rolls] : [rolls];
  let totalSuccesses = 0;
  const carryOverCounts: DicePool = { base: 0, modifier: 0, wild: 0 };

  const rollAndProcess = (count: number, type: DiceType) => {
    for (let i = 0; i < count; i++) {
      const roll = allRolls.shift();
      if (roll === undefined) {
        throw new Error('Not enough dice rolls provided for the test.');
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
    carryOverDice: {
      base: carryOverCounts.base,
      modifier: carryOverCounts.modifier,
      wild: carryOverCounts.wild,
    },
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
  attributeValue: number;
  bonusDice?: DicePool;
  penaltyDice?: DicePool;
}

export interface ResolveTestResult {
  score: number;
  p1Misses: number;
  p2Misses: number;
  p1Result: PerformTestResult;
  p2Result: PerformTestResult;
  pass: boolean;
}

export function mergeDicePools(...pools: (DicePool | undefined)[]): DicePool {
  const merged: DicePool = {};
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
  console.log('--- resolveTest START ---');
  console.log('p1 participant:', JSON.stringify(p1, null, 2));
  console.log('p2 participant:', JSON.stringify(p2, null, 2));

  // Combine participant penalties with opponent bonuses for the final dice pool calculation
  const p1Dice: DicePool = {
      [DiceType.Base]: p1.attributeValue + (p1.bonusDice?.[DiceType.Base] || 0) - (p1.penaltyDice?.[DiceType.Base] || 0),
      [DiceType.Modifier]: (p1.bonusDice?.[DiceType.Modifier] || 0) - (p1.penaltyDice?.[DiceType.Modifier] || 0),
      [DiceType.Wild]: (p1.bonusDice?.[DiceType.Wild] || 0) - (p1.penaltyDice?.[DiceType.Wild] || 0),
  };

  const p2Dice: DicePool = {
      [DiceType.Base]: p2.attributeValue + (p2.bonusDice?.[DiceType.Base] || 0) - (p2.penaltyDice?.[DiceType.Base] || 0),
      [DiceType.Modifier]: (p2.bonusDice?.[DiceType.Modifier] || 0) - (p2.penaltyDice?.[DiceType.Modifier] || 0),
      [DiceType.Wild]: (p2.bonusDice?.[DiceType.Wild] || 0) - (p2.penaltyDice?.[DiceType.Wild] || 0),
  };

  console.log('p1 calculated dice pool:', JSON.stringify(p1Dice, null, 2));
  console.log('p2 calculated dice pool:', JSON.stringify(p2Dice, null, 2));

  const p1TotalDice = Math.max(0, Object.values(p1Dice).reduce((a, b) => a + b, 0));
  const p2TotalDice = Math.max(0, Object.values(p2Dice).reduce((a, b) => a + b, 0));

  let p1FinalRolls: number[];
  let p2FinalRolls: number[];

  if (p1Rolls && p2Rolls) {
    p1FinalRolls = p1Rolls;
    p2FinalRolls = p2Rolls;
  } else if (p1Rolls && !p2Rolls) {
    p1FinalRolls = p1Rolls;
    p2FinalRolls = roller(p2TotalDice);
  } else if (!p1Rolls && p2Rolls) {
    p1FinalRolls = roller(p1TotalDice);
    p2FinalRolls = p2Rolls;
  } else {
    const allRolls = roller(p1TotalDice + p2TotalDice);
    p1FinalRolls = allRolls.slice(0, p1TotalDice);
    p2FinalRolls = allRolls.slice(p1TotalDice, p1TotalDice + p2TotalDice);
  }

  console.log('p1 rolls:', JSON.stringify(p1FinalRolls));
  console.log('p2 rolls:', JSON.stringify(p2FinalRolls));

  const p1Result = performTest(p1Dice, p1FinalRolls);
  const p2Result = performTest(p2Dice, p2FinalRolls);

  console.log('p1Result from performTest:', JSON.stringify(p1Result, null, 2));
  console.log('p2Result from performTest:', JSON.stringify(p2Result, null, 2));

  const score = p1Result.score - p2Result.score;

  console.log(`p1Score (dice successes): ${p1Result.score}`);
  console.log(`p2Score (dice successes): ${p2Result.score}`);
  console.log(`Final score (p1 - p2): ${score}`);
  console.log(`Pass (score > 0): ${score > 0}`);
  console.log('--- resolveTest END ---');

  const p1RollsArray = Array.isArray(p1FinalRolls) ? p1FinalRolls : [p1FinalRolls];
  const p2RollsArray = Array.isArray(p2FinalRolls) ? p2FinalRolls : [p2FinalRolls];

  const p1Misses = p1RollsArray.filter(r => r < 4).length;
  const p2Misses = p2RollsArray.filter(r => r < 4).length;

  return {
      score,
      p1Misses,
      p2Misses,
      p1Result,
      p2Result,
      pass: score > 0,
  };
}
