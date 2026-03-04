/**
 * LARGE Battle Configuration
 *
 * Canonical (src/data/game_sizes.json): 8-12 models per side
 * End-Game Trigger: Turn 8
 * Battlefield: 48×48 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { createSymmetricEliminationConfig } from './shared';

export const LARGE_CONFIG = createSymmetricEliminationConfig({
  gameSize: GameSize.LARGE,
  modelCount: 8,
  archetypeName: 'Veteran',
  itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
});

export default LARGE_CONFIG;
