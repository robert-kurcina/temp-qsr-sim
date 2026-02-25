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

import { MissionSide } from '../../mission/MissionSide';
import { ScoringContext, buildScoringContext, getScoringAdvice } from '../stratagems/PredictedScoringIntegration';
import { TacticalDoctrine } from '../stratagems/AIStratagems';

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
  /** Turn last updated */
  lastUpdatedTurn: number;
}

/**
 * Side AI Coordinator - manages AI for one Side/Player
 */
export class SideAICoordinator {
  private state: SideAIState;

  constructor(sideId: string, tacticalDoctrine: TacticalDoctrine = 'operative') {
    this.state = {
      sideId,
      tacticalDoctrine,
      scoringContext: null,
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
    currentTurn: number
  ): ScoringContext {
    const context = buildScoringContext(myKeyScores, opponentKeyScores);
    this.state.scoringContext = context;
    this.state.lastUpdatedTurn = currentTurn;
    return context;
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
    this.state.lastUpdatedTurn = -1;
  }

  /**
   * Export state for serialization
   */
  exportState(): SideAIState {
    return { ...this.state };
  }

  /**
   * Import state from serialization
   */
  importState(state: SideAIState): void {
    this.state = { ...state };
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
    currentTurn: number
  ): void {
    for (const [sideId, keyScores] of sideKeyScores.entries()) {
      const coordinator = this.coordinators.get(sideId);
      if (!coordinator) continue;

      // Find best opponent's scores
      const opponentScores = this.findBestOpponentScores(sideId, sideKeyScores);
      coordinator.updateScoringContext(keyScores, opponentScores, currentTurn);
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
