// /src/tests/comprehensive-matchup-tests.js
import { GeneralizedOptimizationFramework } from '../game/analysis/GeneralizedOptimizationFramework.js';

/**
 * Comprehensive matchup tests with full configuration variations
 */
export class ComprehensiveMatchupTests {
  constructor() {
    this.framework = new GeneralizedOptimizationFramework();
    this.archetypes = ['Untrained', 'Militia', 'Average', 'Veteran', 'Elite'];
    this.weapons = [
      'Sword, (Broad)', 'Spear, Medium', 'Bow, Long', 'Hammer, War', 
      'Axe, Long', 'Daggers', 'Staff', 'Club, Spiked Mace',
      'Crossbow, Medium', 'Bow, Medium', 'Pole-arm, Halberd', 'Sword, Saber'
    ];
    this.armorConfigs = [
      [], // No armor
      ['Armored Gear'],
      ['Armored Gear', 'Armor, Light'],
      ['Armor, Medium'],
      ['Armor, Light', 'Helmet'],
      ['Armor, Heavy'],
      ['Armor, Medium', 'Shield, Medium'],
      ['Armor, Light', 'Helmet', 'Armored Gear'],
      ['Armor, Heavy', 'Full Helm', 'Armored Gear', 'Shield, Medium'],
      ['Armored Gear', 'Shield, Small']
    ];
  }
  
  /**
   * Generate systematic test configurations
   */
  generateSystematicTests(baseConfig, testType) {
    const tests = [];
    
    // Test all archetype combinations
    for (const archetype of this.archetypes) {
      // Test base archetype
      tests.push({
        ...baseConfig,
        archetype: archetype,
        testName: `${testType} - ${archetype}`
      });
    }
    
    return tests;
  }
  
  /**
   * Apply weapon and armor restrictions
   */
  applyWeaponArmorRestrictions(weapon, armorConfig) {
    const twoHandedRanged = ['Bow, Long', 'Crossbow, Medium', 'Bow, Medium'];
    
    if (twoHandedRanged.includes(weapon)) {
      // Remove shields from armor config
      return armorConfig.filter(item => !item.includes('Shield'));
    }
    
    return armorConfig;
  }
  
  /**
   * Create Wait Status Matchup Test
   */
  async createWaitStatusTest() {
    console.log('⏳ GENERATING WAIT STATUS MATCHUP TESTS');
    
    const waitTests = [];
    
    // Systematic variation across all parameters
    for (const archetype of this.archetypes) {
      for (const weapon of this.weapons) {
        for (let i = 0; i < this.armorConfigs.length; i++) {
          const armorConfig = this.applyWeaponArmorRestrictions(weapon, this.armorConfigs[i]);
          
          // Create test configuration
          const config = {
            name: `Wait Status - ${archetype} ${weapon} ${armorConfig.join('+') || 'NoArmor'}`,
            sideA: {
              name: 'Active Assembly',
              archetype: archetype,
              weapon: weapon,
              armor: armorConfig,
              status: 'attentive'
            },
            sideB: {
              name: 'Wait Status Assembly', 
              archetype: archetype,
              weapon: weapon,
              armor: armorConfig,
              status: 'wait'
            },
            bp: 500,
            specialRules: {
              waitStatus: true
            }
          };
          
          waitTests.push(config);
        }
      }
    }
    
    console.log(`Generated ${waitTests.length} Wait Status test configurations`);
    return waitTests;
  }
  
  /**
   * Create Hidden Status Matchup Test
   */
  async createHiddenStatusTest() {
    console.log('👁️ GENERATING HIDDEN STATUS MATCHUP TESTS');
    
    const hiddenTests = [];
    
    // Focus on viable hidden archetypes (Sneak and Evasive variants, lighter armor)
    const viableArchetypes = ['Untrained', 'Militia', 'Average', 'Veteran, Sneak', 'Average, Evasive'];
    const lightArmorConfigs = [
      [], // No armor
      ['Armored Gear'],
      ['Armored Gear', 'Armor, Light'],
      ['Armor, Light', 'Helmet'],
      ['Armor, Light', 'Helmet', 'Armored Gear'],
      ['Armored Gear', 'Shield, Small']
    ];
    
    for (const archetype of viableArchetypes) {
      for (const weapon of this.weapons) {
        // Hidden works best with melee or short-range weapons
        const viableWeapons = this.getViableHiddenWeapons(weapon);
        if (!viableWeapons) continue;
        
        for (const armorConfig of lightArmorConfigs) {
          const finalArmor = this.applyWeaponArmorRestrictions(weapon, armorConfig);
          
          const config = {
            name: `Hidden Status - ${archetype} ${weapon} ${finalArmor.join('+') || 'NoArmor'}`,
            sideA: {
              name: 'Active Assembly',
              archetype: archetype,
              weapon: weapon,
              armor: finalArmor,
              status: 'attentive'
            },
            sideB: {
              name: 'Hidden Assembly',
              archetype: archetype,
              weapon: weapon,
              armor: finalArmor,
              status: 'hidden'
            },
            bp: 500,
            specialRules: {
              hiddenStatus: true,
              visibility: 16 // Standard visibility for hidden tests
            }
          };
          
          hiddenTests.push(config);
        }
      }
    }
    
    console.log(`Generated ${hiddenTests.length} Hidden Status test configurations`);
    return hiddenTests;
  }
  
  /**
   * Get viable weapons for hidden status
   */
  getViableHiddenWeapons(weapon) {
    // Hidden works best with weapons that benefit from surprise
    const viableForHidden = [
      'Sword, (Broad)', 'Spear, Medium', 'Axe, Long', 'Daggers', 'Staff', 
      'Club, Spiked Mace', 'Pole-arm, Halberd', 'Sword, Saber'
    ];
    
    // Ranged weapons can work but are less effective for hidden
    const rangedForHidden = ['Bow, Medium']; // Shorter range
    
    return viableForHidden.includes(weapon) || rangedForHidden.includes(weapon);
  }
  
  /**
   * Run systematic matchup analysis
   */
  async runSystematicMatchupAnalysis(testType = 'wait') {
    console.log(`⚔️ RUNNING SYSTEMATIC ${testType.toUpperCase()} STATUS ANALYSIS`);
    console.log('=================================================');
    
    let testConfigs;
    if (testType === 'wait') {
      testConfigs = await this.createWaitStatusTest();
    } else {
      testConfigs = await this.createHiddenStatusTest();
    }
    
    // Sample representative tests due to combinatorial explosion
    const sampleSize = Math.min(50, testConfigs.length);
    const sampledTests = this.sampleTests(testConfigs, sampleSize);
    
    const results = {};
    let completed = 0;
    
    for (const config of sampledTests) {
      try {
        console.log(`\n🧪 Testing: ${config.name}`);
        const result = await this.framework.runGenericMonteCarlo(config, 75, 2);
        
        results[config.name] = result;
        completed++;
        
        if (completed % 10 === 0) {
          console.log(`Progress: ${completed}/${sampleSize} tests completed`);
        }
        
      } catch (error) {
        console.error(`❌ Failed: ${config.name}`, error);
        results[config.name] = { error: error.message };
      }
    }
    
    this.generateMatchupAnalysisReport(results, testType);
    return results;
  }
  
  /**
   * Sample tests to manage combinatorial explosion
   */
  sampleTests(testConfigs, sampleSize) {
    if (testConfigs.length <= sampleSize) {
      return testConfigs;
    }
    
    // Stratified sampling to ensure coverage of all categories
    const sampled = [];
    const archetypeGroups = {};
    
    // Group by archetype
    for (const config of testConfigs) {
      const archetype = config.sideA.archetype;
      if (!archetypeGroups[archetype]) {
        archetypeGroups[archetype] = [];
      }
      archetypeGroups[archetype].push(config);
    }
    
    // Sample from each group proportionally
    const archetypes = Object.keys(archetypeGroups);
    const perGroup = Math.floor(sampleSize / archetypes.length);
    
    for (const archetype of archetypes) {
      const group = archetypeGroups[archetype];
      const groupSample = this.randomSample(group, perGroup);
      sampled.push(...groupSample);
    }
    
    // Fill remaining slots randomly
    while (sampled.length < sampleSize && testConfigs.length > sampled.length) {
      const randomConfig = testConfigs[Math.floor(Math.random() * testConfigs.length)];
      if (!sampled.includes(randomConfig)) {
        sampled.push(randomConfig);
      }
    }
    
    return sampled.slice(0, sampleSize);
  }
  
  /**
   * Random sample without replacement
   */
  randomSample(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
  
  /**
   * Generate comprehensive matchup analysis report
   */
  generateMatchupAnalysisReport(results, testType) {
    console.log(`\n📊 ${testType.toUpperCase()} STATUS ANALYSIS REPORT`);
    console.log('===============================================');
    
    const successfulTests = Object.values(results).filter(r => !r.error);
    if (successfulTests.length === 0) {
      console.log('No successful tests completed');
      return;
    }
    
    // Analyze status advantage
    const statusAdvantage = successfulTests.map(r => r.winRates.sideB); // Side B has status
    const avgAdvantage = statusAdvantage.reduce((a, b) => a + b, 0) / statusAdvantage.length;
    
    console.log(`Average ${testType} status advantage: ${(avgAdvantage * 100).toFixed(1)}% win rate`);
    
    // Find most/least effective combinations
    const testEntries = Object.entries(results).filter(([name, result]) => !result.error);
    
    const bestStatus = testEntries.reduce((best, current) => 
      current[1].winRates.sideB > best[1].winRates.sideB ? current : best
    );
    
    const worstStatus = testEntries.reduce((worst, current) => 
      current[1].winRates.sideB < worst[1].winRates.sideB ? current : worst
    );
    
    console.log(`\n🏆 Most Effective ${testType} Status:`);
    console.log(`   ${bestStatus[0]} - ${(bestStatus[1].winRates.sideB * 100).toFixed(1)}% win rate`);
    
    console.log(`\n📉 Least Effective ${testType} Status:`);
    console.log(`   ${worstStatus[0]} - ${(worstStatus[1].winRates.sideB * 100).toFixed(1)}% win rate`);
    
    // Archetype-specific analysis
    console.log(`\n🧬 Archetype Analysis:`);
    const archetypeResults = {};
    
    for (const [name, result] of testEntries) {
      const archetypeMatch = name.match(/- ([^ ]+)/);
      if (archetypeMatch) {
        const archetype = archetypeMatch[1];
        if (!archetypeResults[archetype]) {
          archetypeResults[archetype] = [];
        }
        archetypeResults[archetype].push(result.winRates.sideB);
      }
    }
    
    Object.entries(archetypeResults).forEach(([archetype, winRates]) => {
      const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
      console.log(`   ${archetype}: ${(avgWinRate * 100).toFixed(1)}% average ${testType} advantage`);
    });
    
    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    if (avgAdvantage > 0.6) {
      console.log(`• ${testType} status provides significant advantage`);
      console.log(`• Consider balancing mechanics or BP costs for status-dependent builds`);
    } else if (avgAdvantage < 0.4) {
      console.log(`• ${testType} status provides minimal advantage`);
      console.log(`• Status mechanics may need enhancement for tactical value`);
    } else {
      console.log(`• ${testType} status provides balanced tactical advantage`);
      console.log(`• Current implementation appears well-balanced`);
    }
  }
}