// /src/tests/sequential-progress-tracker.js
import { ComprehensiveMatchupTests } from './comprehensive-matchup-tests.js';

/**
 * Sequential testing with progress tracking and checkpointing
 */
export class SequentialProgressTracker {
  constructor() {
    this.tests = new ComprehensiveMatchupTests();
    this.progress = {
      waitStatus: {
        completed: 0,
        total: 0,
        results: {},
        checkpoint: 'wait_status_checkpoint.json'
      },
      hiddenStatus: {
        completed: 0,
        total: 0,
        results: {},
        checkpoint: 'hidden_status_checkpoint.json'
      }
    };
  }
  
  /**
   * Load existing progress from checkpoint
   */
  loadCheckpoint(testType) {
    try {
      // In real implementation, this would load from file
      // For now, we'll simulate checkpoint loading
      const checkpointData = this.getSimulatedCheckpoint(testType);
      if (checkpointData) {
        this.progress[testType] = { ...this.progress[testType], ...checkpointData };
        console.log(`✅ Loaded checkpoint for ${testType}: ${this.progress[testType].completed}/${this.progress[testType].total}`);
      }
    } catch (error) {
      console.log(`ℹ️ No checkpoint found for ${testType}, starting fresh`);
    }
  }
  
  /**
   * Save progress checkpoint
   */
  saveCheckpoint(testType) {
    const checkpointData = {
      completed: this.progress[testType].completed,
      total: this.progress[testType].total,
      results: this.progress[testType].results
    };
    
    // In real implementation, this would save to file
    console.log(`💾 Checkpoint saved for ${testType}: ${this.progress[testType].completed}/${this.progress[testType].total}`);
    
    // Simulate checkpoint persistence
    this.setSimulatedCheckpoint(testType, checkpointData);
  }
  
  /**
   * Run sequential tests with progress reporting
   */
  async runSequentialTests(testType = 'wait') {
    console.log(`\n🚀 STARTING SEQUENTIAL ${testType.toUpperCase()} STATUS TESTING`);
    console.log('=================================================');
    
    // Load existing progress
    this.loadCheckpoint(testType);
    
    // Generate test configurations
    let testConfigs;
    if (testType === 'wait') {
      testConfigs = await this.tests.createWaitStatusTest();
    } else {
      testConfigs = await this.tests.createHiddenStatusTest();
    }
    
    // Sample 50 tests for analysis
    const sampledTests = this.tests.sampleTests(testConfigs, 50);
    this.progress[testType].total = sampledTests.length;
    
    console.log(`📋 Total tests to run: ${sampledTests.length}`);
    console.log(`📊 Current progress: ${this.progress[testType].completed}/${this.progress[testType].total}`);
    
    // Resume from where we left off
    const remainingTests = sampledTests.slice(this.progress[testType].completed);
    
    for (let i = 0; i < remainingTests.length; i++) {
      const config = remainingTests[i];
      const testIndex = this.progress[testType].completed + i + 1;
      
      try {
        console.log(`\n🧪 Test ${testIndex}/${this.progress[testType].total}: ${config.name}`);
        
        const result = await this.tests.framework.runGenericMonteCarlo(config, 75, 2);
        
        // Store result
        this.progress[testType].results[config.name] = result;
        this.progress[testType].completed = testIndex;
        
        // Check for interesting deviations
        this.checkForInterestingResults(testType, config, result, testIndex);
        
        // Save checkpoint every 5 tests
        if (testIndex % 5 === 0 || testIndex === this.progress[testType].total) {
          this.saveCheckpoint(testType);
          console.log(`📈 Progress: ${testIndex}/${this.progress[testType].total} (${((testIndex / this.progress[testType].total) * 100).toFixed(1)}%)`);
        }
        
      } catch (error) {
        console.error(`❌ Test ${testIndex} failed: ${config.name}`, error);
        this.progress[testType].results[config.name] = { error: error.message };
        this.saveCheckpoint(testType);
      }
    }
    
    console.log(`\n🎉 ${testType.toUpperCase()} STATUS TESTING COMPLETE!`);
    this.generateFinalSummary(testType);
  }
  
  /**
   * Check for interesting results that deviate from expectations
   */
  checkForInterestingResults(testType, config, result, testIndex) {
    if (result.error) return;
    
    const statusWinRate = result.winRates.sideB; // Side B has the status
    
    // Expected ranges based on game design
    const expectedMin = 0.45;
    const expectedMax = 0.65;
    
    if (statusWinRate < expectedMin) {
      console.log(`⚠️  UNEXPECTED: ${testType} status underperforming!`);
      console.log(`   Configuration: ${config.name}`);
      console.log(`   Win Rate: ${(statusWinRate * 100).toFixed(1)}% (expected ≥${expectedMin * 100}%)`);
      console.log(`   This suggests ${testType} status may need enhancement`);
    } else if (statusWinRate > expectedMax) {
      console.log(`⚠️  UNEXPECTED: ${testType} status overpowered!`);
      console.log(`   Configuration: ${config.name}`);
      console.log(`   Win Rate: ${(statusWinRate * 100).toFixed(1)}% (expected ≤${expectedMax * 100}%)`);
      console.log(`   This suggests ${testType} status may need nerfing`);
    }
    
    // Specific archetype insights
    if (config.sideA.archetype === 'Elite' && statusWinRate < 0.5) {
      console.log(`🔍 INSIGHT: Elite archetype doesn't benefit much from ${testType} status`);
    }
    
    if (config.sideA.archetype.includes('Sneak') && statusWinRate > 0.7) {
      console.log(`🔍 INSIGHT: Sneak variants excel with ${testType} status`);
    }
  }
  
  /**
   * Generate final summary report
   */
  generateFinalSummary(testType) {
    const results = this.progress[testType].results;
    const successfulTests = Object.values(results).filter(r => !r.error);
    
    if (successfulTests.length === 0) {
      console.log(`❌ No successful tests completed for ${testType}`);
      return;
    }
    
    const statusAdvantages = successfulTests.map(r => r.winRates.sideB);
    const avgAdvantage = statusAdvantages.reduce((a, b) => a + b, 0) / statusAdvantages.length;
    const minAdvantage = Math.min(...statusAdvantages);
    const maxAdvantage = Math.max(...statusAdvantages);
    
    console.log(`\n📊 FINAL SUMMARY FOR ${testType.toUpperCase()} STATUS:`);
    console.log(`==================================================`);
    console.log(`Total Tests Completed: ${successfulTests.length}`);
    console.log(`Average ${testType} Status Advantage: ${(avgAdvantage * 100).toFixed(1)}%`);
    console.log(`Range: ${(minAdvantage * 100).toFixed(1)}% - ${(maxAdvantage * 100).toFixed(1)}%`);
    
    // Identify best/worst configurations
    const testEntries = Object.entries(results).filter(([name, result]) => !result.error);
    const bestConfig = testEntries.reduce((best, current) => 
      current[1].winRates.sideB > best[1].winRates.sideB ? current : best
    );
    const worstConfig = testEntries.reduce((worst, current) => 
      current[1].winRates.sideB < worst[1].winRates.sideB ? current : worst
    );
    
    console.log(`\n🏆 Best ${testType} Configuration:`);
    console.log(`   ${bestConfig[0]}`);
    console.log(`   Win Rate: ${(bestConfig[1].winRates.sideB * 100).toFixed(1)}%`);
    
    console.log(`\n📉 Worst ${testType} Configuration:`);
    console.log(`   ${worstConfig[0]}`);
    console.log(`   Win Rate: ${(worstConfig[1].winRates.sideB * 100).toFixed(1)}%`);
    
    // Overall balance assessment
    this.assessOverallBalance(testType, avgAdvantage, minAdvantage, maxAdvantage);
  }
  
  /**
   * Assess overall balance of MEST QSR rules
   */
  assessOverallBalance(testType, avgAdvantage, minAdvantage, maxAdvantage) {
    console.log(`\n⚖️ OVERALL BALANCE ASSESSMENT:`);
    console.log(`================================`);
    
    if (avgAdvantage >= 0.45 && avgAdvantage <= 0.65) {
      console.log(`✅ ${testType} status is WELL-BALANCED`);
      console.log(`   Provides meaningful tactical advantage without being overpowered`);
    } else if (avgAdvantage > 0.65) {
      console.log(`⚠️  ${testType} status is OVERPOWERED`);
      console.log(`   Consider reducing effectiveness or increasing setup costs`);
    } else {
      console.log(`⚠️  ${testType} status is UNDERPOWERED`);
      console.log(`   Consider enhancing benefits or reducing restrictions`);
    }
    
    if (maxAdvantage - minAdvantage > 0.3) {
      console.log(`⚠️  HIGH VARIANCE detected across configurations`);
      console.log(`   Some builds benefit significantly more than others`);
      console.log(`   Consider standardizing status benefits`);
    } else {
      console.log(`✅ CONSISTENT performance across different builds`);
    }
  }
  
  // Simulated checkpoint methods (would be file I/O in real implementation)
  getSimulatedCheckpoint(testType) {
    // Return null to simulate no existing checkpoint
    return null;
  }
  
  setSimulatedCheckpoint(testType, data) {
    // Simulate saving checkpoint
    this.simulatedCheckpoints = this.simulatedCheckpoints || {};
    this.simulatedCheckpoints[testType] = data;
  }
}

// Run sequential testing
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  const tracker = new SequentialProgressTracker();
  
  // Run Wait Status tests first
  tracker.runSequentialTests('wait')
    .then(() => {
      // Then run Hidden Status tests
      return tracker.runSequentialTests('hidden');
    })
    .then(() => {
      console.log('\n🎯 ALL SEQUENTIAL TESTING COMPLETE!');
      console.log('MEST QSR balance analysis finished successfully.');
    })
    .catch(console.error);
}