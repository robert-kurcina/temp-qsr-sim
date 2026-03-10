/**
 * Side AI Coordinator
 *
 * Coordinates AI decision-making at the Side/Player level.
 * Players have "god mode" - perfect information and full coordination.
 * Characters are puppets with no autonomy - they execute Side-level strategy.
 *
 * This coordinator:
 * - Computes scoringContext ONCE per turn for the entire Side
 * - Determines strategic priorities (e.g., "losing Dominance, contest zones!")
 * - Distributes strategic context to all CharacterAI instances on this Side
 * - All characters on same Side make coherent strategic choices
 */

import {
  ScoringContext,
  buildScoringContext,
  getScoringAdvice,
  MissionVPConfig,
  FractionalPotentialLedgerSnapshot,
  FractionalPotentialLedgerKeySnapshot,
} from '../stratagems/PredictedScoringIntegration';
import { TacticalDoctrine } from '../stratagems/AIStratagems';
import { calculateSuddenDeathTimePressure } from './TurnHorizon';
import { aiTuning } from '../config/AITuningConfig';

export interface TargetCommitment {
  /** Aggregate pressure this side has committed to this target */
  score: number;
  /** Models that recently committed attacks to this target */
  attackerIds: string[];
  /** Last turn this entry was updated */
  lastUpdatedTurn: number;
}

export interface CoordinatorPressureContinuity {
  /** Aggregate pressure continuity score */
  score: number;
  /** Models contributing to continuity pressure */
  attackerIds: string[];
  /** Last turn this entry was updated */
  lastUpdatedTurn: number;
  /** Topology signature for continuity channel (scrum lane / ranged lane state) */
  topologySignature?: string;
  /** Count of consecutive updates under the same topology signature */
  signatureStableUpdates?: number;
  /** Count of observed topology signature breaks */
  signatureBreaks?: number;
}

export interface CoordinatorPressureContinuityChannelStats {
  updates: number;
  signatureSamples: number;
  signatureMatches: number;
  signatureBreaks: number;
}

export interface CoordinatorPressureContinuityStats {
  scrum: CoordinatorPressureContinuityChannelStats;
  lane: CoordinatorPressureContinuityChannelStats;
}

export interface CoordinatorPressureContinuityChannelDiagnostics {
  updates: number;
  signatureSamples: number;
  signatureMatches: number;
  signatureBreaks: number;
  missingSignatureUpdates: number;
  signatureCoverageRate: number;
  breakRate: number;
  matchRate: number;
}

export interface CoordinatorPressureContinuityDiagnostics {
  scrum: CoordinatorPressureContinuityChannelDiagnostics;
  lane: CoordinatorPressureContinuityChannelDiagnostics;
  combined: CoordinatorPressureContinuityChannelDiagnostics;
}

export type CoordinatorDirectivePriority =
  | 'press_advantage'
  | 'recover_deficit'
  | 'contest_keys'
  | 'stabilize'
  | 'neutral';

export type CoordinatorPotentialDirective =
  | 'expand_potential'
  | 'deny_opponent_potential'
  | 'protect_current_lead'
  | 'balanced_potential';

export interface CoordinatorDecisionTraceEntry {
  turn: number;
  sideId: string;
  doctrine: TacticalDoctrine;
  observations: {
    amILeading: boolean;
    vpMargin: number;
    winningKeys: string[];
    losingKeys: string[];
    topOpponentKeyPressure: Array<{
      key: string;
      predicted: number;
      confidence: number;
    }>;
    topTargetCommitments: Array<{
      targetId: string;
      score: number;
      attackerCount: number;
    }>;
    topScrumContinuity: Array<{
      targetId: string;
      score: number;
      attackerCount: number;
    }>;
    topLanePressure: Array<{
      targetId: string;
      score: number;
      attackerCount: number;
    }>;
    fractionalPotential?: {
      myVpPotential: number;
      opponentVpPotential: number;
      myDeniedPotential?: number;
      opponentDeniedPotential?: number;
      potentialDelta: number;
      urgency: number;
    };
  };
  response: {
    priority: CoordinatorDirectivePriority;
    advice: string[];
    focusTargets: string[];
    potentialDirective?: CoordinatorPotentialDirective;
    pressureDirective?: 'maintain_scrum_pressure' | 'maintain_lane_pressure' | 'mixed_pressure' | 'no_pressure_lock';
  };
}

export interface CoordinatorInitiativeSignal {
  sideId: string;
  turn: number;
  amILeading: boolean;
  vpMargin: number;
  priority: string;
  potentialDirective?: string;
  pressureDirective?: string;
  urgency: number;
}

export interface CoordinatorInitiativeSpendDecision {
  shouldSpend: boolean;
  reason: string;
}

export interface CoordinatorForceInitiativeContext {
  currentTurn: number;
  endGameTurn: number;
  availableIp: number;
  readyIndex: number;
  scoreGain: number;
  candidateNearestEnemyDistance: number | null;
  candidateCanPush: boolean;
}

export interface CoordinatorMaintainInitiativeContext {
  currentTurn: number;
  endGameTurn: number;
  availableIp: number;
  candidateOpportunity: boolean;
  candidateCanPush: boolean;
  actorGeneratedMomentum: boolean;
}

export interface CoordinatorRefreshInitiativeContext {
  currentTurn: number;
  endGameTurn: number;
  availableIp: number;
  delayTokens: number;
  apPerActivation: number;
  hasMomentumOpportunity: boolean;
  canUnlockPushingMomentum: boolean;
  trailingOnScore: boolean;
}

/**
 * Side-level AI state
 */
export interface SideAIState {
  /** Side identifier */
  sideId: string;
  /** Tactical doctrine for this Side */
  tacticalDoctrine: TacticalDoctrine;
  /** Current scoring context (computed once per turn) */
  scoringContext: ScoringContext | null;
  /** Side-level target focus commitments (supports coordinated focus fire) */
  targetCommitments: Record<string, TargetCommitment>;
  /** Side-level scrum continuity by target model */
  scrumContinuity: Record<string, CoordinatorPressureContinuity>;
  /** Side-level ranged pressure continuity by target model */
  lanePressure: Record<string, CoordinatorPressureContinuity>;
  /** Aggregate continuity counters for break-rate diagnostics */
  pressureContinuityStats: CoordinatorPressureContinuityStats;
  /** High-level per-turn observation/response trace for coordinator reasoning */
  decisionTrace: CoordinatorDecisionTraceEntry[];
  /** Monotonic fractional potential ledger across turns */
  fractionalPotentialLedger: FractionalPotentialLedgerState;
  /** Turn last updated */
  lastUpdatedTurn: number;
}

interface FractionalPotentialLedgerEntry extends FractionalPotentialLedgerKeySnapshot {
  lastMyRawPotential: number;
  lastOpponentRawPotential: number;
}

interface FractionalPotentialLedgerState {
  keyProgress: Record<string, FractionalPotentialLedgerEntry>;
  myTotalPotential: number;
  opponentTotalPotential: number;
  myDeniedPotential: number;
  opponentDeniedPotential: number;
  potentialDelta: number;
  lastUpdatedTurn: number;
}

const TARGET_COMMITMENT_DECAY_PER_TURN = aiTuning.sideCoordinator.targetCommitment.decayPerTurn;
const TARGET_COMMITMENT_MAX_SCORE = aiTuning.sideCoordinator.targetCommitment.maxScore;
const TARGET_COMMITMENT_PRUNE_THRESHOLD = aiTuning.sideCoordinator.targetCommitment.pruneThreshold;
const TARGET_COMMITMENT_MAX_STALE_TURNS = aiTuning.sideCoordinator.targetCommitment.maxStaleTurns;
const PRESSURE_CONTINUITY_DECAY_PER_TURN = aiTuning.sideCoordinator.pressureContinuity.decayPerTurn;
const PRESSURE_CONTINUITY_MAX_SCORE = aiTuning.sideCoordinator.pressureContinuity.maxScore;
const PRESSURE_CONTINUITY_PRUNE_THRESHOLD = aiTuning.sideCoordinator.pressureContinuity.pruneThreshold;
const PRESSURE_CONTINUITY_MAX_STALE_TURNS = aiTuning.sideCoordinator.pressureContinuity.maxStaleTurns;
const PRESSURE_SIGNATURE_BREAK_PENALTY = aiTuning.sideCoordinator.pressureContinuity.signatureBreakPenalty;
const PRESSURE_SIGNATURE_STABLE_BONUS_STEP = aiTuning.sideCoordinator.pressureContinuity.signatureStableBonusStep;
const PRESSURE_SIGNATURE_STABLE_BONUS_MAX = aiTuning.sideCoordinator.pressureContinuity.signatureStableBonusMax;
const COORDINATOR_TRACE_MAX_ENTRIES = aiTuning.sideCoordinator.trace.maxEntries;

/**
 * Side AI Coordinator - manages AI for one Side/Player
 */
export class SideAICoordinator {
  private state: SideAIState;

  constructor(sideId: string, tacticalDoctrine: TacticalDoctrine = TacticalDoctrine.Operative) {
    this.state = {
      sideId,
      tacticalDoctrine,
      scoringContext: null,
      targetCommitments: {},
      scrumContinuity: {},
      lanePressure: {},
      pressureContinuityStats: this.createEmptyPressureContinuityStats(),
      decisionTrace: [],
      fractionalPotentialLedger: this.createEmptyFractionalPotentialLedger(),
      lastUpdatedTurn: 0,
    };
  }

  /**
   * Get side identifier
   */
  getSideId(): string {
    return this.state.sideId;
  }

  /**
   * Get tactical doctrine for this Side
   */
  getTacticalDoctrine(): TacticalDoctrine {
    return this.state.tacticalDoctrine;
  }

  /**
   * Update tactical doctrine
   */
  setTacticalDoctrine(doctrine: TacticalDoctrine): void {
    this.state.tacticalDoctrine = doctrine;
  }

  /**
   * Compute scoring context for this Side
   * Called once per turn at start of Side's activation
   */
  updateScoringContext(
    myKeyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>,
    opponentKeyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>,
    currentTurn: number,
    missionConfig: MissionVPConfig
  ): ScoringContext {
    this.decayTargetCommitments(currentTurn);
    this.decayPressureContinuity(this.state.scrumContinuity, currentTurn);
    this.decayPressureContinuity(this.state.lanePressure, currentTurn);
    const context = buildScoringContext(myKeyScores, opponentKeyScores, missionConfig);
    const potentialLedger = this.updateFractionalPotentialLedger(
      myKeyScores,
      opponentKeyScores,
      currentTurn
    );
    context.fractionalPotentialLedger = potentialLedger;
    this.state.scoringContext = context;
    this.state.lastUpdatedTurn = currentTurn;
    this.recordDecisionTrace(currentTurn, context);
    return context;
  }

  /**
   * Record side-level commitment against a target.
   * Higher commitment increases downstream focus-fire utility scoring.
   */
  recordTargetCommitment(
    targetId: string,
    attackerId: string,
    currentTurn: number,
    weight: number = 1,
    actionType?: string,
    topologySignature?: string
  ): void {
    if (!targetId || !Number.isFinite(weight) || weight <= 0) {
      return;
    }

    this.decayTargetCommitments(currentTurn);
    const existing = this.state.targetCommitments[targetId];
    if (!existing) {
      this.state.targetCommitments[targetId] = {
        score: Math.min(TARGET_COMMITMENT_MAX_SCORE, weight),
        attackerIds: attackerId ? [attackerId] : [],
        lastUpdatedTurn: currentTurn,
      };
      this.recordPressureContinuity(targetId, attackerId, currentTurn, weight, actionType, topologySignature);
      return;
    }

    const attackerAlreadyCommitted = attackerId ? existing.attackerIds.includes(attackerId) : true;
    const uniqueAttackerBonus = attackerAlreadyCommitted ? 0 : 0.2;
    existing.score = Math.min(
      TARGET_COMMITMENT_MAX_SCORE,
      existing.score + weight + uniqueAttackerBonus
    );
    if (attackerId && !attackerAlreadyCommitted) {
      existing.attackerIds.push(attackerId);
    }
    existing.lastUpdatedTurn = currentTurn;

    this.recordPressureContinuity(targetId, attackerId, currentTurn, weight, actionType, topologySignature);
  }

  /**
   * Clear commitment for a target when it is out-of-play.
   */
  clearTargetCommitment(targetId: string): void {
    if (!targetId) return;
    delete this.state.targetCommitments[targetId];
    delete this.state.scrumContinuity[targetId];
    delete this.state.lanePressure[targetId];
  }

  /**
   * Get decayed commitment scores for current turn.
   */
  getTargetCommitments(currentTurn?: number): Record<string, number> {
    if (typeof currentTurn === 'number') {
      this.decayTargetCommitments(currentTurn);
    }

    const commitments: Record<string, number> = {};
    for (const [targetId, entry] of Object.entries(this.state.targetCommitments)) {
      commitments[targetId] = Number(entry.score.toFixed(4));
    }
    return commitments;
  }

  /**
   * Get decayed scrum continuity pressure scores for current turn.
   */
  getScrumContinuity(currentTurn?: number): Record<string, number> {
    if (typeof currentTurn === 'number') {
      this.decayPressureContinuity(this.state.scrumContinuity, currentTurn);
    }
    return this.toRoundedScoreMap(this.state.scrumContinuity);
  }

  /**
   * Get decayed lane pressure scores for current turn.
   */
  getLanePressure(currentTurn?: number): Record<string, number> {
    if (typeof currentTurn === 'number') {
      this.decayPressureContinuity(this.state.lanePressure, currentTurn);
    }
    return this.toRoundedScoreMap(this.state.lanePressure);
  }

  /**
   * Get aggregated pressure continuity diagnostics (including topology break rates).
   */
  getPressureContinuityDiagnostics(): CoordinatorPressureContinuityDiagnostics {
    const scrum = this.buildPressureChannelDiagnostics(this.state.pressureContinuityStats.scrum);
    const lane = this.buildPressureChannelDiagnostics(this.state.pressureContinuityStats.lane);
    const combined = this.buildPressureChannelDiagnostics({
      updates: scrum.updates + lane.updates,
      signatureSamples: scrum.signatureSamples + lane.signatureSamples,
      signatureMatches: scrum.signatureMatches + lane.signatureMatches,
      signatureBreaks: scrum.signatureBreaks + lane.signatureBreaks,
    });
    return { scrum, lane, combined };
  }

  /**
   * Get current scoring context
   * CharacterAI instances call this to get strategic context
   */
  getScoringContext(): ScoringContext | null {
    return this.state.scoringContext;
  }

  /**
   * Get strategic advice for this Side
   * Useful for debug/logging
   */
  getStrategicAdvice(): string[] {
    if (!this.state.scoringContext) {
      return ['No scoring context available'];
    }
    return getScoringAdvice(this.state.scoringContext);
  }

  /**
   * Get a bounded trace of high-level coordinator observation/response decisions.
   */
  getDecisionTrace(limit: number = COORDINATOR_TRACE_MAX_ENTRIES): CoordinatorDecisionTraceEntry[] {
    const boundedLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(Math.floor(limit), COORDINATOR_TRACE_MAX_ENTRIES))
      : COORDINATOR_TRACE_MAX_ENTRIES;
    return this.cloneDecisionTrace(this.state.decisionTrace.slice(-boundedLimit));
  }

  /**
   * Get coordinator guidance signal for turn-level initiative spending policy.
   */
  getInitiativeSignalForTurn(currentTurn: number): CoordinatorInitiativeSignal {
    const traceForTurn = this.state.decisionTrace
      .filter(entry => entry.turn === currentTurn)
      .at(-1);
    if (traceForTurn) {
      return {
        sideId: this.state.sideId,
        turn: currentTurn,
        amILeading: traceForTurn.observations.amILeading,
        vpMargin: traceForTurn.observations.vpMargin,
        priority: traceForTurn.response.priority,
        potentialDirective: traceForTurn.response.potentialDirective,
        pressureDirective: traceForTurn.response.pressureDirective,
        urgency: Number(traceForTurn.observations.fractionalPotential?.urgency ?? 0),
      };
    }

    const context = this.state.scoringContext;
    if (context && this.state.lastUpdatedTurn === currentTurn) {
      const potentialSnapshot = this.buildFractionalPotentialSnapshot(context);
      return {
        sideId: this.state.sideId,
        turn: currentTurn,
        amILeading: context.amILeading,
        vpMargin: context.vpMargin,
        priority: this.classifyPriority(context),
        potentialDirective: this.classifyPotentialDirective(context, potentialSnapshot),
        pressureDirective: this.classifyPressureDirective(
          this.getTopPressureTargets(this.state.scrumContinuity, 3),
          this.getTopPressureTargets(this.state.lanePressure, 3)
        ),
        urgency: potentialSnapshot.urgency,
      };
    }

    return {
      sideId: this.state.sideId,
      turn: currentTurn,
      amILeading: context?.amILeading ?? false,
      vpMargin: context?.vpMargin ?? 0,
      priority: 'neutral',
      potentialDirective: undefined,
      pressureDirective: undefined,
      urgency: 0,
    };
  }

  /**
   * Decide whether side should spend IP to force initiative reordering.
   */
  recommendForceInitiativeSpend(
    context: CoordinatorForceInitiativeContext
  ): CoordinatorInitiativeSpendDecision {
    if (context.availableIp < 1) {
      return { shouldSpend: false, reason: 'no_ip' };
    }
    if (context.readyIndex < 1) {
      return { shouldSpend: false, reason: 'already_front' };
    }

    const signal = this.getInitiativeSignalForTurn(context.currentTurn);
    const urgent = this.isInitiativeSignalUrgent(signal);
    const defensive = this.isInitiativeSignalDefensive(signal);
    const nearEndgame = context.currentTurn >= Math.max(1, context.endGameTurn - 1);
    const canReachFront = context.availableIp >= context.readyIndex;
    const scoreGainThreshold = urgent ? 20 : (defensive ? 40 : 30);
    const leapThreshold = urgent ? 45 : (defensive ? 75 : 60);

    if (context.candidateCanPush && context.candidateNearestEnemyDistance !== null && context.candidateNearestEnemyDistance <= 10) {
      const pushingThreshold = urgent ? 10 : (defensive ? 24 : 18);
      if (context.scoreGain >= pushingThreshold) {
        return {
          shouldSpend: true,
          reason: urgent ? 'coordinator_pushing_window' : 'pushing_window',
        };
      }
    }

    if (
      context.scoreGain < scoreGainThreshold
      && !(nearEndgame && context.scoreGain >= Math.max(15, scoreGainThreshold - 10))
    ) {
      return { shouldSpend: false, reason: 'no_opportunity' };
    }
    if (!canReachFront && context.scoreGain < leapThreshold) {
      return { shouldSpend: false, reason: 'no_leap_value' };
    }
    if (defensive && context.availableIp === 1 && !nearEndgame && !context.candidateCanPush) {
      return { shouldSpend: false, reason: 'defensive_reserve' };
    }
    if (context.candidateNearestEnemyDistance !== null && context.candidateNearestEnemyDistance <= 8) {
      return {
        shouldSpend: true,
        reason: urgent ? 'coordinator_opportunity_window' : 'opportunity_window',
      };
    }
    if (nearEndgame) {
      return {
        shouldSpend: true,
        reason: urgent ? 'coordinator_endgame_reorder' : 'endgame_reorder',
      };
    }
    return {
      shouldSpend: true,
      reason: urgent ? 'coordinator_score_uplift' : 'score_uplift',
    };
  }

  /**
   * Decide whether side should spend IP to maintain initiative chain.
   */
  recommendMaintainInitiativeSpend(
    context: CoordinatorMaintainInitiativeContext
  ): CoordinatorInitiativeSpendDecision {
    if (context.availableIp < 1) {
      return { shouldSpend: false, reason: 'no_ip' };
    }

    const signal = this.getInitiativeSignalForTurn(context.currentTurn);
    const urgent = this.isInitiativeSignalUrgent(signal);
    const defensive = this.isInitiativeSignalDefensive(signal);
    const nearEndgame = context.currentTurn >= Math.max(1, context.endGameTurn - 1);

    if (context.candidateCanPush && context.candidateOpportunity && context.actorGeneratedMomentum) {
      return {
        shouldSpend: true,
        reason: urgent ? 'coordinator_chain_pushing_momentum' : 'chain_pushing_momentum',
      };
    }

    if (context.candidateOpportunity) {
      if (defensive && context.availableIp === 1 && !nearEndgame && !context.candidateCanPush) {
        return { shouldSpend: false, reason: 'defensive_reserve' };
      }
      return {
        shouldSpend: true,
        reason: urgent ? 'coordinator_opportunity_window' : 'opportunity_window',
      };
    }

    if (context.actorGeneratedMomentum && (context.availableIp >= 2 || urgent)) {
      if (context.candidateCanPush) {
        return {
          shouldSpend: true,
          reason: urgent ? 'coordinator_chain_pushing_momentum' : 'chain_pushing_momentum',
        };
      }
      return {
        shouldSpend: true,
        reason: urgent ? 'coordinator_chain_momentum' : 'chain_momentum',
      };
    }
    if (nearEndgame && context.actorGeneratedMomentum) {
      return {
        shouldSpend: true,
        reason: urgent ? 'coordinator_endgame_chain' : 'endgame_chain',
      };
    }
    return { shouldSpend: false, reason: 'no_opportunity' };
  }

  /**
   * Decide whether side should spend IP to refresh delay on current actor.
   */
  recommendRefreshInitiativeSpend(
    context: CoordinatorRefreshInitiativeContext
  ): CoordinatorInitiativeSpendDecision {
    if (context.availableIp < 1) {
      return { shouldSpend: false, reason: 'no_ip' };
    }
    if (context.delayTokens <= 0) {
      return { shouldSpend: false, reason: 'no_delay' };
    }

    const signal = this.getInitiativeSignalForTurn(context.currentTurn);
    const urgent = this.isInitiativeSignalUrgent(signal);
    const nearEndgame = context.currentTurn >= Math.max(1, context.endGameTurn - 1);

    if (context.delayTokens >= context.apPerActivation) {
      return { shouldSpend: true, reason: 'activation_unlocked' };
    }
    if (context.canUnlockPushingMomentum) {
      return {
        shouldSpend: true,
        reason: urgent ? 'coordinator_unlock_pushing_momentum' : 'unlock_pushing_momentum',
      };
    }
    if (context.delayTokens >= 2) {
      return { shouldSpend: true, reason: 'high_delay_stack' };
    }
    if (context.hasMomentumOpportunity && context.delayTokens >= 1) {
      return {
        shouldSpend: true,
        reason: urgent ? 'coordinator_momentum_window' : 'momentum_window',
      };
    }
    if (context.trailingOnScore && nearEndgame) {
      return {
        shouldSpend: true,
        reason: urgent ? 'coordinator_score_pressure' : 'score_pressure',
      };
    }
    if (urgent && context.delayTokens > 0 && context.hasMomentumOpportunity) {
      return { shouldSpend: true, reason: 'coordinator_tempo_pressure' };
    }
    return { shouldSpend: false, reason: 'no_opportunity' };
  }

  /**
   * Check if scoring context is stale (older than 1 turn)
   */
  isContextStale(currentTurn: number): boolean {
    return currentTurn - this.state.lastUpdatedTurn > 1;
  }

  /**
   * Reset state for new game
   */
  reset(): void {
    this.state.scoringContext = null;
    this.state.targetCommitments = {};
    this.state.scrumContinuity = {};
    this.state.lanePressure = {};
    this.state.pressureContinuityStats = this.createEmptyPressureContinuityStats();
    this.state.decisionTrace = [];
    this.state.fractionalPotentialLedger = this.createEmptyFractionalPotentialLedger();
    this.state.lastUpdatedTurn = -1;
  }

  /**
   * Export state for serialization
   */
  exportState(): SideAIState {
    return {
      ...this.state,
      targetCommitments: this.cloneTargetCommitments(this.state.targetCommitments),
      scrumContinuity: this.clonePressureContinuity(this.state.scrumContinuity),
      lanePressure: this.clonePressureContinuity(this.state.lanePressure),
      pressureContinuityStats: this.clonePressureContinuityStats(this.state.pressureContinuityStats),
      decisionTrace: this.cloneDecisionTrace(this.state.decisionTrace),
      fractionalPotentialLedger: this.cloneFractionalPotentialLedger(this.state.fractionalPotentialLedger),
    };
  }

  /**
   * Import state from serialization
   */
  importState(state: SideAIState): void {
    this.state = {
      ...state,
      targetCommitments: this.cloneTargetCommitments(state.targetCommitments ?? {}),
      scrumContinuity: this.clonePressureContinuity(state.scrumContinuity ?? {}),
      lanePressure: this.clonePressureContinuity(state.lanePressure ?? {}),
      pressureContinuityStats: this.clonePressureContinuityStats(
        state.pressureContinuityStats ?? this.createEmptyPressureContinuityStats()
      ),
      decisionTrace: this.cloneDecisionTrace(state.decisionTrace ?? []),
      fractionalPotentialLedger: this.cloneFractionalPotentialLedger(
        state.fractionalPotentialLedger ?? this.createEmptyFractionalPotentialLedger()
      ),
    };
  }

  private recordDecisionTrace(currentTurn: number, context: ScoringContext): void {
    const advice = getScoringAdvice(context);
    const topCommitments = this.getTopCommittedTargets(3);
    const topScrumPressure = this.getTopPressureTargets(this.state.scrumContinuity, 3);
    const topLanePressure = this.getTopPressureTargets(this.state.lanePressure, 3);
    const fractionalPotential = this.buildFractionalPotentialSnapshot(context);
    const trace: CoordinatorDecisionTraceEntry = {
      turn: currentTurn,
      sideId: this.state.sideId,
      doctrine: this.state.tacticalDoctrine,
      observations: {
        amILeading: context.amILeading,
        vpMargin: context.vpMargin,
        winningKeys: [...context.winningKeys],
        losingKeys: [...context.losingKeys],
        topOpponentKeyPressure: this.buildTopKeyPressure(context.opponentScores, 3),
        topTargetCommitments: topCommitments.map(entry => ({
          targetId: entry.targetId,
          score: Number(entry.score.toFixed(4)),
          attackerCount: entry.attackerCount,
        })),
        topScrumContinuity: topScrumPressure.map(entry => ({
          targetId: entry.targetId,
          score: Number(entry.score.toFixed(4)),
          attackerCount: entry.attackerCount,
        })),
        topLanePressure: topLanePressure.map(entry => ({
          targetId: entry.targetId,
          score: Number(entry.score.toFixed(4)),
          attackerCount: entry.attackerCount,
        })),
        fractionalPotential,
      },
      response: {
        priority: this.classifyPriority(context),
        advice,
        focusTargets: topCommitments.map(entry => entry.targetId),
        potentialDirective: this.classifyPotentialDirective(context, fractionalPotential),
        pressureDirective: this.classifyPressureDirective(topScrumPressure, topLanePressure),
      },
    };
    const lastIndex = this.state.decisionTrace.length - 1;
    if (lastIndex >= 0 && this.state.decisionTrace[lastIndex].turn === currentTurn) {
      this.state.decisionTrace[lastIndex] = trace;
      return;
    }

    this.state.decisionTrace.push(trace);
    if (this.state.decisionTrace.length > COORDINATOR_TRACE_MAX_ENTRIES) {
      const overflow = this.state.decisionTrace.length - COORDINATOR_TRACE_MAX_ENTRIES;
      this.state.decisionTrace.splice(0, overflow);
    }
  }

  private isInitiativeSignalUrgent(signal: CoordinatorInitiativeSignal): boolean {
    if (signal.priority === 'recover_deficit' || signal.priority === 'contest_keys') {
      return true;
    }
    if (signal.potentialDirective === 'expand_potential' || signal.potentialDirective === 'deny_opponent_potential') {
      return true;
    }
    return signal.urgency >= 1.15;
  }

  private isInitiativeSignalDefensive(signal: CoordinatorInitiativeSignal): boolean {
    if (signal.potentialDirective === 'protect_current_lead') {
      return true;
    }
    return signal.priority === 'press_advantage' && signal.amILeading && signal.vpMargin >= 2;
  }

  private classifyPriority(context: ScoringContext): CoordinatorDirectivePriority {
    if (context.vpMargin >= 2) {
      return 'press_advantage';
    }
    if (context.vpMargin <= -2) {
      return 'recover_deficit';
    }
    if (context.losingKeys.length > 0) {
      return 'contest_keys';
    }
    if (context.amILeading) {
      return 'stabilize';
    }
    return 'neutral';
  }

  private classifyPotentialDirective(
    context: ScoringContext,
    snapshot: NonNullable<CoordinatorDecisionTraceEntry['observations']['fractionalPotential']>
  ): CoordinatorPotentialDirective {
    if (context.amILeading && context.vpMargin >= 2 && snapshot.potentialDelta >= 0) {
      return 'protect_current_lead';
    }
    if (snapshot.potentialDelta < 0 || snapshot.opponentVpPotential > snapshot.myVpPotential) {
      return 'deny_opponent_potential';
    }
    if (!context.amILeading || context.vpMargin <= 0) {
      return 'expand_potential';
    }
    return 'balanced_potential';
  }

  private classifyPressureDirective(
    scrum: Array<{ targetId: string; score: number; attackerCount: number }>,
    lane: Array<{ targetId: string; score: number; attackerCount: number }>
  ): NonNullable<CoordinatorDecisionTraceEntry['response']['pressureDirective']> {
    const scrumPeak = scrum[0]?.score ?? 0;
    const lanePeak = lane[0]?.score ?? 0;
    if (scrumPeak <= 0 && lanePeak <= 0) {
      return 'no_pressure_lock';
    }
    if (scrumPeak > lanePeak * 1.2) {
      return 'maintain_scrum_pressure';
    }
    if (lanePeak > scrumPeak * 1.2) {
      return 'maintain_lane_pressure';
    }
    return 'mixed_pressure';
  }

  private buildFractionalPotentialSnapshot(
    context: ScoringContext
  ): NonNullable<CoordinatorDecisionTraceEntry['observations']['fractionalPotential']> {
    const ledger = context.fractionalPotentialLedger;
    const myVpPotential = ledger
      ? ledger.myTotalPotential
      : this.estimateFractionalKeyPotential(context.myScores);
    const opponentVpPotential = ledger
      ? ledger.opponentTotalPotential
      : this.estimateFractionalKeyPotential(context.opponentScores);
    const myDeniedPotential = ledger?.myDeniedPotential ?? 0;
    const opponentDeniedPotential = ledger?.opponentDeniedPotential ?? 0;
    const potentialDelta = ledger
      ? ledger.potentialDelta
      : (myVpPotential - opponentVpPotential);
    const maxTurns = Math.max(1, Number(context.maxTurns ?? context.currentTurn ?? 1));
    const timePressure = calculateSuddenDeathTimePressure(
      Number(context.currentTurn ?? 1),
      maxTurns,
      Number.isFinite(context.endGameTurn) ? Number(context.endGameTurn) : undefined
    );
    const urgency = this.clamp(
      1 +
      (Math.max(0, -context.vpMargin) * 0.3) +
      (Math.max(0, -potentialDelta) * 0.25) +
      (timePressure * 0.2),
      0.6,
      3
    );
    return {
      myVpPotential: Number(myVpPotential.toFixed(4)),
      opponentVpPotential: Number(opponentVpPotential.toFixed(4)),
      myDeniedPotential: Number(myDeniedPotential.toFixed(4)),
      opponentDeniedPotential: Number(opponentDeniedPotential.toFixed(4)),
      potentialDelta: Number(potentialDelta.toFixed(4)),
      urgency: Number(urgency.toFixed(4)),
    };
  }

  private estimateFractionalKeyPotential(
    keyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number } | undefined>
  ): number {
    let total = 0;
    for (const score of Object.values(keyScores)) {
      if (!score) continue;
      const current = Number.isFinite(score.current) ? score.current : 0;
      const predicted = Number.isFinite(score.predicted) ? score.predicted : current;
      const confidence = this.clamp(Number.isFinite(score.confidence) ? score.confidence : 0.5, 0, 1);
      const gain = Math.max(0, predicted - current);
      const contestedBoost = score.leadMargin < 0 ? 1.1 : 1;
      total += gain * (0.35 + (confidence * 0.65)) * contestedBoost;
    }
    return total;
  }

  private updateFractionalPotentialLedger(
    myKeyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>,
    opponentKeyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>,
    currentTurn: number
  ): FractionalPotentialLedgerSnapshot {
    const keySet = new Set<string>([
      ...Object.keys(this.state.fractionalPotentialLedger.keyProgress),
      ...Object.keys(myKeyScores ?? {}),
      ...Object.keys(opponentKeyScores ?? {}),
    ]);

    for (const key of keySet) {
      const myScore = myKeyScores?.[key];
      const opponentScore = opponentKeyScores?.[key];
      const myRawPotential = this.estimateSingleKeyFractionalPotential(myScore);
      const opponentRawPotential = this.estimateSingleKeyFractionalPotential(opponentScore);
      const myConfidence = this.clamp(
        Number.isFinite(myScore?.confidence) ? Number(myScore?.confidence) : 0.5,
        0,
        1
      );
      const opponentConfidence = this.clamp(
        Number.isFinite(opponentScore?.confidence) ? Number(opponentScore?.confidence) : 0.5,
        0,
        1
      );

      const existing = this.state.fractionalPotentialLedger.keyProgress[key];
      if (!existing) {
        this.state.fractionalPotentialLedger.keyProgress[key] = {
          myProgress: myRawPotential,
          opponentProgress: opponentRawPotential,
          myDeniedPotential: 0,
          opponentDeniedPotential: 0,
          myConfidence,
          opponentConfidence,
          lastUpdatedTurn: currentTurn,
          lastMyRawPotential: myRawPotential,
          lastOpponentRawPotential: opponentRawPotential,
        };
        continue;
      }

      const myDrop = Math.max(0, existing.lastMyRawPotential - myRawPotential);
      const opponentDrop = Math.max(0, existing.lastOpponentRawPotential - opponentRawPotential);
      existing.myDeniedPotential += opponentDrop;
      existing.opponentDeniedPotential += myDrop;
      existing.myProgress = Math.max(existing.myProgress, myRawPotential);
      existing.opponentProgress = Math.max(existing.opponentProgress, opponentRawPotential);
      existing.myConfidence = this.clamp(
        (existing.myConfidence * 0.65) + (myConfidence * 0.35),
        0,
        1
      );
      existing.opponentConfidence = this.clamp(
        (existing.opponentConfidence * 0.65) + (opponentConfidence * 0.35),
        0,
        1
      );
      existing.lastMyRawPotential = myRawPotential;
      existing.lastOpponentRawPotential = opponentRawPotential;
      existing.lastUpdatedTurn = currentTurn;
    }

    let myTotalPotential = 0;
    let opponentTotalPotential = 0;
    let myDeniedPotential = 0;
    let opponentDeniedPotential = 0;
    for (const entry of Object.values(this.state.fractionalPotentialLedger.keyProgress)) {
      myTotalPotential += Math.max(0, entry.myProgress);
      opponentTotalPotential += Math.max(0, entry.opponentProgress);
      myDeniedPotential += Math.max(0, entry.myDeniedPotential);
      opponentDeniedPotential += Math.max(0, entry.opponentDeniedPotential);
    }

    const potentialDelta =
      (myTotalPotential - opponentTotalPotential) +
      (myDeniedPotential - opponentDeniedPotential);
    this.state.fractionalPotentialLedger.myTotalPotential = Number(myTotalPotential.toFixed(4));
    this.state.fractionalPotentialLedger.opponentTotalPotential = Number(opponentTotalPotential.toFixed(4));
    this.state.fractionalPotentialLedger.myDeniedPotential = Number(myDeniedPotential.toFixed(4));
    this.state.fractionalPotentialLedger.opponentDeniedPotential = Number(opponentDeniedPotential.toFixed(4));
    this.state.fractionalPotentialLedger.potentialDelta = Number(potentialDelta.toFixed(4));
    this.state.fractionalPotentialLedger.lastUpdatedTurn = currentTurn;

    return this.toFractionalPotentialLedgerSnapshot(this.state.fractionalPotentialLedger);
  }

  private estimateSingleKeyFractionalPotential(
    score: { current: number; predicted: number; confidence: number; leadMargin: number } | undefined
  ): number {
    if (!score) return 0;
    const current = Number.isFinite(score.current) ? score.current : 0;
    const predicted = Number.isFinite(score.predicted) ? score.predicted : current;
    const confidence = this.clamp(Number.isFinite(score.confidence) ? score.confidence : 0.5, 0, 1);
    const gain = Math.max(0, predicted - current);
    const contestedBoost = score.leadMargin < 0 ? 1.1 : 1;
    return Number((gain * (0.35 + (confidence * 0.65)) * contestedBoost).toFixed(4));
  }

  private createEmptyFractionalPotentialLedger(): FractionalPotentialLedgerState {
    return {
      keyProgress: {},
      myTotalPotential: 0,
      opponentTotalPotential: 0,
      myDeniedPotential: 0,
      opponentDeniedPotential: 0,
      potentialDelta: 0,
      lastUpdatedTurn: 0,
    };
  }

  private toFractionalPotentialLedgerSnapshot(
    ledger: FractionalPotentialLedgerState
  ): FractionalPotentialLedgerSnapshot {
    const keyProgress: Record<string, FractionalPotentialLedgerKeySnapshot> = {};
    for (const [key, entry] of Object.entries(ledger.keyProgress)) {
      keyProgress[key] = {
        myProgress: Number(entry.myProgress.toFixed(4)),
        opponentProgress: Number(entry.opponentProgress.toFixed(4)),
        myDeniedPotential: Number(entry.myDeniedPotential.toFixed(4)),
        opponentDeniedPotential: Number(entry.opponentDeniedPotential.toFixed(4)),
        myConfidence: Number(entry.myConfidence.toFixed(4)),
        opponentConfidence: Number(entry.opponentConfidence.toFixed(4)),
        lastUpdatedTurn: entry.lastUpdatedTurn,
      };
    }
    return {
      myTotalPotential: Number(ledger.myTotalPotential.toFixed(4)),
      opponentTotalPotential: Number(ledger.opponentTotalPotential.toFixed(4)),
      myDeniedPotential: Number(ledger.myDeniedPotential.toFixed(4)),
      opponentDeniedPotential: Number(ledger.opponentDeniedPotential.toFixed(4)),
      potentialDelta: Number(ledger.potentialDelta.toFixed(4)),
      keyProgress,
      lastUpdatedTurn: ledger.lastUpdatedTurn,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  private buildTopKeyPressure(
    keyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number } | undefined>,
    limit: number
  ): Array<{ key: string; predicted: number; confidence: number }> {
    const scoredEntries: Array<[string, { current: number; predicted: number; confidence: number; leadMargin: number }]> = [];
    for (const [key, score] of Object.entries(keyScores)) {
      if (!score) continue;
      if (!Number.isFinite(score.predicted) || score.predicted <= 0) continue;
      scoredEntries.push([key, score]);
    }

    return scoredEntries
      .sort((a, b) => {
        if (b[1].predicted === a[1].predicted) {
          return b[1].confidence - a[1].confidence;
        }
        return b[1].predicted - a[1].predicted;
      })
      .slice(0, Math.max(1, limit))
      .map(([key, score]) => ({
        key,
        predicted: score.predicted,
        confidence: score.confidence,
      }));
  }

  private getTopCommittedTargets(limit: number): Array<{ targetId: string; score: number; attackerCount: number }> {
    return Object.entries(this.state.targetCommitments)
      .map(([targetId, entry]) => ({
        targetId,
        score: entry.score,
        attackerCount: (entry.attackerIds ?? []).length,
      }))
      .sort((a, b) => {
        if (b.score === a.score) {
          return b.attackerCount - a.attackerCount;
        }
        return b.score - a.score;
      })
      .slice(0, Math.max(1, limit));
  }

  private recordPressureContinuity(
    targetId: string,
    attackerId: string,
    currentTurn: number,
    weight: number,
    actionType?: string,
    topologySignature?: string
  ): void {
    const channel = this.resolvePressureChannel(actionType);
    if (!channel) return;

    const store = channel === 'scrum' ? this.state.scrumContinuity : this.state.lanePressure;
    const stats = this.state.pressureContinuityStats[channel];
    this.decayPressureContinuity(store, currentTurn);
    const normalizedSignature = this.normalizeTopologySignature(topologySignature);
    stats.updates += 1;
    if (normalizedSignature) {
      stats.signatureSamples += 1;
    }

    const existing = store[targetId];
    if (!existing) {
      store[targetId] = {
        score: Math.min(PRESSURE_CONTINUITY_MAX_SCORE, weight),
        attackerIds: attackerId ? [attackerId] : [],
        lastUpdatedTurn: currentTurn,
        topologySignature: normalizedSignature,
        signatureStableUpdates: normalizedSignature ? 1 : 0,
        signatureBreaks: 0,
      };
      return;
    }

    const previousSignature = this.normalizeTopologySignature(existing.topologySignature);
    const signatureBreak = Boolean(
      normalizedSignature &&
      previousSignature &&
      normalizedSignature !== previousSignature
    );
    const signatureMatch = Boolean(
      normalizedSignature &&
      previousSignature &&
      normalizedSignature === previousSignature
    );

    if (signatureBreak) {
      stats.signatureBreaks += 1;
      existing.score *= PRESSURE_SIGNATURE_BREAK_PENALTY;
      existing.attackerIds = attackerId ? [attackerId] : [];
      existing.signatureStableUpdates = 0;
      existing.signatureBreaks = (existing.signatureBreaks ?? 0) + 1;
    }
    if (signatureMatch) {
      stats.signatureMatches += 1;
    }

    const attackerAlreadyCommitted = attackerId ? existing.attackerIds.includes(attackerId) : true;
    const uniqueAttackerBonus = signatureBreak
      ? 0
      : (attackerAlreadyCommitted ? 0 : 0.15);
    let continuityBonus = 0;
    if (signatureMatch) {
      const stableUpdates = Math.max(1, (existing.signatureStableUpdates ?? 1) + 1);
      existing.signatureStableUpdates = stableUpdates;
      continuityBonus = Math.min(
        PRESSURE_SIGNATURE_STABLE_BONUS_MAX,
        stableUpdates * PRESSURE_SIGNATURE_STABLE_BONUS_STEP
      );
    } else if (normalizedSignature && !previousSignature) {
      existing.signatureStableUpdates = 1;
    } else if (!normalizedSignature) {
      existing.signatureStableUpdates = 0;
    }

    existing.score = Math.min(
      PRESSURE_CONTINUITY_MAX_SCORE,
      existing.score + weight + uniqueAttackerBonus + continuityBonus
    );
    if (attackerId && !attackerAlreadyCommitted) {
      existing.attackerIds.push(attackerId);
    }
    if (normalizedSignature) {
      existing.topologySignature = normalizedSignature;
    }
    existing.lastUpdatedTurn = currentTurn;
  }

  private resolvePressureChannel(actionType?: string): 'scrum' | 'lane' | null {
    if (actionType === 'close_combat' || actionType === 'charge') {
      return 'scrum';
    }
    if (actionType === 'ranged_combat') {
      return 'lane';
    }
    return null;
  }

  private getTopPressureTargets(
    source: Record<string, CoordinatorPressureContinuity>,
    limit: number
  ): Array<{ targetId: string; score: number; attackerCount: number }> {
    return Object.entries(source)
      .map(([targetId, entry]) => ({
        targetId,
        score: entry.score,
        attackerCount: (entry.attackerIds ?? []).length,
      }))
      .sort((a, b) => {
        if (b.score === a.score) {
          return b.attackerCount - a.attackerCount;
        }
        return b.score - a.score;
      })
      .slice(0, Math.max(1, limit));
  }

  private decayPressureContinuity(
    source: Record<string, CoordinatorPressureContinuity>,
    currentTurn: number
  ): void {
    for (const [targetId, entry] of Object.entries(source)) {
      const turnsSinceUpdate = currentTurn - entry.lastUpdatedTurn;
      if (turnsSinceUpdate <= 0) {
        continue;
      }
      if (turnsSinceUpdate > PRESSURE_CONTINUITY_MAX_STALE_TURNS) {
        delete source[targetId];
        continue;
      }

      const decayedScore = entry.score * Math.pow(PRESSURE_CONTINUITY_DECAY_PER_TURN, turnsSinceUpdate);
      if (decayedScore < PRESSURE_CONTINUITY_PRUNE_THRESHOLD) {
        delete source[targetId];
        continue;
      }

      entry.score = decayedScore;
      entry.lastUpdatedTurn = currentTurn;
    }
  }

  private toRoundedScoreMap(source: Record<string, CoordinatorPressureContinuity>): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const [targetId, entry] of Object.entries(source)) {
      scores[targetId] = Number(entry.score.toFixed(4));
    }
    return scores;
  }

  private decayTargetCommitments(currentTurn: number): void {
    for (const [targetId, entry] of Object.entries(this.state.targetCommitments)) {
      const turnsSinceUpdate = currentTurn - entry.lastUpdatedTurn;
      if (turnsSinceUpdate <= 0) {
        continue;
      }
      if (turnsSinceUpdate > TARGET_COMMITMENT_MAX_STALE_TURNS) {
        delete this.state.targetCommitments[targetId];
        continue;
      }

      const decayedScore = entry.score * Math.pow(TARGET_COMMITMENT_DECAY_PER_TURN, turnsSinceUpdate);
      if (decayedScore < TARGET_COMMITMENT_PRUNE_THRESHOLD) {
        delete this.state.targetCommitments[targetId];
        continue;
      }

      entry.score = decayedScore;
      entry.lastUpdatedTurn = currentTurn;
    }
  }

  private cloneTargetCommitments(source: Record<string, TargetCommitment>): Record<string, TargetCommitment> {
    const cloned: Record<string, TargetCommitment> = {};
    for (const [targetId, entry] of Object.entries(source)) {
      cloned[targetId] = {
        score: entry.score,
        attackerIds: [...(entry.attackerIds ?? [])],
        lastUpdatedTurn: entry.lastUpdatedTurn,
      };
    }
    return cloned;
  }

  private cloneFractionalPotentialLedger(
    source: FractionalPotentialLedgerState
  ): FractionalPotentialLedgerState {
    const keyProgress: Record<string, FractionalPotentialLedgerEntry> = {};
    for (const [key, entry] of Object.entries(source?.keyProgress ?? {})) {
      keyProgress[key] = {
        myProgress: Number(entry?.myProgress ?? 0),
        opponentProgress: Number(entry?.opponentProgress ?? 0),
        myDeniedPotential: Number(entry?.myDeniedPotential ?? 0),
        opponentDeniedPotential: Number(entry?.opponentDeniedPotential ?? 0),
        myConfidence: this.clamp(Number(entry?.myConfidence ?? 0.5), 0, 1),
        opponentConfidence: this.clamp(Number(entry?.opponentConfidence ?? 0.5), 0, 1),
        lastUpdatedTurn: Number(entry?.lastUpdatedTurn ?? 0),
        lastMyRawPotential: Number(
          entry?.lastMyRawPotential ??
          entry?.myProgress ??
          0
        ),
        lastOpponentRawPotential: Number(
          entry?.lastOpponentRawPotential ??
          entry?.opponentProgress ??
          0
        ),
      };
    }

    return {
      keyProgress,
      myTotalPotential: Number(source?.myTotalPotential ?? 0),
      opponentTotalPotential: Number(source?.opponentTotalPotential ?? 0),
      myDeniedPotential: Number(source?.myDeniedPotential ?? 0),
      opponentDeniedPotential: Number(source?.opponentDeniedPotential ?? 0),
      potentialDelta: Number(source?.potentialDelta ?? 0),
      lastUpdatedTurn: Number(source?.lastUpdatedTurn ?? 0),
    };
  }

  private createEmptyPressureContinuityStats(): CoordinatorPressureContinuityStats {
    return {
      scrum: {
        updates: 0,
        signatureSamples: 0,
        signatureMatches: 0,
        signatureBreaks: 0,
      },
      lane: {
        updates: 0,
        signatureSamples: 0,
        signatureMatches: 0,
        signatureBreaks: 0,
      },
    };
  }

  private clonePressureContinuityStats(
    source: CoordinatorPressureContinuityStats
  ): CoordinatorPressureContinuityStats {
    return {
      scrum: {
        updates: Number(source?.scrum?.updates ?? 0),
        signatureSamples: Number(source?.scrum?.signatureSamples ?? 0),
        signatureMatches: Number(source?.scrum?.signatureMatches ?? 0),
        signatureBreaks: Number(source?.scrum?.signatureBreaks ?? 0),
      },
      lane: {
        updates: Number(source?.lane?.updates ?? 0),
        signatureSamples: Number(source?.lane?.signatureSamples ?? 0),
        signatureMatches: Number(source?.lane?.signatureMatches ?? 0),
        signatureBreaks: Number(source?.lane?.signatureBreaks ?? 0),
      },
    };
  }

  private buildPressureChannelDiagnostics(
    source: CoordinatorPressureContinuityChannelStats
  ): CoordinatorPressureContinuityChannelDiagnostics {
    const updates = Math.max(0, Number(source?.updates ?? 0));
    const signatureSamples = Math.max(0, Number(source?.signatureSamples ?? 0));
    const signatureMatches = Math.max(0, Number(source?.signatureMatches ?? 0));
    const signatureBreaks = Math.max(0, Number(source?.signatureBreaks ?? 0));
    const missingSignatureUpdates = Math.max(0, updates - signatureSamples);
    return {
      updates,
      signatureSamples,
      signatureMatches,
      signatureBreaks,
      missingSignatureUpdates,
      signatureCoverageRate: updates > 0 ? Number((signatureSamples / updates).toFixed(4)) : 0,
      breakRate: signatureSamples > 0 ? Number((signatureBreaks / signatureSamples).toFixed(4)) : 0,
      matchRate: signatureSamples > 0 ? Number((signatureMatches / signatureSamples).toFixed(4)) : 0,
    };
  }

  private normalizeTopologySignature(signature?: string): string | undefined {
    if (typeof signature !== 'string') {
      return undefined;
    }
    const trimmed = signature.trim();
    if (!trimmed) {
      return undefined;
    }
    if (trimmed.length <= 320) {
      return trimmed;
    }
    return trimmed.slice(0, 320);
  }

  private clonePressureContinuity(
    source: Record<string, CoordinatorPressureContinuity>
  ): Record<string, CoordinatorPressureContinuity> {
    const cloned: Record<string, CoordinatorPressureContinuity> = {};
    for (const [targetId, entry] of Object.entries(source)) {
      cloned[targetId] = {
        score: entry.score,
        attackerIds: [...(entry.attackerIds ?? [])],
        lastUpdatedTurn: entry.lastUpdatedTurn,
        topologySignature: entry.topologySignature,
        signatureStableUpdates: entry.signatureStableUpdates,
        signatureBreaks: entry.signatureBreaks,
      };
    }
    return cloned;
  }

  private cloneDecisionTrace(source: CoordinatorDecisionTraceEntry[]): CoordinatorDecisionTraceEntry[] {
    return source.map(entry => ({
      turn: entry.turn,
      sideId: entry.sideId,
      doctrine: entry.doctrine,
      observations: {
        amILeading: entry.observations.amILeading,
        vpMargin: entry.observations.vpMargin,
        winningKeys: [...entry.observations.winningKeys],
        losingKeys: [...entry.observations.losingKeys],
        topOpponentKeyPressure: (entry.observations.topOpponentKeyPressure ?? []).map(key => ({
          key: key.key,
          predicted: key.predicted,
          confidence: key.confidence,
        })),
        topTargetCommitments: (entry.observations.topTargetCommitments ?? []).map(target => ({
          targetId: target.targetId,
          score: target.score,
          attackerCount: target.attackerCount,
        })),
        topScrumContinuity: (entry.observations.topScrumContinuity ?? []).map(target => ({
          targetId: target.targetId,
          score: target.score,
          attackerCount: target.attackerCount,
        })),
        topLanePressure: (entry.observations.topLanePressure ?? []).map(target => ({
          targetId: target.targetId,
          score: target.score,
          attackerCount: target.attackerCount,
        })),
        fractionalPotential: entry.observations.fractionalPotential
          ? {
              myVpPotential: entry.observations.fractionalPotential.myVpPotential,
              opponentVpPotential: entry.observations.fractionalPotential.opponentVpPotential,
              myDeniedPotential: entry.observations.fractionalPotential.myDeniedPotential,
              opponentDeniedPotential: entry.observations.fractionalPotential.opponentDeniedPotential,
              potentialDelta: entry.observations.fractionalPotential.potentialDelta,
              urgency: entry.observations.fractionalPotential.urgency,
            }
          : undefined,
      },
      response: {
        priority: entry.response.priority,
        advice: [...entry.response.advice],
        focusTargets: [...entry.response.focusTargets],
        potentialDirective: entry.response.potentialDirective,
        pressureDirective: entry.response.pressureDirective,
      },
    }));
  }
}

/**
 * Side AI Coordinator Manager
 * Manages coordinators for all Sides in a game
 */
export class SideCoordinatorManager {
  private coordinators: Map<string, SideAICoordinator> = new Map();

  /**
   * Get or create coordinator for a Side
   */
  getCoordinator(sideId: string, tacticalDoctrine?: TacticalDoctrine): SideAICoordinator {
    let coordinator = this.coordinators.get(sideId);
    if (!coordinator) {
      coordinator = new SideAICoordinator(sideId, tacticalDoctrine);
      this.coordinators.set(sideId, coordinator);
    } else if (tacticalDoctrine) {
      coordinator.setTacticalDoctrine(tacticalDoctrine);
    }
    return coordinator;
  }

  /**
   * Get all coordinators
   */
  getAllCoordinators(): SideAICoordinator[] {
    return Array.from(this.coordinators.values());
  }

  /**
   * Get coordinator initiative policy signals for a turn across all sides.
   */
  getInitiativeSignalsForTurn(currentTurn: number): Record<string, CoordinatorInitiativeSignal> {
    const signals: Record<string, CoordinatorInitiativeSignal> = {};
    for (const coordinator of this.coordinators.values()) {
      signals[coordinator.getSideId()] = coordinator.getInitiativeSignalForTurn(currentTurn);
    }
    return signals;
  }

  /**
   * Ask side coordinator whether to spend IP to force initiative order.
   */
  recommendForceInitiativeSpend(
    sideId: string,
    context: CoordinatorForceInitiativeContext
  ): CoordinatorInitiativeSpendDecision {
    const coordinator = this.coordinators.get(sideId);
    if (!coordinator) {
      return { shouldSpend: false, reason: 'missing_coordinator' };
    }
    return coordinator.recommendForceInitiativeSpend(context);
  }

  /**
   * Ask side coordinator whether to spend IP to maintain initiative chain.
   */
  recommendMaintainInitiativeSpend(
    sideId: string,
    context: CoordinatorMaintainInitiativeContext
  ): CoordinatorInitiativeSpendDecision {
    const coordinator = this.coordinators.get(sideId);
    if (!coordinator) {
      return { shouldSpend: false, reason: 'missing_coordinator' };
    }
    return coordinator.recommendMaintainInitiativeSpend(context);
  }

  /**
   * Ask side coordinator whether to spend IP to refresh actor delay.
   */
  recommendRefreshInitiativeSpend(
    sideId: string,
    context: CoordinatorRefreshInitiativeContext
  ): CoordinatorInitiativeSpendDecision {
    const coordinator = this.coordinators.get(sideId);
    if (!coordinator) {
      return { shouldSpend: false, reason: 'missing_coordinator' };
    }
    return coordinator.recommendRefreshInitiativeSpend(context);
  }

  /**
   * Remove coordinator for a Side
   */
  removeCoordinator(sideId: string): void {
    this.coordinators.delete(sideId);
  }

  /**
   * Clear all coordinators
   */
  clear(): void {
    this.coordinators.clear();
  }

  /**
   * Update scoring context for all Sides
   * Called at start of each turn
   */
  updateAllScoringContexts(
    sideKeyScores: Map<string, Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>>,
    currentTurn: number,
    missionConfig: MissionVPConfig
  ): void {
    for (const [sideId, keyScores] of sideKeyScores.entries()) {
      const coordinator = this.coordinators.get(sideId);
      if (!coordinator) continue;

      // Find best opponent's scores
      const opponentScores = this.findBestOpponentScores(sideId, sideKeyScores);
      coordinator.updateScoringContext(keyScores, opponentScores, currentTurn, missionConfig);
    }
  }

  /**
   * Find best opponent's scores for comparison
   */
  private findBestOpponentScores(
    mySideId: string,
    allScores: Map<string, Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>>
  ): Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }> {
    const opponentScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }> = {};
    const allKeys = new Set<string>();

    // Collect all keys from all opponents
    for (const [sideId, scores] of allScores.entries()) {
      if (sideId === mySideId) continue;
      for (const key of Object.keys(scores)) {
        allKeys.add(key);
      }
    }

    // For each key, find opponent with best predicted score
    for (const key of allKeys) {
      let bestScore = 0;
      let bestConfidence = 0;

      for (const [sideId, scores] of allScores.entries()) {
        if (sideId === mySideId) continue;
        const score = scores[key];
        if (score && score.predicted > bestScore) {
          bestScore = score.predicted;
          bestConfidence = score.confidence;
        }
      }

      if (bestScore > 0) {
        opponentScores[key] = {
          current: 0,
          predicted: bestScore,
          confidence: bestConfidence,
          leadMargin: bestScore,
        };
      }
    }

    return opponentScores;
  }
}
