interface ExecuteDetectActionParams {
  hasTarget: boolean;
  trackAttempt: () => void;
  incrementAction: () => void;
  spendAp: (amount: number) => boolean;
  computeLean: () => boolean;
  executeDetect: (useLean: boolean) => { success: boolean; reason?: string };
  trackSituationalModifiers: (useLean: boolean) => void;
  trackLeanModifierType: () => void;
  trackSuccess: () => void;
  sanitizeForAudit: (value: unknown) => unknown;
}

interface ExecuteHideActionParams {
  allowHideAction: boolean;
  trackAttempt: () => void;
  incrementAction: () => void;
  executeHide: () => { canHide: boolean; reason?: string };
  trackSuccess: () => void;
  sanitizeForAudit: (value: unknown) => unknown;
}

export interface ConcealmentActionResult {
  executed: boolean;
  resultCode: string;
  details: Record<string, unknown>;
}

export function executeDetectActionForRunner(
  params: ExecuteDetectActionParams
): ConcealmentActionResult {
  const {
    hasTarget,
    trackAttempt,
    incrementAction,
    spendAp,
    computeLean,
    executeDetect,
    trackSituationalModifiers,
    trackLeanModifierType,
    trackSuccess,
    sanitizeForAudit,
  } = params;

  if (!hasTarget) {
    return {
      executed: false,
      resultCode: 'detect=false:no-target',
      details: {
        deniedReason: 'no-target',
      },
    };
  }

  trackAttempt();
  incrementAction();
  if (!spendAp(1)) {
    return {
      executed: false,
      resultCode: 'detect=false:not-enough-ap',
      details: {
        deniedReason: 'not-enough-ap',
      },
    };
  }

  const useLean = computeLean();
  const detect = executeDetect(useLean);
  trackSituationalModifiers(useLean);
  if (useLean) {
    trackLeanModifierType();
  }
  if (detect.success) {
    trackSuccess();
  }

  return {
    executed: detect.success,
    resultCode: detect.success ? 'detect=true' : `detect=false:${detect.reason ?? 'failed'}`,
    details: {
      detectResult: sanitizeForAudit(detect) as Record<string, unknown>,
      leanApplied: useLean,
    },
  };
}

export function executeHideActionForRunner(
  params: ExecuteHideActionParams
): ConcealmentActionResult {
  const {
    allowHideAction,
    trackAttempt,
    incrementAction,
    executeHide,
    trackSuccess,
    sanitizeForAudit,
  } = params;

  if (!allowHideAction) {
    return {
      executed: false,
      resultCode: 'hide=false:disabled',
      details: { disabledAction: 'hide' },
    };
  }

  trackAttempt();
  incrementAction();
  const hide = executeHide();
  if (hide.canHide) {
    trackSuccess();
  }

  return {
    executed: hide.canHide,
    resultCode: hide.canHide ? 'hide=true' : `hide=false:${hide.reason ?? 'failed'}`,
    details: {
      hideResult: sanitizeForAudit(hide) as Record<string, unknown>,
    },
  };
}
