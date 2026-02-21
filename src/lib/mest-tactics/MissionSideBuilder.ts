import { AssemblyRoster, AssemblyConfig, mergeAssemblyRosters, buildAssembly, buildProfile, GameSize } from './assembly-builder';
import {
  MissionSide,
  MissionSideOptions,
  createMissionSide,
  DeploymentZone,
  ModelSlotStatus,
} from './MissionSide';
import { Profile } from './Profile';

/**
 * Extended options for building a MissionSide
 */
export interface MissionSideBuildOptions extends MissionSideOptions {
  /** Whether to merge assemblies into a single roster */
  mergeAssemblies?: boolean;
  /** Name for the merged assembly */
  mergedAssemblyName?: string;
  /** Config for the merged assembly */
  mergedAssemblyConfig?: AssemblyConfig;
  /** Deployment zone definitions */
  deploymentZones?: DeploymentZone[];
  /** VIP model ID */
  vipModelId?: string;
}

/**
 * Options for creating a multi-assembly side
 */
export interface MultiAssemblyOptions {
  /** Assembly rosters to combine */
  rosters: AssemblyRoster[];
  /** Whether to merge into single roster or keep separate */
  mergeAssemblies?: boolean;
  /** Side name */
  sideName: string;
  /** Starting portrait index */
  startingIndex?: number;
  /** Deployment zones */
  deploymentZones?: DeploymentZone[];
  /** VIP model ID */
  vipModelId?: string;
}

/**
 * Summary of an assembly in a side
 */
export interface MissionSideSummaryAssembly {
  name: string;
  totalBP: number;
  totalCharacters: number;
}

/**
 * Summary of a member in a side
 */
export interface MissionSideSummaryMember {
  id: string;
  assembly: string;
  portrait: {
    sheet: string;
    column: number;
    row: number;
  };
  status: ModelSlotStatus;
  position?: { x: number; y: number };
  isVIP: boolean;
}

/**
 * Full summary of a MissionSide
 */
export interface MissionSideSummary {
  id: string;
  name: string;
  totalBP: number;
  assemblies: MissionSideSummaryAssembly[];
  members: MissionSideSummaryMember[];
  deploymentZones: Array<{
    id: string;
    name: string;
    bounds: { x: number; y: number; width: number; height: number };
    sideId: string;
  }>;
  state: {
    currentTurn: number;
    readyCount: number;
    activatedCount: number;
    eliminatedCount: number;
    victoryPoints: number;
  };
}

/**
 * Compact summary for display purposes
 */
export interface MissionSideCompactSummary {
  id: string;
  name: string;
  totalBP: number;
  totalCharacters: number;
  activeCount: number;
  eliminatedCount: number;
  victoryPoints: number;
  assemblies: MissionSideSummaryAssembly[];
}

/**
 * Build a MissionSide from assembly rosters
 */
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
  const deploymentZones = builderOptions.deploymentZones ?? [];
  const vipModelId = builderOptions.vipModelId;

  let resolvedRosters: AssemblyRoster[] = rosterList;

  if (mergeAssemblies) {
    const mergedRoster = mergeAssemblyRosters(mergedAssemblyName, rosterList, mergedAssemblyConfig);
    resolvedRosters = [mergedRoster];
  }

  const sideOptions: MissionSideOptions = {
    startingIndex,
    defaultPortraitSheet,
    deploymentZones,
    vipModelId,
  };

  return createMissionSide(sideName, resolvedRosters, sideOptions);
}

/**
 * Build a side from multiple assemblies with optional merging
 */
export function buildMultiAssemblySide(options: MultiAssemblyOptions): MissionSide {
  const {
    rosters,
    mergeAssemblies = false,
    sideName,
    startingIndex = 0,
    deploymentZones = [],
    vipModelId,
  } = options;

  const buildOptions: MissionSideBuildOptions = {
    mergeAssemblies,
    startingIndex,
    deploymentZones,
    vipModelId,
  };

  if (mergeAssemblies) {
    buildOptions.mergedAssemblyName = `${sideName} Combined`;
  }

  return buildMissionSide(sideName, rosters, buildOptions);
}

/**
 * Create a deployment zone
 */
export function createDeploymentZone(
  id: string,
  name: string,
  bounds: { x: number; y: number; width: number; height: number },
  sideId: string,
  maxModels?: number
): DeploymentZone {
  return {
    id,
    name,
    bounds,
    sideId,
    maxModels,
  };
}

/**
 * Create standard deployment zones for a mission
 */
export function createStandardDeploymentZones(
  battlefieldWidth: number,
  battlefieldHeight: number,
  sideAId: string,
  sideBId: string,
  deploymentDepth: number = 4
): DeploymentZone[] {
  return [
    createDeploymentZone(
      'zone-a',
      'Side A Deployment',
      {
        x: 0,
        y: 0,
        width: deploymentDepth,
        height: battlefieldHeight,
      },
      sideAId
    ),
    createDeploymentZone(
      'zone-b',
      'Side B Deployment',
      {
        x: battlefieldWidth - deploymentDepth,
        y: 0,
        width: deploymentDepth,
        height: battlefieldHeight,
      },
      sideBId
    ),
  ];
}

/**
 * Format a MissionSide as a full summary
 */
export function formatMissionSideSummary(side: MissionSide): MissionSideSummary {
  const assemblies = side.assemblies.map(assembly => ({
    name: assembly.name,
    totalBP: assembly.totalBP,
    totalCharacters: assembly.totalCharacters,
  }));

  const members = side.members.map(member => ({
    id: member.id,
    assembly: member.assembly.name,
    portrait: {
      sheet: member.portrait.sheet,
      column: member.portrait.column,
      row: member.portrait.row,
    },
    status: member.status,
    position: member.position ? { x: member.position.x, y: member.position.y } : undefined,
    isVIP: member.isVIP,
  }));

  return {
    id: side.id,
    name: side.name,
    totalBP: side.totalBP,
    assemblies,
    members,
    deploymentZones: side.deploymentZones.map(zone => ({
      id: zone.id,
      name: zone.name,
      bounds: zone.bounds,
      sideId: zone.sideId,
    })),
    state: {
      currentTurn: side.state.currentTurn,
      readyCount: side.state.readyModels.size,
      activatedCount: side.state.activatedModels.size,
      eliminatedCount: side.state.eliminatedModels.length,
      victoryPoints: side.state.victoryPoints,
    },
  };
}

/**
 * Format a MissionSide as a compact summary
 */
export function formatMissionSideCompactSummary(side: MissionSide): MissionSideCompactSummary {
  const assemblies = side.assemblies.map(assembly => ({
    name: assembly.name,
    totalBP: assembly.totalBP,
    totalCharacters: assembly.totalCharacters,
  }));

  const activeCount = side.members.filter(
    m => m.status !== ModelSlotStatus.Eliminated && m.status !== ModelSlotStatus.KO
  ).length;

  const eliminatedCount = side.members.filter(
    m => m.status === ModelSlotStatus.Eliminated
  ).length;

  return {
    id: side.id,
    name: side.name,
    totalBP: side.totalBP,
    totalCharacters: side.members.length,
    activeCount,
    eliminatedCount,
    victoryPoints: side.state.victoryPoints,
    assemblies,
  };
}

/**
 * Build a simple side from profile configurations
 */
export function buildSideFromProfiles(
  sideName: string,
  profileConfigs: Array<{
    archetypeName: string;
    itemNames?: string[];
    count?: number;
  }>,
  options: MissionSideBuildOptions = {}
): MissionSide {
  const profiles: Profile[] = [];

  for (const config of profileConfigs) {
    const count = config.count ?? 1;
    for (let i = 0; i < count; i++) {
      profiles.push(buildProfile(config.archetypeName, { itemNames: config.itemNames }));
    }
  }

  const roster = buildAssembly(sideName, profiles);
  return buildMissionSide(sideName, [roster], options);
}

/**
 * Build opposing sides for a mission
 */
export function buildOpposingSides(
  sideAName: string,
  sideAProfiles: Array<{
    archetypeName: string;
    itemNames?: string[];
    count?: number;
  }>,
  sideBName: string,
  sideBProfiles: Array<{
    archetypeName: string;
    itemNames?: string[];
    count?: number;
  }>,
  options: {
    battlefieldWidth?: number;
    battlefieldHeight?: number;
    mergeAssemblies?: boolean;
  } = {}
): { sideA: MissionSide; sideB: MissionSide } {
  const battlefieldWidth = options.battlefieldWidth ?? 24;
  const battlefieldHeight = options.battlefieldHeight ?? 24;
  const mergeAssemblies = options.mergeAssemblies ?? false;

  const sideA = buildSideFromProfiles(sideAName, sideAProfiles, {
    mergeAssemblies,
  });

  const sideB = buildSideFromProfiles(sideBName, sideBProfiles, {
    mergeAssemblies,
    startingIndex: sideA.members.length,
  });

  // Add deployment zones
  const zones = createStandardDeploymentZones(
    battlefieldWidth,
    battlefieldHeight,
    sideA.id,
    sideB.id
  );

  sideA.deploymentZones = zones.filter(z => z.sideId === sideA.id);
  sideB.deploymentZones = zones.filter(z => z.sideId === sideB.id);

  return { sideA, sideB };
}
