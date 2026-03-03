/**
 * Battle Orchestrator
 * 
 * Unified battle execution engine for MEST Tactics.
 * Consolidates common functionality between battle.ts and ai-battle-setup.ts.
 * 
 * Usage:
 *   const orchestrator = new BattleOrchestrator(config);
 *   const report = await orchestrator.runBattle();
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Battlefield } from '../../src/lib/mest-tactics/battlefield/Battlefield';
import { placeTerrain } from '../../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { SvgRenderer } from '../../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { AIBattleRunner } from './AIBattleRunner';
import { writeBattlefieldSvg } from './reporting/BattleReportWriter';
import type { GameConfig, BattleReport } from '../shared/BattleReportTypes';
import type { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';

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
  private config: BattleOrchestratorConfig;
  private outputDir: string;
  private runner: AIBattleRunner;

  constructor(config: BattleOrchestratorConfig) {
    this.config = config;
    this.outputDir = this.createOutputDir();
    this.runner = new AIBattleRunner();
  }

  private createOutputDir(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = join(process.cwd(), 'generated', 'battle-reports', `battle-report-${timestamp}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Generate battlefield terrain and SVG
   */
  async generateBattlefield(): Promise<{
    battlefield: Battlefield;
    svgPath: string;
  }> {
    const { gameSize, densityRatio } = this.config;
    const battlefieldWidth = this.getBattlefieldWidth(gameSize);
    const battlefieldHeight = this.getBattlefieldHeight(gameSize);
    const terrainSize = Math.max(battlefieldWidth, battlefieldHeight);

    // Generate terrain
    const terrainResult = placeTerrain({
      mode: 'balanced',
      density: densityRatio,
      battlefieldSize: terrainSize,
      terrainTypes: ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks', 'Large Rocks'],
    });

    // Create battlefield with terrain
    const battlefield = new Battlefield(battlefieldWidth, battlefieldHeight);
    for (const terrainFeature of terrainResult.terrain) {
      const centroid = this.getCentroid(terrainFeature.vertices);
      const typeLower = (terrainFeature.id || terrainFeature.type || 'Tree').toLowerCase();
      let terrainName = 'Tree';

      if (typeLower.includes('shrub') || typeLower.includes('bush')) {
        terrainName = 'Shrub';
      } else if (typeLower.includes('rock')) {
        terrainName = Math.random() > 0.5 ? 'Small Rocks' : 'Medium Rocks';
      } else if (typeLower.includes('tree')) {
        terrainName = 'Tree';
      }

      const rotation = Math.floor(Math.random() * 360);
      battlefield.addTerrainElement({
        type: terrainName as any,
        position: centroid,
        rotation,
      });
    }

    // Generate SVG
    const config = this.buildGameConfig();
    const svgPath = writeBattlefieldSvg(battlefield, config);

    return { battlefield, svgPath };
  }

  /**
   * Run full AI battle
   */
  async runBattle(): Promise<BattleOutput> {
    const config = this.buildGameConfig();
    
    const report = await this.runner.runBattle(config, {
      seed: this.config.seed,
      suppressOutput: !this.config.verbose,
    });

    const output: BattleOutput = { report };

    // Generate SVG if not already generated
    if (!output.svgPath) {
      // SVG is now generated automatically by AIBattleRunner
    }

    return output;
  }

  /**
   * Run quick battle without AI (terrain + deployment only)
   */
  async runQuickBattle(): Promise<{
    battlefield: Battlefield;
    svgPath: string;
  }> {
    return this.generateBattlefield();
  }

  private buildGameConfig(): GameConfig {
    const battlefieldWidth = this.getBattlefieldWidth(this.config.gameSize);
    const battlefieldHeight = this.getBattlefieldHeight(this.config.gameSize);
    const maxTurns = this.getMaxTurns(this.config.gameSize);
    const bpPerSide = this.getBPPerSide(this.config.gameSize);
    const modelCount = this.getModelCount(this.config.gameSize);

    return {
      missionId: this.config.missionId,
      missionName: this.getMissionName(this.config.missionId),
      gameSize: this.config.gameSize,
      battlefieldWidth,
      battlefieldHeight,
      maxTurns,
      endGameTurn: this.getEndGameTriggerTurn(this.config.gameSize),
      sides: [
        {
          name: 'Alpha',
          bp: bpPerSide[1],
          modelCount: modelCount[1],
          tacticalDoctrine: 'Operative' as any,
          assemblyName: 'Alpha Assembly',
        },
        {
          name: 'Bravo',
          bp: bpPerSide[1],
          modelCount: modelCount[1],
          tacticalDoctrine: 'Operative' as any,
          assemblyName: 'Bravo Assembly',
        },
      ],
      densityRatio: this.config.densityRatio,
      lighting: this.config.lighting,
      visibilityOrMu: this.config.lighting.visibilityOR,
      maxOrm: 3,
      allowConcentrateRangeExtension: true,
      perCharacterFovLos: false,
      verbose: this.config.verbose ?? true,
      seed: this.config.seed,
      audit: this.config.audit,
      viewer: this.config.viewer,
    };
  }

  private getBattlefieldWidth(gameSize: GameSize): number {
    const sizes: Record<GameSize, number> = {
      VERY_SMALL: 18,
      SMALL: 24,
      MEDIUM: 36,
      LARGE: 48,
      VERY_LARGE: 72,
    };
    return sizes[gameSize] || 24;
  }

  private getBattlefieldHeight(gameSize: GameSize): number {
    const sizes: Record<GameSize, number> = {
      VERY_SMALL: 24,
      SMALL: 24,
      MEDIUM: 36,
      LARGE: 48,
      VERY_LARGE: 48,
    };
    return sizes[gameSize] || 24;
  }

  private getMaxTurns(gameSize: GameSize): number {
    const turns: Record<GameSize, number> = {
      VERY_SMALL: 6,
      SMALL: 8,
      MEDIUM: 10,
      LARGE: 12,
      VERY_LARGE: 15,
    };
    return turns[gameSize] || 6;
  }

  private getBPPerSide(gameSize: GameSize): number[] {
    const bp: Record<GameSize, number[]> = {
      VERY_SMALL: [125, 200, 250],
      SMALL: [250, 375, 500],
      MEDIUM: [500, 625, 750],
      LARGE: [750, 875, 1000],
      VERY_LARGE: [1000, 1125, 1250],
    };
    return bp[gameSize] || [125, 200, 250];
  }

  private getModelCount(gameSize: GameSize): number[] {
    const counts: Record<GameSize, number[]> = {
      VERY_SMALL: [2, 3, 4],
      SMALL: [4, 6, 8],
      MEDIUM: [6, 9, 12],
      LARGE: [8, 10, 12],
      VERY_LARGE: [10, 15, 20],
    };
    return counts[gameSize] || [2, 3, 4];
  }

  private getEndGameTriggerTurn(gameSize: GameSize): number {
    const triggers: Record<GameSize, number> = {
      VERY_SMALL: 3,
      SMALL: 4,
      MEDIUM: 6,
      LARGE: 8,
      VERY_LARGE: 10,
    };
    return triggers[gameSize] || 4;
  }

  private getMissionName(missionId: string): string {
    const names: Record<string, string> = {
      QAI_11: 'Elimination',
      QAI_12: 'Convergence',
      QAI_13: 'Assault',
      QAI_14: 'Dominion',
      QAI_15: 'Recovery',
      QAI_16: 'Escort',
      QAI_17: 'Triumvirate',
      QAI_18: 'Stealth',
      QAI_19: 'Defiance',
      QAI_20: 'Breach',
    };
    return names[missionId] || 'Elimination';
  }

  private getCentroid(vertices: { x: number; y: number }[]): { x: number; y: number } {
    if (!vertices || vertices.length === 0) return { x: 0, y: 0 };
    let x = 0, y = 0;
    for (const v of vertices) {
      x += v.x;
      y += v.y;
    }
    return { x: x / vertices.length, y: y / vertices.length };
  }
}

/**
 * Run battle with default configuration
 */
export async function runBattle(config: Partial<BattleOrchestratorConfig> = {}): Promise<BattleOutput> {
  const fullConfig: BattleOrchestratorConfig = {
    missionId: config.missionId || 'QAI_11',
    gameSize: config.gameSize || 'VERY_SMALL' as GameSize,
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
