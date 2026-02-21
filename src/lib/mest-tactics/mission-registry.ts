import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from './mission-definitions';
import { getEliminationMission, isEliminationMission } from './missions/elimination';
import { getEngagementMission, isEngagementMission } from './missions/engagement';
import { getSabotageMission, isSabotageMission } from './missions/sabotage';
import { getBeaconMission, isBeaconMission } from './missions/beacon';
import { getExtractionPointMission, isExtractionPointMission } from './missions/extraction-point';
import { getExfilMission, isExfilMission } from './missions/exfil';
import { getTriadMission, isTriadMission } from './missions/triad';
import { getGhostProtocolMission, isGhostProtocolMission } from './missions/ghost-protocol';
import { getLastStandMission, isLastStandMission } from './missions/last-stand';
import { getSwitchbackMission, isSwitchbackMission } from './missions/switchback';

/**
 * Mission registry - maps mission IDs to their definitions
 */
const missionRegistry: Map<string, () => MissionDefinition> = new Map();

// Register Elimination mission
missionRegistry.set('QAI_1', getEliminationMission);

// Register Engagement mission
missionRegistry.set('QAI_12', getEngagementMission);

// Register Sabotage mission
missionRegistry.set('QAI_13', getSabotageMission);

// Register Beacon mission
missionRegistry.set('QAI_14', getBeaconMission);

// Register Extraction Point mission
missionRegistry.set('QAI_15', getExtractionPointMission);

// Register Exfil mission
missionRegistry.set('QAI_16', getExfilMission);

// Register Triad mission
missionRegistry.set('QAI_17', getTriadMission);

// Register Ghost Protocol mission
missionRegistry.set('QAI_18', getGhostProtocolMission);

// Register Last Stand mission
missionRegistry.set('QAI_19', getLastStandMission);

// Register Switchback mission
missionRegistry.set('QAI_20', getSwitchbackMission);

/**
 * Get a mission definition by ID
 */
export function getMissionDefinition(missionId: string): MissionDefinition | null {
  const factory = missionRegistry.get(missionId);
  if (factory) {
    return factory();
  }
  return null;
}

/**
 * Get all available mission definitions
 */
export function getAllMissionDefinitions(): MissionDefinition[] {
  return Array.from(missionRegistry.values()).map(factory => factory());
}

/**
 * Check if a mission ID is valid
 */
export function isValidMission(missionId: string): boolean {
  return missionRegistry.has(missionId);
}

/**
 * Register a new mission definition
 */
export function registerMission(missionId: string, factory: () => MissionDefinition): void {
  missionRegistry.set(missionId, factory);
}

/**
 * Get list of all registered mission IDs
 */
export function getRegisteredMissionIds(): string[] {
  return Array.from(missionRegistry.keys());
}
