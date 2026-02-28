/**
 * Audit Service
 * 
 * Captures deterministic, model-by-model game state snapshots for battle replay.
 * Produces audit JSON that can be consumed by SVG animation viewer without re-simulation.
 * 
 * @module mest-tactics/audit
 */

import { Position } from '../battlefield/Position';
import { Character } from '../core/Character';
import { Side } from '../core/Side';

// ============================================================================
// Audit Interfaces
// ============================================================================

/**
 * Model state snapshot at a given moment
 */
export interface ModelStateAudit {
  wounds: number;
  delayTokens: number;
  fearTokens: number;
  isKOd: boolean;
  isEliminated: boolean;
  isHidden: boolean;
  isWaiting: boolean;
  isAttentive: boolean;
  isOrdered: boolean;
}

/**
 * Opposed test audit trail
 */
export interface OpposedTestAudit {
  pass: boolean;
  score?: number;
  participant1Score?: number;
  participant2Score?: number;
  p1Rolls?: number[];
  p2Rolls?: number[];
  finalPools?: Record<string, unknown>;
}

/**
 * Vector visualization (movement, LOS, LOF)
 */
export interface AuditVector {
  kind: 'movement' | 'los' | 'lof';
  from: Position;
  to: Position;
  distanceMu: number;
  widthMu?: number;
  sampleStepMu?: number;
  sampledPoints?: Position[];
}

/**
 * Model effect audit (state changes)
 */
export interface ModelEffectAudit {
  modelId: string;
  modelName: string;
  side?: string;
  relation: 'self' | 'target' | 'opponent' | 'ally' | 'reactor';
  before: ModelStateAudit;
  after: ModelStateAudit;
  changed: string[];
}

/**
 * Action step audit
 */
export interface ActionStepAudit {
  sequence: number;
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
  vectors: AuditVector[];
  targets: Array<{
    modelId: string;
    modelName: string;
    side?: string;
    relation: 'enemy' | 'ally' | 'self';
  }>;
  affectedModels: ModelEffectAudit[];
  interactions: Array<{
    kind: 'action' | 'react' | 'opportunity_attack' | 'status' | 'opposed_test';
    sourceModelId: string;
    targetModelId?: string;
    success?: boolean;
    detail?: string;
  }>;
  opposedTest?: OpposedTestAudit;
  rangeCheck?: {
    distanceMu: number;
    weaponOrMu: number;
    visibilityOrMu: number;
    orm: number;
    effectiveOrMu: number;
    concentratedOrm: number;
    concentratedOrMu: number;
    requiresConcentrate: boolean;
  };
  details?: Record<string, unknown>;
}

/**
 * Activation audit
 */
export interface ActivationAudit {
  activationSequence: number;
  turn: number;
  sideIndex: number;
  sideName: string;
  modelId: string;
  modelName: string;
  initiative: number;
  apStart: number;
  apEnd: number;
  waitAtStart: boolean;
  waitMaintained: boolean;
  waitUpkeepPaid: boolean;
  delayTokensAtStart: number;
  delayTokensAfterUpkeep: number;
  steps: ActionStepAudit[];
  skippedReason?: string;
}

/**
 * Turn audit
 */
export interface TurnAudit {
  turn: number;
  activations: ActivationAudit[];
  sideSummaries: Array<{
    sideName: string;
    activeModelsStart: number;
    activeModelsEnd: number;
  }>;
}

/**
 * Battle audit trace (complete audit payload)
 */
export interface BattleAuditTrace {
  version: '1.0';
  session: {
    missionId: string;
    missionName: string;
    seed?: number;
    lighting: string;
    visibilityOrMu: number;
    maxOrm: number;
    allowConcentrateRangeExtension: boolean;
    perCharacterFovLos: boolean;
  };
  battlefield: {
    widthMu: number;
    heightMu: number;
    movementSampleStepMu: number;
    lofWidthMu: number;
  };
  turns: TurnAudit[];
}

/**
 * Model position snapshot for frame interpolation
 */
export interface ModelFrameState {
  modelId: string;
  sideId: string;
  position: Position;
  state: ModelStateAudit;
  tokens: StatusTokenState[];
}

/**
 * Status token state
 */
export interface StatusTokenState {
  type: 'wound' | 'delay' | 'fear' | 'hidden' | 'wait' | 'done' | 'out_of_ammo' | 'knocked_out' | 'eliminated';
  count: number;
}

/**
 * Audit frame for animation interpolation
 */
export interface AuditFrame {
  frameIndex: number;
  turn: number;
  activationIndex: number;
  sideId: string;
  characterId: string;
  actionType: string;
  apSpent: number;
  modelStates: ModelFrameState[];
  vectors: AuditVector[];
  testResults?: OpposedTestAudit;
  actionLog: string;
}

// ============================================================================
// Audit Service Class
// ============================================================================

/**
 * Audit Service - captures game state for battle replay
 */
export class AuditService {
  private auditTrace: BattleAuditTrace | null = null;
  private currentTurn: TurnAudit | null = null;
  private currentActivation: ActivationAudit | null = null;
  private actionSequence: number = 0;
  private frameIndex: number = 0;
  private frames: AuditFrame[] = [];

  /**
   * Initialize audit service for a new battle
   */
  initialize(options: {
    missionId: string;
    missionName: string;
    seed?: number;
    lighting: string;
    visibilityOrMu: number;
    maxOrm: number;
    allowConcentrateRangeExtension: boolean;
    perCharacterFovLos: boolean;
    battlefieldWidth: number;
    battlefieldHeight: number;
  }): void {
    this.auditTrace = {
      version: '1.0',
      session: {
        missionId: options.missionId,
        missionName: options.missionName,
        seed: options.seed,
        lighting: options.lighting,
        visibilityOrMu: options.visibilityOrMu,
        maxOrm: options.maxOrm,
        allowConcentrateRangeExtension: options.allowConcentrateRangeExtension,
        perCharacterFovLos: options.perCharacterFovLos,
      },
      battlefield: {
        widthMu: options.battlefieldWidth,
        heightMu: options.battlefieldHeight,
        movementSampleStepMu: 0.5,
        lofWidthMu: 0.5,
      },
      turns: [],
    };
    this.frames = [];
    this.frameIndex = 0;
  }

  /**
   * Start turn audit
   */
  startTurn(turn: number): void {
    if (!this.auditTrace) {
      throw new Error('AuditService not initialized. Call initialize() first.');
    }

    this.currentTurn = {
      turn,
      activations: [],
      sideSummaries: [],
    };
    this.actionSequence = 0;
  }

  /**
   * End turn audit
   */
  endTurn(sideSummaries: Array<{ sideName: string; activeModelsStart: number; activeModelsEnd: number }>): void {
    if (!this.currentTurn || !this.auditTrace) {
      throw new Error('No active turn to end.');
    }

    this.currentTurn.sideSummaries = sideSummaries;
    this.auditTrace.turns.push(this.currentTurn);
    this.currentTurn = null;
  }

  /**
   * Start activation audit
   */
  startActivation(activation: {
    activationSequence: number;
    turn: number;
    sideIndex: number;
    sideName: string;
    modelId: string;
    modelName: string;
    initiative: number;
    apStart: number;
    waitAtStart: boolean;
    delayTokensAtStart: number;
  }): void {
    if (!this.currentTurn) {
      throw new Error('No active turn. Call startTurn() first.');
    }

    this.currentActivation = {
      activationSequence: activation.activationSequence,
      turn: activation.turn,
      sideIndex: activation.sideIndex,
      sideName: activation.sideName,
      modelId: activation.modelId,
      modelName: activation.modelName,
      initiative: activation.initiative,
      apStart: activation.apStart,
      apEnd: activation.apStart,
      waitAtStart: activation.waitAtStart,
      waitMaintained: false,
      waitUpkeepPaid: false,
      delayTokensAtStart: activation.delayTokensAtStart,
      delayTokensAfterUpkeep: activation.delayTokensAtStart,
      steps: [],
    };
    this.actionSequence = 0;
  }

  /**
   * End activation audit
   */
  endActivation(apEnd: number, waitMaintained: boolean, waitUpkeepPaid: boolean, delayTokensAfter: number): void {
    if (!this.currentActivation || !this.currentTurn) {
      throw new Error('No active activation to end.');
    }

    this.currentActivation.apEnd = apEnd;
    this.currentActivation.waitMaintained = waitMaintained;
    this.currentActivation.waitUpkeepPaid = waitUpkeepPaid;
    this.currentActivation.delayTokensAfterUpkeep = delayTokensAfter;

    this.currentTurn.activations.push(this.currentActivation);
    this.currentActivation = null;
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
    actorPositionBefore?: Position;
    actorPositionAfter?: Position;
    actorStateBefore: ModelStateAudit;
    actorStateAfter: ModelStateAudit;
    vectors: AuditVector[];
    targets: Array<{
      modelId: string;
      modelName: string;
      side?: string;
      relation: 'enemy' | 'ally' | 'self';
    }>;
    affectedModels: ModelEffectAudit[];
    interactions: Array<{
      kind: 'action' | 'react' | 'opportunity_attack' | 'status' | 'opposed_test';
      sourceModelId: string;
      targetModelId?: string;
      success?: boolean;
      detail?: string;
    }>;
    opposedTest?: OpposedTestAudit;
    rangeCheck?: {
      distanceMu: number;
      weaponOrMu: number;
      visibilityOrMu: number;
      orm: number;
      effectiveOrMu: number;
      concentratedOrm: number;
      concentratedOrMu: number;
      requiresConcentrate: boolean;
    };
    details?: Record<string, unknown>;
  }): void {
    if (!this.currentActivation) {
      throw new Error('No active activation. Call startActivation() first.');
    }

    this.actionSequence++;
    const apSpent = action.apBefore - action.apAfter;

    const actionStep: ActionStepAudit = {
      sequence: this.actionSequence,
      actionType: action.actionType,
      decisionReason: action.decisionReason,
      resultCode: action.resultCode,
      success: action.success,
      apBefore: action.apBefore,
      apAfter: action.apAfter,
      apSpent,
      actorPositionBefore: action.actorPositionBefore,
      actorPositionAfter: action.actorPositionAfter,
      actorStateBefore: action.actorStateBefore,
      actorStateAfter: action.actorStateAfter,
      vectors: action.vectors,
      targets: action.targets,
      affectedModels: action.affectedModels,
      interactions: action.interactions,
      opposedTest: action.opposedTest,
      rangeCheck: action.rangeCheck,
      details: action.details,
    };

    this.currentActivation.steps.push(actionStep);

    // Create audit frame for animation
    this.createFrame(actionStep);
  }

  /**
   * Create audit frame for animation interpolation
   */
  private createFrame(actionStep: ActionStepAudit): void {
    if (!this.currentActivation) return;

    this.frameIndex++;

    // Build model states from affected models + actor
    const modelStates = new Map<string, ModelFrameState>();

    // Add actor state
    modelStates.set(this.currentActivation.modelId, {
      modelId: this.currentActivation.modelId,
      sideId: this.currentActivation.sideName,
      position: actionStep.actorPositionAfter || actionStep.actorPositionBefore || { x: 0, y: 0 },
      state: actionStep.actorStateAfter,
      tokens: thisModelStateToTokens(actionStep.actorStateAfter),
    });

    // Add affected model states
    for (const effect of actionStep.affectedModels) {
      modelStates.set(effect.modelId, {
        modelId: effect.modelId,
        sideId: effect.side || 'unknown',
        position: { x: 0, y: 0 }, // Position unchanged for most effects
        state: effect.after,
        tokens: thisModelStateToTokens(effect.after),
      });
    }

    // Create action log entry
    const actionLog = this.createActionLog(actionStep);

    const frame: AuditFrame = {
      frameIndex: this.frameIndex,
      turn: this.currentActivation.turn,
      activationIndex: this.currentActivation.activationSequence,
      sideId: this.currentActivation.sideName,
      characterId: this.currentActivation.modelId,
      actionType: actionStep.actionType,
      apSpent: actionStep.apSpent,
      modelStates: Array.from(modelStates.values()),
      vectors: actionStep.vectors,
      testResults: actionStep.opposedTest,
      actionLog,
    };

    this.frames.push(frame);
  }

  /**
   * Convert ModelStateAudit to StatusTokenState array
   */
  private ModelStateToTokens(state: ModelStateAudit): StatusTokenState[] {
    const tokens: StatusTokenState[] = [];

    if (state.wounds > 0) {
      tokens.push({ type: 'wound', count: state.wounds });
    }
    if (state.delayTokens > 0) {
      tokens.push({ type: 'delay', count: state.delayTokens });
    }
    if (state.fearTokens > 0) {
      tokens.push({ type: 'fear', count: state.fearTokens });
    }
    if (state.isHidden) {
      tokens.push({ type: 'hidden', count: 1 });
    }
    if (state.isWaiting) {
      tokens.push({ type: 'wait', count: 1 });
    }
    if (state.isKOd) {
      tokens.push({ type: 'knocked_out', count: 1 });
    }
    if (state.isEliminated) {
      tokens.push({ type: 'eliminated', count: 1 });
    }

    return tokens;
  }

  /**
   * Create human-readable action log entry
   */
  private createActionLog(actionStep: ActionStepAudit): string {
    const actor = actionStep.targets.find(t => t.relation === 'self')?.modelName || 'Unknown';
    const actionType = actionStep.actionType.replace(/_/g, ' ');

    if (actionStep.actionType === 'move') {
      return `${actor} moved ${actionStep.vectors.length > 0 ? actionStep.vectors[0].distanceMu.toFixed(1) : '0'} MU`;
    }

    if (actionStep.actionType === 'close_combat_attack' || actionStep.actionType === 'ranged_combat_attack') {
      const target = actionStep.targets.find(t => t.relation === 'enemy');
      const result = actionStep.success ? 'hit' : 'missed';
      return `${actor} ${actionStep.actionType.includes('close') ? 'melee' : 'ranged'} attacked ${target?.modelName || 'enemy'} - ${result}`;
    }

    if (actionStep.actionType === 'wait') {
      return `${actor} went on Wait`;
    }

    if (actionStep.actionType === 'disengage') {
      return `${actor} attempted to disengage - ${actionStep.success ? 'success' : 'failed'}`;
    }

    return `${actor} performed ${actionType}`;
  }

  /**
   * Get complete audit trace
   */
  getAudit(): BattleAuditTrace {
    if (!this.auditTrace) {
      throw new Error('AuditService not initialized. Call initialize() first.');
    }
    return this.auditTrace;
  }

  /**
   * Get all audit frames for animation
   */
  getFrames(): AuditFrame[] {
    return [...this.frames];
  }

  /**
   * Get model state snapshot for all characters
   */
  getModelState(characters: Character[], sides: Side[]): ModelFrameState[] {
    const modelStates: ModelFrameState[] = [];

    for (const character of characters) {
      const side = sides.find(s => s.id === character.sideId);
      const state = this.captureModelState(character);
      
      modelStates.push({
        modelId: character.id,
        sideId: side?.name || 'unknown',
        position: { x: character.position.x, y: character.position.y },
        state,
        tokens: this.ModelStateToTokens(state),
      });
    }

    return modelStates;
  }

  /**
   * Capture current model state
   */
  private captureModelState(character: Character): ModelStateAudit {
    return {
      wounds: character.wounds || 0,
      delayTokens: character.delayTokens || 0,
      fearTokens: character.fearTokens || 0,
      isKOd: character.isKOd || false,
      isEliminated: character.isEliminated || false,
      isHidden: character.isHidden || false,
      isWaiting: character.isWaiting || false,
      isAttentive: character.isAttentive || false,
      isOrdered: character.isOrdered || false,
    };
  }

  /**
   * Reset audit service (for testing)
   */
  reset(): void {
    this.auditTrace = null;
    this.currentTurn = null;
    this.currentActivation = null;
    this.actionSequence = 0;
    this.frameIndex = 0;
    this.frames = [];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global audit service instance
 */
export const auditService = new AuditService();
