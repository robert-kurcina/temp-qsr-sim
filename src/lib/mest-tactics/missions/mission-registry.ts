import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from './mission-definitions';
import { getEliminationMission, isEliminationMission } from './elimination';
import { getConvergenceMission, isConvergenceMission } from './convergence';
import { getAssaultMission, isAssaultMission } from './assault';
import { getDominionMission, isDominionMission } from './dominion';
import { getRecoveryMission, isRecoveryMission } from './recovery';
import { getEscortMission, isEscortMission } from './escort';
import { getTriumvirateMission, isTriumvirateMission } from './triumvirate';
import { getStealthMission, isStealthMission } from './stealth';
import { getDefianceMission, isDefianceMission } from './defiance';
import { getBreachMission, isBreachMission } from './breach';
import { MissionLoader } from '../mission/mission-loader';
import { MissionEngine } from '../mission/mission-engine';
import { MissionConfig } from '../mission/mission-config';

/**
 * Mission Registry
 * Maps mission IDs to their definitions and provides loading functionality
 * 
 * @deprecated Use MissionLoader and MissionEngine for new code
 * This registry is maintained for backwards compatibility with existing TS mission files
 */
const missionRegistry: Map<string, () => MissionDefinition> = new Map();

// Legacy mission definitions (maintained for backwards compatibility)
// New missions should use JSON configs loaded via MissionLoader

/**
 * Get a mission definition by ID
 * @deprecated Use MissionLoader.byId() for JSON-based missions
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
 * @deprecated Use MissionLoader.getAvailableMissions() for JSON-based missions
 */
export function getAllMissionDefinitions(): MissionDefinition[] {
  return Array.from(missionRegistry.values()).map(factory => factory());
}

/**
 * Check if a mission ID is valid
 * @deprecated Use MissionLoader.byId() !== null for JSON-based missions
 */
export function isValidMission(missionId: string): boolean {
  return missionRegistry.has(missionId) || MissionLoader.getAvailableMissions().includes(missionId);
}

/**
 * Load a mission engine from JSON config
 * @param missionId - Mission ID (e.g., 'QAI_11', 'QAI_12')
 * @returns MissionEngine instance or null if not found
 */
export async function loadMissionEngine(missionId: string): Promise<MissionEngine | null> {
  const config = await MissionLoader.byId(missionId);
  if (!config) {
    return null;
  }
  return MissionEngine.fromConfig(config);
}

/**
 * Get list of all available mission IDs (both legacy and JSON)
 */
export function getAllAvailableMissions(): string[] {
  const legacyMissions = Array.from(missionRegistry.keys());
  const jsonMissions = MissionLoader.getAvailableMissions();
  return [...new Set([...legacyMissions, ...jsonMissions])];
}

/**
 * Get balance report for a mission
 */
export function getMissionBalanceReport(missionId: string): string | null {
  // Try JSON missions first
  const config = MissionLoader.byId(missionId);
  if (config) {
    return MissionLoader.getBalanceReport(config);
  }
  
  // Fall back to legacy missions
  const definition = getMissionDefinition(missionId);
  if (definition) {
    // Legacy missions don't have balance validation
    return 'Legacy mission - no balance validation available';
  }
  
  return null;
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
