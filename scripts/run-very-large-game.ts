/**
 * Standalone VERY_LARGE Game Simulation Runner
 * 
 * Run with: npx tsx scripts/run-very-large-game.ts
 */

import { buildAssembly, buildProfile } from '../src/lib/mest-tactics/mission/assembly-builder';
import { buildMissionSide } from '../src/lib/mest-tactics/mission/MissionSideBuilder';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { GameManager } from '../src/lib/mest-tactics/engine/GameManager';
import { getBaseDiameterFromSiz } from '../src/lib/mest-tactics/battlefield/spatial/size-utils';
import { SpatialRules } from '../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { performTest, TestDice, DiceType } from '../src/lib/mest-tactics/subroutines/dice-roller';
import { resolveHitTest, HitTestContext } from '../src/lib/mest-tactics/subroutines/hit-test';
import { resolveDamageTest, DamageTestContext } from '../src/lib/mest-tactics/subroutines/damage';

// VERY_LARGE game configuration
const VERY_LARGE_CONFIG = {
  name: 'Very Large',
  modelsPerSide: [10, 20],
  bpPerSide: [1000, 1250],
  battlefieldWidth: 72,
  battlefieldHeight: 48,
  maxTurns: 10,
  endGameTurn: 10,
};

interface GameLogEntry {
  turn: number;
  round: number;
  side: string;
  model: string;
  action: string;
  detail?: string;
}

interface GameStats {
  totalActions: number;
  moves: number;
  attacks: number;
  closeCombats: number;
  rangedCombats: number;
  disengages: number;
  eliminations: number;
  kos: number;
}

class AIController {
  private aggression: number;
  private caution: number;

  constructor(aggression: number = 0.5, caution: number = 0.5) {
    this.aggression = aggression;
    this.caution = caution;
  }

  findTargets(character: any, enemies: any[], battlefield: Battlefield): Array<{ enemy: any; dist: number; hasLOS: boolean }> {
    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) return [];

    const targets: Array<{ enemy: any; dist: number; hasLOS: boolean }> = [];

    for (const enemy of enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;

      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const dist = Math.sqrt(
        Math.pow(charPos.x - enemyPos.x, 2) +
        Math.pow(charPos.y - enemyPos.y, 2)
      );

      const charModel = {
        id: character.id,
        position: charPos,
        baseDiameter: getBaseDiameterFromSiz(character.finalAttributes?.siz ?? character.attributes?.siz ?? 3),
        siz: character.finalAttributes?.siz ?? character.attributes?.siz ?? 3,
      };
      const enemyModel = {
        id: enemy.id,
        position: enemyPos,
        baseDiameter: getBaseDiameterFromSiz(enemy.finalAttributes?.siz ?? enemy.attributes?.siz ?? 3),
        siz: enemy.finalAttributes?.siz ?? enemy.attributes?.siz ?? 3,
      };

      const hasLOS = SpatialRules.hasLineOfSight(battlefield, charModel, enemyModel);
      targets.push({ enemy, dist, hasLOS });
    }

    return targets.sort((a, b) => a.dist - b.dist);
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

    const targets = this.findTargets(character, enemies, battlefield);
    if (targets.length === 0) {
      return { type: 'hold', reason: 'no enemies remaining' };
    }

    const closest = targets[0];
    const mov = character.finalAttributes?.mov ?? character.attributes?.mov ?? 2;
    const cca = character.finalAttributes?.cca ?? character.attributes?.cca ?? 2;
    const rca = character.finalAttributes?.rca ?? character.attributes?.rca ?? 2;

    // Check engagement
    const engaged = battlefield.isEngaged?.(character) ?? false;

    if (engaged) {
      // In close combat - decide to fight or disengage
      const enemyCC = closest.enemy.finalAttributes?.cca ?? closest.enemy.attributes?.cca ?? 2;

      if (cca >= enemyCC || this.aggression > 0.6) {
        return { type: 'close_combat', target: closest.enemy, reason: 'engaged in combat' };
      } else {
        return { type: 'disengage', target: closest.enemy, reason: 'outmatched in combat' };
      }
    }

    // Check if we can charge
    if (closest.dist <= mov + 1 && cca >= 2 && this.aggression > 0.4) {
      return { type: 'charge', target: closest.enemy, reason: `charging (${Math.round(closest.dist)} MU)` };
    }

    // Ranged combat if we have good RCA and target is visible
    if (rca >= 3 && closest.hasLOS && closest.dist > 1 && closest.dist <= 16) {
      return { type: 'ranged_combat', target: closest.enemy, reason: `ranged attack (${Math.round(closest.dist)} MU)` };
    }

    // Always move towards nearest enemy if not engaged
    const charPos = battlefield.getCharacterPosition(character);
    const targetPos = battlefield.getCharacterPosition(closest.enemy);
    if (charPos && targetPos) {
      const dx = targetPos.x - charPos.x;
      const dy = targetPos.y - charPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        const moveDist = Math.min(mov, dist - 1);
        const ratio = moveDist / dist;
        return {
          type: 'move',
          position: {
            x: Math.round(charPos.x + dx * ratio),
            y: Math.round(charPos.y + dy * ratio),
          },
          reason: `advancing towards ${closest.enemy.name || 'enemy'} (${Math.round(closest.dist)} MU)`,
        };
      }
    }

    return { type: 'hold', reason: 'in position' };
  }
}

class VeryLargeGameRunner {
  private log: GameLogEntry[] = [];
  private stats: GameStats = {
    totalActions: 0,
    moves: 0,
    attacks: 0,
    closeCombats: 0,
    rangedCombats: 0,
    disengages: 0,
    eliminations: 0,
    kos: 0,
  };

  async runGame(): Promise<{ winner: string; log: GameLogEntry[]; stats: GameStats }> {
    console.log(`\n⚔️  Starting ${VERY_LARGE_CONFIG.name} Game\n`);
    console.log(`Battlefield: ${VERY_LARGE_CONFIG.battlefieldWidth}×${VERY_LARGE_CONFIG.battlefieldHeight} MU`);
    console.log(`Max Turns: ${VERY_LARGE_CONFIG.maxTurns}`);
    console.log(`Models per Side: ${VERY_LARGE_CONFIG.modelsPerSide[0]} to ${VERY_LARGE_CONFIG.modelsPerSide[1]}`);
    console.log(`BP per Side: ${VERY_LARGE_CONFIG.bpPerSide[0]} to ${VERY_LARGE_CONFIG.bpPerSide[1]}\n`);

    // Build assemblies
    const sideA = this.createAssembly('Alpha', VERY_LARGE_CONFIG);
    const sideB = this.createAssembly('Bravo', VERY_LARGE_CONFIG);

    console.log(`Alpha: ${sideA.characters.length} models, ${sideA.totalBP} BP`);
    console.log(`Bravo: ${sideB.characters.length} models, ${sideB.totalBP} BP\n`);

    // Create battlefield with densityRatio 100
    const battlefield = this.createBattlefield(VERY_LARGE_CONFIG.battlefieldWidth, VERY_LARGE_CONFIG.battlefieldHeight, 100);

    // Deploy models
    this.deployModels(sideA, battlefield, 0, VERY_LARGE_CONFIG.battlefieldWidth, VERY_LARGE_CONFIG.battlefieldHeight);
    this.deployModels(sideB, battlefield, 1, VERY_LARGE_CONFIG.battlefieldWidth, VERY_LARGE_CONFIG.battlefieldHeight);

    console.log('Models deployed.\n');
    console.log('─'.repeat(80) + '\n');

    // Create game manager with end-game trigger at turn 10
    const allCharacters = [...sideA.characters, ...sideB.characters];
    const gameManager = new GameManager(allCharacters, battlefield, 10);

    // Create AI controllers
    const aiA = new AIController(0.6, 0.4); // More aggressive
    const aiB = new AIController(0.5, 0.5); // Balanced

    // Run game loop
    let gameOver = false;
    let turn = 0;

    while (!gameOver && turn < VERY_LARGE_CONFIG.maxTurns) {
      turn++;

      console.log(`\n📍 Turn ${turn}\n`);

      // Check for end-game trigger at end of previous turn
      if (turn > 1) {
        const endGameResult = gameManager.checkEndGameTrigger();
        if (endGameResult.gameEnded) {
          console.log(`\n🎲 End game die roll - Game Over! (rolled: ${endGameResult.rollResults.join(', ')})\n`);
          gameOver = true;
          break;
        }
      }

      // Alternate activations (simplified - all Side A, then all Side B)
      for (const character of sideA.characters) {
        if (!character.state.isEliminated && !character.state.isKOd) {
          await this.resolveCharacterTurn(character, sideB.characters, battlefield, gameManager, aiA, turn, 1);
        }
      }

      for (const character of sideB.characters) {
        if (!character.state.isEliminated && !character.state.isKOd) {
          await this.resolveCharacterTurn(character, sideA.characters, battlefield, gameManager, aiB, turn, 2);
        }
      }

      // Check victory conditions
      const aRemaining = sideA.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length;
      const bRemaining = sideB.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length;

      if (aRemaining === 0 || bRemaining === 0) {
        gameOver = true;
        console.log(`\n🏆 Game Over - All models eliminated on one side!\n`);
      } else if (turn >= VERY_LARGE_CONFIG.endGameTurn) {
        // End game die roll (50% chance each turn after threshold)
        if (Math.random() < 0.5) {
          gameOver = true;
          console.log(`\n🎲 End game die roll - Game Over!\n`);
        }
      }

      // Print turn summary
      console.log(`  Alpha: ${aRemaining}/${sideA.characters.length} models`);
      console.log(`  Bravo: ${bRemaining}/${sideB.characters.length} models`);
    }

    // Final results
    const aRemaining = sideA.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length;
    const bRemaining = sideB.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length;

    let winner = 'Draw';
    if (aRemaining > bRemaining) winner = 'Alpha';
    else if (bRemaining > aRemaining) winner = 'Bravo';

    console.log('\n' + '─'.repeat(80));
    console.log('\n📊 Final Results:\n');
    console.log(`Alpha: ${aRemaining}/${sideA.characters.length} models`);
    console.log(`Bravo: ${bRemaining}/${sideB.characters.length} models`);
    console.log(`\n🏆 Winner: ${winner}!\n`);
    console.log('📈 Statistics:');
    console.log(`  Total Actions: ${this.stats.totalActions}`);
    console.log(`  Moves: ${this.stats.moves}`);
    console.log(`  Attacks: ${this.stats.attacks}`);
    console.log(`  Close Combats: ${this.stats.closeCombats}`);
    console.log(`  Ranged Combats: ${this.stats.rangedCombats}`);
    console.log(`  Disengages: ${this.stats.disengages}`);
    console.log(`  Eliminations: ${this.stats.eliminations}`);
    console.log(`  KO's: ${this.stats.kos}\n`);

    return { winner, log: this.log, stats: this.stats };
  }

  private createAssembly(name: string, config: typeof VERY_LARGE_CONFIG): any {
    const targetModels = Math.floor(
      config.modelsPerSide[0] +
      Math.random() * (config.modelsPerSide[1] - config.modelsPerSide[0])
    );

    const compositions = [
      { archetypeName: 'Average', weight: 5 },
      { archetypeName: 'Militia', weight: 4 },
      { archetypeName: 'Veteran', weight: 2 },
      { archetypeName: 'Elite', weight: 1 },
    ];

    const profiles = [];
    for (let i = 0; i < targetModels; i++) {
      const totalWeight = compositions.reduce((sum, c) => sum + c.weight, 0);
      let random = Math.random() * totalWeight;
      let selected = compositions[0];
      for (const comp of compositions) {
        random -= comp.weight;
        if (random <= 0) { selected = comp; break; }
      }

      const profile = buildProfile(selected.archetypeName, [], {
        name: `${name}-${i+1}`,
      });
      profiles.push(profile);
    }

    return buildAssembly(name, profiles);
  }

  private createBattlefield(width: number, height: number, densityRatio: number): Battlefield {
    const battlefield = new Battlefield(width, height);

    // Add terrain (20% coverage * densityRatio/100)
    const terrainTypes = ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks'];
    const terrainCount = Math.floor(Math.max(width, height) * 0.2 * (densityRatio / 100));

    for (let i = 0; i < terrainCount; i++) {
      const terrainName = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
      const x = Math.floor(4 + Math.random() * (width - 8));
      const y = Math.floor(4 + Math.random() * (height - 8));
      const rotation = Math.floor(Math.random() * 360);

      battlefield.addTerrainElement(new TerrainElement(terrainName, { x, y }, rotation));
    }

    return battlefield;
  }

  private deployModels(assembly: any, battlefield: Battlefield, sideIndex: number, width: number, height: number) {
    const edgeMargin = 2;
    const modelsPerRow = 8;
    
    assembly.characters.forEach((char: any, i: number) => {
      let x, y;
      const row = Math.floor(i / modelsPerRow);
      const col = i % modelsPerRow;
      
      if (sideIndex === 0) {
        x = edgeMargin + col * 6;
        y = edgeMargin + row * 6;
      } else {
        x = edgeMargin + col * 6;
        y = height - edgeMargin - 1 - row * 6;
      }
      x = Math.max(0, Math.min(width - 1, x));
      y = Math.max(0, Math.min(height - 1, y));
      battlefield.placeCharacter(char, { x, y });
    });
  }

  private async resolveCharacterTurn(
    character: any,
    enemies: any[],
    battlefield: Battlefield,
    gameManager: GameManager,
    ai: AIController,
    turn: number,
    sideNum: number
  ) {
    const decision = ai.decideAction(character, enemies, battlefield, gameManager);

    if (decision.type === 'none') return;

    this.stats.totalActions++;
    const sideName = sideNum === 1 ? 'Alpha' : 'Bravo';

    const modelName = character.name || character.id || 'Unknown';
    console.log(`  ${modelName} (${sideName}): ${decision.type} - ${decision.reason}`);

    this.log.push({
      turn,
      round: 1,
      side: sideName,
      model: modelName,
      action: decision.type,
      detail: decision.reason,
    });

    gameManager.beginActivation(character);

    try {
      switch (decision.type) {
        case 'move':
        case 'charge':
          if (decision.position) {
            await this.executeMove(character, decision.position, battlefield, gameManager);
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
      console.error(`    Error: ${error}`);
    }

    gameManager.endActivation(character);
  }

  private async executeMove(
    character: any,
    position: { x: number; y: number },
    battlefield: Battlefield,
    gameManager: GameManager
  ) {
    this.stats.moves++;
    const oldPos = battlefield.getCharacterPosition(character);
    if (oldPos) {
      battlefield.moveCharacter(character, position);
    } else {
      battlefield.placeCharacter(character, position);
    }
  }

  private async executeCloseCombat(
    attacker: any,
    defender: any,
    battlefield: Battlefield,
    gameManager: GameManager
  ) {
    this.stats.closeCombats++;
    this.stats.attacks++;

    const attackerCCA = attacker.finalAttributes?.cca ?? attacker.attributes?.cca ?? 2;
    const defenderCCA = defender.finalAttributes?.cca ?? defender.attributes?.cca ?? 2;
    const attackerSTR = attacker.finalAttributes?.str ?? attacker.attributes?.str ?? 2;
    const defenderFOR = defender.finalAttributes?.for ?? defender.attributes?.for ?? 2;

    const attackerDice: TestDice = { base: 2 + attackerCCA, modifier: 0, wild: 0 };
    const defenderDice: TestDice = { base: 2 + defenderCCA, modifier: 0, wild: 0 };

    const attackerRolls = [1, 2, 3, 4, 5, 6].map(() => Math.floor(Math.random() * 6) + 1);
    const defenderRolls = [1, 2, 3, 4, 5, 6].map(() => Math.floor(Math.random() * 6) + 1);

    const attackerResult = performTest(attackerDice, attackerCCA, attackerRolls.slice(0, attackerDice.base));
    const defenderResult = performTest(defenderDice, defenderCCA, defenderRolls.slice(0, defenderDice.base));

    const hit = attackerResult.successes >= defenderResult.successes;

    if (hit) {
      const attackerDamageDice: TestDice = { base: 2 + attackerSTR, modifier: 0, wild: 0 };
      const defenderArmorDice: TestDice = { base: 2 + defenderFOR, modifier: 0, wild: 0 };

      const damageRolls = [1, 2, 3, 4, 5, 6].map(() => Math.floor(Math.random() * 6) + 1);
      const armorRolls = [1, 2, 3, 4, 5, 6].map(() => Math.floor(Math.random() * 6) + 1);

      const damageResult = performTest(attackerDamageDice, attackerSTR, damageRolls.slice(0, attackerDamageDice.base));
      const armorResult = performTest(defenderArmorDice, defenderFOR, armorRolls.slice(0, defenderArmorDice.base));

      if (damageResult.successes > armorResult.successes) {
        const wounds = defender.state.wounds || 0;
        const siz = defender.finalAttributes?.siz ?? defender.attributes?.siz ?? 3;

        defender.state.wounds = wounds + 1;

        if (defender.state.wounds >= siz) {
          defender.state.isKOd = true;
          this.stats.kos++;
          console.log(`    → ${defender.name} is KO'd!`);
        }
      }
    }
  }

  private async executeRangedCombat(
    attacker: any,
    defender: any,
    battlefield: Battlefield,
    gameManager: GameManager
  ) {
    this.stats.rangedCombats++;
    this.stats.attacks++;

    const attackerRCA = attacker.finalAttributes?.rca ?? attacker.attributes?.rca ?? 2;
    const defenderREF = defender.finalAttributes?.ref ?? defender.attributes?.ref ?? 2;

    const attackerDice: TestDice = { base: 2 + attackerRCA, modifier: 0, wild: 0 };
    const defenderDice: TestDice = { base: 2 + defenderREF, modifier: 0, wild: 0 };

    const attackerRolls = [1, 2, 3, 4, 5, 6].map(() => Math.floor(Math.random() * 6) + 1);
    const defenderRolls = [1, 2, 3, 4, 5, 6].map(() => Math.floor(Math.random() * 6) + 1);

    const attackerResult = performTest(attackerDice, attackerRCA, attackerRolls.slice(0, attackerDice.base));
    const defenderResult = performTest(defenderDice, defenderREF, defenderRolls.slice(0, defenderDice.base));

    const hit = attackerResult.successes >= defenderResult.successes;

    if (hit) {
      const attackerSTR = attacker.finalAttributes?.str ?? attacker.attributes?.str ?? 2;
      const defenderFOR = defender.finalAttributes?.for ?? defender.attributes?.for ?? 2;

      const damageDice: TestDice = { base: 2 + attackerSTR, modifier: 0, wild: 0 };
      const armorDice: TestDice = { base: 2 + defenderFOR, modifier: 0, wild: 0 };

      const damageRolls = [1, 2, 3, 4, 5, 6].map(() => Math.floor(Math.random() * 6) + 1);
      const armorRolls = [1, 2, 3, 4, 5, 6].map(() => Math.floor(Math.random() * 6) + 1);

      const damageResult = performTest(damageDice, attackerSTR, damageRolls.slice(0, damageDice.base));
      const armorResult = performTest(armorDice, defenderFOR, armorRolls.slice(0, armorDice.base));

      if (damageResult.successes > armorResult.successes) {
        const wounds = defender.state.wounds || 0;
        const siz = defender.finalAttributes?.siz ?? defender.attributes?.siz ?? 3;

        defender.state.wounds = wounds + 1;

        if (defender.state.wounds >= siz) {
          defender.state.isKOd = true;
          this.stats.kos++;
          console.log(`    → ${defender.name} is KO'd!`);
        }
      }
    }
  }

  private async executeDisengage(
    disengager: any,
    defender: any,
    battlefield: Battlefield,
    gameManager: GameManager
  ) {
    this.stats.disengages++;

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

        battlefield.removeCharacter(disengager);
        battlefield.placeCharacter(disengager, newPos);
      }
    }
  }
}

// Run the game
const runner = new VeryLargeGameRunner();
runner.runGame().then(result => {
  console.log('\n✅ Game completed successfully!');
  console.log(`Total log entries: ${result.log.length}`);
}).catch(error => {
  console.error('\n❌ Game failed with error:');
  console.error(error);
  process.exit(1);
});
