import { Archetype } from './Archetype.js';
import { Weapon } from './Weapon.js';
import { Armor } from './Armor.js';
import { Equipment } from './Equipment.js';
import { AgilitySystem } from '../engine/AgilitySystem.js';
import { HandManager } from '../engine/HandManager.js';

export class Character {
  constructor(config) {
    this.archetype = new Archetype(config.archetype);
    this.variantName = config.variant || null;

    // Equipment & Hand Management
    this.handManager = new HandManager(this);
    this.inHand = this.handManager.inHand;
    this.stowed = this.handManager.stowed;

    this.armor = {
      helm: config.armor?.helm ? new Armor(config.armor.helm) : null,
      suit: config.armor?.suit ? new Armor(config.armor.suit) : null,
      shield: config.armor?.shield ? new Armor(config.armor.shield) : null
    };

    this.equipment = config.equipment ? new Equipment(config.equipment) : null;

    // State Management
    this.status = []; // e.g., ['Leaning', 'Disordered', 'Concentrating']
    this.leanPosition = null; // Stores {x, y, z} when leaning
    this.actionsThisTurn = { fiddle: 0 };
  }

  // --- Status Management ---
  hasStatus(status) {
    return this.status.includes(status);
  }

  addStatus(status) {
    if (!this.hasStatus(status)) {
      this.status.push(status);
    }
  }

  removeStatus(status) {
    this.status = this.status.filter(s => s !== status);
  }

  isLeaning() {
    return this.hasStatus('Leaning');
  }

  isConcentrating() {
    return this.hasStatus('Concentrating');
  }
  
  setLeanPosition(position) {
      this.leanPosition = position;
      this.addStatus('Leaning');
  }
  
  clearLean() {
      this.leanPosition = null;
      this.removeStatus('Leaning');
  }

  // --- Action Tracking ---
  incrementFiddleActions() {
    this.actionsThisTurn.fiddle++;
  }

  hasUsedFiddleAction() {
    return this.actionsThisTurn.fiddle > 0;
  }

  resetTurnState() {
    this.actionsThisTurn = { fiddle: 0 };
    this.clearLean();
  }

  // --- Hand Availability ---
  getFreeHands() {
    return this.handManager.getFreeHands();
  }
  
  switchItem(itemName) {
    return this.handManager.switchItem(itemName);
  }

  /**
   * Returns the character's total Agility pool in MU.
   * @returns {number}
   */
  get agility() {
    return AgilitySystem.calculateAgility(this);
  }

  getBP() {
    let total = this.archetype.bp;
    if (this.variantName) {
        const variantData = this.archetype.getVariant(this.variantName);
        if (variantData) total += variantData.bp;
    }

    const allItems = [...this.inHand, ...this.stowed, this.equipment, ...Object.values(this.armor)].filter(Boolean);
    const sortedItems = allItems.sort((a, b) => b.bp - a.bp);
    sortedItems.forEach((item, index) => {
        total += (index === 0) ? item.bp : Math.floor(item.bp / 2);
    });

    return total;
  }

  getAR() {
    let ar = 0;
    Object.values(this.armor).forEach(piece => {
      if (piece) ar += piece.ar;
    });
    return ar;
  }

  getLadenPenalty() {
    let penalty = 0;
    Object.values(this.armor).forEach(piece => {
      if (piece) penalty += piece.getLadenPenalty();
    });
    return penalty;
  }

  getTraits() {
    const allTraits = new Set();
    this.archetype.traits.forEach(t => allTraits.add(t));

    if (this.variantName) {
        const variantData = this.archetype.getVariant(this.variantName);
        if (variantData && variantData.adds) {
            variantData.adds.forEach(t => allTraits.add(t));
        }
    }
    [...this.inHand, ...this.stowed].forEach(weapon => {
        weapon.traits.forEach(t => allTraits.add(t));
    });
    Object.values(this.armor).forEach(piece => {
        if (piece) piece.rawTraits.forEach(t => allTraits.add(t));
    });
    if (this.equipment) {
        this.equipment.traits.forEach(t => allTraits.add(`Advantage ${t}`));
    }

    return [...allTraits];
  }

  hasTrait(traitName) {
    return this.getTraits().some(t => t.startsWith(traitName));
  }
}
