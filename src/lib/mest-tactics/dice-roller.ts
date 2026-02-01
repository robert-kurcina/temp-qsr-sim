
import { TestContext } from "./TestContext";

/**
 * This file contains the complete logic for resolving a "Test" in MEST Tactics,
 * as per the provided rulebook section.
 */

/**
 * The types of dice available in the MEST Tactics system.
 */
export enum DiceType {
  Modifier = 'Modifier',
  Base = 'Base',
  Wild = 'Wild',
}

/**
 * Represents a pool of dice, used for bonuses, penalties, and carry-overs.
 * The key is the type of die, and the value is the number of that die.
 */
export type DicePool = {
  [DiceType.Modifier]?: number;
  [DiceType.Base]?: number;
  [DiceType.Wild]?: number;
};

/**
 * Represents the different types of dice modifications.
 */
export type DiceMods = {
  bonus: DicePool;
  penalty: DicePool;
}

/**
 * Defines the state and inputs for a single participant in a Test.
 */
export interface TestParticipant {
  attributeValue: number;
  bonusDice?: DicePool;
  penaltyDice?: DicePool;
  isSystemPlayer?: boolean; // The "System" player never receives carry-overs.
}

/**
 * The final, resolved outcome of a Test, containing all necessary information.
 */
export interface TestResult {
  pass: boolean;
  cascades: number; // If pass is true, this is the margin of success (min 1).
  misses: number; // If pass is false, this is the margin of failure.
  activePlayerTestScore: number;
  passivePlayerTestScore: number;
  carryOverDice: DicePool; // Dice for the Active Player's next test in the action.
}

/**
 * Represents a single die that was rolled, capturing its type and face value.
 * This is used internally to determine successes and carry-overs.
 */
interface RolledDie {
  type: DiceType;
  value: number;
}

/**
 * Internal helper to roll a single die and calculate its successes based on type.
 * @param type The type of die to roll.
 * @returns The face value and the number of successes generated.
 */
function rollAndScoreDie(type: DiceType): { value: number; successes: number } {
  const value = Math.floor(Math.random() * 6) + 1;
  let successes = 0;

  switch (type) {
    case DiceType.Modifier:
      if (value >= 4) successes = 1;
      break;
    case DiceType.Base:
      if (value >= 4 && value <= 5) successes = 1;
      if (value === 6) successes = 2;
      break;
    case DiceType.Wild:
      if (value >= 4 && value <= 5) successes = 1;
      if (value === 6) successes = 3;
      break;
  }
  return { value, successes };
}

/**
 * Calculates the situational bonus and penalty dice for both participants based on the TestContext.
 * @param context The situational context of the test.
 * @returns An object containing the DiceMods for both the active and passive participants.
 */
export function calculateSituationalModifiers(context: TestContext): { active: DiceMods, passive: DiceMods } {
  const active: DiceMods = { bonus: {}, penalty: {} };
  const passive: DiceMods = { bonus: {}, penalty: {} };

  // --- Action & Choice Modifiers ---
  if (context.isCharge) {
    active.bonus[DiceType.Modifier] = (active.bonus[DiceType.Modifier] || 0) + 1;
  }
  if (context.isDefending) {
    // This bonus applies to the defender (passive player)
    passive.bonus[DiceType.Base] = (passive.bonus[DiceType.Base] || 0) + 1;
  }
  if (context.isOverreach) {
    active.penalty[DiceType.Modifier] = (active.penalty[DiceType.Modifier] || 0) + 1;
  }
  if (context.isSudden) {
    active.bonus[DiceType.Modifier] = (active.bonus[DiceType.Modifier] || 0) + 1;
  }
  if (context.isConcentrating) {
    active.bonus[DiceType.Wild] = (active.bonus[DiceType.Wild] || 0) + 1;
  }
  if (context.isFocusing) {
    active.bonus[DiceType.Wild] = (active.bonus[DiceType.Wild] || 0) + 1;
  }
  if (context.isBlindAttack) {
    active.penalty[DiceType.Wild] = (active.penalty[DiceType.Wild] || 0) + 1;
  }

  return { active, passive };
}

/**
 * Resolves a MEST Tactics Test between an Active and a Passive player.
 * This function implements the full sequence of assigning, flattening, rolling, and scoring dice.
 * @param activeParticipant The character performing the action.
 * @param passiveParticipant The character or System being acted against.
 * @param difficultyRating An optional modifier added to the passive player's final score.
 * @returns A TestResult object summarizing the outcome.
 */
export function resolveTest(
  activeParticipant: TestParticipant,
  passiveParticipant: TestParticipant,
  difficultyRating: number = 0,
  context: TestContext = {},
): TestResult {
  const situationalMods = calculateSituationalModifiers(context);

  // 1. Assign Bonuses and Penalties
  const p1_inherentBonus = { ...(activeParticipant.bonusDice || {}) };
  const p2_inherentBonus = { ...(passiveParticipant.bonusDice || {}) };

  const p1_inherentPenalty = { ...(activeParticipant.penaltyDice || {}) };
  const p2_inherentPenalty = { ...(passiveParticipant.penaltyDice || {}) };

  // Combine inherent and situational mods
  const p1_totalBonus = { ...p1_inherentBonus, ...situationalMods.active.bonus };
  const p2_totalBonus = { ...p2_inherentBonus, ...situationalMods.passive.bonus };
  const p1_totalPenalty = { ...p1_inherentPenalty, ...situationalMods.active.penalty };
  const p2_totalPenalty = { ...p2_inherentPenalty, ...situationalMods.passive.penalty };

  // A player's final bonus pool is their total bonus dice plus their opponent's total penalty dice.
  const p1BonusPool: DicePool = { ...p1_totalBonus };
  for (const key in p2_totalPenalty) {
    const type = key as DiceType;
    p1BonusPool[type] = (p1BonusPool[type] || 0) + p2_totalPenalty[type]!;
  }

  const p2BonusPool: DicePool = { ...p2_totalBonus };
  for (const key in p1_totalPenalty) {
    const type = key as DiceType;
    p2BonusPool[type] = (p2BonusPool[type] || 0) + p1_totalPenalty[type]!;
  }


  // 2. Flatten Dice: Bonus dice of the same type cancel each other out.
  for (const key in p1BonusPool) {
    const type = key as DiceType;
    if (p2BonusPool[type]) {
      const count1 = p1BonusPool[type] || 0;
      const count2 = p2BonusPool[type] || 0;
      const minCount = Math.min(count1, count2);
      p1BonusPool[type] = count1 - minCount;
      p2BonusPool[type] = count2 - minCount;
    }
  }

  // 3. Roll Dice & Score Successes: Each player rolls their 2 Base Dice plus their final bonus pool.
  const finalP1Pool: DicePool = { ...p1BonusPool, [DiceType.Base]: (p1BonusPool[DiceType.Base] || 0) + 2 };
  const finalP2Pool: DicePool = { ...p2BonusPool, [DiceType.Base]: (p2BonusPool[DiceType.Base] || 0) + 2 };

  let p1Successes = 0;
  let p2Successes = 0;
  const p1RolledDice: RolledDie[] = [];

  for (const key in finalP1Pool) {
    for (let i = 0; i < finalP1Pool[key]; i++) {
      const { value, successes } = rollAndScoreDie(key as DiceType);
      p1Successes += successes;
      p1RolledDice.push({ type: key as DiceType, value });
    }
  }

  for (const key in finalP2Pool) {
    for (let i = 0; i < finalP2Pool[key]; i++) {
      p2Successes += rollAndScoreDie(key as DiceType).successes;
    }
  }

  // 4. Calculate Carry-Overs for the Active Player (if not the System).
  const carryOverDice: DicePool = {};
  if (!activeParticipant.isSystemPlayer) {
    for (const die of p1RolledDice) {
      let shouldCarryOver = false;
      if (die.type === DiceType.Modifier && die.value === 6) shouldCarryOver = true;
      if (die.type === DiceType.Base && die.value === 6) shouldCarryOver = true;
      if (die.type === DiceType.Wild && die.value >= 4) shouldCarryOver = true;

      if (shouldCarryOver) {
        carryOverDice[die.type] = (carryOverDice[die.type] || 0) + 1;
      }
    }
  }

  // 5. Calculate Final Test Scores.
  const activePlayerTestScore = activeParticipant.attributeValue + p1Successes;
  const passivePlayerTestScore = passiveParticipant.attributeValue + p2Successes + difficultyRating;

  // 6. Determine Result: Pass/Fail, Cascades, and Misses.
  const scoreDifference = activePlayerTestScore - passivePlayerTestScore;
  const pass = scoreDifference >= 0;
  const cascades = pass ? (scoreDifference === 0 ? 1 : scoreDifference) : 0;
  const misses = !pass ? -scoreDifference : 0;

  return {
    pass,
    cascades,
    misses,
    activePlayerTestScore,
    passivePlayerTestScore,
    carryOverDice,
  };
}
