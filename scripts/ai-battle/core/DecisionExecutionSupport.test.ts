import { describe, expect, it, vi } from 'vitest';

vi.mock('./MovementPlanningSupport', () => ({
  assessCloseCombatLegalityForRunner: vi.fn(() => ({
    canAttack: false,
    requiresOverreach: false,
  })),
  areCharactersEngagedForRunner: vi.fn(() => false),
  computeEngageMovePositionForRunner: vi.fn(() => null),
}));

vi.mock('./CombatRuntimeSupport', () => ({
  pickMeleeWeaponForRunner: vi.fn(() => ({ name: 'Test Melee Weapon' })),
}));

vi.mock('./CombatActionResolution', () => ({
  executeCloseCombatActionForRunner: vi.fn(async () => ({
    executed: true,
    resultCode: 'close_combat=true',
    opposedTest: undefined,
    details: { source: 'mock-close' },
  })),
  executeRangedCombatActionForRunner: vi.fn(async () => ({
    executed: false,
    result: 'ranged=false:stub',
    vectors: [],
    opposedTest: undefined,
    rangeCheck: undefined,
    details: undefined,
  })),
  executeDisengageActionForRunner: vi.fn(async () => ({
    executed: false,
    resultCode: 'disengage=false:stub',
    opposedTest: undefined,
    details: undefined,
  })),
}));

import { executeCoreDecisionForRunner } from './DecisionExecutionSupport';
import {
  areCharactersEngagedForRunner,
  assessCloseCombatLegalityForRunner,
} from './MovementPlanningSupport';
import { executeCloseCombatActionForRunner } from './CombatActionResolution';

function buildParams(overrides: Record<string, unknown> = {}) {
  return {
    decision: { type: 'detect' },
    character: { state: {} },
    allies: [],
    enemies: [],
    battlefield: {},
    gameManager: {
      spendAp: vi.fn(() => true),
      getAttackApCost: vi.fn(() => 1),
      getApRemaining: vi.fn(() => 1),
    },
    config: { visibilityOrMu: 8, allowWaitAction: true },
    sideIndex: 0,
    turn: 1,
    apBefore: 2,
    actionValidator: {
      validateActionDecision: vi.fn(() => ({ isValid: true, errors: [] })),
    },
    computeFallbackMovePosition: vi.fn(() => null),
    maximizeClosingMoveDestination: vi.fn((_, destination) => destination),
    executeMoveAndTrackOpportunity: vi.fn(() => ({
      moved: false,
      moveResult: { reason: 'blocked' },
      opposedTest: undefined,
      details: undefined,
    })),
    executeWaitAction: vi.fn(() => ({
      executed: true,
      resultCode: 'wait=true',
      details: { wait: true },
    })),
    buildExecutorValidationContext: vi.fn(() => ({})),
    sanitizeForAudit: (value: unknown) => value,
    buildCombatActionResolutionDeps: vi.fn(() => ({})),
    incrementAction: vi.fn(),
    actorStateBefore: {},
    stepInteractions: [],
    ...overrides,
  } as any;
}

describe('DecisionExecutionSupport', () => {
  it('returns null for non-core decision types', async () => {
    const params = buildParams({ decision: { type: 'detect' } });
    const result = await executeCoreDecisionForRunner(params);
    expect(result).toBeNull();
  });

  it('returns move=false:not-enough-ap when AP cannot be spent for move', async () => {
    const incrementAction = vi.fn();
    const params = buildParams({
      decision: { type: 'move' },
      incrementAction,
      gameManager: {
        spendAp: vi.fn(() => false),
      },
    });
    const result = await executeCoreDecisionForRunner(params);
    expect(result).not.toBeNull();
    expect(result?.resultCode).toBe('move=false:not-enough-ap');
    expect(result?.actionExecuted).toBe(false);
    expect(incrementAction).not.toHaveBeenCalled();
  });

  it('delegates wait decisions to executeWaitAction', async () => {
    const executeWaitAction = vi.fn(() => ({
      executed: true,
      resultCode: 'wait=true',
      details: { source: 'test' },
    }));
    const params = buildParams({
      decision: { type: 'wait', planning: { source: 'plan' } },
      executeWaitAction,
    });
    const result = await executeCoreDecisionForRunner(params);
    expect(executeWaitAction).toHaveBeenCalled();
    expect(result?.resultCode).toBe('wait=true');
    expect(result?.actionExecuted).toBe(true);
    expect(result?.details).toEqual({ source: 'test' });
  });

  it('skips hold fallback path planning when AP is exhausted', async () => {
    const computeFallbackMovePosition = vi.fn(() => ({ x: 3, y: 3 }));
    const executeWaitAction = vi.fn(() => ({
      executed: false,
      resultCode: 'wait=false:no-threat',
      details: { source: 'test' },
    }));

    const params = buildParams({
      decision: { type: 'hold' },
      apBefore: 0,
      computeFallbackMovePosition,
      executeWaitAction,
      gameManager: {
        spendAp: vi.fn(() => false),
        getAttackApCost: vi.fn(() => 1),
        getApRemaining: vi.fn(() => 0),
      },
    });
    const result = await executeCoreDecisionForRunner(params);

    expect(computeFallbackMovePosition).not.toHaveBeenCalled();
    expect(executeWaitAction).toHaveBeenCalledTimes(1);
    expect(result?.resultCode).toBe('wait=false:no-threat');
  });

  it('rejects charge decisions when attacker is already engaged', async () => {
    vi.mocked(areCharactersEngagedForRunner).mockReturnValue(true);

    const spendAp = vi.fn(() => true);
    const params = buildParams({
      decision: {
        type: 'charge',
        target: { id: 'target-1', profile: { name: 'target-1' }, state: {} },
        position: { x: 5, y: 5 },
        reason: 'illegal charge from engaged state',
        priority: 3,
        requiresAP: true,
      },
      character: { id: 'actor-1', profile: { name: 'actor-1' }, state: {} },
      gameManager: {
        spendAp,
        getAttackApCost: vi.fn(() => 1),
        getApRemaining: vi.fn(() => 2),
      },
    });

    const result = await executeCoreDecisionForRunner(params);
    expect(result?.actionExecuted).toBe(false);
    expect(result?.resultCode).toBe('charge=false:already-engaged');
    expect(spendAp).not.toHaveBeenCalled();
  });

  it('rejects charge when AP cannot cover move plus immediate attack', async () => {
    vi.mocked(areCharactersEngagedForRunner).mockReturnValue(false);
    vi.mocked(assessCloseCombatLegalityForRunner).mockReturnValue({
      canAttack: false,
      requiresOverreach: false,
    } as any);

    const spendAp = vi.fn(() => true);
    const params = buildParams({
      decision: {
        type: 'charge',
        target: { id: 'target-ap', profile: { name: 'target-ap' }, state: {} },
        position: { x: 5, y: 5 },
        reason: 'insufficient ap for charge+attack',
        priority: 3,
        requiresAP: true,
      },
      character: { id: 'actor-ap', profile: { name: 'actor-ap' }, state: {} },
      apBefore: 1,
      gameManager: {
        spendAp,
        getAttackApCost: vi.fn(() => 1),
        getApRemaining: vi.fn(() => 1),
      },
    });

    const result = await executeCoreDecisionForRunner(params);
    expect(result?.actionExecuted).toBe(false);
    expect(result?.resultCode).toBe('charge=false:not-enough-ap-for-charge-attack(2)');
    expect(spendAp).not.toHaveBeenCalled();
  });

  it('passes action index into melee legality checks for overreach gating', async () => {
    vi.mocked(areCharactersEngagedForRunner).mockReturnValue(false);
    vi.mocked(assessCloseCombatLegalityForRunner).mockImplementation(
      (_attacker, _defender, _battlefield, options = {}) => ({
        canAttack: (options.actionsTakenThisInitiative ?? 0) === 0,
        requiresOverreach: (options.actionsTakenThisInitiative ?? 0) === 0,
      }) as any
    );

    const params = buildParams({
      decision: {
        type: 'close_combat',
        target: { id: 'target-1', profile: { name: 'target-1' }, state: {} },
        reason: 'second action should not overreach',
        priority: 3,
        requiresAP: true,
      },
      character: { id: 'actor-1', profile: { name: 'actor-1' }, state: {} },
      actionsTakenThisInitiative: 1,
      computeFallbackMovePosition: vi.fn(() => null),
    });

    const result = await executeCoreDecisionForRunner(params);
    expect(result?.resultCode).toBe('close_combat=false:not-engaged');
    expect(vi.mocked(assessCloseCombatLegalityForRunner)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ actionsTakenThisInitiative: 1 })
    );
  });

  it('sanity: executes a non-engaged close combat when legality allows Reach envelope', async () => {
    vi.mocked(areCharactersEngagedForRunner).mockReturnValue(false);
    vi.mocked(assessCloseCombatLegalityForRunner).mockReturnValue({
      canAttack: true,
      requiresOverreach: false,
    } as any);

    const executeMoveAndTrackOpportunity = vi.fn(() => ({
      moved: false,
      moveResult: { reason: 'unused' },
      opposedTest: undefined,
      details: undefined,
    }));

    const params = buildParams({
      decision: {
        type: 'close_combat',
        target: { id: 'target-reach', profile: { name: 'target-reach' }, state: {} },
        reason: 'sanity reach attack',
        priority: 3,
        requiresAP: true,
      },
      character: { id: 'actor-reach', profile: { name: 'actor-reach' }, state: {} },
      executeMoveAndTrackOpportunity,
      gameManager: {
        spendAp: vi.fn(() => true),
        getAttackApCost: vi.fn(() => 1),
        getApRemaining: vi.fn(() => 2),
      },
    });

    const result = await executeCoreDecisionForRunner(params);
    expect(result?.actionExecuted).toBe(true);
    expect(result?.resultCode).toBe('close_combat=true');
    expect(executeMoveAndTrackOpportunity).not.toHaveBeenCalled();
    expect(vi.mocked(executeCloseCombatActionForRunner)).toHaveBeenCalledWith(
      expect.objectContaining({
        isOverreach: false,
      })
    );
  });

  it('sanity: propagates Overreach flag into close combat execution when required by legality', async () => {
    vi.mocked(areCharactersEngagedForRunner).mockReturnValue(false);
    vi.mocked(assessCloseCombatLegalityForRunner).mockReturnValue({
      canAttack: true,
      requiresOverreach: true,
    } as any);

    const params = buildParams({
      decision: {
        type: 'close_combat',
        target: { id: 'target-overreach', profile: { name: 'target-overreach' }, state: {} },
        reason: 'sanity overreach attack',
        priority: 3,
        requiresAP: true,
      },
      character: { id: 'actor-overreach', profile: { name: 'actor-overreach' }, state: { isAttentive: true } },
      gameManager: {
        spendAp: vi.fn(() => true),
        getAttackApCost: vi.fn(() => 1),
        getApRemaining: vi.fn(() => 2),
      },
    });

    const result = await executeCoreDecisionForRunner(params);
    expect(result?.actionExecuted).toBe(true);
    expect(result?.resultCode).toBe('close_combat=true');
    expect(vi.mocked(executeCloseCombatActionForRunner)).toHaveBeenCalledWith(
      expect.objectContaining({
        isOverreach: true,
      })
    );
  });
});
