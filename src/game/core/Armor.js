import armors from '../../data/armors.json';
import { parseTrait } from '../../utils/trait-parser';

export class Armor {
  constructor(name) {
    if (!name) {
      throw new Error('Armor name must be provided.');
    }
    this.name = name;
    this._loadFromData(name);
  }

  _loadFromData(name) {
    const armorDataItem = armors.find(a => a.name === name);
    if (!armorDataItem) {
      throw new Error(`Armor with name \"${name}\" not found.`);
    }

    this.armorClass = armorDataItem.class;
    this.bp = armorDataItem.bp || 0;
    this.ar = armorDataItem.ar || 0;
    this.rawTraits = armorDataItem.traits || [];
    this.traits = this.rawTraits.map(parseTrait).filter(Boolean);
  }

  getLadenPenalty() {
    const ladenTrait = this.traits.find(t => t.name === 'Laden');
    return ladenTrait ? ladenTrait.value : 0;
  }
}
