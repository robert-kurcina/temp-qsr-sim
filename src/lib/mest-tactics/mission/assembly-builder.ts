import { gameData } from '../../data';
import { Assembly } from '../core/Assembly';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { createProfiles } from '../utils/profile-generator';

export interface AssemblyRoster {
  assembly: Assembly;
  characters: Character[];
  profiles: Profile[];
}

export enum GameSize {
  VERY_SMALL = 'VERY_SMALL',
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  VERY_LARGE = 'VERY_LARGE',
}

export interface AssemblyConfig {
  bpLimitMin?: number;
  bpLimitMax?: number;
  characterLimitMin?: number;
  characterLimitMax?: number;
  gameSize?: GameSize;
}

export interface BuildProfileOptions {
  secondaryArchetypeNames?: string[];
  itemNames?: string[];
}

// Game size defaults (QSR standard)
export const gameSizeDefaults: Record<GameSize, Required<AssemblyConfig>> = {
  [GameSize.VERY_SMALL]: {
    bpLimitMin: 125,
    bpLimitMax: 250,
    characterLimitMin: 2,
    characterLimitMax: 4,
    gameSize: GameSize.VERY_SMALL,
  },
  [GameSize.SMALL]: {
    bpLimitMin: 250,
    bpLimitMax: 500,
    characterLimitMin: 4,
    characterLimitMax: 8,
    gameSize: GameSize.SMALL,
  },
  [GameSize.MEDIUM]: {
    bpLimitMin: 500,
    bpLimitMax: 750,
    characterLimitMin: 6,
    characterLimitMax: 12,
    gameSize: GameSize.MEDIUM,
  },
  [GameSize.LARGE]: {
    bpLimitMin: 750,
    bpLimitMax: 1000,
    characterLimitMin: 8,
    characterLimitMax: 12,
    gameSize: GameSize.LARGE,
  },
  [GameSize.VERY_LARGE]: {
    bpLimitMin: 1000,
    bpLimitMax: 1250,
    characterLimitMin: 10,
    characterLimitMax: 20,
    gameSize: GameSize.VERY_LARGE,
  },
};

function resolveAssemblyConfig(config: AssemblyConfig): Required<AssemblyConfig> {
  const requestedConfig = config;
  const gameSize = requestedConfig.gameSize ?? GameSize.VERY_SMALL;
  const defaults = gameSizeDefaults[gameSize];
  const resolvedConfig: Required<AssemblyConfig> = {
    bpLimitMin: requestedConfig.bpLimitMin ?? defaults.bpLimitMin,
    bpLimitMax: requestedConfig.bpLimitMax ?? defaults.bpLimitMax,
    characterLimitMin: requestedConfig.characterLimitMin ?? defaults.characterLimitMin,
    characterLimitMax: requestedConfig.characterLimitMax ?? defaults.characterLimitMax,
    gameSize,
  };

  return resolvedConfig;
}

function hasConfigOverrides(config: AssemblyConfig): boolean {
  const entries = Object.entries(config);
  return entries.length > 0;
}

export function buildProfile(
  primaryArchetypeName: string,
  options: BuildProfileOptions = {}
): Profile {
  const primaryArchetypeData = gameData.archetypes[primaryArchetypeName];
  if (!primaryArchetypeData) {
    throw new Error(`Unknown archetype: ${primaryArchetypeName}`);
  }

  const profiles = createProfiles(
    primaryArchetypeName,
    primaryArchetypeData,
    options.secondaryArchetypeNames || [],
    options.itemNames || []
  );

  if (profiles.length === 0) {
    throw new Error(`Failed to build profile for archetype: ${primaryArchetypeName}`);
  }

  const profile = profiles[0];
  if (!profile.equipment && profile.items) {
    profile.equipment = profile.items;
  }

  return profile;
}

export function buildAssembly(
  name: string,
  profiles: Profile[],
  config: AssemblyConfig = {}
): AssemblyRoster {
  const resolvedConfig = resolveAssemblyConfig(config);

  const characters = profiles.map(profile => new Character(profile));
  const totalBP = profiles.reduce((sum, profile) => {
    const profileBp = profile.adjustedBp ?? profile.totalBp ?? 0;
    return sum + profileBp;
  }, 0);

  const assembly: Assembly = {
    name,
    characters: characters.map(character => character.id),
    totalBP,
    totalCharacters: characters.length,
    config: resolvedConfig,
  };

  return {
    assembly,
    characters,
    profiles,
  };
}

export function mergeAssemblyRosters(
  name: string,
  rosters: AssemblyRoster[],
  config: AssemblyConfig = {}
): AssemblyRoster {
  const assemblyName = name;
  const rosterList = rosters;
  const configOverrides = config;
  const assemblies = rosterList.map(roster => roster.assembly);
  const characters = rosterList.flatMap(roster => roster.characters);
  const profiles = rosterList.flatMap(roster => roster.profiles);
  const totalBP = assemblies.reduce((sum, assembly) => sum + assembly.totalBP, 0);
  const totalCharacters = characters.length;
  const characterIds = characters.map(character => character.id);
  const hasOverrides = hasConfigOverrides(configOverrides);
  const allHaveConfig = assemblies.length > 0 && assemblies.every(assembly => Boolean(assembly.config));

  let mergedConfig: Assembly['config'] | undefined;
  if (hasOverrides) {
    mergedConfig = resolveAssemblyConfig(configOverrides);
  } else if (allHaveConfig) {
    const initial = 0;
    const summed = assemblies.reduce(
      (sum, assembly) => {
        const configValue = assembly.config as NonNullable<Assembly['config']>;
        return {
          bpLimitMin: sum.bpLimitMin + configValue.bpLimitMin,
          bpLimitMax: sum.bpLimitMax + configValue.bpLimitMax,
          characterLimitMin: sum.characterLimitMin + configValue.characterLimitMin,
          characterLimitMax: sum.characterLimitMax + configValue.characterLimitMax,
        };
      },
      {
        bpLimitMin: initial,
        bpLimitMax: initial,
        characterLimitMin: initial,
        characterLimitMax: initial,
      }
    );
    mergedConfig = {
      ...summed,
      gameSize: 'MERGED',
    };
  }

  const assembly: Assembly = {
    name: assemblyName,
    characters: characterIds,
    totalBP,
    totalCharacters,
    config: mergedConfig,
  };

  return {
    assembly,
    characters,
    profiles,
  };
}
