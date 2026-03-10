import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import { executeCoreDecisionForRunner } from './DecisionExecutionSupport';
import { executeCloseCombatActionForRunner } from './CombatActionResolution';

vi.mock('./CombatActionResolution', () => ({
  executeCloseCombatActionForRunner: vi.fn(async () => ({
    executed: true,
    resultCode: 'close_combat=true',
    opposedTest: undefined,
    details: { source: 'integration-mock-close' },
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

function createMeleeCharacter(
  id: string,
  weaponTraits: string[] = [],
  options: { attentive?: boolean } = {}
): Character {
  const weapon = {
    name: `${id}-weapon`,
    classification: 'Melee',
    class: 'Melee',
    type: 'Weapon',
    bp: 5,
    traits: weaponTraits,
  };

  return {
    id,
    profile: {
      name: id,
      equipment: [weapon],
      items: [weapon],
      finalTraits: [],
      allTraits: [],
    },
    attributes: {
      mov: 2,
      siz: 3,
      ref: 3,
    },
    finalAttributes: {
      mov: 2,
      siz: 3,
      ref: 3,
    },
    state: {
      isAttentive: options.attentive ?? true,
      isKOd: false,
      isEliminated: false,
    },
  } as unknown as Character;
}

function buildParams(overrides: Record<string, unknown> = {}) {
  return {
    decision: { type: 'detect' },
    character: createMeleeCharacter('actor'),
    allies: [],
    enemies: [],
    battlefield: new Battlefield(24, 24),
    gameManager: {
      spendAp: vi.fn(() => true),
      getAttackApCost: vi.fn(() => 1),
      getApRemaining: vi.fn(() => 2),
    },
    config: {
      visibilityOrMu: 8,
      allowWaitAction: true,
    },
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

describe('DecisionExecutionSupport melee legality integration', () => {
  beforeEach(() => {
    vi.mocked(executeCloseCombatActionForRunner).mockClear();
  });

  it('uses Overreach on first action at 1 MU edge distance when no Reach exists', async () => {
    const battlefield = new Battlefield(24, 24);
    const attacker = createMeleeCharacter('attacker-overreach', [], { attentive: true });
    const defender = createMeleeCharacter('defender-overreach');
    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 8, y: 12 }); // 1 MU edge gap (SIZ 3 bases)

    let ap = 2;
    const spendAp = vi.fn((_character: Character, cost: number) => {
      if (ap < cost) return false;
      ap -= cost;
      return true;
    });

    const executeMoveAndTrackOpportunity = vi.fn(() => ({
      moved: false,
      moveResult: { reason: 'unused' },
      opposedTest: undefined,
      details: undefined,
    }));
    const incrementAction = vi.fn();

    const result = await executeCoreDecisionForRunner(buildParams({
      decision: {
        type: 'close_combat',
        target: defender,
        reason: 'first action overreach window',
        priority: 3,
        requiresAP: true,
      },
      character: attacker,
      enemies: [defender],
      battlefield,
      apBefore: 2,
      actionsTakenThisInitiative: 0,
      gameManager: {
        spendAp,
        getAttackApCost: vi.fn(() => 1),
        getApRemaining: vi.fn(() => ap),
      },
      executeMoveAndTrackOpportunity,
      incrementAction,
    }));

    expect(result?.actionExecuted).toBe(true);
    expect(result?.resultCode).toBe('close_combat=true');
    expect(executeMoveAndTrackOpportunity).not.toHaveBeenCalled();
    expect(spendAp).toHaveBeenCalledTimes(1); // attack only
    expect(incrementAction).toHaveBeenCalledWith('CloseCombatAttack');
    expect(vi.mocked(executeCloseCombatActionForRunner)).toHaveBeenCalledWith(
      expect.objectContaining({ isOverreach: true })
    );
  });

  it('disallows overreach on second action at same spacing when no Reach exists', async () => {
    const battlefield = new Battlefield(24, 24);
    const attacker = createMeleeCharacter('attacker-second-action', [], { attentive: true });
    const defender = createMeleeCharacter('defender-second-action');
    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 8, y: 12 }); // same 1 MU edge gap

    const spendAp = vi.fn(() => true);
    const executeMoveAndTrackOpportunity = vi.fn(() => ({
      moved: false,
      moveResult: { reason: 'blocked' },
      opposedTest: undefined,
      details: undefined,
    }));

    const result = await executeCoreDecisionForRunner(buildParams({
      decision: {
        type: 'close_combat',
        target: defender,
        reason: 'second action cannot overreach',
        priority: 3,
        requiresAP: true,
      },
      character: attacker,
      enemies: [defender],
      battlefield,
      apBefore: 2,
      actionsTakenThisInitiative: 1,
      gameManager: {
        spendAp,
        getAttackApCost: vi.fn(() => 1),
        getApRemaining: vi.fn(() => 2),
      },
      executeMoveAndTrackOpportunity,
    }));

    expect(result?.actionExecuted).toBe(false);
    expect(result?.resultCode).toBe('close_combat=false:not-engaged');
    expect(spendAp).toHaveBeenCalledTimes(1); // one move AP spent trying to engage
    expect(executeMoveAndTrackOpportunity).toHaveBeenCalledTimes(1);
    expect(vi.mocked(executeCloseCombatActionForRunner)).not.toHaveBeenCalled();
  });

  it('uses Reach instead of Overreach at same spacing on second action', async () => {
    const battlefield = new Battlefield(24, 24);
    const attacker = createMeleeCharacter('attacker-reach', ['Reach 1'], { attentive: true });
    const defender = createMeleeCharacter('defender-reach');
    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 8, y: 12 }); // 1 MU edge gap

    let ap = 2;
    const spendAp = vi.fn((_character: Character, cost: number) => {
      if (ap < cost) return false;
      ap -= cost;
      return true;
    });
    const executeMoveAndTrackOpportunity = vi.fn(() => ({
      moved: false,
      moveResult: { reason: 'unused' },
      opposedTest: undefined,
      details: undefined,
    }));

    const result = await executeCoreDecisionForRunner(buildParams({
      decision: {
        type: 'close_combat',
        target: defender,
        reason: 'second action reach legality',
        priority: 3,
        requiresAP: true,
      },
      character: attacker,
      enemies: [defender],
      battlefield,
      apBefore: 2,
      actionsTakenThisInitiative: 1,
      gameManager: {
        spendAp,
        getAttackApCost: vi.fn(() => 1),
        getApRemaining: vi.fn(() => ap),
      },
      executeMoveAndTrackOpportunity,
    }));

    expect(result?.actionExecuted).toBe(true);
    expect(result?.resultCode).toBe('close_combat=true');
    expect(executeMoveAndTrackOpportunity).not.toHaveBeenCalled();
    expect(spendAp).toHaveBeenCalledTimes(1); // attack only
    expect(vi.mocked(executeCloseCombatActionForRunner)).toHaveBeenCalledWith(
      expect.objectContaining({ isOverreach: false })
    );
  });
});
