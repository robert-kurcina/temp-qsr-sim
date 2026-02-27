/**
 * Battle Generator Script
 * 
 * Generates and runs AI vs AI battles with configurable parameters.
 * 
 * Default Configuration:
 * - Archetype: Average
 * - Weapon: Sword, Broad
 * - Armor: Shield, Small + Armor, Light + Armored Gear
 * - Game Size: VERY_SMALL
 * - Mission: QAI_11 (Elimination)
 * - Terrain Density: 50%
 * - Lighting: Day, Clear (Visibility OR 16 MU)
 * 
 * Usage:
 *   npx tsx scripts/battle-generator.ts
 *   npx tsx scripts/battle-generator.ts --gameSize SMALL --density 30
 *   npx tsx scripts/battle-generator.ts --gameSize MEDIUM --lighting "Night, Full Moon"
 * 
 * Options:
 *   --gameSize <size>        VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE (default: VERY_SMALL)
 *   --density <ratio>        Terrain density 0-100 (default: 50)
 *   --lighting <preset>      Lighting preset (default: "Day, Clear")
 *   --mission <id>           Mission ID (default: QAI_11)
 *   --turns <max>            Maximum turns (default: auto based on gameSize)
 *   --instrumentation <0-5>  Detail level (default: 3)
 *   --help                   Show help
 */

import { buildAssembly, buildProfile, GameSize, gameSizeDefaults } from '../src/lib/mest-tactics/mission/assembly-builder';
import { buildMissionSide } from '../src/lib/mest-tactics/mission/MissionSideBuilder';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { GameManager } from '../src/lib/mest-tactics/engine/GameManager';
import { TacticalDoctrine } from '../src/lib/mest-tactics/ai/stratagems';
import { configureInstrumentation, InstrumentationGrade, getInstrumentationLogger } from '../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { getEndGameTriggerTurn } from '../src/lib/mest-tactics/engine/end-game-trigger';

// ============================================================================
// Configuration
// ============================================================================

interface BattleConfig {
  gameSize: GameSize;
  battlefieldSize: number;
  maxTurns: number;
  endGameTriggerTurn: number;
  terrainDensity: number;
  lighting: LightingPreset;
  instrumentationGrade: InstrumentationGrade;
  missionId: string;
  sideAName: string;
  sideBName: string;
  sideADoctrine: TacticalDoctrine;
  sideBDoctrine: TacticalDoctrine;
  archetypeName: string;
  weaponName: string;
  armorNames: string[];
}

interface LightingPreset {
  name: string;
  visibilityOR: number; // in MU
  description: string;
}

const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  'Day, Clear': { name: 'Day, Clear', visibilityOR: 16, description: 'Full daylight, clear skies' },
  'Day, Hazy': { name: 'Day, Hazy', visibilityOR: 14, description: 'Daylight with haze or fog' },
  'Day, Overcast': { name: 'Day, Overcast', visibilityOR: 14, description: 'Overcast daylight' },
  'Twilight, Clear': { name: 'Twilight, Clear', visibilityOR: 8, description: 'Dawn or dusk, clear' },
  'Twilight, Overcast': { name: 'Twilight, Overcast', visibilityOR: 6, description: 'Dawn or dusk, overcast' },
  'Night, Full Moon': { name: 'Night, Full Moon', visibilityOR: 4, description: 'Night with full moon' },
  'Night, Half Moon': { name: 'Night, Half Moon', visibilityOR: 2, description: 'Night with half moon' },
  'Night, New Moon': { name: 'Night, New Moon', visibilityOR: 1, description: 'Night with new moon (dark)' },
  'Pitch-black': { name: 'Pitch-black', visibilityOR: 0, description: 'Complete darkness' },
};

const DEFAULT_CONFIG: BattleConfig = {
  gameSize: GameSize.VERY_SMALL,
  battlefieldSize: 24,
  maxTurns: 10,
  endGameTriggerTurn: 3, // VERY_SMALL = Turn 3
  terrainDensity: 0.50,
  lighting: LIGHTING_PRESETS['Day, Clear'],
  instrumentationGrade: InstrumentationGrade.BY_ACTION_WITH_TESTS,
  missionId: 'QAI_11',
  sideAName: 'Side A',
  sideBName: 'Side B',
  sideADoctrine: TacticalDoctrine.Balanced,
  sideBDoctrine: TacticalDoctrine.Balanced,
  archetypeName: 'Average',
  weaponName: 'Sword, Broad',
  armorNames: ['Shield, Small', 'Armor, Light', 'Armored Gear'],
};

// ============================================================================
// Command Line Parser
// ============================================================================

function parseArgs(): Partial<BattleConfig> {
  const args = process.argv.slice(2);
  const config: Partial<BattleConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--gameSize':
        config.gameSize = GameSize[value as keyof typeof GameSize];
        i++;
        break;
      case '--density':
        config.terrainDensity = parseInt(value, 10) / 100;
        i++;
        break;
      case '--lighting':
        config.lighting = LIGHTING_PRESETS[value];
        i++;
        break;
      case '--mission':
        config.missionId = value;
        i++;
        break;
      case '--turns':
        config.maxTurns = parseInt(value, 10);
        i++;
        break;
      case '--instrumentation':
        config.instrumentationGrade = parseInt(value, 10) as InstrumentationGrade;
        i++;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return config;
}

function printHelp() {
  console.log(`
Battle Generator - AI vs AI Battle Simulation

Usage:
  npx tsx scripts/battle-generator.ts [options]

Options:
  --gameSize <size>        Game size (VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE)
                           Default: VERY_SMALL

  --density <ratio>        Terrain density percentage (0-100)
                           Default: 50

  --lighting <preset>      Lighting preset
                           Options: "Day, Clear", "Day, Hazy", "Twilight, Clear",
                                    "Night, Full Moon", "Night, Half Moon", "Pitch-black"
                           Default: "Day, Clear" (Visibility OR 16 MU)

  --mission <id>           Mission ID
                           Options: QAI_11, QAI_12, QAI_13, QAI_14, QAI_15,
                                    QAI_16, QAI_17, QAI_18, QAI_19, QAI_20
                           Default: QAI_11 (Elimination)

  --turns <max>            Maximum turns before auto-end
                           Default: 10

  --instrumentation <0-5>  Instrumentation detail level
                           0=None, 1=Summary, 2=By Action, 3=With Tests,
                           4=With Dice, 5=Full Detail
                           Default: 3

  --help                   Show this help message

Examples:
  # Default VERY_SMALL battle (QAI_11 Elimination)
  npx tsx scripts/battle-generator.ts

  # SMALL battle with 30% terrain
  npx tsx scripts/battle-generator.ts --gameSize SMALL --density 30

  # MEDIUM battle with night lighting
  npx tsx scripts/battle-generator.ts --gameSize MEDIUM --lighting "Night, Full Moon"

  # QAI_12 Convergence mission
  npx tsx scripts/battle-generator.ts --mission QAI_12

  # Full detail instrumentation
  npx tsx scripts/battle-generator.ts --instrumentation 5
`);
}

// ============================================================================
// Profile Builder
// ============================================================================

function createDefaultWarriorProfile(name: string, config: BattleConfig): any {
  return buildProfile(config.archetypeName, {
    technologicalAge: 'Medieval',
    itemNames: [
      config.weaponName,
      ...config.armorNames,
    ],
  });
}

// ============================================================================
// Terrain Generation
// ============================================================================

function generateTerrain(battlefieldSize: number, density: number): any[] {
  const terrain: any[] = [];
  const terrainTypes = ['Tree', 'Rock', 'Ruin', 'Bush'];
  const numTerrain = Math.floor((battlefieldSize * battlefieldSize) * density / 100);

  for (let i = 0; i < numTerrain; i++) {
    const x = Math.floor(Math.random() * battlefieldSize);
    const y = Math.floor(Math.random() * battlefieldSize);
    const type = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
    
    // Create proper terrain element with vertices
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

// ============================================================================
// Battle Runner
// ============================================================================

async function runBattle(userConfig: Partial<BattleConfig> = {}): Promise<any> {
  // Merge configs
  const config: BattleConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };

  // Update end-game trigger turn based on game size
  config.endGameTriggerTurn = getEndGameTriggerTurn(config.gameSize);

  // Update battlefield size based on game size
  const sizeDefaults: Record<GameSize, number> = {
    [GameSize.VERY_SMALL]: 24,
    [GameSize.SMALL]: 36,
    [GameSize.MEDIUM]: 48,
    [GameSize.LARGE]: 60,
    [GameSize.VERY_LARGE]: 72,
  };
  config.battlefieldSize = sizeDefaults[config.gameSize];

  console.log('⚔️  AI vs AI BATTLE GENERATOR');
  console.log('═══════════════════════════════════════');
  console.log(`Mission: ${config.missionId} (Elimination)`);
  console.log(`Game Size: ${config.gameSize}`);
  console.log(`Battlefield: ${config.battlefieldSize}×${config.battlefieldSize} MU`);
  console.log(`Terrain Density: ${Math.round(config.terrainDensity * 100)}%`);
  console.log(`Lighting: ${config.lighting.name} (Visibility OR ${config.lighting.visibilityOR} MU)`);
  console.log(`End-Game Trigger: Turn ${config.endGameTriggerTurn}`);
  console.log(`Archetype: ${config.archetypeName}`);
  console.log(`Weapon: ${config.weaponName}`);
  console.log(`Armor: ${config.armorNames.join('. ')}`);
  console.log(`Instrumentation: Grade ${config.instrumentationGrade}`);
  console.log('═══════════════════════════════════════\n');

  // Configure instrumentation
  configureInstrumentation({
    grade: config.instrumentationGrade,
    format: 'console',
  });

  const logger = getInstrumentationLogger();
  logger.startBattle(`battle-${config.gameSize}-${Date.now()}`);

  // Create battlefield
  const battlefield = new Battlefield(config.battlefieldSize, config.battlefieldSize);
  const terrain = generateTerrain(config.battlefieldSize, config.terrainDensity);
  terrain.forEach(t => battlefield.addTerrain(t));

  console.log(`✓ Battlefield created with ${terrain.length} terrain elements\n`);

  // Get game size defaults
  const defaults = gameSizeDefaults[config.gameSize];
  const numModelsPerSide = Math.floor((defaults.characterLimitMin + defaults.characterLimitMax) / 2);

  // Create profiles
  console.log('Building profiles...');
  const profilesA: any[] = [];
  const profilesB: any[] = [];

  for (let i = 0; i < numModelsPerSide; i++) {
    profilesA.push(createDefaultWarriorProfile(`${config.sideAName}-${i + 1}`, config));
    profilesB.push(createDefaultWarriorProfile(`${config.sideBName}-${i + 1}`, config));
  }

  console.log(`  ${config.sideAName}: ${profilesA.length} profiles`);
  console.log(`  ${config.sideBName}: ${profilesB.length} profiles\n`);

  // Build assemblies
  const assemblyA = buildAssembly(config.sideAName, profilesA, {
    gameSize: config.gameSize,
  });
  const assemblyB = buildAssembly(config.sideBName, profilesB, {
    gameSize: config.gameSize,
  });

  console.log(`✓ Assembly ${config.sideAName}: ${assemblyA.assembly.totalBP} BP, ${assemblyA.assembly.totalCharacters} models`);
  console.log(`✓ Assembly ${config.sideBName}: ${assemblyB.assembly.totalBP} BP, ${assemblyB.assembly.totalCharacters} models\n`);

  // Build mission sides
  const sideA = buildMissionSide(config.sideAName, [assemblyA]);
  const sideB = buildMissionSide(config.sideBName, [assemblyB]);

  // Fix character IDs
  sideA.members.forEach((member: any, i: number) => {
    member.character.id = `${config.sideAName}-${i + 1}`;
    member.character.name = `${config.sideAName}-${i + 1}`;
    member.id = `${config.sideAName}-${i + 1}`;
  });
  sideB.members.forEach((member: any, i: number) => {
    member.character.id = `${config.sideBName}-${i + 1}`;
    member.character.name = `${config.sideBName}-${i + 1}`;
    member.id = `${config.sideBName}-${i + 1}`;
  });

  // Deploy models
  console.log('Deploying models...');
  const modelsPerRow = Math.ceil(Math.sqrt(numModelsPerSide));
  const spacing = Math.floor(config.battlefieldSize / (modelsPerRow + 1));

  sideA.members.forEach((member: any, i: number) => {
    const row = Math.floor(i / modelsPerRow);
    const col = i % modelsPerRow;
    const x = spacing + col * spacing;
    const y = spacing + row * spacing;
    battlefield.placeCharacter(member.character, { x, y });
  });

  sideB.members.forEach((member: any, i: number) => {
    const row = Math.floor(i / modelsPerRow);
    const col = i % modelsPerRow;
    const x = spacing + col * spacing;
    const y = config.battlefieldSize - spacing - row * spacing;
    battlefield.placeCharacter(member.character, { x, y });
  });

  console.log('✓ Models deployed\n');

  // Create game manager with all characters from the deployed sides
  const allCharacters = [
    ...sideA.members.map((m: any) => m.character),
    ...sideB.members.map((m: any) => m.character),
  ];
  const gameManager = new GameManager(allCharacters, battlefield, config.endGameTriggerTurn);

  console.log('✓ Game manager initialized\n');

  // Run battle
  console.log('🎮 Starting battle...\n');
  console.log('═══════════════════════════════════════\n');

  let turnCount = 0;
  let firstBloodAwarded = false;
  let firstBloodSide: string | null = null;

  for (let turn = 1; turn <= config.maxTurns; turn++) {
    turnCount = turn;
    console.log(`\n━━━ TURN ${turn} ━━━\n`);

    // Simple turn: each character gets one action
    for (const character of allCharacters) {
      if (character.state.isEliminated || character.state.isKOd || character.state.isDistracted) {
        continue;
      }

      const charPos = battlefield.getCharacterPosition(character);
      if (!charPos) {
        continue;
      }

      // Determine which side this character belongs to
      const isSideA = sideA.members.some((m: any) => m.character.id === character.id);
      const characterSide = isSideA ? sideA : sideB;
      
      // Determine opposing side
      const opposingSide = isSideA ? sideB : sideA;

      // Find nearest enemy (from opposing side only)
      let nearestEnemy: any = null;
      let nearestDist = Infinity;

      for (const enemy of opposingSide.members) {
        const enemyChar = enemy.character;
        if (enemyChar.state.isEliminated || enemyChar.state.isKOd) continue;
        const enemyPos = battlefield.getCharacterPosition(enemyChar);
        if (!enemyPos) continue;

        const dist = Math.sqrt(
          Math.pow(charPos.x - enemyPos.x, 2) +
          Math.pow(charPos.y - enemyPos.y, 2)
        );

        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemyChar;
        }
      }

      if (!nearestEnemy) {
        continue;
      }

      // Simple AI: move toward enemy, then attack
      const mov = character.finalAttributes?.mov ?? character.attributes?.mov ?? 2;
      const movePerAP = mov + 2;

      if (nearestDist > 1) {
        // Move toward enemy
        const enemyPos = battlefield.getCharacterPosition(nearestEnemy)!;
        const dx = (enemyPos.x - charPos.x) / nearestDist;
        const dy = (enemyPos.y - charPos.y) / nearestDist;
        const newX = Math.round(charPos.x + dx * Math.min(movePerAP * 2, nearestDist - 1));
        const newY = Math.round(charPos.y + dy * Math.min(movePerAP * 2, nearestDist - 1));

        try {
          battlefield.moveCharacter(character, { x: newX, y: newY });

          logger.logAction({
            turn: turnCount,
            initiative: 1,
            actorId: character.id,
            actorName: character.name,
            actionType: 'move' as any,
            description: `Moved toward ${nearestEnemy.name}`,
            apSpent: 2,
            apRemaining: 0,
            outcome: `Moved to (${newX}, ${newY})`,
            timestamp: new Date().toISOString(),
          });

          console.log(`  ${character.name}: Move to (${newX}, ${newY})`);
        } catch (e) {
          // Ignore movement errors
        }
      } else {
        // Attack
        try {
          // Simple damage resolution
          const attackerCCA = character.finalAttributes?.cca ?? character.attributes?.cca ?? 2;
          const defenderFOR = nearestEnemy.finalAttributes?.for ?? nearestEnemy.attributes?.for ?? 2;

          const hitRoll = Math.floor(Math.random() * 6) + 1 + attackerCCA;
          const defenseRoll = Math.floor(Math.random() * 6) + 1 + defenderFOR;
          
          if (hitRoll > defenseRoll) {
            const damage = Math.floor(Math.random() * 3) + 1;
            nearestEnemy.state.wounds += damage;

            // Track First Blood (first side to inflict wounds)
            if (!firstBloodAwarded) {
              firstBloodAwarded = true;
              firstBloodSide = characterSide.id;
              console.log(`  🩸 FIRST BLOOD! ${characterSide.name} scores 1 VP!`);
            }

            logger.logAction({
              turn: turnCount,
              initiative: 1,
              actorId: character.id,
              actorName: character.name,
              actionType: 'attack' as any,
              description: `Close Combat vs ${nearestEnemy.name}`,
              apSpent: 2,
              apRemaining: 0,
              targetId: nearestEnemy.id,
              targetName: nearestEnemy.name,
              outcome: `Hit for ${damage} wounds`,
              timestamp: new Date().toISOString(),
            });

            console.log(`  ${character.name}: Attack ${nearestEnemy.name} - Hit for ${damage} wounds`);

            if (nearestEnemy.state.wounds >= 3) {
              nearestEnemy.state.isKOd = true;
              console.log(`    → ${nearestEnemy.name} is KO'd!`);
            }
          } else {
            logger.logAction({
              turn: turnCount,
              initiative: 1,
              actorId: character.id,
              actorName: character.name,
              actionType: 'attack' as any,
              description: `Close Combat vs ${nearestEnemy.name}`,
              apSpent: 2,
              apRemaining: 0,
              targetId: nearestEnemy.id,
              targetName: nearestEnemy.name,
              outcome: 'Missed',
              timestamp: new Date().toISOString(),
            });
            
            console.log(`  ${character.name}: Attack ${nearestEnemy.name} - Missed`);
          }
        } catch (e) {
          // Ignore attack errors
        }
      }
    }

    console.log('');
  }

  console.log('\n═══════════════════════════════════════');
  console.log('🏁 BATTLE COMPLETE\n');

  // End instrumentation logging
  const battleLog = logger.endBattle(turnCount);

  // Print summary with Keys to Victory
  printBattleSummary(config, battleLog, { firstBloodSide, firstBloodAwarded });

  return { config, battleLog, keys: { firstBloodSide, firstBloodAwarded } };
}

// ============================================================================
// Summary Printer
// ============================================================================

function printBattleSummary(config: BattleConfig, battleLog: any, keys: { firstBloodSide: string | null; firstBloodAwarded: boolean }) {
  console.log('📊 BATTLE SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Battle ID: ${battleLog.battleId}`);
  console.log(`Mission: ${config.missionId}`);
  console.log(`Game Size: ${config.gameSize}`);
  console.log(`Lighting: ${config.lighting.name} (OR ${config.lighting.visibilityOR} MU)`);
  console.log(`Turns: ${battleLog.totalTurns}`);
  console.log('');

  // Keys to Victory
  console.log('🔑 KEYS TO VICTORY');
  console.log('───────────────────────────────────────');
  if (keys.firstBloodAwarded) {
    console.log(`  🩸 First Blood: ${keys.firstBloodSide} (+1 VP)`);
  } else {
    console.log(`  🩸 First Blood: Not awarded`);
  }
  console.log('');

  // Instrumentation Summary
  if (battleLog) {
    console.log('📝 ACTION SUMMARY');
    console.log('───────────────────────────────────────');
    console.log(`Total Actions: ${battleLog.summary.totalActions}`);
    console.log(`Actions by Type:`);
    Object.entries(battleLog.summary.actionsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log(`Tests: ${battleLog.summary.totalTests} (${battleLog.summary.testsPassed} passed, ${battleLog.summary.testsFailed} failed)`);
    console.log(`Cascades: ${battleLog.summary.totalCascades}`);
    console.log(`Dice Rolled: ${battleLog.summary.totalDiceRolled}`);
    console.log(`Wait Actions: ${battleLog.summary.waitActions}`);
    console.log(`React Actions: ${battleLog.summary.reactActions}`);
    console.log(`Bonus Actions: ${battleLog.summary.bonusActions}`);
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

// ============================================================================
// Main
// ============================================================================

const userConfig = parseArgs();
runBattle(userConfig).catch(console.error);
