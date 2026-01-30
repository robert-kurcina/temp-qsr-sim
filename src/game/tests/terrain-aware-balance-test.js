// /src/tests/terrain-aware-balance-test.js
import { BalanceTestFramework } from '../analysis/BalanceTestFramework.js';
import { BattlefieldLayoutConfig } from '../analysis/BattlefieldLayoutConfig.js';

/**
 * Terrain-aware balance test for Longbow vs Saber
 */
export class TerrainAwareBalanceTest {
  constructor() {
    this.framework = new BalanceTestFramework();
    this.layoutConfig = new BattlefieldLayoutConfig();
  }
  
  /**
   * Create terrain-aware test configuration
   */
  createTerrainTest(layoutName, bpLimit = 350) {
    const layout = this.layoutConfig.getLayout(layoutName);
    
    const testConfig = this.framework.createStandardTestConfig(
      `Longbow+Dagger vs Saber - ${layout.name} (${bpLimit} BP)`,
      {
        name: 'Ranged Skirmishers',
        count: 6,
        assembly: 'Average',
        weapons: ['Bow, Long', 'Daggers'],
        armor: ['Armor, Light']
      },
      {
        name: 'Melee Defenders', 
        count: 6,
        assembly: 'Average',
        weapons: ['Sword, Saber'],
        armor: ['Shield, Medium', 'Armored Gear']
      },
      bpLimit
    );
    
    // Add terrain configuration
    testConfig.terrain = layout.terrain;
    testConfig.battlefieldSizeMU = layout.sizeMU;
    testConfig.deployment = layout.deployment;
    testConfig.layoutName = layout.name;
    
    return testConfig;
  }
  
  /**
   * Run multi-terrain balance analysis
   */
  async runMultiTerrainAnalysis(iterations = 50) {
    console.log('🌍 MULTI-TERRAIN BALANCE ANALYSIS');
    console.log('=================================');
    console.log('Testing Longbow+Dagger vs Saber across different battlefield layouts');
    
    const layoutsToTest = [
      'open-field',
      'urban-outpost', 
      'forest-clearing',
      'symmetric-cover'
    ];
    
    const results = {};
    
    for (const layoutName of layoutsToTest) {
      console.log(`\n🧪 Testing layout: ${layoutName}`);
      
      const testConfig = this.createTerrainTest(layoutName, 350);
      const layoutResults = await this.framework.runBalanceTest(
        `Terrain: ${layoutName}`,
        testConfig,
        iterations
      );
      
      results[layoutName] = {
        layout: this.layoutConfig.getLayout(layoutName),
        results: layoutResults
      };
      
      this.framework.printTestResults(`${layoutName} Results`, layoutResults);
    }
    
    // Generate comparative analysis
    this.generateTerrainComparison(results);
    return results;
  }
  
  /**
   * Generate terrain comparison analysis
   */
  generateTerrainComparison(results) {
    console.log('\n📊 TERRAIN COMPARISON ANALYSIS');
    console.log('==============================');
    
    const layoutNames = Object.keys(results);
    const winRates = {};
    const survivalRates = {};
    
    layoutNames.forEach(name => {
      const result = results[name].results;
      winRates[name] = result.winRates.sideA; // Ranged win rate
      survivalRates[name] = result.averages.survivalRates.sideA;
    });
    
    // Find best/worst terrain for ranged
    const bestForRanged = Object.keys(winRates).reduce((a, b) => 
      winRates[a] > winRates[b] ? a : b
    );
    const worstForRanged = Object.keys(winRates).reduce((a, b) => 
      winRates[a] < winRates[b] ? a : b
    );
    
    console.log(`Best terrain for Ranged: ${bestForRanged} (${(winRates[bestForRanged] * 100).toFixed(1)}% win rate)`);
    console.log(`Worst terrain for Ranged: ${worstForRanged} (${(winRates[worstForRanged] * 100).toFixed(1)}% win rate)`);
    console.log(`Win rate difference: ${(winRates[bestForRanged] - winRates[worstForRanged]) * 100}%`);
    
    // Balance assessment
    if (Math.abs(winRates[bestForRanged] - winRates[worstForRanged]) > 0.3) {
      console.log('⚠️  Significant terrain impact on balance');
      console.log('💡 Consider terrain when evaluating weapon BP costs');
    } else {
      console.log('✅ Terrain provides balanced tactical variety without extreme imbalance');
    }
    
    // Specific recommendations
    console.log('\n📋 Recommendations:');
    if (winRates['open-field'] > 0.7) {
      console.log('• Longbow may be overpowered on open terrain - consider BP cost adjustment');
    }
    if (winRates['urban-outpost'] < 0.3) {
      console.log('• Melee builds excel in urban terrain - validates current BP costs');
    }
    if (Math.abs(winRates['symmetric-cover'] - 0.5) < 0.1) {
      console.log('• Symmetric cover provides fair testing ground for balance validation');
    }
  }
}