// /src/simulator/HeadlessBattleSimulator.js

import { UnifiedAICoordinator } from '../ai/UnifiedAICoordinator.js';

/**
 * Headless MEST Tactics Battle Simulator
 * Runs automated AI vs AI battles with pure JavaScript
 */
export class HeadlessBattleSimulator {
  constructor() {
    this.aiCoordinator = new UnifiedAICoordinator('headless');

    this.models = [];
    this.tokens = new Map();
    this.turn = 1;
    this.initiativeOrder = [];
    this.missionResult = null;
    this.combatLog = [];
  }
  
  /**
   * Simulate complete battle
   */
  simulateBattle(missionConfig) {
    console.log(`Starting mission: ${missionConfig.name}`);
    
    // Initialize battlefield
    this.setupBattlefield(missionConfig);
    
    // Main simulation loop
    while (!this.isMissionComplete(missionConfig)) {
      this.runTurn(missionConfig);
      this.turn++;
      
      // Safety limit
      if (this.turn > 20) {
        console.log('Mission terminated: Turn limit exceeded');
        break;
      }
    }
    
    return this.getMissionResult(missionConfig);
  }
  
  /**
   * Setup battlefield from mission config
   */
  setupBattlefield(config) {
    this.models = [];
    this.tokens.clear();
    this.turn = 1;
    this.combatLog = [];
    
    // Create Side A models
    config.sideA.models.forEach((modelId, index) => {
      const model = this.createModel(modelId, 'side-a', config.sideA.assembly);
      this.models.push(model);
    });
    
    // Create Side B models  
    config.sideB.models.forEach((modelId, index) => {
      const model = this.createModel(modelId, 'side-b', config.sideB.assembly);
      this.models.push(model);
    });
    
    console.log(`Battlefield setup: ${this.models.length} models`);
  }
  
  /**
   * Create model from archetype
   */
  createModel(id, side, assemblyType) {
    // Parse archetype and variant
    const [archetype, variant] = this.parseAssemblyType(assemblyType);
    
    // Get base stats
    const baseStats = this.getBaseArchetypeStats(archetype);
    const traits = [...(baseStats.traits || [])];
    
    return {
      id: id,
      side: side,
      archetype: archetype,
      cca: baseStats.cca,
      rca: baseStats.rca, 
      ref: baseStats.ref,
      int: baseStats.int,
      pow: baseStats.pow,
      str: baseStats.str,
      for: baseStats.for,
      mov: baseStats.mov,
      siz: baseStats.siz,
      traits: traits,
      position: { x: 0, y: 0 }, // Will be set by deployment
      apSpent: 0,
      status: 'attentive'
    };
  }
  
  /**
   * Parse assembly type (e.g., "Veteran, Wise")
   */
  parseAssemblyType(assembly) {
    if (assembly.includes(', ')) {
      const parts = assembly.split(', ');
      return [parts[0], parts[1]];
    }
    return [assembly, null];
  }
  
  /**
   * Get base archetype stats
   */
  getBaseArchetypeStats(archetype) {
    const archetypes = {
      'Untrained': { cca: 0, rca: 1, ref: 2, int: 2, pow: 1, str: 1, for: 2, mov: 2, siz: 3, traits: [] },
      'Militia': { cca: 1, rca: 2, ref: 2, int: 2, pow: 2, str: 1, for: 2, mov: 2, siz: 3, traits: [] },
      'Average': { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3, traits: [] },
      'Veteran': { cca: 3, rca: 3, ref: 3, int: 2, pow: 3, str: 2, for: 2, mov: 2, siz: 3, traits: ['Grit'] },
      'Elite': { cca: 3, rca: 3, ref: 3, int: 3, pow: 3, str: 3, for: 3, mov: 3, siz: 3, traits: ['Grit', 'Fight', 'Shoot'] }
    };
    return archetypes[archetype] || archetypes['Average'];
  }

  
  /**
   * Run single turn
   */
  runTurn(missionConfig) {
    console.log(`\n--- Turn ${this.turn} ---`);
    
    // Determine initiative
    this.determineInitiative();
    
    // Activate each player
    for (const player of this.initiativeOrder) {
      this.activatePlayer(player.side, missionConfig);
    }
    
    // End of turn cleanup
    this.endOfTurnCleanup();
  }
  
  /**
   * Determine initiative order
   */
  determineInitiative() {
    // Simple random initiative for now
    this.initiativeOrder = [
      { side: 'side-a' },
      { side: 'side-b' }
    ];
    
    // 50% chance to swap order
    if (Math.random() < 0.5) {
      this.initiativeOrder.reverse();
    }
  }
  
  /**
   * Activate player
   */
  activatePlayer(side, missionConfig) {
    console.log(`${side} activation`);
    
    const models = this.models.filter(m => m.side === side && this.isModelActive(m));
    const gameState = this.getCurrentGameState();
    
    // Get AI-coordinated actions
    const actions = this.aiCoordinator.coordinateTurn(side, models, gameState);
    
    // Execute actions
    actions.forEach((action, modelId) => {
      const model = this.models.find(m => m.id === modelId);
      if (model) {
        this.executeAction(model, action, missionConfig);
        this.markModelDone(model);
      }
    });
  }

  getCurrentGameState() {
    return {
      turn: this.turn,
      models: this.models,
      tokenManager: { tokens: this.tokens },
      currentSide: null // Not needed for headless
    };
  }
  
  /**
   * Check if model is active
   */
  isModelActive(model) {
    // Check if model is eliminated
    const tokens = this.getModelTokens(model.id);
    if (tokens.ko || tokens.eliminated) {
      return false;
    }
    return true;
  }
  
  /**
   * Decide action for model
   */
  decideAction(model, missionConfig) {
    const enemies = this.models.filter(m => m.side !== model.side);
    const visibleEnemies = enemies.filter(e => this.isEnemyVisible(model, e));
    
    // Combat actions
    if (visibleEnemies.length > 0) {
      const closestEnemy = this.getClosestEnemy(model, visibleEnemies);
      const distance = this.calculateDistance(model.position, closestEnemy.position);
      
      if (distance <= 1) {
        return { type: 'closeCombat', target: closestEnemy };
      } else {
        return { type: 'rangedCombat', target: closestEnemy };
      }
    }
    
    // Move toward objectives
    const objectives = missionConfig.objectives || [];
    if (objectives.length > 0) {
      const objective = objectives[0]; // Simple: go to first objective
      if (objective.location) {
        return { type: 'move', target: objective.location };
      }
    }
    
    // Default action
    return { type: 'wait' };
  }
  
  /**
   * Execute action
   */
  executeAction(model, action, missionConfig) {
    switch(action.type) {
      case 'closeCombat':
        this.resolveCloseCombat(model, action.target);
        break;
      case 'rangedCombat':
        this.resolveRangedCombat(model, action.target);
        break;
      case 'move':
        this.moveModel(model, action.target);
        break;
      case 'wait':
        this.addToken(model.id, 'wait');
        console.log(`${model.id} waits`);
        break;
    }
  }
  
  /**
   * Resolve close combat
   */
  resolveCloseCombat(attacker, defender) {
    console.log(`${attacker.id} attacks ${defender.id} in close combat`);
    
    // Hit test
    const hitRoll = this.rollD6();
    const hitTarget = attacker.cca;
    const hitSuccess = hitRoll <= hitTarget;
    
    if (!hitSuccess) {
      console.log(`  Miss! (Roll: ${hitRoll}, Target: ${hitTarget})`);
      return;
    }
    
    // Damage test
    const damageRoll = this.rollD6();
    const damageTarget = defender.ref;
    const damageSuccess = damageRoll > damageTarget;
    
    if (damageSuccess) {
      this.addToken(defender.id, 'wound');
      console.log(`  WOUND! (Damage roll: ${damageRoll}, Target: ${damageTarget})`);
      
      // Fear test
      this.resolveFearTest(defender);
    } else {
      console.log(`  Damage avoided! (Roll: ${damageRoll}, Target: ${damageTarget})`);
    }
  }
  
  /**
   * Resolve ranged combat
   */
  resolveRangedCombat(attacker, defender) {
    console.log(`${attacker.id} makes ranged attack on ${defender.id}`);
    
    // Hit test
    const hitRoll = this.rollD6();
    const hitTarget = attacker.rca;
    const hitSuccess = hitRoll <= hitTarget;
    
    if (!hitSuccess) {
      console.log(`  Miss! (Roll: ${hitRoll}, Target: ${hitTarget})`);
      return;
    }
    
    // Damage test  
    const damageRoll = this.rollD6();
    const damageTarget = defender.ref;
    const damageSuccess = damageRoll > damageTarget;
    
    if (damageSuccess) {
      this.addToken(defender.id, 'wound');
      console.log(`  WOUND! (Damage roll: ${damageRoll}, Target: ${damageTarget})`);
      
      // Fear test
      this.resolveFearTest(defender);
    } else {
      console.log(`  Damage avoided! (Roll: ${damageRoll}, Target: ${damageTarget})`);
    }
  }
  
  /**
   * Resolve fear test
   */
  resolveFearTest(model) {
    const fearTokens = this.getModelTokens(model.id).fear || 0;
    
    if (fearTokens === 0) {
      // First fear token automatic
      this.addToken(model.id, 'fear');
      console.log(`  ${model.id} gains Fear token`);
      return;
    }
    
    // Fear test required
    const difficulty = fearTokens >= 3 ? 4 : (fearTokens >= 2 ? 3 : 2);
    const roll = this.rollD6();
    
    if (roll <= difficulty) {
      this.addToken(model.id, 'fear');
      console.log(`  ${model.id} fails Fear test (Roll: ${roll}, Difficulty: ${difficulty})`);
    }
  }
  
  /**
   * Add token to model
   */
  addToken(modelId, tokenType) {
    if (!this.tokens.has(modelId)) {
      this.tokens.set(modelId, { wound: 0, delay: 0, fear: 0, ko: 0, eliminated: 0, wait: 0, hidden: 0 });
    }
    
    const tokens = this.tokens.get(modelId);
    tokens[tokenType] = (tokens[tokenType] || 0) + 1;
  }
  
  /**
   * Get model tokens
   */
  getModelTokens(modelId) {
    return this.tokens.get(modelId) || { wound: 0, delay: 0, fear: 0, ko: 0, eliminated: 0, wait: 0, hidden: 0 };
  }
  
  /**
   * Mark model as done
   */
  markModelDone(model) {
    model.status = 'done';
  }
  
  /**
   * End of turn cleanup
   */
  endOfTurnCleanup() {
    // Reset model status
    this.models.forEach(model => {
      model.status = 'attentive';
      model.apSpent = 0;
    });
    
    // Clear Wait tokens
    this.tokens.forEach((tokens, modelId) => {
      tokens.wait = 0;
    });
  }
  
  /**
   * Check if enemy is visible
   */
  isEnemyVisible(model, enemy) {
    const distance = this.calculateDistance(model.position, enemy.position);
    return distance <= 8; // Simplified LOS
  }
  
  /**
   * Get closest enemy
   */
  getClosestEnemy(model, enemies) {
    return enemies.reduce((closest, current) => {
      const distCurrent = this.calculateDistance(model.position, current.position);
      const distClosest = this.calculateDistance(model.position, closest.position);
      return distCurrent < distClosest ? current : closest;
    });
  }
  
  /**
   * Calculate distance
   */
  calculateDistance(posA, posB) {
    return Math.sqrt(Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2));
  }
  
  /**
   * Move model (simplified)
   */
  moveModel(model, target) {
    // Simple movement toward target
    model.position.x = target.x || 0;
    model.position.y = target.y || 0;
    console.log(`${model.id} moves to (${model.position.x}, ${model.position.y})`);
  }
  
  /**
   * Roll D6
   */
  rollD6() {
    return Math.floor(Math.random() * 6) + 1;
  }
  
  /**
   * Check if mission is complete
   */
  isMissionComplete(missionConfig) {
    // Check if all enemies eliminated
    const sideALive = this.models.filter(m => m.side === 'side-a' && this.isModelActive(m)).length;
    const sideBLive = this.models.filter(m => m.side === 'side-b' && this.isModelActive(m)).length;
    
    if (sideALive === 0 || sideBLive === 0) {
      return true;
    }
    
    // Check turn limit
    const turnLimit = missionConfig.specialRules?.turnLimit || 8;
    return this.turn >= turnLimit;
  }
  
  /**
   * Get mission result
   */
  getMissionResult(missionConfig) {
    const sideALive = this.models.filter(m => m.side === 'side-a' && this.isModelActive(m)).length;
    const sideBLive = this.models.filter(m => m.side === 'side-b' && this.isModelActive(m)).length;
    
    let winner = 'draw';
    if (sideALive > sideBLive) winner = 'side-a';
    else if (sideBLive > sideALive) winner = 'side-b';
    
    return {
      winner: winner,
      turns: this.turn,
      casualties: {
        sideA: this.models.filter(m => m.side === 'side-a' && !this.isModelActive(m)).length,
        sideB: this.models.filter(m => m.side === 'side-b' && !this.isModelActive(m)).length
      },
      combatLog: this.combatLog
    };
  }
}