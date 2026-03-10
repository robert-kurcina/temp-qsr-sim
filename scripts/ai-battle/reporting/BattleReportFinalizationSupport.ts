import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { CharacterAI } from '../../../src/lib/mest-tactics/ai/core/CharacterAI';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { cloneSideResourceMaps } from '../../../src/lib/mest-tactics/ai/executor/SideResourceSnapshot';
import type {
  BattleLogEntry,
  BattleReport,
  GameConfig,
  ModelUsageStats,
  TurnAudit,
} from '../../shared/BattleReportTypes';
import type { AuditLevel } from '../AIBattleConfig';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import { attachMinimaxPerformanceCaches } from '../instrumentation/PerformanceSummaryBuilder';
import { buildNestedSectionsForBattle } from './NestedSectionsBuilder';
import { buildBattleAuditTraceFromRuntime } from './BattleAuditTraceBuilder';
import { buildUsageMetrics, snapshotModelState } from './BattleAuditHelpers';
import { buildBattleEntityManifestForRunner } from './BattleEntityManifestBuilder';
import { formatBattleReportHumanReadable } from './BattleReportFormatter';
import { writeBattlefieldSvg } from './BattleReportWriter';
import {
  buildPredictedScoringForRunner,
  buildSideStrategiesForRunner,
} from '../core/StrategyReportingSupport';
import { resolveMissionWinnerNameForRunner } from '../core/MissionRuntimeSupport';

export interface WinnerResolutionForRunner {
  winner: string;
  winnerReason: 'mission_immediate' | 'mission_vp' | 'initiative_card' | 'remaining_models' | 'draw' | 'none';
  tieBreakMethod: 'none' | 'initiative_card';
}

export function buildFinalCountsForRunner(
  sides: Array<{ characters: Character[] }>
): number[] {
  return sides.map(side =>
    side.characters.filter(character => !character.state.isEliminated && !character.state.isKOd).length
  );
}

export function resolveWinnerResolutionForRunner(args: {
  config: GameConfig;
  finalCounts: number[];
  missionImmediateWinnerSideId: string | null;
  missionVpBySide: Record<string, number>;
  currentGameManager: GameManager | null;
}): WinnerResolutionForRunner {
  if (args.missionImmediateWinnerSideId) {
    return {
      winner: args.missionImmediateWinnerSideId,
      winnerReason: 'mission_immediate',
      tieBreakMethod: 'none',
    };
  }

  const missionWinner = resolveMissionWinnerNameForRunner({
    missionImmediateWinnerSideId: args.missionImmediateWinnerSideId,
    missionVpBySide: args.missionVpBySide,
  });
  if (missionWinner) {
    return {
      winner: missionWinner,
      winnerReason: 'mission_vp',
      tieBreakMethod: 'none',
    };
  }

  const vpEntries = Object.entries(args.missionVpBySide);
  if (vpEntries.length > 1) {
    const topVp = Math.max(...vpEntries.map(([, vp]) => vp));
    const vpTieSides = vpEntries
      .filter(([, vp]) => vp === topVp)
      .map(([sideId]) => sideId);
    if (vpTieSides.length > 1 && (args.config.initiativeCardTieBreakerOnTie ?? true)) {
      const initiativeCardHolder = args.config.initiativeCardHolderSideId
        ?? args.currentGameManager?.lastInitiativeWinnerSideId
        ?? null;
      if (initiativeCardHolder && vpTieSides.includes(initiativeCardHolder)) {
        return {
          winner: initiativeCardHolder,
          winnerReason: 'initiative_card',
          tieBreakMethod: 'initiative_card',
        };
      }
    }
  }

  const maxRemaining = Math.max(...args.finalCounts);
  const winners = args.config.sides.filter((_, index) => args.finalCounts[index] === maxRemaining);
  if (winners.length === 1) {
    return {
      winner: winners[0].name,
      winnerReason: 'remaining_models',
      tieBreakMethod: 'none',
    };
  }
  return {
    winner: winners.length === 0 ? 'None' : 'Draw',
    winnerReason: winners.length === 0 ? 'none' : 'draw',
    tieBreakMethod: 'none',
  };
}

export function resolveWinnerForRunner(args: {
  config: GameConfig;
  finalCounts: number[];
  missionImmediateWinnerSideId: string | null;
  missionVpBySide: Record<string, number>;
  currentGameManager: GameManager | null;
}): string {
  return resolveWinnerResolutionForRunner(args).winner;
}

export function buildBattleReportForRunner(args: {
  config: GameConfig;
  sides: Array<{ characters: Character[]; totalBP: number }>;
  battlefield: Battlefield;
  startPositions: Map<string, Position>;
  missionSides: MissionSide[];
  missionImmediateWinnerSideId: string | null;
  missionVpBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  currentGameManager: GameManager | null;
  doctrineByCharacterId: Map<string, TacticalDoctrine>;
  tracker: StatisticsTracker;
  log: BattleLogEntry[];
  auditTurns: TurnAudit[];
  battlefieldExportPath: string | null;
  profiler: PerformanceProfiler;
  aiControllers: Map<string, CharacterAI>;
  modelUsageByCharacter: Map<Character, ModelUsageStats>;
  seed?: number;
  auditLevel?: AuditLevel;
}): BattleReport {
  const finalCounts = buildFinalCountsForRunner(args.sides);
  const winnerResolution = resolveWinnerResolutionForRunner({
    config: args.config,
    finalCounts,
    missionImmediateWinnerSideId: args.missionImmediateWinnerSideId,
    missionVpBySide: args.missionVpBySide,
    currentGameManager: args.currentGameManager,
  });
  const usage = buildUsageMetrics(args.modelUsageByCharacter);
  const finalResourceSnapshot = cloneSideResourceMaps(args.missionVpBySide, args.missionRpBySide);
  const entities = buildBattleEntityManifestForRunner({
    config: args.config,
    sides: args.sides,
  });
  const auditLevel: AuditLevel = args.auditLevel
    ?? args.config.auditLevel
    ?? ((args.config.viewer || args.config.audit) ? 'full' : 'none');
  const includeAudit = auditLevel !== 'none';
  const auditTrace = includeAudit
    ? buildBattleAuditTraceFromRuntime({
        config: args.config,
        seed: args.seed,
        turns: args.auditTurns,
        battlefieldExportPath: args.battlefieldExportPath,
        battlefield: args.battlefield,
        auditLevel,
      })
    : undefined;

  return {
    config: args.config,
    winner: winnerResolution.winner,
    winnerReason: winnerResolution.winnerReason,
    tieBreakMethod: winnerResolution.tieBreakMethod,
    finalCounts: args.config.sides.map((side, index) => ({
      name: side.name,
      remaining: finalCounts[index],
    })),
    stats: args.tracker.getStats(),
    missionRuntime: {
      vpBySide: finalResourceSnapshot.vpBySide,
      rpBySide: finalResourceSnapshot.rpBySide,
      immediateWinnerSideId: args.missionImmediateWinnerSideId ?? undefined,
      predictedScoring: buildPredictedScoringForRunner(args.missionSides),
    },
    sideStrategies: buildSideStrategiesForRunner({
      managerStrategies: args.currentGameManager?.getSideStrategies?.(),
      missionSides: args.missionSides,
      doctrineByCharacterId: args.doctrineByCharacterId,
    }),
    usage,
    entities,
    nestedSections: buildNestedSectionsForBattle(
      args.config,
      args.sides,
      args.battlefield,
      args.startPositions,
      character => snapshotModelState(character)
    ),
    advancedRules: args.tracker.getAdvancedRules(),
    log: args.log,
    audit: auditTrace,
    performance: attachMinimaxPerformanceCaches(
      args.profiler.buildPerformanceSummary(args.battlefield),
      args.battlefield,
      args.aiControllers
    ),
    seed: args.seed,
  };
}

export function emitBattleReportOutputForRunner(args: {
  report: BattleReport;
  battlefield: Battlefield;
  config: GameConfig;
  outputEnabled: boolean;
}): string {
  const svgPath = writeBattlefieldSvg(args.battlefield, args.config);
  if (args.outputEnabled) {
    console.log(`🗺️  Battlefield SVG: ${svgPath}`);
    console.log(`\n${formatBattleReportHumanReadable(args.report)}\n`);
  }
  return svgPath;
}
