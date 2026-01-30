// /src/simulator/EnhancedMetricsTracker.js
/**
 * Enhanced metrics tracking for comprehensive battle analysis
 */
export class EnhancedMetricsTracker {
  constructor() {
    this.metrics = {
      moraleTests: { sideA: 0, sideB: 0 },
      victoryPoints: { sideA: 0, sideB: 0 },
      bottleTests: { sideA: 0, sideB: 0 }, // Assuming Bottle Tests = Morale Tests
      initiativePoints: { sideA: [], sideB: [] }, // Per turn array
      gritUsage: { sideA: { fearReduced: 0, fearConverted: 0, moraleImmunity: 0 }, 
                   sideB: { fearReduced: 0, fearConverted: 0, moraleImmunity: 0 } }
    };
  }
  
  /**
   * Track morale test
   */
  trackMoraleTest(side, model, context) {
    const sideKey = side === 'side-a' ? 'sideA' : 'sideB';
    this.metrics.moraleTests[sideKey]++;
    
    // Check if Grit prevents the test
    if (this.hasGritTrait(model) && context.fallenModelPOW <= model.POW) {
      this.metrics.gritUsage[sideKey].moraleImmunity++;
      return false; // Test prevented
    }
    
    return true; // Test proceeds
  }
  
  /**
   * Track victory points
   */
  trackVictoryPoints(side, points) {
    const sideKey = side === 'side-a' ? 'sideA' : 'sideB';
    this.metrics.victoryPoints[sideKey] += points;
  }
  
  /**
   * Track bottle/morale tests
   */
  trackBottleTest(side) {
    const sideKey = side === 'side-a' ? 'sideA' : 'sideB';
    this.metrics.bottleTests[sideKey]++;
  }
  
  /**
   * Track initiative points per turn
   */
  trackInitiativePoints(side, points, turn) {
    const sideKey = side === 'side-a' ? 'sideA' : 'sideB';
    if (!this.metrics.initiativePoints[sideKey][turn]) {
      this.metrics.initiativePoints[sideKey][turn] = 0;
    }
    this.metrics.initiativePoints[sideKey][turn] += points;
  }
  
  /**
   * Track Grit trait usage
   */
  trackGritUsage(side, usageType) {
    const sideKey = side === 'side-a' ? 'sideA' : 'sideB';
    switch(usageType) {
      case 'fearReduced':
        this.metrics.gritUsage[sideKey].fearReduced++;
        break;
      case 'fearConverted':
        this.metrics.gritUsage[sideKey].fearConverted++;
        break;
      case 'moraleImmunity':
        this.metrics.gritUsage[sideKey].moraleImmunity++;
        break;
    }
  }
  
  /**
   * Get comprehensive metrics report
   */
  getMetricsReport() {
    return {
      moraleTests: this.metrics.moraleTests,
      victoryPoints: this.metrics.victoryPoints,
      bottleTests: this.metrics.bottleTests,
      initiativePoints: {
        sideA: this.metrics.initiativePoints.sideA.filter(t => t !== undefined),
        sideB: this.metrics.initiativePoints.sideB.filter(t => t !== undefined)
      },
      gritUsage: this.metrics.gritUsage,
      averages: {
        avgInitiativeSideA: this.calculateAverage(this.metrics.initiativePoints.sideA),
        avgInitiativeSideB: this.calculateAverage(this.metrics.initiativePoints.sideB),
        moraleTestRate: {
          sideA: this.metrics.moraleTests.sideA / (this.metrics.bottleTests.sideA || 1),
          sideB: this.metrics.moraleTests.sideB / (this.metrics.bottleTests.sideB || 1)
        }
      }
    };
  }
  
  calculateAverage(array) {
    const validValues = array.filter(v => v !== undefined);
    return validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;
  }
  
  hasGritTrait(model) {
    return model.traits?.includes('Grit') || model.archetype === 'Veteran' || model.archetype === 'Elite';
  }
}