import { MissionConfig } from '../mission/mission-config';
import { BalanceValidator } from '../mission/balance-validator';

/**
 * Mission Loader
 * Loads mission configurations from JSON files
 */
export class MissionLoader {
  /**
   * Load mission from JSON string
   */
  static fromJSON(json: string): MissionConfig {
    const config = JSON.parse(json) as MissionConfig;
    this.validateConfig(config);
    return config;
  }

  /**
   * Load mission from file path (Node.js environment)
   */
  static async fromFile(filePath: string): Promise<MissionConfig> {
    // In browser environment, this would be fetched
    // In Node.js, use fs module
    if (typeof window === 'undefined') {
      const fs = await import('fs');
      const json = fs.readFileSync(filePath, 'utf-8');
      return this.fromJSON(json);
    } else {
      const response = await fetch(filePath);
      const json = await response.text();
      return this.fromJSON(json);
    }
  }

  /**
   * Load mission by ID from missions directory
   */
  static async byId(missionId: string): Promise<MissionConfig | null> {
    // Map mission IDs to file names
    const missionFiles: Record<string, string> = {
      'QAI_1': '/data/missions/qai-01-elimination.json',
      'QAI_12': '/data/missions/qai-12-convergence.json',
      'QAI_13': '/data/missions/qai-13-rupture.json',
      'QAI_14': '/data/missions/qai-14-signal.json',
      'QAI_15': '/data/missions/qai-15-caches.json',
      'QAI_16': '/data/missions/qai-16-rescue.json',
      'QAI_17': '/data/missions/qai-17-trinity.json',
      'QAI_18': '/data/missions/qai-18-incursion.json',
      'QAI_19': '/data/missions/qai-19-bastion.json',
      'QAI_20': '/data/missions/qai-20-sequence.json',
    };

    const filePath = missionFiles[missionId];
    if (!filePath) {
      return null;
    }

    try {
      return await this.fromFile(filePath);
    } catch (error) {
      console.error(`Failed to load mission ${missionId}:`, error);
      return null;
    }
  }

  /**
   * Get list of available mission IDs
   */
  static getAvailableMissions(): string[] {
    return [
      'QAI_1',
      'QAI_12',
      'QAI_13',
      'QAI_14',
      'QAI_15',
      'QAI_16',
      'QAI_17',
      'QAI_18',
      'QAI_19',
      'QAI_20',
    ];
  }

  /**
   * Validate mission configuration
   */
  private static validateConfig(config: MissionConfig): void {
    // Check required fields
    if (!config.id) {
      throw new Error('Mission config missing required field: id');
    }
    if (!config.name) {
      throw new Error('Mission config missing required field: name');
    }
    if (!config.description) {
      throw new Error('Mission config missing required field: description');
    }
    if (!config.sides) {
      throw new Error('Mission config missing required field: sides');
    }
    if (!config.victoryConditions || config.victoryConditions.length === 0) {
      throw new Error('Mission config must have at least one victory condition');
    }
    if (!config.scoringRules || config.scoringRules.length === 0) {
      throw new Error('Mission config must have at least one scoring rule');
    }

    // Run balance validation (warnings only, don't throw)
    const validation = BalanceValidator.validate(config);
    if (!validation.passed) {
      console.warn(`Mission "${config.name}" balance warnings:`, 
        BalanceValidator.getReport(validation));
    }
  }

  /**
   * Get balance report for a mission config
   */
  static getBalanceReport(config: MissionConfig): string {
    const validation = BalanceValidator.validate(config);
    return BalanceValidator.getReport(validation);
  }
}
