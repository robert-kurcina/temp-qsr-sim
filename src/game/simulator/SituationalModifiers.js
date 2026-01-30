// /src/simulator/SituationalModifiers.js
/**
 * Complete Situational Test Modifier implementation with tracking
 */
export class SituationalModifiers {
  constructor() {
    this.modifierUsage = new Map();
    this.modifierEffectiveness = new Map();
    this.initializeModifierTracking();
  }
  
  /**
   * Initialize tracking for all modifiers
   */
  initializeModifierTracking() {
    const allModifiers = [
      'charge', 'highGround', 'size', 'defend', 'outnumber', 'cornered', 'flanked', 
      'overreach', 'pointBlank', 'elevation', 'distance', 'interveningCover', 
      'obscured', 'directCover', 'leaning', 'blind', 'hardCover', 'waiting', 
      'solo', 'suddenness', 'friendly', 'help', 'safety', 'concentrate', 'focus', 
      'hindrance', 'confined'
    ];
    
    allModifiers.forEach(modifier => {
      this.modifierUsage.set(modifier, 0);
      this.modifierEffectiveness.set(modifier, { applied: 0, successful: 0 });
    });
  }
  
  /**
   * Apply situational modifiers to a test
   */
  applyModifiers(testContext) {
    const modifiers = [];
    
    // Close Combat & Disengage Modifiers
    if (testContext.isCharge) {
      modifiers.push({ type: 'charge', dice: '+1m', value: 1 });
      this.trackModifierUsage('charge');
    }
    
    if (testContext.isHighGround) {
      modifiers.push({ type: 'highGround', dice: '+1m', value: 1 });
      this.trackModifierUsage('highGround');
    }
    
    if (testContext.sizeDifference > 0) {
      const sizeMod = Math.min(Math.floor(testContext.sizeDifference / 3), 3);
      if (sizeMod > 0) {
        modifiers.push({ type: 'size', dice: '+1m', value: sizeMod });
        this.trackModifierUsage('size');
      }
    }
    
    if (testContext.isDefend) {
      modifiers.push({ type: 'defend', dice: '+1b', value: 1 });
      this.trackModifierUsage('defend');
    }
    
    if (testContext.outnumberAmount > 0) {
      const outnumberMod = Math.min(Math.floor(testContext.outnumberAmount / 3), 3);
      if (outnumberMod > 0) {
        modifiers.push({ type: 'outnumber', dice: '+1w', value: outnumberMod });
        this.trackModifierUsage('outnumber');
      }
    }
    
    if (testContext.isCornered) {
      modifiers.push({ type: 'cornered', dice: '-1m', value: -1 });
      this.trackModifierUsage('cornered');
    }
    
    if (testContext.isFlanked) {
      modifiers.push({ type: 'flanked', dice: '-1m', value: -1 });
      this.trackModifierUsage('flanked');
    }
    
    if (testContext.isOverreach) {
      modifiers.push({ type: 'overreach', dice: '-1', value: -1 });
      this.trackModifierUsage('overreach');
    }
    
    // Range Combat & Detect Modifiers
    if (testContext.isPointBlank) {
      modifiers.push({ type: 'pointBlank', dice: '+1m', value: 1 });
      this.trackModifierUsage('pointBlank');
    }
    
    if (testContext.hasElevation) {
      modifiers.push({ type: 'elevation', dice: '+1m', value: 1 });
      this.trackModifierUsage('elevation');
    }
    
    if (testContext.distanceModifier < 0) {
      modifiers.push({ type: 'distance', dice: '-1m', value: testContext.distanceModifier });
      this.trackModifierUsage('distance');
    }
    
    if (testContext.hasInterveningCover) {
      modifiers.push({ type: 'interveningCover', dice: '-1m', value: -1 });
      this.trackModifierUsage('interveningCover');
    }
    
    if (testContext.obscuredCount > 0) {
      const obscuredMod = Math.min(Math.floor(testContext.obscuredCount / 3), 3);
      if (obscuredMod > 0) {
        modifiers.push({ type: 'obscured', dice: '-1m', value: -obscuredMod });
        this.trackModifierUsage('obscured');
      }
    }
    
    if (testContext.hasDirectCover) {
      modifiers.push({ type: 'directCover', dice: '-1b', value: -1 });
      this.trackModifierUsage('directCover');
    }
    
    if (testContext.isLeaning) {
      modifiers.push({ type: 'leaning', dice: '-1b', value: -1 });
      this.trackModifierUsage('leaning');
    }
    
    if (testContext.isBlind) {
      modifiers.push({ type: 'blind', dice: '-1w', value: -1 });
      this.trackModifierUsage('blind');
    }
    
    if (testContext.targetHasHardCover && testContext.isDamageTest) {
      modifiers.push({ type: 'hardCover', dice: '-1w', value: -1 });
      this.trackModifierUsage('hardCover');
    }
    
    // Miscellaneous Modifiers
    if (testContext.isWaiting) {
      modifiers.push({ type: 'waiting', dice: '+1', value: 1 });
      this.trackModifierUsage('waiting');
    }
    
    if (testContext.isSolo) {
      modifiers.push({ type: 'solo', dice: '+1', value: 1 });
      this.trackModifierUsage('solo');
    }
    
    if (testContext.isSuddenness) {
      modifiers.push({ type: 'suddenness', dice: '+1m', value: 1 });
      this.trackModifierUsage('suddenness');
    }
    
    if (testContext.hasFriendlyInCohesion) {
      modifiers.push({ type: 'friendly', dice: '+1m', value: 1 });
      this.trackModifierUsage('friendly');
    }
    
    if (testContext.hasHelp) {
      modifiers.push({ type: 'help', dice: '+1m', value: 1 });
      this.trackModifierUsage('help');
    }
    
    if (testContext.isSafety) {
      modifiers.push({ type: 'safety', dice: '+1w', value: 1 });
      this.trackModifierUsage('safety');
    }
    
    if (testContext.isConcentrate) {
      modifiers.push({ type: 'concentrate', dice: '+1w', value: 1 });
      this.trackModifierUsage('concentrate');
    }
    
    if (testContext.isFocus) {
      modifiers.push({ type: 'focus', dice: '+1w', value: 1 });
      this.trackModifierUsage('focus');
    }
    
    if (testContext.hindranceCount > 0) {
      modifiers.push({ type: 'hindrance', dice: '-1m', value: -testContext.hindranceCount });
      this.trackModifierUsage('hindrance');
    }
    
    if (testContext.isConfined) {
      modifiers.push({ type: 'confined', dice: '-1m', value: -1 });
      this.trackModifierUsage('confined');
    }
    
    return modifiers;
  }
  
  /**
   * Track modifier usage
   */
  trackModifierUsage(modifierName) {
    const current = this.modifierUsage.get(modifierName) || 0;
    this.modifierUsage.set(modifierName, current + 1);
  }
  
  /**
   * Track modifier effectiveness
   */
  trackModifierEffectiveness(modifierName, wasSuccessful) {
    const current = this.modifierEffectiveness.get(modifierName) || { applied: 0, successful: 0 };
    current.applied++;
    if (wasSuccessful) current.successful++;
    this.modifierEffectiveness.set(modifierName, current);
  }
  
  /**
   * Get modifier statistics
   */
  getModifierStatistics() {
    const stats = {};
    
    for (const [modifier, usage] of this.modifierUsage.entries()) {
      const effectiveness = this.modifierEffectiveness.get(modifier) || { applied: 0, successful: 0 };
      const successRate = effectiveness.applied > 0 ? effectiveness.successful / effectiveness.applied : 0;
      
      stats[modifier] = {
        usage: usage,
        applied: effectiveness.applied,
        successRate: successRate,
        effectiveness: successRate * usage // Combined metric
      };
    }
    
    return stats;
  }
  
  /**
   * Reset tracking
   */
  resetTracking() {
    this.initializeModifierTracking();
  }
}