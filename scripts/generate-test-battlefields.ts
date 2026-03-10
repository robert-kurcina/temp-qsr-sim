#!/usr/bin/env node
/**
 * Test Battlefield Generator (Canonical)
 *
 * Generates a small matrix of deterministic battlefield fixtures using the
 * same generation pipeline as battlefield:generate and API generation.
 */

import { CANONICAL_GAME_SIZE_ORDER, type CanonicalGameSize } from '../src/lib/mest-tactics/mission/game-size-canonical';
import { generateBattlefield } from './battlefield-generator';

type LayerProfile = {
  name: string;
  args: string[];
};

const PROFILES: LayerProfile[] = [
  { name: 'simple', args: ['A0', 'B0', 'W0', 'R0', 'S0', 'T0'] },
  { name: 'mixed', args: ['A40', 'B20', 'W20', 'R40', 'S20', 'T20'] },
  { name: 'dense', args: ['A60', 'B40', 'W40', 'R60', 'S40', 'T40'] },
];

async function main(): Promise<void> {
  let generated = 0;

  for (const gameSize of CANONICAL_GAME_SIZE_ORDER) {
    for (let i = 0; i < PROFILES.length; i++) {
      const profile = PROFILES[i];
      const seed = 424242 + i;
      const result = await generateBattlefield({
        gameSize: gameSize as CanonicalGameSize,
        args: profile.args,
        mode: 'balanced',
        seed,
      });

      if (!result.success) {
        console.error(`[generate-test-battlefields] Failed ${gameSize}/${profile.name}: ${result.error}`);
        continue;
      }

      generated++;
      console.log(`[generate-test-battlefields] ${gameSize}/${profile.name}`);
      console.log(`  JSON: ${result.jsonPath}`);
      console.log(`  SVG:  ${result.svgPath}`);
    }
  }

  console.log(`[generate-test-battlefields] Generated ${generated} battlefield fixture(s).`);
}

main().catch(error => {
  console.error('[generate-test-battlefields] Fatal error:', error);
  process.exit(1);
});
