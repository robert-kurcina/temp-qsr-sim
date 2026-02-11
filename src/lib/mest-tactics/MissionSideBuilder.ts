import { AssemblyRoster, AssemblyConfig, mergeAssemblyRosters } from './assembly-builder';
import { MissionSide, MissionSideOptions, createMissionSide } from './MissionSide';

export interface MissionSideBuildOptions extends MissionSideOptions {
  mergeAssemblies?: boolean;
  mergedAssemblyName?: string;
  mergedAssemblyConfig?: AssemblyConfig;
}

export interface MissionSideSummaryAssembly {
  name: string;
  totalBP: number;
  totalCharacters: number;
}

export interface MissionSideSummaryMember {
  id: string;
  assembly: string;
  portrait: {
    sheet: string;
    column: number;
    row: number;
  };
}

export interface MissionSideSummary {
  id: string;
  name: string;
  totalBP: number;
  assemblies: MissionSideSummaryAssembly[];
  members: MissionSideSummaryMember[];
}

export interface MissionSideCompactSummary {
  id: string;
  name: string;
  totalBP: number;
  totalCharacters: number;
  assemblies: MissionSideSummaryAssembly[];
}

export function buildMissionSide(
  name: string,
  rosters: AssemblyRoster[],
  options: MissionSideBuildOptions = {}
): MissionSide {
  const sideName = name;
  const rosterList = rosters;
  const builderOptions = options;
  const mergeAssemblies = builderOptions.mergeAssemblies ?? false;
  const startingIndex = builderOptions.startingIndex;
  const defaultPortraitSheet = builderOptions.defaultPortraitSheet;
  const mergedAssemblyName = builderOptions.mergedAssemblyName ?? `${sideName} Combined`;
  const mergedAssemblyConfig = builderOptions.mergedAssemblyConfig ?? {};

  let resolvedRosters: AssemblyRoster[] = rosterList;

  if (mergeAssemblies) {
    const mergedRoster = mergeAssemblyRosters(mergedAssemblyName, rosterList, mergedAssemblyConfig);
    resolvedRosters = [mergedRoster];
  }

  const sideOptions: MissionSideOptions = {
    startingIndex,
    defaultPortraitSheet,
  };

  return createMissionSide(sideName, resolvedRosters, sideOptions);
}

export function formatMissionSideSummary(side: MissionSide): MissionSideSummary {
  const sourceSide = side;
  const assemblies = sourceSide.assemblies.map(assembly => {
    const summary: MissionSideSummaryAssembly = {
      name: assembly.name,
      totalBP: assembly.totalBP,
      totalCharacters: assembly.totalCharacters,
    };
    return summary;
  });
  const members = sourceSide.members.map(member => {
    const summary: MissionSideSummaryMember = {
      id: member.id,
      assembly: member.assembly.name,
      portrait: {
        sheet: member.portrait.sheet,
        column: member.portrait.column,
        row: member.portrait.row,
      },
    };
    return summary;
  });

  return {
    id: sourceSide.id,
    name: sourceSide.name,
    totalBP: sourceSide.totalBP,
    assemblies,
    members,
  };
}

export function formatMissionSideCompactSummary(side: MissionSide): MissionSideCompactSummary {
  const sourceSide = side;
  const assemblies = sourceSide.assemblies.map(assembly => {
    const summary: MissionSideSummaryAssembly = {
      name: assembly.name,
      totalBP: assembly.totalBP,
      totalCharacters: assembly.totalCharacters,
    };
    return summary;
  });

  return {
    id: sourceSide.id,
    name: sourceSide.name,
    totalBP: sourceSide.totalBP,
    totalCharacters: sourceSide.members.length,
    assemblies,
  };
}
