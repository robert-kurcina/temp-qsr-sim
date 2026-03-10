import { describe, expect, it, vi } from 'vitest';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { CharacterAI } from '../../../src/lib/mest-tactics/ai/core/CharacterAI';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { GameConfig } from '../AIBattleConfig';
import { createEmptyStats } from '../validation/ValidationMetrics';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import { resolveCharacterTurnForRunner } from './CharacterTurnResolutionSupport';

function createTestConfig(): GameConfig {
  return {
    missionId: 'QAI_11',
    missionName: 'Elimination',
    gameSize: GameSize.VERY_SMALL,
    battlefieldWidth: 18,
    battlefieldHeight: 24,
    maxTurns: 6,
    endGameTurn: 4,
    sides: [
      {
        name: 'Alpha',
        bp: 100,
        modelCount: 1,
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Alpha Assembly',
      },
      {
        name: 'Bravo',
        bp: 100,
        modelCount: 1,
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Bravo Assembly',
      },
    ],
    densityRatio: 0,
    lighting: 'Day, Clear' as any,
    visibilityOrMu: 16,
    maxOrm: 3,
    allowConcentrateRangeExtension: false,
    perCharacterFovLos: false,
    verbose: false,
  };
}

function createCharacter(id: string, name: string): Character {
  return {
    id,
    profile: { name },
    attributes: { int: 5 },
    finalAttributes: { int: 5 },
    state: {
      isWaiting: false,
      delayTokens: 0,
      isEliminated: false,
      isKOd: false,
    },
  } as unknown as Character;
}

describe('CharacterTurnResolutionSupport', () => {
  it('returns no_ap audit when activation starts with zero AP', async () => {
    const actor = createCharacter('alpha-1', 'Alpha One');
    const endActivation = vi.fn();
    const gameManager = {
      apPerActivation: 2,
      beginActivation: vi.fn().mockReturnValue(0),
      endActivation,
    } as unknown as GameManager;

    const buildRuntime = vi.fn();
    const runLoop = vi.fn();

    const result = await resolveCharacterTurnForRunner({
      character: actor,
      allSides: [{ characters: [actor] }, { characters: [] }],
      battlefield: {} as Battlefield,
      gameManager,
      aiController: {} as CharacterAI,
      turn: 1,
      sideIndex: 0,
      config: createTestConfig(),
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      log: [],
      stats: createEmptyStats(),
      missionSides: [] as any,
      missionVpBySide: {},
      missionRpBySide: {},
      missionSideIds: [],
      eliminatedBPBySide: {},
      sideNameByCharacterId: new Map(),
      doctrineByCharacterId: new Map(),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 7,
      applyDoctrineLoadoutConfig: () => undefined,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
      },
    });

    expect(result?.skippedReason).toBe('no_ap');
    expect(result?.apStart).toBe(0);
    expect(result?.apEnd).toBe(0);
    expect(result?.activationSequence).toBe(7);
    expect(endActivation).toHaveBeenCalledTimes(1);
    expect(buildRuntime).not.toHaveBeenCalled();
    expect(runLoop).not.toHaveBeenCalled();
  });

  it('runs decision loop and marks no_executed_steps when none executed', async () => {
    const actor = createCharacter('alpha-1', 'Alpha One');
    const endActivation = vi.fn();
    const gameManager = {
      apPerActivation: 2,
      beginActivation: vi.fn().mockReturnValue(2),
      endActivation,
    } as unknown as GameManager;
    const applyDoctrine = vi.fn();
    const buildRuntime = vi.fn().mockReturnValue({
      missionState: {} as any,
      runtime: {} as any,
    });
    const runLoop = vi.fn().mockResolvedValue({ lastKnownAp: 1 });

    const result = await resolveCharacterTurnForRunner({
      character: actor,
      allSides: [{ characters: [actor] }, { characters: [] }],
      battlefield: {} as Battlefield,
      gameManager,
      aiController: {} as CharacterAI,
      turn: 2,
      sideIndex: 0,
      config: createTestConfig(),
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      log: [],
      stats: createEmptyStats(),
      missionSides: [] as any,
      missionVpBySide: {},
      missionRpBySide: {},
      missionSideIds: [],
      eliminatedBPBySide: {},
      sideNameByCharacterId: new Map(),
      doctrineByCharacterId: new Map(),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 9,
      applyDoctrineLoadoutConfig: applyDoctrine,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
      },
    });

    expect(applyDoctrine).toHaveBeenCalledTimes(1);
    expect(buildRuntime).toHaveBeenCalledTimes(1);
    expect(runLoop).toHaveBeenCalledTimes(1);
    expect(result?.activationSequence).toBe(9);
    expect(result?.apStart).toBe(2);
    expect(result?.apEnd).toBe(1);
    expect(result?.skippedReason).toBe('no_executed_steps');
    expect(endActivation).toHaveBeenCalledTimes(1);
  });

  it('checks hidden-at-initiative-start before activation for hidden models', async () => {
    const actor = createCharacter('alpha-1', 'Alpha One');
    actor.state.isHidden = true;
    const enemy = createCharacter('bravo-1', 'Bravo One');

    const beginActivation = vi.fn().mockReturnValue(2);
    const checkHiddenAtInitiativeStart = vi.fn(() => ({
      mustReveal: true,
      canReposition: false,
    }));
    const endActivation = vi.fn();
    const gameManager = {
      apPerActivation: 2,
      beginActivation,
      checkHiddenAtInitiativeStart,
      endActivation,
    } as unknown as GameManager;
    const buildRuntime = vi.fn().mockReturnValue({
      missionState: {} as any,
      runtime: {} as any,
    });
    const runLoop = vi.fn().mockResolvedValue({ lastKnownAp: 1 });

    await resolveCharacterTurnForRunner({
      character: actor,
      allSides: [{ characters: [actor] }, { characters: [enemy] }],
      battlefield: {} as Battlefield,
      gameManager,
      aiController: {} as CharacterAI,
      turn: 3,
      sideIndex: 0,
      config: createTestConfig(),
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      log: [],
      stats: createEmptyStats(),
      missionSides: [] as any,
      missionVpBySide: {},
      missionRpBySide: {},
      missionSideIds: [],
      eliminatedBPBySide: {},
      sideNameByCharacterId: new Map(),
      doctrineByCharacterId: new Map(),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 10,
      applyDoctrineLoadoutConfig: () => undefined,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
      },
    });

    expect(checkHiddenAtInitiativeStart).toHaveBeenCalledTimes(1);
    expect(checkHiddenAtInitiativeStart).toHaveBeenCalledWith(
      actor,
      [enemy],
      expect.objectContaining({
        allowReposition: true,
        revealReposition: expect.any(Function),
      })
    );
    expect(checkHiddenAtInitiativeStart.mock.invocationCallOrder[0]).toBeLessThan(
      beginActivation.mock.invocationCallOrder[0]
    );
  });

  it('does not run hidden-at-initiative-start check when model is already revealed', async () => {
    const actor = createCharacter('alpha-1', 'Alpha One');
    actor.state.isHidden = false;
    const enemy = createCharacter('bravo-1', 'Bravo One');

    const beginActivation = vi.fn().mockReturnValue(2);
    const checkHiddenAtInitiativeStart = vi.fn();
    const endActivation = vi.fn();
    const gameManager = {
      apPerActivation: 2,
      beginActivation,
      checkHiddenAtInitiativeStart,
      endActivation,
    } as unknown as GameManager;
    const buildRuntime = vi.fn().mockReturnValue({
      missionState: {} as any,
      runtime: {} as any,
    });
    const runLoop = vi.fn().mockResolvedValue({ lastKnownAp: 1 });

    await resolveCharacterTurnForRunner({
      character: actor,
      allSides: [{ characters: [actor] }, { characters: [enemy] }],
      battlefield: {} as Battlefield,
      gameManager,
      aiController: {} as CharacterAI,
      turn: 4,
      sideIndex: 0,
      config: createTestConfig(),
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      log: [],
      stats: createEmptyStats(),
      missionSides: [] as any,
      missionVpBySide: {},
      missionRpBySide: {},
      missionSideIds: [],
      eliminatedBPBySide: {},
      sideNameByCharacterId: new Map(),
      doctrineByCharacterId: new Map(),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 11,
      applyDoctrineLoadoutConfig: () => undefined,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
      },
    });

    expect(checkHiddenAtInitiativeStart).not.toHaveBeenCalled();
    expect(beginActivation).toHaveBeenCalledTimes(1);
  });

  it('spends initiative point on refresh when trailing near endgame with delay token', async () => {
    const actor = createCharacter('alpha-1', 'Alpha One');
    actor.state.delayTokens = 1;
    const enemy = createCharacter('bravo-1', 'Bravo One');

    const beginActivation = vi.fn().mockReturnValue(2);
    const refresh = vi.fn().mockImplementation((character: Character, side: any) => {
      character.state.delayTokens = Math.max(0, (character.state.delayTokens ?? 0) - 1);
      side.state.initiativePoints = Math.max(0, (side.state.initiativePoints ?? 0) - 1);
      return true;
    });
    const gameManager = {
      apPerActivation: 2,
      beginActivation,
      refresh,
      endActivation: vi.fn(),
    } as unknown as GameManager;
    const buildRuntime = vi.fn().mockReturnValue({
      missionState: {} as any,
      runtime: {} as any,
    });
    const runLoop = vi.fn().mockResolvedValue({ lastKnownAp: 1 });
    const log: any[] = [];
    const missionSides = [
      { id: 'Alpha', state: { initiativePoints: 1 } },
      { id: 'Bravo', state: { initiativePoints: 0 } },
    ] as any;

    await resolveCharacterTurnForRunner({
      character: actor,
      allSides: [{ characters: [actor] }, { characters: [enemy] }],
      battlefield: {} as Battlefield,
      gameManager,
      aiController: {} as CharacterAI,
      turn: 4,
      sideIndex: 0,
      config: createTestConfig(),
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      log,
      stats: createEmptyStats(),
      missionSides,
      missionVpBySide: { Alpha: 0, Bravo: 1 },
      missionRpBySide: { Alpha: 0, Bravo: 0 },
      missionSideIds: ['Alpha', 'Bravo'],
      eliminatedBPBySide: { Alpha: 0, Bravo: 0 },
      sideNameByCharacterId: new Map(),
      doctrineByCharacterId: new Map(),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 12,
      applyDoctrineLoadoutConfig: () => undefined,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
      },
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(beginActivation).toHaveBeenCalledTimes(1);
    expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(beginActivation.mock.invocationCallOrder[0]);
    expect(log.some(entry => entry.action === 'initiative_refresh')).toBe(true);
  });

  it('does not spend initiative point on refresh when leading on VP', async () => {
    const actor = createCharacter('alpha-1', 'Alpha One');
    actor.state.delayTokens = 1;
    const enemy = createCharacter('bravo-1', 'Bravo One');

    const beginActivation = vi.fn().mockReturnValue(2);
    const refresh = vi.fn().mockReturnValue(true);
    const gameManager = {
      apPerActivation: 2,
      beginActivation,
      refresh,
      endActivation: vi.fn(),
    } as unknown as GameManager;
    const buildRuntime = vi.fn().mockReturnValue({
      missionState: {} as any,
      runtime: {} as any,
    });
    const runLoop = vi.fn().mockResolvedValue({ lastKnownAp: 1 });
    const log: any[] = [];
    const missionSides = [
      { id: 'Alpha', state: { initiativePoints: 1 } },
      { id: 'Bravo', state: { initiativePoints: 0 } },
    ] as any;

    await resolveCharacterTurnForRunner({
      character: actor,
      allSides: [{ characters: [actor] }, { characters: [enemy] }],
      battlefield: {} as Battlefield,
      gameManager,
      aiController: {} as CharacterAI,
      turn: 4,
      sideIndex: 0,
      config: createTestConfig(),
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      log,
      stats: createEmptyStats(),
      missionSides,
      missionVpBySide: { Alpha: 2, Bravo: 0 },
      missionRpBySide: { Alpha: 0, Bravo: 0 },
      missionSideIds: ['Alpha', 'Bravo'],
      eliminatedBPBySide: { Alpha: 0, Bravo: 0 },
      sideNameByCharacterId: new Map(),
      doctrineByCharacterId: new Map(),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 13,
      applyDoctrineLoadoutConfig: () => undefined,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
      },
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(beginActivation).toHaveBeenCalledTimes(1);
  });

  it('spends refresh to unlock pushing momentum when enemy pressure is close', async () => {
    const actor = createCharacter('alpha-1', 'Alpha One');
    actor.state.delayTokens = 1;
    actor.state.isAttentive = true;
    actor.state.hasPushedThisInitiative = false;
    const enemy = createCharacter('bravo-1', 'Bravo One');

    const beginActivation = vi.fn().mockReturnValue(2);
    const refresh = vi.fn().mockImplementation((character: Character, side: any) => {
      character.state.delayTokens = Math.max(0, (character.state.delayTokens ?? 0) - 1);
      side.state.initiativePoints = Math.max(0, (side.state.initiativePoints ?? 0) - 1);
      return true;
    });
    const gameManager = {
      apPerActivation: 2,
      beginActivation,
      refresh,
      endActivation: vi.fn(),
    } as unknown as GameManager;
    const buildRuntime = vi.fn().mockReturnValue({
      missionState: {} as any,
      runtime: {} as any,
    });
    const runLoop = vi.fn().mockResolvedValue({ lastKnownAp: 1 });
    const log: any[] = [];
    const missionSides = [
      { id: 'Alpha', state: { initiativePoints: 1 } },
      { id: 'Bravo', state: { initiativePoints: 0 } },
    ] as any;

    await resolveCharacterTurnForRunner({
      character: actor,
      allSides: [{ characters: [actor] }, { characters: [enemy] }],
      battlefield: {
        getCharacterPosition: (model: Character) => {
          if (model.id === actor.id) return { x: 4, y: 4 };
          return { x: 9, y: 4 };
        },
      } as unknown as Battlefield,
      gameManager,
      aiController: {} as CharacterAI,
      turn: 1,
      sideIndex: 0,
      config: createTestConfig(),
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      log,
      stats: createEmptyStats(),
      missionSides,
      missionVpBySide: { Alpha: 2, Bravo: 0 },
      missionRpBySide: { Alpha: 0, Bravo: 0 },
      missionSideIds: ['Alpha', 'Bravo'],
      eliminatedBPBySide: { Alpha: 0, Bravo: 0 },
      sideNameByCharacterId: new Map(),
      doctrineByCharacterId: new Map(),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 14,
      applyDoctrineLoadoutConfig: () => undefined,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
      },
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(beginActivation).toHaveBeenCalledTimes(1);
    expect(log.some(entry =>
      entry.action === 'initiative_refresh'
      && typeof entry.detail === 'string'
      && entry.detail.includes('unlock_pushing_momentum')
    )).toBe(true);
  });

  it('uses coordinator urgency tag when refresh unlocks momentum', async () => {
    const actor = createCharacter('alpha-1', 'Alpha One');
    actor.state.delayTokens = 1;
    actor.state.isAttentive = true;
    actor.state.hasPushedThisInitiative = false;
    const enemy = createCharacter('bravo-1', 'Bravo One');

    const beginActivation = vi.fn().mockReturnValue(2);
    const refresh = vi.fn().mockImplementation((character: Character, side: any) => {
      character.state.delayTokens = Math.max(0, (character.state.delayTokens ?? 0) - 1);
      side.state.initiativePoints = Math.max(0, (side.state.initiativePoints ?? 0) - 1);
      return true;
    });
    const gameManager = {
      apPerActivation: 2,
      beginActivation,
      refresh,
      endActivation: vi.fn(),
    } as unknown as GameManager;
    const buildRuntime = vi.fn().mockReturnValue({
      missionState: {} as any,
      runtime: {} as any,
    });
    const runLoop = vi.fn().mockResolvedValue({ lastKnownAp: 1 });
    const log: any[] = [];
    const missionSides = [
      { id: 'Alpha', state: { initiativePoints: 1 } },
      { id: 'Bravo', state: { initiativePoints: 0 } },
    ] as any;

    await resolveCharacterTurnForRunner({
      character: actor,
      allSides: [{ characters: [actor] }, { characters: [enemy] }],
      battlefield: {
        getCharacterPosition: (model: Character) => {
          if (model.id === actor.id) return { x: 4, y: 4 };
          return { x: 9, y: 4 };
        },
      } as unknown as Battlefield,
      gameManager,
      aiController: {} as CharacterAI,
      turn: 1,
      sideIndex: 0,
      coordinatorSignal: {
        sideId: 'Alpha',
        amILeading: false,
        vpMargin: -1,
        priority: 'recover_deficit',
        potentialDirective: 'expand_potential',
        pressureDirective: 'mixed_pressure',
        urgency: 1.3,
      },
      config: createTestConfig(),
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      log,
      stats: createEmptyStats(),
      missionSides,
      missionVpBySide: { Alpha: 2, Bravo: 0 },
      missionRpBySide: { Alpha: 0, Bravo: 0 },
      missionSideIds: ['Alpha', 'Bravo'],
      eliminatedBPBySide: { Alpha: 0, Bravo: 0 },
      sideNameByCharacterId: new Map(),
      doctrineByCharacterId: new Map(),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 15,
      applyDoctrineLoadoutConfig: () => undefined,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
      },
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(log.some(entry =>
      entry.action === 'initiative_refresh'
      && typeof entry.detail === 'string'
      && entry.detail.includes('coordinator_unlock_pushing_momentum')
    )).toBe(true);
  });

  it('defers refresh spend ownership to coordinator recommendation when available', async () => {
    const actor = createCharacter('alpha-1', 'Alpha One');
    actor.state.delayTokens = 1;
    actor.state.isAttentive = true;
    actor.state.hasPushedThisInitiative = false;
    const enemy = createCharacter('bravo-1', 'Bravo One');

    const beginActivation = vi.fn().mockReturnValue(2);
    const refresh = vi.fn().mockImplementation((character: Character, side: any) => {
      character.state.delayTokens = Math.max(0, (character.state.delayTokens ?? 0) - 1);
      side.state.initiativePoints = Math.max(0, (side.state.initiativePoints ?? 0) - 1);
      return true;
    });
    const recommendRefreshInitiativeSpend = vi.fn(() => ({
      shouldSpend: true,
      reason: 'coordinator_unlock_pushing_momentum',
    }));
    const gameManager = {
      apPerActivation: 2,
      beginActivation,
      refresh,
      recommendRefreshInitiativeSpend,
      endActivation: vi.fn(),
    } as unknown as GameManager;
    const buildRuntime = vi.fn().mockReturnValue({
      missionState: {} as any,
      runtime: {} as any,
    });
    const runLoop = vi.fn().mockResolvedValue({ lastKnownAp: 1 });
    const log: any[] = [];
    const missionSides = [
      { id: 'Alpha', state: { initiativePoints: 1 } },
      { id: 'Bravo', state: { initiativePoints: 0 } },
    ] as any;

    await resolveCharacterTurnForRunner({
      character: actor,
      allSides: [{ characters: [actor] }, { characters: [enemy] }],
      battlefield: {
        getCharacterPosition: (model: Character) => {
          if (model.id === actor.id) return { x: 4, y: 4 };
          return { x: 9, y: 4 };
        },
      } as unknown as Battlefield,
      gameManager,
      aiController: {} as CharacterAI,
      turn: 1,
      sideIndex: 0,
      config: createTestConfig(),
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      log,
      stats: createEmptyStats(),
      missionSides,
      missionVpBySide: { Alpha: 2, Bravo: 0 },
      missionRpBySide: { Alpha: 0, Bravo: 0 },
      missionSideIds: ['Alpha', 'Bravo'],
      eliminatedBPBySide: { Alpha: 0, Bravo: 0 },
      sideNameByCharacterId: new Map(),
      doctrineByCharacterId: new Map(),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 16,
      applyDoctrineLoadoutConfig: () => undefined,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
      },
    });

    expect(recommendRefreshInitiativeSpend).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(log.some(entry =>
      entry.action === 'initiative_refresh'
      && typeof entry.detail === 'string'
      && entry.detail.includes('coordinator_unlock_pushing_momentum')
    )).toBe(true);
  });
});
