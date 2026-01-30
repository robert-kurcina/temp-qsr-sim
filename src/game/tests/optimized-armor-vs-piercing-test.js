// /src/tests/optimized-armor-vs-piercing-test.js
import { ParallelMonteCarlo } from '../analysis/ParallelMonteCarlo.js';

/**
 * Optimized Armor Stack vs Warhammers test
 */
export class OptimizedArmorVsPiercingTest {
  constructor() {
    this.monteCarlo = new ParallelMonteCarlo();
  }
  
  /**
   * Create optimized test configuration
   */
  createOptimizedTest() {
    return {
      name: "Heavy Armor vs Warhammers (500 BP)",
      sideA: {
        name: "Heavy Armor Stack",
        models: Array.from({ length: 9 }, (_, i) => `A-${i + 1}`),
        archetype: "Untrained",
        weapons: ["Sword, (Broad)"],
        armor: ["Armor, Medium", "Shield, Medium", "Helmet", "Armored Gear"]
      },
      sideB: {
        name: "Warhammer Piercers",
        models: Array.from({ length: 8 }, (_, i) => `B-${i + 1}`),
        archetype: "Average", 
        weapons: ["Hammer, War"],
        armor: ["Armored Gear"]
      },
      bp: 500
    };
  }
  
  /**
   * Run optimized test
   */
  async runOptimizedTest() {
    console.log('🛡️⚔️ OPTIMIZED ARMOR vs PIERCING TEST');
    console.log('=====================================');
    
    const testConfig = this.createOptimizedTest();
    
    // Show configuration
    console.log(`Side A: ${testConfig.sideA.models.length} × Untrained + Heavy Armor = 55 BP each`);
    console.log(`Side B: ${testConfig.sideB.models.length} × Average + Warhammer = 60 BP each`);
    console.log(`BP Difference: 15 BP (within limits)`);
    
    // Run parallel Monte Carlo
    const results = await this.monteCarlo.runParallelAnalysis(testConfig, 200, 4);
    
    // Display results
    this.displayOptimizedResults(results);
    
    return results;
  }
  
  /**
   * Display optimized results
   */
  displayOptimizedResults(results) {
    console.log('\n📊 OPTIMIZED TEST RESULTS:');
    console.log(`Iterations: ${results.iterations}`);
    console.log(`Win Rates - Side A: ${(results.winRates.sideA * 100).toFixed(1)}%, Side B: ${(results.winRates.sideB * 100).toFixed(1)}%`);
    console.log(`Confidence Interval (95%): ±${(results.confidenceIntervals.margin * 100).toFixed(1)}%`);
    console.log(`Average Turns: ${results.averageTurns.toFixed(1)}`);
    
    // Balance assessment
    const winRateDiff = Math.abs(results.winRates.sideA - results.winRates.sideB);
    if (winRateDiff < 0.1) {
      console.log('✅ BALANCED: Within acceptable range');
    } else if (winRateDiff < 0.2) {
      console.log('⚠️  SLIGHTLY IMBALANCED: May need minor adjustment');
    } else {
      console.log('❌ SIGNIFICANTLY IMBALANCED: Requires BP cost adjustment');
    }
  }
}

// Run if executed directly
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  const test = new OptimizedArmorVsPiercingTest();
  test.runOptimizedTest().catch(console.error);
}