/**
 * BP Budget Enforcement System (QSR)
 * 
 * Validates assemblies against game size constraints:
 * - BP limits (min/max)
 * - Character count limits (min/max)
 * - Game size specific constraints
 */

import { Assembly } from '../core/Assembly';
import { Profile } from '../core/Profile';
import { GameSize, AssemblyConfig, gameSizeDefaults } from './assembly-builder';

export interface BPValidationResult {
  /** Whether the assembly passes all validation */
  passed: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
  /** Current BP total */
  currentBP: number;
  /** Current character count */
  currentCharacters: number;
  /** BP limit range */
  bpLimitMin: number;
  bpLimitMax: number;
  /** Character limit range */
  characterLimitMin: number;
  characterLimitMax: number;
  /** Game size */
  gameSize: GameSize | string;
}

export interface DeploymentValidationResult {
  /** Whether deployment is valid */
  passed: boolean;
  /** List of deployment errors */
  errors: string[];
  /** List of deployment warnings */
  warnings: string[];
  /** Models successfully deployed */
  deployedCount: number;
  /** Models remaining to deploy */
  remainingCount: number;
}

/**
 * Validate an assembly against BP and character limits
 */
export function validateAssemblyBP(
  assembly: Assembly,
  profiles: Profile[]
): BPValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const config = assembly.config;
  if (!config) {
    errors.push('Assembly has no configuration');
    return {
      passed: false,
      errors,
      warnings,
      currentBP: assembly.totalBP,
      currentCharacters: assembly.totalCharacters,
      bpLimitMin: 0,
      bpLimitMax: 0,
      characterLimitMin: 0,
      characterLimitMax: 0,
      gameSize: 'Unknown',
    };
  }

  const { bpLimitMin, bpLimitMax, characterLimitMin, characterLimitMax, gameSize } = config;
  const currentBP = assembly.totalBP;
  const currentCharacters = assembly.totalCharacters;

  // Validate BP limits
  if (currentBP < bpLimitMin) {
    errors.push(
      `BP too low: ${currentBP} BP (minimum: ${bpLimitMin} BP for ${gameSize})`
    );
  } else if (currentBP > bpLimitMax) {
    errors.push(
      `BP exceeded: ${currentBP} BP (maximum: ${bpLimitMax} BP for ${gameSize})`
    );
  } else {
    // Warn if close to limits
    const bpUsagePercent = (currentBP / bpLimitMax) * 100;
    if (bpUsagePercent < 80) {
      warnings.push(
        `BP underutilized: ${currentBP} BP / ${bpLimitMax} BP (${bpUsagePercent.toFixed(1)}%)`
      );
    }
  }

  // Validate character count
  if (currentCharacters < characterLimitMin) {
    errors.push(
      `Too few models: ${currentCharacters} (minimum: ${characterLimitMin} for ${gameSize})`
    );
  } else if (currentCharacters > characterLimitMax) {
    errors.push(
      `Too many models: ${currentCharacters} (maximum: ${characterLimitMax} for ${gameSize})`
    );
  }

  // Validate individual profile BP (check for expensive characters)
  const expensiveThreshold = Math.floor(bpLimitMax / 2);
  for (const profile of profiles) {
    const profileBP = profile.adjustedBp ?? profile.totalBp ?? 0;
    if (profileBP > expensiveThreshold) {
      warnings.push(
        `Expensive character: ${profile.name} (${profileBP} BP) - more than half budget`
      );
    }
  }

  // Validate game size consistency
  const expectedDefaults = gameSizeDefaults[gameSize as GameSize];
  if (expectedDefaults) {
    if (bpLimitMin !== expectedDefaults.bpLimitMin) {
      warnings.push(
        `Custom BP minimum: ${bpLimitMin} (default: ${expectedDefaults.bpLimitMin} for ${gameSize})`
      );
    }
    if (bpLimitMax !== expectedDefaults.bpLimitMax) {
      warnings.push(
        `Custom BP maximum: ${bpLimitMax} (default: ${expectedDefaults.bpLimitMax} for ${gameSize})`
      );
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    currentBP,
    currentCharacters,
    bpLimitMin,
    bpLimitMax,
    characterLimitMin,
    characterLimitMax,
    gameSize,
  };
}

/**
 * Validate multiple assemblies for a mission (all sides)
 */
export function validateMissionAssemblies(
  assemblies: Assembly[],
  allProfiles: Profile[]
): {
  passed: boolean;
  sideResults: Map<string, BPValidationResult>;
  summary: {
    totalBP: number;
    totalCharacters: number;
    averageBP: number;
    balanced: boolean;
  };
} {
  const sideResults = new Map<string, BPValidationResult>();
  let totalBP = 0;
  let totalCharacters = 0;
  let allPassed = true;

  for (const assembly of assemblies) {
    const profiles = allProfiles.filter(p => 
      assembly.characters.includes(p.name)
    );
    const result = validateAssemblyBP(assembly, profiles);
    sideResults.set(assembly.name, result);
    
    if (!result.passed) {
      allPassed = false;
    }
    
    totalBP += assembly.totalBP;
    totalCharacters += assembly.totalCharacters;
  }

  const averageBP = assemblies.length > 0 ? totalBP / assemblies.length : 0;
  
  // Check if sides are balanced (within 10% of each other)
  const bpValues = assemblies.map(a => a.totalBP);
  const minBP = Math.min(...bpValues);
  const maxBP = Math.max(...bpValues);
  const balanced = assemblies.length <= 1 || 
    ((maxBP - minBP) / maxBP) <= 0.1;

  if (!balanced && assemblies.length > 1) {
    // Add warning to highest BP side
    const highestBPAssembly = assemblies.find(a => a.totalBP === maxBP);
    if (highestBPAssembly) {
      const result = sideResults.get(highestBPAssembly.name);
      if (result) {
        result.warnings.push(
          `Unbalanced: ${maxBP} BP vs ${minBP} BP opponent (${((maxBP - minBP) / maxBP * 100).toFixed(1)}% difference)`
        );
      }
    }
  }

  return {
    passed: allPassed,
    sideResults,
    summary: {
      totalBP,
      totalCharacters,
      averageBP,
      balanced,
    },
  };
}

/**
 * Create a validator for assembly building
 */
export function createAssemblyValidator(config: AssemblyConfig) {
  const resolvedConfig = {
    bpLimitMin: config.bpLimitMin ?? 250,
    bpLimitMax: config.bpLimitMax ?? 500,
    characterLimitMin: config.characterLimitMin ?? 4,
    characterLimitMax: config.characterLimitMax ?? 8,
    gameSize: config.gameSize ?? GameSize.SMALL,
  };

  return {
    config: resolvedConfig,
    
    /**
     * Check if adding a profile would exceed limits
     */
    canAddProfile(profile: Profile, currentBP: number, currentCount: number): {
      canAdd: boolean;
      reason?: string;
    } {
      const profileBP = profile.adjustedBp ?? profile.totalBp ?? 0;
      const newBP = currentBP + profileBP;
      const newCount = currentCount + 1;

      if (newBP > resolvedConfig.bpLimitMax) {
        return {
          canAdd: false,
          reason: `Would exceed BP limit (${newBP} > ${resolvedConfig.bpLimitMax})`,
        };
      }

      if (newCount > resolvedConfig.characterLimitMax) {
        return {
          canAdd: false,
          reason: `Would exceed character limit (${newCount} > ${resolvedConfig.characterLimitMax})`,
        };
      }

      return { canAdd: true };
    },

    /**
     * Get remaining BP budget
     */
    getRemainingBP(currentBP: number): number {
      return Math.max(0, resolvedConfig.bpLimitMax - currentBP);
    },

    /**
     * Get remaining character slots
     */
    getRemainingSlots(currentCount: number): number {
      return Math.max(0, resolvedConfig.characterLimitMax - currentCount);
    },

    /**
     * Check if assembly is complete (meets minimums)
     */
    isComplete(currentBP: number, currentCount: number): {
      complete: boolean;
      missing?: string;
    } {
      if (currentBP < resolvedConfig.bpLimitMin) {
        return {
          complete: false,
          missing: `Need ${resolvedConfig.bpLimitMin - currentBP} more BP`,
        };
      }

      if (currentCount < resolvedConfig.characterLimitMin) {
        return {
          complete: false,
          missing: `Need ${resolvedConfig.characterLimitMin - currentCount} more characters`,
        };
      }

      return { complete: true };
    },
  };
}

/**
 * Get game size recommendations based on BP and character count
 */
export function recommendGameSize(bp: number, characters: number): {
  recommended: GameSize;
  reason: string;
  alternatives: Array<{ size: GameSize; reason: string }>;
} {
  const alternatives: Array<{ size: GameSize; reason: string }> = [];
  
  // Find best matching game size
  let recommended: GameSize = GameSize.SMALL;
  let bestMatch = Infinity;

  for (const [size, defaults] of Object.entries(gameSizeDefaults)) {
    const bpMid = (defaults.bpLimitMin + defaults.bpLimitMax) / 2;
    const charMid = (defaults.characterLimitMin + defaults.characterLimitMax) / 2;
    
    // Calculate distance from midpoint
    const bpDistance = Math.abs(bp - bpMid) / bpMid;
    const charDistance = Math.abs(characters - charMid) / charMid;
    const totalDistance = bpDistance + charDistance;

    const gameSize = size as GameSize;
    
    if (totalDistance < bestMatch) {
      bestMatch = totalDistance;
      recommended = gameSize;
    }

    // Check if this size would work
    if (bp >= defaults.bpLimitMin && bp <= defaults.bpLimitMax &&
        characters >= defaults.characterLimitMin && characters <= defaults.characterLimitMax) {
      alternatives.push({
        size: gameSize,
        reason: `${bp} BP and ${characters} models fit within limits`,
      });
    }
  }

  const recDefaults = gameSizeDefaults[recommended];
  
  return {
    recommended,
    reason: `${bp} BP and ${characters} models best matches ${recommended} (${recDefaults.bpLimitMin}-${recDefaults.bpLimitMax} BP, ${recDefaults.characterLimitMin}-${recDefaults.characterLimitMax} models)`,
    alternatives,
  };
}
