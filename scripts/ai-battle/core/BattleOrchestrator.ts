/**
 * Battle Orchestrator (Compatibility Layer)
 *
 * Maintains the historical orchestration API while routing battle execution
 * through the canonical AIBattleRunner runtime.
 */

import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { SvgRenderer } from '../../../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { placeTerrain } from '../../../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import type { GameConfig, BattleReport } from '../../shared/BattleReportTypes';
import { AIBattleRunner } from '../AIBattleRunner';
import { GAME_SIZE_CONFIG } from '../AIBattleConfig';
import {
  createBattleArtifactRunId,
  writeBattleArtifacts,
  writeBattlefieldSvg,
} from '../reporting/BattleReportWriter';
import {
  buildCanonicalGameConfig,
  createDefaultHeadToHeadSides,
} from '../../shared/CanonicalBattleConfigAdapter';
import { resolveMissionName } from '../../shared/MissionCatalog';

export interface BattleOrchestratorConfig {
  missionId: string;
  gameSize: GameSize;
  densityRatio: number;
  lighting: { name: string; visibilityOR: number };
  seed?: number;
  audit?: boolean;
  viewer?: boolean;
  verbose?: boolean;
}

export interface BattleOutput {
  report: BattleReport;
  svgPath?: string;
  jsonPath?: string;
  auditPath?: string;
  viewerPath?: string;
}

export class BattleOrchestrator {
  private readonly config: BattleOrchestratorConfig;
  private readonly runner: AIBattleRunner;

  constructor(config: BattleOrchestratorConfig) {
    this.config = config;
    this.runner = new AIBattleRunner();
  }

  async generateBattlefield(): Promise<{
    battlefield: Battlefield;
    svgPath: string;
  }> {
    const { gameSize, densityRatio } = this.config;
    const sizeConfig = GAME_SIZE_CONFIG[gameSize];
    const battlefieldWidth = sizeConfig.battlefieldWidth;
    const battlefieldHeight = sizeConfig.battlefieldHeight;

    const terrainResult = placeTerrain({
      mode: 'balanced',
      density: densityRatio,
      battlefieldWidth,
      battlefieldHeight,
      terrainTypes: ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks', 'Large Rocks'],
      seed: this.config.seed,
    });

    const battlefield = new Battlefield(battlefieldWidth, battlefieldHeight);
    for (const feature of terrainResult.terrain) {
      battlefield.addTerrain(feature, true);
    }
    battlefield.finalizeTerrain();

    const runId = createBattleArtifactRunId();
    const svgPath = writeBattlefieldSvg(battlefield, this.buildGameConfig(), { runId });
    return { battlefield, svgPath };
  }

  async runBattle(): Promise<BattleOutput> {
    const gameConfig = this.buildGameConfig();
    const report = await this.runner.runBattle(gameConfig, {
      seed: this.config.seed,
      suppressOutput: !this.config.verbose,
    });

    const artifacts = writeBattleArtifacts(report, {
      audit: gameConfig.audit || gameConfig.viewer,
      viewer: gameConfig.viewer,
    });

    return {
      report,
      jsonPath: artifacts.reportPath,
      auditPath: artifacts.auditPath,
      viewerPath: artifacts.viewerPath,
    };
  }

  async runQuickBattle(): Promise<{
    battlefield: Battlefield;
    svgPath: string;
  }> {
    return this.generateBattlefield();
  }

  private buildGameConfig(): GameConfig {
    const missionId = String(this.config.missionId || 'QAI_11');
    const lighting = (this.config.lighting?.name || 'Day, Clear') as any;

    return buildCanonicalGameConfig({
      missionId,
      missionName: resolveMissionName(missionId),
      gameSize: this.config.gameSize,
      sides: createDefaultHeadToHeadSides(this.config.gameSize, TacticalDoctrine.Operative),
      densityRatio: this.config.densityRatio,
      lighting,
      allowWaitAction: true,
      allowHideAction: false,
      verbose: this.config.verbose ?? true,
      seed: this.config.seed,
      audit: this.config.audit,
      viewer: this.config.viewer,
    });
  }
}

export async function runBattle(config: Partial<BattleOrchestratorConfig> = {}): Promise<BattleOutput> {
  const fullConfig: BattleOrchestratorConfig = {
    missionId: config.missionId || 'QAI_11',
    gameSize: (config.gameSize || 'VERY_SMALL') as GameSize,
    densityRatio: config.densityRatio ?? 50,
    lighting: config.lighting || { name: 'Day, Clear', visibilityOR: 16 },
    seed: config.seed,
    audit: config.audit ?? true,
    viewer: config.viewer ?? false,
    verbose: config.verbose ?? true,
  };

  const orchestrator = new BattleOrchestrator(fullConfig);
  return orchestrator.runBattle();
}
