// /src/tests/modifier-tracking-tests.js
import { FullModifierSimulator } from '../simulator/FullModifierSimulator.js';

/**
 * Test suite with comprehensive situational modifier tracking
 */
export class ModifierTrackingTests {
  constructor() {
    this.simulator = new FullModifierSimulator({ debugMode: false });
  }
  
  /**
   * Run tests with full modifier analytics
   */
  async runModifierTrackingTests() {
    console.log('🎯 RUNNING COMPREHENSIVE MODIFIER TRACKING TESTS');
    console.log('=================================================');
    
    // Test configurations that should trigger various modifiers
    const testConfigs = [
      // Hidden Status tests (should trigger Suddenness)
      this.createHiddenStatusTest(),
      
      // Terrain tests (should trigger Cover, Elevation, etc.)
      this.createTerrainModifierTest(),
      
      // Close combat tests (should trigger Charge, Flanked, etc.)
      this.createCloseCombatModifierTest(),
      
      // Ranged combat tests (should trigger Point Blank, Distance, etc.)
      this.createRangedModifierTest()
    ];
    
    const allResults = [];
    
    for (let i = 0; i < testConfigs.length; i++) {
      console.log(`\n🧪 Running Test ${i + 1}/${testConfigs.length}`);
      
      try {
        const result = await this.runSingleTest(testConfigs[i], 50);
        allResults.push(result);
        
        // Analyze modifier usage
        this.analyzeModifierUsage(result.modifierStats, `Test ${i + 1}`);
        
      } catch (error) {
        console.error(`❌ Test ${i + 1} failed:`, error);
      }
    }
    
    // Generate comprehensive modifier report
    this.generateModifierReport(allResults);
    
    return allResults;
  }
  
  /**
   * Analyze modifier usage patterns
   */
  analyzeModifierUsage(modifierStats, testName) {
    console.log(`\n📊 ${testName} - Key Modifier Usage:`);
    
    // Find most used modifiers
    const sortedByUsage = Object.entries(modifierStats)
      .sort(([,a], [,b]) => b.usage - a.usage)
      .slice(0, 5);
    
    console.log('Most Frequently Used:');
    sortedByUsage.forEach(([modifier, stats]) => {
      if (stats.usage > 0) {
        console.log(`  • ${modifier}: ${stats.usage} times (success rate: ${(stats.successRate * 100).toFixed(1)}%)`);
      }
    });
    
    // Check for Suddenness specifically
    if (modifierStats.suddenness?.usage > 0) {
      console.log(`✅ Suddenness triggered ${modifierStats.suddenness.usage} times`);
      console.log(`   Success rate: ${(modifierStats.suddenness.successRate * 100).toFixed(1)}%`);
    }
  }
  
  /**
   * Generate comprehensive modifier effectiveness report
   */
  generateModifierReport(allResults) {
    console.log('\n🏆 COMPREHENSIVE SITUATIONAL MODIFIER ANALYSIS');
    console.log('===============================================');
    
    // Aggregate all modifier statistics
    const aggregatedStats = {};
    
    allResults.forEach(result => {
      if (result.modifierStats) {
        Object.entries(result.modifierStats).forEach(([modifier, stats]) => {
          if (!aggregatedStats[modifier]) {
            aggregatedStats[modifier] = { usage: 0, applied: 0, successful: 0 };
          }
          aggregatedStats[modifier].usage += stats.usage;
          aggregatedStats[modifier].applied += stats.applied;
          aggregatedStats[modifier].successful += stats.successful * stats.applied;
        });
      }
    });
    
    // Calculate overall effectiveness
    const effectivenessReport = {};
    Object.entries(aggregatedStats).forEach(([modifier, stats]) => {
      if (stats.applied > 0) {
        const successRate = stats.successful / stats.applied;
        effectivenessReport[modifier] = {
          totalUsage: stats.usage,
          successRate: successRate,
          overallImpact: successRate * stats.usage
        };
      }
    });
    
    // Sort by overall impact
    const sortedImpact = Object.entries(effectivenessReport)
      .sort(([,a], [,b]) => b.overallImpact - a.overallImpact);
    
    console.log('\n📈 Most Impactful Modifiers:');
    sortedImpact.slice(0, 10).forEach(([modifier, stats]) => {
      console.log(`  • ${modifier}: ${stats.totalUsage} uses, ${(stats.successRate * 100).toFixed(1)}% success`);
    });
    
    // Suddenness specific analysis
    if (effectivenessReport.suddenness) {
      console.log(`\n🎯 SUDDENNESS ANALYSIS:`);
      console.log(`   Total Usage: ${effectivenessReport.suddenness.totalUsage}`);
      console.log(`   Success Rate: ${(effectivenessReport.suddenness.successRate * 100).toFixed(1)}%`);
      console.log(`   Overall Impact: ${effectivenessReport.suddenness.overallImpact.toFixed(1)}`);
      
      if (effectivenessReport.suddenness.successRate > 0.7) {
        console.log(`   ✅ Suddenness is highly effective - validates Hidden status design`);
      } else if (effectivenessReport.suddenness.successRate < 0.4) {
        console.log(`   ⚠️ Suddenness underperforming - may need adjustment`);
      }
    }
    
    // Balance recommendations
    this.generateModifierBalanceRecommendations(effectivenessReport);
  }
  
  /**
   * Generate balance recommendations based on modifier effectiveness
   */
  generateModifierBalanceRecommendations(effectivenessReport) {
    console.log('\n⚖️ MODIFIER BALANCE RECOMMENDATIONS:');
    
    // Check for overpowered modifiers
    const overpowered = Object.entries(effectivenessReport)
      .filter(([,stats]) => stats.successRate > 0.75 && stats.totalUsage > 10);
    
    if (overpowered.length > 0) {
      console.log('⚠️ Potentially Overpowered Modifiers:');
      overpowered.forEach(([modifier, stats]) => {
        console.log(`  • ${modifier}: ${(stats.successRate * 100).toFixed(1)}% success rate`);
      });
    }
    
    // Check for underpowered modifiers  
    const underpowered = Object.entries(effectivenessReport)
      .filter(([,stats]) => stats.successRate < 0.35 && stats.totalUsage > 10);
    
    if (underpowered.length > 0) {
      console.log('⚠️ Potentially Underpowered Modifiers:');
      underpowered.forEach(([modifier, stats]) => {
        console.log(`  • ${modifier}: ${(stats.successRate * 100).toFixed(1)}% success rate`);
      });
    }
    
    if (overpowered.length === 0 && underpowered.length === 0) {
      console.log('✅ All situational modifiers appear well-balanced!');
    }
  }
  
  // Test configuration methods
  createHiddenStatusTest() {
    return {
      name: "Hidden Status with Suddenness",
      sideA: {
        models: ["A-1", "A-2", "A-3", "A-4", "A-5"],
        archetype: "Average",
        weapon: "Sword, (Broad)",
        armor: ["Armored Gear"]
      },
      sideB: {
        models: ["B-1", "B-2", "B-3", "B-4", "B-5"], 
        archetype: "Average Sneak",
        weapon: "Daggers",
        armor: ["Armored Gear"]
      },
      bp: 300,
      specialRules: {
        hiddenStatus: true
      }
    };
  }
  
  // ... other test configuration methods
}