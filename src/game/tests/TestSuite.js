// Test suite for running Monte Carlo simulations
import CanonicalMonteCarlo from '../simulator/CanonicalMonteCarlo.js';

export class TestSuite {
  constructor() {
    this.simulator = new CanonicalMonteCarlo();
  }
  
  async runTest(testConfig, iterations = 100) {
    console.log(`Running ${testConfig.name} - ${iterations} iterations`);
    
    const results = [];
    for (let i = 0; i < iterations; i++) {
      try {
        const result = this.simulator.simulateBattle(testConfig);
        results.push(result);
      } catch (error) {
        console.error(`Iteration ${i + 1} failed:`, error);
      }
    }
    
    return this.analyzeResults(results, testConfig);
  }
  
  analyzeResults(results, testConfig) {
    const validResults = results.filter(r => r.winner);
    
    if (validResults.length === 0) {
      return { error: 'No valid results' };
    }
    
    const sideAWins = validResults.filter(r => r.winner === 'side-a').length;
    const sideBWins = validResults.filter(r => r.winner === 'side-b').length;
    const draws = validResults.filter(r => r.winner === 'draw').length;
    
    const total = validResults.length;
    
    // Calculate confidence intervals (95%)
    const p = sideAWins / total;
    const standardError = Math.sqrt((p * (1 - p)) / total);
    const marginOfError = 1.96 * standardError;
    
    return {
      testName: testConfig.name,
      iterations: total,
      winRates: {
        sideA: sideAWins / total,
        sideB: sideBWins / total,
        draw: draws / total
      },
      confidenceInterval: {
        lower: Math.max(0, p - marginOfError),
        upper: Math.min(1, p + marginOfError),
        margin: marginOfError
      },
      averageTurns: validResults.reduce((sum, r) => sum + r.turns, 0) / total,
      victoryPoints: {
        sideA: validResults.reduce((sum, r) => sum + r.victoryPoints.sideA, 0) / total,
        sideB: validResults.reduce((sum, r) => sum + r.victoryPoints.sideB, 0) / total
      },
      resourcePoints: {
        sideA: validResults.reduce((sum, r) => sum + r.resourcePoints.sideA, 0) / total,
        sideB: validResults.reduce((sum, r) => sum + r.resourcePoints.sideB, 0) / total
      }
    };
  }
  
  // Test 5: Longbow vs Axe Long with optimal conditions
  createTest5Optimal() {
    return {
      name: "Longbow vs Axe Long - Optimal Axe Conditions (4MU Vis, 75% Terrain)",
      sideA: {
        models: Array.from({ length: 9 }, (_, i) => `A-${i + 1}`),
        archetype: "Average",
        weapon: "Bow, Long",
        armor: {}
      },
      sideB: {
        models: Array.from({ length: 7 }, (_, i) => `B-${i + 1}`),
        archetype: "Average", 
        weapon: "Axe, Long",
        armor: {}
      },
      bp: 350 // Small game
    };
  }
  
  // All 7 matchup tests
  createAllMatchupTests() {
    return [
      // Test 1: Tactics vs Leadership
      {
        name: "Tactics vs Leadership",
        sideA: {
          models: Array.from({ length: 8 }, (_, i) => `A-${i + 1}`),
          archetype: "Average",
          weapon: "Sword, (Broad)",
          armor: { suit: "Armor, Light", shield: "Shield, Light" }
        },
        sideB: {
          models: Array.from({ length: 7 }, (_, i) => `B-${i + 1}`),
          archetype: "Average",
          weapon: "Sword, (Broad)", 
          armor: { suit: "Armor, Medium", shield: "Shield, Medium" }
        },
        bp: 500
      },
      // Test 2: Armor Stack vs Warhammers
      {
        name: "Heavy Armor vs Warhammers",
        sideA: {
          models: Array.from({ length: 9 }, (_, i) => `A-${i + 1}`),
          archetype: "Untrained",
          weapon: "Sword, (Broad)",
          armor: { suit: "Armor, Medium", shield: "Shield, Medium", helm: "Helmet, Medium" }
        },
        sideB: {
          models: Array.from({ length: 8 }, (_, i) => `B-${i + 1}`),
          archetype: "Average",
          weapon: "Hammer, War",
          armor: {}
        },
        bp: 500
      },
      // Test 3: Spear Reach vs Veteran Sword
      {
        name: "Spear Reach vs Veteran Sword",
        sideA: {
          models: Array.from({ length: 7 }, (_, i) => `A-${i + 1}`),
          archetype: "Average",
          weapon: "Spear, Medium",
          armor: { suit: "Armor, Light" }
        },
        sideB: {
          models: Array.from({ length: 4 }, (_, i) => `B-${i + 1}`),
          archetype: "Veteran",
          weapon: "Sword, (Broad)",
          armor: { suit: "Armor, Medium", shield: "Shield, Medium" }
        },
        bp: 500
      },
      // Test 4: Dual Daggers vs Saber
      {
        name: "Dual Daggers vs Saber",
        sideA: {
          models: Array.from({ length: 10 }, (_, i) => `A-${i + 1}`),
          archetype: "Average",
          weapon: "Daggers",
          armor: {}
        },
        sideB: {
          models: Array.from({ length: 8 }, (_, i) => `B-${i + 1}`),
          archetype: "Average",
          weapon: "Sword, Saber",
          armor: { shield: "Shield, Medium" }
        },
        bp: 500
      },
      // Test 5: Longbow vs Axe Long (already defined above)
      this.createTest5Optimal(),
      // Test 6: Veteran Grit vs Warhammer
      {
        name: "Veteran Grit vs Warhammer",
        sideA: {
          models: Array.from({ length: 6 }, (_, i) => `A-${i + 1}`),
          archetype: "Veteran",
          weapon: "Sword, (Broad)",
          armor: { suit: "Armor, Light" }
        },
        sideB: {
          models: Array.from({ length: 7 }, (_, i) => `B-${i + 1}`),
          archetype: "Average",
          weapon: "Hammer, War",
          armor: { suit: "Armor, Medium" }
        },
        bp: 500
      },
      // Test 7: Militia vs Veteran
      {
        name: "Militia vs Veteran",
        sideA: {
          models: Array.from({ length: 16 }, (_, i) => `A-${i + 1}`),
          archetype: "Militia",
          weapon: "Sword, (Broad)",
          armor: { suit: "Armor, Light" }
        },
        sideB: {
          models: Array.from({ length: 8 }, (_, i) => `B-${i + 1}`),
          archetype: "Veteran",
          weapon: "Sword, (Broad)",
          armor: { suit: "Armor, Medium", shield: "Shield, Medium" }
        },
        bp: 500
      }
    ];
  }
}