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
import { InstrumentationLogger, InstrumentationGrade, StartOfGameReport, InitiativeTestReport, TurnActionReport, TurnEndReport, GameEndReport } from '../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { SvgRenderer } from '../../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
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
  /** Aggression: First to cross midline */
  aggressionAwarded: boolean;
  aggressionSide: string | null;
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
    
    // Log Start of Game report (grade 2+)
    await this.logStartOfGame(sides, battlefield, terrain);

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

    // Track Aggression (first to cross midline)
    const keys: KeysToVictory = {
      aggressionAwarded: false,
      aggressionSide: null,
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
      
      // ═══════════════════════════════════════
      // START OF TURN
      // ═══════════════════════════════════════
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log(`📋 START OF TURN ${turn}`);
      console.log('═══════════════════════════════════════');
      
      // Show Initiative Points at start of turn (grade 2+)
      if (this.config.instrumentationGrade >= 2) {
        const ipSummary = sides.map(s => `${s.name}: ${s.state.initiativePoints ?? 0} IP`).join(', ');
        console.log(`📊 Initiative Points: ${ipSummary}`);
        
        // Log initiative test report
        const initiativeReport: InitiativeTestReport = {
          turn,
          modelsInLOS: sides.map(s => ({
            sideId: s.id,
            models: s.members.map((m: any) => ({
              modelId: m.character.id,
              visibleEnemies: [], // Would need LOS calculation
            })),
          })),
          rolls: [], // Would need actual dice rolls from rollInitiative
          winner: null,
          tieBroken: false,
          initiativeCardUsed: false,
          ipAwarded: [],
          initiativeCard: { holder: null, transferred: false },
          ipAvailable: sides.reduce((acc: any, s: any) => {
            acc[s.id] = s.state.initiativePoints ?? 0;
            return acc;
          }, {}),
        };
        this.logger.logInitiativeTest(initiativeReport);
      }
      console.log('');
      
      // ═══════════════════════════════════════
      // DURING TURN
      // ═══════════════════════════════════════
      console.log('═══════════════════════════════════════');
      console.log(`⚔️ DURING TURN ${turn}`);
      console.log('═══════════════════════════════════════');
      console.log('');

      // Run one turn of AI Game Loop
      const turnResult = aiGameLoop.runTurn(turn);

      // Track Aggression (first to cross midline)
      // Midline is at battlefield.width / 2
      if (!keys.aggressionAwarded) {
        const midline = battlefield.width / 2;
        for (const side of sides) {
          for (const member of side.members) {
            const pos = battlefield.getCharacterPosition(member.character);
            if (pos && pos.y > midline) {
              keys.aggressionAwarded = true;
              keys.aggressionSide = side.id;
              vpBySide[side.id] = (vpBySide[side.id] || 0) + 1;
              console.log(`  ⚔️ AGGRESSION! ${side.name} crossed midline, scores 1 VP!`);
              break;
            }
          }
          if (keys.aggressionAwarded) break;
        }
      }

      console.log('');
      
      // ═══════════════════════════════════════
      // END OF TURN
      // ═══════════════════════════════════════
      console.log('═══════════════════════════════════════');
      console.log(`📋 END OF TURN ${turn}`);
      console.log('═══════════════════════════════════════');

      // End-game Trigger dice rolling (per QSR Line 744-750)
      let turnEndReport: TurnEndReport | null = null;
      if (turnCount >= endGameTriggerTurn) {
        endDice++;

        const endRolls: number[] = [];
        for (let i = 0; i < endDice; i++) {
          const roll = Math.floor(this.rng() * 6) + 1;
          endRolls.push(roll);
        }

        console.log(`🎲 END-GAME TRIGGER (Turn ${turnCount}, ${endDice} dice): [${endRolls.join(', ')}]`);

        const miss = endRolls.some(roll => roll <= 3);
        
        turnEndReport = {
          turn: turnCount,
          ipDiscarded: [], // IP discarded at end of turn
          bottleTests: [], // Would need bottle test results
          endGameTrigger: {
            diceAdded: true,
            totalDice: endDice,
            rolled: true,
            rolls: endRolls,
            gameEnded: miss,
          },
          standings: sides.map((s: any) => ({
            sideId: s.id,
            victoryPoints: vpBySide[s.id] || 0,
            resourcePoints: 0,
          })),
        };
        
        if (this.config.instrumentationGrade >= 2 && turnEndReport) {
          this.logger.logTurnEnd(turnEndReport);
        }

        if (miss) {
          gameEnded = true;
          endGameReason = `End-game Trigger dice rolled miss (1-3) on Turn ${turnCount}`;
          console.log(`🏁 GAME ENDED: ${endGameReason}`);
          break;
        }
      } else {
        // Log turn end even without end-game trigger
        turnEndReport = {
          turn: turnCount,
          ipDiscarded: sides.map((s: any) => ({
            sideId: s.id,
            amount: s.state.initiativePoints ?? 0,
          })),
          bottleTests: [],
          endGameTrigger: {
            diceAdded: false,
            totalDice: 0,
            rolled: false,
            gameEnded: false,
          },
          standings: sides.map((s: any) => ({
            sideId: s.id,
            victoryPoints: vpBySide[s.id] || 0,
            resourcePoints: 0,
          })),
        };
        
        if (this.config.instrumentationGrade >= 2) {
          this.logger.logTurnEnd(turnEndReport);
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
      
      console.log('');
    }

    // ═══════════════════════════════════════
    // END OF GAME
    // ═══════════════════════════════════════
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📋 END OF GAME');
    console.log('═══════════════════════════════════════');
    console.log('');

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
    if (result.keys.aggressionAwarded) {
      console.log(`  ⚔️ Aggression: ${result.keys.aggressionSide} ✅ (+1 VP)`);
    } else {
      console.log(`  ⚔️ Aggression: Not awarded`);
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
      
      // Log Game End report (grade 2+)
      if (this.config.instrumentationGrade >= 2) {
        const gameEndReport: GameEndReport = {
          endReason: result.endGameReason.includes('elimination') ? 'elimination' :
                     result.endGameReason.includes('End-game Trigger') ? 'end_game_trigger' :
                     result.endGameReason.includes('Bottle') ? 'bottled' : 'turn_limit',
          finalStandings: Object.entries(result.vpBySide).map(([sideId, vp], index) => ({
            sideId,
            victoryPoints: vp,
            resourcePoints: 0,
            modelsRemaining: result.stats.eliminatedBySide[sideId] ? 0 : 3,
            rank: index + 1,
          })),
          winner: {
            sideId: result.winnerSide,
            tie: !result.winnerSide,
            tieBreakMethod: result.winnerReason === 'rp' ? 'rp' : 'none',
            reason: result.winnerReason === 'vp' ? 'Most Victory Points' :
                    result.winnerReason === 'rp' ? 'Resource Points tie-break' : 'Tie',
          },
          keysAchieved: sides.map((s: any) => ({
            sideId: s.id,
            keys: [
              {
                keyName: 'Aggression',
                achieved: result.keys.aggressionSide === s.id,
                details: result.keys.aggressionSide === s.id ? 'First to cross midline' : undefined,
              },
              {
                keyName: 'Elimination',
                achieved: (result.stats.eliminatedBySide[s.id] || 0) > 0,
                details: `${result.stats.eliminatedBySide[s.id] || 0} models eliminated`,
              },
            ],
          })),
          statistics: {
            totalTurns: result.turnsPlayed,
            totalActions: battleLog.summary.totalActions,
            totalTests: battleLog.summary.totalTests,
            totalIPSpent: {}, // Would need to track IP spending
            casualties: result.stats.eliminatedBySide,
          },
        };
        
        this.logger.logGameEnd(gameEndReport);
        
        // Print Game End summary
        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('🏆 FINAL STANDINGS');
        console.log('═══════════════════════════════════════');
        for (const standing of gameEndReport.finalStandings) {
          console.log(`  ${standing.rank}. ${standing.sideId}: ${standing.victoryPoints} VP, ${standing.resourcePoints} RP`);
        }
        console.log('');
        console.log('🏅 WINNER');
        console.log('═══════════════════════════════════════');
        if (gameEndReport.winner.sideId) {
          console.log(`  ${gameEndReport.winner.sideId} wins by ${gameEndReport.winner.reason}`);
        } else {
          console.log(`  Tie game - ${gameEndReport.winner.tieBreakMethod === 'none' ? 'No tie-breaker' : gameEndReport.winner.tieBreakMethod}`);
        }
        console.log('');
        console.log('🔑 KEYS TO VICTORY');
        console.log('═══════════════════════════════════════');
        for (const sideKeys of gameEndReport.keysAchieved) {
          console.log(`  ${sideKeys.sideId}:`);
          for (const key of sideKeys.keys) {
            const status = key.achieved ? '✅' : '❌';
            console.log(`    ${status} ${key.keyName}${key.details ? `: ${key.details}` : ''}`);
          }
        }
        console.log('');
      }
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

  /**
   * Save SVG to file
   */
  private async saveSVG(svgContent: string, filePath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, svgContent);
      console.log(`✓ Battlefield SVG saved: ${filePath}`);
    } catch (error) {
      console.error('Failed to save battlefield SVG:', error);
    }
  }

  /**
   * Log Start of Game report for instrumentation (grade 2+)
   */
  private async logStartOfGame(sides: any[], battlefield: any, terrain: any[]): Promise<void> {
    if (this.config.instrumentationGrade < 2) return;

    // Generate terrain markers for report
    const terrainMarkers = terrain.map((t: any) => ({
      id: t.id,
      type: t.type,
      vertices: t.vertices,
    }));

    // Generate model markers for SVG
    const modelMarkers = sides.flatMap((side: any) =>
      side.members.map((member: any) => {
        const pos = battlefield.getCharacterPosition(member.character);
        return {
          id: member.character.id,
          position: pos || { x: 0, y: 0 },
          baseDiameter: 1.0,
          color: side.id.toLowerCase().includes('a') ? '#4CAF50' : '#F44336',
          label: member.character.name || member.character.profile.name,
        };
      })
    );
    
    // Generate SVG using SvgRenderer
    const svgContent = SvgRenderer.render(battlefield, {
      width: battlefield.width,
      height: battlefield.height,
      gridResolution: 0.5,
      title: `${this.config.missionId} - Turn 1`,
      models: modelMarkers,
      layers: [
        { id: 'deployment', label: 'Deployment Zones', enabled: false },
        { id: 'grid', label: '0.5 MU Grid', enabled: true },
        { id: 'delaunay', label: 'Delaunay Mesh', enabled: false },
        { id: 'area', label: 'Area Terrain', enabled: true },
        { id: 'building', label: 'Buildings', enabled: true },
        { id: 'wall', label: 'Walls', enabled: true },
        { id: 'tree', label: 'Trees', enabled: true },
        { id: 'rocks', label: 'Rocks', enabled: true },
        { id: 'shrub', label: 'Shrubs', enabled: true },
        { id: 'terrain', label: 'Other Terrain', enabled: true },
        { id: 'models', label: 'Models', enabled: true },
      ],
    });
    
    const svgPath = `generated/battlefield-${this.config.seed || Date.now()}.svg`;
    await this.saveSVG(svgContent, svgPath);

    const report: any = {
      mission: {
        id: this.config.missionId,
        name: 'Elimination',
        gameSize: this.config.gameSize,
        sides: this.config.sides.length,
        terrainDensity: Math.round(this.config.terrainDensity * 100),
        lighting: {
          name: this.config.lighting.name,
          visibilityOR: this.config.lighting.visibilityOR,
        },
        battlefieldSize: battlefield.width,
        endGameTriggerTurn: getEndGameTriggerTurn(this.config.gameSize),
      },
      battlefield: {
        svgPath: svgPath,
        svgUrl: `http://localhost:3000/${svgPath}`,
        terrainElements: terrainMarkers,
        modelStartingPositions: sides.map((side: any) => ({
          sideId: side.id,
          models: side.members.map((member: any) => {
            const pos = battlefield.getCharacterPosition(member.character);
            return {
              modelId: member.character.id,
              characterName: member.character.name || member.character.profile.name,
              position: pos || { x: 0, y: 0 },
            };
          }),
        })),
      },
      sides: sides.map((side: any) => {
        const firstMember = side.members[0];
        return {
          sideId: side.id,
          sideName: side.name,
          tacticalDoctrine: 'Balanced',
          assemblies: [{
            assemblyName: firstMember?.assembly?.name || 'Unknown',
            totalBP: side.totalBP,
            characters: side.members.map((member: any) => {
              const archetypeObj = member.character.profile.archetype;
              const archetypeName = typeof archetypeObj === 'string' 
                ? archetypeObj 
                : (archetypeObj && typeof archetypeObj === 'object' && Object.keys(archetypeObj)[0]) || 'Average';
              
              return {
                modelId: member.character.id,
                characterName: member.character.name || member.character.profile.name,
                profile: {
                  name: member.character.profile.name,
                  archetype: archetypeName,
                  totalBP: member.profile?.totalBP || 30,
                  attributes: member.character.attributes,
                  traits: member.character.profile.traits || [],
                  items: (member.character.profile.items || []).map((item: any) => ({
                    name: item.name,
                    classification: item.classification || item.class || '',
                    traits: item.traits || [],
                    bp: item.bp || 0,
                  })),
                },
                deploymentPosition: battlefield.getCharacterPosition(member.character) || { x: 0, y: 0 },
              };
            }),
          }],
          initiativePoints: side.state?.initiativePoints || 0,
          hasInitiativeCard: false,
        };
      }),
      aiConfig: {
        strategicLayerEnabled: true,
        tacticalLayerEnabled: true,
        characterAIEnabled: true,
        maxActionsPerTurn: 3,
        instrumentationGrade: this.config.instrumentationGrade,
      },
      seed: this.config.seed,
    };

    this.logger.logStartOfGame(report);
    
    // Print Start of Game summary to console
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📋 START OF GAME');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Battlefield SVG: ${svgPath}`);
    console.log(`🔗 View: ${report.battlefield.svgUrl}`);
    console.log('');
    console.log('━━━ SIDE DECLARATIONS ━━━');
    for (const side of report.sides) {
      console.log(`\n${side.sideName} (${side.tacticalDoctrine}) - ${side.initiativePoints} IP`);
      for (const assembly of side.assemblies) {
        console.log(`  ${assembly.assemblyName} (${assembly.totalBP} BP)`);
        for (const char of assembly.characters) {
          console.log(`    ├─ ${char.characterName}: ${char.profile.archetype} (${char.profile.totalBP} BP)`);
        }
      }
    }
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('');
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
