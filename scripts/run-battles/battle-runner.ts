/**
 * Battle Runner - Core Battle Execution Engine
 * 
 * Unified battle runner that exercises full AI System + Mission + Engine integration.
 * 
 * Features:
 * - Full CharacterAI decision-making via CharacterAI.decideAction()
 * - Mission runtime integration via GameController.runMission()
 * - Proper Initiative/IP system per QSR Line 680-730
 * - End-Game Trigger dice per QSR Line 744-750 (cumulative d6, ends on 1-3)
 * - Wait/React/Bonus Action resolution via GameManager
 * - Comprehensive instrumentation via QSRInstrumentation
 * 
 * Usage:
 * ```typescript
 * const runner = new BattleRunner(config);
 * const result = await runner.run();
 * ```
 */

import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { Battlefield } from '../../src/lib/mest-tactics/battlefield/Battlefield';
import { GameManager } from '../../src/lib/mest-tactics/engine/GameManager';
import { CharacterAI, DEFAULT_CHARACTER_AI_CONFIG } from '../../src/lib/mest-tactics/ai/core/CharacterAI';
import { TacticalDoctrine } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { AIControllerConfig } from '../../src/lib/mest-tactics/ai/core/AIController';
import { createMissionSide, type MissionSide } from '../../src/lib/mest-tactics/mission/MissionSide';
import { createMissionRuntimeAdapter } from '../../src/lib/mest-tactics/missions/mission-runtime-adapter';
import { configureInstrumentation, InstrumentationGrade, getInstrumentationLogger } from '../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { getEndGameTriggerTurn } from '../../src/lib/mest-tactics/engine/end-game-trigger';
import { LightingPreset, LIGHTING_PRESETS } from './lighting-presets';

// ============================================================================
// Configuration Types
// ============================================================================

export interface AssemblyConfig {
  archetypeName: string;
  itemNames: string[];
  count: number;
}

export interface SideConfig {
  name: string;
  doctrine: TacticalDoctrine;
  assembly: AssemblyConfig;
  aggression?: number;
  caution?: number;
}

export interface BattleConfig {
  // Game settings
  gameSize: GameSize;
  battlefieldSize: number;
  maxTurns: number;
  
  // Terrain & Lighting
  terrainDensity: number;  // 0-100%
  lighting: LightingPreset;
  
  // Mission
  missionId: string;  // QAI_11, QAI_12, etc.
  
  // Sides
  sides: [SideConfig, SideConfig];
  
  // Instrumentation
  instrumentation: {
    grade: InstrumentationGrade;
    outputFormat: 'console' | 'json' | 'jsonl';
    verbose?: boolean;
  };
}

// ============================================================================
// Battle Statistics
// ============================================================================

export interface BattleStats {
  totalActions: number;
  moves: number;
  attacks: number;
  closeCombats: number;
  rangedCombats: number;
  disengages: number;
  waits: number;
  reacts: number;
  bonusActions: number;
  eliminations: number;
  kos: number;
  moraleTests: number;
  bottleTests: number;
}

// ============================================================================
// Battle Result
// ============================================================================

export interface BattleResult {
  winner: string | 'Draw';
  turnsCompleted: number;
  endReason: 'elimination' | 'end-game-trigger' | 'max-turns' | 'morale';
  stats: BattleStats;
  config: BattleConfig;
  timestamp: string;
}

// ============================================================================
// Battle Runner Class
// ============================================================================

export class BattleRunner {
  private config: BattleConfig;
  private battlefield: Battlefield | null = null;
  private gameManager: GameManager | null = null;
  private sides: [MissionSide, MissionSide] | null = null;
  private stats: BattleStats;
  private logger: ReturnType<typeof getInstrumentationLogger>;

  constructor(config: BattleConfig) {
    this.config = config;
    this.stats = this.initializeStats();
    this.logger = getInstrumentationLogger();
  }

  private initializeStats(): BattleStats {
    return {
      totalActions: 0,
      moves: 0,
      attacks: 0,
      closeCombats: 0,
      rangedCombats: 0,
      disengages: 0,
      waits: 0,
      reacts: 0,
      bonusActions: 0,
      eliminations: 0,
      kos: 0,
      moraleTests: 0,
      bottleTests: 0,
    };
  }

  /**
   * Run a complete battle from setup to conclusion
   */
  async run(): Promise<BattleResult> {
    // Configure instrumentation
    configureInstrumentation({
      grade: this.config.instrumentation.grade,
      format: this.config.instrumentation.outputFormat === 'console' ? 'console' : 'both',
    });

    this.logger.startBattle(`battle-${this.config.gameSize}-${Date.now()}`);

    try {
      // Phase 1: Setup
      await this.setup();

      // Phase 2: Run game loop
      const result = await this.runGameLoop();

      // Phase 3: Cleanup and return
      return this.finalize(result);
    } catch (error) {
      console.error('Battle failed:', error);
      throw error;
    }
  }

  /**
   * Phase 1: Setup battlefield, sides, and game manager
   */
  private async setup(): Promise<void> {
    // Create battlefield
    this.battlefield = new Battlefield(
      this.config.battlefieldSize,
      this.config.battlefieldSize
    );

    // Generate terrain
    this.generateTerrain();

    // Create sides
    this.sides = [
      await this.createSide(this.config.sides[0], 0),
      await this.createSide(this.config.sides[1], 1),
    ];

    // Deploy models
    this.deployModels();

    // Create game manager
    const allCharacters = [
      ...this.sides[0].members.map(m => m.character),
      ...this.sides[1].members.map(m => m.character),
    ];
    this.gameManager = new GameManager(
      allCharacters,
      this.battlefield,
      getEndGameTriggerTurn(this.config.gameSize)
    );
  }

  /**
   * Generate terrain based on density
   */
  private generateTerrain(): void {
    const terrainCount = Math.floor(
      (this.config.battlefieldSize * this.config.battlefieldSize) * 
      (this.config.terrainDensity / 100) / 100
    );

    const terrainTypes = ['Tree', 'Rock', 'Ruin', 'Bush'];

    for (let i = 0; i < terrainCount; i++) {
      const x = Math.floor(Math.random() * this.config.battlefieldSize);
      const y = Math.floor(Math.random() * this.config.battlefieldSize);
      const type = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];

      this.battlefield!.addTerrain({
        id: `terrain-${i}`,
        type: type as any,
        vertices: [
          { x: x - 0.5, y: y - 0.5 },
          { x: x + 0.5, y: y - 0.5 },
          { x: x + 0.5, y: y + 0.5 },
          { x: x - 0.5, y: y + 0.5 },
        ],
      });
    }
  }

  /**
   * Create a mission side from config
   */
  private async createSide(sideConfig: SideConfig, sideIndex: number): Promise<MissionSide> {
    const { buildAssembly, buildProfile } = await import('../../src/lib/mest-tactics/mission/assembly-builder');
    
    // Create profiles
    const profiles = [];
    for (let i = 0; i < sideConfig.assembly.count; i++) {
      const profile = buildProfile(sideConfig.assembly.archetypeName, {
        itemNames: sideConfig.assembly.itemNames,
      });
      profiles.push(profile);
    }

    // Create assembly
    const assembly = buildAssembly(sideConfig.name, profiles);

    // Create mission side
    const side = createMissionSide(sideConfig.name, [assembly]);

    // Set character IDs
    side.members.forEach((member: any, i: number) => {
      member.character.id = `${sideConfig.name}-${i + 1}`;
      member.character.name = `${sideConfig.name}-${i + 1}`;
      member.id = `${sideConfig.name}-${i + 1}`;
    });

    return side;
  }

  /**
   * Deploy models to battlefield
   */
  private deployModels(): void {
    if (!this.sides || !this.battlefield) return;

    const edgeMargin = 3;
    const deploymentDepth = 6;

    this.sides.forEach((side, sideIndex) => {
      const count = side.members.length;
      const cols = Math.ceil(Math.sqrt(count));
      const xSpacing = cols > 1 
        ? (this.config.battlefieldSize - edgeMargin * 2 - 1) / (cols - 1) 
        : 0;
      const sideStartY = sideIndex === 0 
        ? edgeMargin 
        : this.config.battlefieldSize - edgeMargin - deploymentDepth;

      side.members.forEach((member, i) => {
        const col = i % cols;
        const x = Math.round(edgeMargin + col * xSpacing);
        const y = Math.round(sideStartY);
        this.battlefield!.placeCharacter(member.character, { x, y });
      });
    });
  }

  /**
   * Phase 2: Run the game loop
   */
  private async runGameLoop(): Promise<{ winner: string | 'Draw'; turnsCompleted: number; endReason: string }> {
    if (!this.gameManager || !this.sides) {
      throw new Error('Game not setup properly');
    }

    // Create mission runtime adapter
    const missionAdapter = createMissionRuntimeAdapter(this.config.missionId, [...this.sides]);

    // Create AI controllers
    const aiConfigs: AIControllerConfig[] = this.sides.map(side => ({
      sideId: side.id,
      characterAI: new CharacterAI({
        ...DEFAULT_CHARACTER_AI_CONFIG,
        aggression: side.members[0]?.id.includes(this.config.sides[0].name) 
          ? (this.config.sides[0].aggression ?? 0.5)
          : (this.config.sides[1].aggression ?? 0.5),
        caution: side.members[0]?.id.includes(this.config.sides[0].name)
          ? (this.config.sides[0].caution ?? 0.5)
          : (this.config.sides[1].caution ?? 0.5),
      }),
      tacticalDoctrine: side.members[0]?.id.includes(this.config.sides[0].name)
        ? this.config.sides[0].doctrine
        : this.config.sides[1].doctrine,
    }));

    // Run game via GameManager
    const result = await this.gameManager.runGame(missionAdapter, aiConfigs);

    // Update stats from result
    this.stats.totalActions = result.stats.totalActions;
    this.stats.closeCombats = result.stats.closeCombats;
    this.stats.rangedCombats = result.stats.rangedCombats;
    this.stats.kos = result.stats.kos;
    this.stats.eliminations = result.stats.eliminations;

    return {
      winner: result.winner || 'Draw',
      turnsCompleted: result.turnsCompleted,
      endReason: this.determineEndReason(result),
    };
  }

  /**
   * Determine why the game ended
   */
  private determineEndReason(result: any): string {
    const sideA = this.sides![0];
    const sideB = this.sides![1];

    const aRemaining = sideA.members.filter(m => 
      !m.character.state.isEliminated && !m.character.state.isKOd
    ).length;
    const bRemaining = sideB.members.filter(m => 
      !m.character.state.isEliminated && !m.character.state.isKOd
    ).length;

    if (aRemaining === 0 || bRemaining === 0) {
      return 'elimination';
    }

    if (result.turnsCompleted >= this.config.maxTurns) {
      return 'max-turns';
    }

    return 'end-game-trigger';
  }

  /**
   * Phase 3: Finalize and return result
   */
  private finalize(result: { winner: string | 'Draw'; turnsCompleted: number; endReason: string }): BattleResult {
    const battleLog = this.logger.endBattle(result.turnsCompleted);

    // Print summary if verbose
    if (this.config.instrumentation.verbose !== false) {
      this.printSummary(result, battleLog);
    }

    return {
      winner: result.winner,
      turnsCompleted: result.turnsCompleted,
      endReason: result.endReason as any,
      stats: this.stats,
      config: this.config,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Print battle summary to console
   */
  private printSummary(
    result: { winner: string | 'Draw'; turnsCompleted: number; endReason: string },
    battleLog: any
  ): void {
    console.log('\n═══════════════════════════════════════');
    console.log('🏁 BATTLE COMPLETE\n');
    console.log('📊 BATTLE SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Battle ID: ${battleLog.battleId}`);
    console.log(`Mission: ${this.config.missionId}`);
    console.log(`Game Size: ${this.config.gameSize}`);
    console.log(`Lighting: ${this.config.lighting.name} (OR ${this.config.lighting.visibilityOR} MU)`);
    console.log(`Turns: ${result.turnsCompleted}`);
    console.log(`End Reason: ${result.endReason}`);
    console.log(`Winner: ${result.winner}\n`);

    console.log('📝 ACTION SUMMARY');
    console.log('───────────────────────────────────────');
    console.log(`Total Actions: ${this.stats.totalActions}`);
    console.log(`  Moves: ${this.stats.moves}`);
    console.log(`  Attacks: ${this.stats.attacks}`);
    console.log(`  Close Combats: ${this.stats.closeCombats}`);
    console.log(`  Ranged Combats: ${this.stats.rangedCombats}`);
    console.log(`  Disengages: ${this.stats.disengages}`);
    console.log(`  Wait: ${this.stats.waits}`);
    console.log(`  React: ${this.stats.reacts}`);
    console.log(`  Bonus Actions: ${this.stats.bonusActions}`);
    console.log(`\nCasualties:`);
    console.log(`  KOs: ${this.stats.kos}`);
    console.log(`  Eliminations: ${this.stats.eliminations}`);
    console.log(`  Morale Tests: ${this.stats.moraleTests}`);
    console.log(`  Bottle Tests: ${this.stats.bottleTests}`);
    console.log('');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and run a battle with the given config
 */
export async function runBattle(config: BattleConfig): Promise<BattleResult> {
  const runner = new BattleRunner(config);
  return await runner.run();
}
