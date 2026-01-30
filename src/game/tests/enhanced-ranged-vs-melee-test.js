// /src/tests/enhanced-ranged-vs-melee-test.js
import { BalanceTestFramework } from '../analysis/BalanceTestFramework.js';
import { FiddleActionSystem } from '../ai/FiddleActionSystem.js';

/**
 * Enhanced Balance Test with Fiddle Action Costs
 */
export class EnhancedRangedVsMeleeTest {
  constructor() {
    this.framework = new BalanceTestFramework();
    this.fiddleSystem = new FiddleActionSystem();
  }
  
  /**
   * Create test with proper Fiddle cost analysis
   */
  createEnhancedTest() {
    const testConfig = this.framework.createStandardTestConfig(
      'Longbow+Dagger vs Saber (350 BP - Fiddle Costs)',
      {
        name: 'Flexible Ranged',
        count: 6,
        assembly: 'Average',
        weapons: ['Bow, Long', 'Daggers'], // Dual-wield capability
        armor: ['Armor, Light']
      },
      {
        name: 'Specialized Melee',
        count: 6,
        assembly: 'Average', 
        weapons: ['Sword, Saber'],
        armor: ['Shield, Medium', 'Armored Gear']
      },
      350
    );
    
    // Add Fiddle cost metadata
    testConfig.sideA.fiddleComplexity = 'high'; // Multiple weapons require switching
    testConfig.sideB.fiddleComplexity = 'low';  // Single weapon, always ready
    
    return testConfig;
  }
  
  /**
   * Analyze Fiddle cost impact on balance
   */
  analyzeFiddleImpact(results, testConfig) {
    console.log('\n🔧 Fiddle Action Cost Analysis:');
    
    // Calculate theoretical Fiddle costs per turn
    const sideAFiddleCosts = this.calculateAverageFiddleCosts('side-a', testConfig);
    const sideBFiddleCosts = this.calculateAverageFiddleCosts('side-b', testConfig);
    
    console.log(`Side A (Ranged+Dagger): Average ${sideAFiddleCosts.avgSwitches} weapon switches per engagement`);
    console.log(`  Estimated AP cost: ${sideAFiddleCosts.avgCost} AP per turn`);
    console.log(`Side B (Saber only): ${sideBFiddleCosts.avgSwitches} weapon switches per engagement`);
    console.log(`  Estimated AP cost: ${sideBFiddleCosts.avgCost} AP per turn`);
    
    // Adjust BP efficiency for Fiddle costs
    const adjustedBPEfficiencyA = results.bpEfficiency.sideA * (1 - sideAFiddleCosts.avgCost / 2);
    const adjustedBPEfficiencyB = results.bpEfficiency.sideB;
    
    console.log(`\n📊 Adjusted BP Efficiency (accounting for Fiddle costs):`);
    console.log(`Side A: ${adjustedBPEfficiencyA.toExponential(2)}`);
    console.log(`Side B: ${adjustedBPEfficiencyB.toExponential(2)}`);
    
    if (adjustedBPEfficiencyA < results.bpEfficiency.sideA * 0.8) {
      console.log('⚠️  Fiddle costs significantly reduce ranged build effectiveness');
      console.log('💡 Consider if 19 BP total for Longbow+Dagger provides sufficient value');
    }
  }
  
  /**
   * Calculate average Fiddle costs
   */
  calculateAverageFiddleCosts(side, testConfig) {
    if (side === 'side-b') {
      return { avgSwitches: 0, avgCost: 0 };
    }
    
    // Side A needs to switch between ranged and melee
    // Estimate based on typical engagement patterns
    const engagementsPerTurn = 0.6; // 60% chance of needing to switch
    const switchesPerEngagement = 1; // One switch (ranged ↔ melee)
    
    // First switch is often free (0 AP), subsequent switches cost 1 AP
    const avgCostPerSwitch = 0.3; // Weighted average considering free first switch
    
    return {
      avgSwitches: engagementsPerTurn * switchesPerEngagement,
      avgCost: engagementsPerTurn * avgCostPerSwitch
    };
  }
  
  async runEnhancedTest(iterations = 100) {
    console.log('🎯 ENHANCED RANGED vs MELEE Balance Test');
    console.log('=======================================');
    console.log('Testing with Fiddle Action Costs accounted for');
    console.log('Longbow + Dagger flexibility vs Saber specialization');
    
    const testConfig = this.createEnhancedTest();
    const results = await this.framework.runBalanceTest(
      'Ranged vs Melee (Fiddle Costs)',
      testConfig,
      iterations
    );
    
    this.framework.printTestResults('Ranged vs Melee (Fiddle Costs)', results);
    this.analyzeFiddleImpact(results, testConfig);
    
    return results;
  }
}