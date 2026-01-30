// /src/engine/InitiativeSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * MEST QSR Initiative System with full turn sequence management
 */
export class InitiativeSystem {
  constructor() {
    this.currentTurn = 1;
    this.initiativeOrder = []; // Array of { side, player }
    this.currentInitiativeIndex = 0;
    this.initiativePoints = new Map(); // side -> IP
    this.initiativeCardHolder = null; // side that holds initiative card
    this.turnIndicator = null;
    this.designatedLeaders = new Map(); // side -> modelId
  }

  /**
   * Initialize turn sequence
   */
  initializeTurn(missionAttacker) {
    this.currentTurn = 1;
    this.initiativeCardHolder = missionAttacker;
    this.createTurnIndicator();
  }

  /**
   * Create turn indicator (large d6 showing turn number)
   */
  createTurnIndicator() {
    if (this.turnIndicator) {
      window.BATTLEFIELD_ENGINE.scene.remove(this.turnIndicator);
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;

    // Large die appearance
    context.fillStyle = '#34495e';
    context.fillRect(0, 0, 128, 128);
    context.fillStyle = '#ecf0f1';
    context.font = 'bold 96px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this.currentTurn.toString(), 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 2, 1);
    sprite.position.set(-10, 10, 0.1); // Mission Attacker's edge

    this.turnIndicator = sprite;
    window.BATTLEFIELD_ENGINE.scene.add(sprite);
  }

  /**
   * Start new turn - reset all models to Ready
   */
  startNewTurn() {
    // Remove all Done tokens
    window.BATTLEFIELD_ENGINE.models.forEach(model => {
      window.TOKEN_SYSTEM?.removeToken(model.id, 'done');
    });

    // Increment turn
    this.currentTurn++;
    this.createTurnIndicator();

    // Clear initiative points from previous turn
    this.initiativePoints.clear();

    // Reset initiative order
    this.initiativeOrder = [];
    this.currentInitiativeIndex = 0;
  }

  /**
   * Determine Initiative - perform Initiative Test
   */
  determineInitiative(sides, bpSpent) {
    const testResults = {};

    // Each side identifies Designated Leader
    sides.forEach(side => {
      const leader = this.findDesignatedLeader(side);
      this.designatedLeaders.set(side, leader?.id);

      if (leader) {
        // Perform Opposed INT Test
        const baseDice = this.getBaseDice(side, bpSpent);
        const hindranceModifiers = this.getHindranceModifiers(leader);
        const testResult = this.rollInitiativeTest(baseDice, hindranceModifiers);
        testResults[side] = testResult;
      } else {
        testResults[side] = { score: 0, dice: [], carryOver: [] };
      }
    });

    // Determine winner
    const winner = this.determineInitiativeWinner(testResults, sides);

    // Award Initiative Points
    this.awardInitiativePoints(testResults, winner);

    // Set initiative card holder
    this.initiativeCardHolder = winner;

    // Build initiative order
    this.buildInitiativeOrder(winner, sides);

    return { winner, testResults, initiativePoints: this.initiativePoints };
  }

  /**
   * Find Designated Leader for side (Ordered, In-Play character)
   */
  findDesignatedLeader(side) {
    return window.BATTLEFIELD_ENGINE.models.find(model =>
      model.side === side &&
      !model.isKO &&
      this.isOrdered(model)
    );
  }

  /**
   * Check if model is Ordered (not Disordered/Panicked)
   */
  isOrdered(model) {
    const derivedStatus = model.derivedStatus || [];
    return !derivedStatus.some(status =>
      status === 'Disordered' || status === 'Panicked'
    );
  }

  /**
   * Get base dice for Initiative Test
   */
  getBaseDice(side, bpSpent) {
    let baseDice = 1; // Default 1 base die

    // Optimized rule: +1 Base die for side with least BP spent
    if (this.currentTurn === 1) {
      const minBPSide = Object.keys(bpSpent).reduce((minSide, currentSide) =>
        bpSpent[currentSide] < bpSpent[minSide] ? currentSide : minSide
      );
      if (side === minBPSide) {
        baseDice = 2;
      }
    }

    return baseDice;
  }

  /**
   * Get Hindrance Situational Test Modifiers
   */
  getHindranceModifiers(model) {
    const hindrances = window.HINDRANCE_TRACKER?.getHindrances(model.id) || { fear: 0, delay: 0, wounds: 0 };
    let modifiers = 0;

    // Fear modifiers
    if (hindrances.fear >= 1) modifiers -= 1;
    if (hindrances.fear >= 2) modifiers -= 1;
    if (hindrances.fear >= 3) modifiers -= 1;

    // Delay modifiers  
    if (hindrances.delay >= 1) modifiers -= 1;
    if (hindrances.delay >= 2) modifiers -= 1;

    // Wound modifiers
    if (hindrances.wounds >= 1) modifiers -= 1;

    return modifiers;
  }

  /**
   * Roll Initiative Test
   */
  rollInitiativeTest(baseDice, modifiers) {
    const dice = [];
    const carryOver = [];

    // Roll base dice
    for (let i = 0; i < baseDice; i++) {
      const roll = Math.floor(Math.random() * 6) + 1;
      dice.push(roll);
      if (roll >= 5) carryOver.push(roll); // Carry-over on 5+
    }

    // Calculate score
    const rawScore = dice.reduce((sum, die) => sum + die, 0);
    const finalScore = Math.max(0, rawScore + modifiers);

    return { score: finalScore, dice: dice, carryOver: carryOver };
  }

  /**
   * Determine Initiative winner
   */
  determineInitiativeWinner(testResults, sides) {
    let winner = null;
    let highestScore = -1;
    let tieCandidates = [];

    // Find highest score
    sides.forEach(side => {
      const score = test结果显示[side].score;
      if (score > highestScore) {
        highestScore = score;
        tieCandidates = [side];
      } else if (score === highestScore) {
        tieCandidates.push(side);
      }
    });

    // Handle ties
    if (tieCandidates.length > 1) {
      winner = this.breakInitiativeTie(tieCandidates, testResults);
    } else {
      winner = tieCandidates[0];
    }

    return winner;
  }

  /**
   * Break Initiative tie
   */
  breakInitiativeTie(tieCandidates, testResults) {
    // First tie-breaker: highest total pips
    let maxPips = -1;
    let pipWinners = [];

    tieCandidates.forEach(side => {
      const pips = testResults[side].dice.reduce((sum, die) => sum + die, 0);
      if (pips > maxPips) {
        maxPips = pips;
        pipWinners = [side];
      } else if (pips === maxPips) {
        pipWinners.push(side);
      }
    });

    if (pipWinners.length === 1) {
      return pipWinners[0];
    }

    // Re-roll with d6 until no ties
    while (true) {
      const reRolls = new Map();
      let maxRoll = -1;
      let finalWinners = [];

      pipWinners.forEach(side => {
        const roll = Math.floor(Math.random() * 6) + 1;
        reRolls.set(side, roll);
        if (roll > maxRoll) {
          maxRoll = roll;
          finalWinners = [side];
        } else if (roll === maxRoll) {
          finalWinners.push(side);
        }
      });

      if (finalWinners.length === 1) {
        return finalWinners[0];
      }
      // Continue re-rolling if still tied
    }
  }

  /**
   * Award Initiative Points
   */
  awardInitiativePoints(testResults, winner) {
    const sides = Object.keys(testResults);
    const winnerScore = testResults[winner].score;
    const lowestScore = Math.min(...sides.map(side => testResults[side].score));

    // Winner gets IP equal to difference
    const winnerIP = winnerScore - lowestScore;
    this.initiativePoints.set(winner, winnerIP);

    // Other players get IP for carry-over dice
    sides.forEach(side => {
      if (side !== winner) {
        const carryOverCount = testResults[side].carryOver.length;
        this.initiativePoints.set(side, carryOverCount);
      }
    });
  }

  /**
   * Build Initiative Order
   */
  buildInitiativeOrder(winner, sides) {
    // Winner decides who goes first
    // For now, assume winner chooses themselves
    this.initiativeOrder = sides.map(side => ({ side: side }));
    this.currentInitiativeIndex = 0;
  }

  /**
   * Get current initiative points for side
   */
  getInitiativePoints(side) {
    return this.initiativePoints.get(side) || 0;
  }

  /**
   * Spend Initiative Points
   */
  spendInitiativePoints(side, cost) {
    const current = this.getInitiativePoints(side);
    if (current >= cost) {
      this.initiativePoints.set(side, current - cost);
      return true;
    }
    return false;
  }

  /**
   * Initiative Abilities
   */
  maintainInitiative(side) {
    if (this.spendInitiativePoints(side, 1)) {
      // Don't pass initiative - activate another model
      console.log(`${side} maintains initiative`);
      return true;
    }
    return false;
  }

  forceInitiative(side, targetSide) {
    if (this.spendInitiativePoints(side, 1)) {
      // Pass initiative to target side
      console.log(`${side} forces initiative to ${targetSide}`);
      return true;
    }
    return false;
  }

  refreshModel(side, modelId) {
    if (this.spendInitiativePoints(side, 1)) {
      // Remove one Delay token
      window.HINDRANCE_TRACKER?.removeHindrance(modelId, 'delay');
      console.log(`${side} refreshed model ${modelId}`);
      return true;
    }
    return false;
  }

  /**
   * End turn cleanup
   */
  endTurn() {
    // Lose unspent Initiative Points
    this.initiativePoints.clear();

    // Check Breakpoint Morale
    this.checkBreakpointMorale();
  }

  /**
   * Check Breakpoint Morale
   */
  checkBreakpointMorale() {
    const sides = new Set(window.BATTLEFIELD_ENGINE.models.map(m => m.side));

    sides.forEach(side => {
      const totalModels = window.BATTLEFIELD_ENGINE.models.filter(m => m.side === side).length;
      const koOrEliminated = window.BATTLEFIELD_ENGINE.models.filter(m =>
        m.side === side && (m.isKO || m.isEliminated)
      ).length;

      if (koOrEliminated > totalModels / 2) {
        console.log(`${side} has reached Breakpoint Morale - Bottle Test required!`);
        // Trigger Bottle Test (would be implemented separately)
      }
    });
  }

  // Player resource areas at battlefield edges
  createPlayerResourceArea(side) {
    const x = side === 'side-a' ? -20 : 20; // Battlefield edge
    const y = 20;

    // Initiative Point tokens
    const initiativeTokens = this.playerResources[side].initiative.map((token, i) => {
      const mesh = this.createInitiativeToken();
      mesh.position.set(x + (i * 2), y, 0.1);
      return mesh;
    });

    // Victory Point tokens  
    const victoryTokens = this.playerResources[side].victory.map((token, i) => {
      const mesh = this.createVictoryToken();
      mesh.position.set(x + (i * 2), y - 3, 0.1);
      return mesh;
    });

    return { initiativeTokens, victoryTokens };
  }
}