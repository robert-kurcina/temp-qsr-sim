/**
 * Full Game Runner Utility
 * 
 * Runs complete autonomous AI vs AI games from setup to conclusion.
 * Uses the actual GameManager for all combat resolution.
 * 
 * Run with: npx tsx scripts/run-full-game.ts [VERY_SMALL|SMALL|MEDIUM|LARGE|VERY_LARGE]
 */

import { buildAssembly, buildProfile, GameSize } from '../src/lib/mest-tactics/mission/assembly-builder';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { GameManager } from '../src/lib/mest-tactics/engine/GameManager';
import { getBaseDiameterFromSiz } from '../src/lib/mest-tactics/battlefield/spatial/size-utils';
import { SpatialRules } from '../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { Character } from '../src/lib/mest-tactics/core/Character';
import { Position } from '../src/lib/mest-tactics/battlefield/Position';

// ============================================================================
// Configuration
// ============================================================================

interface GameSizeConfig {
  name: string;
  modelsPerSide: [number, number];
  bpPerSide: [number, number];
  battlefieldSize: number;
  maxTurns: number;
  endGameTurn: number;
}

const GAME_SIZES: Record<string, GameSizeConfig> = {
  VERY_SMALL: { name: 'Very Small', modelsPerSide: [2, 4], bpPerSide: [125, 250], battlefieldSize: 18, maxTurns: 10, endGameTurn: 10 },
  SMALL: { name: 'Small', modelsPerSide: [4, 8], bpPerSide: [250, 500], battlefieldSize: 24, maxTurns: 10, endGameTurn: 10 },
  MEDIUM: { name: 'Medium', modelsPerSide: [6, 12], bpPerSide: [500, 750], battlefieldSize: 36, maxTurns: 10, endGameTurn: 10 },
  LARGE: { name: 'Large', modelsPerSide: [8, 16], bpPerSide: [750, 1000], battlefieldSize: 48, maxTurns: 10, endGameTurn: 10 },
  VERY_LARGE: { name: 'Very Large', modelsPerSide: [16, 32], bpPerSide: [1000, 2000], battlefieldSize: 60, maxTurns: 10, endGameTurn: 10 },
};

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

// ============================================================================
// AI Controller
// ============================================================================

class AIController {
  private aggression: number;
  private caution: number;

  constructor(aggression: number = 0.5, caution: number = 0.5) {
    this.aggression = aggression;
    this.caution = caution;
  }

  findTargets(character: Character, enemies: Character[], battlefield: Battlefield): Array<{ enemy: Character; dist: number; hasLOS: boolean }> {
    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) return [];

    const targets: Array<{ enemy: Character; dist: number; hasLOS: boolean }> = [];

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
    character: Character,
    enemies: Character[],
    battlefield: Battlefield,
    gameManager: GameManager
  ): { type: string; target?: Character; position?: Position; reason: string } {
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

// ============================================================================
// Game Runner
// ============================================================================

export class FullGameRunner {
  private log: Array<{ turn: number; side: string; model: string; action: string; detail?: string }> = [];
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

  async runGame(
    sizeConfig: GameSizeConfig,
    sideAName: string = 'Alpha',
    sideBName: string = 'Bravo',
    verbose: boolean = true
  ): Promise<{ winner: string; log: typeof this.log; stats: GameStats }> {
    if (verbose) {
      console.log(`\n⚔️  Starting ${sizeConfig.name} Game\n`);
      console.log(`Battlefield: ${sizeConfig.battlefieldSize}×${sizeConfig.battlefieldSize} MU`);
      console.log(`Max Turns: ${sizeConfig.maxTurns}\n`);
    }

    // Build assemblies
    const sideA = this.createAssembly(sideAName, sizeConfig);
    const sideB = this.createAssembly(sideBName, sizeConfig);

    if (verbose) {
      console.log(`${sideAName}: ${sideA.characters.length} models, ${sideA.totalBP} BP`);
      console.log(`${sideBName}: ${sideB.characters.length} models, ${sideB.totalBP} BP\n`);
    }

    // Create battlefield
    const battlefield = this.createBattlefield(sizeConfig.battlefieldSize);

    // Deploy models
    this.deployModels(sideA, battlefield, 0, sizeConfig.battlefieldSize);
    this.deployModels(sideB, battlefield, 1, sizeConfig.battlefieldSize);

    if (verbose) {
      console.log('Models deployed.\n');
      console.log('─'.repeat(60) + '\n');
    }

    // Create game manager
    const allCharacters = [...sideA.characters, ...sideB.characters];
    const gameManager = new GameManager(allCharacters, battlefield);

    // Create AI controllers
    const aiA = new AIController(0.6, 0.4);
    const aiB = new AIController(0.5, 0.5);

    // Run game loop
    let gameOver = false;
    let turn = 0;

    while (!gameOver && turn < sizeConfig.maxTurns) {
      turn++;

      if (verbose) {
        console.log(`\n📍 Turn ${turn}\n`);
      }

      // Alternate activations
      for (const character of sideA.characters) {
        if (!character.state.isEliminated && !character.state.isKOd) {
          await this.resolveCharacterTurn(character, sideB.characters, battlefield, gameManager, aiA, turn, 1, verbose);
        }
      }

      for (const character of sideB.characters) {
        if (!character.state.isEliminated && !character.state.isKOd) {
          await this.resolveCharacterTurn(character, sideA.characters, battlefield, gameManager, aiB, turn, 2, verbose);
        }
      }

      // Check victory conditions
      const aRemaining = sideA.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length;
      const bRemaining = sideB.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length;

      if (aRemaining === 0 || bRemaining === 0) {
        gameOver = true;
        if (verbose) {
          console.log(`\n🏆 Game Over - All models eliminated on one side!\n`);
        }
      } else if (turn >= sizeConfig.endGameTurn) {
        if (Math.random() < 0.5) {
          gameOver = true;
          if (verbose) {
            console.log(`\n🎲 End game die roll - Game Over!\n`);
          }
        }
      }

      if (verbose) {
        console.log(`  ${sideAName}: ${aRemaining}/${sideA.characters.length} models`);
        console.log(`  ${sideBName}: ${bRemaining}/${sideB.characters.length} models`);
      }
    }

    // Final results
    const aRemaining = sideA.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length;
    const bRemaining = sideB.characters.filter(c => !c.state.isEliminated && !c.state.isKOd).length;

    let winner = 'Draw';
    if (aRemaining > bRemaining) winner = sideAName;
    else if (bRemaining > aRemaining) winner = sideBName;

    if (verbose) {
      console.log('\n' + '─'.repeat(60));
      console.log('\n📊 Final Results:\n');
      console.log(`${sideAName}: ${aRemaining}/${sideA.characters.length} models`);
      console.log(`${sideBName}: ${bRemaining}/${sideB.characters.length} models`);
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
    }

    return { winner, log: this.log, stats: this.stats };
  }

  private createAssembly(name: string, config: GameSizeConfig): { characters: Character[]; totalBP: number } {
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

    const assembly = buildAssembly(name, profiles);
    return { characters: assembly.characters, totalBP: assembly.totalBP };
  }

  private createBattlefield(size: number): Battlefield {
    const battlefield = new Battlefield(size, size);

    const terrainTypes = ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks'];
    const terrainCount = Math.floor(size * 0.2);

    for (let i = 0; i < terrainCount; i++) {
      const terrainName = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
      const x = Math.floor(4 + Math.random() * (size - 8));
      const y = Math.floor(4 + Math.random() * (size - 8));
      const rotation = Math.floor(Math.random() * 360);

      battlefield.addTerrainElement(new TerrainElement(terrainName, { x, y }, rotation));
    }

    return battlefield;
  }

  private deployModels(assembly: { characters: Character[] }, battlefield: Battlefield, sideIndex: number, size: number) {
    const edgeMargin = 2;
    const modelsPerRow = Math.ceil(Math.sqrt(assembly.characters.length));
    const spacing = Math.min(6, (size - edgeMargin * 2) / modelsPerRow);

    assembly.characters.forEach((char: Character, i: number) => {
      let x, y;
      const row = Math.floor(i / modelsPerRow);
      const col = i % modelsPerRow;

      if (sideIndex === 0) {
        x = edgeMargin + col * spacing;
        y = edgeMargin + row * spacing;
      } else {
        x = edgeMargin + col * spacing;
        y = size - edgeMargin - 1 - row * spacing;
      }
      x = Math.max(0, Math.min(size - 1, x));
      y = Math.max(0, Math.min(size - 1, y));
      battlefield.placeCharacter(char, { x, y });
    });
  }

  private async resolveCharacterTurn(
    character: Character,
    enemies: Character[],
    battlefield: Battlefield,
    gameManager: GameManager,
    ai: AIController,
    turn: number,
    sideNum: number,
    verbose: boolean
  ) {
    const decision = ai.decideAction(character, enemies, battlefield, gameManager);

    if (decision.type === 'none') return;

    this.stats.totalActions++;
    const sideName = sideNum === 1 ? 'Alpha' : 'Bravo';

    if (verbose) {
      const modelName = character.name || character.id || 'Unknown';
      console.log(`  ${modelName} (${sideName}): ${decision.type} - ${decision.reason}`);
    }

    this.log.push({
      turn,
      side: sideName,
      model: character.name || character.id,
      action: decision.type,
      detail: decision.reason,
    });

    gameManager.beginActivation(character);

    try {
      switch (decision.type) {
        case 'move':
        case 'charge':
          if (decision.position) {
            await this.executeMove(character, decision.position, battlefield);
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
            await this.executeDisengage(character, decision.target, battlefield);
          }
          break;
      }
    } catch (error) {
      if (verbose) {
        console.error(`    Error: ${error}`);
      }
    }

    gameManager.endActivation(character);
  }

  private async executeMove(
    character: Character,
    position: Position,
    battlefield: Battlefield
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
    attacker: Character,
    defender: Character,
    battlefield: Battlefield,
    gameManager: GameManager
  ) {
    this.stats.closeCombats++;
    this.stats.attacks++;

    // Get attacker's melee weapon (simplified - use first melee weapon or unarmed)
    const weapon = attacker.profile?.items?.find(i => i.classification === 'Melee') || 
                   attacker.profile?.items?.[0] || 
                   { name: 'Unarmed', dmg: 'STR', impact: 0, accuracy: '', traits: ['[Stub]'], classification: 'Natural' };

    if (verbose) {
      console.log(`    Weapon: ${weapon.name || 'Unknown'}`);
    }

    try {
      const result = gameManager.executeCloseCombatAttack(attacker, defender, weapon, {
        isCharge: false,
        isDefending: false,
      });

      if (verbose) {
        console.log(`    Combat result: hit=${result.hit}, KO=${result.damageResolution?.defenderKOd}, Elim=${result.damageResolution?.defenderEliminated}`);
      }

      if (result.damageResolution?.defenderKOd) {
        this.stats.kos++;
        if (verbose) console.log(`    → ${defender.name} is KO'd!`);
      }
      if (result.damageResolution?.defenderEliminated) {
        this.stats.eliminations++;
        if (verbose) console.log(`    → ${defender.name} is Eliminated!`);
      }
    } catch (error) {
      if (verbose) {
        console.error(`    Combat error: ${error}`);
      }
    }
  }

  private async executeRangedCombat(
    attacker: Character,
    defender: Character,
    battlefield: Battlefield,
    gameManager: GameManager
  ) {
    this.stats.rangedCombats++;
    this.stats.attacks++;

    // Get attacker's ranged weapon
    const weapon = attacker.profile?.items?.find(i => i.classification === 'Bow' || i.classification === 'Thrown' || i.classification === 'Range') ||
                   attacker.profile?.items?.[0];

    if (!weapon) return;

    try {
      const result = gameManager.executeRangedAttack(attacker, defender, weapon, {
        orm: 1,
      });

      if (result.damageResolution?.defenderKOd) {
        this.stats.kos++;
      }
      if (result.damageResolution?.defenderEliminated) {
        this.stats.eliminations++;
      }
    } catch (error) {
      // Combat may fail for various reasons
    }
  }

  private async executeDisengage(
    disengager: Character,
    defender: Character,
    battlefield: Battlefield
  ) {
    this.stats.disengages++;

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

        battlefield.moveCharacter(disengager, newPos);
      }
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const sizeArg = process.argv[2]?.toUpperCase() || 'VERY_LARGE';
  const sizeConfig = GAME_SIZES[sizeArg];

  if (!sizeConfig) {
    console.error(`Unknown game size: ${sizeArg}`);
    console.error('Valid sizes: VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE');
    process.exit(1);
  }

  const runner = new FullGameRunner();
  try {
    await runner.runGame(sizeConfig, 'Alpha', 'Bravo', true);
    console.log('\n✅ Game completed successfully!');
  } catch (error) {
    console.error('\n❌ Game failed with error:');
    console.error(error);
    process.exit(1);
  }
}

export { GAME_SIZES };

// Run if executed directly
main();
