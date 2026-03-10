import rawMissionTuning from '../../../data/mission_tuning.json';

export interface MissionAggressionTuningConfig {
  crossingThresholdRatio: number;
}

export interface MissionSanctuaryTuningConfig {
  defaultBpThresholdRatio: number;
}

export interface MissionSpecialRulesTuningConfig {
  reinforcements: {
    defaultDeploymentDistance: number;
  };
  alert: {
    defaultThreshold: number;
  };
  threat: {
    defaultMaxLevel: number;
  };
  vigilance: {
    normalVisibility: number;
    enhancedVisibility: number;
  };
}

export interface MissionHeuristicScorerTuningConfig {
  defaultVictoryConditionThreshold: number;
}

export interface MissionTuningConfig {
  version: number;
  categoryBlocks: {
    aggression: MissionAggressionTuningConfig;
    sanctuary: MissionSanctuaryTuningConfig;
    specialRules: MissionSpecialRulesTuningConfig;
    heuristicScorer: MissionHeuristicScorerTuningConfig;
  };
}

const DEFAULT_MISSION_TUNING: MissionTuningConfig = {
  version: 1,
  categoryBlocks: {
    aggression: {
      crossingThresholdRatio: 0.5,
    },
    sanctuary: {
      defaultBpThresholdRatio: 0.25,
    },
    specialRules: {
      reinforcements: {
        defaultDeploymentDistance: 6,
      },
      alert: {
        defaultThreshold: 6,
      },
      threat: {
        defaultMaxLevel: 6,
      },
      vigilance: {
        normalVisibility: 8,
        enhancedVisibility: 16,
      },
    },
    heuristicScorer: {
      defaultVictoryConditionThreshold: 5,
    },
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asNumber(
  value: unknown,
  fallback: number,
  options: { min?: number; max?: number; integer?: boolean } = {}
): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const adjusted = options.integer ? Math.trunc(parsed) : parsed;
  let normalized = adjusted;
  if (options.min !== undefined) {
    normalized = Math.max(options.min, normalized);
  }
  if (options.max !== undefined) {
    normalized = Math.min(options.max, normalized);
  }
  return normalized;
}

function buildMissionTuningConfig(raw: unknown): MissionTuningConfig {
  const root = asRecord(raw);
  const categoryBlocks = asRecord(root['categoryBlocks']);

  const defaultAggression = DEFAULT_MISSION_TUNING.categoryBlocks.aggression;
  const rawAggression = asRecord(categoryBlocks['aggression']);
  const aggression: MissionAggressionTuningConfig = {
    crossingThresholdRatio: asNumber(
      rawAggression['crossingThresholdRatio'],
      defaultAggression.crossingThresholdRatio,
      { min: 0, max: 1 }
    ),
  };

  const defaultSanctuary = DEFAULT_MISSION_TUNING.categoryBlocks.sanctuary;
  const rawSanctuary = asRecord(categoryBlocks['sanctuary']);
  const sanctuary: MissionSanctuaryTuningConfig = {
    defaultBpThresholdRatio: asNumber(
      rawSanctuary['defaultBpThresholdRatio'],
      defaultSanctuary.defaultBpThresholdRatio,
      { min: 0, max: 1 }
    ),
  };

  const defaultSpecialRules = DEFAULT_MISSION_TUNING.categoryBlocks.specialRules;
  const rawSpecialRules = asRecord(categoryBlocks['specialRules']);
  const rawReinforcements = asRecord(rawSpecialRules['reinforcements']);
  const rawAlert = asRecord(rawSpecialRules['alert']);
  const rawThreat = asRecord(rawSpecialRules['threat']);
  const rawVigilance = asRecord(rawSpecialRules['vigilance']);
  const specialRules: MissionSpecialRulesTuningConfig = {
    reinforcements: {
      defaultDeploymentDistance: asNumber(
        rawReinforcements['defaultDeploymentDistance'],
        defaultSpecialRules.reinforcements.defaultDeploymentDistance,
        { min: 0 }
      ),
    },
    alert: {
      defaultThreshold: asNumber(
        rawAlert['defaultThreshold'],
        defaultSpecialRules.alert.defaultThreshold,
        { min: 1, integer: true }
      ),
    },
    threat: {
      defaultMaxLevel: asNumber(
        rawThreat['defaultMaxLevel'],
        defaultSpecialRules.threat.defaultMaxLevel,
        { min: 1, integer: true }
      ),
    },
    vigilance: {
      normalVisibility: asNumber(
        rawVigilance['normalVisibility'],
        defaultSpecialRules.vigilance.normalVisibility,
        { min: 0 }
      ),
      enhancedVisibility: asNumber(
        rawVigilance['enhancedVisibility'],
        defaultSpecialRules.vigilance.enhancedVisibility,
        { min: 0 }
      ),
    },
  };

  const defaultHeuristic = DEFAULT_MISSION_TUNING.categoryBlocks.heuristicScorer;
  const rawHeuristic = asRecord(categoryBlocks['heuristicScorer']);
  const heuristicScorer: MissionHeuristicScorerTuningConfig = {
    defaultVictoryConditionThreshold: asNumber(
      rawHeuristic['defaultVictoryConditionThreshold'],
      defaultHeuristic.defaultVictoryConditionThreshold,
      { min: 0, integer: true }
    ),
  };

  return Object.freeze({
    version: asNumber(root['version'], DEFAULT_MISSION_TUNING.version, { min: 1, integer: true }),
    categoryBlocks: {
      aggression,
      sanctuary,
      specialRules,
      heuristicScorer,
    },
  });
}

export const missionTuningConfig = buildMissionTuningConfig(rawMissionTuning);
export const missionTuning = missionTuningConfig.categoryBlocks;
