import { Profile } from './Profile';
import { Trait } from './Trait';
import { FinalAttributes, ArmorState, Attributes } from './types';

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
    this.attributes = profile.attributes;
    this.finalAttributes = profile.attributes;
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
