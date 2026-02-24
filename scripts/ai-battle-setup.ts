/**
 * AI Battle Setup CLI
 * 
 * Interactive command-line tool for setting up and running AI-only game sessions.
 * Prompts for mission selection, game size, AI configuration, and tactical doctrines.
 * 
 * Usage:
 *   npm run ai-battle                    # Quick battle with defaults
 *   npm run ai-battle -- -i              # Interactive setup
 *   npm run ai-battle -- VERY_LARGE 50   # Quick battle with size and density
 */

import * as readline from 'readline';
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
import { AIContext, AIControllerConfig } from '../src/lib/mest-tactics/ai/core/AIController';
import { attemptHide, attemptDetect } from '../src/lib/mest-tactics/status/concealment';

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
  verbose: boolean;
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
}

interface BattleLogEntry {
  turn: number;
  round: number;
  side: string;
  model: string;
  action: string;
  detail?: string;
  result?: string;
}

export interface BattleReport {
  config: GameConfig;
  winner: string;
  finalCounts: Array<{ name: string; remaining: number }>;
  stats: BattleStats;
  log: BattleLogEntry[];
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
      '1': 'VERY_SMALL',
      '2': 'SMALL',
      '3': 'MEDIUM',
      '4': 'LARGE',
      '5': 'VERY_LARGE',
    };
    
    return sizes[choice] || 'VERY_LARGE';
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

  async runInteractiveSetup(): Promise<GameConfig> {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   MEST Tactics AI Battle Setup        ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    const mission = await this.selectMission();
    const gameSize = await this.selectGameSize();
    const sides = await this.configureSides(gameSize);
    const densityRatio = await this.configureDensity();
    
    const config: GameConfig = {
      missionId: mission.id,
      missionName: mission.name,
      gameSize,
      battlefieldSize: GAME_SIZE_CONFIG[gameSize].battlefieldSize,
      maxTurns: GAME_SIZE_CONFIG[gameSize].maxTurns,
      endGameTurn: GAME_SIZE_CONFIG[gameSize].endGameTurn,
      sides,
      densityRatio,
      verbose: true,
    };
    
    console.log('\n' + '═'.repeat(60));
    console.log('\n📋 Configuration Summary:\n');
    console.log(`  Mission: ${config.missionName} (${config.missionId})`);
    console.log(`  Game Size: ${GAME_SIZE_CONFIG[gameSize].name}`);
    console.log(`  Battlefield: ${config.battlefieldSize}×${config.battlefieldSize} MU`);
    console.log(`  Max Turns: ${config.maxTurns}`);
    console.log(`  Terrain Density: ${config.densityRatio}%`);
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
  private stats: BattleStats = {
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
  };

  async runBattle(config: GameConfig): Promise<BattleReport> {
    console.log('\n⚔️  Starting Battle\n');
    console.log(`Mission: ${config.missionName}`);
    console.log(`Battlefield: ${config.battlefieldSize}×${config.battlefieldSize} MU`);
    console.log(`Max Turns: ${config.maxTurns}\n`);

    // Build assemblies
    const sides = await Promise.all(config.sides.map(side => this.createAssembly(side)));
    
    console.log('Assemblies built:');
    sides.forEach((side, i) => {
      console.log(`  ${config.sides[i].name}: ${side.characters.length} models, ${side.totalBP} BP`);
    });
    console.log();

    // Create battlefield
    const battlefield = this.createBattlefield(config.battlefieldSize, config.densityRatio);

    // Deploy models
    sides.forEach((side, i) => {
      this.deployModels(side, battlefield, i, config.battlefieldSize);
    });

    console.log('Models deployed.\n');
    console.log('─'.repeat(60) + '\n');

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
          ai: {
            ...DEFAULT_CHARACTER_AI_CONFIG.ai,
            aggression: sideConfig.aggression,
            caution: sideConfig.caution,
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

      if (config.verbose) {
        console.log(`\n📍 Turn ${turn}\n`);
      }

      // Process each side
      for (let sideIndex = 0; sideIndex < config.sides.length; sideIndex++) {
        const sideConfig = config.sides[sideIndex];
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
            config
          );
        }
      }

      // Check victory conditions
      const remainingPerSide = sides.map((side, i) => 
        side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length
      );

      const sidesWithModels = remainingPerSide.filter(r => r > 0).length;
      if (sidesWithModels <= 1) {
        gameOver = true;
        if (config.verbose) {
          console.log(`\n🏆 Game Over - Only ${sidesWithModels} side(s) with models remaining!\n`);
        }
      } else if (turn >= config.endGameTurn) {
        if (Math.random() < 0.5) {
          gameOver = true;
          if (config.verbose) {
            console.log(`\n🎲 End game die roll - Game Over!\n`);
          }
        }
      }

      if (config.verbose) {
        config.sides.forEach((side, i) => {
          console.log(`  ${side.name}: ${remainingPerSide[i]}/${sides[i].characters.length} models`);
        });
      }
    }

    // Generate results
    const finalCounts = sides.map((side, i) => 
      side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length
    );

    const maxRemaining = Math.max(...finalCounts);
    const winners = config.sides.filter((_, i) => finalCounts[i] === maxRemaining);
    
    const report: BattleReport = {
      config,
      winner: winners.length === 1 ? winners[0].name : (winners.length === 0 ? 'None' : 'Draw'),
      finalCounts: config.sides.map((side, i) => ({ name: side.name, remaining: finalCounts[i] })),
      stats: this.stats,
      log: this.log,
    };

    this.displayReport(report);

    return report;
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
      profiles.push(profile);
    }

    const assembly = buildAssembly(sideConfig.assemblyName, profiles);
    return { characters: assembly.characters, totalBP: assembly.totalBP };
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
      x = Math.max(0, Math.min(size - 1, x));
      y = Math.max(0, Math.min(size - 1, y));
      battlefield.placeCharacter(char, { x, y });
    });
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
    const allies = allSides[sideIndex].characters.filter(c => c.id !== character.id && !c.state.isEliminated && !c.state.isKOd);
    const enemies = allSides.flatMap((side, i) => i !== sideIndex ? side.characters.filter(c => !c.state.isEliminated && !c.state.isKOd) : []);
    
    const context: AIContext = {
      character,
      allies,
      enemies,
      battlefield,
      currentTurn: turn,
      currentRound: 1,
      apRemaining: 2,
      knowledge: aiController.updateKnowledge({ character, allies, enemies, battlefield, currentTurn: turn, currentRound: 1, apRemaining: 2, config: aiController.getConfig() }),
      config: aiController.getConfig(),
    };

    gameManager.beginActivation(character);

    try {
      const aiResult = await aiController.decideAction(context);
      const decision = aiResult.decision;
      
      if (!decision || decision.type === 'none') {
        if (config.verbose && decision?.reason) {
          console.log(`  ${character.profile.name} (${config.sides[sideIndex].name}): hold - ${decision.reason}`);
        }
        gameManager.endActivation(character);
        return;
      }

      if (decision.type === 'hold') {
        const wait = gameManager.executeWait(character, { spendAp: true });
        if (wait.success) {
          this.stats.totalActions++;
          this.stats.waits++;
          this.log.push({
            turn,
            round: 1,
            side: config.sides[sideIndex].name,
            model: character.profile.name,
            action: 'wait',
            detail: decision.reason ?? 'hold converted to wait',
            result: 'wait=true',
          });
          if (config.verbose) {
            console.log(`  ${character.profile.name} (${config.sides[sideIndex].name}): wait - ${decision.reason ?? 'hold converted'}`);
          }
        } else if (config.verbose) {
          console.log(`  ${character.profile.name} (${config.sides[sideIndex].name}): hold - ${decision.reason ?? 'no action'}`);
        }
        gameManager.endActivation(character);
        return;
      }

      this.stats.totalActions++;
      
      if (config.verbose) {
        console.log(`  ${character.profile.name} (${config.sides[sideIndex].name}): ${decision.type}${decision.reason ? ` - ${decision.reason}` : ''}`);
      }

      this.log.push({
        turn,
        round: 1,
        side: config.sides[sideIndex].name,
        model: character.profile.name,
        action: decision.type,
        detail: decision.reason,
      });

      const startPos = battlefield.getCharacterPosition(character);
      let actionExecuted = false;

      // Execute action based on type
      switch (decision.type) {
        case 'move': {
          const destination = decision.position ?? this.computeFallbackMovePosition(character, enemies, battlefield);
          if (destination) {
            this.stats.moves++;
            const equipment = character.profile.equipment || character.profile.items || [];
            const opportunityWeapon = equipment.find(i => i.classification === 'Melee' || i.class === 'Melee') || equipment[0];
            gameManager.executeMove(character, destination, {
              opponents: enemies,
              allowOpportunityAttack: true,
              opportunityWeapon: opportunityWeapon ?? undefined,
            });
            actionExecuted = true;
          }
          break;
        }
        case 'charge':
        case 'close_combat':
          if (decision.target) {
            const wasEngaged = this.areEngaged(character, decision.target, battlefield);
            let movedForEngagement = false;

            if (!wasEngaged) {
              const engagePos = this.computeEngageMovePosition(character, decision.target, battlefield);
              if (engagePos) {
                const equipment = character.profile.equipment || character.profile.items || [];
                const opportunityWeapon = equipment.find(i => i.classification === 'Melee' || i.class === 'Melee') || equipment[0];
                const moved = gameManager.executeMove(character, engagePos, {
                  opponents: enemies,
                  allowOpportunityAttack: true,
                  opportunityWeapon: opportunityWeapon ?? undefined,
                });
                if (moved.moved) {
                  this.stats.moves++;
                  movedForEngagement = true;
                  actionExecuted = true;
                }
              }
            }

            if (this.areEngaged(character, decision.target, battlefield)) {
              this.stats.closeCombats++;
              await this.executeCloseCombat(
                character,
                decision.target,
                battlefield,
                gameManager,
                config,
                turn,
                sideIndex,
                decision.type === 'charge' || movedForEngagement
              );
              actionExecuted = true;
            } else if (!actionExecuted) {
              this.log[this.log.length - 1].result = 'close_combat=false:not-engaged';
            }
          }
          break;
        case 'ranged_combat':
          if (decision.target) {
            this.stats.rangedCombats++;
            await this.executeRangedCombat(character, decision.target, battlefield, gameManager, config, turn, sideIndex);
            actionExecuted = true;
          }
          break;
        case 'disengage':
          if (decision.target) {
            this.stats.disengages++;
            await this.executeDisengage(character, decision.target, battlefield, gameManager, config, turn, sideIndex);
            actionExecuted = true;
          }
          break;
        case 'wait': {
          this.stats.waits++;
          const wait = gameManager.executeWait(character, { spendAp: true });
          this.log[this.log.length - 1].result = wait.success ? 'wait=true' : `wait=false:${wait.reason ?? 'failed'}`;
          actionExecuted = wait.success;
          break;
        }
        case 'detect':
          if (decision.target) {
            this.stats.detects++;
            if (!gameManager.spendAp(character, 1)) {
              this.log[this.log.length - 1].result = 'detect=false:not-enough-ap';
              break;
            }
            const detect = attemptDetect(battlefield, character, decision.target, enemies);
            this.log[this.log.length - 1].result = detect.success ? 'detect=true' : `detect=false:${detect.reason ?? 'failed'}`;
            actionExecuted = detect.success;
          }
          break;
        case 'hide': {
          this.stats.hides++;
          const hide = attemptHide(battlefield, character, enemies, (amount: number) => gameManager.spendAp(character, amount));
          this.log[this.log.length - 1].result = hide.canHide ? 'hide=true' : `hide=false:${hide.reason ?? 'failed'}`;
          actionExecuted = hide.canHide;
          break;
        }
        case 'rally':
          if (decision.target) {
            const rally = gameManager.executeRally(character, decision.target);
            this.log[this.log.length - 1].result = rally.success ? 'rally=true' : `rally=false:${rally.reason ?? 'failed'}`;
            actionExecuted = rally.success;
          }
          break;
        case 'revive':
          if (decision.target) {
            const revive = gameManager.executeRevive(character, decision.target);
            this.log[this.log.length - 1].result = revive.success ? 'revive=true' : `revive=false:${revive.reason ?? 'failed'}`;
            actionExecuted = revive.success;
          }
          break;
      }

      if (actionExecuted) {
        const endPos = battlefield.getCharacterPosition(character);
        const movedDistance = startPos && endPos ? Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y) : 0;
        const trigger = movedDistance > 0 ? 'Move' : 'NonMove';
        const reactResult = this.processReacts(character, enemies, gameManager, trigger, movedDistance);
        if (reactResult.executed) {
          this.stats.reacts++;
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
    movedDistance: number
  ): { executed: boolean } {
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

    const equipment = first.actor.profile.equipment || first.actor.profile.items || [];
    const weapon = equipment.find(i =>
      i.classification === 'Bow' ||
      i.classification === 'Thrown' ||
      i.classification === 'Range' ||
      i.classification === 'Firearm' ||
      i.classification === 'Support'
    ) || equipment[0];
    if (!weapon) {
      return { executed: false };
    }

    const react = gameManager.executeStandardReact(first.actor, active, weapon);
    return { executed: react.executed };
  }

  private computeFallbackMovePosition(
    actor: Character,
    enemies: Character[],
    battlefield: Battlefield
  ): Position | null {
    const actorPos = battlefield.getCharacterPosition(actor);
    if (!actorPos || enemies.length === 0) {
      return null;
    }

    let nearestPos: Position | null = null;
    let nearestDistance = Infinity;
    for (const enemy of enemies) {
      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const distance = Math.hypot(enemyPos.x - actorPos.x, enemyPos.y - actorPos.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPos = enemyPos;
      }
    }

    if (!nearestPos || nearestDistance <= 1) {
      return null;
    }

    const mov = actor.finalAttributes.mov ?? actor.attributes.mov ?? 2;
    const step = Math.min(mov, nearestDistance - 1);
    const dx = nearestPos.x - actorPos.x;
    const dy = nearestPos.y - actorPos.y;
    const ratio = step / nearestDistance;
    return {
      x: Math.max(0, Math.min(battlefield.width - 1, Math.round(actorPos.x + dx * ratio))),
      y: Math.max(0, Math.min(battlefield.height - 1, Math.round(actorPos.y + dy * ratio))),
    };
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
  ) {
    // Get attacker's melee weapon from equipment or items
    const equipment = attacker.profile.equipment || attacker.profile.items || [];
    const weapon = equipment.find(i => i.classification === 'Melee') ||
                   equipment.find(i => i.class === 'Melee') ||
                   equipment[0];

    if (!weapon) {
      if (config.verbose) console.log(`    → No weapon available (equipment: ${equipment.length})`);
      return;
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

      this.log[this.log.length - 1].result = `hit=${normalized.hit}, KO=${normalized.ko}, Elim=${normalized.eliminated}`;

      if (normalized.ko) {
        this.stats.kos++;
      }
      if (normalized.eliminated) {
        this.stats.eliminations++;
      }
    } catch (error) {
      if (config.verbose) {
        console.error(`    Combat error: ${error}`);
      }
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
  ) {
    // Get attacker's ranged weapon from equipment or items
    const equipment = attacker.profile.equipment || attacker.profile.items || [];
    const weapon = equipment.find(i => 
      i.classification === 'Bow' || i.classification === 'Thrown' || i.classification === 'Range'
    ) || equipment[0];

    if (!weapon) {
      if (config.verbose) console.log(`    → No ranged weapon available`);
      return;
    }

    try {
      const attackerPos = battlefield.getCharacterPosition(attacker);
      const defenderPos = battlefield.getCharacterPosition(defender);
      
      if (!attackerPos || !defenderPos) {
        if (config.verbose) console.log(`    → Invalid positions`);
        return;
      }

      const orm = Math.sqrt(
        Math.pow(attackerPos.x - defenderPos.x, 2) +
        Math.pow(attackerPos.y - defenderPos.y, 2)
      );

      const result = gameManager.executeRangedAttack(attacker, defender, weapon, { orm });
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
    } catch (error) {
      if (config.verbose) {
        console.error(`    Ranged combat error: ${error}`);
      }
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
  ) {
    try {
      // Get defender's melee weapon from equipment or items
      const equipment = defender.profile.equipment || defender.profile.items || [];
      const weapon = equipment.find(i => i.classification === 'Melee') ||
                     equipment.find(i => i.class === 'Melee') ||
                     equipment[0];
      
      if (!weapon) {
        if (config.verbose) console.log(`    → No weapon for disengage`);
        return;
      }

      const result = gameManager.executeDisengageAction(disengager, defender, weapon);
      
      if (result.pass && result.testResult) {
        const disengagerPos = battlefield.getCharacterPosition(disengager);
        const defenderPos = battlefield.getCharacterPosition(defender);
        
        if (disengagerPos && defenderPos) {
          const dx = disengagerPos.x - defenderPos.x;
          const dy = disengagerPos.y - defenderPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const mov = disengager.finalAttributes?.mov ?? disengager.attributes?.mov ?? 2;
          
          if (dist > 0) {
            const ratio = Math.min(mov, 2) / dist;
            const newPos = {
              x: Math.round(disengagerPos.x + dx * ratio),
              y: Math.round(disengagerPos.y + dy * ratio),
            };
            
            try {
              battlefield.moveCharacter(disengager, newPos);
            } catch {
              battlefield.placeCharacter(disengager, newPos);
            }
          }
        }
      }
      
      if (config.verbose) {
        console.log(`    → Disengage: ${result.pass ? 'Success' : 'Failed'}`);
      }
    } catch (error) {
      if (config.verbose) {
        console.error(`    Disengage error: ${error}`);
      }
    }
  }

  private displayReport(report: BattleReport) {
    console.log('\n' + '═'.repeat(60));
    console.log('\n📊 BATTLE REPORT\n');
    console.log('═'.repeat(60));
    
    console.log(`\n📋 Mission: ${report.config.missionName}`);
    console.log(`📏 Game Size: ${GAME_SIZE_CONFIG[report.config.gameSize].name}`);
    console.log(`🗺️  Battlefield: ${report.config.battlefieldSize}×${report.config.battlefieldSize} MU`);
    console.log(`🌲 Terrain Density: ${report.config.densityRatio}%`);
    console.log(`⏱️  Turns Completed: ${report.stats.turnsCompleted}/${report.config.maxTurns}`);
    
    console.log('\n🏆 RESULT\n');
    console.log(`  Winner: ${report.winner}!`);
    console.log('\n  Final Model Counts:');
    report.finalCounts.forEach(fc => {
      console.log(`    ${fc.name}: ${fc.remaining} remaining`);
    });
    
    console.log('\n📈 STATISTICS\n');
    console.log(`  Total Actions: ${report.stats.totalActions}`);
    console.log(`  Moves: ${report.stats.moves}`);
    console.log(`  Close Combats: ${report.stats.closeCombats}`);
    console.log(`  Ranged Combats: ${report.stats.rangedCombats}`);
    console.log(`  Disengages: ${report.stats.disengages}`);
    console.log(`  Waits: ${report.stats.waits}`);
    console.log(`  Detects: ${report.stats.detects}`);
    console.log(`  Hides: ${report.stats.hides}`);
    console.log(`  Reacts: ${report.stats.reacts}`);
    console.log(`  Eliminations: ${report.stats.eliminations}`);
    console.log(`  KO's: ${report.stats.kos}`);
    
    console.log('\n' + '═'.repeat(60) + '\n');
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
    
    await runner.runBattle(config);
    
    console.log('✅ Battle completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Battle failed with error:');
    console.error(error);
    setup.close();
    process.exit(1);
  }
}

async function runQuickBattle(
  gameSize: GameSize = 'VERY_LARGE',
  missionId: string = 'QAI_11',
  densityRatio: number = 50
) {
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
    verbose: true,
  };

  const runner = new AIBattleRunner();

  try {
    await runner.runBattle(config);
    console.log('✅ Battle completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Battle failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Main entry point
const args = process.argv.slice(2);
const command = args[0];

if (command === '--interactive' || command === '-i') {
  runInteractive();
} else if (command === '--help' || command === '-h') {
  console.log(`
AI Battle Setup - MEST Tactics

Usage:
  npm run ai-battle                    # Quick battle (VERY_LARGE, density 50)
  npm run ai-battle -- -i              # Interactive setup
  npm run ai-battle -- SIZE DENSITY    # Quick battle with custom params

Game Sizes: VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE

Examples:
  npm run ai-battle -- VERY_LARGE 50   # Large battle, 50% terrain
  npm run ai-battle -- SMALL 30        # Small battle, 30% terrain
`);
} else {
  // Default: run quick battle with VERY_LARGE and density 50
  const sizeArg = (args[0] || 'VERY_LARGE').toUpperCase() as GameSize;
  const densityArg = parseInt(args[1], 10) || 50;
  const validSizes = ['VERY_SMALL', 'SMALL', 'MEDIUM', 'LARGE', 'VERY_LARGE'];
  const gameSize = validSizes.includes(sizeArg) ? sizeArg : 'VERY_LARGE';
  runQuickBattle(gameSize as GameSize, 'QAI_11', densityArg);
}
