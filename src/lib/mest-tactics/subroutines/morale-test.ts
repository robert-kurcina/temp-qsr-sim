
import { Character } from '../core/Character';
import { resolveTest, TestParticipant, ResolveTestResult, DiceType } from '../subroutines/dice-roller';
import { TestContext } from '../utils/TestContext';
import { TestDice } from '../subroutines/dice-roller';
import { metricsService } from '../engine/MetricsService';
import { getLeadershipBonusDice, isImmuneToHindranceMoralePenalties } from '../traits/combat-traits';

export function resolveMoraleTest(
  character: Character,
  fearTokens: number = 0,
  context: TestContext = {},
  p1Rolls: number[] | null = null,
): ResolveTestResult {

  const bonusDice: TestDice = {};
  const penaltyDice: TestDice = {};

  // Insane trait: not affected by Hindrance penalties for Morale Tests
  const isImmuneToHindrancePenalties = isImmuneToHindranceMoralePenalties(character);
  
  if (fearTokens > 0 && !isImmuneToHindrancePenalties) {
    penaltyDice[DiceType.Modifier] = fearTokens;
  }

  if ((context as any).hasAdvantage) {
    bonusDice[DiceType.Wild] = 1;
  }

  if ((context as any).isDisadvantaged) {
    penaltyDice[DiceType.Wild] = 1;
  }

  // Leadership X: +X Base dice for Morale Tests from nearby leader
  // (Caller must set context.leadershipBonus if applicable)
  if ((context as any).leadershipBonus) {
    bonusDice[DiceType.Base] = (bonusDice[DiceType.Base] || 0) + (context as any).leadershipBonus;
  }

  const participant: TestParticipant = {
    attributeValue: character.finalAttributes.pow,
    bonusDice,
    penaltyDice,
  };

  const systemPlayer: TestParticipant = {
    attributeValue: 0,
    isSystemPlayer: true,
  };

  const result = resolveTest(participant, systemPlayer, p1Rolls);

  return result;
}
