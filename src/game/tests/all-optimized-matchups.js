// /src/tests/all-optimized-matchups.js
import { GeneralizedOptimizationFramework } from '../game/analysis/GeneralizedOptimizationFramework.js';

/**
 * All 7 optimized matchup tests
 */
export class AllOptimizedMatchups {
  constructor() {
    this.framework = new GeneralizedOptimizationFramework();
  }
  
  /**
   * Test 1: Tactics vs Leadership
   */
  async runTacticsVsLeadership() {
    const config = this.framework.buildTestConfig(
      'Tactics vs Leadership (500 BP)',
      {
        name: 'Average Tacticians',
        archetype: 'Average',
        weapon: 'Sword, (Broad)',
        armor: ['Armor, Light', 'Shield, Light'],
        traits: ['Tactics']
      },
      {
        name: 'Average Wise Leaders', 
        archetype: 'Average',
        weapon: 'Sword, (Broad)',
        armor: ['Armor, Medium', 'Shield, Medium'], // Extra BP for better armor
        traits: ['Leadership']
      },
      500
    );
    
    return await this.framework.runGenericMonteCarlo(config, 150);
  }
  
  /**
   * Test 2: Armor Stack vs Armor-Piercing
   */
  async runArmorVsPiercing() {
    const config = this.framework.buildTestConfig(
      'Heavy Armor vs Warhammers (500 BP)',
      {
        name: 'Heavy Armor Stack',
        archetype: 'Untrained',
        weapon: 'Sword, (Broad)',
        armor: ['Armor, Medium', 'Shield, Medium', 'Helmet', 'Armored Gear']
      },
      {
        name: 'Warhammer Piercers',
        archetype: 'Average',
        weapon: 'Hammer, War', 
        armor: ['Armored Gear']
      },
      500
    );
    
    return await this.framework.runGenericMonteCarlo(config, 150);
  }
  
  /**
   * Test 3: Reach Advantage vs Close Combat Specialists
   */
  async runReachVsSpecialists() {
    const config = this.framework.buildTestConfig(
      'Spear Reach vs Veteran Sword (500 BP)',
      {
        name: 'Spear Fighters',
        archetype: 'Average',
        weapon: 'Spear, Medium',
        armor: ['Armor, Light']
      },
      {
        name: 'Veteran Sword Masters',
        archetype: 'Veteran',
        weapon: 'Sword, (Broad)',
        armor: ['Armor, Medium', 'Shield, Medium']
      },
      500
    );
    
    return await this.framework.runGenericMonteCarlo(config, 150);
  }
  
  /**
   * Test 4: Dual-Wield Flexibility vs Specialized Single Weapon
   */
  async runDualWieldVsSpecialized() {
    const config = this.framework.buildTestConfig(
      'Dual Daggers vs Saber Specialist (500 BP)',
      {
        name: 'Dual Dagger Fighters',
        archetype: 'Average',
        weapon: 'Daggers',
        armor: ['Armored Gear']
      },
      {
        name: 'Saber Specialists',
        archetype: 'Average', 
        weapon: 'Sword, Saber',
        armor: ['Shield, Medium', 'Armored Gear']
      },
      500
    );
    
    return await this.framework.runGenericMonteCarlo(config, 150);
  }
  
  /**
   * Test 5: Ranged Specialization vs Melee Rush
   */
  async runRangedVsMeleeRush() {
    const config = this.framework.buildTestConfig(
      'Longbow Ranged vs Axe Long Rush (500 BP)',
      {
        name: 'Longbow Archers',
        archetype: 'Average',
        weapon: 'Bow, Long',
        armor: ['Armored Gear']
      },
      {
        name: 'Axe Long Chargers',
        archetype: 'Average',
        weapon: 'Axe, Long',
        armor: ['Armor, Light']
      },
      500
    );
    
    return await this.framework.runGenericMonteCarlo(config, 150);
  }
  
  /**
   * Test 6: Grit Resilience vs Raw Power
   */
  async runGritVsRawPower() {
    const config = this.framework.buildTestConfig(
      'Veteran Grit vs Average Warhammer (500 BP)',
      {
        name: 'Veteran Grit Squad',
        archetype: 'Veteran',
        weapon: 'Sword, (Broad)',
        armor: ['Armor, Light']
      },
      {
        name: 'Average Warhammer Squad',
        archetype: 'Average',
        weapon: 'Hammer, War',
        armor: ['Armor, Medium']
      },
      500
    );
    
    return await this.framework.runGenericMonteCarlo(config, 150);
  }
  
  /**
   * Test 7: Quantity vs Quality with Hindrance Resistance
   */
  async runQuantityVsQuality() {
    const config = this.framework.buildTestConfig(
      'Militia Grizzled vs Veteran Quality (500 BP)',
      {
        name: 'Militia Grizzled Horde',
        archetype: 'Militia',
        weapon: 'Sword, (Broad)',
        armor: ['Armor, Light'],
        traits: ['Grit']
      },
      {
        name: 'Veteran Elite Squad',
        archetype: 'Veteran',
        weapon: 'Sword, (Broad)',
        armor: ['Armor, Medium', 'Shield, Medium']
      },
      500
    );
    
    return await this.framework.runGenericMonteCarlo(config, 150);
  }
  
  /**
   * Run all tests in sequence
   */
  async runAllMatchups() {
    console.log('⚔️ RUNNING ALL 7 OPTIMIZED MATCHUP TESTS ⚔️');
    console.log('===========================================');
    
    const tests = [
      { name: 'Tactics vs Leadership', func: this.runTacticsVsLeadership.bind(this) },
      { name: 'Armor Stack vs Warhammers', func: this.runArmorVsPiercing.bind(this) },
      { name: 'Spear Reach vs Veteran Sword', func: this.runReachVsSpecialists.bind(this) },
      { name: 'Dual Daggers vs Saber', func: this.runDualWieldVsSpecialized.bind(this) },
      { name: 'Longbow vs Axe Long', func: this.runRangedVsMeleeRush.bind(this) },
      { name: 'Veteran Grit vs Warhammer', func: this.runGritVsRawPower.bind(this) },
      { name: 'Militia vs Veteran', func: this.runQuantityVsQuality.bind(this) }
    ];
    
    const results = {};
    const startTime = Date.now();
    
    for (const test of tests) {
      console.log(`\n🧪 Running: ${test.name}`);
      try {
        const result = await test.func();
        results[test.name] = result;
        console.log(`✅ Completed: ${test.name}`);
        console.log(`   Win Rate: ${(result.winRates.sideA * 100).toFixed(1)}% vs ${(result.winRates.sideB * 100).toFixed(1)}%`);
        console.log(`   Balance: ${result.balanceAssessment}`);
      } catch (error) {
        console.error(`❌ Failed: ${test.name}`, error);
        results[test.name] = { error: error.message };
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n📊 ALL TESTS COMPLETED IN ${(totalTime / 1000).toFixed(2)} SECONDS`);
    
    // Generate summary report
    this.generateSummaryReport(results);
    
    return results;
  }
  
  /**
   * Generate comprehensive summary report
   */
  generateSummaryReport(results) {
    console.log('\n📋 COMPREHENSIVE BALANCE ANALYSIS REPORT');
    console.log('=========================================');
    
    const balancedTests = [];
    const imbalancedTests = [];
    
    Object.entries(results).forEach(([testName, result]) => {
      if (result.error) {
        console.log(`❌ ${testName}: ERROR - ${result.error}`);
        return;
      }
      
      const assessment = result.balanceAssessment;
      if (assessment === 'balanced') {
        balancedTests.push(testName);
      } else {
        imbalancedTests.push({ name: testName, assessment: assessment });
      }
    });
    
    console.log(`\n✅ Balanced Tests (${balancedTests.length}):`);
    balancedTests.forEach(test => console.log(`   • ${test}`));
    
    console.log(`\n⚠️ Imbalanced Tests (${imbalancedTests.length}):`);
    imbalancedTests.forEach(test => console.log(`   • ${test.name} - ${test.assessment}`));
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (imbalancedTests.length > 0) {
      console.log('Consider adjusting BP costs for imbalanced matchups:');
      imbalancedTests.forEach(test => {
        console.log(`   • ${test.name}: Review BP costs and trait values`);
      });
    } else {
      console.log('All tested matchups appear well-balanced!');
    }
  }
}

// Run all tests if executed directly
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  const matchups = new AllOptimizedMatchups();
  matchups.runAllMatchups().catch(console.error);
}