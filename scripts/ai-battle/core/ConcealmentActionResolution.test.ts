import { describe, expect, it, vi } from 'vitest';
import {
  executeDetectActionForRunner,
  executeHideActionForRunner,
} from './ConcealmentActionResolution';

describe('ConcealmentActionResolution', () => {
  it('returns detect no-target when target is missing', () => {
    const result = executeDetectActionForRunner({
      hasTarget: false,
      trackAttempt: vi.fn(),
      incrementAction: vi.fn(),
      spendAp: vi.fn(() => true),
      computeLean: vi.fn(() => false),
      executeDetect: vi.fn(() => ({ success: true })),
      trackSituationalModifiers: vi.fn(),
      trackLeanModifierType: vi.fn(),
      trackSuccess: vi.fn(),
      sanitizeForAudit: value => value,
    });
    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('detect=false:no-target');
  });

  it('executes detect with lean modifier tracking', () => {
    const trackLeanModifierType = vi.fn();
    const trackSuccess = vi.fn();
    const result = executeDetectActionForRunner({
      hasTarget: true,
      trackAttempt: vi.fn(),
      incrementAction: vi.fn(),
      spendAp: vi.fn(() => true),
      computeLean: vi.fn(() => true),
      executeDetect: vi.fn(() => ({ success: true })),
      trackSituationalModifiers: vi.fn(),
      trackLeanModifierType,
      trackSuccess,
      sanitizeForAudit: value => value,
    });
    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('detect=true');
    expect(trackLeanModifierType).toHaveBeenCalledTimes(1);
    expect(trackSuccess).toHaveBeenCalledTimes(1);
  });

  it('returns hide disabled when toggle is false', () => {
    const result = executeHideActionForRunner({
      allowHideAction: false,
      trackAttempt: vi.fn(),
      incrementAction: vi.fn(),
      executeHide: vi.fn(() => ({ canHide: true })),
      trackSuccess: vi.fn(),
      sanitizeForAudit: value => value,
    });
    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('hide=false:disabled');
  });
});
