      /**
 * AI Battle Configuration
 *
 * Configuration interfaces and validation for AI battle setup.
 * 
 * Game size data is sourced from src/data/game_sizes.json (canonical)
 * and src/lib/data.ts (exported as data["game_sizes"]).
 */

import { GameSize, gameSizeDefaults } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { CANONICAL_GAME_SIZES } from '../../src/lib/mest-tactics/mission/game-size-canonical';
import { getEndGameTriggerTurn } from '../../src/lib/mest-tactics/engine/end-game-trigger';
import { TacticalDoctrine } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { LightingCondition } from '../../src/lib/mest-tactics/utils/visibility';
import type { TechnologicalAge } from '../../src/lib/mest-tactics/utils/tech-level-filter';

export type AuditLevel = 'none' | 'summary' | 'full';

/**
 * Game configuration for AI battles
 */
export interface GameConfig {
  missionId: string;
  missionName: string;
  gameSize: GameSize;
  battlefieldWidth: number;
  battlefieldHeight: number;
  maxTurns: number;
  endGameTurn: number;
  sides: SideConfig[];
  densityRatio: number;
  lighting: LightingCondition;
  visibilityOrMu: number;
  maxOrm: number;
  allowConcentrateRangeExtension: boolean;
  perCharacterFovLos: boolean;
  allowWaitAction?: boolean;
  allowHideAction?: boolean;
  verbose: boolean;
  seed?: number;
  audit?: boolean;
  viewer?: boolean;
  /**
   * Controls audit capture/detail in report payloads.
   * - none: no inline audit trace
   * - summary: minimal skeleton trace (session + battlefield)
   * - full: complete turn/activation/action trace
   */
  auditLevel?: AuditLevel;
  /** Optional path to a pre-generated battlefield export JSON */
  battlefieldPath?: string;
  /**
   * If true, final VP ties are resolved by Initiative Card holder.
   * Defaults to true for QSR-aligned mission outcome resolution.
   */
  initiativeCardTieBreakerOnTie?: boolean;
  /**
   * Optional explicit Initiative Card holder side id for final tie-breaks.
   * If omitted, the most recent initiative-winning side is used when available.
   */
  initiativeCardHolderSideId?: string;
  /** @deprecated Use battlefieldWidth + battlefieldHeight */
  battlefieldSize?: number;
}

/**
 * Side configuration for AI battles
 */
export interface SideConfig {
  name: string;
  bp: number;
  modelCount: number;
  tacticalDoctrine: TacticalDoctrine;
  loadoutProfile?: 'default' | 'melee_only';
  technologicalAge?: TechnologicalAge;
  assemblyName: string;
  aggression?: number;
  caution?: number;
  // Backward compatibility property
  models?: any[];
}

/**
 * Game size configuration mapping
 * Note: battlefieldWidth is the horizontal dimension (left-to-right),
 * battlefieldHeight is the vertical dimension (top-to-bottom).
 * For rectangular battlefields, width >= height for display purposes.
 */
export interface GameSizeConfig {
  name: string;
  battlefieldWidth: number;
  battlefieldHeight: number;
  deploymentDepth: number;
  maxTurns: number;
  endGameTurn: number;
  bpPerSide: number[];
  modelsPerSide: number[];
}

const MAX_TURNS_BY_SIZE: Record<GameSize, number> = {
  [GameSize.VERY_SMALL]: 6,
  [GameSize.SMALL]: 8,
  [GameSize.MEDIUM]: 10,
  [GameSize.LARGE]: 12,
  [GameSize.VERY_LARGE]: 15,
};

const CANONICAL_GAME_SIZE_ORDER: GameSize[] = [
  GameSize.VERY_SMALL,
  GameSize.SMALL,
  GameSize.MEDIUM,
  GameSize.LARGE,
  GameSize.VERY_LARGE,
];

function roundBpMidpoint(minBp: number, maxBp: number): number {
  return Math.round(((minBp + maxBp) / 2) / 25) * 25;
}

function buildGameSizeConfig(size: GameSize): GameSizeConfig {
  const canonical = CANONICAL_GAME_SIZES[size];
  const defaults = gameSizeDefaults[size];
  const minBP = defaults.bpLimitMin;
  const maxBP = defaults.bpLimitMax;
  const minModels = defaults.characterLimitMin;
  const maxModels = defaults.characterLimitMax;

  return {
    name: canonical.name,
    battlefieldWidth: canonical.battlefieldWidthMU,
    battlefieldHeight: canonical.battlefieldHeightMU,
    deploymentDepth: canonical.deploymentDepth,
    maxTurns: MAX_TURNS_BY_SIZE[size],
    endGameTurn: getEndGameTriggerTurn(size),
    bpPerSide: [
      minBP,
      roundBpMidpoint(minBP, maxBP),
      maxBP,
    ],
    modelsPerSide: [
      minModels,
      Math.round((minModels + maxModels) / 2),
      maxModels,
    ],
  };
}

/**
 * Default game size configurations
 * Source: src/data/game_sizes.json (canonical)
 */
export const GAME_SIZE_CONFIG: Record<GameSize, GameSizeConfig> = {
  ...Object.fromEntries(CANONICAL_GAME_SIZE_ORDER.map(size => [size, buildGameSizeConfig(size)])),
} as Record<GameSize, GameSizeConfig>;

/**
 * Validate game configuration
 */
export function validateGameConfig(config: Partial<GameConfig>): string[] {
  const errors: string[] = [];
  
  if (!config.missionId) {
    errors.push('Mission ID is required');
  }
  
  if (!config.gameSize) {
    errors.push('Game size is required');
  }

  if (!Number.isFinite(config.battlefieldWidth) || (config.battlefieldWidth ?? 0) <= 0) {
    errors.push('Battlefield width must be a positive number');
  }

  if (!Number.isFinite(config.battlefieldHeight) || (config.battlefieldHeight ?? 0) <= 0) {
    errors.push('Battlefield height must be a positive number');
  }
  
  if (!config.sides || config.sides.length < 2) {
    errors.push('At least 2 sides are required');
  }
  
  if (config.densityRatio !== undefined && (config.densityRatio < 0 || config.densityRatio > 100)) {
    errors.push('Density ratio must be between 0 and 100');
  }
  
  if (config.sides) {
    config.sides.forEach((side, index) => {
      if (!side.name) {
        errors.push(`Side ${index + 1} is missing a name`);
      }
      if (!side.tacticalDoctrine) {
        errors.push(`Side ${index + 1} is missing a tactical doctrine`);
      }
    });
  }
  
  return errors;
}

/**
 * Create default game configuration
 */
export function createDefaultGameConfig(
  gameSize: GameSize = GameSize.VERY_LARGE,
  missionId: string = 'QAI_11'
): GameConfig {
  const sizeConfig = GAME_SIZE_CONFIG[gameSize];

  // Select doctrine based on mission type to ensure VP/RP incentivization
  // Reference: docs/audit/VP_SCORING_GAP_ANALYSIS.md
  const getDoctrineForMission = (missionId: string, sideIndex: number): TacticalDoctrine => {
    switch (missionId) {
      case 'QAI_11': // Elimination - aggressive pursuit of kills
        return sideIndex === 0 ? TacticalDoctrine.Aggressive : TacticalDoctrine.Balanced;
      case 'QAI_12': // Convergence - objective-focused
        return TacticalDoctrine.Objective;
      case 'QAI_13': // Assault - defender holds, attacker rushes
        return sideIndex === 0 ? TacticalDoctrine.Defensive : TacticalDoctrine.Aggressive;
      case 'QAI_14': // Dominion - beacon control
        return TacticalDoctrine.Objective;
      case 'QAI_15': // Recovery - intelligence extraction
        return TacticalDoctrine.Objective;
      case 'QAI_16': // Escort - VIP protection
        return sideIndex === 0 ? TacticalDoctrine.Defensive : TacticalDoctrine.Balanced;
      case 'QAI_17': // Triumvirate - free-for-all aggression
        return TacticalDoctrine.Aggressive;
      case 'QAI_18': // Stealth - covert ops
        return TacticalDoctrine.Shadow;
      case 'QAI_19': // Defiance - hold position
        return TacticalDoctrine.Defensive;
      case 'QAI_20': // Breach - breakthrough vs fortification
        return sideIndex === 0 ? TacticalDoctrine.Aggressive : TacticalDoctrine.Defensive;
      default:
        return TacticalDoctrine.Balanced;
    }
  };

  return {
    missionId,
    missionName: 'Elimination',
    gameSize,
    battlefieldWidth: sizeConfig.battlefieldWidth,
    battlefieldHeight: sizeConfig.battlefieldHeight,
    maxTurns: sizeConfig.maxTurns,
    endGameTurn: sizeConfig.endGameTurn,
    sides: [
      {
        name: 'Alpha',
        bp: sizeConfig.bpPerSide[1],
        modelCount: sizeConfig.modelsPerSide[1],
        tacticalDoctrine: getDoctrineForMission(missionId, 0),
        assemblyName: 'Assembly Alpha',
      },
      {
        name: 'Bravo',
        bp: sizeConfig.bpPerSide[1],
        modelCount: sizeConfig.modelsPerSide[1],
        tacticalDoctrine: getDoctrineForMission(missionId, 1),
        assemblyName: 'Assembly Bravo',
      },
    ],
    densityRatio: 50,
    lighting: 'Day, Clear',
    visibilityOrMu: 16,
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    allowWaitAction: true,
    allowHideAction: false,
    auditLevel: 'none',
    initiativeCardTieBreakerOnTie: true,
    verbose: false,
  };
}
