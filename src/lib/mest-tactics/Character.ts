import { Profile } from './Profile';
import { Trait } from './Trait';
import { ArmorState } from './types';
import { Attributes, FinalAttributes } from './Attributes';

export class Character {
  id: string;
  name: string;
  profile: Profile;
  attributes: Attributes;
  finalAttributes: FinalAttributes;
  allTraits: Trait[];

  state: {
    wounds: number;
    delayTokens: number;
    fearTokens: number;
    isHidden: boolean;
    isWaiting: boolean;
    isDisordered: boolean;
    isDistracted: boolean;
    isEngaged: boolean;
    isInCover: boolean;
    isKOd: boolean;
    isEliminated: boolean;
    statusEffects: string[];
    armor: ArmorState;
  };

  constructor(profile: Profile) {
    this.id = profile.name; // For simplicity, using name as ID for now
    this.name = profile.name;
    this.profile = profile;
    
    // Extract attributes from profile or archetype
    let attributes = profile.attributes;
    if (!attributes && profile.archetype) {
      // Try to extract from archetype if it's an Archetype object
      const archType = profile.archetype as any;
      if (archType?.attributes) {
        attributes = archType.attributes;
      } else if (typeof archType === 'object' && !Array.isArray(archType)) {
        // If archetype is a keyed object, get the first archetype's attributes
        const firstKey = Object.keys(archType)[0];
        if (firstKey && archType[firstKey]?.attributes) {
          attributes = archType[firstKey].attributes;
        }
      }
    }
    
    this.attributes = attributes || ({
      cca: 0, rca: 0, ref: 0, int: 0, pow: 0,
      str: 0, for: 0, mov: 0, siz: 0
    });
    this.finalAttributes = this.attributes as FinalAttributes;
    this.allTraits = [];

    this.state = {
      wounds: 0,
      delayTokens: 0,
      fearTokens: 0,
      isHidden: false,
      isWaiting: false,
      isDisordered: false,
      isDistracted: false,
      isEngaged: false,
      isInCover: false,
      isKOd: false,
      isEliminated: false,
      statusEffects: [],
      armor: { total: 0, suit: 0, gear: 0, shield: 0, helm: 0 },
    };
  }

  get wounds(): number {
    return this.state.wounds;
  }

  set wounds(value: number) {
    this.state.wounds = value;
  }
}
