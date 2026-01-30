// /src/simulator/OptimizedHeadlessSimulator.js
/**
 * Highly optimized headless simulator for Monte Carlo analysis
 */
export class OptimizedHeadlessSimulator {
  constructor(options = {}) {
    this.debugMode = options.debugMode || false;
    this.maxTurns = options.maxTurns || 8;
    this.earlyTermination = options.earlyTermination !== false;
    this.combatCache = new Map();
    this.traitCache = new Map();
  }
  
  /**
   * Simulate battle with optimizations
   */
  simulateBattle(testConfig) {
    // Pre-calculate static values
    this.preCalculateStaticValues(testConfig);
    
    // Initialize battlefield
    const gameState = this.initializeBattlefield(testConfig);
    
    // Main simulation loop
    for (let turn = 1; turn <= this.maxTurns; turn++) {
      // Side A activation
      this.activateSide(gameState, 'side-a');
      
      // Check early termination
      if (this.shouldTerminateEarly(gameState)) {
        break;
      }
      
      // Side B activation  
      this.activateSide(gameState, 'side-b');
      
      // Check early termination
      if (this.shouldTerminateEarly(gameState)) {
        break;
      }
      
      // End of turn cleanup
      this.endOfTurnCleanup(gameState);
    }
    
    return this.getBattleResult(gameState);
  }
  
  /**
   * Pre-calculate static values for performance
   */
  preCalculateStaticValues(testConfig) {
    // Cache trait effects
    this.cacheTraitEffects();
    
    // Cache weapon properties
    this.cacheWeaponProperties();
  }
  
  /**
   * Initialize battlefield with flat arrays for performance
   */
  initializeBattlefield(testConfig) {
    const models = [];
    const tokens = new Map();
    
    // Create Side A models
    testConfig.sideA.models.forEach((modelId, index) => {
      const model = this.createOptimizedModel(
        modelId, 
        'side-a', 
        testConfig.sideA.archetype,
        testConfig.sideA.weapons[0],
        testConfig.sideA.armor
      );
      models.push(model);
    });
    
    // Create Side B models
    testConfig.sideB.models.forEach((modelId, index) => {
      const model = this.createOptimizedModel(
        modelId, 
        'side-b', 
        testConfig.sideB.archetype,
        testConfig.sideB.weapons[0], 
        testConfig.sideB.armor
      );
      models.push(model);
    });
    
    return { models, tokens, turn: 1 };
  }
  
  /**
   * Create optimized model as flat array
   */
  createOptimizedModel(id, side, archetype, weapon, armor) {
    // Model structure: [id, side, archetype, cca, rca, ref, int, pow, str, for, mov, siz, traits, posX, posY, apSpent, status]
    const stats = this.getArchetypeStats(archetype);
    const traits = this.getTraitsFromArchetype(archetype);
    const laden = this.calculateLadenBurden(armor, stats);
    
    // Apply laden penalties
    const effectiveMOV = Math.max(0, stats.mov - laden);
    const effectiveREF = Math.max(0, stats.ref - laden);
    const effectiveCCA = Math.max(0, stats.cca - laden);
    
    return [
      id,           // 0
      side,         // 1
      archetype,    // 2
      effectiveCCA, // 3 - CCA
      stats.rca,    // 4 - RCA  
      effectiveREF, // 5 - REF
      stats.int,    // 6 - INT
      stats.pow,    // 7 - POW
      stats.str,    // 8 - STR
      stats.for,    // 9 - FOR
      effectiveMOV, // 10 - MOV
      stats.siz,    // 11 - SIZ
      traits,       // 12 - traits array
      0,            // 13 - posX
      0,            // 14 - posY
      0,            // 15 - apSpent
      'attentive'   // 16 - status
    ];
  }
  
  /**
   * Activate side with optimized AI
   */
  activateSide(gameState, side) {
    const models = gameState.models.filter(m => m[1] === side && this.isModelActive(m, gameState));
    
    for (const model of models) {
      const action = this.decideOptimizedAction(model, gameState, side);
      this.executeOptimizedAction(model, action, gameState);
      this.markModelDone(model);
    }
  }
  
  /**
   * Optimized action decision (simplified tactical AI)
   */
  decideOptimizedAction(model, gameState, side) {
    const enemies = gameState.models.filter(m => m[1] !== side && this.isModelActive(m, gameState));
    
    if (enemies.length === 0) {
      return { type: 'wait' };
    }
    
    // Find closest enemy
    const closestEnemy = this.getClosestEnemy(model, enemies);
    const distance = this.calculateDistance(model[13], model[14], closestEnemy[13], closestEnemy[14]);
    
    // Simple weapon-based decision
    const weapon = this.getModelWeapon(model);
    if (weapon.class === 'Melee') {
      if (distance <= 1) {
        return { type: 'closeCombat', target: closestEnemy };
      } else {
        return { type: 'move', target: closestEnemy };
      }
    } else {
      // Ranged weapon
      if (distance <= this.getWeaponRange(weapon) && distance > 1) {
        return { type: 'rangedCombat', target: closestEnemy };
      } else if (distance > 1) {
        return { type: 'move', target: closestEnemy };
      } else {
        return { type: 'closeCombat', target: closestEnemy };
      }
    }
  }
  
  /**
   * Optimized combat resolution with caching
   */
  resolveCombat(attacker, defender, combatType) {
    const cacheKey = this.generateCombatCacheKey(attacker, defender, combatType);
    
    if (this.combatCache.has(cacheKey)) {
      return this.combatCache.get(cacheKey);
    }
    
    const result = this.calculateCombatResult(attacker, defender, combatType);
    this.combatCache.set(cacheKey, result);
    return result;
  }
  
  /**
   * Generate cache key for combat
   */
  generateCombatCacheKey(attacker, defender, combatType) {
    return `${attacker[0]}-${defender[0]}-${combatType}-${attacker[15]}-${defender[15]}`;
  }
  
  /**
   * Early termination check
   */
  shouldTerminateEarly(gameState) {
    if (!this.earlyTermination) return false;
    
    const sideALive = gameState.models.filter(m => m[1] === 'side-a' && this.isModelActive(m, gameState)).length;
    const sideBLive = gameState.models.filter(m => m[1] === 'side-b' && this.isModelActive(m, gameState)).length;
    
    // One side eliminated
    if (sideALive === 0 || sideBLive === 0) {
      return true;
    }
    
    // Overwhelming advantage
    if (sideALive >= sideBLive * 3 && sideBLive <= 2) {
      return true;
    }
    if (sideBLive >= sideALive * 3 && sideALive <= 2) {
      return true;
    }
    
    return false;
  }
  
  // Utility methods (optimized versions)
  isModelActive(model, gameState) {
    const tokens = gameState.tokens.get(model[0]) || { wound: 0, ko: 0, eliminated: 0 };
    return tokens.ko === 0 && tokens.eliminated === 0;
  }
  
  calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }
  
  getClosestEnemy(model, enemies) {
    return enemies.reduce((closest, current) => {
      const distCurrent = this.calculateDistance(model[13], model[14], current[13], current[14]);
      const distClosest = this.calculateDistance(model[13], model[14], closest[13], closest[14]);
      return distCurrent < distClosest ? current : closest;
    });
  }
  
  // ... rest of optimized methods
}