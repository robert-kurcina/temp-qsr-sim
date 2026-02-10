import { gameData } from '../data';
import { Assembly } from './Assembly';
import { Character } from './Character';
import { Profile } from './Profile';
import { createProfiles } from './profile-generator';

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

const gameSizeDefaults: Record<GameSize, Required<AssemblyConfig>> = {
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
  const gameSize = config.gameSize ?? GameSize.VERY_SMALL;
  const defaults = gameSizeDefaults[gameSize];
  const resolvedConfig: Required<AssemblyConfig> = {
    bpLimitMin: config.bpLimitMin ?? defaults.bpLimitMin,
    bpLimitMax: config.bpLimitMax ?? defaults.bpLimitMax,
    characterLimitMin: config.characterLimitMin ?? defaults.characterLimitMin,
    characterLimitMax: config.characterLimitMax ?? defaults.characterLimitMax,
    gameSize,
  };

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
