import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { AIExecutionContext } from '../../../src/lib/mest-tactics/ai/executor/AIActionExecutor';

export function shouldValidateWithExecutorForRunner(decision: ActionDecision): boolean {
  switch (decision.type) {
    case 'fiddle':
    case 'pushing':
    case 'refresh':
    case 'hold':
    case 'charge':
    case 'close_combat':
      return false;
    case 'move':
      return Boolean(decision.position);
    default:
      return true;
  }
}

export function buildExecutorValidationContextForRunner(params: {
  turn: number;
  apRemaining: number;
  allies: Character[];
  enemies: Character[];
  battlefield: Battlefield;
}): AIExecutionContext {
  return {
    currentTurn: params.turn,
    currentRound: 1,
    apRemaining: params.apRemaining,
    allies: params.allies,
    enemies: params.enemies,
    battlefield: params.battlefield,
  };
}
