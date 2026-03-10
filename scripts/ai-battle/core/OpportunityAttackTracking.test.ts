import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { ModelStateAudit } from '../../shared/BattleReportTypes';
import {
  applyOpportunityAttackForRunner,
  getOpportunityAttackFromMoveResult,
} from './OpportunityAttackTracking';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id },
    state: {},
  } as unknown as Character;
}

function createState(overrides: Partial<ModelStateAudit> = {}): ModelStateAudit {
  return {
    wounds: 0,
    delayTokens: 0,
    fearTokens: 0,
    isKOd: false,
    isEliminated: false,
    isHidden: false,
    isWaiting: false,
    isAttentive: true,
    isOrdered: false,
    ...overrides,
  };
}

describe('OpportunityAttackTracking', () => {
  it('extracts nested opportunity attack payload from move result', () => {
    const attacker = createCharacter('attacker');
    const payload = getOpportunityAttackFromMoveResult({
      moved: true,
      opportunityAttack: { attacker, result: { hit: true } },
    });
    expect(payload?.attacker?.id).toBe('attacker');
  });

  it('returns unchanged state when no attacker exists', () => {
    const active = createCharacter('active');
    const stepInteractions: any[] = [];
    const result = applyOpportunityAttackForRunner({
      opportunityAttack: { result: { hit: true } },
      active,
      actorStateBefore: createState(),
      actorStateAfterOpportunity: createState(),
      stepInteractions,
      stepOpposedTest: undefined,
      stepDetails: { moveResult: {} },
      toOpposedTestAudit: () => undefined,
      trackPassiveUsageOpportunityAttack: vi.fn(),
      trackCombatExtras: vi.fn(),
      syncMissionRuntimeForAttack: vi.fn(),
      extractDamageResolutionFromUnknown: vi.fn(),
    });
    expect(result.applied).toBe(false);
    expect(stepInteractions).toHaveLength(0);
    expect((result.details as any)?.moveResult).toEqual({});
  });

  it('tracks and merges opportunity attack into step details and interactions', () => {
    const active = createCharacter('active');
    const attacker = createCharacter('attacker');
    const stepInteractions: any[] = [];
    const trackPassiveUsageOpportunityAttack = vi.fn();
    const trackCombatExtras = vi.fn();
    const syncMissionRuntimeForAttack = vi.fn();

    const result = applyOpportunityAttackForRunner({
      opportunityAttack: { attacker, result: { hit: true } },
      active,
      actorStateBefore: createState(),
      actorStateAfterOpportunity: createState({ wounds: 1 }),
      stepInteractions,
      stepOpposedTest: undefined,
      stepDetails: { moveResult: { moved: true } },
      toOpposedTestAudit: () => ({ pass: true }),
      trackPassiveUsageOpportunityAttack,
      trackCombatExtras,
      syncMissionRuntimeForAttack,
      extractDamageResolutionFromUnknown: (payload) => payload,
    });

    expect(result.applied).toBe(true);
    expect(stepInteractions).toHaveLength(1);
    expect(stepInteractions[0].kind).toBe('opportunity_attack');
    expect(trackPassiveUsageOpportunityAttack).toHaveBeenCalledTimes(1);
    expect(trackCombatExtras).toHaveBeenCalledTimes(1);
    expect(syncMissionRuntimeForAttack).toHaveBeenCalledTimes(1);
    expect((result.opposedTest as any)?.pass).toBe(true);
    expect((result.details as any)?.opportunityAttack).toBeTruthy();
  });
});
