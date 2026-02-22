import { MissionSide } from '../mission-system/MissionSide';
import { MissionDefinition } from '../missions/mission-config';
import { MissionEventManager, EventTriggerType, EventEffectType, EventConditionType, EventEffect } from '../missions/mission-event-hooks';
import { getEliminationMission } from './elimination';

/**
 * Elimination Mission State
 */
export interface EliminationMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Models eliminated per side */
  eliminationsBySide: Map<string, number>;
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
      vpBySide: new Map(),
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.eliminationsBySide.set(side.id, 0);
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
   */
  processModelElimination(eliminatedModelId: string, eliminatedSideId: string, eliminatingSideId?: string): void {
    // Track elimination
    const currentEliminations = this.state.eliminationsBySide.get(eliminatedSideId) ?? 0;
    this.state.eliminationsBySide.set(eliminatedSideId, currentEliminations + 1);

    // Award VP to eliminating side
    if (eliminatingSideId && eliminatingSideId !== eliminatedSideId) {
      const currentVP = this.state.vpBySide.get(eliminatingSideId) ?? 0;
      this.state.vpBySide.set(eliminatingSideId, currentVP + 1);

      // Update side VP
      const side = this.sides.get(eliminatingSideId);
      if (side) {
        side.state.victoryPoints = currentVP + 1;
      }
    }

    // Check for immediate victory
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
