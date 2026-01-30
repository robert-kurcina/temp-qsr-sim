// /src/simulator/CorrectVictorySystem.js
/**
 * Correct implementation of MEST QSR Victory Points and Resource Points
 */
export class CorrectVictorySystem {
  constructor() {
    this.victoryPoints = { sideA: 0, sideB: 0 };
    this.resourcePoints = { sideA: 0, sideB: 0 };
    this.battlefieldCenter = 0; // X=0 line for Aggression
    this.startingModelCounts = { sideA: 0, sideB: 0 };
    this.eliminatedBP = { sideA: 0, sideB: 0 };
    this.bottledOut = { sideA: false, sideB: false };
  }
  
  /**
   * Initialize victory tracking
   */
  initializeVictoryTracking(gameState) {
    this.startingModelCounts.sideA = gameState.models.filter(m => m.side === 'side-a').length;
    this.startingModelCounts.sideB = gameState.models.filter(m => m.side === 'side-b').length;
    this.battlefieldCenter = 0;
    
    // Check initial outnumbering for Outnumbered VP
    this.checkInitialOutnumbering();
  }
  
  /**
   * Check initial outnumbering condition
   */
  checkInitialOutnumbering() {
    const ratio = this.startingModelCounts.sideA / this.startingModelCounts.sideB;
    
    if (ratio >= 2 || ratio <= 0.5) {
      // 2:1 or greater outnumbering
      if (this.startingModelCounts.sideA < this.startingModelCounts.sideB) {
        this.victoryPoints.sideA += 2; // Smaller side gets +2 VP
      } else {
        this.victoryPoints.sideB += 2; // Smaller side gets +2 VP
      }
    } else if (ratio >= 1.5 || ratio <= 0.67) {
      // 3:2 or greater outnumbering
      if (this.startingModelCounts.sideA < this.startingModelCounts.sideB) {
        this.victoryPoints.sideA += 1; // Sm smaller side gets +1 VP
      } else {
        this.victoryPoints.sideB += 1; // Smaller side gets +1 VP
      }
    }
  }
  
  /**
   * Track Aggression VP during game
   */
  checkAggressionVP(gameState, turn) {
    // Check if at least half of models crossed center line
    const sideACrossed = gameState.models.filter(m => 
      m.side === 'side-a' && m.position.x >= this.battlefieldCenter
    ).length;
    const sideBCrossed = gameState.models.filter(m => 
      m.side === 'side-b' && m.position.x <= this.battlefieldCenter
    ).length;
    
    // Aggression VP (awarded once per side)
    if (sideACrossed >= this.startingModelCounts.sideA / 2 && !this.aggressionAwarded?.sideA) {
      this.victoryPoints.sideA += 1;
      this.aggressionAwarded = { ...this.aggressionAwarded, sideA: true };
      
      // First model to cross gets +1 RP
      if (!this.firstCrossRP?.sideA) {
        this.resourcePoints.sideA += 1;
        this.firstCrossRP = { ...this.firstCrossRP, sideA: true };
      }
    }
    
    if (sideBCrossed >= this.startingModelCounts.sideB / 2 && !this.aggressionAwarded?.sideB) {
      this.victoryPoints.sideB += 1;
      this.aggressionAwarded = { ...this.aggressionAwarded, sideB: true };
      
      if (!this.firstCrossRP?.sideB) {
        this.resourcePoints.sideB += 1;
        this.firstCrossRP = { ...this.firstCrossRP, sideB: true };
      }
    }
  }
  
  /**
   * Track Bottled Out condition
   */
  checkBottledOut(gameState, side) {
    const sideModels = gameState.models.filter(m => m.side === side);
    const orderedModels = sideModels.filter(m => m.status === 'attentive');
    
    if (orderedModels.length === 0) {
      // Side has no Ordered characters - Bottled Out
      this.bottledOut[side] = true;
      
      // Award VP to opposing side
      const opposingSide = side === 'side-a' ? 'side-b' : 'side-a';
      this.victoryPoints[opposingSide] += 1;
      
      // In 2+ player games, award 3 RP to other remaining sides
      // (For 2-player, this doesn't apply)
    }
  }
  
  /**
   * Track Elimination BP
   */
  trackEliminationBP(eliminatedModel, side) {
    // Add model's BP value to eliminated total
    const modelBP = this.getModelBP(eliminatedModel);
    this.eliminatedBP[side] += modelBP;
  }
  
  /**
   * Calculate final Elimination VP
   */
  calculateEliminationVP() {
    // +1 VP to side with most Opposing BP eliminated
    if (this.eliminatedBP.sideB > this.eliminatedBP.sideA) {
      this.victoryPoints.sideA += 1; // Side A eliminated more of Side B
    } else if (this.eliminatedBP.sideA > this.eliminatedBP.sideB) {
      this.victoryPoints.sideB += 1; // Side B eliminated more of Side A
    }
    // If tied, no Elimination VP awarded
  }
  
  /**
   * Calculate final Resource Point VP
   */
  calculateResourcePointVP() {
    // +1 VP to side with most RP
    // +2 VP if double the RP of opponent AND at least 10 more
    if (this.resourcePoints.sideA > this.resourcePoints.sideB) {
      if (this.resourcePoints.sideA >= this.resourcePoints.sideB * 2 && 
          this.resourcePoints.sideA >= this.resourcePoints.sideB + 10) {
        this.victoryPoints.sideA += 2;
      } else {
        this.victoryPoints.sideA += 1;
      }
    } else if (this.resourcePoints.sideB > this.resourcePoints.sideA) {
      if (this.resourcePoints.sideB >= this.resourcePoints.sideA * 2 && 
          this.resourcePoints.sideB >= this.resourcePoints.sideA + 10) {
        this.victoryPoints.sideB += 2;
      } else {
        this.victoryPoints.sideB += 1;
      }
    }
  }
  
  /**
   * Get final battle result with correct VP/RP
   */
  getFinalResult(gameState) {
    // Calculate Elimination VP
    this.calculateEliminationVP();
    
    // Calculate Resource Point VP  
    this.calculateResourcePointVP();
    
    // Determine winner
    let winner = 'draw';
    if (this.victoryPoints.sideA > this.victoryPoints.sideB) {
      winner = 'side-a';
    } else if (this.victoryPoints.sideB > this.victoryPoints.sideA) {
      winner = 'side-b';
    } else {
      // Tie-breaker: most total RP wins
      if (this.resourcePoints.sideA > this.resourcePoints.sideB) {
        winner = 'side-a';
      } else if (this.resourcePoints.sideB > this.resourcePoints.sideA) {
        winner = 'side-b';
      }
    }
    
    return {
      winner: winner,
      victoryPoints: { ...this.victoryPoints },
      resourcePoints: { ...this.resourcePoints },
      eliminatedBP: { ...this.eliminatedBP },
      bottledOut: { ...this.bottledOut }
    };
  }
  
  // Helper methods
  getModelBP(model) {
    // Calculate BP based on archetype, weapons, armor
    // This would use your BP cost system
    return 30; // Placeholder
  }
}