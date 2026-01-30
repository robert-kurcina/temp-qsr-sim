// /src/simulator/EnhancedBattleSimulator.js
import { UnifiedAICoordinator } from '../ai/UnifiedAICoordinator.js';

export class EnhancedBattleSimulator {
  constructor() {
    this.aiCoordinator = new UnifiedAICoordinator('headless');
    this.battleLog = [];
    this.turnSummaries = [];
    this.roundSummaries = [];
  }
  
  /**
   * Simulate battle with detailed logging
   */
  simulateBattle(missionConfig, options = {}) {
    const { 
      logLevel = 'detailed', // 'basic', 'detailed', 'verbose'
      maxTurns = 20,
      recordActions = true
    } = options;
    
    this.battleLog = [];
    this.turnSummaries = [];
    this.roundSummaries = [];
    
    this.log(`=== BATTLE START: ${missionConfig.name} ===`, 'header');
    this.log(`Side A: ${missionConfig.sideA.name} (${missionConfig.sideA.models.length} models)`, 'info');
    this.log(`Side B: ${missionConfig.sideB.name} (${missionConfig.sideB.models.length} models)`, 'info');
    this.log(`BP: ${missionConfig.sideA.bp} vs ${missionConfig.sideB.bp}`, 'info');
    
    // Initialize battlefield
    this.setupBattlefield(missionConfig);
    
    let round = 1;
    while (!this.isMissionComplete(missionConfig) && this.turn <= maxTurns) {
      this.log(`\n--- ROUND ${round} ---`, 'round');
      
      // Side A activation
      this.log(`\nSIDE A ACTIVATION`, 'phase');
      this.activatePlayer('side-a', missionConfig, logLevel);
      
      // Side B activation  
      this.log(`\nSIDE B ACTIVATION`, 'phase');
      this.activatePlayer('side-b', missionConfig, logLevel);
      
      // End of round
      const roundSummary = this.createRoundSummary(round);
      this.roundSummaries.push(roundSummary);
      this.logRoundSummary(roundSummary);
      
      round++;
      this.turn++;
    }
    
    const battleResult = this.getMissionResult(missionConfig);
    this.logBattleResult(battleResult);
    
    return {
      result: battleResult,
      logs: this.battleLog,
      turnSummaries: this.turnSummaries,
      roundSummaries: this.roundSummaries
    };
  }
  
  /**
   * Activate player with detailed logging
   */
  activatePlayer(side, missionConfig, logLevel) {
    const models = this.models.filter(m => m.side === side && this.isModelActive(m));
    const gameState = this.getCurrentGameState();
    
    if (models.length === 0) {
      this.log(`${side.toUpperCase()}: No active models`, 'info');
      return;
    }
    
    // Get AI-coordinated actions
    const actions = this.aiCoordinator.coordinateTurn(side, models, gameState);
    
    // Execute actions with logging
    const turnActions = [];
    actions.forEach((action, modelId) => {
      const model = this.models.find(m => m.id === modelId);
      if (model) {
        const actionResult = this.executeActionWithLogging(model, action, missionConfig, logLevel);
        turnActions.push(actionResult);
      }
    });
    
    // Record turn summary
    const turnSummary = {
      turn: this.turn,
      side: side,
      actions: turnActions,
      casualties: this.getCasualtiesThisTurn(side),
      tokensApplied: this.getTokensAppliedThisTurn(side)
    };
    
    this.turnSummaries.push(turnSummary);
    
    if (logLevel === 'verbose') {
      this.logTurnDetails(turnSummary);
    }
  }
  
  /**
   * Execute action with comprehensive logging
   */
  executeActionWithLogging(model, action, missionConfig, logLevel) {
    const actionRecord = {
      model: model.id,
      type: action.type,
      target: action.target?.id || null,
      success: false,
      details: {}
    };
    
    switch(action.type) {
      case 'move':
        this.moveModel(model, action.target);
        actionRecord.success = true;
        actionRecord.details = { 
          from: { ...model.position },
          to: { ...action.target }
        };
        this.log(`${model.id} moves to (${action.target.x.toFixed(1)}, ${action.target.y.toFixed(1)})`, 'action');
        break;
        
      case 'closeCombat':
        const combatResult = this.resolveCloseCombat(model, action.target);
        actionRecord.success = combatResult.hit;
        actionRecord.details = combatResult;
        this.logCombatResult(model, action.target, combatResult, 'close');
        break;
        
      case 'rangedCombat':
        const rangedResult = this.resolveRangedCombat(model, action.target);
        actionRecord.success = rangedResult.hit;
        actionRecord.details = rangedResult;
        this.logCombatResult(model, action.target, rangedResult, 'ranged');
        break;
        
      case 'wait':
        this.addToken(model.id, 'wait');
        actionRecord.success = true;
        this.log(`${model.id} waits`, 'action');
        break;
        
      case 'support':
        // Healing logic
        actionRecord.success = true;
        this.log(`${model.id} provides support`, 'action');
        break;
    }
    
    return actionRecord;
  }
  
  /**
   * Log combat result with detail level
   */
  logCombatResult(attacker, defender, result, combatType) {
    const combatTypeName = combatType === 'close' ? 'Close Combat' : 'Ranged Combat';
    const hitResult = result.hit ? 'HIT!' : 'MISS';
    
    this.log(`${attacker.id} vs ${defender.id} - ${combatTypeName}: ${hitResult}`, 'combat');
    
    if (result.hit) {
      const damageResult = result.damage ? 'WOUND!' : 'Damage avoided';
      this.log(`  Damage: ${damageResult} (Roll: ${result.rolls.damage.roll}, Target: ${result.rolls.damage.target})`, 'combat');
      
      if (result.damage) {
        this.log(`  ${defender.id} receives Wound token`, 'effect');
      }
    } else {
      this.log(`  Hit roll: ${result.rolls.hit.roll}, Target: ${result.rolls.hit.target}`, 'combat');
    }
  }
  
  /**
   * Create round summary
   */
  createRoundSummary(roundNumber) {
    const sideACasualties = this.getCasualtiesBySide('side-a');
    const sideBCasualties = this.getCasualtiesBySide('side-b');
    const totalActions = this.turnSummaries.filter(t => t.turn === this.turn).length;
    
    return {
      round: roundNumber,
      turn: this.turn,
      sideACasualties: sideACasualties,
      sideBCasualties: sideBCasualties,
      totalActions: totalActions,
      activeModels: {
        sideA: this.models.filter(m => m.side === 'side-a' && this.isModelActive(m)).length,
        sideB: this.models.filter(m => m.side === 'side-b' && this.isModelActive(m)).length
      }
    };
  }
  
  /**
   * Log round summary
   */
  logRoundSummary(summary) {
    this.log(`Round ${summary.round} Summary:`, 'summary');
    this.log(`  Active Models - Side A: ${summary.activeModels.sideA}, Side B: ${summary.activeModels.sideB}`, 'summary');
    this.log(`  Casualties This Round - Side A: ${summary.sideACasualties}, Side B: ${summary.sideBCasualties}`, 'summary');
  }
  
  /**
   * Log battle result
   */
  logBattleResult(result) {
    this.log(`\n=== BATTLE RESULT ===`, 'header');
    this.log(`Winner: ${result.winner === 'draw' ? 'Draw' : result.winner.toUpperCase()}`, 'result');
    this.log(`Turns: ${result.turns}`, 'result');
    this.log(`Casualties - Side A: ${result.casualties.sideA}, Side B: ${result.casualties.sideB}`, 'result');
    this.log(`Survival Rate - Side A: ${((1 - result.casualties.sideA / this.initialSideACount) * 100).toFixed(1)}%, Side B: ${((1 - result.casualties.sideB / this.initialSideBCount) * 100).toFixed(1)}%`, 'result');
  }
  
  /**
   * Logging system
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message };
    this.battleLog.push(logEntry);
    
    // Console output based on log level
    const colors = {
      header: '\x1b[36m',
      info: '\x1b[37m',
      phase: '\x1b[33m',
      round: '\x1b[35m',
      action: '\x1b[32m',
      combat: '\x1b[31m',
      effect: '\x1b[33m',
      summary: '\x1b[34m',
      result: '\x1b[36m'
    };
    
    console.log(`${colors[level] || ''}${message}\x1b[0m`);
  }
  
  // ... rest of methods (setupBattlefield, resolveCombat, etc.)
}