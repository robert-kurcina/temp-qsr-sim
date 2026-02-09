
import { Profile } from './Profile';
import { Trait } from './Trait';
import { FinalAttributes, ArmorState } from './types';

export class Character {
  id: string;
  name: string;
  profile: Profile;
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

  constructor(id: string, name: string, profile: Profile) {
    this.id = id;
    this.name = name;
    this.profile = profile;
    this.finalAttributes = {};
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
