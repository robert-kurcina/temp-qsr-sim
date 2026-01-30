// Main execution file
import { TestSuite } from './game/tests/TestSuite.js';

async function main() {
  const testSuite = new TestSuite();
  
  console.log("🚀 Starting Canonical Monte Carlo Test Suite");
  console.log("==========================================");
  
  // Run all 7 matchup tests
  const allTests = testSuite.createAllMatchupTests();
  
  for (const test of allTests) {
    const result = await testSuite.runTest(test, 100);
    console.log(`\n📊 ${result.testName}`);
    console.log(`Win Rates - Side A: ${(result.winRates.sideA * 100).toFixed(1)}%, Side B: ${(result.winRates.sideB * 100).toFixed(1)}%`);
    console.log(`Average Turns: ${result.averageTurns.toFixed(1)}`);
    console.log(`Avg Victory Points - Side A: ${result.victoryPoints.sideA.toFixed(1)}, Side B: ${result.victoryPoints.sideB.toFixed(1)}`);
    
    // Balance assessment
    const winDiff = Math.abs(result.winRates.sideA - result.winRates.sideB);
    if (winDiff < 0.1) {
      console.log("✅ BALANCED");
    } else if (winDiff < 0.2) {
      console.log("⚠️ SLIGHTLY IMBALANCED");
    } else {
      console.log("❌ SIGNIFICANTLY IMBALANCED");
    }
  }
  
  console.log("\n🎉 All tests completed!");
}

// Handle both Node.js and browser environments
if (typeof window === 'undefined') {
  // Node.js
  main().catch(console.error);
} else {
  // Browser - expose globally
  window.runMonteCarloTests = main;
}