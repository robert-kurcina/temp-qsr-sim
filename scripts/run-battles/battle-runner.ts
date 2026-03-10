/**
 * Legacy Battle Runner Compatibility Layer
 *
 * This module preserves the historical battle-runner API surface while
 * delegating execution to the canonical AIBattleRunner runtime.
 */

import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { AIBattleRunner } from '../ai-battle/AIBattleRunner';
import type { BattleReport } from '../shared/BattleReportTypes';
import {
  buildCanonicalGameConfig,
  MISSION_NAME_BY_ID,
  toCanonicalSideConfig,
} from '../shared/CanonicalBattleConfigAdapter';
import { LIGHTING_PRESETS, type LightingPreset } from './lighting-presets';
import type {
  AITacticalDoctrine,
  BattleRunnerConfig,
  SideConfig,
} from './types';

export { GameSize, InstrumentationGrade, LIGHTING_PRESETS };
export type { AITacticalDoctrine, BattleRunnerConfig, SideConfig, LightingPreset };

export interface BattleResult {
  battleId: string;
  config: BattleRunnerConfig;
  turnsPlayed: number;
  gameEnded: boolean;
  endGameReason: string;
  vpBySide: Record<string, number>;
  rpBySide?: Record<string, number>;
  winnerSide: string | null;
  tieSideIds?: string[];
  winnerReason?: 'vp' | 'rp' | 'tie' | 'initiative-card';
  stats: BattleStats;
  keys: KeysToVictory;
  log: unknown;
}

export interface BattleStats {
  koBySide: Record<string, number>;
  eliminatedBySide: Record<string, number>;
  eliminatedByFear: Record<string, number>;
  bottleTests: Record<string, { triggered: number; failed: number }>;
}

export interface KeysToVictory {
  aggressionAwarded: boolean;
  aggressionSide: string | null;
  firstBloodSide?: string;
}

function normalizeTerrainDensity(raw: number): number {
  if (!Number.isFinite(raw)) return 50;
  const asPercent = raw >= 0 && raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(100, asPercent));
}

function resolveLegacyEndGameReason(report: BattleReport): 'trigger' | 'elimination' | 'max-turn' | 'mission-immediate' {
  const turnsPlayed = Number(report.stats?.turnsCompleted ?? 0);
  const maxTurns = Number(report.config?.maxTurns ?? turnsPlayed);
  const sidesWithModels = Array.isArray(report.finalCounts)
    ? report.finalCounts.filter(count => Number(count.remaining ?? 0) > 0).length
    : 0;

  if (report.missionRuntime?.immediateWinnerSideId) {
    return 'mission-immediate';
  }
  if (sidesWithModels <= 1) {
    return 'elimination';
  }
  if (turnsPlayed >= maxTurns) {
    return 'max-turn';
  }
  return 'trigger';
}

function toLegacyBattleResult(config: BattleRunnerConfig, report: BattleReport): BattleResult {
  const winner = report.winner && report.winner !== 'Draw' && report.winner !== 'None'
    ? report.winner
    : null;

  return {
    battleId: `battle-${config.gameSize}-${Date.now()}`,
    config,
    turnsPlayed: report.stats.turnsCompleted,
    gameEnded: true,
    endGameReason: resolveLegacyEndGameReason(report),
    vpBySide: report.missionRuntime?.vpBySide ?? {},
    rpBySide: report.missionRuntime?.rpBySide ?? {},
    winnerSide: winner,
    stats: {
      koBySide: {},
      eliminatedBySide: {},
      eliminatedByFear: {},
      bottleTests: {},
    },
    keys: {
      aggressionAwarded: false,
      aggressionSide: null,
      firstBloodSide: undefined,
    },
    log: report.log,
  };
}

function toCanonicalConfig(config: BattleRunnerConfig) {
  return buildCanonicalGameConfig({
    missionId: String(config.missionId || 'QAI_11'),
    missionName: MISSION_NAME_BY_ID[String(config.missionId || 'QAI_11')] ?? String(config.missionId || 'QAI_11'),
    gameSize: config.gameSize,
    sides: config.sides.map(side => toCanonicalSideConfig(side, config.gameSize)),
    densityRatio: normalizeTerrainDensity(config.terrainDensity),
    lighting: (config.lighting?.name || 'Day, Clear') as any,
    allowWaitAction: config.allowWaitAction,
    allowHideAction: config.allowHideAction,
    verbose: true,
    seed: config.seed,
    audit: config.audit,
    viewer: config.viewer,
    battlefieldPath: config.battlefieldPath,
  });
}

export class BattleRunner {
  private readonly config: BattleRunnerConfig;

  constructor(config: BattleRunnerConfig) {
    this.config = config;
  }

  async run(): Promise<BattleResult> {
    return runBattle(this.config);
  }
}

export async function runBattle(config: BattleRunnerConfig): Promise<BattleResult> {
  const runner = new AIBattleRunner();
  const canonicalConfig = toCanonicalConfig(config);
  const report = await runner.runBattle(canonicalConfig, {
    seed: canonicalConfig.seed,
    suppressOutput: true,
  });
  return toLegacyBattleResult(config, report);
}
