// /src/tests/spear-vs-sword-test.js
import { BalanceTestFramework } from '../analysis/BalanceTestFramework.js';

/**
 * Test Configuration: Average + Spear vs Veteran + Sword (350 BP each)
 */
export class SpearVsSwordTest {
  constructor() {
    this.framework = new BalanceTestFramework();
  }
  
  /**
   * Create the specific test configuration
   */
  createSpearVsSwordTest() {
    // Calculate optimal model counts for 350 BP
    const averageSpearCount = this.framework.calculateOptimalModelCount(
      'Average', 
      'Spear, Medium', 
      'Shield, Medium', 
      350
    );
    
    const veteranSwordCount = this.framework.calculateOptimalModelCount(
      'Veteran', 
      'Sword, (Broad)', 
      'Shield, Medium', 
      350
    );
    
    console.log(`Average + Spear models: ${averageSpearCount}`);
    console.log(`Veteran + Sword models: ${veteranSwordCount}`);
    
    return this.framework.createStandardTestConfig(
      'Average + Spear vs Veteran + Sword (350 BP)',
      {
        name: 'Average Spear Squad',
        count: averageSpearCount,
        assembly: 'Average',
        weapons: ['Spear, Medium'],
        armor: ['Shield, Medium']
      },
      {
        name: 'Veteran Sword Squad', 
        count: veteranSwordCount,
        assembly: 'Veteran',
        weapons: ['Sword, (Broad)'],
        armor: ['Shield, Medium']
      },
      350
    );
  }
  
  /**
   * Run the balance test
   */
  async runTest(iterations = 100) {
    console.log('⚔️  Spear vs Sword Balance Test');
    console.log('=============================');
    console.log('Testing: Average models with Spear, Medium vs Veteran models with Sword, (Broad)');
    console.log('BP Limit: 350 per side');
    console.log('Both sides equipped with Shield, Medium (10 BP)');
    
    const testConfig = this.createSpearVsSwordTest();
    
    // Show detailed configuration
    console.log('\n📋 Test Configuration:');
    console.log(`Side A: ${testConfig.sideA.models.length} × Average + Spear, Medium + Shield, Medium`);
    console.log(`  Cost per model: 30 (Average) + 30 (Spear) + 10 (Shield) = 80 BP`);
    console.log(`  Total BP used: ${testConfig.sideA.models.length * 80}`);
    
    console.log(`Side B: ${testConfig.sideB.models.length} × Veteran + Sword, (Broad) + Shield, Medium`);
    console.log(`  Cost per model: 61 (Veteran) + 17 (Sword) + 10 (Shield) = 88 BP`);
    console.log(`  Total BP used: ${testConfig.sideB.models.length * 88}`);
    
    const results = await this.framework.runBalanceTest(
      'Spear vs Sword (350 BP)',
      testConfig,
      iterations
    );
    
    this.framework.printTestResults('Spear vs Sword (350 BP)', results);
    this.framework.saveResultsToFile('spear-vs-sword-results.json');
    
    return results;
  }
}

// Run the test if executed directly
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  const test = new SpearVsSwordTest();
  test.runTest(100).catch(console.error);
}