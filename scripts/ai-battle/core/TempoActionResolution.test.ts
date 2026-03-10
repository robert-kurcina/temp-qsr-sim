import { describe, expect, it, vi } from 'vitest';
import {
  executePushingActionForRunner,
  executeRefreshActionForRunner,
} from './TempoActionResolution';

describe('TempoActionResolution', () => {
  it('rejects pushing when AP is above zero', () => {
    const result = executePushingActionForRunner({
      apBefore: 1,
      isAttentive: true,
      incrementAction: vi.fn(),
      executePushing: vi.fn(() => ({ success: true, apGained: 1 })),
      sanitizeForAudit: value => value,
    });
    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('pushing=false:requires-zero-ap');
  });

  it('executes pushing successfully', () => {
    const result = executePushingActionForRunner({
      apBefore: 0,
      isAttentive: true,
      incrementAction: vi.fn(),
      executePushing: vi.fn(() => ({ success: true, apGained: 1 })),
      sanitizeForAudit: value => value,
    });
    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('pushing=true:ap+1');
    expect((result.details as any).pushingResult).toEqual({ success: true, apGained: 1 });
  });

  it('builds refresh details from before/after delay and side initiative points', () => {
    let delayTokens = 2;
    const result = executeRefreshActionForRunner({
      incrementAction: vi.fn(),
      delayBefore: delayTokens,
      refreshForCharacter: () => {
        delayTokens = 1;
        return true;
      },
      onRefreshSuccess: vi.fn(),
      getDelayAfter: () => delayTokens,
      sideInitiativePoints: 3,
    });
    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('refresh=true');
    expect((result.details as any).refreshResult).toEqual({
      success: true,
      delayBefore: 2,
      delayAfter: 1,
      sideInitiativePoints: 3,
    });
  });
});
