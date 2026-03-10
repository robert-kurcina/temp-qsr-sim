import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';

interface ExecuteWaitActionParams {
  allowWaitAction: boolean;
  character: Character;
  opponents: Character[];
  gameManager: GameManager;
  visibilityOrMu: number;
  selectionSource?: string;
  trackAttempt: () => void;
  incrementWaitAction: () => void;
  trackWaitChoiceTaken: (source?: string) => void;
  trackSuccess: () => void;
  sanitizeForAudit: (value: unknown) => unknown;
}

export interface ExecuteWaitActionResult {
  executed: boolean;
  resultCode: string;
  details: Record<string, unknown>;
}

export function executeWaitActionForRunner(params: ExecuteWaitActionParams): ExecuteWaitActionResult {
  const {
    allowWaitAction,
    character,
    opponents,
    gameManager,
    visibilityOrMu,
    selectionSource,
    trackAttempt,
    incrementWaitAction,
    trackWaitChoiceTaken,
    trackSuccess,
    sanitizeForAudit,
  } = params;

  if (!allowWaitAction) {
    return {
      executed: false,
      resultCode: 'wait=false:disabled',
      details: { disabledAction: 'wait' },
    };
  }

  trackAttempt();
  incrementWaitAction();
  trackWaitChoiceTaken(selectionSource);
  const wait = gameManager.executeWait(character, {
    spendAp: true,
    opponents,
    visibilityOrMu,
    allowRevealReposition: false,
  });
  if (wait.success) {
    trackSuccess();
  }
  return {
    executed: wait.success,
    resultCode: wait.success ? 'wait=true' : `wait=false:${wait.reason ?? 'failed'}`,
    details: {
      waitResult: sanitizeForAudit(wait) as Record<string, unknown>,
    },
  };
}
