/**
 * Audit Trail Builder
 *
 * Creates and manages battle audit trails for replay and analysis.
 * Captures turn-by-turn state including activations, actions, and model effects.
 */

import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import type {
  BattleAuditTrace,
  TurnAudit,
  ActivationAudit,
  ActionStepAudit,
  ModelEffectAudit,
  OpposedTestAudit,
  AuditVector,
  ModelStateAudit,
} from '../../shared/BattleReportTypes';

export interface AuditConfig {
  enabled: boolean;
  includeVectors: boolean;
  includeModelStates: boolean;
  includeTestResults: boolean;
}

export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  enabled: true,
  includeVectors: true,
  includeModelStates: true,
  includeTestResults: true,
};

export function createBattleAuditTrace(
  config: {
    missionId: string;
    missionName: string;
    lighting: string;
    visibilityOrMu: number;
    maxOrm: number;
    allowConcentrateRangeExtension: boolean;
    perCharacterFovLos: boolean;
  },
  battlefield: {
    width: number;
    height: number;
    movementSampleStepMu: number;
    lofWidthMu: number;
    exportPath?: string | null;
  }
): BattleAuditTrace {
  return {
    version: '1.0',
    session: {
      missionId: config.missionId,
      missionName: config.missionName,
      lighting: config.lighting as any,
      visibilityOrMu: config.visibilityOrMu,
      maxOrm: config.maxOrm,
      allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
      perCharacterFovLos: config.perCharacterFovLos,
    },
    battlefield: {
      widthMu: battlefield.width,
      heightMu: battlefield.height,
      movementSampleStepMu: battlefield.movementSampleStepMu,
      lofWidthMu: battlefield.lofWidthMu,
      exportPath: battlefield.exportPath || undefined,
    },
    turns: [],
  };
}

export function createTurnAudit(
  turn: number,
  initiativeOrder: Array<{ sideName: string; characterId: string }>
): TurnAudit {
  return {
    turn,
    activations: [],
    initiativeOrder,
  } as any;
}

export function createActivationAudit(
  sequence: number,
  turn: number,
  sideIndex: number,
  sideName: string,
  modelId: string,
  modelName: string,
  initiative: number,
  apSpent: number = 0,
  apRemaining: number = 2
): ActivationAudit {
  return {
    activationSequence: sequence,
    turn,
    sideIndex,
    sideName,
    modelId,
    modelName,
    initiative,
    apSpent,
    apRemaining,
    steps: [],
    bonusActions: [],
    reactTriggers: [],
    modelEffects: [],
  } as any;
}

export function createActionStepAudit(
  actionType: string,
  actorPositionBefore: Position,
  actorPositionAfter?: Position,
  targetId?: string,
  targetPosition?: Position,
  success?: boolean,
  vectors?: AuditVector[],
  details?: Record<string, unknown>
): ActionStepAudit {
  return {
    actionType,
    actorPositionBefore,
    actorPositionAfter,
    targetId,
    targetPosition,
    success: success ?? true,
    vectors: vectors || [],
    details,
  } as any;
}

export function createModelEffectAudit(
  effectType: string,
  source: string,
  target: string,
  duration?: number,
  value?: number
): ModelEffectAudit {
  return {
    effectType,
    source,
    target,
    duration,
    value,
  } as any;
}

export function toOpposedTestAudit(rawResult: any): OpposedTestAudit | undefined {
  if (!rawResult) {
    return undefined;
  }

  return {
    actorRoll: rawResult.actorRoll,
    actorSuccesses: rawResult.actorSuccesses,
    actorCarryOver: rawResult.actorCarryOver,
    opponentRoll: rawResult.opponentRoll,
    opponentSuccesses: rawResult.opponentSuccesses,
    opponentCarryOver: rawResult.opponentCarryOver,
    margin: rawResult.margin,
    winner: rawResult.winner,
  } as any;
}

export function snapshotModelState(character: Character): ModelStateAudit {
  return {
    characterId: character.id,
    wounds: character.state.wounds,
    statusTokens: character.state.statusTokens || [],
    isWaiting: character.state.isWaiting || false,
    isAttentive: character.state.isAttentive || false,
    isHidden: character.state.isHidden || false,
    isKOd: character.state.isKOd || false,
    isEliminated: character.state.isEliminated || false,
    position: character.position ? { ...character.position } : undefined,
  } as any;
}

export function diffModelState(
  before: ModelStateAudit,
  after: ModelStateAudit
): string[] {
  const changes: string[] = [];

  if (before.wounds !== after.wounds) {
    changes.push(`Wounds: ${before.wounds} → ${after.wounds}`);
  }

  if (before.isWaiting !== after.isWaiting) {
    changes.push(`Waiting: ${before.isWaiting} → ${after.isWaiting}`);
  }

  if (before.isAttentive !== after.isAttentive) {
    changes.push(`Attentive: ${before.isAttentive} → ${after.isAttentive}`);
  }

  if (before.isHidden !== after.isHidden) {
    changes.push(`Hidden: ${before.isHidden} → ${after.isHidden}`);
  }

  if (before.isKOd !== after.isKOd) {
    changes.push(`KO'd: ${before.isKOd} → ${after.isKOd}`);
  }

  if (before.position && after.position) {
    const dx = after.position.x - before.position.x;
    const dy = after.position.y - before.position.y;
    if (dx !== 0 || dy !== 0) {
      changes.push(`Position: (${before.position.x},${before.position.y}) → (${after.position.x},${after.position.y})`);
    }
  }

  return changes;
}

export function createMovementVector(
  from: Position,
  to: Position,
  kind: 'move' | 'los' | 'lof' | 'attack' = 'move',
  success?: boolean
): AuditVector {
  return {
    kind: kind as any,
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
  } as any;
}

export function sampleLinePoints(
  start: Position,
  end: Position,
  stepMu: number = 0.5
): Position[] {
  const points: Position[] = [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(distance / stepMu);

  for (let i = 0; i <= steps; i++) {
    const t = steps > 0 ? i / steps : 0;
    points.push({
      x: start.x + dx * t,
      y: start.y + dy * t,
    });
  }

  return points;
}

export function sanitizeForAudit<T extends Record<string, unknown>>(
  obj: T,
  maxDepth: number = 5,
  currentDepth: number = 0
): T {
  if (currentDepth >= maxDepth) {
    return { ...obj, _sanitized: true } as T;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.slice(0, 100);
    } else if (typeof value === 'object') {
      result[key] = sanitizeForAudit(value as Record<string, unknown>, maxDepth, currentDepth + 1);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}
