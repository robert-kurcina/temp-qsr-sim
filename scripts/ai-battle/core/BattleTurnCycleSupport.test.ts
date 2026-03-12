import { describe, expect, it, vi } from 'vitest';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { CharacterStatus } from '../../../src/lib/mest-tactics/core/types';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { GameConfig, TurnAudit } from '../../shared/BattleReportTypes';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import { runBattleTurnCycleForRunner } from './BattleTurnCycleSupport';

function createConfig(maxTurns = 2): GameConfig {
  return {
    missionId: 'QAI_11',
    missionName: 'Elimination',
    gameSize: GameSize.VERY_SMALL,
    battlefieldWidth: 18,
    battlefieldHeight: 24,
    maxTurns,
    endGameTurn: 99,
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
      isEliminated: false,
      isKOd: false,
    },
  } as unknown as Character;
}

describe('BattleTurnCycleSupport', () => {
  it('iterates turns until maxTurns when no end condition is met (fallback loop)', async () => {
    const alpha = createCharacter('a1', 'Alpha One');
    const bravo = createCharacter('b1', 'Bravo One');
    const startTurn = vi.fn();
    const gameManager = {
      startTurn,
      getSideCoordinatorManager: vi.fn().mockReturnValue(null),
      getSideStrategies: vi.fn().mockReturnValue({}),
    } as unknown as GameManager;
    const resolveCharacterTurn = vi.fn().mockResolvedValue(null);
    const auditTurns: TurnAudit[] = [];

    await runBattleTurnCycleForRunner({
      config: createConfig(2),
      sides: [{ characters: [alpha] }, { characters: [bravo] }],
      battlefield: {} as Battlefield,
      gameManager,
      missionSides: [] as any,
      missionRuntimeAdapter: null,
      getMissionImmediateWinnerSideId: () => null,
      log: [],
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      auditTurns,
      applyMissionRuntimeDelta: () => undefined,
      resolveCharacterTurn,
      verbose: false,
      out: () => undefined,
    });

    expect(startTurn).toHaveBeenCalledTimes(2);
    expect(resolveCharacterTurn).toHaveBeenCalledTimes(4);
    expect(auditTurns).toHaveLength(2);
    expect((gameManager as any).currentTurn).toBe(2);
  });

  it('uses game-manager activation queue when getNextToActivate is available', async () => {
    const alphaOne = createCharacter('a1', 'Alpha One');
    const alphaTwo = createCharacter('a2', 'Alpha Two');
    const bravoOne = createCharacter('b1', 'Bravo One');
    const queue: Character[] = [alphaTwo, bravoOne, alphaOne];
    const startTurn = vi.fn();
    const getNextToActivate = vi.fn(() => queue.shift());
    const gameManager = {
      startTurn,
      getNextToActivate,
      getSideCoordinatorManager: vi.fn().mockReturnValue(null),
      getSideStrategies: vi.fn().mockReturnValue({}),
    } as unknown as GameManager;
    const resolveCharacterTurn = vi.fn().mockResolvedValue(null);
    const auditTurns: TurnAudit[] = [];

    await runBattleTurnCycleForRunner({
      config: createConfig(1),
      sides: [{ characters: [alphaOne, alphaTwo] }, { characters: [bravoOne] }],
      battlefield: {} as Battlefield,
      gameManager,
      missionSides: [] as any,
      missionRuntimeAdapter: null,
      getMissionImmediateWinnerSideId: () => null,
      log: [],
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      auditTurns,
      applyMissionRuntimeDelta: () => undefined,
      resolveCharacterTurn,
      verbose: false,
      out: () => undefined,
    });

    const activatedIds = resolveCharacterTurn.mock.calls.map(call => call[0].character.id);
    expect(activatedIds).toEqual(['a2', 'b1', 'a1']);
    expect(startTurn).toHaveBeenCalledTimes(1);
    expect(auditTurns).toHaveLength(1);
  });

  it('spends maintain initiative to activate a nearby ready ally before opponents', async () => {
    const alphaLeader = createCharacter('a1', 'Alpha Leader');
    const alphaWing = createCharacter('a2', 'Alpha Wing');
    const bravo = createCharacter('b1', 'Bravo One');
    const statusById = new Map<string, CharacterStatus>([
      [alphaLeader.id, CharacterStatus.Ready],
      [alphaWing.id, CharacterStatus.Ready],
      [bravo.id, CharacterStatus.Ready],
    ]);

    const queueOrder = [alphaLeader, bravo, alphaWing];
    const startTurn = vi.fn();
    const getNextToActivate = vi.fn(() =>
      queueOrder.find(character => statusById.get(character.id) === CharacterStatus.Ready)
    );
    const maintainInitiative = vi.fn((side: any) => {
      if ((side.state.initiativePoints ?? 0) < 1) {
        return false;
      }
      side.state.initiativePoints -= 1;
      return true;
    });
    const gameManager = {
      apPerActivation: 2,
      startTurn,
      getNextToActivate,
      getCharacterStatus: (characterId: string) => statusById.get(characterId),
      maintainInitiative,
      getSideCoordinatorManager: vi.fn().mockReturnValue(null),
      getSideStrategies: vi.fn().mockReturnValue({}),
    } as unknown as GameManager;
    const resolveCharacterTurn = vi.fn().mockImplementation(async ({ character }) => {
      statusById.set(character.id, CharacterStatus.Done);
      return null;
    });
    const auditTurns: TurnAudit[] = [];
    const log: any[] = [];
    const config = createConfig(1);
    config.endGameTurn = 1; // Enable single-IP maintain spending in this test.

    await runBattleTurnCycleForRunner({
      config,
      sides: [{ characters: [alphaLeader, alphaWing] }, { characters: [bravo] }],
      battlefield: {
        getCharacterPosition: (character: Character) => {
          if (character.id === alphaLeader.id) return { x: 4, y: 4 };
          if (character.id === alphaWing.id) return { x: 8, y: 4 };
          return { x: 16, y: 4 };
        },
      } as unknown as Battlefield,
      gameManager,
      missionSides: [
        { id: 'Alpha', state: { initiativePoints: 1 } },
        { id: 'Bravo', state: { initiativePoints: 0 } },
      ] as any,
      missionRuntimeAdapter: null,
      getMissionImmediateWinnerSideId: () => null,
      log,
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      auditTurns,
      applyMissionRuntimeDelta: () => undefined,
      resolveCharacterTurn,
      verbose: false,
      out: () => undefined,
    });

    const activatedIds = resolveCharacterTurn.mock.calls.map(call => call[0].character.id);
    expect(activatedIds).toEqual(['a1', 'a2', 'b1']);
    expect(maintainInitiative).toHaveBeenCalledTimes(1);
    expect(log.some(entry => entry.action === 'initiative_maintain')).toBe(true);
  });

  it('spends force initiative to pull a high-opportunity model to the front of queue', async () => {
    const alphaSupport = createCharacter('a1', 'Alpha Support');
    alphaSupport.state.isAttentive = true;
    const alphaStriker = createCharacter('a2', 'Alpha Striker');
    alphaStriker.state.isAttentive = true;
    const bravo = createCharacter('b1', 'Bravo One');
    bravo.state.isAttentive = true;
    const statusById = new Map<string, CharacterStatus>([
      [alphaSupport.id, CharacterStatus.Ready],
      [alphaStriker.id, CharacterStatus.Ready],
      [bravo.id, CharacterStatus.Ready],
    ]);
    const activationOrder: Character[] = [alphaSupport, bravo, alphaStriker];
    const startTurn = vi.fn();
    const getNextToActivate = vi.fn(() =>
      activationOrder.find(character => statusById.get(character.id) === CharacterStatus.Ready)
    );
    const maintainInitiative = vi.fn(() => false);
    const forceInitiative = vi.fn((character: Character, side: any) => {
      if ((side?.state?.initiativePoints ?? 0) < 1) {
        return false;
      }
      const currentIndex = activationOrder.findIndex(entry => entry.id === character.id);
      if (currentIndex <= 0) {
        return false;
      }
      side.state.initiativePoints -= 1;
      const previous = activationOrder[currentIndex - 1];
      activationOrder[currentIndex - 1] = character;
      activationOrder[currentIndex] = previous;
      return true;
    });
    const gameManager = {
      apPerActivation: 2,
      activationOrder,
      startTurn,
      getNextToActivate,
      getCharacterStatus: (characterId: string) => statusById.get(characterId),
      forceInitiative,
      maintainInitiative,
      getSideCoordinatorManager: vi.fn().mockReturnValue(null),
      getSideStrategies: vi.fn().mockReturnValue({}),
    } as unknown as GameManager;
    const resolveCharacterTurn = vi.fn().mockImplementation(async ({ character }) => {
      statusById.set(character.id, CharacterStatus.Done);
      return null;
    });
    const auditTurns: TurnAudit[] = [];
    const log: any[] = [];
    const config = createConfig(1);
    config.endGameTurn = 4;

    await runBattleTurnCycleForRunner({
      config,
      sides: [{ characters: [alphaSupport, alphaStriker] }, { characters: [bravo] }],
      battlefield: {
        getCharacterPosition: (character: Character) => {
          if (character.id === alphaSupport.id) return { x: 0, y: 0 };
          if (character.id === alphaStriker.id) return { x: 8, y: 0 };
          return { x: 9, y: 0 };
        },
      } as unknown as Battlefield,
      gameManager,
      missionSides: [
        { id: 'Alpha', state: { initiativePoints: 2 } },
        { id: 'Bravo', state: { initiativePoints: 0 } },
      ] as any,
      missionRuntimeAdapter: null,
      getMissionImmediateWinnerSideId: () => null,
      log,
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      auditTurns,
      applyMissionRuntimeDelta: () => undefined,
      resolveCharacterTurn,
      verbose: false,
      out: () => undefined,
    });

    const activatedIds = resolveCharacterTurn.mock.calls.map(call => call[0].character.id);
    expect(activatedIds[0]).toBe('a2');
    expect(forceInitiative).toHaveBeenCalledTimes(2);
    expect(log.some(entry => entry.action === 'initiative_force')).toBe(true);
  });

  it('uses coordinator urgency to allow force initiative on moderate opportunity gains', async () => {
    const alphaFront = createCharacter('a1', 'Alpha Front');
    alphaFront.state.isAttentive = false;
    const alphaCandidate = createCharacter('a2', 'Alpha Candidate');
    alphaCandidate.state.isAttentive = true;
    alphaCandidate.state.hasPushedThisInitiative = false;
    alphaCandidate.state.delayTokens = 0;
    const bravo = createCharacter('b1', 'Bravo One');

    const statusById = new Map<string, CharacterStatus>([
      [alphaFront.id, CharacterStatus.Ready],
      [alphaCandidate.id, CharacterStatus.Ready],
      [bravo.id, CharacterStatus.Ready],
    ]);
    const activationOrder: Character[] = [alphaFront, alphaCandidate, bravo];
    const startTurn = vi.fn();
    const getNextToActivate = vi.fn(() =>
      activationOrder.find(character => statusById.get(character.id) === CharacterStatus.Ready)
    );
    const maintainInitiative = vi.fn(() => false);
    const forceInitiative = vi.fn((character: Character, side: any) => {
      if ((side?.state?.initiativePoints ?? 0) < 1) {
        return false;
      }
      const currentIndex = activationOrder.findIndex(entry => entry.id === character.id);
      if (currentIndex <= 0) {
        return false;
      }
      side.state.initiativePoints -= 1;
      const previous = activationOrder[currentIndex - 1];
      activationOrder[currentIndex - 1] = character;
      activationOrder[currentIndex] = previous;
      return true;
    });
    const gameManager = {
      apPerActivation: 2,
      activationOrder,
      startTurn,
      getNextToActivate,
      getCharacterStatus: (characterId: string) => statusById.get(characterId),
      forceInitiative,
      maintainInitiative,
      getSideCoordinatorManager: vi.fn().mockReturnValue(null),
      getSideStrategies: vi.fn().mockReturnValue({
        Alpha: {
          doctrine: 'operative',
          advice: ['Recover deficit'],
          context: {
            amILeading: false,
            vpMargin: -1,
            winningKeys: [],
            losingKeys: ['first_blood'],
          },
          decisionTrace: [
            {
              turn: 1,
              sideId: 'Alpha',
              doctrine: 'operative',
              observations: {
                amILeading: false,
                vpMargin: -1,
                winningKeys: [],
                losingKeys: ['first_blood'],
                topOpponentKeyPressure: [],
                topTargetCommitments: [],
                topScrumContinuity: [],
                topLanePressure: [],
                fractionalPotential: {
                  myVpPotential: 0,
                  opponentVpPotential: 1,
                  potentialDelta: -1,
                  urgency: 1.25,
                },
              },
              response: {
                priority: 'recover_deficit',
                advice: ['Recover deficit'],
                focusTargets: [],
                potentialDirective: 'expand_potential',
                pressureDirective: 'mixed_pressure',
              },
            },
          ],
        },
      }),
    } as unknown as GameManager;
    const resolveCharacterTurn = vi.fn().mockImplementation(async ({ character }) => {
      statusById.set(character.id, CharacterStatus.Done);
      return null;
    });
    const auditTurns: TurnAudit[] = [];
    const log: any[] = [];

    await runBattleTurnCycleForRunner({
      config: createConfig(1),
      sides: [{ characters: [alphaFront, alphaCandidate] }, { characters: [bravo] }],
      battlefield: {
        getCharacterPosition: (character: Character) => {
          if (character.id === alphaFront.id) return { x: 0, y: 0 };
          if (character.id === alphaCandidate.id) return { x: 0, y: 1 };
          return { x: 20, y: 20 };
        },
      } as unknown as Battlefield,
      gameManager,
      missionSides: [
        { id: 'Alpha', state: { initiativePoints: 1 } },
        { id: 'Bravo', state: { initiativePoints: 0 } },
      ] as any,
      missionRuntimeAdapter: null,
      getMissionImmediateWinnerSideId: () => null,
      log,
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      auditTurns,
      applyMissionRuntimeDelta: () => undefined,
      resolveCharacterTurn,
      verbose: false,
      out: () => undefined,
    });

    const activatedIds = resolveCharacterTurn.mock.calls.map(call => call[0].character.id);
    expect(activatedIds[0]).toBe('a2');
    expect(forceInitiative).toHaveBeenCalledTimes(1);
    expect(log.some(entry =>
      entry.action === 'initiative_force'
      && typeof entry.detail === 'string'
      && entry.detail.includes('coordinator_')
    )).toBe(true);
  });

  it('fetches coordinator strategy after scoring-context updates for current-turn IP decisions', async () => {
    const alphaFront = createCharacter('a1', 'Alpha Front');
    alphaFront.state.isAttentive = false;
    const alphaCandidate = createCharacter('a2', 'Alpha Candidate');
    alphaCandidate.state.isAttentive = true;
    alphaCandidate.state.hasPushedThisInitiative = false;
    alphaCandidate.state.delayTokens = 0;
    const bravo = createCharacter('b1', 'Bravo One');

    const statusById = new Map<string, CharacterStatus>([
      [alphaFront.id, CharacterStatus.Ready],
      [alphaCandidate.id, CharacterStatus.Ready],
      [bravo.id, CharacterStatus.Ready],
    ]);
    const activationOrder: Character[] = [alphaFront, alphaCandidate, bravo];
    let coordinatorUpdated = false;

    const startTurn = vi.fn();
    const getNextToActivate = vi.fn(() =>
      activationOrder.find(character => statusById.get(character.id) === CharacterStatus.Ready)
    );
    const maintainInitiative = vi.fn(() => false);
    const forceInitiative = vi.fn((character: Character, side: any) => {
      if ((side?.state?.initiativePoints ?? 0) < 1) {
        return false;
      }
      const currentIndex = activationOrder.findIndex(entry => entry.id === character.id);
      if (currentIndex <= 0) {
        return false;
      }
      side.state.initiativePoints -= 1;
      const previous = activationOrder[currentIndex - 1];
      activationOrder[currentIndex - 1] = character;
      activationOrder[currentIndex] = previous;
      return true;
    });
    const updateAllScoringContexts = vi.fn(() => {
      coordinatorUpdated = true;
    });
    const getSideStrategies = vi.fn(() => ({
      Alpha: coordinatorUpdated
        ? {
            doctrine: 'operative',
            advice: ['Recover deficit'],
            context: {
              amILeading: false,
              vpMargin: -1,
              winningKeys: [],
              losingKeys: ['first_blood'],
            },
            decisionTrace: [
              {
                turn: 1,
                sideId: 'Alpha',
                doctrine: 'operative',
                observations: {
                  amILeading: false,
                  vpMargin: -1,
                  winningKeys: [],
                  losingKeys: ['first_blood'],
                  topOpponentKeyPressure: [],
                  topTargetCommitments: [],
                  topScrumContinuity: [],
                  topLanePressure: [],
                  fractionalPotential: {
                    myVpPotential: 0,
                    opponentVpPotential: 1,
                    potentialDelta: -1,
                    urgency: 1.25,
                  },
                },
                response: {
                  priority: 'recover_deficit',
                  advice: ['Recover deficit'],
                  focusTargets: [],
                  potentialDirective: 'expand_potential',
                  pressureDirective: 'mixed_pressure',
                },
              },
            ],
          }
        : {
            doctrine: 'operative',
            advice: ['Hold'],
            context: {
              amILeading: true,
              vpMargin: 2,
              winningKeys: ['first_blood'],
              losingKeys: [],
            },
            decisionTrace: [
              {
                turn: 1,
                sideId: 'Alpha',
                doctrine: 'operative',
                observations: {
                  amILeading: true,
                  vpMargin: 2,
                  winningKeys: ['first_blood'],
                  losingKeys: [],
                  topOpponentKeyPressure: [],
                  topTargetCommitments: [],
                  topScrumContinuity: [],
                  topLanePressure: [],
                  fractionalPotential: {
                    myVpPotential: 1,
                    opponentVpPotential: 0,
                    potentialDelta: 1,
                    urgency: 0.2,
                  },
                },
                response: {
                  priority: 'press_advantage',
                  advice: ['Hold'],
                  focusTargets: [],
                  potentialDirective: 'protect_current_lead',
                  pressureDirective: 'no_pressure_lock',
                },
              },
            ],
          },
    }));
    const gameManager = {
      apPerActivation: 2,
      activationOrder,
      startTurn,
      getNextToActivate,
      getCharacterStatus: (characterId: string) => statusById.get(characterId),
      forceInitiative,
      maintainInitiative,
      getSideCoordinatorManager: vi.fn().mockReturnValue({
        updateAllScoringContexts,
      }),
      getSideStrategies,
    } as unknown as GameManager;
    const resolveCharacterTurn = vi.fn().mockImplementation(async ({ character }) => {
      statusById.set(character.id, CharacterStatus.Done);
      return null;
    });
    const auditTurns: TurnAudit[] = [];
    const log: any[] = [];

    await runBattleTurnCycleForRunner({
      config: createConfig(1),
      sides: [{ characters: [alphaFront, alphaCandidate] }, { characters: [bravo] }],
      battlefield: {
        getCharacterPosition: (character: Character) => {
          if (character.id === alphaFront.id) return { x: 0, y: 0 };
          if (character.id === alphaCandidate.id) return { x: 0, y: 1 };
          return { x: 20, y: 20 };
        },
      } as unknown as Battlefield,
      gameManager,
      missionSides: [
        { id: 'Alpha', state: { initiativePoints: 1, keyScores: {} } },
        { id: 'Bravo', state: { initiativePoints: 0, keyScores: {} } },
      ] as any,
      missionRuntimeAdapter: null,
      getMissionImmediateWinnerSideId: () => null,
      log,
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      auditTurns,
      applyMissionRuntimeDelta: () => undefined,
      resolveCharacterTurn,
      verbose: false,
      out: () => undefined,
    });

    expect(updateAllScoringContexts).toHaveBeenCalledTimes(1);
    expect(getSideStrategies).toHaveBeenCalledTimes(1);
    expect(updateAllScoringContexts.mock.invocationCallOrder[0]).toBeLessThan(
      getSideStrategies.mock.invocationCallOrder[0]
    );
    expect(forceInitiative).toHaveBeenCalledTimes(1);
    expect(resolveCharacterTurn.mock.calls[0][0].character.id).toBe('a2');
    expect(log.some(entry => entry.action === 'initiative_force')).toBe(true);
  });

  it('prefers coordinator-manager initiative signals for current-turn force decisions', async () => {
    const alphaFront = createCharacter('a1', 'Alpha Front');
    alphaFront.state.isAttentive = false;
    const alphaCandidate = createCharacter('a2', 'Alpha Candidate');
    alphaCandidate.state.isAttentive = true;
    alphaCandidate.state.hasPushedThisInitiative = false;
    alphaCandidate.state.delayTokens = 0;
    const bravo = createCharacter('b1', 'Bravo One');

    const statusById = new Map<string, CharacterStatus>([
      [alphaFront.id, CharacterStatus.Ready],
      [alphaCandidate.id, CharacterStatus.Ready],
      [bravo.id, CharacterStatus.Ready],
    ]);
    const activationOrder: Character[] = [alphaFront, alphaCandidate, bravo];
    let coordinatorUpdated = false;

    const startTurn = vi.fn();
    const getNextToActivate = vi.fn(() =>
      activationOrder.find(character => statusById.get(character.id) === CharacterStatus.Ready)
    );
    const forceInitiative = vi.fn((character: Character, side: any) => {
      if ((side?.state?.initiativePoints ?? 0) < 1) {
        return false;
      }
      const currentIndex = activationOrder.findIndex(entry => entry.id === character.id);
      if (currentIndex <= 0) {
        return false;
      }
      side.state.initiativePoints -= 1;
      const previous = activationOrder[currentIndex - 1];
      activationOrder[currentIndex - 1] = character;
      activationOrder[currentIndex] = previous;
      return true;
    });
    const updateAllScoringContexts = vi.fn(() => {
      coordinatorUpdated = true;
    });
    const getSideInitiativeSignals = vi.fn(() => ({
      Alpha: coordinatorUpdated
        ? {
            sideId: 'Alpha',
            turn: 1,
            amILeading: false,
            vpMargin: -1,
            priority: 'recover_deficit',
            potentialDirective: 'expand_potential',
            pressureDirective: 'mixed_pressure',
            urgency: 1.3,
          }
        : {
            sideId: 'Alpha',
            turn: 1,
            amILeading: true,
            vpMargin: 2,
            priority: 'press_advantage',
            potentialDirective: 'protect_current_lead',
            pressureDirective: 'no_pressure_lock',
            urgency: 0.2,
          },
    }));
    const gameManager = {
      apPerActivation: 2,
      activationOrder,
      startTurn,
      getNextToActivate,
      getCharacterStatus: (characterId: string) => statusById.get(characterId),
      forceInitiative,
      maintainInitiative: vi.fn(() => false),
      getSideCoordinatorManager: vi.fn().mockReturnValue({
        updateAllScoringContexts,
      }),
      getSideInitiativeSignals,
      getSideStrategies: vi.fn().mockReturnValue({}),
    } as unknown as GameManager;
    const resolveCharacterTurn = vi.fn().mockImplementation(async ({ character }) => {
      statusById.set(character.id, CharacterStatus.Done);
      return null;
    });

    await runBattleTurnCycleForRunner({
      config: createConfig(1),
      sides: [{ characters: [alphaFront, alphaCandidate] }, { characters: [bravo] }],
      battlefield: {
        getCharacterPosition: (character: Character) => {
          if (character.id === alphaFront.id) return { x: 0, y: 0 };
          if (character.id === alphaCandidate.id) return { x: 0, y: 1 };
          return { x: 20, y: 20 };
        },
      } as unknown as Battlefield,
      gameManager,
      missionSides: [
        { id: 'Alpha', state: { initiativePoints: 1, keyScores: {} } },
        { id: 'Bravo', state: { initiativePoints: 0, keyScores: {} } },
      ] as any,
      missionRuntimeAdapter: null,
      getMissionImmediateWinnerSideId: () => null,
      log: [],
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      auditTurns: [],
      applyMissionRuntimeDelta: () => undefined,
      resolveCharacterTurn,
      verbose: false,
      out: () => undefined,
    });

    expect(updateAllScoringContexts).toHaveBeenCalledTimes(1);
    expect(getSideInitiativeSignals).toHaveBeenCalledTimes(1);
    expect(updateAllScoringContexts.mock.invocationCallOrder[0]).toBeLessThan(
      getSideInitiativeSignals.mock.invocationCallOrder[0]
    );
    expect(forceInitiative).toHaveBeenCalledTimes(1);
    expect(resolveCharacterTurn.mock.calls[0][0].character.id).toBe('a2');
  });

  it('defers force spend ownership to coordinator recommendation when available', async () => {
    const alphaFront = createCharacter('a1', 'Alpha Front');
    const alphaCandidate = createCharacter('a2', 'Alpha Candidate');
    alphaCandidate.state.isAttentive = true;
    const bravo = createCharacter('b1', 'Bravo One');

    const statusById = new Map<string, CharacterStatus>([
      [alphaFront.id, CharacterStatus.Ready],
      [alphaCandidate.id, CharacterStatus.Ready],
      [bravo.id, CharacterStatus.Ready],
    ]);
    const activationOrder: Character[] = [alphaFront, alphaCandidate, bravo];

    const startTurn = vi.fn();
    const getNextToActivate = vi.fn(() =>
      activationOrder.find(character => statusById.get(character.id) === CharacterStatus.Ready)
    );
    const forceInitiative = vi.fn(() => true);
    const recommendForceInitiativeSpend = vi.fn(() => ({
      shouldSpend: false,
      reason: 'defensive_reserve',
    }));
    const gameManager = {
      apPerActivation: 2,
      activationOrder,
      startTurn,
      getNextToActivate,
      getCharacterStatus: (characterId: string) => statusById.get(characterId),
      forceInitiative,
      maintainInitiative: vi.fn(() => false),
      getSideCoordinatorManager: vi.fn().mockReturnValue({
        updateAllScoringContexts: vi.fn(),
      }),
      getSideInitiativeSignals: vi.fn(() => ({
        Alpha: {
          sideId: 'Alpha',
          turn: 1,
          amILeading: true,
          vpMargin: 2,
          priority: 'press_advantage',
          potentialDirective: 'protect_current_lead',
          pressureDirective: 'no_pressure_lock',
          urgency: 0.2,
        },
      })),
      recommendForceInitiativeSpend,
      getSideStrategies: vi.fn().mockReturnValue({}),
    } as unknown as GameManager;
    const resolveCharacterTurn = vi.fn().mockImplementation(async ({ character }) => {
      statusById.set(character.id, CharacterStatus.Done);
      return null;
    });

    await runBattleTurnCycleForRunner({
      config: createConfig(1),
      sides: [{ characters: [alphaFront, alphaCandidate] }, { characters: [bravo] }],
      battlefield: {
        getCharacterPosition: (character: Character) => {
          if (character.id === alphaFront.id) return { x: 0, y: 0 };
          if (character.id === alphaCandidate.id) return { x: 0, y: 1 };
          return { x: 20, y: 20 };
        },
      } as unknown as Battlefield,
      gameManager,
      missionSides: [
        { id: 'Alpha', state: { initiativePoints: 1, keyScores: {} } },
        { id: 'Bravo', state: { initiativePoints: 0, keyScores: {} } },
      ] as any,
      missionRuntimeAdapter: null,
      getMissionImmediateWinnerSideId: () => null,
      log: [],
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      auditTurns: [],
      applyMissionRuntimeDelta: () => undefined,
      resolveCharacterTurn,
      verbose: false,
      out: () => undefined,
    });

    expect(recommendForceInitiativeSpend).toHaveBeenCalledTimes(1);
    expect(forceInitiative).not.toHaveBeenCalled();
    expect(resolveCharacterTurn.mock.calls[0][0].character.id).toBe('a1');
  });

  it('stops after first turn when mission immediate winner is present', async () => {
    const alpha = createCharacter('a1', 'Alpha One');
    const bravo = createCharacter('b1', 'Bravo One');
    const startTurn = vi.fn();
    const gameManager = {
      startTurn,
      getSideCoordinatorManager: vi.fn().mockReturnValue(null),
      getSideStrategies: vi.fn().mockReturnValue({}),
    } as unknown as GameManager;
    const resolveCharacterTurn = vi.fn().mockResolvedValue(null);
    const auditTurns: TurnAudit[] = [];

    await runBattleTurnCycleForRunner({
      config: createConfig(5),
      sides: [{ characters: [alpha] }, { characters: [bravo] }],
      battlefield: {} as Battlefield,
      gameManager,
      missionSides: [] as any,
      missionRuntimeAdapter: null,
      getMissionImmediateWinnerSideId: () => 'Alpha',
      log: [],
      tracker: new StatisticsTracker(),
      profiler: new PerformanceProfiler(),
      auditTurns,
      applyMissionRuntimeDelta: () => undefined,
      resolveCharacterTurn,
      verbose: false,
      out: () => undefined,
    });

    expect(startTurn).toHaveBeenCalledTimes(1);
    expect(resolveCharacterTurn).toHaveBeenCalledTimes(2);
    expect(auditTurns).toHaveLength(1);
  });
});
