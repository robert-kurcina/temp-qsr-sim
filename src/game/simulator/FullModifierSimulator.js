// /src/simulator/FullModifierSimulator.js
import { SituationalModifiers } from './SituationalModifiers.js';
import { EnhancedHiddenStatus } from './EnhancedHiddenStatus.js';

/**
 * Full-featured optimized simulator with complete situational modifier support
 */
export class FullModifierSimulator {
  constructor(options = {}) {
    this.situationalModifiers = new SituationalModifiers();
    this.hiddenStatus = new EnhancedHiddenStatus(this.situationalModifiers);
    this.debugMode = options.debugMode || false;
    this.maxTurns = options.maxTurns || 8;
  }
  
  /**
   * Simulate battle with full modifier tracking
   */
  simulateBattle(testConfig) {
    // Reset modifier tracking
    this.situationalModifiers.resetTracking();
    
    // Initialize battlefield
    const gameState = this.initializeBattlefield(testConfig);
    
    // Set initial statuses
    this.initializeStatuses(gameState, testConfig);
    
    // Main simulation loop
    for (let turn = 1; turn <= this.maxTurns; turn++) {
      gameState.turn = turn;
      
      // Side A activation
      this.activateSide(gameState, 'side-a');
      
      // Check early termination
      if (this.shouldTerminateEarly(gameState)) break;
      
      // Side B activation
      this.activateSide(gameState, 'side-b');
      
      // Check early termination
      if (this.shouldTerminateEarly(gameState)) break;
      
      // End of turn cleanup
      this.endOfTurnCleanup(gameState);
    }
    
    // Get results with modifier statistics
    const result = this.getBattleResult(gameState);
    result.modifierStats = this.situationalModifiers.getModifierStatistics();
    
    return result;
  }
  
  /**
   * Initialize statuses based on test configuration
   */
  initializeStatuses(gameState, testConfig) {
    if (testConfig.specialRules?.waitStatus) {
      gameState.models
        .filter(m => m[1] === 'side-b')
        .forEach(m => this.setWaitStatus(m[0]));
    }
    
    if (testConfig.specialRules?.hiddenStatus) {
      gameState.models
        .filter(m => m[1] === 'side-b')
        .forEach(m => this.hiddenStatus.setHidden(m[0]));
    }
  }
  
  /**
   * Resolve combat with full situational modifiers
   */
  resolveCombat(attacker, defender, combatType, gameState) {
    // Build test context with all situational factors
    const testContext = this.buildTestContext(attacker, defender, combatType, gameState);
    
    // Apply situational modifiers
    const modifiers = this.situationalModifiers.applyModifiers(testContext);
    
    // Calculate final test result
    const baseTarget = combatType === 'close' ? attacker[3] : attacker[4]; // CCA or RCA
    const modifierDice = this.calculateModifierDice(modifiers);
    const wildDice = this.calculateWildDice(modifiers);
    const baseDice = this.calculateBaseDice(modifiers);
    
    // Roll dice and determine success
    const hitSuccess = this.rollTest(baseTarget, baseDice, modifierDice, wildDice);
    
    // Track effectiveness
    modifiers.forEach(mod => {
      this.situationalModifiers.trackModifierEffectiveness(mod.type, hitSuccess);
    });
    
    return {
      hit: hitSuccess,
      modifiers: modifiers,
      dice: { base: baseDice, modifier: modifierDice, wild: wildDice }
    };
  }
  
  /**
   * Build comprehensive test context
   * TODO implement these functions and features
   */
  buildTestContext(attacker, defender, combatType, gameState) {
    const context = {
      // Basic combat info
      combatType: combatType,
      isDamageTest: false,
      
      // Positional modifiers
      isCharge: this.checkCharge(attacker, defender, gameState),
      isHighGround: this.checkHighGround(attacker, defender),
      sizeDifference: defender[11] - attacker[11], // SIZ difference
      
      // Defensive modifiers
      isDefend: this.checkDefend(defender, gameState),
      hasDirectCover: this.checkDirectCover(defender, gameState),
      targetHasHardCover: this.checkHardCover(defender, gameState),
      
      // Tactical modifiers
      outnumberAmount: this.calculateOutnumber(attacker, defender, gameState),
      isFlanked: this.checkFlanked(defender, gameState),
      isCornered: this.checkCornered(defender, gameState),
      
      // Ranged-specific modifiers
      isPointBlank: this.checkPointBlank(attacker, defender),
      hasElevation: this.checkElevation(attacker, defender),
      distanceModifier: this.calculateDistanceModifier(attacker, defender),
      hasInterveningCover: this.checkInterveningCover(attacker, defender, gameState),
      obscuredCount: this.countObscuredModels(attacker, defender, gameState),
      
      // Status modifiers
      isWaiting: this.checkWaitStatus(attacker),
      isSuddenness: this.hiddenStatus.canUseSuddenness(attacker[0], combatType === 'close' ? 'closeCombat' : 'rangedCombat'),
      hasFriendlyInCohesion: this.checkFriendlyCohesion(attacker, gameState),
      hindranceCount: this.getHindranceCount(attacker, gameState),
      
      // Special conditions
      // TODO implement these functions
      isOverreach: this.checkOverreach(attacker, gameState),
      isLeaning: this.checkLeaning(attacker, gameState),
      isBlind: this.checkBlindAttack(attacker, gameState),
      isConfined: this.checkConfined(attacker, gameState),
      isSolo: this.checkSoloReact(attacker, gameState),
      hasHelp: this.checkHelpAvailable(attacker, gameState),
      isSafety: this.checkSafetyMorale(attacker, gameState),
      isConcentrate: this.checkConcentrateAction(attacker, gameState),
      isFocus: this.checkFocusAction(attacker, gameState)
    };
    
    // Apply Suddenness if used
    if (context.isSuddenness) {
      this.hiddenStatus.applySuddenness(attacker[0]);
    }
    
    return context;
  }
  
  // ... rest of implementation methods
  
  /**
   * Get comprehensive battle result with modifier analytics
   */
  getBattleResult(gameState) {
    const sideALive = gameState.models.filter(m => m[1] === 'side-a' && this.isModelActive(m, gameState)).length;
    const sideBLive = gameState.models.filter(m => m[1] === 'side-b' && this.isModelActive(m, gameState)).length;
    
    let winner = 'draw';
    if (sideALive > sideBLive) winner = 'side-a';
    else if (sideBLive > sideALive) winner = 'side-b';
    
    return {
      winner: winner,
      turns: gameState.turn,
      casualties: {
        sideA: gameState.models.filter(m => m[1] === 'side-a').length - sideALive,
        sideB: gameState.models.filter(m => m[1] === 'side-b').length - sideBLive
      },
      modifierStats: this.situationalModifiers.getModifierStatistics()
    };
  }
}