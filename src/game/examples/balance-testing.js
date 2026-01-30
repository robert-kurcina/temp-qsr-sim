// /src/examples/balance-testing.js
import { MonteCarloAnalyzer } from './analysis/MonteCarloAnalyzer.js';

// Test archetype balance
const archetypeTest = {
  'Veteran Squad': {
    name: "Veteran Squad Test",
    sideA: {
      name: "Veterans",
      models: ["A-1", "A-2", "A-3", "A-4"],
      archetype: "Veteran"
    },
    sideB: {
      name: "Average Squad", 
      models: ["B-1", "B-2", "B-3", "B-4", "B-5", "B-6"],
      archetype: "Average"
    }
  },
  'Elite Squad': {
    name: "Elite Squad Test",
    sideA: {
      name: "Elites",
      models: ["A-1", "A-2"],
      archetype: "Elite" 
    },
    sideB: {
      name: "Militia Horde",
      models: ["B-1", "B-2", "B-3", "B-4", "B-5", "B-6", "B-7", "B-8"],
      archetype: "Militia"
    }
  }
};

// Test weapon balance
const weaponTest = {
  'Sword Broad': {
    name: "Sword Broad Test",
    sideA: { weapons: ['Sword, (Broad)'] },
    sideB: { weapons: ['Sword, (Broad)'] }
  },
  'Longbow': {
    name: "Longbow Test", 
    sideA: { weapons: ['Bow, Long'] },
    sideB: { weapons: ['Bow, Long'] }
  }
};

async function runBalanceTests() {
  const analyzer = new MonteCarloAnalyzer();
  
  console.log("Testing Archetype Balance...");
  const archetypeResults = await analyzer.analyzeAssemblyCompositions(archetypeTest, 100);
  console.log("Archetype Analysis Complete:", archetypeResults);
  
  console.log("\nTesting Weapon Balance...");
  const weaponResults = await analyzer.analyzeAssemblyCompositions(weaponTest, 100);
  console.log("Weapon Analysis Complete:", weaponResults);
  
  // Save results to file
  require('fs').writeFileSync('balance-analysis.json', JSON.stringify({
    archetypeResults,
    weaponResults
  }, null, 2));
}

// Run the tests
runBalanceTests().catch(console.error);