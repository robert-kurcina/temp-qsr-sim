// /src/engine/GameSizeService.js
import gameSizesData from '../../../data/game_sizes.json';

/**
 * Canonical MEST QSR game size definitions
 * Loaded from external JSON file
 */
export const GAME_SIZES = gameSizesData;

/**
 * Get BP status based on official QSR range
 */
export function getBPStatus(bp, gameSize = 'small') {
  const config = GAME_SIZES[gameSize];
  if (!config) return 'normal';
  
  if (bp < config.minBP) return 'error';      // Below minimum
  if (bp > config.maxBP) return 'error';      // Above maximum
  if (bp <= config.minBP + 50) return 'warning'; // Near minimum
  if (bp >= config.maxBP - 50) return 'warning'; // Near maximum
  return 'normal';
}

/**
 * Check if BP is within valid range
 */
export function isValidBP(bp, gameSize = 'small') {
  const config = GAME_SIZES[gameSize];
  return bp >= config.minBP && bp <= config.maxBP;
}

/**
 * Check inter-player balance (within 25 BP)
 */
export function isBalanced(bp1, bp2) {
  return Math.abs(bp1 - bp2) <= 25;
}

/**
 * Get game size options for UI
 */
export function getGameSizeOptions() {
  return Object.entries(GAME_SIZES).map(([key, value]) => ({
    value: key,
    label: `${value.name} (${value.minBP}-${value.maxBP} BP, ${value.minModels}-${value.maxModels} models)`
  }));
}

/**
 * Get BP status based on official QSR limits
 */
export function getBPStatus(bp, gameSize = 'medium') {
  const limit = GAME_SIZES[gameSize]?.maxBP;
  if (limit === undefined) return 'normal';
  
  if (bp > limit) return 'error';
  if (bp > limit * 0.9) return 'warning';
  return 'normal';
}

/**
 * Get model count status
 */
export function getModelCountStatus(modelCount, gameSize = 'medium') {
  const config = GAME_SIZES[gameSize];
  if (!config) return 'normal';
  
  if (modelCount < config.minModels || modelCount > config.maxModels) {
    return 'error';
  }
  return 'normal';
}

/**
 * Get battlefield size for game size
 */
export function getBattlefieldSize(gameSize = 'medium') {
  return GAME_SIZES[gameSize]?.battlefieldSizeMU || 24;
}

/**
 * Get all game size options for UI
 */
export function getGameSizeOptions() {
  return Object.entries(GAME_SIZES).map(([key, value]) => ({
    value: key,
    label: `${value.name} (${value.maxBP} BP, ${value.minModels}-${value.maxModels} models)`
  }));
}