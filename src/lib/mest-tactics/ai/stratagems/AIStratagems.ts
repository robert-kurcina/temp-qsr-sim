/**
 * AI Stratagems System
 * 
 * Stratagems allow players to configure AI behavior along three orthogonal axes:
 * 
 * 1. Tactical Doctrine (HOW to fight)
 *    - Melee-Centric: Prefers close combat, closes distance aggressively
 *    - Ranged-Centric: Prefers ranged attacks, maintains distance
 *    - Combined Arms: Balanced approach, adapts to situation
 * 
 * 2. Strategic Priority (WHAT to prioritize)
 *    - Mission Focus: Prioritizes mission objectives (Keys to Victory)
 *    - Annihilation: Prioritizes eliminating enemy models
 *    - Balanced: Mix of objectives and elimination
 * 
 * 3. Aggression Level (HOW HARD to push)
 *    - Defensive: Cautious, waits for opportunities, values survival
 *    - Balanced: Moderate risk-taking
 *    - Aggressive: High risk-taking, pushes advantages, sacrifices safety
 * 
 * This creates 27 possible combinations (3×3×3) while keeping selection simple.
 */

// ============================================================================
// Stratagem Types
// ============================================================================

/**
 * Tactical Doctrine — Complete stratagem combinations
 * 
 * 27 unique combinations (3×3×3) with flavorful names.
 * Each doctrine encapsulates Engagement, Planning, and Aggression choices.
 */
export enum TacticalDoctrine {
  // Melee-Centric combinations (9)
  Juggernaut = 'juggernaut',        // Melee + Aggression + Aggressive
  Berserker = 'berserker',          // Melee + Aggression + Balanced
  Raider = 'raider',                // Melee + Aggression + Defensive
  Crusader = 'crusader',            // Melee + Keys to Victory + Aggressive
  Warrior = 'warrior',              // Melee + Keys to Victory + Balanced
  Guardian = 'guardian',            // Melee + Keys to Victory + Defensive
  Duelist = 'duelist',              // Melee + Balanced + Aggressive
  Veteran = 'veteran_melee',        // Melee + Balanced + Balanced
  Defender = 'defender',            // Melee + Balanced + Defensive
  
  // Ranged-Centric combinations (9)
  Bombard = 'bombard',              // Ranged + Aggression + Aggressive
  Hunter = 'hunter',                // Ranged + Aggression + Balanced
  Sniper = 'sniper',                // Ranged + Aggression + Defensive
  Archer = 'archer',                // Ranged + Keys to Victory + Aggressive
  Gunner = 'gunner',                // Ranged + Keys to Victory + Balanced
  Sentinel = 'sentinel',            // Ranged + Keys to Victory + Defensive
  Sharpshooter = 'sharpshooter',    // Ranged + Balanced + Aggressive
  Marksman = 'marksman',            // Ranged + Balanced + Balanced
  Watchman = 'watchman',            // Ranged + Balanced + Defensive
  
  // Balanced combinations (9)
  Assault = 'assault',              // Balanced + Aggression + Aggressive
  Soldier = 'soldier',              // Balanced + Aggression + Balanced
  Scout = 'scout',                  // Balanced + Aggression + Defensive
  Tactician = 'tactician',          // Balanced + Keys to Victory + Aggressive
  Commander = 'commander',          // Balanced + Keys to Victory + Balanced
  Strategist = 'strategist',        // Balanced + Keys to Victory + Defensive
  Skirmisher = 'skirmisher',        // Balanced + Balanced + Aggressive
  Operative = 'operative',          // Balanced + Balanced + Balanced
  Warden = 'warden',                // Balanced + Balanced + Defensive
}

// ============================================================================
// Stratagem Configuration
// ============================================================================

/**
 * Internal stratagem components (derived from TacticalDoctrine)
 */
export enum EngagementStyle {
  Melee = 'melee',
  Ranged = 'ranged',
  Balanced = 'balanced',
}

export enum PlanningPriority {
  Aggression = 'aggression',
  KeysToVictory = 'keys_to_victory',
  Balanced = 'balanced',
}

export enum AggressionLevel {
  Aggressive = 'aggressive',
  Balanced = 'balanced',
  Defensive = 'defensive',
}

/**
 * Decompose TacticalDoctrine into components
 */
export function getDoctrineComponents(doctrine: TacticalDoctrine): {
  engagement: EngagementStyle;
  planning: PlanningPriority;
  aggression: AggressionLevel;
} {
  const meleeDoctrines: TacticalDoctrine[] = [
    TacticalDoctrine.Juggernaut, TacticalDoctrine.Berserker, TacticalDoctrine.Raider,
    TacticalDoctrine.Crusader, TacticalDoctrine.Warrior, TacticalDoctrine.Guardian,
    TacticalDoctrine.Duelist, TacticalDoctrine.Veteran, TacticalDoctrine.Defender,
  ];
  
  const rangedDoctrines: TacticalDoctrine[] = [
    TacticalDoctrine.Bombard, TacticalDoctrine.Hunter, TacticalDoctrine.Sniper,
    TacticalDoctrine.Archer, TacticalDoctrine.Gunner, TacticalDoctrine.Sentinel,
    TacticalDoctrine.Sharpshooter, TacticalDoctrine.Marksman, TacticalDoctrine.Watchman,
  ];
  
  const aggressionDoctrines: TacticalDoctrine[] = [
    TacticalDoctrine.Juggernaut, TacticalDoctrine.Berserker, TacticalDoctrine.Raider,
    TacticalDoctrine.Bombard, TacticalDoctrine.Hunter, TacticalDoctrine.Sniper,
    TacticalDoctrine.Assault, TacticalDoctrine.Soldier, TacticalDoctrine.Scout,
  ];
  
  const keysDoctrines: TacticalDoctrine[] = [
    TacticalDoctrine.Crusader, TacticalDoctrine.Warrior, TacticalDoctrine.Guardian,
    TacticalDoctrine.Archer, TacticalDoctrine.Gunner, TacticalDoctrine.Sentinel,
    TacticalDoctrine.Tactician, TacticalDoctrine.Commander, TacticalDoctrine.Strategist,
  ];
  
  const aggressiveDoctrines: TacticalDoctrine[] = [
    TacticalDoctrine.Juggernaut, TacticalDoctrine.Crusader, TacticalDoctrine.Duelist,
    TacticalDoctrine.Bombard, TacticalDoctrine.Archer, TacticalDoctrine.Sharpshooter,
    TacticalDoctrine.Assault, TacticalDoctrine.Tactician, TacticalDoctrine.Skirmisher,
  ];
  
  const defensiveDoctrines: TacticalDoctrine[] = [
    TacticalDoctrine.Raider, TacticalDoctrine.Guardian, TacticalDoctrine.Defender,
    TacticalDoctrine.Sniper, TacticalDoctrine.Sentinel, TacticalDoctrine.Watchman,
    TacticalDoctrine.Scout, TacticalDoctrine.Strategist, TacticalDoctrine.Warden,
  ];
  
  return {
    engagement: meleeDoctrines.includes(doctrine)
      ? EngagementStyle.Melee
      : rangedDoctrines.includes(doctrine)
        ? EngagementStyle.Ranged
        : EngagementStyle.Balanced,
    planning: keysDoctrines.includes(doctrine)
      ? PlanningPriority.KeysToVictory
      : aggressionDoctrines.includes(doctrine)
        ? PlanningPriority.Aggressive
        : PlanningPriority.Balanced,
    aggression: aggressiveDoctrines.includes(doctrine)
      ? AggressionLevel.Aggressive
      : defensiveDoctrines.includes(doctrine)
        ? AggressionLevel.Defensive
        : AggressionLevel.Balanced,
  };
}

/**
 * Complete AI Stratagem configuration
 */
export interface AIStratagems {
  /** Tactical Doctrine (encapsulates Engagement, Planning, Aggression) */
  tacticalDoctrine: TacticalDoctrine;
}

/**
 * Default Tactical Doctrine (Operative - balanced across all axes)
 */
export const DEFAULT_TACTICAL_DOCTRINE = TacticalDoctrine.Operative;

// ============================================================================
// Stratagem Modifiers
// ============================================================================

/**
 * AI behavior modifiers derived from stratagems
 */
export interface StratagemModifiers {
  // Combat preferences
  meleePreference: number;      // >1 favors melee, <1 favors ranged
  rangePreference: number;       // >1 favors ranged, <1 favors melee
  optimalRangeMod: number;       // Modifier to optimal engagement range
  
  // Target priority
  objectiveValue: number;        // Value of mission objectives
  eliminationValue: number;      // Value of enemy eliminations
  
  // Risk tolerance
  riskTolerance: number;         // >1 takes more risks, <1 is cautious
  survivalValue: number;         // Value of own survival
  pushAdvantage: boolean;        // Whether to push advantages aggressively
  
  // Action scoring
  chargeBonus: number;           // Bonus to charge actions
  retreatThreshold: number;      // Health threshold for retreat
  concentratePreference: number; // Preference for Concentrate action
}

export interface LoadoutProfile {
  hasMeleeWeapons: boolean;
  hasRangedWeapons: boolean;
}

export interface DoctrineAIPressure {
  aggression: number;
  caution: number;
}

/**
 * Calculate stratagem modifiers from Tactical Doctrine
 */
export function calculateStratagemModifiers(doctrine: TacticalDoctrine): StratagemModifiers {
  const components = getDoctrineComponents(doctrine);
  const modifiers: StratagemModifiers = {
    meleePreference: 1.0,
    rangePreference: 1.0,
    optimalRangeMod: 1.0,
    objectiveValue: 1.0,
    eliminationValue: 1.0,
    riskTolerance: 1.0,
    survivalValue: 1.0,
    pushAdvantage: false,
    chargeBonus: 0,
    retreatThreshold: 0.5,
    concentratePreference: 1.0,
  };

  // Apply Engagement modifiers
  switch (components.engagement) {
    case EngagementStyle.Melee:
      modifiers.meleePreference = 1.5;
      modifiers.rangePreference = 0.7;
      modifiers.optimalRangeMod = 0.7;
      modifiers.chargeBonus = 2;
      break;
    case EngagementStyle.Ranged:
      modifiers.meleePreference = 0.7;
      modifiers.rangePreference = 1.5;
      modifiers.optimalRangeMod = 1.3;
      modifiers.concentratePreference = 1.3;
      break;
    case EngagementStyle.Balanced:
    default:
      // Balanced - no modifiers
      break;
  }

  // Apply Planning modifiers
  switch (components.planning) {
    case PlanningPriority.KeysToVictory:
      modifiers.objectiveValue = 1.5;
      modifiers.eliminationValue = 0.8;
      break;
    case PlanningPriority.Aggressive:
      modifiers.objectiveValue = 0.7;
      modifiers.eliminationValue = 1.5;
      modifiers.pushAdvantage = true;
      break;
    case PlanningPriority.Balanced:
    default:
      // Balanced - no modifiers
      break;
  }

  // Apply Aggression modifiers
  switch (components.aggression) {
    case AggressionLevel.Defensive:
      modifiers.riskTolerance = 0.7;
      modifiers.survivalValue = 1.5;
      modifiers.retreatThreshold = 0.7; // Retreat at 70% wounds
      modifiers.chargeBonus -= 1;
      break;
    case AggressionLevel.Aggressive:
      modifiers.riskTolerance = 1.5;
      modifiers.survivalValue = 0.7;
      modifiers.retreatThreshold = 0.3; // Retreat at 30% wounds (almost never)
      modifiers.chargeBonus += 2;
      modifiers.pushAdvantage = true;
      break;
    case AggressionLevel.Balanced:
    default:
      // Balanced - no modifiers
      break;
  }

  return modifiers;
}

function clampUnit(value: number): number {
  return Math.max(0.1, Math.min(0.9, value));
}

/**
 * Convert doctrine + model loadout into AI pressure controls.
 *
 * This keeps doctrine as the source of truth while letting each model adapt
 * to what it can actually do in the current battle.
 */
export function deriveDoctrineAIPressure(
  doctrine: TacticalDoctrine,
  loadout: LoadoutProfile
): DoctrineAIPressure {
  const components = getDoctrineComponents(doctrine);
  const modifiers = calculateStratagemModifiers(doctrine);

  let aggression = 0.5 + (modifiers.riskTolerance - 1) * 0.35;
  let caution = 0.5 + (modifiers.survivalValue - 1) * 0.35;

  if (components.engagement === EngagementStyle.Melee) {
    aggression += 0.08;
    caution -= 0.04;
  } else if (components.engagement === EngagementStyle.Ranged) {
    aggression -= 0.04;
    caution += 0.08;
  }

  if (components.planning === PlanningPriority.Aggressive) {
    aggression += 0.08;
    caution -= 0.05;
  } else if (components.planning === PlanningPriority.KeysToVictory) {
    aggression -= 0.03;
    caution += 0.05;
  }

  if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) {
    aggression += 0.14;
    caution -= 0.06;
  } else if (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons) {
    aggression -= 0.06;
    caution += 0.14;
  } else if (loadout.hasMeleeWeapons && loadout.hasRangedWeapons) {
    aggression += 0.03;
    caution += 0.03;
  } else {
    aggression -= 0.12;
    caution += 0.16;
  }

  return {
    aggression: clampUnit(aggression),
    caution: clampUnit(caution),
  };
}

// ============================================================================
// Stratagem Presets
// ============================================================================

/**
 * Tactical Doctrine descriptions for UI display
 */
export const TACTICAL_DOCTRINE_INFO: Record<TacticalDoctrine, {
  name: string;
  description: string;
  icon: string;
}> = {
  // Melee-Centric
  [TacticalDoctrine.Juggernaut]: {
    name: 'Juggernaut',
    description: 'Relentless melee assault. Overwhelm enemies with close combat.',
    icon: '⚔️',
  },
  [TacticalDoctrine.Berserker]: {
    name: 'Berserker',
    description: 'Pure melee destruction. Fearless close combat specialist.',
    icon: '🪓',
  },
  [TacticalDoctrine.Raider]: {
    name: 'Raider',
    description: 'Fast melee strikes. Hit hard and withdraw.',
    icon: '🏃',
  },
  [TacticalDoctrine.Crusader]: {
    name: 'Crusader',
    description: 'Objective-focused melee. Victory through close combat.',
    icon: '🛡️',
  },
  [TacticalDoctrine.Warrior]: {
    name: 'Warrior',
    description: 'Honored melee fighter. Balanced close combat approach.',
    icon: '🗡️',
  },
  [TacticalDoctrine.Guardian]: {
    name: 'Guardian',
    description: 'Defensive melee protector. Hold the line.',
    icon: '🛡️',
  },
  [TacticalDoctrine.Duelist]: {
    name: 'Duelist',
    description: 'Elite melee combatant. Seek single combat.',
    icon: '🤺',
  },
  [TacticalDoctrine.Veteran]: {
    name: 'Veteran',
    description: 'Experienced melee fighter. Steady and reliable.',
    icon: '🎖️',
  },
  [TacticalDoctrine.Defender]: {
    name: 'Defender',
    description: 'Defensive melee specialist. Protect and counter.',
    icon: '🏰',
  },
  
  // Ranged-Centric
  [TacticalDoctrine.Bombard]: {
    name: 'Bombard',
    description: 'Overwhelming firepower. Destroy from distance.',
    icon: '💥',
  },
  [TacticalDoctrine.Hunter]: {
    name: 'Hunter',
    description: 'Mobile ranged hunter. Track and eliminate.',
    icon: '🏹',
  },
  [TacticalDoctrine.Sniper]: {
    name: 'Sniper',
    description: 'Precision from distance. One shot, one kill.',
    icon: '🎯',
  },
  [TacticalDoctrine.Archer]: {
    name: 'Archer',
    description: 'Safe ranged support. Victory through archery.',
    icon: '🏹',
  },
  [TacticalDoctrine.Gunner]: {
    name: 'Gunner',
    description: 'Consistent ranged fire. Suppress and destroy.',
    icon: '🔫',
  },
  [TacticalDoctrine.Sentinel]: {
    name: 'Sentinel',
    description: 'Area denial from range. Hold key positions.',
    icon: '👁️',
  },
  [TacticalDoctrine.Sharpshooter]: {
    name: 'Sharpshooter',
    description: 'Elite marksman. Aggressive precision fire.',
    icon: '🎯',
  },
  [TacticalDoctrine.Marksman]: {
    name: 'Marksman',
    description: 'Skilled ranged fighter. Balanced approach.',
    icon: '🎖️',
  },
  [TacticalDoctrine.Watchman]: {
    name: 'Watchman',
    description: 'Cautious ranged observer. Defensive positioning.',
    icon: '👀',
  },
  
  // Balanced
  [TacticalDoctrine.Assault]: {
    name: 'Assault',
    description: 'Aggressive combined arms. All-out attack.',
    icon: '💂',
  },
  [TacticalDoctrine.Soldier]: {
    name: 'Soldier',
    description: 'Standard infantry tactics. Reliable and steady.',
    icon: '🪖',
  },
  [TacticalDoctrine.Scout]: {
    name: 'Scout',
    description: 'Cautious reconnaissance. Gather and report.',
    icon: '🔭',
  },
  [TacticalDoctrine.Tactician]: {
    name: 'Tactician',
    description: 'Strategic objective play. Win through planning.',
    icon: '📋',
  },
  [TacticalDoctrine.Commander]: {
    name: 'Commander',
    description: 'Leadership and strategy. Balanced command.',
    icon: '⭐',
  },
  [TacticalDoctrine.Strategist]: {
    name: 'Strategist',
    description: 'Defensive strategic play. Outthink opponents.',
    icon: '🧠',
  },
  [TacticalDoctrine.Skirmisher]: {
    name: 'Skirmisher',
    description: 'Flexible skirmisher. Adapt and overcome.',
    icon: '🏃',
  },
  [TacticalDoctrine.Operative]: {
    name: 'Operative',
    description: 'Versatile operative. Handle any situation.',
    icon: '🕵️',
  },
  [TacticalDoctrine.Warden]: {
    name: 'Warden',
    description: 'Cautious guardian. Defensive and balanced.',
    icon: '🏛️',
  },
};

/**
 * Get all doctrines grouped by engagement style
 */
export function getDoctrinesByEngagement(): Record<string, TacticalDoctrine[]> {
  return {
    Melee: [
      TacticalDoctrine.Juggernaut, TacticalDoctrine.Berserker, TacticalDoctrine.Raider,
      TacticalDoctrine.Crusader, TacticalDoctrine.Warrior, TacticalDoctrine.Guardian,
      TacticalDoctrine.Duelist, TacticalDoctrine.Veteran, TacticalDoctrine.Defender,
    ],
    Ranged: [
      TacticalDoctrine.Bombard, TacticalDoctrine.Hunter, TacticalDoctrine.Sniper,
      TacticalDoctrine.Archer, TacticalDoctrine.Gunner, TacticalDoctrine.Sentinel,
      TacticalDoctrine.Sharpshooter, TacticalDoctrine.Marksman, TacticalDoctrine.Watchman,
    ],
    Balanced: [
      TacticalDoctrine.Assault, TacticalDoctrine.Soldier, TacticalDoctrine.Scout,
      TacticalDoctrine.Tactician, TacticalDoctrine.Commander, TacticalDoctrine.Strategist,
      TacticalDoctrine.Skirmisher, TacticalDoctrine.Operative, TacticalDoctrine.Warden,
    ],
  };
}

// ============================================================================
// Stratagem Validation
// ============================================================================

/**
 * Validate Tactical Doctrine configuration
 */
export function validateStratagems(stratagems: AIStratagems): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const components = getDoctrineComponents(stratagems.tacticalDoctrine);

  // Check for potentially ineffective combinations
  if (
    components.engagement === EngagementStyle.Melee &&
    components.aggression === AggressionLevel.Defensive
  ) {
    warnings.push('Melee-Centric with Defensive aggression may be ineffective');
  }

  if (
    components.engagement === EngagementStyle.Ranged &&
    components.planning === PlanningPriority.Aggressive &&
    components.aggression === AggressionLevel.Aggressive
  ) {
    warnings.push('Aggressive Ranged Annihilation may overextend');
  }

  if (
    components.planning === PlanningPriority.KeysToVictory &&
    components.aggression === AggressionLevel.Aggressive
  ) {
    warnings.push('Aggressive Mission Focus may take unnecessary risks');
  }

  return {
    valid: true, // All combinations are technically valid
    warnings,
  };
}

// ============================================================================
// Stratagem Display Names
// ============================================================================

/**
 * Get human-readable name for stratagem value
 */
export function getStratagemDisplayName(
  type: 'tactical' | 'strategic' | 'aggression',
  value: string
): string {
  const names: Record<string, string> = {
    // Tactical Doctrine
    melee_centric: 'Melee-Centric',
    ranged_centric: 'Ranged-Centric',
    combined_arms: 'Combined Arms',
    // Strategic Priority
    mission_focus: 'Mission Focus',
    annihilation: 'Annihilation',
    balanced: 'Balanced',
    // Aggression Level
    defensive: 'Defensive',
    aggressive: 'Aggressive',
  };

  return names[value] || value;
}

/**
 * Get stratagem description
 */
export function getStratagemDescription(
  type: 'tactical' | 'strategic' | 'aggression',
  value: string
): string {
  const descriptions: Record<string, string> = {
    // Tactical Doctrine
    melee_centric: 'Prefers close combat. Closes distance aggressively to engage in melee.',
    ranged_centric: 'Prefers ranged attacks. Maintains optimal distance from enemies.',
    combined_arms: 'Balanced approach. Adapts combat style to the situation.',
    // Strategic Priority
    mission_focus: 'Prioritizes mission objectives over enemy eliminations.',
    annihilation: 'Prioritizes eliminating enemy models above all else.',
    balanced: 'Balances mission objectives with enemy elimination.',
    // Aggression Level
    defensive: 'Cautious and defensive. Values survival and waits for opportunities.',
    balanced: 'Moderate risk-taking. Balanced approach to aggression.',
    aggressive: 'High risk-taking. Pushes advantages and sacrifices safety for victory.',
  };

  return descriptions[value] || '';
}
