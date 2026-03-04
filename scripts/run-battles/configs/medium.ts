/**
 * MEDIUM Battle Configuration
 *
 * Canonical (src/data/game_sizes.json): 6-12 models per side, 500-750 BP
 * End-Game Trigger: Turn 6
 * Battlefield: 36×36 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { createSymmetricEliminationConfig } from './shared';

export const MEDIUM_CONFIG = createSymmetricEliminationConfig({
  gameSize: GameSize.MEDIUM,
  modelCount: 6,
  archetypeName: 'Veteran',
  itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
});

export default MEDIUM_CONFIG;
