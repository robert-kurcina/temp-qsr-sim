import { MissionSide } from '../mission/MissionSide';
import { MissionDefinition } from '../missions/mission-config';
import { MissionEventManager, EventTriggerType, EventEffectType, EventConditionType, EventEffect } from '../missions/mission-event-hooks';
import { getEliminationMission } from './elimination';
import {
  computeEliminationScores,
  computeBottledScores,
  computeOutnumberedScores,
} from './mission-scoring';

/**
 * Elimination Mission State
 */
export interface EliminationMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Models eliminated per side */
  eliminationsBySide: Map<string, number>;
  /** BP value of KO'd and Eliminated models per side (for scoring) */
  eliminatedBpBySide: Map<string, number>;
  /** VP from eliminations per side */
  vpBySide: Map<string, number>;
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
}

/**
 * Elimination Mission Manager
 * Handles all Elimination mission logic
 */
export class EliminationMissionManager {
  private mission: MissionDefinition;
  private sides: Map<string, MissionSide>;
  private eventManager: MissionEventManager;
  private state: EliminationMissionState;

  constructor(sides: MissionSide[]) {
    this.mission = getEliminationMission();
    this.sides = new Map();
    this.eventManager = new MissionEventManager();
    this.state = {
      sideIds: sides.map(s => s.id),
      eliminationsBySide: new Map(),
      eliminatedBpBySide: new Map(),
      vpBySide: new Map(),
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.eliminationsBySide.set(side.id, 0);
      this.state.eliminatedBpBySide.set(side.id, 0);
      this.state.vpBySide.set(side.id, 0);
    }

    // Set up event hooks
    this.setupEventHooks();
  }

  /**
   * Set up event hooks for Elimination mission
   */
  private setupEventHooks(): void {
    // Victory condition: All enemies eliminated
    this.setupEliminationVictoryHooks();

    // Scoring: VP per elimination
    this.setupEliminationScoringHooks();

    // End of game VP check
    this.setupEndGameVictoryHook();
  }

  /**
   * Set up elimination victory condition hooks
   */
  private setupEliminationVictoryHooks(): void {
    const sideIds = Array.from(this.sides.keys());

    for (const sideId of sideIds) {
      // Check if this side has models AND all enemies are eliminated
      const hook = {
        id: `elimination-victory-${sideId}`,
        name: `${sideId} Elimination Victory`,
        trigger: EventTriggerType.Immediate,
        turnNumber: undefined,
        conditions: [
          // This side has at least 1 model
          {
            type: EventConditionType.ModelsRemaining,
            sideId,
            threshold: 1,
          },
          // All other sides have 0 models
          ...sideIds
            .filter(id => id !== sideId)
            .map(enemyId => ({
              type: EventConditionType.ModelsRemaining as EventConditionType,
              sideId: enemyId,
              threshold: 1,
              invert: true,
            })),
        ],
        effects: [
          {
            type: EventEffectType.TriggerVictory,
            sideId,
          },
        ],
        hasTriggered: false,
        repeatable: false,
        priority: 100,
        metadata: {},
      };

      this.eventManager.addHook(hook);
    }
  }

  /**
   * Set up elimination scoring hooks (VP per elimination)
   */
  private setupEliminationScoringHooks(): void {
    // When a model is eliminated, award VP to the opposing side
    const hook = {
      id: 'elimination-scoring',
      name: 'Elimination Scoring',
      trigger: EventTriggerType.ModelEliminated,
      turnNumber: undefined,
      conditions: [],
      effects: [], // Effects are generated dynamically
      hasTriggered: false,
      repeatable: true,
      priority: 50,
      metadata: {},
    };

    this.eventManager.addHook(hook);
  }

  /**
   * Set up end-game victory condition (most VP)
   */
  private setupEndGameVictoryHook(): void {
    const hook = {
      id: 'end-game-victory',
      name: 'End Game Victory',
      trigger: EventTriggerType.TurnEnd,
      turnNumber: this.mission.turnLimit,
      conditions: [],
      effects: [
        {
          type: EventEffectType.EndMission,
        },
      ],
      hasTriggered: false,
      repeatable: false,
      priority: 90,
      metadata: {},
    };

    this.eventManager.addHook(hook);
  }

  /**
   * Process a model elimination event
   * Tracks the BP value of eliminated models for end-game scoring
   */
  processModelElimination(
    eliminatedModelId: string,
    eliminatedSideId: string,
    eliminatingSideId?: string,
    eliminatedBp: number = 0
  ): void {
    // Track elimination count
    const currentEliminations = this.state.eliminationsBySide.get(eliminatedSideId) ?? 0;
    this.state.eliminationsBySide.set(eliminatedSideId, currentEliminations + 1);

    // Track BP value of eliminated models (for end-game scoring)
    const currentEliminatedBp = this.state.eliminatedBpBySide.get(eliminatedSideId) ?? 0;
    this.state.eliminatedBpBySide.set(eliminatedSideId, currentEliminatedBp + eliminatedBp);

    // Check for immediate victory (all enemies eliminated)
    this.checkForVictory();
  }

  /**
   * Check if any side has achieved victory
   */
  checkForVictory(): void {
    const sideIds = Array.from(this.sides.keys());

    for (const sideId of sideIds) {
      const side = this.sides.get(sideId);
      if (!side) continue;

      // Check if this side has models remaining
      const activeModels = side.members.filter(
        m => m.status !== 'Eliminated' as any && m.status !== 'KO' as any
      ).length;

      if (activeModels === 0) continue; // This side is eliminated

      // Check if all enemies are eliminated
      let allEnemiesEliminated = true;
      for (const enemyId of sideIds) {
        if (enemyId === sideId) continue;

        const enemy = this.sides.get(enemyId);
        if (!enemy) continue;

        const enemyActiveModels = enemy.members.filter(
          m => m.status !== 'Eliminated' as any && m.status !== 'KO' as any
        ).length;

        if (enemyActiveModels > 0) {
          allEnemiesEliminated = false;
          break;
        }
      }

      if (allEnemiesEliminated) {
        this.endMission(sideId, 'All enemies eliminated');
        return;
      }
    }
  }

  /**
   * End the mission
   */
  endMission(winnerId?: string, reason?: string): void {
    this.state.ended = true;
    this.state.winner = winnerId;
    this.state.endReason = reason;

    // If no winner, determine by VP
    if (!winnerId) {
      winnerId = this.determineVPWinner();
      this.state.winner = winnerId;
      this.state.endReason = reason ?? 'Turn limit reached';
    }
  }

  /**
   * Determine winner by VP
   */
  private determineVPWinner(): string | undefined {
    let maxVP = -1;
    let winner: string | undefined;

    for (const [sideId, vp] of this.state.vpBySide.entries()) {
      const side = this.sides.get(sideId);
      if (!side) continue;

      // Only sides with active models can win
      const activeModels = side.members.filter(
        m => m.status !== 'Eliminated' as any && m.status !== 'KO' as any
      ).length;

      if (activeModels === 0) continue;

      if (vp > maxVP) {
        maxVP = vp;
        winner = sideId;
      } else if (vp === maxVP) {
        // Tie - could be resolved by various means
        // For now, keep first one
      }
    }

    return winner;
  }

  /**
   * Get current VP for a side
   */
  getVictoryPoints(sideId: string): number {
    return this.state.vpBySide.get(sideId) ?? 0;
  }

  /**
   * Get elimination count for a side
   */
  getEliminationCount(sideId: string): number {
    return this.state.eliminationsBySide.get(sideId) ?? 0;
  }

  /**
   * Get eliminated BP for a side (for end-game scoring)
   */
  getEliminatedBp(sideId: string): number {
    return this.state.eliminatedBpBySide.get(sideId) ?? 0;
  }

  /**
   * Calculate end-game scoring for Elimination mission
   * Awards VP for: Elimination (highest BP), Bottled, Outnumbered
   */
  calculateEndGameScoring(): { vpBySide: Record<string, number>; rpBySide: Record<string, number> } {
    const vpBySide: Record<string, number> = {};
    const rpBySide: Record<string, number> = {};

    // Build side status for scoring functions
    const sideStatuses = Array.from(this.sides.values()).map(side => {
      let koCount = 0;
      let eliminatedCount = 0;
      let orderedCount = 0;
      let koBp = 0;
      let eliminatedBp = 0;

      for (const member of side.members) {
        const bp = member.profile?.totalBp ?? 0;
        if (member.status === 'Eliminated' as any) {
          eliminatedCount++;
          eliminatedBp += bp;
        } else if (member.status === 'KO' as any) {
          koCount++;
          koBp += bp;
        } else if (member.status === 'Ready' as any || member.status === 'Distracted' as any) {
          orderedCount++;
        }
      }

      return {
        sideId: side.id,
        startingCount: side.members.length,
        inPlayCount: side.members.length - koCount - eliminatedCount,
        orderedCount,
        koCount,
        eliminatedCount,
        koBp,
        eliminatedBp,
        totalBp: side.totalBP,
        bottledOut: orderedCount === 0,
      };
    });

    // Elimination: +1 VP to side with highest BP of KO'd+Eliminated enemies
    // Calculate total enemy BP eliminated by each side
    const eliminationBpBySide: Record<string, number> = {};
    for (const side of sideStatuses) {
      let totalEnemyBpEliminated = 0;
      for (const opponent of sideStatuses) {
        if (opponent.sideId === side.sideId) continue;
        // Add opponent's KO and eliminated BP (these were eliminated by this side)
        totalEnemyBpEliminated += opponent.koBp + opponent.eliminatedBp;
      }
      eliminationBpBySide[side.sideId] = totalEnemyBpEliminated;
    }

    const eliminationVp = computeEliminationScores(sideStatuses, eliminationBpBySide);
    for (const [sideId, vp] of Object.entries(eliminationVp)) {
      vpBySide[sideId] = (vpBySide[sideId] ?? 0) + vp;
    }

    // Bottled: +1 VP if opposing side has no Ordered models
    const bottledOutSideIds = sideStatuses
      .filter(s => s.bottledOut)
      .map(s => s.sideId);
    const bottledScores = computeBottledScores(sideStatuses, bottledOutSideIds);
    for (const [sideId, vp] of Object.entries(bottledScores.vpBySide)) {
      vpBySide[sideId] = (vpBySide[sideId] ?? 0) + vp;
    }
    for (const [sideId, rp] of Object.entries(bottledScores.rpBySide)) {
      rpBySide[sideId] = (rpBySide[sideId] ?? 0) + rp;
    }

    // Outnumbered: +1 VP (+2 VP if 2:1) to side outnumbered at start
    const outnumberedVp = computeOutnumberedScores(sideStatuses);
    for (const [sideId, vp] of Object.entries(outnumberedVp)) {
      vpBySide[sideId] = (vpBySide[sideId] ?? 0) + vp;
    }

    return { vpBySide, rpBySide };
  }

  /**
   * Calculate predicted scoring with key breakdown for AI planning
   * Returns per-side predicted VP/RP and per-key scores with confidence metrics
   */
  calculatePredictedScoring(): {
    sideScores: Record<string, { predictedVp: number; predictedRp: number; keyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }> }>;
  } {
    // Build side status for scoring functions
    const sideStatuses = Array.from(this.sides.values()).map(side => {
      let koCount = 0;
      let eliminatedCount = 0;
      let orderedCount = 0;
      let koBp = 0;
      let eliminatedBp = 0;

      for (const member of side.members) {
        const bp = member.profile?.totalBp ?? 0;
        if (member.status === 'Eliminated' as any) {
          eliminatedCount++;
          eliminatedBp += bp;
        } else if (member.status === 'KO' as any) {
          koCount++;
          koBp += bp;
        } else if (member.status === 'Ready' as any || member.status === 'Distracted' as any) {
          orderedCount++;
        }
      }

      return {
        sideId: side.id,
        startingCount: side.members.length,
        inPlayCount: side.members.length - koCount - eliminatedCount,
        orderedCount,
        koCount,
        eliminatedCount,
        koBp,
        eliminatedBp,
        totalBp: side.totalBP,
        bottledOut: orderedCount === 0,
      };
    });

    const sideScores: Record<string, {
      predictedVp: number;
      predictedRp: number;
      keyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>;
    }> = {};

    // Initialize side scores
    for (const side of sideStatuses) {
      sideScores[side.sideId] = {
        predictedVp: 0,
        predictedRp: 0,
        keyScores: {},
      };
    }

    // Calculate Elimination key scores
    const eliminationBpBySide: Record<string, number> = {};
    for (const side of sideStatuses) {
      let totalEnemyBpEliminated = 0;
      for (const opponent of sideStatuses) {
        if (opponent.sideId === side.sideId) continue;
        totalEnemyBpEliminated += opponent.koBp + opponent.eliminatedBp;
      }
      eliminationBpBySide[side.sideId] = totalEnemyBpEliminated;
    }

    // Find best and second-best for confidence calculation
    const sortedElimination = Object.entries(eliminationBpBySide)
      .sort((a, b) => b[1] - a[1]);
    const bestElimination = sortedElimination[0];
    const secondElimination = sortedElimination[1];

    for (const [sideId, bp] of Object.entries(eliminationBpBySide)) {
      const isBest = bestElimination && sideId === bestElimination[0];
      const predicted = isBest && (!secondElimination || bestElimination[1] > secondElimination[1]) ? 1 : 0;
      const leadMargin = isBest && secondElimination ? bestElimination[1] - secondElimination[1] : 0;
      const opponentBest = isBest && secondElimination ? secondElimination[1] : (bestElimination?.[1] ?? 0);
      const confidence = bp > 0 && opponentBest > 0 ? Math.max(0, Math.min(1, 1 - (opponentBest / bp))) : (isBest ? 1 : 0);

      sideScores[sideId].keyScores['elimination'] = {
        current: 0, // Current VP awarded during game (none for elimination until end)
        predicted,
        confidence,
        leadMargin,
      };
      sideScores[sideId].predictedVp += predicted;
    }

    // Calculate Bottled key scores
    const bottledSides = sideStatuses.filter(s => s.bottledOut);
    for (const side of sideStatuses) {
      const isOpponentBottled = bottledSides.some(s => s.sideId !== side.sideId);
      const predicted = isOpponentBottled ? 1 : 0;
      const confidence = isOpponentBottled ? 1.0 : 0.0;

      sideScores[side.sideId].keyScores['bottled'] = {
        current: 0,
        predicted,
        confidence,
        leadMargin: isOpponentBottled ? 1 : 0,
      };
      sideScores[side.sideId].predictedVp += predicted;
    }

    // Calculate Outnumbered key scores
    const activeSides = sideStatuses.filter(s => s.inPlayCount > 0);
    if (activeSides.length === 2) {
      const [a, b] = activeSides;
      const larger = a.startingCount >= b.startingCount ? a : b;
      const smaller = larger.sideId === a.sideId ? b : a;
      const ratio = larger.startingCount / Math.max(1, smaller.startingCount);

      let vpAward = 0;
      if (ratio >= 2) vpAward = 2;
      else if (ratio >= 1.5) vpAward = 1;

      if (vpAward > 0) {
        sideScores[smaller.sideId].keyScores['outnumbered'] = {
          current: 0,
          predicted: vpAward,
          confidence: 1.0, // Deterministic based on starting counts
          leadMargin: vpAward,
        };
        sideScores[smaller.sideId].predictedVp += vpAward;
      }
    }

    return { sideScores };
  }

  /**
   * Get mission state
   */
  getState(): EliminationMissionState {
    return { ...this.state };
  }

  /**
   * Check if mission has ended
   */
  hasEnded(): boolean {
    return this.state.ended;
  }

  /**
   * Get winner
   */
  getWinner(): string | undefined {
    return this.state.winner;
  }

  /**
   * Get end reason
   */
  getEndReason(): string | undefined {
    return this.state.endReason;
  }

  /**
   * Get all VP standings
   */
  getVPStandings(): Array<{ sideId: string; vp: number; eliminations: number }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({
        sideId,
        vp,
        eliminations: this.state.eliminationsBySide.get(sideId) ?? 0,
      }))
      .sort((a, b) => b.vp - a.vp);
  }

  /**
   * Trigger event hooks
   */
  triggerEvents(triggerType: EventTriggerType, context: any): void {
    this.eventManager.triggerHooks(triggerType, context);
  }
}

/**
 * Create an Elimination mission manager
 */
export function createEliminationMission(sides: MissionSide[]): EliminationMissionManager {
  return new EliminationMissionManager(sides);
}
