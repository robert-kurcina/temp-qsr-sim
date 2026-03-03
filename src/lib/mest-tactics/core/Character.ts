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
  initiative: number;

  state: {
    wounds: number;
    delayTokens: number;
    fearTokens: number;
    isHidden: boolean;
    isWaiting: boolean;
    isDisordered: boolean;
    isDistracted: boolean;
    isNervous: boolean;
    isPanicked: boolean;
    isStunned: boolean;
    isHindered: boolean;
    isWounded: boolean;
    isEngaged: boolean;
    isInCover: boolean;
    isAttentive: boolean;
    isOrdered: boolean;
    isKOd: boolean;
    isEliminated: boolean;
    eliminatedByFear: boolean; // QSR: Track if eliminated by Fear tokens (vs combat)
    isOverreach: boolean; // QSR: -1 REF penalty when Overreach declared
    hasDetectedThisActivation: boolean; // QSR Line 855: First Detect is free
    hasFocus: boolean; // QSR Line 859: Focus bonus (+1w for next Test)
    statusEffects: string[];
    statusTokens: Record<string, number>;
    statusPendingTokens: Record<string, number>;
    armor: ArmorState;
    loadedWeapons: number[]; // Weapon indices that are loaded (for Reload trait)
    reloadProgress: number; // Progress toward reloading (for Reload trait)
    gritWoundIgnored: boolean;
    gritFearReducedThisTurn: boolean;
    activeWeaponIndex?: number; // Weapon index currently declared for this Initiative
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
    this.initiative = 0;

    this.state = {
      wounds: 0,
      delayTokens: 0,
      fearTokens: 0,
      isHidden: false,
      isWaiting: false,
      isDisordered: false,
      isDistracted: false,
      isNervous: false,
      isPanicked: false,
      isStunned: false,
      isHindered: false,
      isWounded: false,
      isEngaged: false,
      isInCover: false,
      isAttentive: true,
      isOrdered: true,
      isKOd: false,
      isEliminated: false,
      eliminatedByFear: false, // QSR: Track if eliminated by Fear tokens
      isOverreach: false, // QSR: -1 REF penalty when Overreach declared
      hasDetectedThisActivation: false, // QSR Line 855: First Detect is free
      hasFocus: false, // QSR Line 859: Focus bonus (+1w for next Test)
      hasPushedThisInitiative: false,
      statusEffects: [],
      statusTokens: {},
      statusPendingTokens: {},
      armor: {
        total: profile.totalAR || 0,
        suit: 0,
        gear: 0,
        shield: 0,
        helm: 0
      },
      loadedWeapons: [],
      reloadProgress: 0,
      initiativePoints: 0,
      gritWoundIgnored: false,
      gritFearReducedThisTurn: false,
      activeWeaponIndex: undefined,
    };
    // Initialize loaded weapons for items that have Reload trait
    const equipment = this.profile?.equipment ?? this.profile?.items ?? [];
    for (let i = 0; i < equipment.length; i++) {
      const weapon = equipment[i];
      if (weapon?.traits?.some(trait => trait.toLowerCase().includes('reload'))) {
        this.state.loadedWeapons.push(i);
      }
    }
    this.refreshStatusFlags();
  }

  refreshStatusFlags(): void {
    const koOrElim = this.state.isKOd || this.state.isEliminated;
    this.state.isDistracted = this.state.delayTokens > 0;
    this.state.isDisordered = this.state.fearTokens >= 2;
    this.state.isNervous = this.state.fearTokens >= 1;
    this.state.isPanicked = this.state.fearTokens >= 3;
    this.state.isStunned = this.state.delayTokens >= 2;
    this.state.isWounded = this.state.wounds > 0;
    this.state.isHindered = this.state.delayTokens > 0 || this.state.fearTokens > 0 || this.state.wounds > 0;
    
    // QSR: 4+ Fear tokens = Eliminated (auto-elimination from panic)
    if (this.state.fearTokens >= 4 && !this.state.isEliminated) {
      this.state.isEliminated = true;
      this.state.isAttentive = false;
      this.state.isOrdered = false;
    }
    
    this.state.isAttentive = !koOrElim && !this.state.isDistracted && !this.state.isEliminated;
    this.state.isOrdered = !koOrElim && !this.state.isDisordered && !this.state.isEliminated;
    this.applyLadenEffects();
  }

  /**
   * Reset per-Initiative state
   */
  resetInitiativeState(): void {
    this.state.hasPushedThisInitiative = false;
    this.state.gritFearReducedThisTurn = false;
    this.state.activeWeaponIndex = undefined;
    this.state.hasDetectedThisActivation = false; // QSR Line 855: Reset for new activation
    this.state.hasFocus = false; // QSR Line 859: Reset Focus bonus
  }

  private applyLadenEffects(): void {
    const base = this.attributes;
    const burden = this.profile?.burden?.totalBurden ?? 0;
    const final: FinalAttributes = { ...base };
    if (burden > 0) {
      final.mov = Math.max(0, (base.mov ?? 0) - burden);
      if (!(this.state.isAttentive && this.state.isOrdered)) {
        final.ref = Math.max(0, (base.ref ?? 0) - burden);
        final.cca = Math.max(0, (base.cca ?? 0) - burden);
      }
    }
    this.finalAttributes = final;
  }

  get wounds(): number {
    return this.state.wounds;
  }

  set wounds(value: number) {
    this.state.wounds = value;
  }
}
