import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import type {
  AuditVector,
  ModelEffectAudit,
  ModelStateAudit,
  ModelUsageStats,
  OpposedTestAudit,
  UsageMetrics,
} from '../../shared/BattleReportTypes';

export function buildUsageMetrics(
  modelUsageByCharacter: Map<Character, ModelUsageStats>
): UsageMetrics {
  const usage = Array.from(modelUsageByCharacter.values());
  const modelsMoved = usage.filter(model => model.pathLength > 0).length;
  const modelsUsedWait = usage.filter(model => model.waitSuccesses > 0).length;
  const modelsUsedDetect = usage.filter(model => model.detectSuccesses > 0).length;
  const modelsUsedHide = usage.filter(model => model.hideSuccesses > 0).length;
  const modelsUsedReact = usage.filter(model => model.reactSuccesses > 0).length;
  const totalPathLength = usage.reduce((sum, model) => sum + model.pathLength, 0);
  const averagePathLengthPerMovedModel = modelsMoved > 0 ? totalPathLength / modelsMoved : 0;
  const averagePathLengthPerModel = usage.length > 0 ? totalPathLength / usage.length : 0;
  const topPathModels = [...usage]
    .filter(model => model.pathLength > 0)
    .sort((a, b) => b.pathLength - a.pathLength)
    .slice(0, 10);

  return {
    totalTokens: 0,
    tokensPerActivation: 0,
    decisionLatencyMs: 0,
    modelCount: usage.length,
    modelsMoved,
    modelsUsedWait,
    modelsUsedDetect,
    modelsUsedHide,
    modelsUsedReact,
    totalPathLength,
    averagePathLengthPerMovedModel,
    averagePathLengthPerModel,
    topPathModels,
  };
}

export function snapshotModelState(character: Character): ModelStateAudit {
  return {
    wounds: character.state.wounds ?? 0,
    delayTokens: character.state.delayTokens ?? 0,
    fearTokens: character.state.fearTokens ?? 0,
    isKOd: Boolean(character.state.isKOd),
    isEliminated: Boolean(character.state.isEliminated),
    isHidden: Boolean(character.state.isHidden),
    isWaiting: Boolean(character.state.isWaiting),
    isAttentive: Boolean(character.state.isAttentive),
    isOrdered: Boolean(character.state.isOrdered),
  };
}

export function diffModelState(before: ModelStateAudit, after: ModelStateAudit): string[] {
  const changes: string[] = [];
  const keys = Object.keys(before) as Array<keyof ModelStateAudit>;
  for (const key of keys) {
    if (before[key] !== after[key]) {
      changes.push(String(key));
    }
  }
  return changes;
}

export function sampleLinePoints(start: Position, end: Position, stepMu: number = 0.5): Position[] {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  if (!Number.isFinite(distance) || distance <= 0) {
    return [start];
  }

  const points: Position[] = [start];
  const count = Math.floor(distance / stepMu);
  for (let i = 1; i <= count; i++) {
    const ratio = Math.min(1, (i * stepMu) / distance);
    points.push({
      x: Number((start.x + (end.x - start.x) * ratio).toFixed(3)),
      y: Number((start.y + (end.y - start.y) * ratio).toFixed(3)),
    });
  }
  if (points.length === 0 || points[points.length - 1].x !== end.x || points[points.length - 1].y !== end.y) {
    points.push(end);
  }
  return points;
}

export function createMovementVector(start: Position, end: Position, stepMu: number = 0.5): AuditVector {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const sampledPoints = sampleLinePoints(start, end, stepMu);
  return {
    kind: 'movement',
    from: start,
    to: end,
    distanceMu: distance,
    sampleStepMu: stepMu,
    sampledPoints,
  };
}

export function toOpposedTestAudit(rawResult: unknown): OpposedTestAudit | undefined {
  const typedResult = rawResult as { result?: { hitTestResult?: unknown }; hitTestResult?: unknown } | undefined;
  const hitTest = typedResult?.result?.hitTestResult ?? typedResult?.hitTestResult;
  if (!hitTest || typeof hitTest !== 'object') {
    return undefined;
  }
  const typedHitTest = hitTest as {
    pass?: unknown;
    score?: unknown;
    participant1Score?: unknown;
    participant2Score?: unknown;
    p1Rolls?: unknown;
    p2Rolls?: unknown;
    finalPools?: unknown;
  };

  return {
    pass: Boolean(typedHitTest.pass),
    score: typeof typedHitTest.score === 'number' ? typedHitTest.score : undefined,
    participant1Score: typeof typedHitTest.participant1Score === 'number' ? typedHitTest.participant1Score : undefined,
    participant2Score: typeof typedHitTest.participant2Score === 'number' ? typedHitTest.participant2Score : undefined,
    p1Rolls: Array.isArray(typedHitTest.p1Rolls) ? typedHitTest.p1Rolls : undefined,
    p2Rolls: Array.isArray(typedHitTest.p2Rolls) ? typedHitTest.p2Rolls : undefined,
    finalPools: typedHitTest.finalPools && typeof typedHitTest.finalPools === 'object'
      ? typedHitTest.finalPools as Record<string, unknown>
      : undefined,
  };
}

export function createModelEffect(
  character: Character,
  relation: ModelEffectAudit['relation'],
  before: ModelStateAudit,
  after: ModelStateAudit,
  sideNameByCharacterId: Map<string, string>
): ModelEffectAudit | null {
  const changed = diffModelState(before, after);
  if (changed.length === 0) return null;
  return {
    modelId: character.id,
    modelName: character.profile.name,
    side: sideNameByCharacterId.get(character.id),
    relation,
    before,
    after,
    changed,
  };
}

export function sanitizeForAudit(
  value: unknown,
  options: {
    snapshotModelState: (character: Character) => ModelStateAudit;
    resolveSideName: (characterId: string) => string | undefined;
  },
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet<object>()
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (depth >= 4) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, 25).map(item => sanitizeForAudit(item, options, depth + 1, seen));
  }

  if (value instanceof Character) {
    return {
      id: value.id,
      name: value.profile.name,
      side: options.resolveSideName(value.id),
      state: options.snapshotModelState(value),
    };
  }

  if (value instanceof Battlefield) {
    return {
      width: value.width,
      height: value.height,
    };
  }

  if (value instanceof Map) {
    const entries = Array.from(value.entries()).slice(0, 25).map(([k, v]) => [
      sanitizeForAudit(k, options, depth + 1, seen),
      sanitizeForAudit(v, options, depth + 1, seen),
    ]);
    return { mapEntries: entries };
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[circular]';
    seen.add(value as object);
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      if (typeof val === 'function') continue;
      output[key] = sanitizeForAudit(val, options, depth + 1, seen);
    }
    return output;
  }

  return String(value);
}
