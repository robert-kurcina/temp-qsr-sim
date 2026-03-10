import { describe, expect, it } from 'vitest';
import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import {
  deriveAttackGateTelemetryGateThresholds,
  derivePerformanceGateThresholds,
} from './EnvConfig';

describe('EnvConfig performance gate derivation', () => {
  it('uses relaxed VERY_SMALL thresholds for path and minimax caches while preserving LOS/patch gates', () => {
    const derived = derivePerformanceGateThresholds({
      missionId: 'QAI_11',
      gameSize: GameSize.VERY_SMALL,
      densityRatio: 50,
    });

    expect(derived.thresholds.turn1ElapsedMsMax).toBe(42000);
    expect(derived.thresholds.activationP95MsMax).toBe(2800);
    expect(derived.thresholds.minLosCacheHitRate).toBe(0.525);
    expect(derived.thresholds.minPathCacheHitRate).toBe(0.1845);
    expect(derived.thresholds.minMinimaxLiteCacheHitRate).toBe(0.028);
    expect(derived.thresholds.minMinimaxPatchCacheHitRate).toBe(0.21);
  });

  it('keeps non-VERY_SMALL path/minimax thresholds unchanged', () => {
    const derived = derivePerformanceGateThresholds({
      missionId: 'QAI_11',
      gameSize: GameSize.SMALL,
      densityRatio: 50,
    });

    expect(derived.thresholds.minPathCacheHitRate).toBe(0.41);
    expect(derived.thresholds.minMinimaxLiteCacheHitRate).toBe(0.08);
  });

  it('derives attack-gate telemetry thresholds with mission/context scaling and string game size input', () => {
    const derived = deriveAttackGateTelemetryGateThresholds({
      missionId: 'QAI_11',
      gameSize: 'VERY_SMALL',
      densityRatio: 50,
    });

    expect(derived.thresholds.minTelemetrySamplesPerRun).toBe(12);
    expect(derived.thresholds.minImmediateHighOpportunityCount).toBe(2);
    expect(derived.thresholds.minImmediateHighConversionRate).toBe(0.0495);
    expect(derived.thresholds.minPressureOpportunityGateApplyRate).toBe(0.0297);
  });
});
