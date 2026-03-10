import type { AIContext } from '../core/AIController';

type AIKeyScores = NonNullable<NonNullable<AIContext['scoringContext']>['myKeyScores']>;

export interface CoordinatorScoringContextLike {
  myScores: unknown;
  opponentScores: unknown;
  amILeading: boolean;
  vpMargin: number;
  winningKeys: string[];
  losingKeys: string[];
  vpDeficitPercent?: number;
  remainingVP?: number;
  currentTurn?: number;
  maxTurns?: number;
  endGameTurn?: number;
  fractionalPotentialLedger?: NonNullable<NonNullable<AIContext['scoringContext']>['fractionalPotentialLedger']>;
}

export interface CoordinatorInitiativeSignalLike {
  priority?: string;
  potentialDirective?: string;
  pressureDirective?: string;
  urgency?: number;
}

export interface CoordinatorLike {
  getScoringContext(): CoordinatorScoringContextLike | null;
  getTargetCommitments(currentTurn?: number): Record<string, number>;
  getScrumContinuity(currentTurn?: number): Record<string, number>;
  getLanePressure(currentTurn?: number): Record<string, number>;
  getInitiativeSignalForTurn?(currentTurn: number): CoordinatorInitiativeSignalLike;
}

export interface CoordinatorContextSlice {
  scoringContext?: AIContext['scoringContext'];
  targetCommitments?: Record<string, number>;
  scrumContinuity?: Record<string, number>;
  lanePressure?: Record<string, number>;
}

export interface BuildScoringContextOptions {
  normalizeKeyScores?: (scores: unknown) => AIKeyScores;
  includeFractionalPotentialLedger?: boolean;
  initiativeSignal?: CoordinatorInitiativeSignalLike;
}

export interface BuildCoordinatorContextSliceOptions extends BuildScoringContextOptions {
  coordinator?: CoordinatorLike | null;
  currentTurn?: number;
}

function defaultNormalizeKeyScores(scores: unknown): AIKeyScores {
  return (scores ?? {}) as AIKeyScores;
}

function toNonEmptyMap(
  source: Record<string, number> | null | undefined
): Record<string, number> | undefined {
  if (!source) return undefined;
  return Object.keys(source).length > 0 ? source : undefined;
}

export function buildAIScoringContext(
  scoringContext: CoordinatorScoringContextLike | null | undefined,
  options: BuildScoringContextOptions = {}
): AIContext['scoringContext'] | undefined {
  if (!scoringContext) {
    return undefined;
  }

  const normalizeKeyScores = options.normalizeKeyScores ?? defaultNormalizeKeyScores;
  const includeFractionalPotentialLedger = options.includeFractionalPotentialLedger === true;

  const snapshot: NonNullable<AIContext['scoringContext']> = {
    myKeyScores: normalizeKeyScores(scoringContext.myScores),
    opponentKeyScores: normalizeKeyScores(scoringContext.opponentScores),
    amILeading: scoringContext.amILeading,
    vpMargin: scoringContext.vpMargin,
    winningKeys: [...scoringContext.winningKeys],
    losingKeys: [...scoringContext.losingKeys],
    vpDeficitPercent: scoringContext.vpDeficitPercent,
    remainingVP: scoringContext.remainingVP,
    predictorCurrentTurn: scoringContext.currentTurn,
    predictorMaxTurns: scoringContext.maxTurns,
    predictorEndGameTurn: scoringContext.endGameTurn,
  };

  if (includeFractionalPotentialLedger && scoringContext.fractionalPotentialLedger) {
    snapshot.fractionalPotentialLedger = scoringContext.fractionalPotentialLedger;
  }

  const initiativeSignal = options.initiativeSignal;
  if (initiativeSignal) {
    snapshot.coordinatorPriority = typeof initiativeSignal.priority === 'string'
      ? initiativeSignal.priority
      : undefined;
    snapshot.coordinatorPotentialDirective = typeof initiativeSignal.potentialDirective === 'string'
      ? initiativeSignal.potentialDirective
      : undefined;
    snapshot.coordinatorPressureDirective = typeof initiativeSignal.pressureDirective === 'string'
      ? initiativeSignal.pressureDirective
      : undefined;
    snapshot.coordinatorUrgency = Number(initiativeSignal.urgency ?? 0);
  }

  return snapshot;
}

export function buildCoordinatorContextSlice(
  options: BuildCoordinatorContextSliceOptions
): CoordinatorContextSlice {
  const coordinator = options.coordinator;
  if (!coordinator) {
    return {};
  }

  const initiativeSignal = coordinator.getInitiativeSignalForTurn && typeof options.currentTurn === 'number'
    ? coordinator.getInitiativeSignalForTurn(options.currentTurn)
    : undefined;

  return {
    scoringContext: buildAIScoringContext(coordinator.getScoringContext(), {
      ...options,
      initiativeSignal,
    }),
    targetCommitments: toNonEmptyMap(coordinator.getTargetCommitments(options.currentTurn)),
    scrumContinuity: toNonEmptyMap(coordinator.getScrumContinuity(options.currentTurn)),
    lanePressure: toNonEmptyMap(coordinator.getLanePressure(options.currentTurn)),
  };
}
