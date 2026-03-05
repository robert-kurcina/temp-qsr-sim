/**
 * Interactive Setup
 *
 * AIBattleSetup class for readline-based interactive configuration.
 */

import * as readline from 'readline';
import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine, TACTICAL_DOCTRINE_INFO, getDoctrinesByEngagement } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { LightingCondition, getVisibilityOrForLighting } from '../../src/lib/mest-tactics/utils/visibility';
import type { GameConfig, SideConfig } from '../shared/BattleReportTypes';
import { GAME_SIZE_CONFIG } from './AIBattleConfig';

/**
 * Map tactical doctrine to AI config
 */
function doctrineToAIConfig(doctrine: TacticalDoctrine): { aggression: number; caution: number } {
  // Simple mapping - in full implementation this would use deriveDoctrineAIPressure
  const config = new Map<TacticalDoctrine, { aggression: number; caution: number }>([
    [TacticalDoctrine.Juggernaut, { aggression: 0.9, caution: 0.2 }],
    [TacticalDoctrine.Berserker, { aggression: 0.95, caution: 0.1 }],
    [TacticalDoctrine.Guardian, { aggression: 0.3, caution: 0.8 }],
    [TacticalDoctrine.Sentinel, { aggression: 0.4, caution: 0.7 }],
    [TacticalDoctrine.Vanguard, { aggression: 0.7, caution: 0.5 }],
    [TacticalDoctrine.Assault, { aggression: 0.8, caution: 0.3 }],
    [TacticalDoctrine.Support, { aggression: 0.4, caution: 0.7 }],
    [TacticalDoctrine.Hold, { aggression: 0.2, caution: 0.9 }],
    [TacticalDoctrine.Rush, { aggression: 0.9, caution: 0.2 }],
    [TacticalDoctrine.Sniper, { aggression: 0.4, caution: 0.7 }],
    [TacticalDoctrine.Tactician, { aggression: 0.5, caution: 0.6 }],
    [TacticalDoctrine.Commander, { aggression: 0.5, caution: 0.6 }],
    [TacticalDoctrine.Marksman, { aggression: 0.5, caution: 0.6 }],
    [TacticalDoctrine.Pacifist, { aggression: 0.1, caution: 0.95 }],
    [TacticalDoctrine.Operative, { aggression: 0.5, caution: 0.5 }],
  ]);
  return config.get(doctrine) ?? { aggression: 0.5, caution: 0.5 };
}

/**
 * Interactive AI Battle Setup
 */
export class AIBattleSetup {
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
    const orderedSizes: GameSize[] = [
      GameSize.VERY_SMALL,
      GameSize.SMALL,
      GameSize.MEDIUM,
      GameSize.LARGE,
      GameSize.VERY_LARGE,
    ];

    orderedSizes.forEach((size, index) => {
      const config = GAME_SIZE_CONFIG[size];
      const modelMin = config.modelsPerSide[0];
      const modelMax = config.modelsPerSide[2];
      const bpMin = config.bpPerSide[0];
      const bpMax = config.bpPerSide[2];
      console.log(
        `  ${index + 1}. ${size.padEnd(11)} (${modelMin}-${modelMax} models/side, ${bpMin}-${bpMax} BP, ${config.battlefieldWidth}×${config.battlefieldHeight} MU)`
      );
    });

    const choice = await this.question('\nGame size [1-5] (default: 5): ');

    const sizes: Record<string, GameSize> = Object.fromEntries(
      orderedSizes.map((size, index) => [String(index + 1), size])
    );

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
      battlefieldWidth: GAME_SIZE_CONFIG[gameSize].battlefieldWidth,
      battlefieldHeight: GAME_SIZE_CONFIG[gameSize].battlefieldHeight,
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
    console.log(`  Battlefield: ${config.battlefieldWidth}×${config.battlefieldHeight} MU`);
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
