/**
 * Run a VERY_SMALL AI vs AI battle with QAI_11 Elimination mission
 * 
 * Configuration:
 * - Game Size: VERY_SMALL
 * - Mission: QAI_11 (Elimination)
 * - Density Ratio: 50%
 * - Tech Age: Medieval (Tech 5)
 * - Profiles: Average with Sword/Broad, Armor/Light, Armored Gear, Shield/Small
 * 
 * Usage: npx tsx src/lib/mest-tactics/battle-report/run-small-battle.ts
 */

import { buildAssembly, buildProfile, GameSize } from '../mission/assembly-builder';
import { buildMissionSide } from '../mission/MissionSideBuilder';
import { Battlefield } from '../battlefield/Battlefield';
import { getEndGameTriggerTurn } from '../engine/end-game-trigger';
import { TerrainElement } from '../battlefield/terrain/TerrainElement';
import { GameManager } from '../engine/GameManager';
import { CharacterAI } from '../ai/core/CharacterAI';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';
import {
  generateBattleReport,
  type BattleReport,
} from './BattleReport';
import { TacticalDoctrine } from '../ai/stratagems';
import { configureInstrumentation, InstrumentationGrade, getInstrumentationLogger } from '../instrumentation/QSRInstrumentation';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  gameSize: GameSize.VERY_SMALL,
  battlefieldSize: 24,
  maxTurns: 10,
  endGameTriggerTurn: getEndGameTriggerTurn(GameSize.VERY_SMALL),  // VERY_SMALL = Turn 3
  terrainDensity: 0.50, // 50% density
  modelsPerSide: { min: 4, max: 6 },
  bpPerSide: { min: 250, max: 400 },
  sideAName: 'Swordsmen',
  sideBName: 'Shield-Bearers',
  sideADoctrine: TacticalDoctrine.Balanced,
  sideBDoctrine: TacticalDoctrine.Defensive,
  missionId: 'QAI_11',
  techAge: 'Medieval' as const,
  instrumentationGrade: InstrumentationGrade.BY_ACTION_WITH_TESTS,
};

// ============================================================================
// Profile Builder
// ============================================================================

function createMedievalWarriorProfile(name: string): any {
  return buildProfile('Average', {
    technologicalAge: CONFIG.techAge,
    itemNames: [
      'Sword, Broad',
      'Armor, Light',
      'Armored Gear',
      'Shield, Small',
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

async function runBattle() {
  console.log('⚔️  VERY_SMALL AI vs AI BATTLE');
  console.log('═══════════════════════════════════════');
  console.log(`Mission: ${CONFIG.missionId} (Elimination)`);
  console.log(`Game Size: ${CONFIG.gameSize}`);
  console.log(`Battlefield: ${CONFIG.battlefieldSize}×${CONFIG.battlefieldSize} MU`);
  console.log(`Terrain Density: ${Math.round(CONFIG.terrainDensity * 100)}%`);
  console.log(`Tech Age: ${CONFIG.techAge}`);
  console.log(`End-Game Trigger: Turn ${CONFIG.endGameTriggerTurn} (per QSR Line 744)`);
  console.log(`Instrumentation: Grade ${CONFIG.instrumentationGrade}`);
  console.log('═══════════════════════════════════════\n');

  // Configure instrumentation
  configureInstrumentation({
    grade: CONFIG.instrumentationGrade,
    format: 'console',
  });

  const logger = getInstrumentationLogger();
  logger.startBattle(`battle-${CONFIG.missionId}-${Date.now()}`);

  // Create battlefield
  const battlefield = new Battlefield(CONFIG.battlefieldSize, CONFIG.battlefieldSize);
  const terrain = generateTerrain(CONFIG.battlefieldSize, CONFIG.terrainDensity);
  terrain.forEach(t => battlefield.addTerrain(t as any));

  console.log(`✓ Battlefield created with ${terrain.length} terrain elements\n`);

  // Create profiles
  console.log('Building profiles...');
  const profilesA: any[] = [];
  const profilesB: any[] = [];

  const numProfilesA = Math.floor(Math.random() * (CONFIG.modelsPerSide.max - CONFIG.modelsPerSide.min + 1)) + CONFIG.modelsPerSide.min;
  const numProfilesB = numProfilesA;

  for (let i = 0; i < numProfilesA; i++) {
    profilesA.push(createMedievalWarriorProfile(`Swordsman-${i + 1}`));
  }
  for (let i = 0; i < numProfilesB; i++) {
    profilesB.push(createMedievalWarriorProfile(`Shield-Bearer-${i + 1}`));
  }

  console.log(`  Side A: ${profilesA.length} profiles`);
  console.log(`  Side B: ${profilesB.length} profiles\n`);

  // Build assemblies
  const assemblyA = buildAssembly(CONFIG.sideAName, profilesA, {
    gameSize: CONFIG.gameSize,
  });
  const assemblyB = buildAssembly(CONFIG.sideBName, profilesB, {
    gameSize: CONFIG.gameSize,
  });

  console.log(`✓ Assembly A: ${assemblyA.assembly.totalBP} BP, ${assemblyA.assembly.totalCharacters} models`);
  console.log(`✓ Assembly B: ${assemblyB.assembly.totalBP} BP, ${assemblyB.assembly.totalCharacters} models\n`);

  // Build mission sides
  const sideA = buildMissionSide(CONFIG.sideAName, [assemblyA]);
  const sideB = buildMissionSide(CONFIG.sideBName, [assemblyB]);

  // Fix character IDs after buildMissionSide creates new characters
  sideA.members.forEach((member: any, i: number) => {
    member.character.id = `${CONFIG.sideAName}-${i + 1}`;
    member.character.name = `${CONFIG.sideAName}-${i + 1}`;
    member.id = `${CONFIG.sideAName}-${i + 1}`;
  });
  sideB.members.forEach((member: any, i: number) => {
    member.character.id = `${CONFIG.sideBName}-${i + 1}`;
    member.character.name = `${CONFIG.sideBName}-${i + 1}`;
    member.id = `${CONFIG.sideBName}-${i + 1}`;
  });

  // Deploy models from sides
  console.log('Deploying models...');
  sideA.members.forEach((member: any, i: number) => {
    const x = 3 + (i % 3) * 3;
    const y = 3 + Math.floor(i / 3) * 3;
    battlefield.placeCharacter(member.character, { x, y });
  });

  sideB.members.forEach((member: any, i: number) => {
    const x = 3 + (i % 3) * 3;
    const y = CONFIG.battlefieldSize - 4 - Math.floor(i / 3) * 3;
    battlefield.placeCharacter(member.character, { x, y });
  });

  console.log('✓ Models deployed\n');

  // Create game manager with side members' characters
  const allCharacters = [
    ...sideA.members.map((m: any) => m.character),
    ...sideB.members.map((m: any) => m.character),
  ];
  const gameManager = new GameManager(allCharacters, battlefield, CONFIG.endGameTriggerTurn);

  console.log('✓ Game manager initialized\n');

  // Run battle
  console.log('🎮 Starting battle...\n');
  console.log('═══════════════════════════════════════\n');

  let turnCount = 0;

  for (let turn = 1; turn <= CONFIG.maxTurns; turn++) {
    turnCount = turn;
    console.log(`\n━━━ TURN ${turn} ━━━\n`);

    // Simple turn: each character gets one action
    for (const character of allCharacters) {
      if (character.state.isEliminated || character.state.isKOd || character.state.isDistracted) {
        continue;
      }

      const charPos = battlefield.getCharacterPosition(character);
      if (!charPos) continue;

      // Find nearest enemy
      let nearestEnemy: any = null;
      let nearestDist = Infinity;
      
      for (const enemy of allCharacters) {
        if (enemy.id === character.id || enemy.state.isEliminated || enemy.state.isKOd) continue;
        const enemyPos = battlefield.getCharacterPosition(enemy);
        if (!enemyPos) continue;
        
        const dist = Math.sqrt(
          Math.pow(charPos.x - enemyPos.x, 2) +
          Math.pow(charPos.y - enemyPos.y, 2)
        );
        
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }

      if (!nearestEnemy) continue;

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

  // Print summary
  printBattleSummary(battleLog);

  return { battleLog };
}

// ============================================================================
// Summary Printer
// ============================================================================

function printBattleSummary(battleLog: any) {
  console.log('📊 INSTRUMENTATION SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Battle ID: ${battleLog.battleId}`);
  console.log(`Turns: ${battleLog.totalTurns}`);
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
  }
}

// ============================================================================
// Main
// ============================================================================

runBattle().catch(console.error);
