/**
 * Battle Runner - Core Battle Execution Engine
 * 
 * Unified battle runner that exercises full AI System + Mission + Engine integration.
 * Supports 2-4 sides with configurable AI controllers per side.
 * 
 * Usage:
 * ```typescript
 * const runner = new BattleRunner(config);
 * const result = await runner.run();
 * ```
 */

import { buildAssembly, buildProfile, GameSize, gameSizeDefaults } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { buildMissionSide } from '../../src/lib/mest-tactics/mission/MissionSideBuilder';
import { Battlefield } from '../../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { GameManager } from '../../src/lib/mest-tactics/engine/GameManager';
import { CharacterAI } from '../../src/lib/mest-tactics/ai/core/CharacterAI';
import { TacticalDoctrine } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { MissionLoader } from '../../src/lib/mest-tactics/missions/mission-loader';
import { MissionEngine } from '../../src/lib/mest-tactics/missions/mission-engine';
import { MissionRuntimeAdapter } from '../../src/lib/mest-tactics/missions/mission-runtime-adapter';
import { getEndGameTriggerTurn } from '../../src/lib/mest-tactics/engine/end-game-trigger';
import { InstrumentationLogger, InstrumentationGrade } from '../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { AIGameLoop, DEFAULT_AI_GAME_LOOP_CONFIG } from '../../src/lib/mest-tactics/ai/executor/AIGameLoop';

// Re-export for convenience
export { GameSize, InstrumentationGrade };

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Tactical Doctrine for AI behavior
 */
export type AITacticalDoctrine = 'Aggressive' | 'Defensive' | 'Balanced' | 'Objective' | 'Opportunistic';

/**
 * AI Controller configuration per side
 */
export interface SideAIConfig {
  /** Number of AI controllers (0=human, 1=single AI, 2=strategic+tactical) */
  count: 0 | 1 | 2;
  /** Tactical doctrine for AI behavior */
  doctrine: AITacticalDoctrine;
}

/**
 * Side configuration
 */
export interface SideConfig {
  /** Side identifier */
  id: string;
  /** Name for display */
  name: string;
  /** Assembly configurations (1-2 assemblies per side) */
  assemblies: AssemblyConfig[];
  /** AI controller configuration */
  ai: SideAIConfig;
}

/**
 * Assembly configuration
 */
export interface AssemblyConfig {
  /** Assembly name */
  name: string;
  /** Archetype name */
  archetypeName: string;
  /** Number of models */
  count: number;
  /** Item names for equipment */
  itemNames: string[];
}

/**
 * Lighting preset
 */
export interface LightingPreset {
  name: string;
  visibilityOR: number;
  description: string;
}

/**
 * Battle Runner configuration
 */
export interface BattleRunnerConfig {
  /** Mission ID (QAI_11 through QAI_20) */
  missionId: string;
  /** Game size */
  gameSize: GameSize;
  /** Side configurations (2-4 sides, validated against mission) */
  sides: SideConfig[];
  /** Terrain density (0-100%) */
  terrainDensity: number;
  /** Lighting preset */
  lighting: LightingPreset;
  /** Random seed for reproducibility */
  seed?: number;
  /** Instrumentation grade */
  instrumentationGrade: InstrumentationGrade;
}

/**
 * Battle result
 */
export interface BattleResult {
  /** Battle ID */
  battleId: string;
  /** Configuration used */
  config: BattleRunnerConfig;
  /** Number of turns played */
  turnsPlayed: number;
  /** Whether game ended early */
  gameEnded: boolean;
  /** Reason for game end */
  endGameReason: string;
  /** Victory Points per side */
  vpBySide: Record<string, number>;
  /** Resource Points per side (for tie-breaking) */
  rpBySide?: Record<string, number>;
  /** Winner side ID (null for tie) */
  winnerSide: string | null;
  /** Tie side IDs (if tied) */
  tieSideIds?: string[];
  /** Reason for winner/tie */
  winnerReason?: 'vp' | 'rp' | 'tie' | 'initiative-card';
  /** Battle statistics */
  stats: BattleStats;
  /** Keys to Victory */
  keys: KeysToVictory;
  /** Instrumentation log */
  log: any;
}

/**
 * Battle statistics
 */
export interface BattleStats {
  /** KO'd models per side */
  koBySide: Record<string, number>;
  /** Eliminated models per side */
  eliminatedBySide: Record<string, number>;
  /** Models eliminated by Fear per side */
  eliminatedByFear: Record<string, number>;
  /** Bottle Tests per side */
  bottleTests: Record<string, { triggered: number; failed: number }>;
}

/**
 * Keys to Victory
 */
export interface KeysToVictory {
  /** First Blood side ID */
  firstBloodSide: string | null;
  /** First Blood awarded */
  firstBloodAwarded: boolean;
}

// ============================================================================
// Lighting Presets
// ============================================================================

export const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  'Day, Clear': { 
    name: 'Day, Clear', 
    visibilityOR: 16, 
    description: 'Full daylight, clear skies' 
  },
  'Day, Hazy': { 
    name: 'Day, Hazy', 
    visibilityOR: 14, 
    description: 'Daylight with haze or fog' 
  },
  'Day, Overcast': { 
    name: 'Day, Overcast', 
    visibilityOR: 14, 
    description: 'Overcast daylight' 
  },
  'Twilight, Clear': { 
    name: 'Twilight, Clear', 
    visibilityOR: 8, 
    description: 'Dawn or dusk, clear' 
  },
  'Twilight, Overcast': { 
    name: 'Twilight, Overcast', 
    visibilityOR: 6, 
    description: 'Dawn or dusk, overcast' 
  },
  'Night, Full Moon': { 
    name: 'Night, Full Moon', 
    visibilityOR: 4, 
    description: 'Night with full moon' 
  },
  'Night, Half Moon': { 
    name: 'Night, Half Moon', 
    visibilityOR: 2, 
    description: 'Night with half moon' 
  },
  'Night, New Moon': { 
    name: 'Night, New Moon', 
    visibilityOR: 1, 
    description: 'Night with new moon (dark)' 
  },
  'Pitch-black': { 
    name: 'Pitch-black', 
    visibilityOR: 0, 
    description: 'Complete darkness' 
  },
};

// ============================================================================
// Battle Runner Class
// ============================================================================

export class BattleRunner {
  private config: BattleRunnerConfig;
  private rng: () => number;
  private logger: InstrumentationLogger;

  constructor(config: BattleRunnerConfig) {
    this.config = config;
    
    // Initialize RNG with seed if provided
    if (config.seed !== undefined) {
      const seed = config.seed;
      this.rng = this.createSeededRandom(seed);
    } else {
      this.rng = Math.random;
    }

    // Initialize instrumentation logger
    this.logger = new InstrumentationLogger({
      grade: config.instrumentationGrade,
      format: 'console',
    });
  }

  /**
   * Create seeded random number generator
   */
  private createSeededRandom(seed: number): () => number {
    return function seededRandom() {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
  }

  /**
   * Run a complete battle from setup to conclusion
   */
  async run(): Promise<BattleResult> {
    // Validate mission and side count
    await this.validateMission();

    // Initialize battle logging
    const battleId = `battle-${this.config.gameSize}-${Date.now()}`;
    this.logger.startBattle(battleId);

    console.log('⚔️  AI vs AI BATTLE GENERATOR');
    console.log('═══════════════════════════════════════');
    console.log(`Mission: ${this.config.missionId}`);
    console.log(`Game Size: ${this.config.gameSize}`);
    console.log(`Sides: ${this.config.sides.length}`);
    console.log(`Terrain Density: ${Math.round(this.config.terrainDensity * 100)}%`);
    console.log(`Lighting: ${this.config.lighting.name} (Visibility OR ${this.config.lighting.visibilityOR} MU)`);
    console.log('═══════════════════════════════════════\n');

    // Create battlefield
    const battlefieldSize = this.getBattlefieldSize();
    const battlefield = new Battlefield(battlefieldSize, battlefieldSize);
    const terrain = this.generateTerrain(battlefieldSize, this.config.terrainDensity);
    terrain.forEach(t => battlefield.addTerrain(t));

    console.log(`✓ Battlefield created (${battlefieldSize}×${battlefieldSize} MU) with ${terrain.length} terrain elements\n`);

    // Build sides and assemblies
    const sides = await this.buildSides(battlefield);

    // Log roster information (grade 1+)
    this.logRoster(sides);

    // Create game manager
    const allCharacters = sides.flatMap(side =>
      side.members.map((m: any) => m.character)
    );
    const endGameTriggerTurn = getEndGameTriggerTurn(this.config.gameSize);
    const gameManager = new GameManager(allCharacters, battlefield, endGameTriggerTurn);

    console.log('✓ Game manager initialized\n');

    // Run battle
    console.log('🎮 Starting battle...\n');
    console.log('═══════════════════════════════════════\n');

    const result = await this.runGameLoop(gameManager, battlefield, sides);

    // End instrumentation logging
    const battleLog = this.logger.endBattle(result.turnsPlayed);

    // Print summary
    this.printBattleSummary(result, battleLog);

    return {
      ...result,
      battleId,
      config: this.config,
      log: battleLog,
    };
  }

  /**
   * Validate mission configuration
   */
  private async validateMission(): Promise<void> {
    // Mission side constraints (from JSON configs)
    const missionSideConstraints: Record<string, { min: number; max: number }> = {
      'QAI_11': { min: 2, max: 2 },
      'QAI_12': { min: 2, max: 4 },
      'QAI_13': { min: 2, max: 2 },
      'QAI_14': { min: 2, max: 2 },
      'QAI_15': { min: 2, max: 2 },
      'QAI_16': { min: 2, max: 2 },
      'QAI_17': { min: 3, max: 4 },  // Trinity requires min 3 sides
      'QAI_18': { min: 2, max: 2 },
      'QAI_19': { min: 2, max: 2 },
      'QAI_20': { min: 2, max: 2 },
    };

    const constraints = missionSideConstraints[this.config.missionId];
    
    if (!constraints) {
      console.warn(`⚠️  Unknown mission ${this.config.missionId}, using default constraints (2 sides)`);
      return;
    }

    const sideCount = this.config.sides.length;

    if (sideCount < constraints.min || sideCount > constraints.max) {
      throw new Error(
        `Mission ${this.config.missionId} requires ${constraints.min}-${constraints.max} sides, got ${sideCount}`
      );
    }

    console.log(`✓ Mission validated: ${this.config.missionId} (${sideCount} sides)\n`);
  }

  /**
   * Get battlefield size for game size
   */
  private getBattlefieldSize(): number {
    const defaults = gameSizeDefaults[this.config.gameSize];
    // Use approximate size based on game size
    const sizeMap: Record<GameSize, number> = {
      [GameSize.VERY_SMALL]: 24,
      [GameSize.SMALL]: 36,
      [GameSize.MEDIUM]: 48,
      [GameSize.LARGE]: 60,
      [GameSize.VERY_LARGE]: 72,
    };
    return sizeMap[this.config.gameSize] || 48;
  }

  /**
   * Generate terrain
   */
  private generateTerrain(battlefieldSize: number, density: number): any[] {
    const terrain: any[] = [];
    const terrainTypes = ['Tree', 'Rock', 'Ruin', 'Bush'];
    const numTerrain = Math.floor((battlefieldSize * battlefieldSize) * density / 100);

    for (let i = 0; i < numTerrain; i++) {
      const x = Math.floor(this.rng() * battlefieldSize);
      const y = Math.floor(this.rng() * battlefieldSize);
      const type = terrainTypes[Math.floor(this.rng() * terrainTypes.length)];
      
      terrain.push({
        id: `terrain-${i}`,
        type: type,
        vertices: [
          { x: x - 0.5, y: y - 0.5 },
          { x: x + 0.5, y: y - 0.5 },
          { x: x + 0.5, y: y + 0.5 },
          { x: x - 0.5, y: y + 0.5 },
        ],
      });
    }

    return terrain;
  }

  /**
   * Build sides with assemblies
   */
  private async buildSides(battlefield: Battlefield): Promise<any[]> {
    const sides: any[] = [];

    for (const sideConfig of this.config.sides) {
      const assemblies: any[] = [];

      for (const assemblyConfig of sideConfig.assemblies) {
        const profiles = [];
        for (let i = 0; i < assemblyConfig.count; i++) {
          const profile = buildProfile(assemblyConfig.archetypeName, {
            itemNames: assemblyConfig.itemNames,
          });
          profiles.push(profile);
        }

        const assembly = buildAssembly(assemblyConfig.name, profiles);
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

  /**
   * Deploy models to battlefield
   */
  private async deployModels(sides: any[], battlefield: Battlefield): Promise<void> {
    console.log('Deploying models...');
    
    const modelsPerRow = 3;
    const spacing = Math.floor(this.getBattlefieldSize() / (modelsPerRow + 1));

    sides.forEach((side, sideIndex) => {
      side.members.forEach((member: any, i: number) => {
        const row = Math.floor(i / modelsPerRow);
        const col = i % modelsPerRow;
        const x = spacing + col * spacing;
        const y = sideIndex === 0 
          ? spacing + row * spacing 
          : this.getBattlefieldSize() - spacing - row * spacing;
        battlefield.placeCharacter(member.character, { x, y });
      });
    });

    console.log('✓ Models deployed\n');
  }

  /**
   * Run game loop with full AI integration
   */
  private async runGameLoop(
    gameManager: GameManager,
    battlefield: Battlefield,
    sides: any[]
  ): Promise<Omit<BattleResult, 'battleId' | 'config' | 'log'>> {
    console.log('🤖 Starting AI Game Loop...\n');

    // Initialize AI Game Loop with full AI pipeline
    const aiGameLoop = new AIGameLoop(gameManager, battlefield, sides, {
      ...DEFAULT_AI_GAME_LOOP_CONFIG,
      verboseLogging: true,
      maxActionsPerTurn: 3,
    }, this.logger);

    // Track First Blood
    const keys: KeysToVictory = {
      firstBloodSide: null,
      firstBloodAwarded: false,
    };

    // Battle statistics
    const stats: BattleStats = {
      koBySide: {},
      eliminatedBySide: {},
      eliminatedByFear: {},
      bottleTests: {},
    };

    // Initialize stats per side
    for (const side of sides) {
      stats.koBySide[side.id] = 0;
      stats.eliminatedBySide[side.id] = 0;
      stats.eliminatedByFear[side.id] = 0;
      stats.bottleTests[side.id] = { triggered: 0, failed: 0 };
    }

    // VP tracking
    const vpBySide: Record<string, number> = {};
    for (const side of sides) {
      vpBySide[side.id] = 0;
    }

    const maxTurns = 10;
    let turnCount = 0;
    let gameEnded = false;
    let endGameReason = '';

    // End-game Trigger dice
    const endGameTriggerTurn = getEndGameTriggerTurn(this.config.gameSize);
    let endDice = 0;

    // Run AI Game Loop
    for (let turn = 1; turn <= maxTurns; turn++) {
      turnCount = turn;
      console.log(`\n━━━ TURN ${turn} ━━━\n`);

      // Run one turn of AI Game Loop
      const turnResult = aiGameLoop.runTurn(turn);

      // Track First Blood (check if any side scored first hit this turn)
      if (!keys.firstBloodAwarded && turnResult.totalActions > 0) {
        // First Blood awarded to first side that performed an attack action
        // For simplicity, award to first side
        keys.firstBloodAwarded = true;
        keys.firstBloodSide = sides[0]?.id || null;
        if (keys.firstBloodSide) {
          vpBySide[keys.firstBloodSide] = (vpBySide[keys.firstBloodSide] || 0) + 1;
          console.log(`  🩸 FIRST BLOOD! ${sides[0]?.name} scores 1 VP!`);
        }
      }

      // Note: KO and elimination stats tracked by AI Game Loop internally
      // For now, we'll update from battlefield state at end of game

      console.log('');

      // End-game Trigger dice rolling (per QSR Line 744-750)
      if (turnCount >= endGameTriggerTurn) {
        endDice++;

        const endRolls: number[] = [];
        for (let i = 0; i < endDice; i++) {
          const roll = Math.floor(this.rng() * 6) + 1;
          endRolls.push(roll);
        }

        console.log(`🎲 END-GAME TRIGGER (Turn ${turnCount}, ${endDice} dice): [${endRolls.join(', ')}]`);

        const miss = endRolls.some(roll => roll <= 3);
        if (miss) {
          gameEnded = true;
          endGameReason = `End-game Trigger dice rolled miss (1-3) on Turn ${turnCount}`;
          console.log(`🏁 GAME ENDED: ${endGameReason}`);
          break;
        }
      }

      // Check for End of Conflict
      const activeSides = sides.filter(side =>
        side.members.some((m: any) =>
          !m.character.state.isEliminated && !m.character.state.isKOd
        )
      );

      if (activeSides.length <= 1) {
        gameEnded = true;
        endGameReason = activeSides.length === 0
          ? 'All sides eliminated'
          : `${activeSides[0].name} wins by elimination`;
        console.log(`🏁 GAME ENDED: ${endGameReason}`);
        break;
      }
    }

    // Determine winner using proper mission scoring with RP tie-break
    let winnerSide: string | null = null;
    let tie = false;
    let tieSideIds: string[] = [];
    let winnerReason: 'vp' | 'rp' | 'tie' = 'vp';

    // Find max VP
    const maxVP = Math.max(...Object.values(vpBySide), 0);
    const topVpSides = Object.entries(vpBySide)
      .filter(([, vp]) => vp === maxVP)
      .map(([sideId]) => sideId);

    if (topVpSides.length === 1) {
      // Clear VP winner
      winnerSide = topVpSides[0];
      tie = false;
      winnerReason = 'vp';
    } else if (topVpSides.length > 1) {
      // VP tie - check RP tie-break
      // For now, RP is 0 for all sides in basic battle runner
      // RP would come from mission keys (Aggression, Bottled Out, etc.)
      const rpBySide: Record<string, number> = {};
      topVpSides.forEach(sideId => {
        rpBySide[sideId] = 0; // Would be populated by mission keys
      });

      const maxRP = Math.max(...Object.values(rpBySide), 0);
      const topRpSides = topVpSides.filter(sideId => rpBySide[sideId] === maxRP);

      if (topRpSides.length === 1) {
        // RP tie-break winner
        winnerSide = topRpSides[0];
        tie = false;
        winnerReason = 'rp';
      } else {
        // Still tied after RP
        tie = true;
        tieSideIds = topRpSides;
        winnerReason = 'tie';
        // Note: Initiative card tie-breaker would be applied here if enabled
        // This requires passing initiative card holder info to battle runner
      }
    }

    return {
      turnsPlayed: turnCount,
      gameEnded,
      endGameReason,
      vpBySide,
      rpBySide: {},
      winnerSide,
      tieSideIds: tie ? tieSideIds : [],
      winnerReason,
      stats,
      keys,
    };
  }

  /**
   * Print battle summary
   */
  private printBattleSummary(
    result: Omit<BattleResult, 'battleId' | 'config' | 'log'>,
    battleLog: any
  ): void {
    console.log('═══════════════════════════════════════');
    console.log('🏁 BATTLE COMPLETE\n');
    
    console.log('📊 FINAL RESULTS');
    console.log('═══════════════════════════════════════');
    console.log(`Mission: ${this.config.missionId}`);
    console.log(`Game Size: ${this.config.gameSize}`);
    console.log(`Battlefield: ${this.getBattlefieldSize()}×${this.getBattlefieldSize()} MU`);
    console.log(`Turns Played: ${result.turnsPlayed}${result.gameEnded ? ` (Game ended: ${result.endGameReason})` : ''}`);
    console.log('');

    // Victory Points and Winner
    console.log('🏆 VICTORY POINTS');
    console.log('───────────────────────────────────────');
    for (const [sideId, vp] of Object.entries(result.vpBySide)) {
      console.log(`  ${sideId}: ${vp} VP`);
    }
    if (result.winnerSide) {
      console.log(`\n  🏅 Winner: ${result.winnerSide}`);
    } else {
      console.log(`\n  🤝 Result: Tie`);
    }
    console.log('');

    // Keys to Victory
    console.log('🔑 KEYS TO VICTORY');
    console.log('───────────────────────────────────────');
    if (result.keys.firstBloodAwarded) {
      console.log(`  🩸 First Blood: ${result.keys.firstBloodSide} ✅ (+1 VP)`);
    } else {
      console.log(`  🩸 First Blood: Not awarded`);
    }
    console.log('');

    // Casualties
    console.log('💀 CASUALTIES');
    console.log('───────────────────────────────────────');
    for (const [sideId, stats] of Object.entries(result.stats.koBySide)) {
      console.log(`  ${sideId}:`);
      console.log(`    KO'd: ${result.stats.koBySide[sideId]}`);
      console.log(`    Eliminated: ${result.stats.eliminatedBySide[sideId]}`);
      console.log(`    Eliminated by Fear: ${result.stats.eliminatedByFear[sideId]}`);
    }
    console.log('');

    // Bottle Tests
    console.log('🧪 BOTTLE TESTS');
    console.log('───────────────────────────────────────');
    for (const [sideId, tests] of Object.entries(result.stats.bottleTests)) {
      console.log(`  ${sideId}: Triggered ${tests.triggered}, Failed ${tests.failed}`);
    }
    console.log('');

    // Action Summary
    if (battleLog) {
      console.log('📝 ACTION SUMMARY');
      console.log('───────────────────────────────────────');
      console.log(`Total Actions: ${battleLog.summary.totalActions}`);
      console.log(`Actions by Type:`);
      Object.entries(battleLog.summary.actionsByType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
      console.log('');
    }

    // Export JSON
    console.log('💾 Exporting battle log...');
    if (battleLog) {
      const jsonLog = JSON.stringify(battleLog, null, 2);
      console.log(`Log size: ${jsonLog.length} bytes`);
      console.log(`\nTo save: echo '${jsonLog}' > battle-log.json`);
    }
  }

  /**
   * Log roster information for instrumentation (grade 1+)
   */
  private logRoster(sides: any[]): void {
    if (this.config.instrumentationGrade < 1) return;

    const roster = sides.map(side => {
      const characters = side.members.map((member: any) => ({
        id: member.character.id,
        name: member.character.name || member.character.profile.name,
        profile: member.character.profile.name,
        archetype: member.character.profile.archetype,
        items: (member.character.profile.items || []).map((item: any) => item.name),
      }));

      const firstMember = side.members[0];
      const archetypeName = typeof firstMember?.character?.profile?.archetype === 'string'
        ? firstMember.character.profile.archetype
        : firstMember?.character?.profile?.archetypeName || 'Unknown';

      return {
        sideId: side.id,
        sideName: side.name,
        assemblyName: firstMember?.assembly?.name || 'Unknown',
        archetypeName,
        characters,
      };
    });

    this.logger.logRoster(roster);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and run a battle with the given config
 */
export async function runBattle(config: BattleRunnerConfig): Promise<BattleResult> {
  const runner = new BattleRunner(config);
  return await runner.run();
}
