
import { Character } from '../Character';
import { resolveTest, TestParticipant, ResolveTestResult, DiceType } from '../dice-roller';
import { TestContext } from '../TestContext';
import { DicePool } from '../dice-roller';
import { metricsService } from '../MetricsService';

export function resolveMoraleTest(
  character: Character,
  fearTokens: number = 0,
  context: TestContext = {},
  p1Rolls: number[] | null = null,
): ResolveTestResult {

  const bonusDice: DicePool = {};
  const penaltyDice: DicePool = {};

  if (fearTokens > 0) {
    penaltyDice[DiceType.Modifier] = fearTokens;
  }

  if (context.hasAdvantage) {
    bonusDice[DiceType.Wild] = 1;
  }

  if (context.isDisadvantaged) {
    penaltyDice[DiceType.Wild] = 1;
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

  metricsService.logEvent('diceTestResolved', {
    finalPools: {
      p1FinalBonus: participant.bonusDice,
      p1FinalPenalty: participant.penaltyDice,
      p2FinalBonus: systemPlayer.bonusDice,
      p2FinalPenalty: systemPlayer.penaltyDice,
    },
    result,
  });

  return result;
}
