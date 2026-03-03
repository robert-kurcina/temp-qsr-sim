/**
 * VP Prediction Cache
 *
 * Caches fractional VP predictions per character and action type.
 * Used to learn which actions actually produce VP and adjust scoring.
 */

import { ActionType } from './AIController';

/**
 * VP contribution record
 */
export interface VPContributionRecord {
  /** Character ID */
  characterId: string;
  /** Turn number */
  turn: number;
  /** Action type */
  actionType: ActionType;
  /** Predicted VP (before action) */
  predictedVP: number;
  /** Actual VP (after action) */
  actualVP: number;
  /** Confidence (0.0-1.0) */
  confidence: number;
  /** Target ID (if applicable) */
  targetId?: string;
  /** Was the action successful? */
  wasSuccessful: boolean;
}

/**
 * Action type VP statistics
 */
export interface ActionTypeVPStats {
  /** Total attempts */
  attempts: number;
  /** Successful VP acquisitions */
  vpAcquisitions: number;
  /** Total VP earned */
  totalVP: number;
  /** Average VP per attempt */
  avgVP: number;
  /** Success rate (0.0-1.0) */
  successRate: number;
  /** Recent performance (last 5 attempts) */
  recentAvgVP: number;
}

/**
 * VP Prediction Cache
 *
 * Tracks actual VP contributions to improve future predictions.
 */
export class VPPredictionCache {
  private cache: Map<string, VPContributionRecord> = new Map();
  private actionTypeStats: Map<string, ActionTypeVPStats> = new Map();
  private characterActionStats: Map<string, ActionTypeVPStats> = new Map();

  /**
   * Default VP contribution by action type
   */
  private static readonly DEFAULT_VP_CONTRIBUTION: Record<ActionType, number> = {
    'close_combat': 0.30,
    'ranged_combat': 0.20,
    'charge': 0.15,
    'move': 0.08,
    'disengage': 0.10,
    'detect': 0.08,
    'hide': 0.0,
    'wait': 0.02,
    'rally': 0.05,
    'revive': 0.08,
    'hold': 0.0,
    'fiddle': 0.0,
    'reload': 0.05,
    'pushing': 0.15,
    'refresh': 0.10,
    'combined': 0.20,
    'none': 0.0,
  };

  /**
   * Record actual VP contribution after action resolves
   *
   * @param characterId - Character ID
   * @param turn - Turn number
   * @param actionType - Action type
   * @param actualVP - Actual VP earned (0, 1, 2, etc.)
   * @param predictedVP - Predicted VP (before action)
   * @param targetId - Target ID (if applicable)
   * @param wasSuccessful - Was the action successful?
   */
  recordVPContribution(
    characterId: string,
    turn: number,
    actionType: ActionType,
    actualVP: number,
    predictedVP: number = 0,
    targetId?: string,
    wasSuccessful: boolean = true
  ): void {
    const key = `${characterId}:${turn}:${actionType}`;

    const record: VPContributionRecord = {
      characterId,
      turn,
      actionType,
      predictedVP,
      actualVP,
      confidence: actualVP > 0 ? 1.0 : 0.5,
      targetId,
      wasSuccessful,
    };

    this.cache.set(key, record);
    this.updateStats(characterId, actionType, actualVP);
  }

  /**
   * Get predicted VP for action type
   *
   * @param characterId - Character ID
   * @param actionType - Action type
   * @param currentTurn - Current turn number
   * @returns Predicted VP contribution (0.0-1.0)
   */
  getPredictedVP(
    characterId: string,
    actionType: ActionType,
    currentTurn: number
  ): number {
    // Try character-specific stats first
    const charStatsKey = `${characterId}:${actionType}`;
    const charStats = this.characterActionStats.get(charStatsKey);

    if (charStats && charStats.attempts >= 3) {
      // Use character's recent performance
      return charStats.recentAvgVP;
    }

    // Fall back to action type stats
    const stats = this.actionTypeStats.get(actionType);
    if (stats && stats.attempts >= 5) {
      return stats.avgVP;
    }

    // Use default
    return VPPredictionCache.DEFAULT_VP_CONTRIBUTION[actionType] ?? 0.0;
  }

  /**
   * Get VP statistics for action type
   *
   * @param actionType - Action type
   * @returns VP statistics
   */
  getActionTypeStats(actionType: ActionType): ActionTypeVPStats | undefined {
    return this.actionTypeStats.get(actionType);
  }

  /**
   * Get VP statistics for character + action type
   *
   * @param characterId - Character ID
   * @param actionType - Action type
   * @returns VP statistics
   */
  getCharacterActionStats(
    characterId: string,
    actionType: ActionType
  ): ActionTypeVPStats | undefined {
    const key = `${characterId}:${actionType}`;
    return this.characterActionStats.get(key);
  }

  /**
   * Get all VP contribution records
   *
   * @returns All records
   */
  getAllRecords(): VPContributionRecord[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get records for character
   *
   * @param characterId - Character ID
   * @returns Records for character
   */
  getCharacterRecords(characterId: string): VPContributionRecord[] {
    return Array.from(this.cache.values()).filter(r => r.characterId === characterId);
  }

  /**
   * Get records for turn range
   *
   * @param startTurn - Start turn (inclusive)
   * @param endTurn - End turn (inclusive)
   * @returns Records in turn range
   */
  getTurnRecords(startTurn: number, endTurn: number): VPContributionRecord[] {
    return Array.from(this.cache.values()).filter(
      r => r.turn >= startTurn && r.turn <= endTurn
    );
  }

  /**
   * Clear cache for new game
   */
  clear(): void {
    this.cache.clear();
    this.actionTypeStats.clear();
    this.characterActionStats.clear();
  }

  /**
   * Clear cache for character
   *
   * @param characterId - Character ID
   */
  clearCharacter(characterId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${characterId}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Update stats for action type
   */
  private updateStats(
    characterId: string,
    actionType: ActionType,
    actualVP: number
  ): void {
    // Update action type stats
    let stats = this.actionTypeStats.get(actionType);
    if (!stats) {
      stats = {
        attempts: 0,
        vpAcquisitions: 0,
        totalVP: 0,
        avgVP: 0,
        successRate: 0,
        recentAvgVP: 0,
      };
      this.actionTypeStats.set(actionType, stats);
    }

    stats.attempts++;
    if (actualVP > 0) {
      stats.vpAcquisitions++;
    }
    stats.totalVP += actualVP;
    stats.avgVP = stats.totalVP / stats.attempts;
    stats.successRate = stats.vpAcquisitions / stats.attempts;

    // Update character action stats
    const charKey = `${characterId}:${actionType}`;
    let charStats = this.characterActionStats.get(charKey);
    if (!charStats) {
      charStats = {
        attempts: 0,
        vpAcquisitions: 0,
        totalVP: 0,
        avgVP: 0,
        successRate: 0,
        recentAvgVP: 0,
      };
      this.characterActionStats.set(charKey, charStats);
    }

    charStats.attempts++;
    if (actualVP > 0) {
      charStats.vpAcquisitions++;
    }
    charStats.totalVP += actualVP;
    charStats.avgVP = charStats.totalVP / charStats.attempts;
    charStats.successRate = charStats.vpAcquisitions / charStats.attempts;

    // Calculate recent average (last 5 attempts)
    const recentRecords = Array.from(this.cache.values())
      .filter(r => r.characterId === characterId && r.actionType === actionType)
      .sort((a, b) => b.turn - a.turn)
      .slice(0, 5);

    if (recentRecords.length > 0) {
      charStats.recentAvgVP = recentRecords.reduce((sum, r) => sum + r.actualVP, 0) / recentRecords.length;
    }
  }

  /**
   * Get default VP contribution for action type
   *
   * @param actionType - Action type
   * @returns Default VP contribution
   */
  static getDefaultVPContribution(actionType: ActionType): number {
    return this.DEFAULT_VP_CONTRIBUTION[actionType] ?? 0.0;
  }

  /**
   * Export cache for serialization
   */
  exportState(): {
    records: VPContributionRecord[];
    actionTypeStats: Array<[string, ActionTypeVPStats]>;
    characterActionStats: Array<[string, ActionTypeVPStats]>;
  } {
    return {
      records: this.getAllRecords(),
      actionTypeStats: Array.from(this.actionTypeStats.entries()),
      characterActionStats: Array.from(this.characterActionStats.entries()),
    };
  }

  /**
   * Import cache from serialization
   */
  importState(state: {
    records: VPContributionRecord[];
    actionTypeStats: Array<[string, ActionTypeVPStats]>;
    characterActionStats: Array<[string, ActionTypeVPStats]>;
  }): void {
    this.cache.clear();
    this.actionTypeStats.clear();
    this.characterActionStats.clear();

    for (const record of state.records) {
      const key = `${record.characterId}:${record.turn}:${record.actionType}`;
      this.cache.set(key, record);
    }

    for (const [key, stats] of state.actionTypeStats) {
      this.actionTypeStats.set(key, stats);
    }

    for (const [key, stats] of state.characterActionStats) {
      this.characterActionStats.set(key, stats);
    }
  }
}

/**
 * Global VP prediction cache instance
 */
export const globalVPCache = new VPPredictionCache();
