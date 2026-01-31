import { TraitParser } from '../../utils/trait-parser.js';
import { Weapon } from '../core/Weapon.js';

export class HandManager {
    constructor(character) {
        this.character = character;
        this.inHand = [];
        this.stowed = [];
        this._initializeWeaponLayout();
    }

    _initializeWeaponLayout() {
        const allWeapons = (this.character.archetype.weapons || []).map(w => new Weapon(w));
        let handsUsed = 0;
        allWeapons.forEach(w => {
            const handsRequired = this.getHandsRequired(w);
            if (handsUsed + handsRequired <= 2) {
                this.inHand.push(w);
                handsUsed += handsRequired;
            } else {
                this.stowed.push(w);
            }
        });
    }

    getHandsRequired(item) {
        const traits = Array.isArray(item.rawTraits) ? item.rawTraits.map(t => TraitParser.parse(t)) : [];
        if (traits.some(t => t.name === '2H')) return 2;
        if (traits.some(t => t.name === '1H')) return 1;
        return 0; 
    }

    getFreeHands() {
        let handsUsed = this.inHand.reduce((acc, item) => acc + this.getHandsRequired(item), 0);
        if (this.character.armor.shield) {
            handsUsed += 1;
        }
        return Math.max(0, 2 - handsUsed);
    }

    canUseItem(item, handsToUse) {
        const required = this.getHandsRequired(item);
        if (handsToUse >= required) return true;
        if (handsToUse === 1 && required === 2) return true; // Allows 2H with 1 hand penalty
        return false;
    }

    /**
     * Switches an item from stowed to in-hand, or vice-versa.
     * @param {string} itemName The name of the item to switch.
     */
    switchItem(itemName) {
        const itemInHand = this.inHand.find(i => i.name === itemName);
        const itemStowed = this.stowed.find(i => i.name === itemName);

        if (itemInHand) {
            // Move from in-hand to stowed
            this.inHand = this.inHand.filter(i => i.name !== itemName);
            this.stowed.push(itemInHand);
            return `${itemName} stowed.`;
        } else if (itemStowed) {
            // Move from stowed to in-hand
            const handsRequired = this.getHandsRequired(itemStowed);
            if (this.getFreeHands() >= handsRequired) {
                this.stowed = this.stowed.filter(i => i.name !== itemName);
                this.inHand.push(itemStowed);
                return `${itemName} is now in hand.`;
            } else {
                return `Not enough free hands to switch to ${itemName}.`;
            } 
        } else {
            return `Item ${itemName} not found.`;
        }
    }
}
