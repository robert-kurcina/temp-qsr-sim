import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import { applyEliminationScoringForRunner } from './EliminationScoring';

function defender(bp: number, name = 'Defender'): Character {
  return {
    id: 'defender',
    profile: { bp, totalBp: bp, name },
  } as unknown as Character;
}

describe('EliminationScoring', () => {
  it('adds eliminated BP and first-blood RP on first elimination', () => {
    const eliminatedBPBySide: Record<string, number> = { alpha: 0 };
    const missionRpBySide: Record<string, number> = { alpha: 0 };

    const result = applyEliminationScoringForRunner({
      casualty: 'eliminated',
      defender: defender(12, 'Target'),
      sideIndex: 0,
      missionSideIds: ['alpha', 'bravo'],
      eliminatedBPBySide,
      missionRpBySide,
      firstBloodAwarded: false,
      verbose: false,
    });

    expect(eliminatedBPBySide.alpha).toBe(12);
    expect(missionRpBySide.alpha).toBe(1);
    expect(result.firstBloodAwarded).toBe(true);
  });

  it('adds BP but not first-blood RP when first blood already awarded', () => {
    const eliminatedBPBySide: Record<string, number> = { alpha: 5 };
    const missionRpBySide: Record<string, number> = { alpha: 2 };

    const result = applyEliminationScoringForRunner({
      casualty: 'eliminated',
      defender: defender(8),
      sideIndex: 0,
      missionSideIds: ['alpha', 'bravo'],
      eliminatedBPBySide,
      missionRpBySide,
      firstBloodAwarded: true,
      verbose: false,
    });

    expect(eliminatedBPBySide.alpha).toBe(13);
    expect(missionRpBySide.alpha).toBe(2);
    expect(result.firstBloodAwarded).toBe(true);
  });

  it('counts KO casualties for elimination-key BP totals', () => {
    const eliminatedBPBySide: Record<string, number> = { alpha: 5 };
    const missionRpBySide: Record<string, number> = { alpha: 2 };

    const result = applyEliminationScoringForRunner({
      casualty: 'ko',
      defender: defender(8),
      sideIndex: 0,
      missionSideIds: ['alpha', 'bravo'],
      eliminatedBPBySide,
      missionRpBySide,
      firstBloodAwarded: false,
      verbose: false,
    });

    expect(eliminatedBPBySide.alpha).toBe(13);
    expect(missionRpBySide.alpha).toBe(3);
    expect(result.firstBloodAwarded).toBe(true);
  });

  it('falls back to totalBp when legacy bp field is unavailable', () => {
    const eliminatedBPBySide: Record<string, number> = { alpha: 0 };
    const missionRpBySide: Record<string, number> = { alpha: 0 };
    const defenderWithTotalBpOnly = {
      id: 'defender-total-bp',
      profile: { totalBp: 17, name: 'Total BP Target' },
    } as unknown as Character;

    const result = applyEliminationScoringForRunner({
      casualty: 'eliminated',
      defender: defenderWithTotalBpOnly,
      sideIndex: 0,
      missionSideIds: ['alpha', 'bravo'],
      eliminatedBPBySide,
      missionRpBySide,
      firstBloodAwarded: false,
      verbose: false,
    });

    expect(eliminatedBPBySide.alpha).toBe(17);
    expect(missionRpBySide.alpha).toBe(1);
    expect(result.firstBloodAwarded).toBe(true);
  });
});
