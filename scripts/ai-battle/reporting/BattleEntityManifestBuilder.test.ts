import { describe, expect, it } from 'vitest';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameConfig } from '../../shared/BattleReportTypes';
import { buildBattleEntityManifestForRunner } from './BattleEntityManifestBuilder';

function createConfig(): GameConfig {
  return {
    missionId: 'QAI_11',
    missionName: 'Elimination',
    gameSize: GameSize.VERY_SMALL,
    battlefieldWidth: 18,
    battlefieldHeight: 24,
    maxTurns: 6,
    endGameTurn: 4,
    sides: [
      {
        name: 'Alpha',
        bp: 100,
        modelCount: 2,
        tacticalDoctrine: TacticalDoctrine.Operative,
        technologicalAge: 'Classical',
        assemblyName: 'Alpha Assembly',
      },
      {
        name: 'Bravo',
        bp: 100,
        modelCount: 1,
        tacticalDoctrine: TacticalDoctrine.Balanced,
        technologicalAge: 'Classical',
        assemblyName: 'Bravo Assembly',
      },
    ],
    densityRatio: 50,
    lighting: 'Day, Clear' as any,
    visibilityOrMu: 16,
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    verbose: false,
  };
}

function createCharacter(
  id: string,
  profileName: string,
  archetype: string,
  items: Array<{ name: string; classification?: string; class?: string; type?: string; bp?: number }>
): Character {
  return {
    id,
    profile: {
      name: profileName,
      archetype,
      items,
      equipment: items,
      totalBp: 40,
    },
    state: {},
  } as unknown as Character;
}

describe('buildBattleEntityManifestForRunner', () => {
  it('builds side/assembly/character/profile/loadout mappings and byModelId lookup', () => {
    const alpha1 = createCharacter('alpha-1', 'alpha-profile', 'Veteran', [
      { name: 'Sword, Broad', classification: 'Weapon', class: 'Melee Weapon', bp: 8 },
      { name: 'Shield, Light', classification: 'Armor', class: 'Armor', bp: 4 },
    ]);
    const alpha2 = createCharacter('alpha-2', 'alpha-profile', 'Veteran', [
      { name: 'Sword, Broad', classification: 'Weapon', class: 'Melee Weapon', bp: 8 },
      { name: 'Shield, Light', classification: 'Armor', class: 'Armor', bp: 4 },
    ]);
    const bravo1 = createCharacter('bravo-1', 'bravo-profile', 'Militia', [
      { name: 'Sling', classification: 'Weapon', class: 'Ranged Weapon', bp: 3 },
    ]);

    const manifest = buildBattleEntityManifestForRunner({
      config: createConfig(),
      sides: [
        { characters: [alpha1, alpha2], totalBP: 120, id: 'Alpha Assembly' },
        { characters: [bravo1], totalBP: 90, id: 'Bravo Assembly' },
      ],
    });

    expect(manifest.version).toBe('1.0');
    expect(manifest.sides).toHaveLength(2);
    expect(manifest.assemblies).toHaveLength(2);
    expect(manifest.characters).toHaveLength(3);
    expect(manifest.loadouts.length).toBeGreaterThanOrEqual(2);

    const alphaLookup = manifest.byModelId['alpha-1'];
    expect(alphaLookup.sideName).toBe('Alpha');
    expect(alphaLookup.assemblyName).toBe('Alpha Assembly');
    expect(alphaLookup.loadoutId).toBeTruthy();

    const alphaCharacter = manifest.characters.find(entry => entry.id === 'alpha-1');
    expect(alphaCharacter?.profileId).toBeTruthy();
    expect(alphaCharacter?.loadoutId).toBe(alphaLookup.loadoutId);

    const alphaLoadout = manifest.loadouts.find(loadout => loadout.id === alphaLookup.loadoutId);
    expect(alphaLoadout?.weapons).toContain('Sword, Broad');
    expect(alphaLoadout?.hasShield).toBe(true);
  });
});
