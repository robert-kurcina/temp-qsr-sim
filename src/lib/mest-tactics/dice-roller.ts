
export enum DieType {
  Base = 'base',
  Modifier = 'modifier',
  Wild = 'wild',
}

export interface RollResult {
  successes: number;
  carryOver: DieType | null;
}

// Simulate a single d6 roll
export function d6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function getDieSuccesses(type: DieType, faceValue: number): RollResult {
  let successes = 0;
  let carryOver: DieType | null = null;

  switch (type) {
    case DieType.Base:
      if (faceValue >= 4) successes = 1;
      if (faceValue === 6) {
        successes = 2;
        carryOver = DieType.Base;
      }
      break;
    case DieType.Modifier:
      if (faceValue >= 4) successes = 1;
      if (faceValue === 6) {
        carryOver = DieType.Modifier;
      }
      break;
    case DieType.Wild:
      if (faceValue >= 4) {
        successes = 1;
        carryOver = DieType.Wild;
      }
      if (faceValue === 6) successes = 3;
      break;
  }

  return { successes, carryOver };
}

export interface TestDice {
  base?: number;
  modifier?: number;
  wild?: number;
}

export interface TestResult {
  score: number;
  carryOverDice: TestDice;
}

export function performTest(dice: TestDice, attributeValue: number, rolls: number[]): TestResult {
  const allRolls = [...rolls];
  let totalSuccesses = 0;
  const carryOverCounts = { base: 0, modifier: 0, wild: 0 };

  const rollAndProcess = (count: number, type: DieType) => {
    for (let i = 0; i < count; i++) {
      const roll = allRolls.shift();
      if (roll === undefined) {
        throw new Error('Not enough dice rolls provided for the test.');
      }
      const result = getDieSuccesses(type, roll);
      totalSuccesses += result.successes;
      if (result.carryOver) {
        carryOverCounts[result.carryOver]++;
      }
    }
  };

  rollAndProcess(dice.base || 0, DieType.Base);
  rollAndProcess(dice.modifier || 0, DieType.Modifier);
  rollAndProcess(dice.wild || 0, DieType.Wild);

  return {
    score: attributeValue + totalSuccesses,
    carryOverDice: {
      base: carryOverCounts.base,
      modifier: carryOverCounts.modifier,
      wild: carryOverCounts.wild,
    },
  };
}
