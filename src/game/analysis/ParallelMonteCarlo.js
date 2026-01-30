// /src/analysis/ParallelMonteCarlo.js
import { OptimizedHeadlessSimulator } from '../simulator/OptimizedHeadlessSimulator.js';

/**
 * Parallel Monte Carlo execution for maximum efficiency
 */
export class ParallelMonteCarlo {
  constructor() {
    this.simulator = new OptimizedHeadlessSimulator({
      debugMode: false,
      earlyTermination: true
    });
  }
  
  /**
   * Run parallel Monte Carlo analysis
   */
  async runParallelAnalysis(testConfig, totalIterations = 100, maxWorkers = 4) {
    // Determine optimal worker count
    const workers = Math.min(maxWorkers, totalIterations, this.getOptimalWorkerCount());
    const iterationsPerWorker = Math.ceil(totalIterations / workers);
    
    console.log(`Running ${totalIterations} iterations across ${workers} workers...`);
    
    // Create worker promises
    const workerPromises = [];
    let completedIterations = 0;
    
    for (let i = 0; i < workers; i++) {
      const iterations = i === workers - 1 
        ? totalIterations - completedIterations 
        : iterationsPerWorker;
      
      workerPromises.push(this.runWorkerBatch(testConfig, iterations));
      completedIterations += iterations;
    }
    
    // Execute in parallel
    const startTime = Date.now();
    const results = await Promise.all(workerPromises);
    const totalTime = Date.now() - startTime;
    
    // Merge results
    const mergedResults = this.mergeWorkerResults(results);
    
    console.log(`Completed ${totalIterations} iterations in ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`Average time per iteration: ${(totalTime / totalIterations).toFixed(2)}ms`);
    
    return mergedResults;
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
        continue;
      }
    }
    
    return results;
  }
  
  /**
   * Merge results from multiple workers
   */
  mergeWorkerResults(workerResults) {
    const allResults = workerResults.flat();
    
    // Calculate statistics
    const sideAWins = allResults.filter(r => r.winner === 'side-a').length;
    const sideBWins = allResults.filter(r => r.winner === 'side-b').length;
    const draws = allResults.filter(r => r.winner === 'draw').length;
    
    const total = allResults.length;
    
    return {
      iterations: total,
      winRates: {
        sideA: sideAWins / total,
        sideB: sideBWins / total,
        draw: draws / total
      },
      confidenceIntervals: this.calculateConfidenceIntervals(sideAWins, total),
      averageTurns: allResults.reduce((sum, r) => sum + r.turns, 0) / total,
      results: allResults
    };
  }
  
  /**
   * Calculate 95% confidence intervals
   */
  calculateConfidenceIntervals(wins, total) {
    const p = wins / total;
    const standardError = Math.sqrt((p * (1 - p)) / total);
    const marginOfError = 1.96 * standardError;
    
    return {
      lower: Math.max(0, p - marginOfError),
      upper: Math.min(1, p + marginOfError),
      margin: marginOfError
    };
  }
  
  /**
   * Get optimal worker count based on system
   */
  getOptimalWorkerCount() {
    // In Node.js, use available CPU cores
    if (typeof require !== 'undefined') {
      try {
        const os = require('os');
        return os.cpus().length;
      } catch (e) {
        return 4;
      }
    }
    // In browser, limit to prevent UI blocking
    return 2;
  }
}