// /src/simulator/CorrectEndGameSystem.js
/**
 * Correct implementation of MEST QSR End-game rules
 */
export class CorrectEndGameSystem {
  constructor() {
    this.endDice = []; // Array of END dice (1-6 values)
    this.turn = 0;
    this.gameSize = 'small'; // small, medium, large
    this.endGameTriggerTurn = 4; // Based on game size
    this.breakpointMoraleChecked = false;
  }
  
  /**
   * Initialize end-game system based on game size
   */
  initializeEndGame(gameConfig) {
    // Determine game size from BP limit
    if (gameConfig.bp <= 500) {
      this.gameSize = 'small';
      this.endGameTriggerTurn = 4;
    } else if (gameConfig.bp <= 750) {
      this.gameSize = 'medium';
      this.endGameTriggerTurn = 6;
    } else {
      this.gameSize = 'large';
      this.endGameTriggerTurn = 8;
    }
    
    this.turn = 0;
    this.endDice = [];
    this.breakpointMoraleChecked = false;
  }
  
  /**
   * End of Turn processing
   */
  processEndOfTurn(gameState) {
    this.turn++;
    
    // Check Breakpoint Morale (>50% forces KO'd/Eliminated)
    this.checkBreakpointMorale(gameState);
    
    // Check if game should end due to no opposing models
    if (this.checkNoOpposingModels(gameState)) {
      return { gameEnded: true, reason: 'no_opposing_models' };
    }
    
    // Check End-game Triggers
    const endGameResult = this.checkEndGameTriggers();
    if (endGameResult.gameEnded) {
      return endGameResult;
    }
    
    // Add END dice if at trigger turn or later
    this.addEndDiceIfNeeded();
    
    return { gameEnded: false, turn: this.turn };
  }
  
  /**
   * Check Breakpoint Morale condition
   */
  checkBreakpointMorale(gameState) {
    const sideAModels = gameState.models.filter(m => m.side === 'side-a');
    const sideBModels = gameState.models.filter(m => m.side === 'side-b');
    
    const sideAActive = sideAModels.filter(m => this.isModelActive(m)).length;
    const sideBActive = sideBModels.filter(m => this.isModelActive(m)).length;
    
    const sideATotal = sideAModels.length;
    const sideBTotal = sideBModels.length;
    
    // Check if >50% eliminated for each side
    if (sideAActive < sideATotal / 2 && !this.breakpointMoraleChecked?.sideA) {
      // Side A requires Bottle Test
      this.triggerBottleTest('side-a', 'breakpoint_morale');
      this.breakpointMoraleChecked = { ...this.breakpointMoraleChecked, sideA: true };
    }
    
    if (sideBActive < sideBTotal / 2 && !this.breakpointMoraleChecked?.sideB) {
      // Side B requires Bottle Test  
      this.triggerBottleTest('side-b', 'breakpoint_morale');
      this.breakpointMoraleChecked = { ...this.breakpointMoraleChecked, sideB: true };
    }
  }
  
  /**
   * Check if no opposing models remain
   */
  checkNoOpposingModels(gameState) {
    const sideAActive = gameState.models.filter(m => m.side === 'side-a' && this.isModelActive(m)).length;
    const sideBActive = gameState.models.filter(m => m.side === 'side-b' && this.isModelActive(m)).length;
    
    return sideAActive === 0 || sideBActive === 0;
  }
  
  /**
   * Check End-game Triggers with END dice
   */
  checkEndGameTriggers() {
    if (this.turn < this.endGameTriggerTurn) {
      return { gameEnded: false };
    }
    
    if (this.endDice.length === 0) {
      return { gameEnded: false };
    }
    
    // Mission Defender rolls END dice (assuming Side B is defender for testing)
    const rollResults = this.endDice.map(() => Math.floor(Math.random() * 6) + 1);
    
    // If any die shows 1, 2, or 3 (miss), game ends immediately
    const hasMiss = rollResults.some(roll => roll <= 3);
    
    if (hasMiss) {
      return { 
        gameEnded: true, 
        reason: 'end_game_trigger', 
        rollResults: rollResults 
      };
    }
    
    return { gameEnded: false };
  }
  
  /**
   * Add END dice at appropriate turns
   */
  addEndDiceIfNeeded() {
    // Add an END die if at trigger turn or later
    if (this.turn >= this.endGameTriggerTurn && this.endDice.length === 0) {
      this.endDice.push(1); // Add first END die
    }
    
    // Add additional END dice at trigger turns (4,6,8 for small,medium,large)
    const additionalTurns = [4, 6, 8];
    if (additionalTurns.includes(this.turn) && this.turn > this.endGameTriggerTurn) {
      this.endDice.push(1); // Add another END die
    }
  }
  
  /**
   * Trigger Bottle Test for Breakpoint Morale
   */
  triggerBottleTest(side, reason) {
    // This would integrate with your Morale Test system
    console.log(`Bottle Test required for ${side} due to ${reason}`);
    
    // In actual implementation, this would:
    // 1. Roll Morale Test for the side
    // 2. Apply consequences if failed (Bottled Out)
    // 3. Award VP to opposing side if Bottled Out
  }
  
  /**
   * Check if model is active (not KO'd/Eliminated)
   */
  isModelActive(model) {
    // Check tokens for KO/Eliminated status
    const tokens = model.tokens || {};
    return tokens.ko === 0 && tokens.eliminated === 0;
  }
  
  /**
   * Get current game state
   */
  getGameState() {
    return {
      turn: this.turn,
      endDice: [...this.endDice],
      gameSize: this.gameSize,
      endGameTriggerTurn: this.endGameTriggerTurn
    };
  }
}