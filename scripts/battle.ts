#!/usr/bin/env node
/**
 * Unified Battle Script
 * 
 * Single entry point for all MEST Tactics battles.
 * Generates terrain, executes battles, and exports all artifacts.
 * 
 * Usage:
 *   npx tsx scripts/battle.ts                      # Default VERY_SMALL
 *   npx tsx scripts/battle.ts --config small       # Specific config
 *   npx tsx scripts/battle.ts --audit --viewer     # With visual audit
 *   npx tsx scripts/battle.ts --help               # Show help
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeTerrain, exportTerrainForReport } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { AuditService } from '../src/lib/mest-tactics/audit/AuditService';
import { exportBattleAudit, writeAuditExportSync, exportDeployment, exportTerrain } from '../src/lib/mest-tactics/audit/BattleAuditExporter';
import { AIGameLoop } from '../src/lib/mest-tactics/ai/executor/AIGameLoop';
import { InstrumentationLogger, InstrumentationGrade } from '../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { buildAssembly, buildProfile, GameSize } from '../src/lib/mest-tactics/mission/assembly-builder';
import { buildMissionSide } from '../src/lib/mest-tactics/mission/MissionSideBuilder';
import { GameManager } from '../src/lib/mest-tactics/engine/GameManager';
import { CharacterAI } from '../src/lib/mest-tactics/ai/core/CharacterAI';
import { TacticalDoctrine } from '../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { getEndGameTriggerTurn } from '../src/lib/mest-tactics/engine/end-game-trigger';
import { LightingCondition, getVisibilityOrForLighting } from '../src/lib/mest-tactics/utils/visibility';
import { ActionStepAudit, AuditVector, ModelEffectAudit, OpposedTestAudit } from '../src/lib/mest-tactics/audit/BattleAuditExporter';

// ============================================================================
// Configuration
// ============================================================================

interface BattleConfig {
  missionId: string;
  gameSize: GameSize;
  battlefieldWidth: number;
  battlefieldHeight: number;
  maxTurns: number;
  sides: SideConfig[];
  density: number;
  lighting: LightingCondition;
  seed?: number;
  audit: boolean;
  viewer: boolean;
  instrumentationGrade: InstrumentationGrade;
  terrainOnly: boolean;
}

interface SideConfig {
  name: string;
  bp: number;
  modelCount: number;
  tacticalDoctrine: TacticalDoctrine;
  assemblyName: string;
}

const GAME_SIZE_CONFIG: Record<GameSize, { battlefieldWidth: number; battlefieldHeight: number; maxTurns: number; bpPerSide: number[]; modelsPerSide: number[] }> = {
  [GameSize.VERY_SMALL]: { battlefieldWidth: 18, battlefieldHeight: 24, maxTurns: 6, bpPerSide: [125, 200, 250], modelsPerSide: [2, 3, 4] },
  [GameSize.SMALL]: { battlefieldWidth: 24, battlefieldHeight: 24, maxTurns: 8, bpPerSide: [250, 375, 500], modelsPerSide: [4, 6, 8] },
  [GameSize.MEDIUM]: { battlefieldWidth: 36, battlefieldHeight: 36, maxTurns: 10, bpPerSide: [500, 625, 750], modelsPerSide: [6, 9, 12] },
  [GameSize.LARGE]: { battlefieldWidth: 48, battlefieldHeight: 48, maxTurns: 12, bpPerSide: [750, 875, 1000], modelsPerSide: [8, 10, 12] },
  [GameSize.VERY_LARGE]: { battlefieldWidth: 72, battlefieldHeight: 48, maxTurns: 15, bpPerSide: [1000, 1125, 1250], modelsPerSide: [10, 15, 20] },
};

// ============================================================================
// Main Battle Runner
// ============================================================================

class UnifiedBattle {
  private config: BattleConfig;
  private outputDir: string;
  private auditService: AuditService | null = null;
  private logger: InstrumentationLogger;

  constructor(config: BattleConfig) {
    this.config = config;
    this.outputDir = this.createOutputDir();
    
    this.logger = new InstrumentationLogger({
      grade: config.instrumentationGrade,
      format: 'console',
    });

    if (config.audit || config.viewer) {
      this.auditService = new AuditService();
    }
  }

  private createOutputDir(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = join(process.cwd(), 'generated', 'battle-reports', `battle-report-${timestamp}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  async run(): Promise<void> {
    console.log('⚔️  UNIFIED BATTLE RUNNER');
    console.log('═══════════════════════════════════════');
    console.log(`Mission: ${this.config.missionId}`);
    console.log(`Game Size: ${this.config.gameSize}`);
    console.log(`Battlefield: ${this.config.battlefieldWidth}×${this.config.battlefieldHeight} MU`);
    console.log(`Sides: ${this.config.sides.length}`);
    console.log(`Terrain Density: ${Math.round(this.config.density * 100)}%`);
    console.log(`Lighting: ${this.config.lighting.name} (Visibility OR ${this.config.lighting.visibilityOR} MU)`);
    console.log('═══════════════════════════════════════\n');

    // 1. Place terrain
    console.log('🌲 Placing terrain...');
    const terrainSize = Math.max(this.config.battlefieldWidth, this.config.battlefieldHeight);
    const terrainResult = placeTerrain({
      mode: 'balanced',
      density: this.config.density * 100,
      battlefieldSize: terrainSize,
      seed: this.config.seed,
      terrainTypes: ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks', 'Large Rocks'],
    });
    console.log(`   ✓ Placed ${terrainResult.stats.placed} terrain elements\n`);

    // 2. Generate SVG
    console.log('🎨 Generating battlefield SVG...');
    const svg = this.generateSvg(terrainResult.terrain);
    const svgPath = join(this.outputDir, 'battlefield.svg');
    writeFileSync(svgPath, svg);
    console.log(`   ✓ Saved: ${svgPath}\n`);

    // 3. Create battlefield
    console.log('🗺️  Creating battlefield...');
    const battlefield = new Battlefield(this.config.battlefieldWidth, this.config.battlefieldHeight);
    for (const terrainFeature of terrainResult.terrain) {
      const centroid = this.getCentroid(terrainFeature.vertices);
      // Map terrain type to valid TerrainElement name
      const typeLower = (terrainFeature.type || 'Tree').toLowerCase();
      let terrainName = 'Tree';
      
      if (typeLower.includes('shrub') || typeLower.includes('bush')) {
        terrainName = 'Shrub';
      } else if (typeLower.includes('rock')) {
        terrainName = Math.random() > 0.5 ? 'Small Rocks' : 'Medium Rocks';
      } else if (typeLower.includes('tree')) {
        terrainName = 'Tree';
      }
      
      const rotation = Math.floor(Math.random() * 360);
      battlefield.addTerrainElement(new TerrainElement(terrainName, centroid, rotation));
    }
    console.log(`   ✓ Battlefield created with ${terrainResult.terrain.length} terrain elements\n`);

    if (this.config.terrainOnly) {
      console.log('✅ Terrain-only mode. Battle execution skipped.\n');
      return;
    }

    // 4. Build sides and deploy
    console.log('🏗️  Building sides and deploying models...');
    const sides = await this.buildSides(battlefield);
    console.log(`   ✓ ${sides.length} sides built\n`);

    // 5. Initialize audit
    if (this.auditService) {
      this.auditService.initialize({
        missionId: this.config.missionId,
        missionName: 'Elimination',
        lighting: this.config.lighting.name,
        visibilityOrMu: this.config.lighting.visibilityOR,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: this.config.battlefieldWidth,
        battlefieldHeight: this.config.battlefieldHeight,
      });
    }

    // 6. Create game manager
    const allCharacters = sides.flatMap(side => side.members.map((m: any) => m.character));
    const endGameTriggerTurn = getEndGameTriggerTurn(this.config.gameSize);
    const gameManager = new GameManager(allCharacters, battlefield, endGameTriggerTurn, this.auditService || undefined, sides);

    // 7. Run battle
    console.log('🎮 Starting battle...\n');
    const result = await this.runGameLoop(gameManager, battlefield, sides);

    // 8. Export audit with full data
    if (this.auditService) {
      const auditPath = join(this.outputDir, 'audit.json');
      const auditExport = exportBattleAudit(this.auditService, {
        missionId: this.config.missionId,
        missionName: 'Elimination',
        seed: this.config.seed,
        lighting: this.config.lighting.name,
        visibilityOrMu: this.config.lighting.visibilityOR,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: this.config.battlefieldWidth,
        battlefieldHeight: this.config.battlefieldHeight,
        battlefield,
        sides,
      });
      writeFileSync(auditPath, JSON.stringify(auditExport, null, 2), 'utf-8');
      console.log(`🎬 Visual Audit: ${auditPath}`);
      
      // Also export deployment data
      const deploymentPath = join(this.outputDir, 'deployment.json');
      const deploymentExport = exportDeployment(sides, battlefield);
      writeFileSync(deploymentPath, JSON.stringify(deploymentExport, null, 2), 'utf-8');
      console.log(`📊 Deployment: ${deploymentPath}`);
    }

    // 9. Export viewer (copy full template)
    if (this.config.viewer) {
      const viewerPath = join(this.outputDir, 'battle-report.html');
      const viewerTemplatePath = join(process.cwd(), 'src', 'lib', 'mest-tactics', 'viewer', 'battle-report-viewer.html');
      
      let viewerHtml = '';
      try {
        viewerHtml = readFileSync(viewerTemplatePath, 'utf-8');
      } catch (e) {
        viewerHtml = this.generateMinimalViewer();
      }
      
      writeFileSync(viewerPath, viewerHtml, 'utf-8');
      console.log(`📺 HTML Viewer: ${viewerPath}`);
      console.log(`\n💡 Open in browser: open ${viewerPath}`);
    }

    console.log('\n✅ Battle completed successfully!\n');
  }

  private generateSvg(terrain: any[]): string {
    // Simplified SVG generation - uses SvgRenderer
    const battlefield = new Battlefield(this.config.battlefieldWidth, this.config.battlefieldHeight);
    for (const t of terrain) {
      const centroid = this.getCentroid(t.vertices);
      // Map terrain type to valid TerrainElement name
      const typeLower = (t.type || 'Tree').toLowerCase();
      let terrainName = 'Tree';
      
      if (typeLower.includes('shrub') || typeLower.includes('bush')) {
        terrainName = 'Shrub';
      } else if (typeLower.includes('rock')) {
        terrainName = Math.random() > 0.5 ? 'Small Rocks' : 'Medium Rocks';
      } else if (typeLower.includes('tree')) {
        terrainName = 'Tree';
      }
      
      battlefield.addTerrainElement(new TerrainElement(terrainName, centroid, 0));
    }

    return SvgRenderer.render(battlefield, {
      width: this.config.battlefieldWidth,
      height: this.config.battlefieldHeight,
      gridResolution: 0.5,
      title: `${this.config.missionId} - ${this.config.gameSize}`,
      layers: [
        { id: 'deployment', label: 'Deployment Zones', enabled: true },
        { id: 'grid', label: '0.5 MU Grid', enabled: true },
        { id: 'area', label: 'Area Terrain', enabled: true },
        { id: 'building', label: 'Buildings', enabled: true },
        { id: 'wall', label: 'Walls', enabled: true },
        { id: 'tree', label: 'Trees', enabled: true },
        { id: 'rocks', label: 'Rocks', enabled: true },
        { id: 'shrub', label: 'Shrubs', enabled: true },
      ],
    });
  }

  private getCentroid(vertices: any[]): { x: number; y: number } {
    if (!vertices || vertices.length === 0) return { x: 0, y: 0 };
    let x = 0, y = 0;
    for (const v of vertices) { x += v.x; y += v.y; }
    return { x: x / vertices.length, y: y / vertices.length };
  }

  private async buildSides(battlefield: Battlefield): Promise<any[]> {
    const sides: any[] = [];

    for (const sideConfig of this.config.sides) {
      const assemblies: any[] = [];

      for (let i = 0; i < sideConfig.modelCount; i++) {
        const profile = buildProfile('Average', {
          itemNames: ['Sword, Broad', 'Armor, Light', 'Shield, Small'],
        });
        const assembly = buildAssembly(`${sideConfig.assemblyName}-${i + 1}`, [profile]);
        assemblies.push(assembly);
      }

      const side = buildMissionSide(sideConfig.name, assemblies);

      // Fix character IDs
      side.members.forEach((member: any, i: number) => {
        member.character.id = `${sideConfig.name}-${i + 1}`;
        member.character.name = `${sideConfig.name}-${i + 1}`;
        member.id = `${sideConfig.name}-${i + 1}`;
      });

      sides.push(side);
    }

    // Deploy models
    await this.deployModels(sides, battlefield);

    return sides;
  }

  private async deployModels(sides: any[], battlefield: Battlefield): Promise<void> {
    const battlefieldHeight = this.config.battlefieldHeight;
    const deploymentDepth = Math.max(6, Math.floor(battlefieldHeight * 0.2));
    const edgeMargin = 3;

    for (let sideIndex = 0; sideIndex < sides.length; sideIndex++) {
      const side = sides[sideIndex];
      const sideStartY = sideIndex === 0 ? edgeMargin : Math.max(edgeMargin, battlefieldHeight - edgeMargin - deploymentDepth);

      for (let memberIndex = 0; memberIndex < side.members.length; memberIndex++) {
        const member = side.members[memberIndex];
        const col = memberIndex % 3;
        const row = Math.floor(memberIndex / 3);
        const x = edgeMargin + col * 2;
        const y = sideStartY + row * 2;

        const position = { x: Math.round(x), y: Math.round(y) };
        battlefield.placeCharacter(member.character, position);
      }
    }
  }

  private async runGameLoop(gameManager: GameManager, battlefield: Battlefield, sides: any[]): Promise<any> {
    const aiGameLoop = new AIGameLoop(gameManager, battlefield, sides, {
      enableStrategic: true,
      enableTactical: true,
      enableCharacterAI: true,
      enableValidation: true,
      enableReplanning: true,
      verboseLogging: false,
      maxActionsPerTurn: 3,
      visibilityOrMu: this.config.lighting.visibilityOR,
      maxOrm: 3,
      allowConcentrateRangeExtension: true,
      perCharacterFovLos: false,
      auditService: this.auditService || undefined,
      missionId: this.config.missionId,
      missionName: 'Elimination',
      lighting: this.config.lighting.name,
    }, this.logger);

    const result = aiGameLoop.runGame(this.config.maxTurns);

    return {
      turnsPlayed: result.finalTurn,
      gameEnded: true,
      endGameReason: result.endReason || 'Turn limit reached',
    };
  }

  private generateMinimalViewer(): string {
    // Minimal viewer HTML fallback if template not found
    return `<!DOCTYPE html>
<html>
<head>
  <title>Battle Report</title>
  <style>
    body { font-family: sans-serif; background: #1a1a2e; color: #eee; padding: 2rem; }
    h1 { color: #e94560; }
    svg { max-width: 100%; height: auto; background: #fff; }
  </style>
</head>
<body>
  <h1>⚔️ Battle Report</h1>
  <p>Mission: ${this.config.missionId} | Game Size: ${this.config.gameSize}</p>
  <object data="battlefield.svg" type="image/svg+xml"></object>
  <p style="margin-top: 2rem; color: #888;">Full interactive viewer: open audit.json in browser or use terrain audit server.</p>
</body>
</html>`;
  }
}

// ============================================================================
// CLI Parser
// ============================================================================

function parseArgs(): Partial<BattleConfig> {
  const args = process.argv.slice(2);
  const config: Partial<BattleConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--config':
        config.gameSize = GameSize[value.toUpperCase() as keyof typeof GameSize];
        i++;
        break;
      case '--audit':
        config.audit = true;
        break;
      case '--viewer':
        config.viewer = true;
        break;
      case '--terrain-only':
        config.terrainOnly = true;
        break;
      case '--seed':
        config.seed = parseInt(value, 10);
        i++;
        break;
      case '--density':
        config.density = parseFloat(value);
        i++;
        break;
      case '--help':
        showHelp();
        process.exit(0);
    }
  }

  return config;
}

function showHelp(): void {
  console.log(`
Unified Battle Runner - MEST Tactics

Usage:
  npx tsx scripts/battle.ts [options]

Options:
  --config <size>      Game size: VERY_SMALL (default), SMALL, MEDIUM, LARGE, VERY_LARGE
  --audit              Enable audit capture
  --viewer             Generate HTML viewer
  --terrain-only       Generate terrain only, skip battle
  --seed <number>      Random seed for reproducibility
  --density <0-1>      Terrain density (default: 0.5)
  --help               Show this help message

Examples:
  npx tsx scripts/battle.ts                           # Default VERY_SMALL
  npx tsx scripts/battle.ts --config small            # SMALL battle
  npx tsx scripts/battle.ts --audit --viewer          # With visual audit
  npx tsx scripts/battle.ts --terrain-only --seed 42  # Terrain only, reproducible
`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const userConfig = parseArgs();

  const gameSize = userConfig.gameSize || GameSize.VERY_SMALL;
  const sizeConfig = GAME_SIZE_CONFIG[gameSize];

  const config: BattleConfig = {
    missionId: 'QAI_11',
    gameSize,
    battlefieldWidth: sizeConfig.battlefieldWidth,
    battlefieldHeight: sizeConfig.battlefieldHeight,
    maxTurns: sizeConfig.maxTurns,
    sides: [
      { name: 'Alpha', bp: sizeConfig.bpPerSide[1], modelCount: sizeConfig.modelsPerSide[1], tacticalDoctrine: TacticalDoctrine.Balanced, assemblyName: 'Alpha Assembly' },
      { name: 'Bravo', bp: sizeConfig.bpPerSide[1], modelCount: sizeConfig.modelsPerSide[1], tacticalDoctrine: TacticalDoctrine.Balanced, assemblyName: 'Bravo Assembly' },
    ],
    density: userConfig.density ?? 0.5,
    lighting: { name: 'Day, Clear', visibilityOR: 16 },
    seed: userConfig.seed,
    audit: userConfig.audit ?? false,
    viewer: userConfig.viewer ?? false,
    instrumentationGrade: InstrumentationGrade.BY_ACTION,
    terrainOnly: userConfig.terrainOnly ?? false,
  };

  const battle = new UnifiedBattle(config);
  await battle.run();
}

main().catch((error) => {
  console.error('\n❌ Battle failed with error:');
  console.error(error);
  process.exit(1);
});
