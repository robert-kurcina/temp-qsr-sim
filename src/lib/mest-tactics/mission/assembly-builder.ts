import { gameData } from '../../data';
import { Assembly } from '../core/Assembly';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import type { Attributes } from '../core/Attributes';
import { createProfiles } from '../utils/profile-generator';
import { CANONICAL_GAME_SIZE_ORDER, CANONICAL_GAME_SIZES } from './game-size-canonical';
import {
  filterItemsByTechLevel,
  TechLevelConfig,
  TechnologicalAge,
  createTechConfigFromAge,
  validateItemsForTechLevel,
} from '../utils/tech-level-filter';

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
  /** Backward compatibility options accepted by older tests */
  traits?: string[];
  /** Backward compatibility options accepted by older tests */
  attributes?: Partial<Attributes>;
  /**
   * Technological age for item filtering
   * Default: 'Medieval' (Tech Level 5)
   */
  technologicalAge?: TechnologicalAge;
  /**
   * Extended tech range for QSR (allows Tech 1-5 instead of 1-3)
   * Default: false
   */
  extendedQSR?: boolean;
  /**
   * Custom tech level config (overrides technologicalAge)
   */
  techLevelConfig?: TechLevelConfig;
}

// Game size defaults (canonical: src/data/game_sizes.json)
export const gameSizeDefaults: Record<GameSize, Required<AssemblyConfig>> = CANONICAL_GAME_SIZE_ORDER
  .reduce((defaults, gameSizeKey) => {
    const row = CANONICAL_GAME_SIZES[gameSizeKey];
    const gameSize = gameSizeKey as GameSize;
    defaults[gameSize] = {
      bpLimitMin: row.minBP,
      bpLimitMax: row.maxBP,
      characterLimitMin: row.minModels,
      characterLimitMax: row.maxModels,
      gameSize,
    };
    return defaults;
  }, {} as Record<GameSize, Required<AssemblyConfig>>);

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
  options?: BuildProfileOptions
): Profile;
export function buildProfile(
  primaryArchetypeName: string,
  secondaryArchetypeNames: string[],
  options?: Omit<BuildProfileOptions, 'secondaryArchetypeNames'>
): Profile;
export function buildProfile(
  primaryArchetypeName: string,
  optionsOrSecondary: BuildProfileOptions | string[] = {},
  legacyOptions: Omit<BuildProfileOptions, 'secondaryArchetypeNames'> = {}
): Profile {
  const primaryArchetypeData = (gameData.archetypes as any)[primaryArchetypeName];
  if (!primaryArchetypeData) {
    throw new Error(`Unknown archetype: ${primaryArchetypeName}`);
  }

  const options: BuildProfileOptions = Array.isArray(optionsOrSecondary)
    ? { ...legacyOptions, secondaryArchetypeNames: optionsOrSecondary }
    : optionsOrSecondary;

  // Determine tech level config
  const age = options.technologicalAge ?? 'Medieval';
  const extended = options.extendedQSR ?? false;
  let techConfig: TechLevelConfig;
  if (options.techLevelConfig) {
    techConfig = options.techLevelConfig;
  } else {
    techConfig = createTechConfigFromAge(age, extended);
  }

  // Filter items by tech level
  let filteredItemNames = options.itemNames;
  if (options.itemNames && options.itemNames.length > 0) {
    filteredItemNames = filterItemsByTechLevel(options.itemNames, techConfig);

    // Validate and warn about filtered items
    const invalidItems = validateItemsForTechLevel(options.itemNames, techConfig.maxTechLevel);
    if (invalidItems.length > 0) {
      console.warn(
        `Tech Level ${techConfig.maxTechLevel} (${age}): ` +
        `Filtered out ${invalidItems.length} items not available: ${invalidItems.join(', ')}`
      );
    }
  }

  const profiles = createProfiles(
    primaryArchetypeName,
    primaryArchetypeData,
    options.secondaryArchetypeNames || [],
    filteredItemNames || []
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
