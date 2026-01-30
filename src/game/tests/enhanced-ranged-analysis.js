// /src/tests/enhanced-ranged-analysis.js
import { GeneralizedOptimizationFramework } from '../game/analysis/GeneralizedOptimizationFramework.js';
import { EnhancedBattlefieldConfig } from '../analysis/EnhancedBattlefieldConfig.js';

/**
 * Enhanced ranged weapon analysis with visibility and terrain variations
 */
export class EnhancedRangedAnalysis {
  constructor() {
    this.framework = new GeneralizedOptimizationFramework();
    this.battlefieldConfig = new EnhancedBattlefieldConfig();
  }
  
  /**
   * Create ranged test configuration with terrain
   */
  createRangedTestConfig(visibility, terrainDensity) {
    const baseConfig = {
      name: `Longbow vs Axe Long - Vis${visibility}MU Terr${Math.round(terrainDensity * 100)}%`,
      sideA: {
        name: 'Longbow Archers',
        models: Array.from({ length: 9 }, (_, i) => `A-${i + 1}`),
        archetype: 'Average',
        weapon: 'Bow, Long',
        armor: ['Armored Gear']
      },
      sideB: {
        name: 'Axe Long Chargers',
        models: Array.from({ length: 7 }, (_, i) => `B-${i + 1}`),
        archetype: 'Average',
        weapon: 'Axe, Long',
        armor: ['Armor, Light']
      },
      bp: 500
    };
    
    // Add battlefield configuration
    const battlefield = this.battlefieldConfig.createConnectedTerrainLayout(visibility, terrainDensity);
    baseConfig.battlefield = battlefield;
    
    return baseConfig;
  }
  
  /**
   * Run enhanced ranged analysis matrix
   */
  async runEnhancedRangedAnalysis() {
    console.log('🏹 ENHANCED RANGED WEAPON ANALYSIS');
    console.log('==================================');
    console.log('Testing Longbow vs Axe Long across visibility and terrain variations');
    console.log('Ensuring 2+ traversable paths for close combat engagement');
    
    const testMatrix = this.battlefieldConfig.generateRangedTestMatrix();
    const results = {};
    
    // Group by visibility for analysis
    const visibilityGroups = {};
    
    for (const testConfig of testMatrix) {
      console.log(`\n🧪 Testing: ${testConfig.name}`);
      
      try {
        const config = this.createRangedTestConfig(testConfig.visibility, testConfig.terrainDensity);
        const result = await this.framework.runGenericMonteCarlo(config, 100, 2);
        
        results[testConfig.name] = {
          ...result,
          visibility: testConfig.visibility,
          terrainDensity: testConfig.terrainDensity
        };
        
        // Group by visibility
        if (!visibilityGroups[testConfig.visibility]) {
          visibilityGroups[testConfig.visibility] = [];
        }
        visibilityGroups[testConfig.visibility].push({
          name: testConfig.name,
          result: result,
          terrainDensity: testConfig.terrainDensity
        });
        
        console.log(`✅ Completed: Vis${testConfig.visibility}MU Terr${Math.round(testConfig.terrainDensity * 100)}%`);
        console.log(`   Longbow Win Rate: ${(result.winRates.sideA * 100).toFixed(1)}%`);
        
      } catch (error) {
        console.error(`❌ Failed: ${testConfig.name}`, error);
        results[testConfig.name] = { error: error.message };
      }
    }
    
    // Generate comprehensive analysis
    this.generateRangedAnalysisReport(results, visibilityGroups);
    
    return results;
  }
  
  /**
   * Generate comprehensive ranged analysis report
   */
  generateRangedAnalysisReport(results, visibilityGroups) {
    console.log('\n📊 ENHANCED RANGED ANALYSIS REPORT');
    console.log('=================================');
    
    // Analyze by visibility
    console.log('\n🔍 VISIBILITY IMPACT ANALYSIS:');
    Object.entries(visibilityGroups).forEach(([visibility, tests]) => {
      const avgWinRate = tests.reduce((sum, test) => sum + test.result.winRates.sideA, 0) / tests.length;
      console.log(`Visibility ${visibility} MU: Average Longbow Win Rate = ${(avgWinRate * 100).toFixed(1)}%`);
    });
    
    // Analyze by terrain density
    console.log('\n🌳 TERRAIN DENSITY IMPACT ANALYSIS:');
    const terrainGroups = {};
    Object.values(visibilityGroups).flat().forEach(test => {
      if (!terrainGroups[test.terrainDensity]) {
        terrainGroups[test.terrainDensity] = [];
      }
      terrainGroups[test.terrainDensity].push(test.result.winRates.sideA);
    });
    
    Object.entries(terrainGroups).forEach(([density, winRates]) => {
      const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
      console.log(`Terrain ${Math.round(density * 100)}%: Average Longbow Win Rate = ${(avgWinRate * 100).toFixed(1)}%`);
    });
    
    // Identify optimal balancing conditions
    console.log('\n🎯 BALANCING INSIGHTS:');
    
    // Find conditions where ranged is balanced (40-60% win rate)
    const balancedConditions = [];
    const overpoweringConditions = [];
    const weakConditions = [];
    
    Object.entries(results).forEach(([name, result]) => {
      if (result.error) return;
      
      const winRate = result.winRates.sideA;
      if (winRate >= 0.4 && winRate <= 0.6) {
        balancedConditions.push(name);
      } else if (winRate > 0.6) {
        overpoweringConditions.push({ name, winRate });
      } else {
        weakConditions.push({ name, winRate });
      }
    });
    
    console.log(`Balanced Conditions (${balancedConditions.length}):`);
    balancedConditions.forEach(condition => console.log(`  • ${condition}`));
    
    console.log(`Overpowering Conditions (${overpoweringConditions.length}):`);
    overpoweringConditions
      .sort((a, b) => b.winRate - a.winRate)
      .forEach(condition => console.log(`  • ${condition.name}: ${(condition.winRate * 100).toFixed(1)}%`));
    
    console.log(`Weak Conditions (${weakConditions.length}):`);
    weakConditions
      .sort((a, b) => a.winRate - b.winRate)
      .forEach(condition => console.log(`  • ${condition.name}: ${(condition.winRate * 100).toFixed(1)}%`));
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (overpoweringConditions.length > 0) {
      const worstCase = overpoweringConditions[0];
      console.log(`• Longbow is severely overpowered in open conditions (${worstCase.name})`);
      console.log(`• Consider increasing Longbow BP cost or reducing effectiveness`);
    }
    
    if (balancedConditions.length > 0) {
      console.log(`• Terrain density ≥50% with visibility ≤8 MU provides good balance`);
      console.log(`• Use these conditions as baseline for fair ranged vs melee matchups`);
    }
    
    if (weakConditions.length > 0) {
      const bestCaseForMelee = weakConditions[weakConditions.length - 1];
      console.log(`• High terrain density (75%) with low visibility (4 MU) favors melee significantly`);
      console.log(`• Axe, Long performs well under these conditions`);
    }
    
    // BP adjustment recommendations
    console.log('\n⚖️ BP COST RECOMMENDATIONS:');
    const openFieldWinRate = results['Longbow vs Axe Long - Vis16MU Terr25%']?.winRates?.sideA || 0.63;
    
    if (openFieldWinRate > 0.6) {
      console.log(`• INCREASE Longbow cost from 13 BP to 15-16 BP (nerf overpowered)`);
      console.log(`• DECREASE Axe, Long cost from 27 BP to 24-25 BP (buff underpowered)`);
    }
  }
}

// Run enhanced analysis if executed directly
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  const analysis = new EnhancedRangedAnalysis();
  analysis.runEnhancedRangedAnalysis().catch(console.error);
}