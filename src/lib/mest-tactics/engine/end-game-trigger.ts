/**
 * End-Game Trigger Dice Mechanics
 *
 * QSR Rules (Line 744-750): At the end of each turn starting from the End-Game Trigger turn,
 * roll a d6. On a result of 1-3, the game ends immediately.
 *
 * End-Game Trigger turn is determined by Game Size:
 * - VERY_SMALL (2-4 models, 125-250 BP): Turn 3
 * - SMALL (4-8 models, 250-500 BP): Turn 4
 * - MEDIUM (6-12 models, 500-750 BP): Turn 6
 * - LARGE (8-16 models, 750-1000 BP): Turn 8
 * - VERY_LARGE (16+ models, 1000+ BP): Turn 10
 *
 * Source: MEST.Tactics.QSR.txt Line 744-750
 */

import { GameSize } from '../mission/assembly-builder';

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
 * Get end-game trigger turn based on game size
 * 
 * Per QSR Line 744-750:
 * "Use the Game Size per the total BP and adjust one row toward the total Models used
 * to determine after which Turn the End-game Triggers are to be placed."
 */
export function getEndGameTriggerTurn(gameSize: GameSize): number {
  switch (gameSize) {
    case GameSize.VERY_SMALL:
      return 3;  // 2-4 models, 125-250 BP
    case GameSize.SMALL:
      return 4;  // 4-8 models, 250-500 BP
    case GameSize.MEDIUM:
      return 6;  // 6-12 models, 500-750 BP
    case GameSize.LARGE:
      return 8;  // 8-16 models, 750-1000 BP
    case GameSize.VERY_LARGE:
      return 10; // 16+ models, 1000+ BP
    default:
      return 4;  // Default to SMALL
  }
}

/**
 * Default end-game trigger turn for standard games (SMALL)
 */
export const DEFAULT_END_GAME_TRIGGER_TURN = 4;

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
