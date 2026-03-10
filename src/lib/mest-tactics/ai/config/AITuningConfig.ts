import rawAiTuning from '../../../../data/ai_tuning.json';

export interface UtilityScorerWeightsConfig {
  distanceToTarget: number;
  optimalRange: number;
  coverValue: number;
  highGroundValue: number;
  targetHealth: number;
  targetThreat: number;
  killProbability: number;
  cohesionValue: number;
  flankValue: number;
  chokepointValue: number;
  objectiveValue: number;
  victoryConditionValue: number;
  selfPreservation: number;
  allyProtection: number;
  riskAvoidance: number;
  aggression: number;
}

export interface UtilityScorerTuningConfig {
  defaultWeights: UtilityScorerWeightsConfig;
  actionMask: {
    cacheMaxSize: number;
  };
}

export interface SideCoordinatorTuningConfig {
  targetCommitment: {
    decayPerTurn: number;
    maxScore: number;
    pruneThreshold: number;
    maxStaleTurns: number;
  };
  pressureContinuity: {
    decayPerTurn: number;
    maxScore: number;
    pruneThreshold: number;
    maxStaleTurns: number;
    signatureBreakPenalty: number;
    signatureStableBonusStep: number;
    signatureStableBonusMax: number;
  };
  trace: {
    maxEntries: number;
  };
}

export interface ActionVpFilterTuningConfig {
  estimatedContributionByAction: Record<string, number>;
  filters: {
    desperateVpEnablingMinContribution: number;
    highPassiveRejectMaxContribution: number;
  };
  scoring: {
    vpEnablingUrgencyBlend: number;
    baseVpScoreFactor: number;
    passivePenaltyStartTurn: number;
  };
  urgencyMultipliers: {
    desperate: number;
    high: number;
    medium: number;
    low: number;
  };
  passivePenaltyCoefficients: {
    desperate: number;
    high: number;
    medium: number;
    turnOffset: number;
  };
}

export interface TurnHorizonTuningConfig {
  fallbackMaxTurnsFloor: number;
  expectedSurvivalConvergenceSteps: number;
  preTriggerPressureCap: number;
  postTriggerPressureRange: number;
}

export interface AITuningConfig {
  version: number;
  categoryBlocks: {
    utilityScorer: UtilityScorerTuningConfig;
    sideCoordinator: SideCoordinatorTuningConfig;
    actionVpFilter: ActionVpFilterTuningConfig;
    turnHorizon: TurnHorizonTuningConfig;
  };
}

const DEFAULT_AI_TUNING: AITuningConfig = {
  version: 1,
  categoryBlocks: {
    utilityScorer: {
      defaultWeights: {
        distanceToTarget: 1.0,
        optimalRange: 1.5,
        coverValue: 2.0,
        highGroundValue: 1.0,
        targetHealth: 1.5,
        targetThreat: 2.0,
        killProbability: 2.5,
        cohesionValue: 1.0,
        flankValue: 1.5,
        chokepointValue: 0.5,
        objectiveValue: 3.0,
        victoryConditionValue: 4.0,
        selfPreservation: 2.0,
        allyProtection: 1.0,
        riskAvoidance: 1.0,
        aggression: 1.0,
      },
      actionMask: {
        cacheMaxSize: 1024,
      },
    },
    sideCoordinator: {
      targetCommitment: {
        decayPerTurn: 0.75,
        maxScore: 8,
        pruneThreshold: 0.15,
        maxStaleTurns: 5,
      },
      pressureContinuity: {
        decayPerTurn: 0.82,
        maxScore: 10,
        pruneThreshold: 0.2,
        maxStaleTurns: 6,
        signatureBreakPenalty: 0.45,
        signatureStableBonusStep: 0.04,
        signatureStableBonusMax: 0.35,
      },
      trace: {
        maxEntries: 64,
      },
    },
    actionVpFilter: {
      estimatedContributionByAction: {
        close_combat: 0.35,
        ranged_combat: 0.25,
        charge: 0.2,
        move: 0.08,
        disengage: 0.1,
        detect: 0.08,
        hide: 0.0,
        wait: 0.02,
        rally: 0.05,
        revive: 0.08,
        hold: 0.0,
        fiddle: 0.0,
        reload: 0.05,
        pushing: 0.15,
        refresh: 0.1,
        combined: 0.2,
        none: 0.0,
      },
      filters: {
        desperateVpEnablingMinContribution: 0.15,
        highPassiveRejectMaxContribution: 0.03,
      },
      scoring: {
        vpEnablingUrgencyBlend: 0.5,
        baseVpScoreFactor: 2.0,
        passivePenaltyStartTurn: 3,
      },
      urgencyMultipliers: {
        desperate: 3.0,
        high: 2.0,
        medium: 1.5,
        low: 1.0,
      },
      passivePenaltyCoefficients: {
        desperate: 2.5,
        high: 1.5,
        medium: 0.8,
        turnOffset: 2,
      },
    },
    turnHorizon: {
      fallbackMaxTurnsFloor: 6,
      expectedSurvivalConvergenceSteps: 12,
      preTriggerPressureCap: 0.6,
      postTriggerPressureRange: 0.4,
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
  options: { min?: number; integer?: boolean } = {}
): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const adjusted = options.integer ? Math.trunc(parsed) : parsed;
  if (options.min !== undefined) {
    return Math.max(options.min, adjusted);
  }
  return adjusted;
}

function mergeNumberMap(
  base: Record<string, number>,
  overrideCandidate: unknown
): Record<string, number> {
  const override = asRecord(overrideCandidate);
  const merged: Record<string, number> = { ...base };
  for (const [key, fallback] of Object.entries(base)) {
    merged[key] = asNumber(override[key], fallback);
  }
  return merged;
}

function buildAiTuningConfig(raw: unknown): AITuningConfig {
  const root = asRecord(raw);
  const categoryBlocks = asRecord(root['categoryBlocks']);

  const defaultUtility = DEFAULT_AI_TUNING.categoryBlocks.utilityScorer;
  const rawUtility = asRecord(categoryBlocks['utilityScorer']);
  const rawUtilityWeights = asRecord(rawUtility['defaultWeights']);
  const utilityWeights: UtilityScorerWeightsConfig = {
    distanceToTarget: asNumber(rawUtilityWeights['distanceToTarget'], defaultUtility.defaultWeights.distanceToTarget),
    optimalRange: asNumber(rawUtilityWeights['optimalRange'], defaultUtility.defaultWeights.optimalRange),
    coverValue: asNumber(rawUtilityWeights['coverValue'], defaultUtility.defaultWeights.coverValue),
    highGroundValue: asNumber(rawUtilityWeights['highGroundValue'], defaultUtility.defaultWeights.highGroundValue),
    targetHealth: asNumber(rawUtilityWeights['targetHealth'], defaultUtility.defaultWeights.targetHealth),
    targetThreat: asNumber(rawUtilityWeights['targetThreat'], defaultUtility.defaultWeights.targetThreat),
    killProbability: asNumber(rawUtilityWeights['killProbability'], defaultUtility.defaultWeights.killProbability),
    cohesionValue: asNumber(rawUtilityWeights['cohesionValue'], defaultUtility.defaultWeights.cohesionValue),
    flankValue: asNumber(rawUtilityWeights['flankValue'], defaultUtility.defaultWeights.flankValue),
    chokepointValue: asNumber(rawUtilityWeights['chokepointValue'], defaultUtility.defaultWeights.chokepointValue),
    objectiveValue: asNumber(rawUtilityWeights['objectiveValue'], defaultUtility.defaultWeights.objectiveValue),
    victoryConditionValue: asNumber(rawUtilityWeights['victoryConditionValue'], defaultUtility.defaultWeights.victoryConditionValue),
    selfPreservation: asNumber(rawUtilityWeights['selfPreservation'], defaultUtility.defaultWeights.selfPreservation),
    allyProtection: asNumber(rawUtilityWeights['allyProtection'], defaultUtility.defaultWeights.allyProtection),
    riskAvoidance: asNumber(rawUtilityWeights['riskAvoidance'], defaultUtility.defaultWeights.riskAvoidance),
    aggression: asNumber(rawUtilityWeights['aggression'], defaultUtility.defaultWeights.aggression),
  };

  const rawUtilityActionMask = asRecord(rawUtility['actionMask']);
  const utilityScorer: UtilityScorerTuningConfig = {
    defaultWeights: utilityWeights,
    actionMask: {
      cacheMaxSize: asNumber(
        rawUtilityActionMask['cacheMaxSize'],
        defaultUtility.actionMask.cacheMaxSize,
        { min: 1, integer: true }
      ),
    },
  };

  const defaultCoordinator = DEFAULT_AI_TUNING.categoryBlocks.sideCoordinator;
  const rawCoordinator = asRecord(categoryBlocks['sideCoordinator']);
  const rawTargetCommitment = asRecord(rawCoordinator['targetCommitment']);
  const rawPressureContinuity = asRecord(rawCoordinator['pressureContinuity']);
  const rawTrace = asRecord(rawCoordinator['trace']);
  const sideCoordinator: SideCoordinatorTuningConfig = {
    targetCommitment: {
      decayPerTurn: asNumber(rawTargetCommitment['decayPerTurn'], defaultCoordinator.targetCommitment.decayPerTurn),
      maxScore: asNumber(rawTargetCommitment['maxScore'], defaultCoordinator.targetCommitment.maxScore),
      pruneThreshold: asNumber(rawTargetCommitment['pruneThreshold'], defaultCoordinator.targetCommitment.pruneThreshold),
      maxStaleTurns: asNumber(rawTargetCommitment['maxStaleTurns'], defaultCoordinator.targetCommitment.maxStaleTurns, { min: 1, integer: true }),
    },
    pressureContinuity: {
      decayPerTurn: asNumber(rawPressureContinuity['decayPerTurn'], defaultCoordinator.pressureContinuity.decayPerTurn),
      maxScore: asNumber(rawPressureContinuity['maxScore'], defaultCoordinator.pressureContinuity.maxScore),
      pruneThreshold: asNumber(rawPressureContinuity['pruneThreshold'], defaultCoordinator.pressureContinuity.pruneThreshold),
      maxStaleTurns: asNumber(rawPressureContinuity['maxStaleTurns'], defaultCoordinator.pressureContinuity.maxStaleTurns, { min: 1, integer: true }),
      signatureBreakPenalty: asNumber(rawPressureContinuity['signatureBreakPenalty'], defaultCoordinator.pressureContinuity.signatureBreakPenalty),
      signatureStableBonusStep: asNumber(rawPressureContinuity['signatureStableBonusStep'], defaultCoordinator.pressureContinuity.signatureStableBonusStep),
      signatureStableBonusMax: asNumber(rawPressureContinuity['signatureStableBonusMax'], defaultCoordinator.pressureContinuity.signatureStableBonusMax),
    },
    trace: {
      maxEntries: asNumber(rawTrace['maxEntries'], defaultCoordinator.trace.maxEntries, { min: 1, integer: true }),
    },
  };

  const defaultVpFilter = DEFAULT_AI_TUNING.categoryBlocks.actionVpFilter;
  const rawVpFilter = asRecord(categoryBlocks['actionVpFilter']);
  const rawFilters = asRecord(rawVpFilter['filters']);
  const rawScoring = asRecord(rawVpFilter['scoring']);
  const rawUrgencyMultipliers = asRecord(rawVpFilter['urgencyMultipliers']);
  const rawPassivePenaltyCoefficients = asRecord(rawVpFilter['passivePenaltyCoefficients']);
  const actionVpFilter: ActionVpFilterTuningConfig = {
    estimatedContributionByAction: mergeNumberMap(
      defaultVpFilter.estimatedContributionByAction,
      rawVpFilter['estimatedContributionByAction']
    ),
    filters: {
      desperateVpEnablingMinContribution: asNumber(
        rawFilters['desperateVpEnablingMinContribution'],
        defaultVpFilter.filters.desperateVpEnablingMinContribution
      ),
      highPassiveRejectMaxContribution: asNumber(
        rawFilters['highPassiveRejectMaxContribution'],
        defaultVpFilter.filters.highPassiveRejectMaxContribution
      ),
    },
    scoring: {
      vpEnablingUrgencyBlend: asNumber(rawScoring['vpEnablingUrgencyBlend'], defaultVpFilter.scoring.vpEnablingUrgencyBlend),
      baseVpScoreFactor: asNumber(rawScoring['baseVpScoreFactor'], defaultVpFilter.scoring.baseVpScoreFactor),
      passivePenaltyStartTurn: asNumber(rawScoring['passivePenaltyStartTurn'], defaultVpFilter.scoring.passivePenaltyStartTurn, { min: 1, integer: true }),
    },
    urgencyMultipliers: {
      desperate: asNumber(rawUrgencyMultipliers['desperate'], defaultVpFilter.urgencyMultipliers.desperate),
      high: asNumber(rawUrgencyMultipliers['high'], defaultVpFilter.urgencyMultipliers.high),
      medium: asNumber(rawUrgencyMultipliers['medium'], defaultVpFilter.urgencyMultipliers.medium),
      low: asNumber(rawUrgencyMultipliers['low'], defaultVpFilter.urgencyMultipliers.low),
    },
    passivePenaltyCoefficients: {
      desperate: asNumber(rawPassivePenaltyCoefficients['desperate'], defaultVpFilter.passivePenaltyCoefficients.desperate),
      high: asNumber(rawPassivePenaltyCoefficients['high'], defaultVpFilter.passivePenaltyCoefficients.high),
      medium: asNumber(rawPassivePenaltyCoefficients['medium'], defaultVpFilter.passivePenaltyCoefficients.medium),
      turnOffset: asNumber(rawPassivePenaltyCoefficients['turnOffset'], defaultVpFilter.passivePenaltyCoefficients.turnOffset),
    },
  };

  const defaultTurnHorizon = DEFAULT_AI_TUNING.categoryBlocks.turnHorizon;
  const rawTurnHorizon = asRecord(categoryBlocks['turnHorizon']);
  const turnHorizon: TurnHorizonTuningConfig = {
    fallbackMaxTurnsFloor: asNumber(
      rawTurnHorizon['fallbackMaxTurnsFloor'],
      defaultTurnHorizon.fallbackMaxTurnsFloor,
      { min: 1, integer: true }
    ),
    expectedSurvivalConvergenceSteps: asNumber(
      rawTurnHorizon['expectedSurvivalConvergenceSteps'],
      defaultTurnHorizon.expectedSurvivalConvergenceSteps,
      { min: 1, integer: true }
    ),
    preTriggerPressureCap: asNumber(
      rawTurnHorizon['preTriggerPressureCap'],
      defaultTurnHorizon.preTriggerPressureCap
    ),
    postTriggerPressureRange: asNumber(
      rawTurnHorizon['postTriggerPressureRange'],
      defaultTurnHorizon.postTriggerPressureRange
    ),
  };

  return Object.freeze({
    version: asNumber(root['version'], DEFAULT_AI_TUNING.version, { min: 1, integer: true }),
    categoryBlocks: {
      utilityScorer,
      sideCoordinator,
      actionVpFilter,
      turnHorizon,
    },
  });
}

export const aiTuningConfig = buildAiTuningConfig(rawAiTuning);
export const aiTuning = aiTuningConfig.categoryBlocks;
