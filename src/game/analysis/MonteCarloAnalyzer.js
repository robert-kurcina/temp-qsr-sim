// /src/analysis/MonteCarloAnalyzer.js
import { EnhancedBattleSimulator } from '../simulator/EnhancedBattleSimulator.js';

export class MonteCarloAnalyzer {
  constructor() {
    this.simulator = new EnhancedBattleSimulator();
  }
  
  /**
   * Run Monte Carlo analysis on assembly compositions
   */
  async analyzeAssemblyCompositions(configurations, iterations = 100) {
    const results = new Map();
    
    console.log(`Starting Monte Carlo analysis with ${iterations} iterations per configuration...`);
    
    for (const [configName, config] of Object.entries(configurations)) {
      console.log(`\nAnalyzing: ${configName}`);
      
      const battleResults = [];
      const performanceMetrics = {
        wins: 0,
        draws: 0,
        losses: 0,
        averageTurns: 0,
        averageCasualties: { sideA: 0, sideB: 0 },
        survivalRates: [],
        bpEfficiency: [] // wins per BP spent
      };
      
      // Run multiple simulations
      for (let i = 0; i < iterations; i++) {
        if (i % 10 === 0) {
          console.log(`  Progress: ${i}/${iterations}`);
        }
        
        try {
          const result = await this.runSingleSimulation(config);
          battleResults.push(result);
          
          // Update metrics
          if (result.winner === 'side-a') performanceMetrics.wins++;
          else if (result.winner === 'side-b') performanceMetrics.losses++;
          else performanceMetrics.draws++;
          
          performanceMetrics.averageTurns += result.turns;
          performanceMetrics.averageCasualties.sideA += result.casualties.sideA;
          performanceMetrics.averageCasualties.sideB += result.casualties.sideB;
          
          const survivalRate = 1 - (result.casualties.sideA / config.sideA.models.length);
          performanceMetrics.survivalRates.push(survivalRate);
          
          const bpEfficiency = result.winner === 'side-a' ? 1 / config.sideA.bp : 0;
          performanceMetrics.bpEfficiency.push(bpEfficiency);
          
        } catch (error) {
          console.error(`Simulation ${i} failed:`, error);
        }
      }
      
      // Calculate averages
      performanceMetrics.averageTurns /= iterations;
      performanceMetrics.averageCasualties.sideA /= iterations;
      performanceMetrics.averageCasualties.sideB /= iterations;
      performanceMetrics.winRate = performanceMetrics.wins / iterations;
      performanceMetrics.averageSurvivalRate = performanceMetrics.survivalRates.reduce((a, b) => a + b, 0) / iterations;
      performanceMetrics.averageBPEfficiency = performanceMetrics.bpEfficiency.reduce((a, b) => a + b, 0) / iterations;
      
      results.set(configName, {
        config: config,
        results: battleResults,
        metrics: performanceMetrics
      });
    }
    
    return this.generateAnalysisReport(results);
  }
  
  /**
   * Run single simulation
   */
  runSingleSimulation(config) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = this.simulator.simulateBattle(config, { 
          logLevel: 'basic', 
          maxTurns: 15 
        });
        resolve(result.result);
      }, 0);
    });
  }
  
  /**
   * Generate comprehensive analysis report
   */
  generateAnalysisReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      configurations: {},
      comparisons: {},
      recommendations: []
    };
    
    // Process each configuration
    for (const [name, data] of results.entries()) {
      const metrics = data.metrics;
      report.configurations[name] = {
        winRate: metrics.winRate,
        averageTurns: metrics.averageTurns,
        averageCasualties: metrics.averageCasualties,
        survivalRate: metrics.averageSurvivalRate,
        bpEfficiency: metrics.averageBPEfficiency,
        totalSimulations: data.results.length
      };
    }
    
    // Generate comparisons
    const configNames = Array.from(results.keys());
    for (let i = 0; i < configNames.length; i++) {
      for (let j = i + 1; j < configNames.length; j++) {
        const name1 = configNames[i];
        const name2 = configNames[j];
        const metrics1 = report.configurations[name1];
        const metrics2 = report.configurations[name2];
        
        report.comparisons[`${name1}_vs_${name2}`] = {
          winRateDifference: metrics1.winRate - metrics2.winRate,
          efficiencyDifference: metrics1.bpEfficiency - metrics2.bpEfficiency,
          casualtyDifference: metrics1.averageCasualties.sideA - metrics2.averageCasualties.sideA
        };
      }
    }
    
    // Generate recommendations
    const bestWinRate = Math.max(...Object.values(report.configurations).map(c => c.winRate));
    const bestEfficiency = Math.max(...Object.values(report.configurations).map(c => c.bpEfficiency));
    
    for (const [name, config] of Object.entries(report.configurations)) {
      if (config.winRate >= bestWinRate - 0.05) {
        report.recommendations.push({
          type: 'high_win_rate',
          configuration: name,
          winRate: config.winRate
        });
      }
      
      if (config.bpEfficiency >= bestEfficiency - 0.001) {
        report.recommendations.push({
          type: 'high_bp_efficiency',
          configuration: name,
          bpEfficiency: config.bpEfficiency
        });
      }
    }
    
    return report;
  }
  
  /**
   * Analyze specific game elements (archetypes, weapons, etc.)
   */
  async analyzeGameElements(elementType, elementVariants, baseConfig, iterations = 50) {
    const elementResults = {};
    
    for (const variant of elementVariants) {
      const testConfig = this.createTestConfiguration(baseConfig, elementType, variant);
      const results = await this.analyzeAssemblyCompositions({ [variant]: testConfig }, iterations);
      
      elementResults[variant] = results.configurations[variant];
    }
    
    return this.analyzeElementBalance(elementResults, elementType);
  }
  
  /**
   * Create test configuration with specific element
   */
  createTestConfiguration(baseConfig, elementType, variant) {
    const config = JSON.parse(JSON.stringify(baseConfig));
    
    switch(elementType) {
      case 'archetype':
        config.sideA.models = config.sideA.models.map((model, index) => {
          if (index === 0) { // Test on first model
            return { ...model, archetype: variant };
          }
          return model;
        });
        break;
        
      case 'weapon':
        config.sideA.weapons = [variant];
        break;
        
      case 'armor':
        config.sideA.armor = [variant];
        break;
    }
    
    return config;
  }
  
  /**
   * Analyze balance of game elements
   */
  analyzeElementBalance(results, elementType) {
    const analysis = {
      elementType: elementType,
      variants: {},
      balanceAssessment: 'balanced',
      recommendations: []
    };
    
    const winRates = Object.values(results).map(r => r.winRate);
    const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    const maxWinRate = Math.max(...winRates);
    const minWinRate = Math.min(...winRates);
    
    // Check for balance issues
    if (maxWinRate > avgWinRate * 1.3) {
      analysis.balanceAssessment = 'overpowered';
      analysis.recommendations.push('Consider nerfing overpowered variants');
    } else if (minWinRate < avgWinRate * 0.7) {
      analysis.balanceAssessment = 'underpowered';
      analysis.recommendations.push('Consider buffing underpowered variants');
    }
    
    // Detailed variant analysis
    for (const [variant, metrics] of Object.entries(results)) {
      analysis.variants[variant] = {
        winRate: metrics.winRate,
        relativeStrength: (metrics.winRate - avgWinRate) / avgWinRate,
        assessment: this.assessVariantBalance(metrics.winRate, avgWinRate)
      };
    }
    
    return analysis;
  }
  
  assessVariantBalance(winRate, avgWinRate) {
    const ratio = winRate / avgWinRate;
    if (ratio > 1.3) return 'overpowered';
    if (ratio > 1.1) return 'strong';
    if (ratio > 0.9) return 'balanced';
    if (ratio > 0.7) return 'weak';
    return 'underpowered';
  }
}