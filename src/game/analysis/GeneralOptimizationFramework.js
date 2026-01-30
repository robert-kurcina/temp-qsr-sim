// /src/analysis/GeneralizedOptimizationFramework.js
import { OptimizedHeadlessSimulator } from '../simulator/OptimizedHeadlessSimulator.js';

/**
 * Generalized optimization framework for any MEST QSR balance test
 */
export class GeneralizedOptimizationFramework {
  constructor() {
    this.simulator = new OptimizedHeadlessSimulator({
      debugMode: false,
      earlyTermination: true
    });
    this.combatCache = new Map();
    this.traitCache = new Map();
    this.configCache = new Map();
  }
  
  /**
   * Generic test configuration builder
   */
  buildTestConfig(testName, sideAConfig, sideBConfig, bpLimit = 500) {
    const cacheKey = `${testName}-${bpLimit}`;
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }
    
    // Calculate optimal model counts
    const sideACost = this.calculateTotalCost(sideAConfig);
    const sideBCost = this.calculateTotalCost(sideBConfig);
    
    const sideACount = Math.floor(bpLimit / sideACost);
    const sideBCount = Math.floor(bpLimit / sideBCost);
    
    // Ensure minimum model count (4 for small games)
    const finalSideACount = Math.max(4, sideACount);
    const finalSideBCount = Math.max(4, sideBCount);
    
    // Recalculate BP usage
    const finalSideABP = finalSideACount * sideACost;
    const finalSideBBP = finalSideBCount * sideBCost;
    
    // Ensure BP difference is within limits
    const bpDifference = Math.abs(finalSideABP - finalSideBBP);
    const maxAllowedDiff = Math.min(25, bpLimit * 0.05);
    
    if (bpDifference > maxAllowedDiff) {
      // Adjust to minimize difference
      const adjustedConfig = this.adjustForBalance(
        sideAConfig, sideBConfig, finalSideACount, finalSideBCount, bpLimit
      );
      return this.buildTestConfig(testName, adjustedConfig.sideA, adjustedConfig.sideB, bpLimit);
    }
    
    const config = {
      name: testName,
      sideA: {
        name: sideAConfig.name || 'Side A',
        models: Array.from({ length: finalSideACount }, (_, i) => `A-${i + 1}`),
        archetype: sideAConfig.archetype,
        weapons: [sideAConfig.weapon],
        armor: sideAConfig.armor || [],
        equipment: sideAConfig.equipment || []
      },
      sideB: {
        name: sideBConfig.name || 'Side B',
        models: Array.from({ length: finalSideBCount }, (_, i) => `B-${i + 1}`),
        archetype: sideBConfig.archetype,
        weapons: [sideBConfig.weapon],
        armor: sideBConfig.armor || [],
        equipment: sideBConfig.equipment || []
      },
      bp: bpLimit,
      bpUsage: {
        sideA: finalSideABP,
        sideB: finalSideBBP,
        difference: bpDifference
      }
    };
    
    this.configCache.set(cacheKey, config);
    return config;
  }
  
  /**
   * Calculate total cost for a character configuration
   */
  calculateTotalCost(config) {
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
      'Hammer, War': 25,
      'Axe, Long': 27,
      'Sword, Saber': 13,
      'Club, Spiked Mace': 11
    };
    
    const armorCosts = {
      'Helmet': 3,
      'Shield, Small': 8,
      'Shield, Light': 8,
      'Shield, Medium': 10,
      'Armored Gear': 5,
      'Armor, Light': 8,
      'Armor, Medium': 13,
      'Armor, Heavy': 15
    };
    
    let totalCost = archetypeCosts[config.archetype] || 30;
    totalCost += weaponCosts[config.weapon] || 0;
    
    if (config.armor) {
      config.armor.forEach(item => {
        totalCost += armorCosts[item] || 0;
      });
    }
    
    if (config.equipment) {
      config.equipment.forEach(item => {
        // Equipment costs would be added here
        totalCost += 0; // Placeholder
      });
    }
    
    return totalCost;
  }
  
  /**
   * Adjust configuration for better BP balance
   */
  adjustForBalance(sideAConfig, sideBConfig, sideACount, sideBCount, bpLimit) {
    // Try different combinations to minimize BP difference
    const combinations = [];
    
    for (let a = Math.max(4, sideACount - 2); a <= sideACount + 2; a++) {
      for (let b = Math.max(4, sideBCount - 2); b <= sideBCount + 2; b++) {
        const costA = a * this.calculateTotalCost(sideAConfig);
        const costB = b * this.calculateTotalCost(sideBConfig);
        
        if (costA <= bpLimit && costB <= bpLimit) {
          combinations.push({
            sideA: { ...sideAConfig, count: a },
            sideB: { ...sideBConfig, count: b },
            difference: Math.abs(costA - costB),
            total: costA + costB
          });
        }
      }
    }
    
    // Return combination with smallest BP difference
    return combinations.sort((a, b) => a.difference - b.difference)[0] || {
      sideA: sideAConfig,
      sideB: sideBConfig
    };
  }
  
  /**
   * Run generic Monte Carlo test
   */
  async runGenericMonteCarlo(testConfig, iterations = 100, workers = 4) {
    const workerPromises = [];
    const iterationsPerWorker = Math.ceil(iterations / workers);
    
    for (let i = 0; i < workers; i++) {
      const workerIterations = i === workers - 1 
        ? iterations - (iterationsPerWorker * (workers - 1))
        : iterationsPerWorker;
      
      workerPromises.push(this.runWorkerBatch(testConfig, workerIterations));
    }
    
    const results = await Promise.all(workerPromises);
    return this.mergeResults(results.flat());
  }
  
  /**
   * Run single worker batch
   */
  async runWorkerBatch(testConfig, iterations) {
    const results = [];
    for (let i = 0; i < iterations; i++) {
      try {
        const result = this.simulator.simulateBattle(testConfig);
        results.push(result);
      } catch (error) {
        // Skip failed simulations
      }
    }
    return results;
  }
  
  /**
   * Merge and analyze results
   */
  mergeResults(allResults) {
    const sideAWins = allResults.filter(r => r.winner === 'side-a').length;
    const sideBWins = allResults.filter(r => r.winner === 'side-b').length;
    const draws = allResults.filter(r => r.winner === 'draw').length;
    const total = allResults.length;
    
    const winRateA = sideAWins / total;
    const winRateB = sideBWins / total;
    
    // Calculate confidence intervals
    const p = winRateA;
    const standardError = Math.sqrt((p * (1 - p)) / total);
    const marginOfError = 1.96 * standardError;
    
    return {
      iterations: total,
      winRates: { sideA: winRateA, sideB: winRateB, draw: draws / total },
      confidence: {
        lower: Math.max(0, p - marginOfError),
        upper: Math.min(1, p + marginOfError),
        margin: marginOfError
      },
      averageTurns: allResults.reduce((sum, r) => sum + r.turns, 0) / total,
      balanceAssessment: this.assessBalance(winRateA, winRateB)
    };
  }
  
  /**
   * Assess balance based on win rates
   */
  assessBalance(winRateA, winRateB) {
    const difference = Math.abs(winRateA - winRateB);
    if (difference < 0.1) return 'balanced';
    if (difference < 0.2) return 'slightly_imbalanced';
    if (difference < 0.3) return 'moderately_imbalanced';
    return 'severely_imbalanced';
  }
}