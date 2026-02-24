/**
 * AI Battle Setup CLI
 * 
 * Interactive command-line tool for setting up and running AI-only game sessions.
 * Prompts for mission selection, game size, AI configuration, and tactical doctrines.
 * 
 * Usage:
 *   npm run ai-battle                    # Quick battle with defaults
 *   npm run ai-battle -- -i              # Interactive setup
 *   npm run ai-battle -- -r <report.json># Render JSON battle report
 *   npm run ai-battle -- -v VERY_LARGE 50 3 424242 # Validation batch
 *   npm run ai-battle -- VERY_LARGE 50   # Quick battle with size and density
 */

import * as readline from 'readline';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Character } from '../src/lib/mest-tactics/core/Character';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { GameManager } from '../src/lib/mest-tactics/engine/GameManager';
import { Position } from '../src/lib/mest-tactics/battlefield/Position';
import { SpatialRules } from '../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../src/lib/mest-tactics/battlefield/spatial/size-utils';
import { buildAssembly, buildProfile, GameSize } from '../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine, TACTICAL_DOCTRINE_INFO, getDoctrinesByEngagement } from '../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { CharacterAI, DEFAULT_CHARACTER_AI_CONFIG } from '../src/lib/mest-tactics/ai/core/CharacterAI';
import { AIContext, AIControllerConfig, CharacterKnowledge } from '../src/lib/mest-tactics/ai/core/AIController';
import { attemptHide, attemptDetect } from '../src/lib/mest-tactics/status/concealment';
import { LOFOperations } from '../src/lib/mest-tactics/battlefield/los/LOFOperations';
import { PathfindingEngine } from '../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import {
  LightingCondition,
  evaluateRangeWithVisibility,
  getVisibilityOrForLighting,
  parseWeaponOptimalRangeMu,
} from '../src/lib/mest-tactics/utils/visibility';

// ============================================================================
// Configuration
// ============================================================================

interface GameConfig {
  missionId: string;
  missionName: string;
  gameSize: GameSize;
  battlefieldSize: number;
  maxTurns: number;
  endGameTurn: number;
  sides: SideConfig[];
  densityRatio: number;
  lighting: LightingCondition;
  visibilityOrMu: number;
  maxOrm: number;
  allowConcentrateRangeExtension: boolean;
  perCharacterFovLos: boolean;
  verbose: boolean;
  seed?: number;
}

interface SideConfig {
  name: string;
  bp: number;
  modelCount: number;
  tacticalDoctrine: TacticalDoctrine;
  assemblyName: string;
  aggression: number;
  caution: number;
}

interface BattleStats {
  totalActions: number;
  moves: number;
  closeCombats: number;
  rangedCombats: number;
  disengages: number;
  waits: number;
  detects: number;
  hides: number;
  reacts: number;
  eliminations: number;
  kos: number;
  turnsCompleted: number;
  losChecks: number;
  lofChecks: number;
  totalPathLength: number;
  modelsMoved: number;
}

interface BattleLogEntry {
  turn: number;
  round: number;
  modelId: string;
  side: string;
  model: string;
  action: string;
  detail?: string;
  result?: string;
}

interface ModelUsageStats {
  modelId: string;
  modelName: string;
  side: string;
  pathLength: number;
  moveActions: number;
  waitAttempts: number;
  waitSuccesses: number;
  detectAttempts: number;
  detectSuccesses: number;
  hideAttempts: number;
  hideSuccesses: number;
  reactAttempts: number;
  reactSuccesses: number;
}

interface UsageMetrics {
  modelCount: number;
  modelsMoved: number;
  modelsUsedWait: number;
  modelsUsedDetect: number;
  modelsUsedHide: number;
  modelsUsedReact: number;
  totalPathLength: number;
  averagePathLengthPerMovedModel: number;
  averagePathLengthPerModel: number;
  topPathModels: ModelUsageStats[];
  modelUsage: ModelUsageStats[];
}

export interface BattleReport {
  config: GameConfig;
  winner: string;
  finalCounts: Array<{ name: string; remaining: number }>;
  stats: BattleStats;
  usage?: UsageMetrics;
  log: BattleLogEntry[];
  seed?: number;
}

interface ValidationCoverage {
  movement: boolean;
  pathfinding: boolean;
  rangedCombat: boolean;
  closeCombat: boolean;
  react: boolean;
  wait: boolean;
  detect: boolean;
  los: boolean;
  lof: boolean;
}

interface ValidationAggregateReport {
  missionId: string;
  gameSize: GameSize;
  densityRatio: number;
  runs: number;
  baseSeed: number;
  winners: Record<string, number>;
  totals: BattleStats;
  averages: BattleStats;
  coverage: ValidationCoverage;
  runReports: Array<{
    run: number;
    seed: number;
    winner: string;
    finalCounts: Array<{ name: string; remaining: number }>;
    stats: BattleStats;
    usage: {
      modelCount: number;
      modelsMoved: number;
      modelsUsedWait: number;
      modelsUsedDetect: number;
      modelsUsedHide: number;
      modelsUsedReact: number;
      totalPathLength: number;
      averagePathLengthPerMovedModel: number;
      averagePathLengthPerModel: number;
      topPathModels: ModelUsageStats[];
    };
  }>;
  generatedAt: string;
}

const GAME_SIZE_CONFIG: Record<GameSize, {
  name: string;
  modelsPerSide: [number, number];
  bpPerSide: [number, number];
  battlefieldSize: number;
  maxTurns: number;
  endGameTurn: number;
}> = {
  VERY_SMALL: { name: 'Very Small', modelsPerSide: [2, 4], bpPerSide: [125, 250], battlefieldSize: 18, maxTurns: 10, endGameTurn: 10 },
  SMALL: { name: 'Small', modelsPerSide: [4, 8], bpPerSide: [250, 500], battlefieldSize: 24, maxTurns: 10, endGameTurn: 10 },
  MEDIUM: { name: 'Medium', modelsPerSide: [6, 12], bpPerSide: [500, 750], battlefieldSize: 36, maxTurns: 10, endGameTurn: 10 },
  LARGE: { name: 'Large', modelsPerSide: [8, 16], bpPerSide: [750, 1000], battlefieldSize: 48, maxTurns: 10, endGameTurn: 10 },
  VERY_LARGE: { name: 'Very Large', modelsPerSide: [16, 32], bpPerSide: [1000, 2000], battlefieldSize: 60, maxTurns: 10, endGameTurn: 10 },
};

// Map Tactical Doctrine to AI config
function doctrineToAIConfig(doctrine: TacticalDoctrine): Partial<AIControllerConfig> {
  const components = {
    melee: ['juggernaut', 'berserker', 'raider', 'crusader', 'warrior', 'guardian', 'duelist', 'veteran_melee', 'defender'].includes(doctrine),
    ranged: ['bombard', 'hunter', 'sniper', 'archer', 'gunner', 'sentinel', 'sharpshooter', 'marksman', 'watchman'].includes(doctrine),
    aggressive: ['juggernaut', 'berserker', 'raider', 'bombard', 'hunter', 'sniper', 'assault', 'soldier', 'scout', 'crusader', 'duelist', 'archer', 'sharpshooter', 'assault', 'tactician', 'skirmisher'].includes(doctrine),
    defensive: ['raider', 'guardian', 'defender', 'sniper', 'sentinel', 'watchman', 'scout', 'strategist', 'warden'].includes(doctrine),
  };

  return {
    aggression: components.aggressive ? 0.7 : components.defensive ? 0.3 : 0.5,
    caution: components.defensive ? 0.7 : components.aggressive ? 0.3 : 0.5,
  };
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function emptyKnowledge(turn: number): CharacterKnowledge {
  return {
    knownEnemies: new Map(),
    knownTerrain: new Map(),
    lastKnownPositions: new Map(),
    threatZones: [],
    safeZones: [],
    lastUpdated: turn,
  };
}

function createEmptyStats(): BattleStats {
  return {
    totalActions: 0,
    moves: 0,
    closeCombats: 0,
    rangedCombats: 0,
    disengages: 0,
    waits: 0,
    detects: 0,
    hides: 0,
    reacts: 0,
    eliminations: 0,
    kos: 0,
    turnsCompleted: 0,
    losChecks: 0,
    lofChecks: 0,
    totalPathLength: 0,
    modelsMoved: 0,
  };
}

function formatPathLeaders(topPathModels: ModelUsageStats[]): string {
  if (topPathModels.length === 0) {
    return '    none';
  }
  return topPathModels
    .map((model, index) => `    ${index + 1}. ${model.modelName} (${model.side}) - ${model.pathLength.toFixed(2)} MU over ${model.moveActions} move(s)`)
    .join('\n');
}

export function formatBattleReportHumanReadable(report: BattleReport): string {
  const fallbackUsage: UsageMetrics = {
    modelCount: report.finalCounts.reduce((sum, side) => sum + side.remaining, 0),
    modelsMoved: report.stats.modelsMoved ?? 0,
    modelsUsedWait: 0,
    modelsUsedDetect: 0,
    modelsUsedHide: 0,
    modelsUsedReact: 0,
    totalPathLength: report.stats.totalPathLength ?? 0,
    averagePathLengthPerMovedModel: 0,
    averagePathLengthPerModel: 0,
    topPathModels: [],
    modelUsage: [],
  };
  const usage = report.usage ?? fallbackUsage;
  if (usage.averagePathLengthPerMovedModel === 0 && usage.modelsMoved > 0) {
    usage.averagePathLengthPerMovedModel = usage.totalPathLength / usage.modelsMoved;
  }
  if (usage.averagePathLengthPerModel === 0 && usage.modelCount > 0) {
    usage.averagePathLengthPerModel = usage.totalPathLength / usage.modelCount;
  }

  const lines: string[] = [];
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('📊 BATTLE REPORT');
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`📋 Mission: ${report.config.missionName}`);
  lines.push(`📏 Game Size: ${GAME_SIZE_CONFIG[report.config.gameSize].name}`);
  lines.push(`🗺️  Battlefield: ${report.config.battlefieldSize}×${report.config.battlefieldSize} MU`);
  lines.push(`🌲 Terrain Density: ${report.config.densityRatio}%`);
  lines.push(`💡 Lighting: ${report.config.lighting} (Visibility OR ${report.config.visibilityOrMu} MU)`);
  lines.push(`🎲 Seed: ${report.seed ?? 'n/a'}`);
  lines.push(`⏱️  Turns Completed: ${report.stats.turnsCompleted}/${report.config.maxTurns}`);
  lines.push('');
  lines.push('🏆 RESULT');
  lines.push(`  Winner: ${report.winner}!`);
  lines.push('  Final Model Counts:');
  report.finalCounts.forEach(fc => {
    lines.push(`    ${fc.name}: ${fc.remaining} remaining`);
  });
  lines.push('');
  lines.push('📈 ACTION TOTALS');
  lines.push(`  Total Actions: ${report.stats.totalActions}`);
  lines.push(`  Moves: ${report.stats.moves}`);
  lines.push(`  Close Combats: ${report.stats.closeCombats}`);
  lines.push(`  Ranged Combats: ${report.stats.rangedCombats}`);
  lines.push(`  Disengages: ${report.stats.disengages}`);
  lines.push(`  Waits: ${report.stats.waits}`);
  lines.push(`  Detects: ${report.stats.detects}`);
  lines.push(`  Hides: ${report.stats.hides}`);
  lines.push(`  Reacts: ${report.stats.reacts}`);
  lines.push(`  LOS Checks: ${report.stats.losChecks}`);
  lines.push(`  LOF Checks: ${report.stats.lofChecks}`);
  lines.push(`  Eliminations: ${report.stats.eliminations}`);
  lines.push(`  KO's: ${report.stats.kos}`);
  lines.push('');
  lines.push('📐 MOVEMENT & USAGE');
  lines.push(`  Path Length (total): ${usage.totalPathLength.toFixed(2)} MU`);
  lines.push(`  Path Length (avg per moved model): ${usage.averagePathLengthPerMovedModel.toFixed(2)} MU`);
  lines.push(`  Path Length (avg per model): ${usage.averagePathLengthPerModel.toFixed(2)} MU`);
  lines.push(`  Models that moved: ${usage.modelsMoved}/${usage.modelCount}`);
  lines.push(`  Models that used Hidden: ${usage.modelsUsedHide}/${usage.modelCount}`);
  lines.push(`  Models that used Detect: ${usage.modelsUsedDetect}/${usage.modelCount}`);
  lines.push(`  Models that used Wait: ${usage.modelsUsedWait}/${usage.modelCount}`);
  lines.push(`  Models that used React: ${usage.modelsUsedReact}/${usage.modelCount}`);
  lines.push('  Top Path Length Models:');
  lines.push(formatPathLeaders(usage.topPathModels));
  lines.push('');
  lines.push('════════════════════════════════════════════════════════════');
  return lines.join('\n');
}

// ============================================================================
// Interactive Setup
// ============================================================================

class AIBattleSetup {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  private async selectMission(): Promise<{ id: string; name: string }> {
    console.log('\n📋 Select Mission:\n');
    console.log('  1. Elimination (QAI-11) - Last side with models remaining wins');
    
    const choice = await this.question('\nMission choice [1] (default: 1): ');
    return { id: 'QAI_11', name: 'Elimination' };
  }

  private async selectGameSize(): Promise<GameSize> {
    console.log('\n📏 Select Game Size:\n');
    console.log('  1. VERY_SMALL  (2-4 models/side, 125-250 BP, 18×18 MU)');
    console.log('  2. SMALL       (4-8 models/side, 250-500 BP, 24×24 MU)');
    console.log('  3. MEDIUM      (6-12 models/side, 500-750 BP, 36×36 MU)');
    console.log('  4. LARGE       (8-16 models/side, 750-1000 BP, 48×48 MU)');
    console.log('  5. VERY_LARGE  (16-32 models/side, 1000-2000 BP, 60×60 MU)');
    
    const choice = await this.question('\nGame size [1-5] (default: 5): ');
    
    const sizes: Record<string, GameSize> = {
      '1': GameSize.VERY_SMALL,
      '2': GameSize.SMALL,
      '3': GameSize.MEDIUM,
      '4': GameSize.LARGE,
      '5': GameSize.VERY_LARGE,
    };
    
    return sizes[choice] || GameSize.VERY_LARGE;
  }

  private async selectTacticalDoctrine(sideName: string): Promise<TacticalDoctrine> {
    console.log(`\n⚔️  Select Tactical Doctrine for ${sideName}:\n`);
    
    const groups = getDoctrinesByEngagement();
    
    console.log('  Melee-Centric:');
    groups.Melee.forEach((d, i) => {
      const info = TACTICAL_DOCTRINE_INFO[d];
      console.log(`    ${i + 1}. ${info.icon} ${info.name}`);
    });
    
    console.log('\n  Ranged-Centric:');
    groups.Ranged.forEach((d, i) => {
      const info = TACTICAL_DOCTRINE_INFO[d];
      console.log(`    ${i + 10}. ${info.icon} ${info.name}`);
    });
    
    console.log('\n  Balanced:');
    groups.Balanced.forEach((d, i) => {
      const info = TACTICAL_DOCTRINE_INFO[d];
      console.log(`    ${i + 19}. ${info.icon} ${info.name}`);
    });
    
    const choice = await this.question(`\nDoctrine for ${sideName} [1-27] (default: 18 - Operative): `);
    
    const allDoctrines = [...groups.Melee, ...groups.Ranged, ...groups.Balanced];
    const index = parseInt(choice, 10) - 1;
    
    return (index >= 0 && index < allDoctrines.length) ? allDoctrines[index] : TacticalDoctrine.Operative;
  }

  private async configureSides(gameSize: GameSize): Promise<SideConfig[]> {
    const config = GAME_SIZE_CONFIG[gameSize];
    const sides: SideConfig[] = [];
    
    console.log('\n🎖️  Configure Sides:\n');
    
    const sideCountStr = await this.question('Number of sides [2] (default: 2): ');
    const sideCount = parseInt(sideCountStr, 10) || 2;
    
    for (let i = 0; i < sideCount; i++) {
      console.log(`\n--- Side ${i + 1} ---`);
      
      const name = await this.question(`Side name (default: ${['Alpha', 'Bravo', 'Gamma', 'Delta'][i]}): `) || 
                   ['Alpha', 'Bravo', 'Gamma', 'Delta'][i];
      
      const modelCountStr = await this.question(
        `Model count [${config.modelsPerSide[0]}-${config.modelsPerSide[1]}] (default: ${config.modelsPerSide[1]}): `
      );
      let modelCount = parseInt(modelCountStr, 10);
      if (!modelCount || modelCount < config.modelsPerSide[0]) modelCount = config.modelsPerSide[1];
      if (modelCount > config.modelsPerSide[1]) modelCount = config.modelsPerSide[1];
      
      const bpStr = await this.question(
        `Build Points [${config.bpPerSide[0]}-${config.bpPerSide[1]}] (default: ${config.bpPerSide[1]}): `
      );
      let bp = parseInt(bpStr, 10);
      if (!bp || bp < config.bpPerSide[0]) bp = config.bpPerSide[1];
      if (bp > config.bpPerSide[1]) bp = config.bpPerSide[1];
      
      const doctrine = await this.selectTacticalDoctrine(name);
      const aiConfig = doctrineToAIConfig(doctrine);
      
      sides.push({
        name,
        bp,
        modelCount,
        tacticalDoctrine: doctrine,
        assemblyName: `${name} Assembly`,
        aggression: aiConfig.aggression ?? 0.5,
        caution: aiConfig.caution ?? 0.5,
      });
    }
    
    return sides;
  }

  private async configureDensity(): Promise<number> {
    const densityStr = await this.question('\n🌲 Terrain density ratio [0-100] (default: 50): ');
    const density = parseInt(densityStr, 10);
    return Math.max(0, Math.min(100, density || 50));
  }

  private async selectLighting(): Promise<LightingCondition> {
    console.log('\n💡 Select Atmospheric Lighting:\n');
    console.log('  1. Day, Clear          (Visibility OR 16 MU)');
    console.log('  2. Twilight, Overcast  (Visibility OR 8 MU)');
    const choice = await this.question('\nLighting [1-2] (default: 1): ');
    return choice.trim() === '2' ? 'Twilight, Overcast' : 'Day, Clear';
  }

  async runInteractiveSetup(): Promise<GameConfig> {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   MEST Tactics AI Battle Setup        ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    const mission = await this.selectMission();
    const gameSize = await this.selectGameSize();
    const sides = await this.configureSides(gameSize);
    const densityRatio = await this.configureDensity();
    const lighting = await this.selectLighting();
    const visibilityOrMu = getVisibilityOrForLighting(lighting);
    
    const config: GameConfig = {
      missionId: mission.id,
      missionName: mission.name,
      gameSize,
      battlefieldSize: GAME_SIZE_CONFIG[gameSize].battlefieldSize,
      maxTurns: GAME_SIZE_CONFIG[gameSize].maxTurns,
      endGameTurn: GAME_SIZE_CONFIG[gameSize].endGameTurn,
      sides,
      densityRatio,
      lighting,
      visibilityOrMu,
      maxOrm: 3,
      allowConcentrateRangeExtension: true,
      perCharacterFovLos: false,
      verbose: true,
    };
    
    console.log('\n' + '═'.repeat(60));
    console.log('\n📋 Configuration Summary:\n');
    console.log(`  Mission: ${config.missionName} (${config.missionId})`);
    console.log(`  Game Size: ${GAME_SIZE_CONFIG[gameSize].name}`);
    console.log(`  Battlefield: ${config.battlefieldSize}×${config.battlefieldSize} MU`);
    console.log(`  Max Turns: ${config.maxTurns}`);
    console.log(`  Terrain Density: ${config.densityRatio}%`);
    console.log(`  Lighting: ${config.lighting} (Visibility OR ${config.visibilityOrMu} MU)`);
    console.log('\n  Sides:');
    config.sides.forEach((side) => {
      const doctrineInfo = TACTICAL_DOCTRINE_INFO[side.tacticalDoctrine];
      console.log(`    - ${side.name}: ${side.modelCount} models, ${side.bp} BP, ${doctrineInfo.icon} ${doctrineInfo.name}`);
    });
    console.log('\n' + '═'.repeat(60));
    
    const confirm = await this.question('\nStart battle with this configuration? [Y/n]: ');
    
    if (confirm.toLowerCase() === 'n') {
      console.log('\nBattle cancelled.\n');
      this.rl.close();
      process.exit(0);
    }
    
    return config;
  }

  close() {
    this.rl.close();
  }
}

// ============================================================================
// Battle Runner
// ============================================================================

class AIBattleRunner {
  private log: BattleLogEntry[] = [];
  private stats: BattleStats = createEmptyStats();
  private modelUsageByCharacter = new Map<Character, ModelUsageStats>();

  private resetRunState() {
    this.log = [];
    this.stats = createEmptyStats();
    this.modelUsageByCharacter = new Map<Character, ModelUsageStats>();
  }

  private initializeModelUsage(
    config: GameConfig,
    sides: Array<{ characters: Character[] }>
  ) {
    this.modelUsageByCharacter = new Map<Character, ModelUsageStats>();
    for (let sideIndex = 0; sideIndex < sides.length; sideIndex++) {
      const sideName = config.sides[sideIndex]?.name ?? `Side ${sideIndex + 1}`;
      for (const character of sides[sideIndex].characters) {
        this.modelUsageByCharacter.set(character, {
          modelId: character.id,
          modelName: character.profile.name,
          side: sideName,
          pathLength: 0,
          moveActions: 0,
          waitAttempts: 0,
          waitSuccesses: 0,
          detectAttempts: 0,
          detectSuccesses: 0,
          hideAttempts: 0,
          hideSuccesses: 0,
          reactAttempts: 0,
          reactSuccesses: 0,
        });
      }
    }
  }

  private trackPathMovement(character: Character, movedDistance: number) {
    if (!Number.isFinite(movedDistance) || movedDistance <= 0) {
      return;
    }
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    usage.pathLength += movedDistance;
    usage.moveActions += 1;
    this.stats.totalPathLength += movedDistance;
  }

  private trackAttempt(character: Character, action: 'wait' | 'detect' | 'hide' | 'react') {
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    if (action === 'wait') usage.waitAttempts += 1;
    if (action === 'detect') usage.detectAttempts += 1;
    if (action === 'hide') usage.hideAttempts += 1;
    if (action === 'react') usage.reactAttempts += 1;
  }

  private trackSuccess(character: Character, action: 'wait' | 'detect' | 'hide' | 'react') {
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    if (action === 'wait') usage.waitSuccesses += 1;
    if (action === 'detect') usage.detectSuccesses += 1;
    if (action === 'hide') usage.hideSuccesses += 1;
    if (action === 'react') usage.reactSuccesses += 1;
  }

  private buildUsageMetrics(): UsageMetrics {
    const usage = Array.from(this.modelUsageByCharacter.values());
    const modelsMoved = usage.filter(model => model.pathLength > 0).length;
    const modelsUsedWait = usage.filter(model => model.waitSuccesses > 0).length;
    const modelsUsedDetect = usage.filter(model => model.detectSuccesses > 0).length;
    const modelsUsedHide = usage.filter(model => model.hideSuccesses > 0).length;
    const modelsUsedReact = usage.filter(model => model.reactSuccesses > 0).length;
    const totalPathLength = usage.reduce((sum, model) => sum + model.pathLength, 0);
    const averagePathLengthPerMovedModel = modelsMoved > 0 ? totalPathLength / modelsMoved : 0;
    const averagePathLengthPerModel = usage.length > 0 ? totalPathLength / usage.length : 0;
    const topPathModels = [...usage]
      .filter(model => model.pathLength > 0)
      .sort((a, b) => b.pathLength - a.pathLength)
      .slice(0, 10);

    this.stats.modelsMoved = modelsMoved;
    this.stats.totalPathLength = totalPathLength;

    return {
      modelCount: usage.length,
      modelsMoved,
      modelsUsedWait,
      modelsUsedDetect,
      modelsUsedHide,
      modelsUsedReact,
      totalPathLength,
      averagePathLengthPerMovedModel,
      averagePathLengthPerModel,
      topPathModels,
      modelUsage: usage,
    };
  }

  async runBattle(
    config: GameConfig,
    options: { seed?: number; suppressOutput?: boolean } = {}
  ): Promise<BattleReport> {
    this.resetRunState();
    const seed = options.seed ?? config.seed;
    const originalRandom = Math.random;
    if (typeof seed === 'number') {
      Math.random = createSeededRandom(seed);
    }

    try {
      const outputEnabled = !options.suppressOutput;
      const out = (...args: unknown[]) => {
        if (outputEnabled) {
          console.log(...args);
        }
      };
      const verbose = config.verbose && outputEnabled;

      out('\n⚔️  Starting Battle\n');
      out(`Mission: ${config.missionName}`);
      out(`Battlefield: ${config.battlefieldSize}×${config.battlefieldSize} MU`);
      out(`Max Turns: ${config.maxTurns}\n`);

      // Build assemblies
      const sides = await Promise.all(config.sides.map(side => this.createAssembly(side)));
      this.initializeModelUsage(config, sides);

      out('Assemblies built:');
      sides.forEach((side, i) => {
        out(`  ${config.sides[i].name}: ${side.characters.length} models, ${side.totalBP} BP`);
      });
      out();

      // Create battlefield
      const battlefield = this.createBattlefield(config.battlefieldSize, config.densityRatio);

      // Deploy models
      sides.forEach((side, i) => {
        this.deployModels(side, battlefield, i, config.battlefieldSize);
      });

      out('Models deployed.\n');
      out('─'.repeat(60) + '\n');

      // Create game manager
      const allCharacters = sides.flatMap(s => s.characters);
      const gameManager = new GameManager(allCharacters, battlefield);

      // Create AI controllers
      const aiControllers = new Map<string, CharacterAI>();
      config.sides.forEach((sideConfig, sideIndex) => {
        const sideCharacters = sides[sideIndex].characters;
        sideCharacters.forEach(char => {
          const aiConfig = {
            ...DEFAULT_CHARACTER_AI_CONFIG,
            enablePatterns: false,
            enableGOAP: false,
            ai: {
              ...DEFAULT_CHARACTER_AI_CONFIG.ai,
              aggression: sideConfig.aggression,
              caution: sideConfig.caution,
              visibilityOrMu: config.visibilityOrMu,
              maxOrm: config.maxOrm,
              allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
              perCharacterFovLos: config.perCharacterFovLos,
            },
          };
          aiControllers.set(char.id, new CharacterAI(aiConfig));
        });
      });

      // Run game loop
      let gameOver = false;
      let turn = 0;

      while (!gameOver && turn < config.maxTurns) {
        turn++;
        this.stats.turnsCompleted = turn;
        gameManager.startTurn();

        if (verbose) {
          out(`\n📍 Turn ${turn}\n`);
        }

        // Process each side
        for (let sideIndex = 0; sideIndex < config.sides.length; sideIndex++) {
          const sideCharacters = sides[sideIndex].characters
            .filter(c => !c.state.isEliminated && !c.state.isKOd)
            .sort((a, b) => (b.finalAttributes?.int ?? b.attributes?.int ?? 0) - (a.finalAttributes?.int ?? a.attributes?.int ?? 0));

          for (const character of sideCharacters) {
            const aiController = aiControllers.get(character.id)!;
            await this.resolveCharacterTurn(
              character,
              sides,
              battlefield,
              gameManager,
              aiController,
              turn,
              sideIndex,
              { ...config, verbose }
            );
          }
        }

        // Check victory conditions
        const remainingPerSide = sides.map((side) =>
          side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length
        );

        const sidesWithModels = remainingPerSide.filter(r => r > 0).length;
        if (sidesWithModels <= 1) {
          gameOver = true;
          if (verbose) {
            out(`\n🏆 Game Over - Only ${sidesWithModels} side(s) with models remaining!\n`);
          }
        } else if (turn >= config.endGameTurn) {
          if (Math.random() < 0.5) {
            gameOver = true;
            if (verbose) {
              out(`\n🎲 End game die roll - Game Over!\n`);
            }
          }
        }

        if (verbose) {
          config.sides.forEach((side, i) => {
            out(`  ${side.name}: ${remainingPerSide[i]}/${sides[i].characters.length} models`);
          });
        }
      }

      // Generate results
      const finalCounts = sides.map((side) =>
        side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length
      );

      const maxRemaining = Math.max(...finalCounts);
      const winners = config.sides.filter((_, i) => finalCounts[i] === maxRemaining);
      const usage = this.buildUsageMetrics();

      const report: BattleReport = {
        config,
        winner: winners.length === 1 ? winners[0].name : (winners.length === 0 ? 'None' : 'Draw'),
        finalCounts: config.sides.map((side, i) => ({ name: side.name, remaining: finalCounts[i] })),
        stats: this.stats,
        usage,
        log: this.log,
        seed,
      };

      if (outputEnabled) {
        this.displayReport(report);
      }

      return report;
    } finally {
      if (typeof seed === 'number') {
        Math.random = originalRandom;
      }
    }
  }

  private async createAssembly(sideConfig: SideConfig): Promise<{ characters: Character[]; totalBP: number }> {
    const compositions = [
      { archetypeName: 'Average', weight: 3, items: ['Sword, Broad', 'Shield, Medium'] },
      { archetypeName: 'Militia', weight: 2, items: ['Spear, Medium', 'Shield, Medium'] },
      { archetypeName: 'Veteran', weight: 3, items: ['Rifle, Light, Semi/A'] },
      { archetypeName: 'Veteran', weight: 2, items: ['Pistol, Medium, Auto', 'Sword, Broad'] },
      { archetypeName: 'Elite', weight: 1, items: ['Rifle, Light, Semi/A', 'Sword, Broad'] },
    ];

    const profiles = [];
    for (let i = 0; i < sideConfig.modelCount; i++) {
      const totalWeight = compositions.reduce((sum, c) => sum + c.weight, 0);
      let random = Math.random() * totalWeight;
      let selected = compositions[0];
      for (const comp of compositions) {
        random -= comp.weight;
        if (random <= 0) { selected = comp; break; }
      }

      const profile = buildProfile(selected.archetypeName, { itemNames: selected.items });
      // Ensure equipment is set from items
      if (!profile.equipment && profile.items) {
        profile.equipment = profile.items;
      }
      if (Array.isArray(profile.items)) {
        profile.items = profile.items.filter(Boolean);
      }
      if (Array.isArray(profile.equipment)) {
        profile.equipment = profile.equipment.filter(Boolean);
      }
      profiles.push(profile);
    }

    const assembly = buildAssembly(sideConfig.assemblyName, profiles);
    assembly.characters.forEach((character, index) => {
      character.id = `${sideConfig.assemblyName}-${index + 1}-${character.id}`;
    });
    return { characters: assembly.characters, totalBP: assembly.assembly.totalBP };
  }

  private createBattlefield(size: number, densityRatio: number): Battlefield {
    const battlefield = new Battlefield(size, size);

    const terrainTypes = ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks', 'Large Rocks'];
    const terrainCount = Math.floor((size * size * densityRatio) / 10000);

    for (let i = 0; i < terrainCount; i++) {
      const terrainName = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
      const x = Math.floor(2 + Math.random() * (size - 4));
      const y = Math.floor(2 + Math.random() * (size - 4));
      const rotation = Math.floor(Math.random() * 360);

      battlefield.addTerrainElement(new TerrainElement(terrainName, { x, y }, rotation));
    }

    return battlefield;
  }

  private deployModels(assembly: { characters: Character[] }, battlefield: Battlefield, sideIndex: number, size: number) {
    const edgeMargin = 3;
    const deploymentDepth = Math.max(6, Math.floor(size * 0.22));
    const count = assembly.characters.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * (size / deploymentDepth))));
    const rows = Math.max(1, Math.ceil(count / cols));
    const xSpacing = cols > 1 ? (size - edgeMargin * 2 - 1) / (cols - 1) : 0;
    const ySpacing = rows > 1 ? (deploymentDepth - 1) / (rows - 1) : 0;
    const sideStartY = sideIndex === 0
      ? edgeMargin
      : Math.max(edgeMargin, size - edgeMargin - deploymentDepth);

    assembly.characters.forEach((char: Character, i: number) => {
      let x, y;
      const row = Math.floor(i / cols);
      const col = i % cols;

      x = edgeMargin + col * xSpacing;
      y = sideStartY + row * ySpacing;
      const preferred = {
        x: Math.max(0, Math.min(size - 1, Math.round(x))),
        y: Math.max(0, Math.min(size - 1, Math.round(y))),
      };
      const fallbackRadius = Math.max(2, Math.ceil(Math.sqrt(count)));
      const deploymentCell = this.findOpenCellNear(preferred, battlefield, fallbackRadius);
      if (!deploymentCell) {
        throw new Error(`Unable to deploy model ${char.id} at side index ${sideIndex}.`);
      }
      battlefield.placeCharacter(char, deploymentCell);
    });
  }

  private findOpenCellNear(
    preferred: Position,
    battlefield: Battlefield,
    maxRadius: number
  ): Position | null {
    const cx = Math.max(0, Math.min(battlefield.width - 1, Math.round(preferred.x)));
    const cy = Math.max(0, Math.min(battlefield.height - 1, Math.round(preferred.y)));

    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
            continue;
          }
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || x >= battlefield.width || y < 0 || y >= battlefield.height) {
            continue;
          }
          if (!battlefield.getCharacterAt({ x, y })) {
            return { x, y };
          }
        }
      }
    }
    return null;
  }

  private async resolveCharacterTurn(
    character: Character,
    allSides: { characters: Character[] }[],
    battlefield: Battlefield,
    gameManager: GameManager,
    aiController: CharacterAI,
    turn: number,
    sideIndex: number,
    config: GameConfig
  ) {
    const sideName = config.sides[sideIndex].name;
    const initialAp = gameManager.beginActivation(character);
    if (initialAp <= 0) {
      gameManager.endActivation(character);
      return;
    }

    try {
      let guard = 0;
      while (gameManager.getApRemaining(character) > 0 && guard < 8) {
        guard++;

        const allies = allSides[sideIndex].characters.filter(c => c.id !== character.id && !c.state.isEliminated && !c.state.isKOd);
        const enemies = allSides.flatMap((side, i) => i !== sideIndex ? side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd) : []);
        if (enemies.length === 0) {
          break;
        }

        const apBefore = gameManager.getApRemaining(character);
        const context: AIContext = {
          character,
          allies,
          enemies,
          battlefield,
          currentTurn: turn,
          currentRound: 1,
          apRemaining: apBefore,
          knowledge: emptyKnowledge(turn),
          config: aiController.getConfig(),
        };
        context.knowledge = aiController.updateKnowledge(context);

        const aiResult = await aiController.decideAction(context);
        const decision = aiResult.decision;
        if (!decision || decision.type === 'none') {
          break;
        }

        const startPos = battlefield.getCharacterPosition(character);
        let actionExecuted = false;
        let result = '';

        if (config.verbose) {
          console.log(`  ${character.profile.name} (${sideName}) [AP ${apBefore}]: ${decision.type}${decision.reason ? ` - ${decision.reason}` : ''}`);
        }

        switch (decision.type) {
          case 'hold': {
            const fallback = this.computeFallbackMovePosition(character, enemies, battlefield, config);
            if (fallback && gameManager.spendAp(character, 1)) {
              const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
              const opportunityWeapon = equipment.find(i => i?.classification === 'Melee' || i?.class === 'Melee') || equipment[0];
              const moved = gameManager.executeMove(character, fallback, {
                opponents: enemies,
                allowOpportunityAttack: true,
                opportunityWeapon: opportunityWeapon ?? undefined,
              });
              if (moved.moved) {
                this.stats.moves++;
                actionExecuted = true;
                result = 'move=true:from-hold';
                break;
              }
            }

            this.trackAttempt(character, 'wait');
            this.stats.waits++;
            const wait = gameManager.executeWait(character, { spendAp: true });
            result = wait.success ? 'wait=true' : `wait=false:${wait.reason ?? 'failed'}`;
            if (wait.success) {
              this.trackSuccess(character, 'wait');
              actionExecuted = true;
            }
            break;
          }
          case 'wait': {
            this.trackAttempt(character, 'wait');
            this.stats.waits++;
            const wait = gameManager.executeWait(character, { spendAp: true });
            result = wait.success ? 'wait=true' : `wait=false:${wait.reason ?? 'failed'}`;
            if (wait.success) {
              this.trackSuccess(character, 'wait');
              actionExecuted = true;
            }
            break;
          }
          case 'move': {
            if (!gameManager.spendAp(character, 1)) {
              result = 'move=false:not-enough-ap';
              break;
            }
            const destination = decision.position ?? this.computeFallbackMovePosition(character, enemies, battlefield, config);
            if (!destination) {
              result = 'move=false:no-destination';
              break;
            }
            const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
            const opportunityWeapon = equipment.find(i => i?.classification === 'Melee' || i?.class === 'Melee') || equipment[0];
            const moved = gameManager.executeMove(character, destination, {
              opponents: enemies,
              allowOpportunityAttack: true,
              opportunityWeapon: opportunityWeapon ?? undefined,
            });
            if (moved.moved) {
              this.stats.moves++;
              actionExecuted = true;
              result = 'move=true';
            } else {
              result = `move=false:${moved.reason ?? 'blocked'}`;
            }
            break;
          }
          case 'charge':
          case 'close_combat': {
            if (!decision.target) {
              result = 'close_combat=false:no-target';
              break;
            }

            let movedForEngagement = false;
            const wasEngaged = this.areEngaged(character, decision.target, battlefield);
            if (!wasEngaged) {
              const engagePos = this.computeEngageMovePosition(character, decision.target, battlefield);
              if (engagePos) {
                if (!gameManager.spendAp(character, 1)) {
                  result = 'close_combat=false:not-enough-ap-for-move';
                  break;
                }
                const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
                const opportunityWeapon = equipment.find(i => i?.classification === 'Melee' || i?.class === 'Melee') || equipment[0];
                const moved = gameManager.executeMove(character, engagePos, {
                  opponents: enemies,
                  allowOpportunityAttack: true,
                  opportunityWeapon: opportunityWeapon ?? undefined,
                });
                if (moved.moved) {
                  movedForEngagement = true;
                  actionExecuted = true;
                  this.stats.moves++;
                }
              }
            }

            if (this.areEngaged(character, decision.target, battlefield)) {
              const weapon = this.pickMeleeWeapon(character);
              if (!weapon) {
                result = 'close_combat=false:no-weapon';
                break;
              }
              const attackCost = gameManager.getAttackApCost(character, weapon as any);
              if (!gameManager.spendAp(character, attackCost)) {
                result = `close_combat=false:not-enough-ap(${attackCost})`;
                break;
              }
              this.stats.closeCombats++;
              const closeExecuted = await this.executeCloseCombat(
                character,
                decision.target,
                battlefield,
                gameManager,
                config,
                turn,
                sideIndex,
                decision.type === 'charge' || movedForEngagement
              );
              actionExecuted = actionExecuted || closeExecuted;
              result = closeExecuted ? 'close_combat=true' : 'close_combat=false:resolution';
            } else if (!actionExecuted) {
              result = 'close_combat=false:not-engaged';
            }
            break;
          }
          case 'ranged_combat': {
            if (!decision.target) {
              result = 'ranged=false:no-target';
              break;
            }
            const ranged = await this.executeRangedCombat(
              character,
              decision.target,
              battlefield,
              gameManager,
              config,
              turn,
              sideIndex
            );
            actionExecuted = ranged.executed;
            result = ranged.result;
            if (ranged.executed) {
              this.stats.rangedCombats++;
            }
            break;
          }
          case 'disengage': {
            if (!decision.target) {
              result = 'disengage=false:no-target';
              break;
            }
            if (!gameManager.spendAp(character, 1)) {
              result = 'disengage=false:not-enough-ap';
              break;
            }
            this.stats.disengages++;
            const disengage = await this.executeDisengage(character, decision.target, battlefield, gameManager, config, turn, sideIndex);
            actionExecuted = disengage;
            result = disengage ? 'disengage=true' : 'disengage=false';
            break;
          }
          case 'detect': {
            if (!decision.target) {
              result = 'detect=false:no-target';
              break;
            }
            this.trackAttempt(character, 'detect');
            this.stats.detects++;
            if (!gameManager.spendAp(character, 1)) {
              result = 'detect=false:not-enough-ap';
              break;
            }
            const detect = attemptDetect(battlefield, character, decision.target, enemies);
            result = detect.success ? 'detect=true' : `detect=false:${detect.reason ?? 'failed'}`;
            if (detect.success) {
              this.trackSuccess(character, 'detect');
              actionExecuted = true;
            }
            break;
          }
          case 'hide': {
            this.trackAttempt(character, 'hide');
            this.stats.hides++;
            const hide = attemptHide(battlefield, character, enemies, (amount: number) => gameManager.spendAp(character, amount));
            result = hide.canHide ? 'hide=true' : `hide=false:${hide.reason ?? 'failed'}`;
            if (hide.canHide) {
              this.trackSuccess(character, 'hide');
              actionExecuted = true;
            }
            break;
          }
          case 'rally': {
            if (!decision.target) {
              result = 'rally=false:no-target';
              break;
            }
            if (!gameManager.spendAp(character, 1)) {
              result = 'rally=false:not-enough-ap';
              break;
            }
            const rally = gameManager.executeRally(character, decision.target);
            result = rally.success ? 'rally=true' : `rally=false:${rally.reason ?? 'failed'}`;
            actionExecuted = rally.success;
            break;
          }
          case 'revive': {
            if (!decision.target) {
              result = 'revive=false:no-target';
              break;
            }
            if (!gameManager.spendAp(character, 1)) {
              result = 'revive=false:not-enough-ap';
              break;
            }
            const revive = gameManager.executeRevive(character, decision.target);
            result = revive.success ? 'revive=true' : `revive=false:${revive.reason ?? 'failed'}`;
            actionExecuted = revive.success;
            break;
          }
          default:
            result = `${decision.type}=false:unsupported`;
            break;
        }

        this.log.push({
          turn,
          round: 1,
          modelId: character.id,
          side: sideName,
          model: character.profile.name,
          action: decision.type,
          detail: decision.reason,
          result,
        });

        if (actionExecuted) {
          this.stats.totalActions++;
          const endPos = battlefield.getCharacterPosition(character);
          const movedDistance = startPos && endPos ? Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y) : 0;
          this.trackPathMovement(character, movedDistance);
          const trigger = movedDistance > 0 ? 'Move' : 'NonMove';
          const reactResult = this.processReacts(character, enemies, gameManager, trigger, movedDistance, config.visibilityOrMu);
          if (reactResult.executed) {
            this.stats.reacts++;
            if (reactResult.reactor) {
              this.trackAttempt(reactResult.reactor, 'react');
              this.trackSuccess(reactResult.reactor, 'react');
            }
          }
        }

        const apAfter = gameManager.getApRemaining(character);
        if (apAfter >= apBefore) {
          const fallback = this.computeFallbackMovePosition(character, enemies, battlefield, config);
          if (fallback && gameManager.spendAp(character, 1)) {
            const fallbackStart = battlefield.getCharacterPosition(character);
            const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
            const opportunityWeapon = equipment.find(i => i?.classification === 'Melee' || i?.class === 'Melee') || equipment[0];
            const moved = gameManager.executeMove(character, fallback, {
              opponents: enemies,
              allowOpportunityAttack: true,
              opportunityWeapon: opportunityWeapon ?? undefined,
            });
            if (moved.moved) {
              const fallbackEnd = battlefield.getCharacterPosition(character);
              const movedDistance = fallbackStart && fallbackEnd
                ? Math.hypot(fallbackEnd.x - fallbackStart.x, fallbackEnd.y - fallbackStart.y)
                : 0;
              this.stats.moves++;
              this.stats.totalActions++;
              this.trackPathMovement(character, movedDistance);
              this.log.push({
                turn,
                round: 1,
                modelId: character.id,
                side: sideName,
                model: character.profile.name,
                action: 'move',
                detail: 'Fallback advance after stalled decision',
                result: 'move=true:forced',
              });
              const reactResult = this.processReacts(
                character,
                enemies,
                gameManager,
                movedDistance > 0 ? 'Move' : 'NonMove',
                movedDistance,
                config.visibilityOrMu
              );
              if (reactResult.executed) {
                this.stats.reacts++;
                if (reactResult.reactor) {
                  this.trackAttempt(reactResult.reactor, 'react');
                  this.trackSuccess(reactResult.reactor, 'react');
                }
              }
              continue;
            }
          }
          break;
        }
      }
    } catch (error) {
      if (config.verbose) {
        console.error(`    Error: ${error}`);
      }
    }

    gameManager.endActivation(character);
  }

  private areEngaged(attacker: Character, defender: Character, battlefield: Battlefield): boolean {
    const attackerPos = battlefield.getCharacterPosition(attacker);
    const defenderPos = battlefield.getCharacterPosition(defender);
    if (!attackerPos || !defenderPos) return false;
    const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3;
    const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 3;
    return SpatialRules.isEngaged(
      {
        id: attacker.id,
        position: attackerPos,
        baseDiameter: getBaseDiameterFromSiz(attackerSiz),
        siz: attackerSiz,
      },
      {
        id: defender.id,
        position: defenderPos,
        baseDiameter: getBaseDiameterFromSiz(defenderSiz),
        siz: defenderSiz,
      }
    );
  }

  private computeEngageMovePosition(
    attacker: Character,
    defender: Character,
    battlefield: Battlefield
  ): Position | null {
    const attackerPos = battlefield.getCharacterPosition(attacker);
    const defenderPos = battlefield.getCharacterPosition(defender);
    if (!attackerPos || !defenderPos) return null;

    const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3;
    const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 3;
    const requiredDistance = (getBaseDiameterFromSiz(attackerSiz) + getBaseDiameterFromSiz(defenderSiz)) / 2;
    const dx = defenderPos.x - attackerPos.x;
    const dy = defenderPos.y - attackerPos.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= requiredDistance || distance === 0) return null;

    const mov = attacker.finalAttributes.mov ?? attacker.attributes.mov ?? 2;
    const step = Math.min(mov, distance - requiredDistance);
    if (step <= 0) return null;

    const ratio = step / distance;
    return {
      x: Math.max(0, Math.min(battlefield.width - 1, Math.round(attackerPos.x + dx * ratio))),
      y: Math.max(0, Math.min(battlefield.height - 1, Math.round(attackerPos.y + dy * ratio))),
    };
  }

  private processReacts(
    active: Character,
    opponents: Character[],
    gameManager: GameManager,
    trigger: 'Move' | 'NonMove',
    movedDistance: number,
    visibilityOrMu: number
  ): { executed: boolean; reactor?: Character } {
    const options = gameManager.getReactOptionsSorted({
      battlefield: gameManager.battlefield!,
      active,
      opponents,
      trigger,
      movedDistance,
    });
    const first = options.find(option => option.available && option.type === 'StandardReact');
    if (!first) {
      return { executed: false };
    }

    const equipment = (first.actor.profile.equipment || first.actor.profile.items || []).filter(Boolean);
    const weapon = equipment.find(i =>
      i?.classification === 'Bow' ||
      i?.classification === 'Thrown' ||
      i?.classification === 'Range' ||
      i?.classification === 'Firearm' ||
      i?.classification === 'Support'
    ) || equipment[0];
    if (!weapon) {
      return { executed: false };
    }

    const react = gameManager.executeStandardReact(first.actor, active, weapon, { visibilityOrMu });
    return { executed: react.executed, reactor: react.executed ? first.actor : undefined };
  }

  private computeFallbackMovePosition(
    actor: Character,
    enemies: Character[],
    battlefield: Battlefield,
    config: GameConfig
  ): Position | null {
    const actorPos = battlefield.getCharacterPosition(actor);
    if (!actorPos || enemies.length === 0) {
      return null;
    }

    const candidateEnemies = config.perCharacterFovLos
      ? enemies.filter(enemy => this.hasLos(actor, enemy, battlefield))
      : enemies;

    if (candidateEnemies.length === 0) {
      return null;
    }

    let nearestEnemy: Character | null = null;
    let nearestDistance = Infinity;
    for (const enemy of candidateEnemies) {
      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const distance = Math.hypot(enemyPos.x - actorPos.x, enemyPos.y - actorPos.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    }

    if (!nearestEnemy || nearestDistance <= 1) {
      return null;
    }

    const enemyPos = battlefield.getCharacterPosition(nearestEnemy);
    if (!enemyPos) {
      return null;
    }

    const mov = actor.finalAttributes.mov ?? actor.attributes.mov ?? 2;
    const moveAllowance = Math.max(1, mov);
    const engine = new PathfindingEngine(battlefield);
    const path = engine.findPathWithMaxMu(
      actorPos,
      enemyPos,
      {
        movementMetric: 'length',
        useNavMesh: true,
        useHierarchical: true,
        optimizeWithLOS: true,
        footprintDiameter: getBaseDiameterFromSiz(actor.finalAttributes.siz ?? actor.attributes.siz ?? 3),
      },
      moveAllowance
    );

    const desired = path.points[path.points.length - 1] ?? this.computeDirectAdvanceStep(actorPos, enemyPos, moveAllowance);
    if (!desired) {
      return null;
    }

    return this.snapToOpenCell(desired, actor, battlefield) ??
      this.snapToOpenCell(actorPos, actor, battlefield);
  }

  private computeDirectAdvanceStep(
    actorPos: Position,
    enemyPos: Position,
    moveAllowance: number
  ): Position | null {
    const dx = enemyPos.x - actorPos.x;
    const dy = enemyPos.y - actorPos.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0 || moveAllowance <= 0) {
      return null;
    }

    const step = Math.min(moveAllowance, distance);
    const ratio = step / distance;
    return {
      x: actorPos.x + dx * ratio,
      y: actorPos.y + dy * ratio,
    };
  }

  private hasLos(observer: Character, target: Character, battlefield: Battlefield): boolean {
    const observerPos = battlefield.getCharacterPosition(observer);
    const targetPos = battlefield.getCharacterPosition(target);
    if (!observerPos || !targetPos) return false;

    return SpatialRules.hasLineOfSight(
      battlefield,
      {
        id: observer.id,
        position: observerPos,
        baseDiameter: getBaseDiameterFromSiz(observer.finalAttributes.siz ?? observer.attributes.siz ?? 3),
        siz: observer.finalAttributes.siz ?? observer.attributes.siz ?? 3,
      },
      {
        id: target.id,
        position: targetPos,
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? target.attributes.siz ?? 3,
      }
    );
  }

  private snapToOpenCell(position: Position, actor: Character, battlefield: Battlefield): Position | null {
    const actorPos = battlefield.getCharacterPosition(actor);
    if (!actorPos) return null;

    const cx = Math.max(0, Math.min(battlefield.width - 1, Math.round(position.x)));
    const cy = Math.max(0, Math.min(battlefield.height - 1, Math.round(position.y)));

    for (let radius = 0; radius <= 4; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const x = Math.max(0, Math.min(battlefield.width - 1, cx + dx));
          const y = Math.max(0, Math.min(battlefield.height - 1, cy + dy));
          if (x === actorPos.x && y === actorPos.y) continue;
          const occupant = battlefield.getCharacterAt({ x, y });
          if (!occupant || occupant.id === actor.id) {
            return { x, y };
          }
        }
      }
    }

    return null;
  }

  private pickMeleeWeapon(character: Character) {
    const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
    return equipment.find(i => i?.classification === 'Melee') ||
      equipment.find(i => i?.class === 'Melee') ||
      equipment[0] ||
      null;
  }

  private pickRangedWeapon(character: Character) {
    const equipment = (character.profile.equipment || character.profile.items || []).filter(Boolean);
    return equipment.find(i =>
      i?.classification === 'Bow' ||
      i?.classification === 'Thrown' ||
      i?.classification === 'Range' ||
      i?.classification === 'Firearm' ||
      i?.classification === 'Support' ||
      ((i?.classification === 'Melee' || i?.classification === 'Natural' || i?.class === 'Melee' || i?.class === 'Natural') &&
        Array.isArray(i?.traits) &&
        i.traits.some(t => t.toLowerCase().includes('throwable')))
    ) || null;
  }

  private normalizeAttackResult(result: any): {
    hit?: boolean;
    ko: boolean;
    eliminated: boolean;
  } {
    const hit = result?.result?.hit ?? result?.hit;
    const damageResolution = result?.result?.damageResolution ?? result?.damageResolution;
    const ko = Boolean(damageResolution?.defenderState?.isKOd ?? damageResolution?.defenderKOd);
    const eliminated = Boolean(damageResolution?.defenderState?.isEliminated ?? damageResolution?.defenderEliminated);
    return { hit, ko, eliminated };
  }

  private async executeCloseCombat(
    attacker: Character,
    defender: Character,
    battlefield: Battlefield,
    gameManager: GameManager,
    config: GameConfig,
    turn: number,
    sideIndex: number,
    isCharge: boolean
  ): Promise<boolean> {
    const weapon = this.pickMeleeWeapon(attacker);

    if (!weapon) {
      if (config.verbose) console.log(`    → No weapon available`);
      return false;
    }

    try {
      const result = gameManager.executeCloseCombatAttack(attacker, defender, weapon, {
        isCharge,
        isDefending: false,
      });
      const normalized = this.normalizeAttackResult(result);

      if (config.verbose) {
        const koStatus = normalized.ko ? 'KO' : 'OK';
        const elimStatus = normalized.eliminated ? 'Elim' : 'Active';
        console.log(`    → Hit: ${normalized.hit}, KO: ${koStatus}, Elim: ${elimStatus}`);
      }

      if (normalized.ko) {
        this.stats.kos++;
      }
      if (normalized.eliminated) {
        this.stats.eliminations++;
      }
      return true;
    } catch (error) {
      if (config.verbose) {
        console.error(`    Combat error: ${error}`);
      }
      return false;
    }
  }

  private async executeRangedCombat(
    attacker: Character,
    defender: Character,
    battlefield: Battlefield,
    gameManager: GameManager,
    config: GameConfig,
    turn: number,
    sideIndex: number
  ): Promise<{ executed: boolean; result: string }> {
    const weapon = this.pickRangedWeapon(attacker);
    if (!weapon) {
      if (config.verbose) console.log(`    → No ranged weapon available`);
      return { executed: false, result: 'ranged=false:no-weapon' };
    }

    try {
      const attackerPos = battlefield.getCharacterPosition(attacker);
      const defenderPos = battlefield.getCharacterPosition(defender);
      if (!attackerPos || !defenderPos) {
        if (config.verbose) console.log(`    → Invalid positions`);
        return { executed: false, result: 'ranged=false:invalid-position' };
      }

      if (config.perCharacterFovLos && !this.hasLos(attacker, defender, battlefield)) {
        return { executed: false, result: 'ranged=false:no-los' };
      }

      const distance = Math.hypot(attackerPos.x - defenderPos.x, attackerPos.y - defenderPos.y);
      const weaponOrMu = parseWeaponOptimalRangeMu(attacker, weapon as any);
      const rangeCheck = evaluateRangeWithVisibility(distance, weaponOrMu, {
        visibilityOrMu: config.visibilityOrMu,
        maxOrm: config.maxOrm,
        allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
      });
      if (!rangeCheck.inRange) {
        return { executed: false, result: 'ranged=false:out-of-range' };
      }

      let orm = rangeCheck.orm;
      let context = undefined as ReturnType<GameManager['buildConcentrateContext']> | undefined;
      if (rangeCheck.requiresConcentrate) {
        if (!gameManager.spendAp(attacker, 1)) {
          return { executed: false, result: 'ranged=false:not-enough-ap-concentrate' };
        }
        orm = rangeCheck.concentratedOrm;
        context = gameManager.buildConcentrateContext('hit');
      }

      const attackCost = gameManager.getAttackApCost(attacker, weapon as any);
      if (!gameManager.spendAp(attacker, attackCost)) {
        return { executed: false, result: `ranged=false:not-enough-ap(${attackCost})` };
      }

      this.stats.losChecks++;
      battlefield.hasLineOfSight(attackerPos, defenderPos);
      this.stats.lofChecks++;
      LOFOperations.getModelsAlongLOF(
        attackerPos,
        defenderPos,
        battlefield.getModelBlockers([attacker.id, defender.id]).map(model => ({
          id: model.id,
          position: model.position,
          baseDiameter: model.baseDiameter,
        })),
        { lofWidth: 1 }
      );

      const result = gameManager.executeRangedAttack(attacker, defender, weapon, {
        orm,
        context,
        optimalRangeMu: rangeCheck.requiresConcentrate ? rangeCheck.concentratedOrMu : rangeCheck.effectiveOrMu,
      });
      const normalized = this.normalizeAttackResult(result);
      if (config.verbose) {
        console.log(`    → Hit: ${normalized.hit}, KO: ${normalized.ko}, Elim: ${normalized.eliminated}`);
      }

      if (normalized.ko) {
        this.stats.kos++;
      }
      if (normalized.eliminated) {
        this.stats.eliminations++;
      }
      return { executed: true, result: `ranged=true:orm=${orm}${rangeCheck.requiresConcentrate ? ':concentrate' : ''}` };
    } catch (error) {
      if (config.verbose) {
        console.error(`    Ranged combat error: ${error}`);
      }
      return { executed: false, result: 'ranged=false:error' };
    }
  }

  private async executeDisengage(
    disengager: Character,
    defender: Character,
    battlefield: Battlefield,
    gameManager: GameManager,
    config: GameConfig,
    turn: number,
    sideIndex: number
  ): Promise<boolean> {
    try {
      // Get defender's melee weapon from equipment or items
      const weapon = this.pickMeleeWeapon(defender);
      
      if (!weapon) {
        if (config.verbose) console.log(`    → No weapon for disengage`);
        return false;
      }

      const result = gameManager.executeDisengage(disengager, defender, weapon);

      if (config.verbose) {
        const moved = result.pass && 'moved' in result && result.moved ? ', moved' : '';
        console.log(`    → Disengage: ${result.pass ? `Success${moved}` : 'Failed'}`);
      }
      return result.pass;
    } catch (error) {
      if (config.verbose) {
        console.error(`    Disengage error: ${error}`);
      }
      return false;
    }
  }

  private displayReport(report: BattleReport) {
    console.log(`\n${formatBattleReportHumanReadable(report)}\n`);
  }
}

// ============================================================================
// CLI Entry Points
// ============================================================================

async function runInteractive() {
  const setup = new AIBattleSetup();
  const runner = new AIBattleRunner();

  try {
    const config = await setup.runInteractiveSetup();
    setup.close();

    const report = await runner.runBattle(config);
    const reportPath = writeSingleBattleReport(report);
    console.log(`📁 JSON Report: ${reportPath}`);

    console.log('✅ Battle completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Battle failed with error:');
    console.error(error);
    setup.close();
    process.exit(1);
  }
}

async function runQuickBattle(
  gameSize: GameSize = GameSize.VERY_LARGE,
  missionId: string = 'QAI_11',
  densityRatio: number = 50,
  lighting: LightingCondition = 'Day, Clear'
) {
  const visibilityOrMu = getVisibilityOrForLighting(lighting);
  const config: GameConfig = {
    missionId,
    missionName: missionId === 'QAI_11' ? 'Elimination' : 'Custom',
    gameSize,
    battlefieldSize: GAME_SIZE_CONFIG[gameSize].battlefieldSize,
    maxTurns: GAME_SIZE_CONFIG[gameSize].maxTurns,
    endGameTurn: GAME_SIZE_CONFIG[gameSize].endGameTurn,
    sides: [
      {
        name: 'Alpha',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Alpha Assembly',
        aggression: 0.5,
        caution: 0.5,
      },
      {
        name: 'Bravo',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Bravo Assembly',
        aggression: 0.5,
        caution: 0.5,
      },
    ],
    densityRatio,
    lighting,
    visibilityOrMu,
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    verbose: true,
  };

  const runner = new AIBattleRunner();

  try {
    const report = await runner.runBattle(config);
    const reportPath = writeSingleBattleReport(report);
    console.log(`📁 JSON Report: ${reportPath}`);
    console.log('✅ Battle completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Battle failed with error:');
    console.error(error);
    process.exit(1);
  }
}

function accumulateStats(total: BattleStats, add: BattleStats) {
  (Object.keys(total) as Array<keyof BattleStats>).forEach((key) => {
    total[key] += add[key];
  });
}

function divideStats(total: BattleStats, runs: number): BattleStats {
  const avg = createEmptyStats();
  (Object.keys(total) as Array<keyof BattleStats>).forEach((key) => {
    avg[key] = Number((total[key] / runs).toFixed(2));
  });
  return avg;
}

function baseCoverageFromStats(stats: BattleStats): ValidationCoverage {
  return {
    movement: stats.moves > 0,
    pathfinding: stats.moves > 0,
    rangedCombat: stats.rangedCombats > 0,
    closeCombat: stats.closeCombats > 0,
    react: stats.reacts > 0,
    wait: stats.waits > 0,
    detect: stats.detects > 0,
    los: stats.losChecks > 0,
    lof: stats.lofChecks > 0,
  };
}

function mergeCoverage(
  coverage: ValidationCoverage,
  patch: Partial<ValidationCoverage>
): ValidationCoverage {
  return {
    movement: coverage.movement || Boolean(patch.movement),
    pathfinding: coverage.pathfinding || Boolean(patch.pathfinding),
    rangedCombat: coverage.rangedCombat || Boolean(patch.rangedCombat),
    closeCombat: coverage.closeCombat || Boolean(patch.closeCombat),
    react: coverage.react || Boolean(patch.react),
    wait: coverage.wait || Boolean(patch.wait),
    detect: coverage.detect || Boolean(patch.detect),
    los: coverage.los || Boolean(patch.los),
    lof: coverage.lof || Boolean(patch.lof),
  };
}

function ensureEquipment(profile: ReturnType<typeof buildProfile>) {
  if (!profile.equipment && profile.items) {
    profile.equipment = profile.items;
  }
  if (Array.isArray(profile.items)) {
    profile.items = profile.items.filter(Boolean);
  }
  if (Array.isArray(profile.equipment)) {
    profile.equipment = profile.equipment.filter(Boolean);
  }
}

function runMechanicProbes(): Partial<ValidationCoverage> {
  try {
    const attackerProfile = buildProfile('Veteran', { itemNames: ['Rifle, Light, Semi/A'] });
    const defenderProfile = buildProfile('Average', { itemNames: ['Sword, Broad'] });
    const reactorProfile = buildProfile('Veteran', { itemNames: ['Rifle, Light, Semi/A'] });
    const activeProfile = buildProfile('Average', { itemNames: ['Sword, Broad'] });
    [attackerProfile, defenderProfile, reactorProfile, activeProfile].forEach(ensureEquipment);

    const assembly = buildAssembly('Probe Assembly', [
      attackerProfile,
      defenderProfile,
      reactorProfile,
      activeProfile,
    ]);
    const [attacker, defender, reactor, active] = assembly.characters;
    if (!attacker || !defender || !reactor || !active) {
      return {};
    }

    const battlefield = new Battlefield(12, 12);
    battlefield.placeCharacter(attacker, { x: 2, y: 2 });
    battlefield.placeCharacter(defender, { x: 8, y: 2 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });
    battlefield.placeCharacter(active, { x: 6, y: 6 });

    const manager = new GameManager([attacker, defender, reactor, active], battlefield);
    const coverage: Partial<ValidationCoverage> = {};

    manager.beginActivation(attacker);
    const moved = manager.executeMove(attacker, { x: 4, y: 2 });
    coverage.movement = moved.moved;
    coverage.pathfinding = moved.moved;
    manager.endActivation(attacker);

    manager.beginActivation(active);
    const waited = manager.executeWait(active, { spendAp: true });
    coverage.wait = waited.success;
    manager.endActivation(active);

    defender.state.isHidden = true;
    const detect = manager.attemptDetect(attacker, defender, [defender]);
    coverage.detect = detect.success;

    const attackerPos = battlefield.getCharacterPosition(attacker);
    const defenderPos = battlefield.getCharacterPosition(defender);
    if (attackerPos && defenderPos) {
      coverage.los = battlefield.hasLineOfSight(attackerPos, defenderPos);
      const alongLof = LOFOperations.getModelsAlongLOF(
        attackerPos,
        defenderPos,
        battlefield.getModelBlockers([attacker.id, defender.id]).map(model => ({
          id: model.id,
          position: model.position,
          baseDiameter: model.baseDiameter,
        })),
        { lofWidth: 1 }
      );
      coverage.lof = Array.isArray(alongLof);
    }

    const rangedWeaponPool = (attacker.profile.equipment || attacker.profile.items || []).filter(Boolean);
    const rangedWeapon = rangedWeaponPool.find(i =>
      i?.classification === 'Bow' ||
      i?.classification === 'Thrown' ||
      i?.classification === 'Range' ||
      i?.classification === 'Firearm'
    ) || rangedWeaponPool[0];
    if (rangedWeapon) {
      const ranged = manager.executeRangedAttack(attacker, defender, rangedWeapon, { orm: 4 });
      coverage.rangedCombat = Boolean(ranged.result);
    }

    battlefield.moveCharacter(active, { x: 3, y: 6 });
    reactor.state.isWaiting = true;
    const reactWeapon = (reactor.profile.equipment || reactor.profile.items || [])[0];
    if (reactWeapon) {
      const react = manager.executeStandardReact(reactor, active, reactWeapon);
      coverage.react = react.executed;
    }

    battlefield.moveCharacter(defender, { x: 5, y: 2 });
    const meleeWeapon = (defender.profile.equipment || defender.profile.items || [])[0];
    if (meleeWeapon) {
      const close = manager.executeCloseCombatAttack(attacker, defender, meleeWeapon, {
        isDefending: false,
        isCharge: false,
      });
      coverage.closeCombat = Boolean(close.result);
    }

    return coverage;
  } catch {
    return {};
  }
}

function writeValidationReport(report: ValidationAggregateReport): string {
  const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(outputDir, `mission-11-validation-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}

function writeSingleBattleReport(report: BattleReport): string {
  const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(outputDir, `battle-report-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}

export function formatBattleReportFromJson(jsonText: string): string {
  return formatBattleReportHumanReadable(JSON.parse(jsonText) as BattleReport);
}

async function runValidationBatch(
  gameSize: GameSize = GameSize.VERY_LARGE,
  densityRatio: number = 50,
  runs: number = 3,
  baseSeed: number = 424242,
  lighting: LightingCondition = 'Day, Clear'
) {
  if (runs < 1) {
    throw new Error('Validation runs must be >= 1.');
  }

  const winners: Record<string, number> = {};
  const totals = createEmptyStats();
  const runReports: ValidationAggregateReport['runReports'] = [];
  const visibilityOrMu = getVisibilityOrForLighting(lighting);
  const baseConfig: GameConfig = {
    missionId: 'QAI_11',
    missionName: 'Elimination',
    gameSize,
    battlefieldSize: GAME_SIZE_CONFIG[gameSize].battlefieldSize,
    maxTurns: GAME_SIZE_CONFIG[gameSize].maxTurns,
    endGameTurn: GAME_SIZE_CONFIG[gameSize].endGameTurn,
    sides: [
      {
        name: 'Alpha',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Alpha Assembly',
        aggression: 0.5,
        caution: 0.5,
      },
      {
        name: 'Bravo',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Bravo Assembly',
        aggression: 0.5,
        caution: 0.5,
      },
    ],
    densityRatio,
    lighting,
    visibilityOrMu,
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    verbose: false,
  };

  console.log(`\nRunning ${runs} validation battle(s) for Mission 11 (${gameSize})...`);
  for (let i = 0; i < runs; i++) {
    const seed = baseSeed + i;
    const runner = new AIBattleRunner();
    const report = await runner.runBattle(baseConfig, { seed, suppressOutput: true });
    winners[report.winner] = (winners[report.winner] ?? 0) + 1;
    accumulateStats(totals, report.stats);
    runReports.push({
      run: i + 1,
      seed,
      winner: report.winner,
      finalCounts: report.finalCounts,
      stats: report.stats,
      usage: {
        modelCount: report.usage?.modelCount ?? 0,
        modelsMoved: report.usage?.modelsMoved ?? 0,
        modelsUsedWait: report.usage?.modelsUsedWait ?? 0,
        modelsUsedDetect: report.usage?.modelsUsedDetect ?? 0,
        modelsUsedHide: report.usage?.modelsUsedHide ?? 0,
        modelsUsedReact: report.usage?.modelsUsedReact ?? 0,
        totalPathLength: report.usage?.totalPathLength ?? 0,
        averagePathLengthPerMovedModel: report.usage?.averagePathLengthPerMovedModel ?? 0,
        averagePathLengthPerModel: report.usage?.averagePathLengthPerModel ?? 0,
        topPathModels: report.usage?.topPathModels ?? [],
      },
    });
    console.log(
      `  Run ${i + 1}/${runs}: winner=${report.winner}, moves=${report.stats.moves}, ranged=${report.stats.rangedCombats}, close=${report.stats.closeCombats}, path=${(report.usage?.totalPathLength ?? 0).toFixed(2)}`
    );
  }

  let coverage = baseCoverageFromStats(totals);
  coverage = mergeCoverage(coverage, runMechanicProbes());

  const aggregateReport: ValidationAggregateReport = {
    missionId: 'QAI_11',
    gameSize,
    densityRatio,
    runs,
    baseSeed,
    winners,
    totals,
    averages: divideStats(totals, runs),
    coverage,
    runReports,
    generatedAt: new Date().toISOString(),
  };

  const outputPath = writeValidationReport(aggregateReport);
  console.log('\nValidation aggregate:');
  console.log(`  Winners: ${JSON.stringify(winners)}`);
  console.log(`  Coverage: ${JSON.stringify(coverage)}`);
  console.log(`  Report: ${outputPath}`);
}

function renderBattleReportFile(reportPath: string) {
  const jsonText = readFileSync(reportPath, 'utf-8');
  console.log(`\n${formatBattleReportFromJson(jsonText)}\n`);
}

function parseLightingArg(value: string | undefined): LightingCondition {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return 'Day, Clear';
  if (
    normalized === '2' ||
    normalized === 'twilight' ||
    normalized === 'twilight_overcast' ||
    normalized === 'twilight-overcast'
  ) {
    return 'Twilight, Overcast';
  }
  return 'Day, Clear';
}

// Main entry point
const args = process.argv.slice(2);
const command = args[0];

if (command === '--interactive' || command === '-i') {
  runInteractive();
} else if (command === '--render-report' || command === '-r') {
  const reportPath = args[1];
  if (!reportPath) {
    console.error('Missing report path. Usage: npm run ai-battle -- -r generated/ai-battle-reports/<file>.json');
    process.exit(1);
  }
  try {
    renderBattleReportFile(reportPath);
  } catch (error) {
    console.error('\n❌ Report rendering failed with error:');
    console.error(error);
    process.exit(1);
  }
} else if (command === '--validate' || command === '-v') {
  const sizeArg = (args[1] || 'VERY_LARGE').toUpperCase();
  const densityParsed = parseInt(args[2], 10);
  const runsParsed = parseInt(args[3], 10);
  const seedParsed = parseInt(args[4], 10);
  const densityArg = Number.isFinite(densityParsed) ? densityParsed : 50;
  const runsArg = Number.isFinite(runsParsed) ? runsParsed : 3;
  const seedArg = Number.isFinite(seedParsed) ? seedParsed : 424242;
  const lighting = parseLightingArg(args[5]);
  const toGameSize: Record<string, GameSize> = {
    VERY_SMALL: GameSize.VERY_SMALL,
    SMALL: GameSize.SMALL,
    MEDIUM: GameSize.MEDIUM,
    LARGE: GameSize.LARGE,
    VERY_LARGE: GameSize.VERY_LARGE,
  };
  const gameSize = toGameSize[sizeArg] ?? GameSize.VERY_LARGE;
  runValidationBatch(gameSize, densityArg, runsArg, seedArg, lighting).catch((error) => {
    console.error('\n❌ Validation failed with error:');
    console.error(error);
    process.exit(1);
  });
} else if (command === '--help' || command === '-h') {
  console.log(`
AI Battle Setup - MEST Tactics

Usage:
  npm run ai-battle                    # Quick battle (VERY_LARGE, density 50)
  npm run ai-battle -- -i              # Interactive setup
  npm run ai-battle -- -r REPORT_PATH
  npm run ai-battle -- -v SIZE DENSITY RUNS SEED [LIGHTING]
  npm run ai-battle -- SIZE DENSITY [LIGHTING]    # Quick battle with custom params

Game Sizes: VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE
Lighting: DAY (default) | TWILIGHT

Examples:
  npm run ai-battle -- VERY_LARGE 50   # Large battle, 50% terrain
  npm run ai-battle -- VERY_LARGE 50 TWILIGHT
  npm run ai-battle -- SMALL 30        # Small battle, 30% terrain
  npm run ai-battle -- -r generated/ai-battle-reports/battle-report-<ts>.json
  npm run ai-battle -- -v VERY_LARGE 50 5 424242 TWILIGHT
`);
} else {
  // Default: run quick battle with VERY_LARGE and density 50
  const sizeArg = (args[0] || 'VERY_LARGE').toUpperCase();
  const densityParsed = parseInt(args[1], 10);
  const densityArg = Number.isFinite(densityParsed) ? densityParsed : 50;
  const lighting = parseLightingArg(args[2]);
  const toGameSize: Record<string, GameSize> = {
    VERY_SMALL: GameSize.VERY_SMALL,
    SMALL: GameSize.SMALL,
    MEDIUM: GameSize.MEDIUM,
    LARGE: GameSize.LARGE,
    VERY_LARGE: GameSize.VERY_LARGE,
  };
  const gameSize = toGameSize[sizeArg] ?? GameSize.VERY_LARGE;
  runQuickBattle(gameSize, 'QAI_11', densityArg, lighting);
}
