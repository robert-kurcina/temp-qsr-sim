/**
 * VERY_LARGE Battle Configuration
 *
 * Canonical (src/data/game_sizes.json): 10-20 models per side
 * End-Game Trigger: Turn 10
 * Battlefield: 72×48 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { createSymmetricEliminationConfig } from './shared';

export const VERY_LARGE_CONFIG = createSymmetricEliminationConfig({
  gameSize: GameSize.VERY_LARGE,
  modelCount: 16,
  archetypeName: 'Veteran',
  itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
});

export default VERY_LARGE_CONFIG;
