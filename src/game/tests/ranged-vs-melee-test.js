// /src/tests/ranged-vs-melee-test.js
import { BalanceTestFramework } from '../analysis/BalanceTestFramework.js';

/**
 * Canonical MEST QSR Test: Ranged vs Melee Build
 * Longbow + Dagger + Light Armor vs Saber + Medium Shield + Armored Gear
 */
export class RangedVsMeleeTest {
  constructor() {
    this.framework = new BalanceTestFramework();
  }
  
  /**
   * Create canonical ranged vs melee test
   */
  createRangedVsMeleeTest() {
    return this.framework.createStandardTestConfig(
      'Longbow+Dagger+Light vs Saber+MediumShield+ArmoredGear (350 BP)',
      {
        name: 'Ranged Skirmishers',
        count: 6, // 6 × 57 BP = 342 BP
        assembly: 'Average',
        weapons: ['Bow, Long', 'Daggers'], // Dual-wield capability
        armor: ['Armor, Light']
      },
      {
        name: 'Melee Defenders',
        count: 6, // 6 × 58 BP = 348 BP  
        assembly: 'Average',
        weapons: ['Sword, Saber'],
        armor: ['Shield, Medium', 'Armored Gear']
      },
      350
    );
  }
  
  /**
   * Verify canonical compliance
   */
  verifyCompliance() {
    const sideACost = 30 + 13 + 6 + 8; // 57 BP
    const sideBCost = 30 + 13 + 10 + 5; // 58 BP
    
    const sideABP = 6 * sideACost; // 342 BP
    const sideBBP = 6 * sideBCost; // 348 BP
    
    const difference = Math.abs(sideABP - sideBBP); // 6 BP
    const maxAllowed = 25; // Per QSR rules
    
    console.log('📊 Equipment Costs:');
    console.log(`Side A (Ranged): Average(30) + Longbow(13) + Daggers(6) + Light Armor(8) = ${sideACost} BP`);
    console.log(`Side B (Melee): Average(30) + Saber(13) + Medium Shield(10) + Armored Gear(5) = ${sideBCost} BP`);
    console.log('');
    console.log('🎯 Model Configuration:');
    console.log(`Side A: 6 models × ${sideACost} BP = ${sideABP} BP`);
    console.log(`Side B: 6 models × ${sideBCost} BP = ${sideBBP} BP`);
    console.log(`BP Difference: ${difference} BP (max allowed: ${maxAllowed} BP)`);
    console.log(`✅ Canonical Compliance: ${difference <= maxAllowed}`);
    
    return difference <= maxAllowed;
  }
  
  /**
   * Run the canonical test
   */
  async runTest(iterations = 100) {
    console.log('🏹⚔️  RANGED vs MELEE Balance Test');
    console.log('===============================');
    console.log('Testing: Longbow+Dagger+Light Armor vs Saber+MediumShield+ArmoredGear');
    console.log('Both sides: Average archetype, 6 models each');
    console.log('Target BP: ~350 BP per side');
    
    if (!this.verifyCompliance()) {
      throw new Error('Test configuration violates MEST QSR balancing rules');
    }
    
    const testConfig = this.createRangedVsMeleeTest();
    const results = await this.framework.runBalanceTest(
      'Ranged vs Melee (350 BP)',
      testConfig,
      iterations
    );
    
    this.framework.printTestResults('Ranged vs Melee (350 BP)', results);
    
    // Additional tactical analysis
    this.analyzeTacticalImplications(results);
    
    return results;
  }
  
  /**
   * Analyze tactical implications
   */
  analyzeTacticalImplications(results) {
    console.log('\n🔍 Tactical Analysis:');
    
    // Range advantage analysis
    if (results.winRates.sideA > results.winRates.sideB + 0.1) {
      console.log('• Ranged build shows significant advantage - Longbow may be overpowered');
      console.log('• Consider if 13 BP cost for Longbow provides appropriate value');
    } else if (results.winRates.sideB > results.winRates.sideA + 0.1) {
      console.log('• Melee build overcomes range disadvantage - suggests strong close combat balance');
      console.log('• Shield, Medium + Armored Gear combination may be very effective');
    } else {
      console.log('• Balanced outcome suggests good tactical trade-offs between ranged and melee');
      console.log('• Range advantage properly countered by defensive capabilities');
    }
    
    // Survival rate analysis
    const rangedSurvival = results.averages.survivalRates.sideA;
    const meleeSurvival = results.averages.survivalRates.sideB;
    
    if (meleeSurvival > rangedSurvival + 0.1) {
      console.log('• Melee build shows superior survivability - defensive equipment effective');
    } else if (rangedSurvival > meleeSurvival + 0.1) {
      console.log('• Ranged build maintains distance effectively - range advantage preserved');
    }
  }
}

// Run test if executed directly
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  const test = new RangedVsMeleeTest();
  test.runTest(100).catch(console.error);
}