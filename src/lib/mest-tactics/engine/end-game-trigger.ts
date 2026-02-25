/**
 * End-Game Trigger Dice Mechanics
 * 
 * QSR Rules: At the end of each turn starting from the End-Game Trigger turn,
 * roll a d6. On a result of 1-3, the game ends immediately.
 * 
 * The End-Game Trigger turn is typically turn 10 for standard games.
 */

export interface EndGameTriggerState {
  endDice: number; // Number of end-game dice to roll
  triggerTurn: number; // Turn when end-game die rolls begin
  gameEnded: boolean;
  endReason?: 'trigger-die' | 'elimination' | 'victory-condition' | 'sudden-death';
}

export interface EndGameTriggerResult {
  gameEnded: boolean;
  endDice: number;
  rollResults: number[];
  reason?: 'trigger-die' | 'elimination' | 'victory-condition' | 'sudden-death';
}

/**
 * Default end-game trigger turn for standard games
 */
export const DEFAULT_END_GAME_TRIGGER_TURN = 10;

/**
 * Create initial end-game trigger state
 */
export function createEndGameTriggerState(triggerTurn: number = DEFAULT_END_GAME_TRIGGER_TURN): EndGameTriggerState {
  return {
    endDice: 0,
    triggerTurn,
    gameEnded: false,
  };
}

/**
 * Roll end-game trigger dice at the end of a turn
 * 
 * QSR Rules:
 * - Roll 1d6 at the end of each turn starting from the trigger turn
 * - On a result of 1-3, the game ends
 * - Each turn after the trigger turn, add 1 additional die (cumulative)
 */
export function rollEndGameTrigger(
  state: EndGameTriggerState,
  currentTurn: number,
  roller: () => number = Math.random
): EndGameTriggerResult {
  // Check if we've reached the trigger turn
  if (currentTurn < state.triggerTurn) {
    return {
      gameEnded: false,
      endDice: state.endDice,
      rollResults: [],
    };
  }

  // Add 1 die for each turn at or after trigger turn
  const diceToAdd = 1;
  const newEndDice = state.endDice + diceToAdd;
  
  // Roll the end-game dice
  const rollResults: number[] = [];
  for (let i = 0; i < newEndDice; i++) {
    const roll = Math.floor(roller() * 6) + 1;
    rollResults.push(roll);
  }

  // Check for game end (1-3 on any die ends the game)
  const gameEnded = rollResults.some(roll => roll >= 1 && roll <= 3);

  if (gameEnded) {
    return {
      gameEnded: true,
      endDice: newEndDice,
      rollResults,
      reason: 'trigger-die',
    };
  }

  // Game continues, update dice count for next turn
  return {
    gameEnded: false,
    endDice: newEndDice,
    rollResults,
  };
}

/**
 * Check if the game should end due to all models eliminated on one side
 */
export function checkEliminationEndGame(
  sides: Array<{ id: string; modelsRemaining: number }>
): EndGameTriggerResult {
  const activeSides = sides.filter(side => side.modelsRemaining > 0);
  
  if (activeSides.length <= 1) {
    return {
      gameEnded: true,
      endDice: 0,
      rollResults: [],
      reason: 'elimination',
    };
  }
  
  return {
    gameEnded: false,
    endDice: 0,
    rollResults: [],
  };
}

/**
 * Check if the game should end due to victory condition threshold reached
 */
export function checkVictoryConditionEndGame(
  vpBySide: Record<string, number>,
  vpThreshold: number
): EndGameTriggerResult {
  for (const [sideId, vp] of Object.entries(vpBySide)) {
    if (vp >= vpThreshold) {
      return {
        gameEnded: true,
        endDice: 0,
        rollResults: [],
        reason: 'victory-condition',
      };
    }
  }
  
  return {
    gameEnded: false,
    endDice: 0,
    rollResults: [],
  };
}
