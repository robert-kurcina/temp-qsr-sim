/**
 * Test Battle Runner
 * 
 * Quick test to verify BattleRunner works correctly
 */

import { runBattle, LIGHTING_PRESETS, InstrumentationGrade, BattleRunnerConfig, GameSize } from './battle-runner';

async function testBattleRunner() {
  console.log('🧪 Testing Battle Runner...\n');

  const config: BattleRunnerConfig = {
    missionId: 'QAI_11',
    gameSize: GameSize.VERY_SMALL,
    sides: [
      {
        id: 'side-a',
        name: 'Side A',
        assemblies: [
          {
            name: 'Assembly A',
            archetypeName: 'Average',
            count: 3,
            itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
          },
        ],
        ai: {
          count: 1,
          doctrine: 'Balanced',
        },
      },
      {
        id: 'side-b',
        name: 'Side B',
        assemblies: [
          {
            name: 'Assembly B',
            archetypeName: 'Average',
            count: 3,
            itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
          },
        ],
        ai: {
          count: 1,
          doctrine: 'Balanced',
        },
      },
    ],
    terrainDensity: 0.50,
    lighting: LIGHTING_PRESETS['Day, Clear'],
    instrumentationGrade: InstrumentationGrade.SUMMARY,
  };

  try {
    const result = await runBattle(config);
    
    console.log('\n✅ Battle Runner test completed successfully!');
    console.log(`   Turns: ${result.turnsPlayed}`);
    console.log(`   Winner: ${result.winnerSide || 'Tie'}`);
    console.log(`   First Blood: ${result.keys.firstBloodSide || 'Not awarded'}`);
  } catch (error) {
    console.error('\n❌ Battle Runner test failed:', error);
    process.exit(1);
  }
}

testBattleRunner();
