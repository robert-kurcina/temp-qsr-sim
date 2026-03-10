import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';

type SupportActionType = 'rally' | 'revive';

interface ExecuteSupportActionParams {
  actionType: SupportActionType;
  actor: Character;
  target: Character | undefined;
  gameManager: GameManager;
  sanitizeForAudit: (value: unknown) => unknown;
}

export interface ExecuteSupportActionResult {
  executed: boolean;
  resultCode: string;
  details: Record<string, unknown>;
}

export function executeSupportActionForRunner(
  params: ExecuteSupportActionParams
): ExecuteSupportActionResult {
  const {
    actionType,
    actor,
    target,
    gameManager,
    sanitizeForAudit,
  } = params;

  if (!target) {
    return {
      executed: false,
      resultCode: `${actionType}=false:no-target`,
      details: {
        deniedReason: 'no-target',
      },
    };
  }

  if (!gameManager.spendAp(actor, 1)) {
    return {
      executed: false,
      resultCode: `${actionType}=false:not-enough-ap`,
      details: {
        deniedReason: 'not-enough-ap',
      },
    };
  }

  const actionResult = actionType === 'rally'
    ? gameManager.executeRally(actor, target)
    : gameManager.executeRevive(actor, target);
  const executed = Boolean((actionResult as { success?: boolean }).success);
  return {
    executed,
    resultCode: executed
      ? `${actionType}=true`
      : `${actionType}=false:${(actionResult as { reason?: string }).reason ?? 'failed'}`,
    details: {
      [actionType === 'rally' ? 'rallyResult' : 'reviveResult']:
        sanitizeForAudit(actionResult) as Record<string, unknown>,
    },
  };
}
