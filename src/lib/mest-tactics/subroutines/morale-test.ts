
import { Character } from '../Character';
import { resolveTest, TestParticipant, TestResult } from '../dice-roller';
import { TestContext } from '../TestContext';
import { DicePool } from '../dice-roller';

/**
 * Resolves an unopposed Morale Test for a single character.
 * This is typically a test against the character's WIL attribute.
 * It is used for actions like Rally or resisting fear-inducing events.
 *
 * @param character The character making the morale test.
 * @param context The situational context, containing any potential bonus or penalty dice.
 * @param difficulty An optional score modifier to make the test harder. Defaults to 0.
 * @param bonusDice Optional bonus dice to add to the test.
 * @param penaltyDice Optional penalty dice to add to the test.
 * @returns The result of the unopposed WIL test.
 */
export function resolveMoraleTest(
  character: Character,
  context: TestContext = {},
  difficulty: number = 0,
  bonusDice: DicePool = {},
  penaltyDice: DicePool = {},
): TestResult {

  // Define the participant for the Morale Test.
  const participant: TestParticipant = {
    attributeValue: character.finalAttributes.wil, // Morale tests are based on Willpower
    bonusDice,
    penaltyDice,
  };

  // A morale test is unopposed, so the defender is a "system player" with a value of 0.
  const systemPlayer: TestParticipant = {
    attributeValue: 0,
    isSystemPlayer: true, 
  };

  // Resolve the test, applying the difficulty as a negative score modifier.
  // A higher difficulty makes the test harder to pass.
  return resolveTest(participant, systemPlayer, -difficulty, true);
}
