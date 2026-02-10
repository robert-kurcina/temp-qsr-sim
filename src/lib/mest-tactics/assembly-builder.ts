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

export interface BuildProfileOptions {
  secondaryArchetypeNames?: string[];
  itemNames?: string[];
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

export function buildAssembly(name: string, profiles: Profile[]): AssemblyRoster {
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
  };

  return {
    assembly,
    characters,
    profiles,
  };
}
