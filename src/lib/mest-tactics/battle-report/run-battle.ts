/**
 * Run a VERY_LARGE AI vs AI game with Battle Report output
 * 
 * Usage: npx tsx src/lib/mest-tactics/battle-report/run-battle.ts
 */

import { buildAssembly, buildProfile, GameSize } from '../mission/assembly-builder';
import { buildMissionSide } from '../mission/MissionSideBuilder';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainElement } from '../battlefield/terrain/TerrainElement';
import { GameManager } from '../engine/GameManager';
import { CharacterAI } from '../ai/core/CharacterAI';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';
import { performTest, TestDice, DiceType } from '../subroutines/dice-roller';
import {
  generateBattleReport,
  createTurnEvent,
  createBattleStatisticsTracker,
  type TurnSummary,
  type BattleReport,
} from './BattleReport';
import { TacticalDoctrine } from '../ai/stratagems';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  gameSize: GameSize.VERY_LARGE,
  battlefieldWidth: 72,
  battlefieldHeight: 48,
  maxTurns: 10,
  endGameTriggerTurn: 10,
  terrainDensity: 0.50, // 50% density
  modelsPerSide: { min: 10, max: 20 },
  bpPerSide: { min: 1000, max: 1250 },
  sideAName: 'Juggernauts',
  sideBName: 'Snipers',
  sideADoctrine: TacticalDoctrine.Juggernaut,
  sideBDoctrine: TacticalDoctrine.Sniper,
};

// ============================================================================
// AI Controller (Simplified for battle report)
// ============================================================================

class SimpleAIController {
  private doctrine: TacticalDoctrine;

  constructor(doctrine: TacticalDoctrine) {
    this.doctrine = doctrine;
  }

  decideAction(
    character: any,
    enemies: any[],
    battlefield: Battlefield,
    gameManager: GameManager
  ): { type: string; target?: any; position?: { x: number; y: number }; reason: string } {
    const status = character.state;
    if (status.isEliminated || status.isKOd || status.isDistracted) {
      return { type: 'none', reason: 'unable to act' };
    }

    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) return { type: 'hold', reason: 'no position' };

    // Find nearest enemy
    let nearestEnemy: any = null;
    let nearestDist = Infinity;
    let nearestEnemyPos: { x: number; y: number } | null = null;

    for (const enemy of enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;
      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const dist = Math.sqrt(
        Math.pow(charPos.x - enemyPos.x, 2) +
        Math.pow(charPos.y - enemyPos.y, 2)
      );

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = enemy;
        nearestEnemyPos = enemyPos;
      }
    }

    if (!nearestEnemy) {
      return { type: 'hold', reason: 'no enemies remaining' };
    }

    const mov = character.finalAttributes?.mov ?? character.attributes?.mov ?? 2;
    const cca = character.finalAttributes?.cca ?? character.attributes?.cca ?? 2;
    const rca = character.finalAttributes?.rca ?? character.attributes?.rca ?? 2;
    
    // QSR Movement: MOV + 2" per AP
    // MOV 2 = 4" per AP, 8" per turn (2 AP)
    const movePerAP = mov + 2;

    // Check engagement (base-to-base contact, approximately 1.5 MU for SIZ 3)
    const engaged = nearestDist <= 1.5;

    if (engaged) {
      const enemyCC = nearestEnemy.finalAttributes?.cca ?? 2;
      if (cca >= enemyCC || this.doctrine === TacticalDoctrine.Juggernaut) {
        return { type: 'close_combat', target: nearestEnemy, reason: 'engaged in combat' };
      } else {
        return { type: 'disengage', target: nearestEnemy, reason: 'outmatched in combat' };
      }
    }

    // Ranged-Centric (Sniper): shoot if in range (Visibility OR = 16, typical weapon OR = 12-24)
    // Effective range is min(Visibility, Weapon OR) = ~16 MU
    if (this.doctrine === TacticalDoctrine.Sniper && rca >= 2 && nearestDist > 1.5 && nearestDist <= 16) {
      return { type: 'ranged_combat', target: nearestEnemy, reason: `ranged attack (${Math.round(nearestDist)} MU)` };
    }

    // Melee-Centric (Juggernaut): charge if in charge range (MOV + 1 MU)
    // Charge includes movement TO the enemy, then close combat
    if (this.doctrine === TacticalDoctrine.Juggernaut && nearestDist <= movePerAP + 1 && cca >= 2) {
      return { type: 'charge', target: nearestEnemy, reason: `charging (${Math.round(nearestDist)} MU)` };
    }

    // Move towards enemy (both doctrines)
    if (nearestDist > 1.5) {
      const dx = nearestEnemyPos!.x - charPos.x;
      const dy = nearestEnemyPos!.y - charPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Move full MOV + 2" towards enemy (QSR movement allowance)
      const moveDist = movePerAP;
      const ratio = moveDist / dist;
      const newX = Math.round(charPos.x + dx * ratio);
      const newY = Math.round(charPos.y + dy * ratio);
      
      // Ensure we actually move
      if (newX !== charPos.x || newY !== charPos.y) {
        return {
          type: 'move',
          position: { x: newX, y: newY },
          reason: `advancing towards ${nearestEnemy.name} (${Math.round(nearestDist)} MU, moving ${moveDist} MU)`,
        };
      }
    }

    return { type: 'hold', reason: 'in position' };
  }
}

// ============================================================================
// Battle Runner
// ============================================================================

class BattleRunner {
  private logEntries: string[] = [];
  private turnSummaries: TurnSummary[] = [];
  private stats = createBattleStatisticsTracker();

  log(message: string) {
    this.logEntries.push(message);
    console.log(message);
  }

  createAssembly(name: string, count: number, archetypeName: string): any {
    const profiles = [];
    for (let i = 0; i < count; i++) {
      const profile = buildProfile(archetypeName, [], {
        name: `${name}-${i + 1}`,
      });
      profiles.push(profile);
    }
    const roster = buildAssembly(name, profiles);
    
    // buildAssembly returns AssemblyRoster { assembly, characters, profiles }
    // Ensure unique character IDs
    if (roster.characters) {
      roster.characters.forEach((char: any, i: number) => {
        char.id = `${name}-${i + 1}`;
        char.name = `${name}-${i + 1}`;
      });
    }
    
    return roster;
  }

  createBattlefield(width: number, height: number, density: number): Battlefield {
    const battlefield = new Battlefield(width, height);

    // Add terrain based on density
    const terrainTypes = ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks'];
    const terrainCount = Math.floor(Math.max(width, height) * density);

    for (let i = 0; i < terrainCount; i++) {
      const terrainName = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
      const x = Math.floor(4 + Math.random() * (width - 8));
      const y = Math.floor(4 + Math.random() * (height - 8));
      const rotation = Math.floor(Math.random() * 360);
      battlefield.addTerrainElement(new TerrainElement(terrainName, { x, y }, rotation));
    }

    return battlefield;
  }

  deployModels(roster: any, battlefield: Battlefield, sideIndex: number, size: number) {
    const edgeMargin = 2;
    const assemblyName = roster.assembly?.name || 'Unknown';
    const characters = roster.characters || [];
    this.log(`   Deploying ${assemblyName} (sideIndex=${sideIndex}, ${characters.length} models):`);
    characters.forEach((char: any, i: number) => {
      let x, y;
      if (sideIndex === 0) {
        x = edgeMargin + (i % 6) * 4;
        y = edgeMargin + Math.floor(i / 6) * 4;
      } else {
        x = edgeMargin + (i % 6) * 4;
        y = size - edgeMargin - 1 - Math.floor(i / 6) * 4;
      }
      x = Math.max(0, Math.min(size - 1, x));
      y = Math.max(0, Math.min(size - 1, y));
      battlefield.placeCharacter(char, { x, y });
      if (i < 3) {
        this.log(`      ${char.name} -> (${x}, ${y})`);
      }
    });
  }

  async resolveCharacterTurn(
    character: any,
    enemies: any[],
    battlefield: Battlefield,
    gameManager: GameManager,
    ai: SimpleAIController,
    turn: number,
    sideNum: number
  ) {
    const decision = ai.decideAction(character, enemies, battlefield, gameManager);

    if (decision.type === 'none') return;

    // Debug logging for first turn
    if (turn === 1 && character.id.includes('1')) {
      const charPos = battlefield.getCharacterPosition(character);
      console.log(`   [DEBUG] ${character.name} at (${charPos?.x},${charPos?.y}), decision: ${decision.type} - ${decision.reason}`);
    }

    // Record action (charge counts as both move and attack)
    if (decision.type === 'charge') {
      this.stats.recordAction('move');
      this.stats.recordAction('close_combat');
    } else {
      this.stats.recordAction(decision.type as any);
    }

    const sideName = sideNum === 1 ? CONFIG.sideAName : CONFIG.sideBName;
    const modelName = character.name || character.id || 'Unknown';

    gameManager.beginActivation(character);

    try {
      switch (decision.type) {
        case 'move':
        case 'charge':
          if (decision.position) {
            const oldPos = battlefield.getCharacterPosition(character);
            if (oldPos) {
              battlefield.moveCharacter(character, decision.position);
            } else {
              battlefield.placeCharacter(character, decision.position);
            }
            
            // If charge, also perform close combat at end of movement
            if (decision.type === 'charge' && decision.target) {
              await this.executeCloseCombat(character, decision.target, battlefield, gameManager);
            }
          }
          break;

        case 'close_combat':
          if (decision.target) {
            await this.executeCloseCombat(character, decision.target, battlefield, gameManager);
          }
          break;

        case 'ranged_combat':
          if (decision.target) {
            await this.executeRangedCombat(character, decision.target, battlefield, gameManager);
          }
          break;

        case 'disengage':
          if (decision.target) {
            await this.executeDisengage(character, decision.target, battlefield, gameManager);
          }
          break;
      }
    } catch (error) {
      // Ignore errors in simulation
    }

    gameManager.endActivation(character);
  }

  async executeCloseCombat(attacker: any, defender: any, battlefield: Battlefield, gameManager: GameManager) {
    // QSR Opposed Test: Attacker (2 Base + CCA) vs Defender (2 Base + CCA)
    // Active player (attacker) wins ties
    const attackerCCA = attacker.finalAttributes?.cca ?? 2;
    const defenderCCA = defender.finalAttributes?.cca ?? 2;
    const attackerSTR = attacker.finalAttributes?.str ?? 2;
    const defenderFOR = defender.finalAttributes?.for ?? 2;

    const attackerDice: TestDice = { base: 2, modifier: 0, wild: 0 };
    const defenderDice: TestDice = { base: 2, modifier: 0, wild: 0 };

    const attackerRolls = Array.from({ length: attackerDice.base! }, () => Math.floor(Math.random() * 6) + 1);
    const defenderRolls = Array.from({ length: defenderDice.base! }, () => Math.floor(Math.random() * 6) + 1);

    const attackerResult = performTest(attackerDice, attackerCCA, attackerRolls);
    const defenderResult = performTest(defenderDice, defenderCCA, defenderRolls);

    // QSR: Attacker wins ties (Active player)
    const hit = attackerResult.score >= defenderResult.score;

    if (hit) {
      // Damage Test: Attacker (2 Base + STR) vs Defender (2 Base + FOR)
      const attackerDamageDice: TestDice = { base: 2, modifier: 0, wild: 0 };
      const defenderArmorDice: TestDice = { base: 2, modifier: 0, wild: 0 };

      const damageRolls = Array.from({ length: attackerDamageDice.base! }, () => Math.floor(Math.random() * 6) + 1);
      const armorRolls = Array.from({ length: defenderArmorDice.base! }, () => Math.floor(Math.random() * 6) + 1);

      const damageResult = performTest(attackerDamageDice, attackerSTR, damageRolls);
      const armorResult = performTest(defenderArmorDice, defenderFOR, armorRolls);

      // QSR: Damage succeeds if attacker score > defender score
      if (damageResult.score > armorResult.score) {
        this.stats.recordWound();
        const wounds = defender.state.wounds || 0;
        const siz = defender.finalAttributes?.siz ?? 3;

        defender.state.wounds = wounds + 1;

        if (defender.state.wounds >= siz && !defender.state.isKOd) {
          defender.state.isKOd = true;
          this.stats.recordKO(defender.id.includes(CONFIG.sideAName) ? CONFIG.sideAName : CONFIG.sideBName);
          this.log(`      💥 ${defender.name} is KO'd! (${defender.state.wounds}/${siz} wounds)`);
        } else if (defender.state.wounds >= siz + 3) {
          defender.state.isEliminated = true;
          this.stats.recordElimination(defender.id.includes(CONFIG.sideAName) ? CONFIG.sideAName : CONFIG.sideBName, false);
          this.log(`      ☠️ ${defender.name} is Eliminated! (${defender.state.wounds}/${siz + 3} wounds)`);
        }
      }
    }
  }

  async executeRangedCombat(attacker: any, defender: any, battlefield: Battlefield, gameManager: GameManager) {
    // QSR Opposed Test: Attacker RCA (2 Base + RCA) vs Defender REF (2 Base + REF)
    const attackerRCA = attacker.finalAttributes?.rca ?? 2;
    const defenderREF = defender.finalAttributes?.ref ?? 2;

    const attackerDice: TestDice = { base: 2, modifier: 0, wild: 0 };
    const defenderDice: TestDice = { base: 2, modifier: 0, wild: 0 };

    const attackerRolls = Array.from({ length: attackerDice.base! }, () => Math.floor(Math.random() * 6) + 1);
    const defenderRolls = Array.from({ length: defenderDice.base! }, () => Math.floor(Math.random() * 6) + 1);

    const attackerResult = performTest(attackerDice, attackerRCA, attackerRolls);
    const defenderResult = performTest(defenderDice, defenderREF, defenderRolls);

    // QSR: Attacker wins ties (Active player)
    const hit = attackerResult.score >= defenderResult.score;

    if (hit) {
      // Damage Test: Attacker (2 Base + STR) vs Defender (2 Base + FOR)
      const attackerSTR = attacker.finalAttributes?.str ?? 2;
      const defenderFOR = defender.finalAttributes?.for ?? 2;

      const damageDice: TestDice = { base: 2, modifier: 0, wild: 0 };
      const armorDice: TestDice = { base: 2, modifier: 0, wild: 0 };

      const damageRolls = Array.from({ length: damageDice.base! }, () => Math.floor(Math.random() * 6) + 1);
      const armorRolls = Array.from({ length: armorDice.base! }, () => Math.floor(Math.random() * 6) + 1);

      const damageResult = performTest(damageDice, attackerSTR, damageRolls);
      const armorResult = performTest(armorDice, defenderFOR, armorRolls);

      // QSR: Damage succeeds if attacker score > defender score
      if (damageResult.score > armorResult.score) {
        this.stats.recordWound();
        const wounds = defender.state.wounds || 0;
        const siz = defender.finalAttributes?.siz ?? 3;

        defender.state.wounds = wounds + 1;

        if (defender.state.wounds >= siz && !defender.state.isKOd) {
          defender.state.isKOd = true;
          this.stats.recordKO(defender.id.includes(CONFIG.sideAName) ? CONFIG.sideAName : CONFIG.sideBName);
          this.log(`      💥 ${defender.name} is KO'd! (${defender.state.wounds}/${siz} wounds)`);
        } else if (defender.state.wounds >= siz + 3) {
          defender.state.isEliminated = true;
          this.stats.recordElimination(defender.id.includes(CONFIG.sideAName) ? CONFIG.sideAName : CONFIG.sideBName, false);
          this.log(`      ☠️ ${defender.name} is Eliminated! (${defender.state.wounds}/${siz + 3} wounds)`);
        }
      }
    }
  }

  async executeDisengage(disengager: any, defender: any, battlefield: Battlefield, gameManager: GameManager) {
    const disengagerPos = battlefield.getCharacterPosition(disengager);
    const defenderPos = battlefield.getCharacterPosition(defender);

    if (disengagerPos && defenderPos) {
      const dx = disengagerPos.x - defenderPos.x;
      const dy = disengagerPos.y - defenderPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const ratio = 2 / dist;
        const newPos = {
          x: Math.round(disengagerPos.x + dx * ratio),
          y: Math.round(disengagerPos.y + dy * ratio),
        };
        battlefield.moveCharacter(disengager, newPos);
      }
    }
  }

  async runGame(): Promise<BattleReport> {
    this.log('\n' + '='.repeat(80));
    this.log('⚔️  VERY_LARGE AI vs AI BATTLE REPORT');
    this.log('='.repeat(80));
    this.log(`\n📋 Configuration:`);
    this.log(`   Game Size: ${CONFIG.gameSize}`);
    this.log(`   Battlefield: ${CONFIG.battlefieldWidth}×${CONFIG.battlefieldHeight} MU`);
    this.log(`   Terrain Density: ${Math.round(CONFIG.terrainDensity * 100)}%`);
    this.log(`   Max Turns: ${CONFIG.maxTurns}`);
    this.log(`   Mission: QAI_11 - Elimination`);
    this.log(`\n🎯 Tactical Doctrines:`);
    this.log(`   ${CONFIG.sideAName}: ${CONFIG.sideADoctrine} (Melee-Centric, Aggressive)`);
    this.log(`   ${CONFIG.sideBName}: ${CONFIG.sideBDoctrine} (Ranged-Centric, Defensive)`);

    // Create assemblies
    const modelCount = 15; // Middle of 10-20 range
    const sideAAssembly = this.createAssembly(CONFIG.sideAName, modelCount, 'Veteran');
    const sideBAssembly = this.createAssembly(CONFIG.sideBName, modelCount, 'Veteran');

    this.log(`\n📦 Assemblies:`);
    this.log(`   ${CONFIG.sideAName}: ${sideAAssembly.totalCharacters} models, ${sideAAssembly.totalBP} BP`);
    this.log(`   ${CONFIG.sideBName}: ${sideBAssembly.totalCharacters} models, ${sideBAssembly.totalBP} BP`);

    // Create sides
    const sideA = buildMissionSide(CONFIG.sideAName, [sideAAssembly]);
    const sideB = buildMissionSide(CONFIG.sideBName, [sideBAssembly]);
    
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

    // Create battlefield
    const battlefield = this.createBattlefield(CONFIG.battlefieldWidth, CONFIG.battlefieldHeight, CONFIG.terrainDensity);

    // Deploy models from sides (not assemblies)
    this.log(`\n📦 Deploying Sides:`);
    sideA.members.forEach((member: any, i: number) => {
      const x = 2 + (i % 6) * 4;
      const y = 2 + Math.floor(i / 6) * 4;
      battlefield.placeCharacter(member.character, { x, y });
      if (i < 3) this.log(`   ${member.character.name} -> (${x}, ${y})`);
    });
    sideB.members.forEach((member: any, i: number) => {
      const x = 2 + (i % 6) * 4;
      const y = CONFIG.battlefieldHeight - 3 - Math.floor(i / 6) * 4;
      battlefield.placeCharacter(member.character, { x, y });
      if (i < 3) this.log(`   ${member.character.name} -> (${x}, ${y})`);
    });

    this.log(`\n🗺️  Battlefield:`);
    this.log(`   Terrain elements: ${battlefield.terrain.length}`);
    this.log(`   Deployment complete.\n`);

    // Create game manager with side members' characters
    const allCharacters = [...sideA.members.map((m: any) => m.character), ...sideB.members.map((m: any) => m.character)];
    const gameManager = new GameManager(allCharacters, battlefield, CONFIG.endGameTriggerTurn);

    // Create AI controllers
    const aiA = new SimpleAIController(CONFIG.sideADoctrine);
    const aiB = new SimpleAIController(CONFIG.sideBDoctrine);

    // Run turns
    this.log('─'.repeat(80));
    this.log('\n📍 BATTLE LOG\n');
    this.log('─'.repeat(80));

    for (let turn = 1; turn <= CONFIG.maxTurns; turn++) {
      this.stats.updateTurn(turn, 1);

      this.log(`\n📍 Turn ${turn}\n`);

      const turnEvents: TurnSummary['events'] = [];
      const initiativePointsAwarded: { sideId: string; points: number }[] = [];

      // Roll initiative (simplified)
      const initiativeWinner = Math.random() > 0.5 ? sideA : sideB;
      const ipWinner = Math.floor(Math.random() * 3) + 1;
      const ipLoser = Math.floor(Math.random() * 2);
      initiativePointsAwarded.push({ sideId: initiativeWinner.id, points: ipWinner });
      initiativePointsAwarded.push({ sideId: initiativeWinner === sideA ? sideB.id : sideA.id, points: ipLoser });

      this.log(`   Initiative: ${initiativeWinner.id} wins (+${ipWinner} IP)`);

      // Process activations from side members
      const activationOrder = allCharacters.sort(() => Math.random() - 0.5);

      for (const character of activationOrder) {
        if (character.state.isEliminated || character.state.isKOd) continue;

        const sideNum = sideA.members.some((m: any) => m.character === character) ? 1 : 2;
        const enemies = sideNum === 1 ? sideB.members.map((m: any) => m.character) : sideA.members.map((m: any) => m.character);
        const ai = sideNum === 1 ? aiA : aiB;

        const oldWounds = character.state.wounds;

        await this.resolveCharacterTurn(character, enemies, battlefield, gameManager, ai, turn, sideNum);

        // Check for KO/elimination from wounds
        if (character.state.wounds > oldWounds) {
          // Character took damage
        }
        if (character.state.isKOd && !character.state.isEliminated) {
          turnEvents.push(createTurnEvent('model_ko', `${character.name} is KO'd`, turn, 1, {
            sideId: sideNum === 1 ? CONFIG.sideAName : CONFIG.sideBName,
            characterId: character.id,
          }));
        }
      }

      // Check for end game
      const aRemaining = sideA.members.filter((m: any) => !m.character.state.isEliminated && !m.character.state.isKOd).length;
      const bRemaining = sideB.members.filter((m: any) => !m.character.state.isEliminated && !m.character.state.isKOd).length;

      if (aRemaining === 0 || bRemaining === 0) {
        this.log(`\n🏆 Game Over - All models eliminated on one side!\n`);
        turnEvents.push(createTurnEvent('model_eliminated', 'All models eliminated', turn, 1));
        break;
      }

      // End game die roll from turn 10
      if (turn >= CONFIG.endGameTriggerTurn) {
        const endGameRoll = Math.floor(Math.random() * 6) + 1;
        this.stats.recordEndGameDie();
        if (endGameRoll <= 3) {
          this.log(`\n🎲 End game die roll: ${endGameRoll} - Game Over!\n`);
          turnEvents.push(createTurnEvent('end_game_die', `End game die rolled: ${endGameRoll} - Game Over!`, turn, 1, {
            data: { roll: endGameRoll },
          }));
          break;
        } else {
          this.log(`\n🎲 End game die roll: ${endGameRoll} - Game continues\n`);
        }
      }

      // Store turn summary
      this.turnSummaries.push({
        turn,
        round: 1,
        initiativeWinner: initiativeWinner.id,
        initiativePointsAwarded,
        events: turnEvents,
        endOfTurnState: {
          modelsRemaining: [
            { sideId: CONFIG.sideAName, count: aRemaining },
            { sideId: CONFIG.sideBName, count: bRemaining },
          ],
          bottleTestPerformed: false,
          bottleTestFailed: [],
        },
      });

      this.log(`   End of Turn ${turn}: ${CONFIG.sideAName}=${aRemaining}, ${CONFIG.sideBName}=${bRemaining}`);
    }

    // Generate battle report
    const aRemaining = sideA.members.filter((m: any) => !m.character.state.isEliminated && !m.character.state.isKOd).length;
    const bRemaining = sideB.members.filter((m: any) => !m.character.state.isEliminated && !m.character.state.isKOd).length;

    const statistics = this.stats.getStatistics();

    const configuration = {
      gameSize: CONFIG.gameSize,
      battlefield: {
        width: CONFIG.battlefieldWidth,
        height: CONFIG.battlefieldHeight,
        terrainCount: battlefield.terrain.length,
      },
      maxTurns: CONFIG.maxTurns,
      endGameTriggerTurn: CONFIG.endGameTriggerTurn,
      endGameDieRolled: true,
      endGameDieResult: Math.floor(Math.random() * 6) + 1,
    };

    const missionState = {
      missionId: 'QAI_11',
      missionName: 'Elimination',
      turn: this.turnSummaries.length,
      round: 1,
      ended: true,
      endReason: aRemaining === 0 || bRemaining === 0 ? 'All models eliminated' : 'End game die roll',
      sides: [],
      customState: {},
    };

    const scoreResult = {
      winner: aRemaining > bRemaining ? CONFIG.sideAName : CONFIG.sideBName,
      keysToVictory: [
        { key: 'Elimination', vpAwarded: aRemaining > bRemaining ? 1 : 0, sideId: aRemaining > bRemaining ? CONFIG.sideAName : CONFIG.sideBName, turn: this.turnSummaries.length },
      ],
      sideScores: [],
    };

    const report = generateBattleReport(
      [sideA, sideB],
      missionState as any,
      scoreResult as any,
      this.turnSummaries,
      statistics,
      configuration
    );

    return report;
  }

  printHumanReadableReport(report: BattleReport) {
    this.log('\n' + '='.repeat(80));
    this.log('📊 BATTLE REPORT SUMMARY');
    this.log('='.repeat(80));

    this.log(`\n📅 Battle ID: ${report.metadata.battleId}`);
    this.log(`⏰ Generated: ${new Date(report.metadata.generatedAt).toLocaleString()}`);

    this.log(`\n🎮 Game Configuration:`);
    this.log(`   Game Size: ${report.configuration.gameSize}`);
    this.log(`   Battlefield: ${report.configuration.battlefield.width}×${report.configuration.battlefield.height} MU`);
    this.log(`   Terrain: ${report.configuration.battlefield.terrainCount} elements`);
    this.log(`   Turns Played: ${report.statistics.totalTurns}`);
    this.log(`   Mission: ${report.mission.missionName} (${report.mission.missionId})`);

    this.log(`\n⚔️  Participating Sides:`);
    for (const side of report.sides) {
      this.log(`\n   ${side.name}:`);
      this.log(`      Models: ${side.totalModels}`);
      this.log(`      Total BP: ${side.totalBP}`);
      this.log(`      Tactical Doctrine: ${side.tacticalDoctrine || 'N/A'}`);
      this.log(`      Victory Points: ${side.victoryPoints}`);
      this.log(`      Models Remaining: ${report.outcome.vpStandings.find(s => s.sideId === side.id)?.rank === 1 ? 'Victorious!' : 'Defeated'}`);
    }

    this.log(`\n📈 Battle Statistics:`);
    this.log(`   Total Actions: ${report.statistics.totalActions}`);
    this.log(`   Moves: ${report.statistics.totalMoves}`);
    this.log(`   Attacks: ${report.statistics.totalAttacks}`);
    this.log(`   Close Combats: ${report.statistics.totalCloseCombats}`);
    this.log(`   Ranged Combats: ${report.statistics.totalRangedCombats}`);
    this.log(`   Wounds Generated: ${report.statistics.totalWoundsGenerated}`);

    this.log(`\n💀 Casualties:`);
    for (const ko of report.statistics.modelsKOd) {
      this.log(`   ${ko.sideId}: ${ko.count} models KO'd`);
    }
    for (const elim of report.statistics.modelsEliminatedByWounds) {
      this.log(`   ${elim.sideId}: ${elim.count} models Eliminated (by wounds)`);
    }
    for (const elim of report.statistics.modelsEliminatedByFear) {
      this.log(`   ${elim.sideId}: ${elim.count} models Eliminated (by Fear)`);
    }

    this.log(`\n🎲 Special Events:`);
    this.log(`   Bottle Tests: ${report.statistics.bottleTestsPerformed} performed, ${report.statistics.bottleTestsFailed} failed`);
    this.log(`   End Game Die Rolls: ${report.statistics.endGameDieRolls}`);

    this.log(`\n🏆 Outcome:`);
    this.log(`   Winner: ${report.outcome.winnerName || 'Draw'}`);
    this.log(`   Victory Margin: ${report.outcome.victoryMargin} VP`);
    this.log(`   End Reason: ${report.outcome.endReason}`);

    this.log(`\n📋 VP Standings:`);
    for (const standing of report.outcome.vpStandings) {
      const medal = standing.rank === 1 ? '🥇' : standing.rank === 2 ? '🥈' : '🥉';
      this.log(`   ${medal} ${standing.rank}. ${standing.sideName}: ${standing.vp} VP`);
    }

    this.log(`\n📜 Turn-by-Turn Summary:`);
    for (const turn of report.turnSummary) {
      this.log(`\n   Turn ${turn.turn}:`);
      this.log(`      Initiative: ${turn.initiativeWinner}`);
      if (turn.events.length > 0) {
        this.log(`      Events:`);
        for (const event of turn.events) {
          this.log(`         • ${event.description}`);
        }
      }
      this.log(`      Models Remaining: ${turn.endOfTurnState.modelsRemaining.map(m => `${m.sideId}=${m.count}`).join(', ')}`);
    }

    this.log('\n' + '='.repeat(80));
    this.log('📄 Full JSON report available for UI rendering');
    this.log('='.repeat(80) + '\n');
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const runner = new BattleRunner();

  try {
    const report = await runner.runGame();
    runner.printHumanReadableReport(report);

    // Output JSON for programmatic use
    console.log('\n📄 JSON Report:\n');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Battle simulation failed:', error);
    process.exit(1);
  }
}

main();
