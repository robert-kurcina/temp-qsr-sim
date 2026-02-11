import { Assembly } from './Assembly';
import { AssemblyRoster } from './assembly-builder';
import { Character } from './Character';
import { Profile } from './Profile';
import { Position } from './battlefield/Position';
import {
  DEFAULT_PORTRAIT_SHEET,
  NamedPortraitAssignment,
  createPortraitAssignmentFromIndex,
} from '../portraits/portrait-naming';

export interface SideMember {
  id: string;
  character: Character;
  profile: Profile;
  assembly: Assembly;
  portrait: NamedPortraitAssignment;
  position?: Position;
}

export interface MissionSide {
  id: string;
  name: string;
  assemblies: Assembly[];
  members: SideMember[];
  totalBP: number;
}

export interface MissionSideOptions {
  startingIndex?: number;
  defaultPortraitSheet?: string;
}

export function createMissionSide(
  name: string,
  rosters: AssemblyRoster[],
  options: MissionSideOptions = {}
): MissionSide {
  const sideName = name;
  const rosterList = rosters;
  const startIndex = options.startingIndex ?? 0;
  const defaultSheet = options.defaultPortraitSheet ?? DEFAULT_PORTRAIT_SHEET;
  const members: SideMember[] = [];
  const assemblies: Assembly[] = [];

  let index = startIndex;

  for (const roster of rosterList) {
    assemblies.push(roster.assembly);

    for (const character of roster.characters) {
      const profile = character.profile;
      const portrait = createPortraitAssignmentFromIndex(index, defaultSheet);
      const callSign = portrait.name;

      character.id = callSign;
      character.name = callSign;

      const member: SideMember = {
        id: callSign,
        character,
        profile,
        assembly: roster.assembly,
        portrait,
      };
      members.push(member);
      index += 1;
    }

  }

  const initialSum = 0;
  const totalBP = assemblies.reduce((sum, assembly) => sum + assembly.totalBP, initialSum);

  return {
    id: sideName,
    name: sideName,
    assemblies,
    members,
    totalBP,
  };
}
