export interface GameTurnActionSummary {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  replannedActions: number;
}

export interface GameLoopRunSummary extends GameTurnActionSummary {
  finalTurn: number;
  endReason?: string;
}

export interface RunGameLifecycleDeps {
  maxTurns: number;
  resetReplanAttempts: () => void;
  runTurn: (turn: number) => GameTurnActionSummary;
  onTurnEnd?: (turn: number) => void;
  shouldEndGame: (turn: number) => boolean;
  getEndReason: () => string;
}

export function runGameLifecycleForGameLoop(
  deps: RunGameLifecycleDeps
): GameLoopRunSummary {
  const result: GameLoopRunSummary = {
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    replannedActions: 0,
    finalTurn: 0,
  };

  for (let turn = 1; turn <= deps.maxTurns; turn++) {
    deps.resetReplanAttempts();

    const turnResult = deps.runTurn(turn);
    result.totalActions += turnResult.totalActions;
    result.successfulActions += turnResult.successfulActions;
    result.failedActions += turnResult.failedActions;
    result.replannedActions += turnResult.replannedActions;
    result.finalTurn = turn;
    deps.onTurnEnd?.(turn);

    if (deps.shouldEndGame(turn)) {
      result.endReason = deps.getEndReason();
      break;
    }
  }

  return result;
}
