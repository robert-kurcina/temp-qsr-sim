// /src/analysis/BalanceTestFramework.js
import { EnhancedBattleSimulator } from '../simulator/EnhancedBattleSimulator.js';

export class BalanceTestFramework {
  constructor() {
    this.simulator = new EnhancedBattleSimulator();
    this.testResults = new Map();
  }
  
  /**
   * Create standardized test configuration
   */
  createStandardTestConfig(name, sideAConfig, sideBConfig, bpLimit = 350) {
    return {
      name: name,
      gameSize: 'small',
      sideA: {
        name: sideAConfig.name,
        models: this.generateModelIds(sideAConfig.count, 'A'),
        assembly: sideAConfig.assembly,
        weapons: sideAConfig.weapons,
        armor: sideAConfig.armor,
        bp: bpLimit
      },
      sideB: {
        name: sideBConfig.name,
        models: this.generateModelIds(sideBConfig.count, 'B'),
        assembly: sideBConfig.assembly,
        weapons: sideBConfig.weapons,
        armor: sideBConfig.armor,
        bp: bpLimit
      },
      specialRules: {
        turnLimit: 8
      }
    };
  }
  
  /**
   * Generate model IDs
   */
  generateModelIds(count, prefix) {
    return Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}`);
  }
  
  /**
   * Calculate optimal model count for BP limit
   */
  calculateOptimalModelCount(archetype, weapon, armor, bpLimit) {
    const archetypeCosts = {
      'Untrained': 7,
      'Militia': 20,
      'Average': 30,
      'Veteran': 61,
      'Elite': 129
    };
    
    const weaponCosts = {
      'Sword, (Broad)': 17,
      'Spear, Medium': 30,
      'Daggers': 6,
      'Bow, Long': 13,
      'Club, Spiked Mace': 11,
      'Hammer, War': 25
    };
    
    const armorCosts = {
      'None': 0,
      'Helmet': 3,
      'Shield, Small': 8,
      'Shield, Light': 8,
      'Shield, Medium': 10,
      'Armored Gear': 5,
      'Armor, Light': 8,
      'Armor, Medium': 13,
      'Armor, Heavy': 15
    };
    
    const baseCost = archetypeCosts[archetype] || 30;
    const weaponCost = weaponCosts[weapon] || 0;
    const armorCost = armorCosts[armor] || 0;
    
    const totalCostPerModel = baseCost + weaponCost + armorCost;
    return Math.floor(bpLimit / totalCostPerModel);
  }
  
  /**
   * Run balance test
   */
  async runBalanceTest(testName, testConfig, iterations = 100) {
    console.log(`\n🚀 Running Balance Test: ${testName}`);
    console.log(`Iterations: ${iterations}`);
    console.log(`BP Limit: ${testConfig.sideA.bp}`);
    
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      if (i % 20 === 0) {
        const progress = ((i / iterations) * 100).toFixed(1);
        const elapsed = Date.now() - startTime;
        const eta = (elapsed / (i + 1)) * (iterations - i - 1);
        console.log(`  Progress: ${progress}% | ETA: ${Math.ceil(eta / 1000)}s`);
      }
      
      try {
        const result = await this.runSingleTest(testConfig);
        results.push(result);
      } catch (error) {
        console.error(`Test iteration ${i} failed:`, error);
      }
    }
    
    const analysis = this.analyzeTestResults(results, testConfig);
    this.testResults.set(testName, analysis);
    
    return analysis;
  }
  
  /**
   * Run single test iteration
   */
  runSingleTest(testConfig) {
    return new Promise((resolve) => {
      // Simulate the battle
      const simulationResult = this.simulator.simulateBattle(testConfig, {
        logLevel: 'basic',
        maxTurns: 8,
        recordActions: false
      });
      
      resolve(simulationResult.result);
    });
  }
  
  /**
   * Analyze test results
   */
  analyzeTestResults(results, testConfig) {
    const totalResults = results.length;
    if (totalResults === 0) {
      throw new Error('No valid test results');
    }
    
    // Calculate win rates
    const sideAWins = results.filter(r => r.winner === 'side-a').length;
    const sideBWins = results.filter(r => r.winner === 'side-b').length;
    const draws = results.filter(r => r.winner === 'draw').length;
    
    const winRateA = sideAWins / totalResults;
    const winRateB = sideBWins / totalResults;
    const drawRate = draws / totalResults;
    
    // Calculate average metrics
    const avgTurns = results.reduce((sum, r) => sum + r.turns, 0) / totalResults;
    const avgCasualtiesA = results.reduce((sum, r) => sum + r.casualties.sideA, 0) / totalResults;
    const avgCasualtiesB = results.reduce((sum, r) => sum + r.casualties.sideB, 0) / totalResults;
    
    // Calculate survival rates
    const initialModelsA = testConfig.sideA.models.length;
    const initialModelsB = testConfig.sideB.models.length;
    const survivalRateA = 1 - (avgCasualtiesA / initialModelsA);
    const survivalRateB = 1 - (avgCasualtiesB / initialModelsB);
    
    // Calculate BP efficiency (wins per BP spent)
    const bpEfficiencyA = winRateA / testConfig.sideA.bp;
    const bpEfficiencyB = winRateB / testConfig.sideB.bp;
    
    // Statistical significance
    const standardErrorA = Math.sqrt((winRateA * (1 - winRateA)) / totalResults);
    const confidenceIntervalA = [winRateA - 1.96 * standardErrorA, winRateA + 1.96 * standardErrorA];
    
    return {
      testName: testConfig.name,
      iterations: totalResults,
      winRates: {
        sideA: winRateA,
        sideB: winRateB,
        draw: drawRate
      },
      averages: {
        turns: avgTurns,
        casualties: {
          sideA: avgCasualtiesA,
          sideB: avgCasualtiesB
        },
        survivalRates: {
          sideA: survivalRateA,
          sideB: survivalRateB
        }
      },
      bpEfficiency: {
        sideA: bpEfficiencyA,
        sideB: bpEfficiencyB
      },
      statisticalSignificance: {
        sideA: {
          standardError: standardErrorA,
          confidenceInterval: confidenceIntervalA
        }
      },
      balanceAssessment: this.assessBalance(winRateA, winRateB),
      recommendations: this.generateRecommendations(testConfig, winRateA, winRateB)
    };
  }
  
  /**
   * Assess balance between sides
   */
  assessBalance(winRateA, winRateB) {
    const difference = Math.abs(winRateA - winRateB);
    const ratio = Math.max(winRateA, winRateB) / Math.min(winRateA, winRateB);
    
    if (difference < 0.05) {
      return 'balanced';
    } else if (difference < 0.15) {
      return 'slightly_imbalanced';
    } else if (difference < 0.25) {
      return 'moderately_imbalanced';
    } else {
      return 'severely_imbalanced';
    }
  }
  
  /**
   * Generate balance recommendations
   */
  generateRecommendations(testConfig, winRateA, winRateB) {
    const recommendations = [];
    const difference = winRateA - winRateB;
    
    if (Math.abs(difference) < 0.05) {
      recommendations.push('Current balance appears fair');
    } else if (difference > 0.15) {
      recommendations.push('Side A appears overpowered');
      recommendations.push('Consider reducing Side A BP cost or increasing Side B effectiveness');
    } else if (difference < -0.15) {
      recommendations.push('Side B appears overpowered');
      recommendations.push('Consider reducing Side B BP cost or increasing Side A effectiveness');
    }
    
    // Specific recommendations based on equipment
    if (testConfig.sideA.weapons.includes('Spear, Medium') && difference > 0.1) {
      recommendations.push('Spear, Medium may be too effective for its 30 BP cost');
    }
    
    if (testConfig.sideB.weapons.includes('Sword, (Broad)') && difference < -0.1) {
      recommendations.push('Sword, (Broad) may be too effective for its 17 BP cost');
    }
    
    return recommendations;
  }
  
  /**
   * Print test results
   */
  printTestResults(testName, analysis) {
    console.log(`\n📊 ${testName} Results:`);
    console.log(`   Iterations: ${analysis.iterations}`);
    console.log(`   Win Rates - Side A: ${(analysis.winRates.sideA * 100).toFixed(1)}%, Side B: ${(analysis.winRates.sideB * 100).toFixed(1)}%`);
    console.log(`   Draw Rate: ${(analysis.winRates.draw * 100).toFixed(1)}%`);
    console.log(`   Average Turns: ${analysis.averages.turns.toFixed(1)}`);
    console.log(`   Survival Rates - Side A: ${(analysis.averages.survivalRates.sideA * 100).toFixed(1)}%, Side B: ${(analysis.averages.survivalRates.sideB * 100).toFixed(1)}%`);
    console.log(`   BP Efficiency - Side A: ${analysis.bpEfficiency.sideA.toExponential(2)}, Side B: ${analysis.bpEfficiency.sideB.toExponential(2)}`);
    console.log(`   Balance Assessment: ${analysis.balanceAssessment}`);
    
    if (analysis.recommendations.length > 0) {
      console.log(`   Recommendations:`);
      analysis.recommendations.forEach(rec => console.log(`     • ${rec}`));
    }
  }
  
  /**
   * Save results to file
   */
  saveResultsToFile(filename = 'balance-test-results.json') {
    const serializableResults = {};
    for (const [name, analysis] of this.testResults.entries()) {
      serializableResults[name] = analysis;
    }
    
    // In Node.js environment
    if (typeof require !== 'undefined') {
      const fs = require('fs');
      fs.writeFileSync(filename, JSON.stringify(serializableResults, null, 2));
      console.log(`\n💾 Results saved to ${filename}`);
    }
  }
}