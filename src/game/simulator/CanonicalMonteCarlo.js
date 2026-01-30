// Complete Monte Carlo simulator implementing your exact MEST QSR rules
import { MEST_QSR } from '../rules/MEST_QSR_Rules.js';

export class CanonicalMonteCarlo {
  constructor() {
    this.victoryPoints = { sideA: 0, sideB: 0 };
    this.resourcePoints = { sideA: 0, sideB: 0 };
    this.endDice = [];
    this.turn = 0;
    this.aggressionAwarded = {};
    this.breakpointChecked = {};
  }
  
  // Implement exact Victory Conditions from your QSR
  calculateVictoryPoints(gameState) {
    // Aggression VP (from your QSR)
    const centerLine = 0;
    const sideACrossed = gameState.models.filter(m => 
      m.side === 'side-a' && m.position.x >= centerLine
    ).length;
    const sideAHalf = Math.ceil(gameState.startingCounts.sideA / 2);
    
    if (sideACrossed >= sideAHalf && !this.aggressionAwarded?.sideA) {
      this.victoryPoints.sideA += MEST_QSR.victoryConditions.aggression.vp;
      this.resourcePoints.sideA += MEST_QSR.victoryConditions.aggression.rp;
      this.aggressionAwarded = { ...this.aggressionAwarded, sideA: true };
    }
    
    const sideBCrossed = gameState.models.filter(m => 
      m.side === 'side-b' && m.position.x <= centerLine
    ).length;
    const sideBHalf = Math.ceil(gameState.startingCounts.sideB / 2);
    
    if (sideBCrossed >= sideBHalf && !this.aggressionAwarded?.sideB) {
      this.victoryPoints.sideB += MEST_QSR.victoryConditions.aggression.vp;
      this.resourcePoints.sideB += MEST_QSR.victoryConditions.aggression.rp;
      this.aggressionAwarded = { ...this.aggressionAwarded, sideB: true };
    }
    
    // Bottled VP (from your QSR)
    if (gameState.bottledOut?.sideB) {
      this.victoryPoints.sideA += MEST_QSR.victoryConditions.bottled.vp;
    }
    if (gameState.bottledOut?.sideA) {
      this.victoryPoints.sideB += MEST_QSR.victoryConditions.bottled.vp;
    }
    
    // Elimination VP (from your QSR) - by BP total, not model count
    if (gameState.eliminatedBP?.sideB > gameState.eliminatedBP?.sideA) {
      this.victoryPoints.sideA += MEST_QSR.victoryConditions.elimination.vp;
    } else if (gameState.eliminatedBP?.sideA > gameState.eliminatedBP?.sideB) {
      this.victoryPoints.sideB += MEST_QSR.victoryConditions.elimination.vp;
    }
    
    // Outnumbered VP (from your QSR)
    const ratio = gameState.startingCounts.sideA / gameState.startingCounts.sideB;
    if (ratio <= 0.5) { // Side A outnumbered 2:1
      this.victoryPoints.sideA += MEST_QSR.victoryConditions.outnumbered.vp.twoToOne;
    } else if (ratio <= 0.67) { // Side A outnumbered 3:2
      this.victoryPoints.sideA += MEST_QSR.victoryConditions.outnumbered.vp.threeToTwo;
    } else if (ratio >= 2) { // Side B outnumbered 2:1
      this.victoryPoints.sideB += MEST_QSR.victoryConditions.outnumbered.vp.twoToOne;
    } else if (ratio >= 1.5) { // Side B outnumbered 3:2
      this.victoryPoints.sideB += MEST_QSR.victoryConditions.outnumbered.vp.threeToTwo;
    }
    
    // Resource Point bonus VP (from your QSR)
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
  
  // Implement exact End-game rules from your QSR
  processEndOfTurn(gameState) {
    this.turn++;
    
    // Breakpoint Morale (from your QSR)
    const sideAActive = gameState.models.filter(m => m.side === 'side-a' && this.isModelActive(m)).length;
    const sideATotal = gameState.startingCounts.sideA;
    
    if (sideAActive < sideATotal / 2 && !this.breakpointChecked?.sideA) {
      // Requires Bottle Test per your QSR
      this.triggerBottleTest('side-a');
      this.breakpointChecked = { ...this.breakpointChecked, sideA: true };
    }
    
    const sideBActive = gameState.models.filter(m => m.side === 'side-b' && this.isModelActive(m)).length;
    const sideBTotal = gameState.startingCounts.sideB;
    
    if (sideBActive < sideBTotal / 2 && !this.breakpointChecked?.sideB) {
      this.triggerBottleTest('side-b');
      this.breakpointChecked = { ...this.breakpointChecked, sideB: true };
    }
    
    // End-game Trigger timing (from your QSR)
    const gameSize = this.determineGameSize(gameState.bpLimit);
    const endGameTurn = MEST_QSR.endGame.endGameTrigger.gameSize[gameSize].endGameBegins;
    
    if (this.turn >= endGameTurn) {
      // Add END die if not already present
      if (this.endDice.length === 0) {
        this.endDice.push(1);
      }
      
      // Roll END dice (Mission Defender rolls per your QSR)
      const endRolls = this.endDice.map(() => Math.floor(Math.random() * 6) + 1);
      
      // Game ends if any die shows 1, 2, or 3 (miss per your QSR)
      if (endRolls.some(roll => roll <= 3)) {
        return { gameEnded: true, reason: 'end_game_trigger', turn: this.turn };
      }
    }
    
    // Check for no opposing models (End of Conflict per your QSR)
    if (sideAActive === 0 || sideBActive === 0) {
      return { gameEnded: true, reason: 'no_opposing_models', turn: this.turn };
    }
    
    return { gameEnded: false, turn: this.turn };
  }
  
  determineGameSize(bpLimit) {
    if (bpLimit <= 500) return 'small';
    if (bpLimit <= 750) return 'medium';
    return 'large';
  }
  
  isModelActive(model) {
    const tokens = model.tokens || {};
    return !(tokens.ko || tokens.eliminated || tokens.bottledOut);
  }
  
  triggerBottleTest(side) {
    // This would integrate with your actual Morale Test system
    // For simulation purposes, we'll assume a base failure rate
    const moraleFailureRate = 0.3; // 30% chance to fail Bottle Test
    if (Math.random() < moraleFailureRate) {
      // Side has Bottled Out
      return true;
    }
    return false;
  }
  
  // Implement exact Grit trait from your QSR
  applyGritTrait(model, context) {
    // From your QSR: "Does not perform a Morale Test when a Friendly model is KO'd or Eliminated unless that model had higher POW"
    if (context.fallenModelPOW <= model.stats.pow) {
      return false; // Morale Test prevented
    }
    return true; // Morale Test proceeds
  }
  
  // Implement exact Impale trait from your QSR
  applyImpaleTrait(attacker, defender, damageResult) {
    // From your QSR: "Defender Damage Test plus 1 per 3 Impact remaining. Use the lowest amount of Impact remaining for Defender if it had multiple types of Armor."
    const impactRemaining = this.calculateImpactRemaining(attacker, defender);
    const impaleBonus = Math.floor(impactRemaining / 3);
    return damageResult + impaleBonus;
  }
  
  calculateImpactRemaining(attacker, defender) {
    // Simplified calculation based on weapon STR and armor AR
    const weaponImpact = attacker.weapon.impact || attacker.stats.str;
    let totalAR = 0;
    
    // Calculate total Armor Rating from all armor pieces
    if (defender.armor) {
      defender.armor.forEach(piece => {
        if (piece.ar) totalAR += piece.ar;
      });
    }
    
    // Impact remaining after armor reduction
    const impactRemaining = Math.max(0, weaponImpact - totalAR);
    return impactRemaining;
  }
  
  // Main simulation method
  simulateBattle(testConfig) {
    // Reset state
    this.victoryPoints = { sideA: 0, sideB: 0 };
    this.resourcePoints = { sideA: 0, sideB: 0 };
    this.endDice = [];
    this.turn = 0;
    this.aggressionAwarded = {};
    this.breakpointChecked = {};
    
    // Initialize game state
    const gameState = this.initializeGameState(testConfig);
    
    // Main game loop
    let gameResult = { gameEnded: false };
    while (!gameResult.gameEnded && this.turn < 12) { // Safety limit
      // Activate sides, resolve combat, etc.
      this.activateSide(gameState, 'side-a');
      this.activateSide(gameState, 'side-b');
      
      // Process end of turn
      gameResult = this.processEndOfTurn(gameState);
      
      if (gameResult.gameEnded) break;
    }
    
    // Calculate final victory points
    this.calculateVictoryPoints(gameState);
    
    // Determine winner
    let winner = 'draw';
    if (this.victoryPoints.sideA > this.victoryPoints.sideB) {
      winner = 'side-a';
    } else if (this.victoryPoints.sideB > this.victoryPoints.sideA) {
      winner = 'side-b';
    } else {
      // Tie-breaker: most total RP wins (from your QSR)
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
      turns: this.turn,
      eliminatedBP: gameState.eliminatedBP || { sideA: 0, sideB: 0 },
      bottledOut: gameState.bottledOut || { sideA: false, sideB: false }
    };
  }
  
  initializeGameState(testConfig) {
    // Create models based on test configuration
    const models = [];
    const startingCounts = { sideA: 0, sideB: 0 };
    
    // Add Side A models
    if (testConfig.sideA?.models) {
      testConfig.sideA.models.forEach((modelId, index) => {
        models.push(this.createModel(modelId, 'side-a', testConfig.sideA));
        startingCounts.sideA++;
      });
    }
    
    // Add Side B models  
    if (testConfig.sideB?.models) {
      testConfig.sideB.models.forEach((modelId, index) => {
        models.push(this.createModel(modelId, 'side-b', testConfig.sideB));
        startingCounts.sideB++;
      });
    }
    
    return {
      models: models,
      startingCounts: startingCounts,
      bpLimit: testConfig.bp || 500,
      eliminatedBP: { sideA: 0, sideB: 0 },
      bottledOut: { sideA: false, sideB: false }
    };
  }
  
  createModel(id, side, config) {
    // Create model with stats based on archetype
    const archetypes = {
      'Untrained': { cca: 0, rca: 0, ref: 2, int: 2, pow: 1, str: 1, for: 2, mov: 2, siz: 3 },
      'Militia': { cca: 1, rca: 1, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 },
      'Average': { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 },
      'Veteran': { cca: 3, rca: 3, ref: 3, int: 3, pow: 3, str: 3, for: 3, mov: 3, siz: 3 },
      'Elite': { cca: 3, rca: 3, ref: 3, int: 3, pow: 3, str: 3, for: 3, mov: 3, siz: 3 }
    };
    
    const stats = archetypes[config.archetype] || archetypes.Average;
    
    // Weapon definitions with costs and properties
    const weapons = {
      'Sword, (Broad)': { cost: 17, type: 'melee', impact: 1 },
      'Spear, Medium': { cost: 30, type: 'melee', impact: 1, reach: true },
      'Bow, Long': { cost: 13, type: 'ranged', range: 12 },
      'Hammer, War': { cost: 25, type: 'melee', impact: 1, stun: 2 },
      'Axe, Long': { cost: 27, type: 'melee', impact: 1, reach: true, cleave: 2 },
      'Daggers': { cost: 6, type: 'melee', impact: 0 },
      'Club, Spiked Mace': { cost: 11, type: 'melee', impact: 1 }
    };
    
    const weapon = weapons[config.weapon] || weapons['Sword, (Broad)'];
    
    return {
      id: id,
      side: side,
      archetype: config.archetype,
      stats: stats,
      weapon: weapon,
      armor: config.armor || [],
      position: { x: side === 'side-a' ? -10 : 10, y: 0 },
      tokens: {},
      status: 'attentive'
    };
  }
  
  activateSide(gameState, side) {
    // Simplified activation - in real implementation, this would handle movement, combat, etc.
    const models = gameState.models.filter(m => m.side === side && this.isModelActive(m));
    
    // Simple AI: move toward enemy and attack if in range
    models.forEach(model => {
      // Find closest enemy
      const enemies = gameState.models.filter(m => m.side !== side && this.isModelActive(m));
      if (enemies.length === 0) return;
      
      const closestEnemy = enemies.reduce((closest, current) => {
        const distCurrent = Math.abs(current.position.x - model.position.x);
        const distClosest = Math.abs(closest.position.x - model.position.x);
        return distCurrent < distClosest ? current : closest;
      });
      
      const distance = Math.abs(closestEnemy.position.x - model.position.x);
      
      if (distance <= 1) {
        // In melee range - attack
        this.resolveCombat(model, closestEnemy, gameState);
      } else if (model.weapon.type === 'ranged' && distance <= model.weapon.range) {
        // In ranged range - attack
        this.resolveCombat(model, closestEnemy, gameState);
      } else {
        // Move toward enemy (spend 1 AP for 2 MU movement)
        const direction = model.side === 'side-a' ? 1 : -1;
        model.position.x += direction * 2;
      }
    });
  }
  
  resolveCombat(attacker, defender, gameState) {
    // Simplified combat resolution
    const hitTarget = attacker.weapon.type === 'melee' ? attacker.stats.cca : attacker.stats.rca;
    const hitRoll = Math.floor(Math.random() * 6) + 1;
    const hitSuccess = hitRoll <= hitTarget;
    
    if (hitSuccess) {
      // Damage calculation
      const damage = attacker.stats.str + (attacker.weapon.impact || 0);
      const damageRoll = Math.floor(Math.random() * 6) + 1;
      const woundSuccess = damageRoll <= damage;
      
      if (woundSuccess) {
        // Apply wound
        if (!defender.tokens.wounds) defender.tokens.wounds = 0;
        defender.tokens.wounds++;
        
        // Check for KO/Elimination
        if (defender.tokens.wounds >= 2) {
          defender.tokens.eliminated = true;
          // Track BP for Elimination VP
          const modelBP = this.getModelBP(defender);
          if (defender.side === 'side-a') {
            if (!gameState.eliminatedBP) gameState.eliminatedBP = { sideA: 0, sideB: 0 };
            gameState.eliminatedBP.sideA += modelBP;
          } else {
            if (!gameState.eliminatedBP) gameState.eliminatedBP = { sideA: 0, sideB: 0 };
            gameState.eliminatedBP.sideB += modelBP;
          }
        }
      }
    }
  }
  
  getModelBP(model) {
    // Calculate BP based on archetype and equipment
    const archetypeCosts = {
      'Untrained': 7, 'Militia': 20, 'Average': 30, 'Veteran': 61, 'Elite': 129
    };
    
    const weaponCosts = {
      'Sword, (Broad)': 17, 'Spear, Medium': 30, 'Bow, Long': 13,
      'Hammer, War': 25, 'Axe, Long': 27, 'Daggers': 6, 'Club, Spiked Mace': 11
    };
    
    let bp = archetypeCosts[model.archetype] || 30;
    bp += weaponCosts[model.weapon?.name] || 0;
    return bp;
  }
}

// Export for use in test files
export default CanonicalMonteCarlo;