interface ExecutePushingActionParams {
  apBefore: number;
  isAttentive: boolean;
  incrementAction: () => void;
  executePushing: () => { success: boolean; apGained?: number; reason?: string };
  sanitizeForAudit: (value: unknown) => unknown;
}

interface ExecuteRefreshActionParams {
  incrementAction: () => void;
  delayBefore: number;
  refreshForCharacter: () => boolean;
  onRefreshSuccess: () => void;
  getDelayAfter: () => number;
  sideInitiativePoints: number;
}

export interface TempoActionResult {
  executed: boolean;
  resultCode: string;
  details: Record<string, unknown>;
}

export function executePushingActionForRunner(
  params: ExecutePushingActionParams
): TempoActionResult {
  const {
    apBefore,
    isAttentive,
    incrementAction,
    executePushing,
    sanitizeForAudit,
  } = params;

  incrementAction();
  if (apBefore > 0) {
    return {
      executed: false,
      resultCode: 'pushing=false:requires-zero-ap',
      details: {
        deniedReason: 'requires-zero-ap',
        apBefore,
      },
    };
  }
  if (!isAttentive) {
    return {
      executed: false,
      resultCode: 'pushing=false:not-attentive',
      details: {
        deniedReason: 'not-attentive',
      },
    };
  }

  const pushing = executePushing();
  return {
    executed: pushing.success,
    resultCode: pushing.success
      ? `pushing=true:ap+${pushing.apGained}`
      : `pushing=false:${pushing.reason ?? 'failed'}`,
    details: {
      pushingResult: sanitizeForAudit(pushing) as Record<string, unknown>,
    },
  };
}

export function executeRefreshActionForRunner(
  params: ExecuteRefreshActionParams
): TempoActionResult {
  const {
    incrementAction,
    delayBefore,
    refreshForCharacter,
    onRefreshSuccess,
    getDelayAfter,
    sideInitiativePoints,
  } = params;

  incrementAction();
  const refreshed = refreshForCharacter();
  if (refreshed) {
    onRefreshSuccess();
  }

  return {
    executed: refreshed,
    resultCode: refreshed ? 'refresh=true' : 'refresh=false:failed',
    details: {
      refreshResult: {
        success: refreshed,
        delayBefore,
        delayAfter: getDelayAfter(),
        sideInitiativePoints,
      },
    },
  };
}
