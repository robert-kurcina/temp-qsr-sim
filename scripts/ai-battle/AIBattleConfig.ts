/**
 * AI Battle Configuration
 *
 * Configuration interfaces and validation for AI battle setup.
 * 
 * Game size data is sourced from src/data/game_sizes.json (canonical)
 * and src/lib/data.ts (exported as data["game_sizes"]).
 */

import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { LightingCondition } from '../../src/lib/mest-tactics/utils/visibility';

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
  verbose: boolean;
  seed?: number;
  audit?: boolean;
  viewer?: boolean;
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
  assemblyName: string;
  aggression?: number;
  caution?: number;
}

/**
 * Game size configuration mapping
 * Note: battlefieldWidth is the horizontal dimension (left-to-right),
 * battlefieldHeight is the vertical dimension (top-to-bottom).
 * For rectangular battlefields, width >= height for display purposes.
 */
export interface GameSizeConfig {
  battlefieldWidth: number;
  battlefieldHeight: number;
  maxTurns: number;
  bpPerSide: number[];
  modelsPerSide: number[];
}

/**
 * Default game size configurations
 * Source: src/data/game_sizes.json (canonical)
 */
export const GAME_SIZE_CONFIG: Record<GameSize, GameSizeConfig> = {
  [GameSize.VERY_SMALL]: { battlefieldWidth: 18, battlefieldHeight: 24, maxTurns: 6, bpPerSide: [250, 300, 350], modelsPerSide: [3, 4, 5] },
  [GameSize.SMALL]: { battlefieldWidth: 24, battlefieldHeight: 24, maxTurns: 8, bpPerSide: [400, 450, 500], modelsPerSide: [4, 5, 6] },
  [GameSize.MEDIUM]: { battlefieldWidth: 36, battlefieldHeight: 36, maxTurns: 10, bpPerSide: [600, 700, 800], modelsPerSide: [6, 7, 8] },
  [GameSize.LARGE]: { battlefieldWidth: 48, battlefieldHeight: 48, maxTurns: 12, bpPerSide: [900, 1000, 1100], modelsPerSide: [8, 9, 10] },
  [GameSize.VERY_LARGE]: { battlefieldWidth: 72, battlefieldHeight: 48, maxTurns: 15, bpPerSide: [1400, 1500, 1600], modelsPerSide: [16, 17, 18] },
};

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

  return {
    missionId,
    missionName: 'Elimination',
    gameSize,
    battlefieldWidth: sizeConfig.battlefieldWidth,
    battlefieldHeight: sizeConfig.battlefieldHeight,
    maxTurns: sizeConfig.maxTurns,
    endGameTurn: sizeConfig.maxTurns - 2,
    sides: [
      {
        name: 'Alpha',
        bp: sizeConfig.bpPerSide[1],
        modelCount: sizeConfig.modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Assembly Alpha',
      },
      {
        name: 'Bravo',
        bp: sizeConfig.bpPerSide[1],
        modelCount: sizeConfig.modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Assembly Bravo',
      },
    ],
    densityRatio: 50,
    lighting: { name: 'Day, Clear', visibilityOR: 16 },
    visibilityOrMu: 16,
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    verbose: false,
  };
}
