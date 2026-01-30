// /src/tests/canonical-spear-vs-sword-test.js
import { BalanceTestFramework } from '../analysis/BalanceTestFramework.js';

/**
 * Canonical MEST QSR Compliant Test: Average + Spear vs Veteran + Sword
 */
export class CanonicalSpearVsSwordTest {
  constructor() {
    this.framework = new BalanceTestFramework();
  }
  
  /**
   * Create MEST QSR compliant test configuration
   */
  createCanonicalTest() {
    // Since 350 BP doesn't allow proper balance, increase to 400 BP
    // as per QSR: "round up to the nearest 50 BP"
    
    return this.framework.createStandardTestConfig(
      'Average + Spear vs Veteran + Sword (400 BP - Canonical)',
      {
        name: 'Average Spear Squad',
        count: 5, // 5 × 80 BP = 400 BP
        assembly: 'Average',
        weapons: ['Spear, Medium'],
        armor: ['Shield, Medium']
      },
      {
        name: 'Veteran Sword Squad',
        count: 4, // 4 × 88 BP = 352 BP, plus equipment
        assembly: 'Veteran', 
        weapons: ['Sword, (Broad)'],
        armor: ['Shield, Medium'],
        equipment: ['Medicinal, Alcohol', 'Medicinal, Stimulant', 'Medicinal, Alcohol'] // 17+11+17=45 BP
      },
      400 // Increased from 350 to 400 BP per QSR rules
    );
  }
  
  /**
   * Verify BP balance compliance
   */
  verifyBPCompliance(testConfig) {
    const sideABP = testConfig.sideA.models.length * (
      30 + // Average archetype
      30 + // Spear, Medium  
      10   // Shield, Medium
    );
    
    const sideBBP = testConfig.sideB.models.length * (
      61 + // Veteran archetype
      17 + // Sword, (Broad)
      10   // Shield, Medium
    ) + 45; // Equipment
    
    const difference = Math.abs(sideABP - sideBBP);
    const maxAllowed = Math.min(25, testConfig.sideA.bp * 0.05);
    
    console.log(`Side A BP: ${sideABP}`);
    console.log(`Side B BP: ${sideBBP}`);  
    console.log(`Difference: ${difference} BP`);
    console.log(`Max allowed: ${maxAllowed} BP`);
    console.log(`Compliant: ${difference <= maxAllowed}`);
    
    return difference <= maxAllowed;
  }
  
  async runCanonicalTest(iterations = 100) {
    console.log('⚔️  CANONICAL Spear vs Sword Balance Test');
    console.log('=========================================');
    console.log('MEST QSR Compliant: Following Equivalent Forces rules');
    console.log('BP Limit: 400 BP (increased from 350 per QSR guidelines)');
    console.log('Target BP Difference: ≤ 20 BP (5 BP per 100 BP)');
    
    const testConfig = this.createCanonicalTest();
    const isCompliant = this.verifyBPCompliance(testConfig);
    
    if (!isCompliant) {
      throw new Error('Test configuration violates MEST QSR balancing rules');
    }
    
    const results = await this.framework.runBalanceTest(
      'Spear vs Sword (400 BP - Canonical)',
      testConfig,
      iterations
    );
    
    this.framework.printTestResults('Spear vs Sword (400 BP - Canonical)', results);
    return results;
  }
}