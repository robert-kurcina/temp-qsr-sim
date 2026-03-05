import { MissionSide } from '../mission/MissionSide';
import { MissionDefinition, VictoryConditionType } from '../missions/mission-definitions';
import { MissionEventManager, EventTriggerType, EventEffectType, EventConditionType, EventEffect } from '../missions/mission-event-hooks';
import { getEliminationMission } from './elimination';
import {
  computeEliminationScores,
  computeBottledScores,
  computeOutnumberedScores,
  computeAggressionScores,
  AggressionState,
} from './mission-scoring';
import {
  calculateEliminationFractionalVP,
  calculateBottledFractionalVP,
  calculateOutnumberedFractionalVP,
  calculateAggressionFractionalVP,
  calculateFirstBloodFractionalVP,
} from './FractionalScoringUtils';

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
  /** Aggression tracking (models crossing mid-line) */
  aggression: AggressionState;
  /** First Blood tracking (first side to inflict wounds) */
  firstBloodSideId?: string;
  /** Scholar RP tracking (RP from Scholar X trait) */
  scholarRpBySide: Record<string, number>;
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
  /** Current turn (backward compatibility) */
  currentTurn?: number;
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
  public currentTurn: number = 1;

  constructor(sides: MissionSide[]) {
    this.mission = getEliminationMission();
    this.sides = new Map();
    this.eventManager = new MissionEventManager();
    this.state = {
      sideIds: sides.map(s => s.id),
      eliminationsBySide: new Map(),
      eliminatedBpBySide: new Map(),
      vpBySide: new Map(),
      aggression: { crossedBySide: {}, firstCrossedSideId: undefined },
      firstBloodSideId: undefined,
      scholarRpBySide: {},
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.eliminationsBySide.set(side.id, 0);
      this.state.eliminatedBpBySide.set(side.id, 0);
      this.state.vpBySide.set(side.id, 0);
      this.state.scholarRpBySide[side.id] = 0;
      
      // Calculate initial Scholar RP (characters that start with Scholar trait)
      this.state.scholarRpBySide[side.id] = this.calculateScholarRp(side);
    }

    // Set up event hooks
    this.setupEventHooks();
  }

  /**
   * Calculate Scholar RP for a side (sum of Scholar X levels for surviving characters)
   */
  private calculateScholarRp(side: MissionSide): number {
    let totalScholarRp = 0;
    for (const member of side.members) {
      const character = member.character;
      if (!character || character.state.isEliminated || character.state.isKOd) continue;
      
      const scholarLevel = this.getScholarLevel(character);
      if (scholarLevel > 0) {
        totalScholarRp += scholarLevel;
      }
    }
    return totalScholarRp;
  }

  /**
   * Get Scholar trait level from a character
   */
  private getScholarLevel(character: any): number {
    // Check profile traits for Scholar X
    const traits = character.profile?.finalTraits ?? [];
    for (const trait of traits) {
      if (typeof trait === 'string' && trait.startsWith('Scholar')) {
        const match = trait.match(/Scholar\s*(\d+)?/);
        if (match) {
          return match[1] ? parseInt(match[1], 10) : 1;
        }
      }
    }
    return 0;
  }

  /**
   * Track First Blood (first side to inflict wounds)
   * Awards 1 VP to first side to wound an enemy model
   */
  public recordFirstBlood(sideId: string): void {
    if (this.state.firstBloodSideId) return; // Already awarded
    this.state.firstBloodSideId = sideId;
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
   * Track a model crossing the midline for Aggression scoring
   * QSR: Aggression key - +1 VP if half models cross, +1 RP to first to cross
   */
  trackMidlineCross(modelId: string, sideId: string, position: { x: number; y: number }, battlefieldCenter: { x: number; y: number }): void {
    // Check if model has crossed the midline (toward opponent)
    // For a 2-side battle, midline is perpendicular to the deployment axis
    // Simple check: model's x position is past the center toward opponent

    const side = this.sides.get(sideId);
    if (!side) return;

    const startingCount = side.members.length;
    const threshold = Math.ceil(startingCount / 2);
    const currentCrossed = this.state.aggression.crossedBySide[sideId] ?? 0;

    // Check if this model has already crossed (track unique models)
    // For simplicity, we track count of models that have crossed
    // A more sophisticated implementation would track individual model IDs

    // Determine if model is past midline (simple x-axis check for opposite deployment)
    // Assuming Side A deploys at x=0, Side B at x=battlefieldSize
    // Midline is at battlefieldSize/2
    const hasCrossed = position.x > battlefieldCenter.x;

    if (hasCrossed && currentCrossed < threshold) {
      // Track this crossing
      const newCrossed = currentCrossed + 1;
      this.state.aggression.crossedBySide[sideId] = newCrossed;

      // Award RP to first side to cross
      if (!this.state.aggression.firstCrossedSideId) {
        this.state.aggression.firstCrossedSideId = sideId;
      }
    }
  }

  /**
   * Track a Scholar character elimination for RP scoring
   * QSR: Scholar X awards X RP only if character survives
   */
  processScholarElimination(modelId: string, sideId: string): void {
    const side = this.sides.get(sideId);
    if (!side) return;

    // Find the character and calculate their Scholar level
    const member = side.members.find(m => m.id === modelId || m.character?.id === modelId);
    if (!member || !member.character) return;

    const scholarLevel = this.getScholarLevel(member.character);
    if (scholarLevel > 0) {
      // Reduce Scholar RP for this side (character no longer survives)
      const currentRp = this.state.scholarRpBySide[sideId] ?? 0;
      this.state.scholarRpBySide[sideId] = Math.max(0, currentRp - scholarLevel);
    }
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

    // Aggression: +1 VP if at least half of models crossed midline, +1 RP to first to cross
    const aggressionScores = computeAggressionScores(sideStatuses, this.state.aggression);
    for (const [sideId, vp] of Object.entries(aggressionScores.vpBySide)) {
      vpBySide[sideId] = (vpBySide[sideId] ?? 0) + vp;
    }
    for (const [sideId, rp] of Object.entries(aggressionScores.rpBySide)) {
      rpBySide[sideId] = (rpBySide[sideId] ?? 0) + rp;
    }

    // First Blood: +1 VP to first side to inflict wounds
    if (this.state.firstBloodSideId) {
      vpBySide[this.state.firstBloodSideId] = (vpBySide[this.state.firstBloodSideId] ?? 0) + 1;
    }

    // Scholar RP: Add RP from surviving Scholar X characters
    // QSR: Scholar X awards X RP if character survives the mission
    for (const [sideId, scholarRp] of Object.entries(this.state.scholarRpBySide)) {
      if (scholarRp > 0) {
        rpBySide[sideId] = (rpBySide[sideId] ?? 0) + scholarRp;
      }
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

    // Calculate Elimination key scores (FRACTIONAL VP)
    // Each side earns VP proportional to enemy BP eliminated
    const eliminationBpBySide: Record<string, number> = {};
    const totalEnemyBpBySide: Record<string, number> = {};

    for (const side of sideStatuses) {
      let totalEnemyBpEliminated = 0;
      let totalEnemyBp = 0;

      for (const opponent of sideStatuses) {
        if (opponent.sideId === side.sideId) continue;
        totalEnemyBpEliminated += opponent.koBp + opponent.eliminatedBp;
        totalEnemyBp += opponent.totalBp;
      }

      eliminationBpBySide[side.sideId] = totalEnemyBpEliminated;
      totalEnemyBpBySide[side.sideId] = totalEnemyBp;
    }

    // Use shared utility for fractional VP calculation
    for (const [sideId] of Object.entries(eliminationBpBySide)) {
      const score = calculateEliminationFractionalVP(sideId, eliminationBpBySide, totalEnemyBpBySide);

      sideScores[sideId].keyScores['elimination'] = {
        current: 0,
        predicted: score.predicted,  // FRACTIONAL: 0.0-1.0 based on elimination progress
        confidence: score.confidence,
        leadMargin: score.leadMargin,
      };
      sideScores[sideId].predictedVp += score.predicted;
    }

    // Calculate Bottled key scores (FRACTIONAL VP)
    // Use shared utility for fractional VP calculation
    for (const side of sideStatuses) {
      const score = calculateBottledFractionalVP(side.sideId, sideStatuses);

      sideScores[side.sideId].keyScores['bottled'] = {
        current: 0,
        predicted: score.predicted,  // FRACTIONAL: 0.0-1.0 based on bottleneck progress
        confidence: score.confidence,
        leadMargin: score.leadMargin,
      };
      sideScores[side.sideId].predictedVp += score.predicted;
    }

    // Calculate Outnumbered key scores (FRACTIONAL VP)
    // Use shared utility for fractional VP calculation
    // Note: Outnumbered uses startingCount (original model count), not inPlayCount
    const activeSides = sideStatuses.filter(s => s.inPlayCount > 0);
    if (activeSides.length === 2) {
      const [a, b] = activeSides;
      const larger = a.startingCount >= b.startingCount ? a : b;
      const smaller = larger.sideId === a.sideId ? b : a;

      const score = calculateOutnumberedFractionalVP(
        smaller.sideId,
        smaller.startingCount,  // Use starting count for outnumbered key
        larger.startingCount
      );

      if (score.predicted > 0) {
        sideScores[smaller.sideId].keyScores['outnumbered'] = {
          current: 0,
          predicted: score.predicted,  // FRACTIONAL: 0.0-1.0 based on ratio
          confidence: score.confidence,
          leadMargin: score.leadMargin,
        };
        sideScores[smaller.sideId].predictedVp += score.predicted;
      }
    }

    // Calculate Aggression key scores (FRACTIONAL VP)
    // Use shared utility for fractional VP calculation
    const aggressionScores = computeAggressionScores(sideStatuses, this.state.aggression);
    for (const side of sideStatuses) {
      const crossed = this.state.aggression.crossedBySide[side.sideId] ?? 0;
      const threshold = Math.ceil(side.startingCount / 2);
      const score = calculateAggressionFractionalVP(side.sideId, crossed, threshold);

      sideScores[side.sideId].keyScores['aggression'] = {
        current: 0,
        predicted: score.predicted,  // FRACTIONAL: 0.0-1.0 based on crossing progress
        confidence: score.confidence,
        leadMargin: score.leadMargin,
      };
      sideScores[side.sideId].predictedVp += score.predicted;
    }
    for (const [sideId, rp] of Object.entries(aggressionScores.rpBySide)) {
      sideScores[sideId].predictedRp += rp;
      sideScores[sideId].keyScores['aggression_rp'] = {
        current: 0,
        predicted: rp,
        confidence: rp > 0 ? 1.0 : 0.0,
        leadMargin: rp,
      };
    }

    // Calculate First Blood key scores
    // Use shared utility for fractional VP calculation
    const firstBloodScore = calculateFirstBloodFractionalVP(
      this.state.firstBloodSideId || '',
      this.state.firstBloodSideId,
      this.currentTurn
    );
    
    if (this.state.firstBloodSideId) {
      sideScores[this.state.firstBloodSideId].keyScores['first_blood'] = {
        current: 1, // Already awarded
        predicted: 1,
        confidence: 1.0,
        leadMargin: 1,
      };
      sideScores[this.state.firstBloodSideId].predictedVp += 1;
    } else {
      // First Blood not yet awarded - all sides have equal chance
      // For prediction purposes, assume it will be awarded (most likely scenario)
      // In a real game, the side with more aggressive play will get it
      // For simplicity, we'll mark it as 0 predicted but available
      for (const sideId of Object.keys(sideScores)) {
        sideScores[sideId].keyScores['first_blood'] = {
          current: 0,
          predicted: 0, // Will be awarded when first wound is inflicted
          confidence: 0.0,
          leadMargin: 0,
        };
      }
    }

    // Calculate Scholar RP key scores
    // Scholar X awards X RP if character survives - this is predictable based on current survival
    for (const [sideId, scholarRp] of Object.entries(this.state.scholarRpBySide)) {
      if (scholarRp > 0) {
        // Calculate predicted Scholar RP based on surviving characters
        const side = this.sides.get(sideId);
        let predictedScholarRp = 0;
        if (side) {
          for (const member of side.members) {
            const character = member.character;
            if (!character || character.state.isEliminated || character.state.isKOd) continue;
            predictedScholarRp += this.getScholarLevel(character);
          }
        }
        
        sideScores[sideId].predictedRp += predictedScholarRp;
        sideScores[sideId].keyScores['scholar_rp'] = {
          current: 0, // RP awarded at end game
          predicted: predictedScholarRp,
          confidence: 1.0, // High confidence - based on current survival
          leadMargin: predictedScholarRp,
        };
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
