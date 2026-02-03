
import { Character } from '../Character';
import { resolveTest, TestParticipant, TestResult } from '../dice-roller';
import { TestContext } from '../TestContext';
import { DicePool } from '../dice-roller';

/**
 * Resolves a MEST Tactics Morale Test.
 * This is a canonically-defined Unopposed POW Test where a score >= 0 is a PASS.
 *
 * @param character The character making the test.
 * @param context The situational context (not used by base morale, but available for traits).
 * @param difficulty The target number for the unopposed test. This is the system's POW attribute.
 * @param bonusDice Optional bonus dice from traits or other effects.
 * @param penaltyDice Optional penalty dice from traits or other effects.
 * @returns The result of the Unopposed POW test.
 */
export function resolveMoraleTest(
  character: Character,
  context: TestContext = {},
  difficulty: number = 0,
  bonusDice: DicePool = {},
  penaltyDice: DicePool = {},
): TestResult {

  // As per MEST QSR, Morale Tests are Unopposed POW tests.
  const participant: TestParticipant = {
    attributeValue: character.finalAttributes.pow,
    bonusDice,
    penaltyDice,
  };

  // For an Unopposed Test, the difficulty IS the attribute of the opposing system player.
  // The system player does not roll dice.
  const systemPlayer: TestParticipant = {
    attributeValue: difficulty,
    isSystemPlayer: true, 
  };

  // The MEST QSR specifies that Morale Tests pass on a tie (score >= 0).
  // Therefore, the passOnTie parameter for resolveTest must be true.
  return resolveTest(participant, systemPlayer, 0, true);
}
