/**
 * ⚠️  DEPRECATED - AI Battle: QAI_11 Elimination with custom melee-only profiles
 * 
 * This script is deprecated and will be removed in a future version.
 * 
 * ✅ USE THE NEW BATTLE RUNNER CLI INSTEAD:
 *   npx tsx scripts/run-battles/ --config very-small
 *   npx tsx scripts/run-battles/ --mission QAI_11
 * 
 * For more options:
 *   npx tsx scripts/run-battles/ --help
 * 
 * 4 Average characters per side with Sword, Broad + Armored Gear + Armor, Light + Shield, Small
 */

// Deprecation warning
console.warn('⚠️  DEPRECATION WARNING: scripts/run-ai-melee-battle.ts is deprecated.');
console.warn('✅ Use the new battle runner CLI instead:');
console.warn('   npx tsx scripts/run-battles/ --config very-small');
console.warn('   npx tsx scripts/run-battles/ --help');
console.warn('');

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Character } from '../src/lib/mest-tactics/core/Character';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { GameManager } from '../src/lib/mest-tactics/engine/GameManager';
import { buildAssembly, buildProfile, GameSize } from '../src/lib/mest-tactics/mission/assembly-builder';
import { ModelSlotStatus, createMissionSide, type MissionSide } from '../src/lib/mest-tactics/mission/MissionSide';
import { createMissionRuntimeAdapter } from '../src/lib/mest-tactics/missions/mission-runtime-adapter';
import { TacticalDoctrine } from '../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { CharacterAI, DEFAULT_CHARACTER_AI_CONFIG } from '../src/lib/mest-tactics/ai/core/CharacterAI';
import type { AIControllerConfig } from '../src/lib/mest-tactics/ai/core/AIController';
import type { LightingCondition } from '../src/lib/mest-tactics/utils/visibility';
import { getVisibilityOrForLighting } from '../src/lib/mest-tactics/utils/visibility';
import { ObjectiveMarkerManager } from '../src/lib/mest-tactics/mission/objective-markers';

async function runAIBattle() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
  mkdirSync(outputDir, { recursive: true });

  // Create profile: Average + Sword, Broad + Armored Gear + Armor, Light + Shield, Small
  const profile = buildProfile('Average', { 
    itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'] 
  });

  // Create 4 characters per side
  const alphaAssembly = buildAssembly('Alpha Assembly', [profile, profile, profile, profile]);
  const bravoAssembly = buildAssembly('Bravo Assembly', [profile, profile, profile, profile]);

  // Create characters with IDs
  const alphaChars = alphaAssembly.characters.map((c, i) => {
    c.id = `Alpha-A${i}`;
    c.state.armor.total = 2; // AR 2 from equipment
    return c;
  });

  const bravoChars = bravoAssembly.characters.map((c, i) => {
    c.id = `Bravo-Z${i}`;
    c.state.armor.total = 2; // AR 2 from equipment
    return c;
  });

  // Create battlefield (18x18, density 0 = no terrain)
  const battlefield = new Battlefield(18, 18);

  // Deploy models
  const deploySide = (characters: Character[], sideIndex: number) => {
    const edgeMargin = 3;
    const deploymentDepth = 6;
    const count = characters.length;
    const cols = Math.ceil(Math.sqrt(count));
    const xSpacing = cols > 1 ? (18 - edgeMargin * 2 - 1) / (cols - 1) : 0;
    const sideStartY = sideIndex === 0 ? edgeMargin : 18 - edgeMargin - deploymentDepth;

    characters.forEach((char, i) => {
      const col = i % cols;
      const x = Math.round(edgeMargin + col * xSpacing);
      const y = Math.round(sideStartY);
      char.position = { x, y };
    });
  };

  deploySide(alphaChars, 0);
  deploySide(bravoChars, 1);

  // Create mission sides
  const alphaSide = createMissionSide('Alpha', [alphaAssembly]);
  const bravoSide = createMissionSide('Bravo', [bravoAssembly]);

  // Create game manager
  const allCharacters = [...alphaChars, ...bravoChars];
  const gm = new GameManager(allCharacters, battlefield);

  // Create mission runtime adapter
  const missionAdapter = createMissionRuntimeAdapter('QAI_11', gm);

  // Create AI controllers
  const createAI = (side: MissionSide): AIControllerConfig => ({
    sideId: side.id,
    characterAI: new CharacterAI({
      ...DEFAULT_CHARACTER_AI_CONFIG,
      aggression: 0.5,
      caution: 0.5,
    }),
    tacticalDoctrine: TacticalDoctrine.Operative,
  });

  const aiConfigs = [createAI(alphaSide), createAI(bravoSide)];

  // Run the game
  console.log('⚔️  AI Battle: QAI_11 Elimination\n');
  console.log('Game Size: VERY_SMALL (4 vs 4)');
  console.log('Loadout: Sword, Broad + Armored Gear + Armor, Light + Shield, Small');
  console.log('Density: 0 (no terrain)\n');
  
  console.log('📋 Alpha Side:');
  alphaChars.forEach(c => {
    console.log(`  ${c.id}: Average - CCA ${c.finalAttributes.cca}, FOR ${c.finalAttributes.for}, SIZ ${c.finalAttributes.siz}, AR ${c.state.armor.total}`);
  });
  console.log('📋 Bravo Side:');
  bravoChars.forEach(c => {
    console.log(`  ${c.id}: Average - CCA ${c.finalAttributes.cca}, FOR ${c.finalAttributes.for}, SIZ ${c.finalAttributes.siz}, AR ${c.state.armor.total}`);
  });
  console.log('\n────────────────────────────────────────────────────────────\n');

  const result = await gm.runGame(missionAdapter, aiConfigs);

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(`\n🏆 Winner: ${result.winner || 'Draw'}`);
  console.log(`📊 Turns Completed: ${result.turnsCompleted}`);
  console.log(`⚡ Total Actions: ${result.stats.totalActions}`);
  console.log(`⚔️  Close Combats: ${result.stats.closeCombats}`);
  console.log(`🔫 Ranged Combats: ${result.stats.rangedCombats}`);
  console.log(`💀 KOs: ${result.stats.kos}`);
  console.log(`☠️  Eliminations: ${result.stats.eliminations}`);

  console.log('\n📍 Final State:');
  console.log('  Alpha Side:');
  alphaChars.forEach(c => {
    const status = c.state.isEliminated ? '☠️  ELIMINATED' : c.state.isKOd ? '💀 KO\'d' : '✅ Active';
    console.log(`    ${c.id}: ${status} (${c.state.wounds} wounds)`);
  });
  console.log('  Bravo Side:');
  bravoChars.forEach(c => {
    const status = c.state.isEliminated ? '☠️  ELIMINATED' : c.state.isKOd ? '💀 KO\'d' : '✅ Active';
    console.log(`    ${c.id}: ${status} (${c.state.wounds} wounds)`);
  });

  // Save JSON report
  const reportPath = join(outputDir, `ai-battle-melee-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`\n📁 JSON Report: ${reportPath}`);
  console.log('✅ Battle completed successfully!');
}

runAIBattle().catch(console.error);
