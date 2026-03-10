import { describe, expect, it } from 'vitest';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import {
  buildBattleReportForRunner,
  buildFinalCountsForRunner,
  resolveWinnerForRunner,
  resolveWinnerResolutionForRunner,
} from './BattleReportFinalizationSupport';

function createTestCharacter(id: string, name: string, eliminated = false): Character {
  return {
    id,
    profile: {
      name,
      archetype: 'Average',
      totalBp: 20,
      burden: { totalBurden: 0 },
      equipment: [],
    },
    attributes: { int: 5 },
    finalAttributes: { int: 5 },
    state: {
      wounds: 0,
      delayTokens: 0,
      fearTokens: 0,
      isKOd: false,
      isEliminated: eliminated,
      isHidden: false,
      isWaiting: false,
      isAttentive: true,
      isOrdered: true,
    },
  } as unknown as Character;
}

describe('BattleReportFinalizationSupport', () => {
  it('counts only non-eliminated and non-KO models', () => {
    const alphaAlive = createTestCharacter('a1', 'Alpha One');
    const alphaGone = createTestCharacter('a2', 'Alpha Two', true);
    const bravoAlive = createTestCharacter('b1', 'Bravo One');

    const counts = buildFinalCountsForRunner([
      { characters: [alphaAlive, alphaGone] },
      { characters: [bravoAlive] },
    ]);

    expect(counts).toEqual([1, 1]);
  });

  it('prefers mission winner over model-count winner', () => {
    const winner = resolveWinnerForRunner({
      config: {
        missionId: 'QAI_11',
        missionName: 'Elimination',
        gameSize: GameSize.VERY_SMALL,
        battlefieldWidth: 18,
        battlefieldHeight: 24,
        maxTurns: 6,
        endGameTurn: 4,
        sides: [
          { name: 'Alpha', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Alpha Assembly' },
          { name: 'Bravo', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Bravo Assembly' },
        ],
        densityRatio: 0,
        lighting: 'Day, Clear' as any,
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: false,
        perCharacterFovLos: false,
        verbose: false,
      },
      finalCounts: [2, 0],
      missionImmediateWinnerSideId: 'Bravo',
      missionVpBySide: { Alpha: 0, Bravo: 1 },
      currentGameManager: null,
    });

    expect(winner).toBe('Bravo');
  });

  it('builds report with fallback winner from final counts', () => {
    const alpha = createTestCharacter('a1', 'Alpha One');
    const bravo = createTestCharacter('b1', 'Bravo One', true);
    const battlefield = new Battlefield(18, 24);
    const tracker = new StatisticsTracker();
    const profiler = new PerformanceProfiler();

    const report = buildBattleReportForRunner({
      config: {
        missionId: 'QAI_11',
        missionName: 'Elimination',
        gameSize: GameSize.VERY_SMALL,
        battlefieldWidth: 18,
        battlefieldHeight: 24,
        maxTurns: 6,
        endGameTurn: 4,
        sides: [
          { name: 'Alpha', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Alpha Assembly' },
          { name: 'Bravo', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Bravo Assembly' },
        ],
        densityRatio: 0,
        lighting: 'Day, Clear' as any,
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: false,
        perCharacterFovLos: false,
        verbose: false,
      },
      sides: [
        { characters: [alpha], totalBP: 100 },
        { characters: [bravo], totalBP: 100 },
      ],
      battlefield,
      startPositions: new Map(),
      missionSides: [
        { id: 'Alpha', members: [{ character: alpha }], state: { predictedVp: 0, predictedRp: 0, keyScores: {} } },
        { id: 'Bravo', members: [{ character: bravo }], state: { predictedVp: 0, predictedRp: 0, keyScores: {} } },
      ] as any,
      missionImmediateWinnerSideId: null,
      missionVpBySide: { Alpha: 0, Bravo: 0 },
      missionRpBySide: { Alpha: 0, Bravo: 0 },
      currentGameManager: null,
      doctrineByCharacterId: new Map([['a1', TacticalDoctrine.Operative]]),
      tracker,
      log: [],
      auditTurns: [],
      battlefieldExportPath: null,
      profiler,
      aiControllers: new Map(),
      modelUsageByCharacter: new Map(),
      seed: 123,
    });

    expect(report.winner).toBe('Alpha');
    expect(report.finalCounts).toEqual([
      { name: 'Alpha', remaining: 1 },
      { name: 'Bravo', remaining: 0 },
    ]);
    expect(report.missionRuntime?.vpBySide.Alpha).toBe(0);
    expect(report.seed).toBe(123);
  });

  it('breaks VP ties in favor of initiative-card holder side', () => {
    const winner = resolveWinnerForRunner({
      config: {
        missionId: 'QAI_11',
        missionName: 'Elimination',
        gameSize: GameSize.VERY_SMALL,
        battlefieldWidth: 18,
        battlefieldHeight: 24,
        maxTurns: 6,
        endGameTurn: 4,
        sides: [
          { name: 'Alpha', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Alpha Assembly' },
          { name: 'Bravo', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Bravo Assembly' },
        ],
        densityRatio: 0,
        lighting: 'Day, Clear' as any,
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: false,
        perCharacterFovLos: false,
        initiativeCardTieBreakerOnTie: true,
        verbose: false,
      },
      finalCounts: [0, 2],
      missionImmediateWinnerSideId: null,
      missionVpBySide: { Alpha: 3, Bravo: 3 },
      currentGameManager: { lastInitiativeWinnerSideId: 'Alpha' } as any,
    });

    expect(winner).toBe('Alpha');
  });

  it('reports winner metadata when initiative-card tie-break resolves a VP tie', () => {
    const resolution = resolveWinnerResolutionForRunner({
      config: {
        missionId: 'QAI_11',
        missionName: 'Elimination',
        gameSize: GameSize.VERY_SMALL,
        battlefieldWidth: 18,
        battlefieldHeight: 24,
        maxTurns: 6,
        endGameTurn: 4,
        sides: [
          { name: 'Alpha', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Alpha Assembly' },
          { name: 'Bravo', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Bravo Assembly' },
        ],
        densityRatio: 0,
        lighting: 'Day, Clear' as any,
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: false,
        perCharacterFovLos: false,
        initiativeCardTieBreakerOnTie: true,
        verbose: false,
      },
      finalCounts: [0, 2],
      missionImmediateWinnerSideId: null,
      missionVpBySide: { Alpha: 2, Bravo: 2 },
      currentGameManager: { lastInitiativeWinnerSideId: 'Alpha' } as any,
    });

    expect(resolution.winner).toBe('Alpha');
    expect(resolution.winnerReason).toBe('initiative_card');
    expect(resolution.tieBreakMethod).toBe('initiative_card');
  });

  it('can disable initiative-card tie-breaker and fall back to model counts', () => {
    const winner = resolveWinnerForRunner({
      config: {
        missionId: 'QAI_11',
        missionName: 'Elimination',
        gameSize: GameSize.VERY_SMALL,
        battlefieldWidth: 18,
        battlefieldHeight: 24,
        maxTurns: 6,
        endGameTurn: 4,
        sides: [
          { name: 'Alpha', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Alpha Assembly' },
          { name: 'Bravo', bp: 100, modelCount: 1, tacticalDoctrine: TacticalDoctrine.Operative, assemblyName: 'Bravo Assembly' },
        ],
        densityRatio: 0,
        lighting: 'Day, Clear' as any,
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: false,
        perCharacterFovLos: false,
        initiativeCardTieBreakerOnTie: false,
        verbose: false,
      },
      finalCounts: [0, 2],
      missionImmediateWinnerSideId: null,
      missionVpBySide: { Alpha: 3, Bravo: 3 },
      currentGameManager: { lastInitiativeWinnerSideId: 'Alpha' } as any,
    });

    expect(winner).toBe('Bravo');
  });
});
