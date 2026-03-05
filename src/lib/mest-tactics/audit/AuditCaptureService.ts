/**
 * Audit Capture Service
 * 
 * Captures turn-by-turn audit data during battle execution.
 * Wraps AuditService with game loop integration hooks.
 * 
 * @module mest-tactics/audit
 */

import { AuditService, TurnAudit, ActivationAudit, ActionStepAudit, ModelStateAudit } from './AuditService';
import { Character } from '../core/Character';
import { MissionSide } from '../mission/MissionSide';
import { Position } from '../battlefield/Position';

/**
 * Audit capture configuration
 */
export interface AuditCaptureConfig {
  missionId: string;
  missionName: string;
  seed?: number;
  lighting: string;
  visibilityOrMu: number;
  maxOrm: number;
  battlefieldWidth: number;
  battlefieldHeight: number;
}

/**
 * Audit Capture Service
 * 
 * Provides hooks for capturing audit data during game loop execution.
 * Use this instead of AuditService directly for battle integration.
 */
export class AuditCaptureService {
  private auditService: AuditService;
  private config: AuditCaptureConfig;
  private activationSequence = 0;

  constructor(auditService: AuditService, config: AuditCaptureConfig) {
    this.auditService = auditService;
    this.config = config;
  }

  /**
   * Initialize audit capture at start of battle
   */
  initialize(): void {
    this.auditService.initialize({
      missionId: this.config.missionId,
      missionName: this.config.missionName,
      seed: this.config.seed,
      lighting: this.config.lighting,
      visibilityOrMu: this.config.visibilityOrMu,
      maxOrm: this.config.maxOrm,
      allowConcentrateRangeExtension: true,
      perCharacterFovLos: false,
      battlefieldWidth: this.config.battlefieldWidth,
      battlefieldHeight: this.config.battlefieldHeight,
    });
    this.activationSequence = 0;
  }

  /**
   * Capture turn start
   */
  startTurn(turn: number, sides: MissionSide[]): void {
    this.auditService.startTurn(turn);
  }

  /**
   * Capture turn end
   */
  endTurn(sides: MissionSide[]): void {
    const sideSummaries = sides.map(side => ({
      sideName: side.name,
      activeModelsStart: side.members.filter(m => !m.character.state.isEliminated && !m.character.state.isKOd).length,
      activeModelsEnd: side.members.filter(m => !m.character.state.isEliminated && !m.character.state.isKOd).length,
    }));
    this.auditService.endTurn(sideSummaries);
  }

  /**
   * Capture activation start
   */
  startActivation(
    character: Character,
    turn: number,
    sideIndex: number,
    sideName: string,
    apStart: number
  ): void {
    this.auditService.startActivation({
      activationSequence: ++this.activationSequence,
      turn,
      sideIndex,
      sideName,
      modelId: character.id,
      modelName: character.profile.name,
      initiative: character.finalAttributes?.int ?? character.attributes?.int ?? 0,
      apStart,
      waitAtStart: character.state.isWaiting || false,
      delayTokensAtStart: character.state.delayTokens || 0,
    });
  }

  /**
   * Capture activation end
   */
  endActivation(
    apEnd: number,
    waitMaintained: boolean,
    waitUpkeepPaid: boolean,
    delayTokensAfter: number
  ): void {
    this.auditService.endActivation(apEnd, waitMaintained, waitUpkeepPaid, delayTokensAfter);
  }

  /**
   * Record action step
   */
  recordAction(action: {
    actionType: string;
    decisionReason?: string;
    resultCode: string;
    success: boolean;
    apBefore: number;
    apAfter: number;
    apSpent: number;
    actorPositionBefore?: Position;
    actorPositionAfter?: Position;
    actorStateBefore: ModelStateAudit;
    actorStateAfter: ModelStateAudit;
    vectors?: any[];
    targets?: any[];
    affectedModels?: any[];
    interactions?: any[];
    opposedTest?: any;
    details?: Record<string, any>;
  }): void {
    this.auditService.recordAction(action as any);
  }

  /**
   * Get captured audit data
   */
  getAudit(): any {
    return this.auditService.getAudit();
  }

  /**
   * Reset audit capture (for reuse)
   */
  reset(): void {
    this.auditService.reset();
    this.activationSequence = 0;
  }
}

/**
 * Create audit capture service from config
 */
export function createAuditCaptureService(
  config: AuditCaptureConfig
): AuditCaptureService {
  const auditService = new AuditService();
  return new AuditCaptureService(auditService, config);
}
