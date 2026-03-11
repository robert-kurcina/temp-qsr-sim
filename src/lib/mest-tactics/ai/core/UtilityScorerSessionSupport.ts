import type { Character } from '../../core/Character';
import type { Position } from '../../battlefield/Position';
import type { Battlefield } from '../../battlefield/Battlefield';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import type { AIContext } from './AIController';
import { PathfindingEngine } from '../../battlefield/pathfinding/PathfindingEngine';
import { isAttackableEnemy } from './ai-utils';

export interface EvaluationSession {
  positionExposureCache: Map<string, number>;
  coverCache: Map<string, number>;
  visibilityCache: Map<string, number>;
  objectiveAdvanceCache: Map<string, number>;
  nearestEnemyDistanceCache: Map<string, number>;
  losPairCache: Map<string, boolean>;
  pathEngine: PathfindingEngine;
  strategicPathQueries: number;
  strategicPathQueryBudget: number;
  strategicEnemyLimit: number;
  strategicObjectiveLimit: number;
  strategicRefineTopK: number;
  strategicCoarseResolution: number;
  strategicDefaultResolution: number;
  localSampleCount: number;
  pathBudgetExceeded: boolean;
}

export interface ActionLegalityMask {
  canMove: boolean;
  canEvaluateTargets: boolean;
  canCloseCombat: boolean;
  canRangedCombat: boolean;
  canDisengage: boolean;
  canSupport: boolean;
  canWeaponSwap: boolean;
  canWait: boolean;
  canPushing: boolean;
  canRefresh: boolean;
  candidateEnemyIds: string[];
}

export interface ActionMaskLoadout {
  hasMeleeWeapons: boolean;
  hasRangedWeapons: boolean;
}

export function buildEnemyActionMaskSignature(
  context: AIContext,
  characterPos: Position | undefined
): string {
  if (!characterPos) {
    return `no-pos:${context.enemies.length}`;
  }

  const candidates = context.enemies
    .filter(enemy => isAttackableEnemy(context.character, enemy, context.config))
    .map(enemy => {
      const pos = context.battlefield.getCharacterPosition(enemy);
      if (!pos) return null;
      const dist = Math.hypot(pos.x - characterPos.x, pos.y - characterPos.y);
      return { enemy, pos, dist };
    })
    .filter((entry): entry is { enemy: Character; pos: Position; dist: number } => Boolean(entry))
    .sort((a, b) => (a.dist === b.dist ? a.enemy.id.localeCompare(b.enemy.id) : a.dist - b.dist))
    .slice(0, 6)
    .map(({ enemy, pos }) =>
      `${enemy.id}@${pos.x.toFixed(1)},${pos.y.toFixed(1)}:${enemy.state.isHidden ? 1 : 0}${enemy.state.isKOd ? 1 : 0}${enemy.state.isEliminated ? 1 : 0}`
    )
    .join(';');

  return `${context.enemies.length}:${candidates}`;
}

export function buildActionMaskCacheKey(
  context: AIContext,
  loadout: ActionMaskLoadout,
  characterPos: Position | undefined
): string {
  const terrainVersion = context.battlefield.getTerrainVersion?.() ?? 0;
  const actorState = context.character.state;
  const actorStateKey = [
    context.apRemaining,
    actorState.isKOd ? 1 : 0,
    actorState.isEliminated ? 1 : 0,
    actorState.isAttentive ? 1 : 0,
    actorState.isOrdered ? 1 : 0,
    actorState.isWaiting ? 1 : 0,
    actorState.isHidden ? 1 : 0,
    actorState.wounds ?? 0,
    actorState.delayTokens ?? 0,
    actorState.fearTokens ?? 0,
    (actorState as any).hasPushedThisInitiative ? 1 : 0,
  ].join(':');

  const positionKey = characterPos
    ? `${characterPos.x.toFixed(1)},${characterPos.y.toFixed(1)}`
    : 'no-pos';
  const engagementKey = context.battlefield.isEngaged?.(context.character) ? 'engaged' : 'free';
  const enemyKey = buildEnemyActionMaskSignature(context, characterPos);
  const allySupportKey = `${context.allies.length}:` +
    `${context.allies.filter(ally => ally.state.isKOd).length}:` +
    `${context.allies.filter(ally => (ally.state.fearTokens ?? 0) > 0).length}`;

  return [
    context.character.id,
    context.currentTurn ?? 0,
    terrainVersion,
    actorStateKey,
    `${loadout.hasMeleeWeapons ? 1 : 0}${loadout.hasRangedWeapons ? 1 : 0}`,
    positionKey,
    engagementKey,
    enemyKey,
    allySupportKey,
  ].join('|');
}

export function computeActionLegalityMask(
  context: AIContext,
  loadout: ActionMaskLoadout,
  isInMeleeRange: (from: Character, to: Character) => boolean
): ActionLegalityMask {
  const canAct =
    !context.character.state.isKOd &&
    !context.character.state.isEliminated;
  const hasAp = context.apRemaining > 0;
  const isEngaged = context.battlefield.isEngaged?.(context.character) ?? false;
  const candidateEnemies = context.enemies.filter(enemy =>
    isAttackableEnemy(context.character, enemy, context.config)
  );
  const engagedEnemyIds = isEngaged
    ? candidateEnemies
        .filter(enemy => isInMeleeRange(context.character, enemy))
        .map(enemy => enemy.id)
    : [];
  const candidateEnemyIds = engagedEnemyIds.length > 0
    ? engagedEnemyIds
    : candidateEnemies.map(enemy => enemy.id);

  const canCloseCombat =
    canAct &&
    context.apRemaining >= 1 &&
    loadout.hasMeleeWeapons &&
    candidateEnemyIds.length > 0;
  const canRangedCombat =
    canAct &&
    context.apRemaining >= 1 &&
    loadout.hasRangedWeapons &&
    candidateEnemies.length > 0;

  const stowedCount = context.character.profile?.stowedItems?.length ?? 0;
  const initiativePoints = context.side?.state?.initiativePoints ?? 0;
  const hasSupportTarget = context.allies.some(ally => ally.state.isKOd || (ally.state.fearTokens ?? 0) > 0);

  return {
    canMove: canAct && hasAp && context.apRemaining >= 1,
    canEvaluateTargets: canCloseCombat || canRangedCombat,
    canCloseCombat,
    canRangedCombat,
    canDisengage: canAct && hasAp && context.apRemaining >= 1 && isEngaged,
    canSupport: canAct && hasAp && context.apRemaining >= 1 && hasSupportTarget,
    canWeaponSwap: canAct && hasAp && context.apRemaining >= 1 && stowedCount > 0,
    canWait:
      canAct &&
      hasAp &&
      (context.config.allowWaitAction ?? true) &&
      context.apRemaining >= 2 &&
      !context.character.state.isWaiting &&
      context.character.state.isAttentive &&
      context.character.state.isOrdered &&
      !isEngaged &&
      loadout.hasRangedWeapons,
    canPushing:
      canAct &&
      context.apRemaining === 0 &&
      context.character.state.isAttentive &&
      !(context.character.state as any).hasPushedThisInitiative &&
      (context.character.state.delayTokens ?? 0) === 0,
    canRefresh:
      canAct &&
      hasAp &&
      (context.character.state.delayTokens ?? 0) > 0 &&
      initiativePoints >= 1,
    candidateEnemyIds,
  };
}

export function createEvaluationSession(context: AIContext): EvaluationSession {
  const boardArea = context.battlefield.width * context.battlefield.height;
  const gameSize = String(context.config.gameSize ?? '').toUpperCase();
  const missionId = String(context.config.missionId ?? '').toUpperCase();
  const isEliminationPressureMission =
    missionId === 'ELIMINATION' ||
    missionId === 'QAI_11' ||
    missionId === 'QAI_17' ||
    missionId === 'QAI_18';
  const attackableEnemyCount = context.enemies.filter(enemy =>
    isAttackableEnemy(context.character, enemy, context.config)
  ).length;

  let strategicPathQueryBudget = 24;
  let strategicEnemyLimit = 12;
  let strategicObjectiveLimit = 3;
  let strategicRefineTopK = 4;
  let strategicCoarseResolution = 1.0;
  let strategicDefaultResolution = 0.5;
  let localSampleCount = 16;

  if (boardArea >= 3000) {
    strategicPathQueryBudget = 10;
    strategicEnemyLimit = 4;
    strategicObjectiveLimit = 2;
    strategicRefineTopK = 2;
    localSampleCount = 10;
  } else if (boardArea >= 1600) {
    strategicPathQueryBudget = 14;
    strategicEnemyLimit = 6;
    strategicObjectiveLimit = 3;
    strategicRefineTopK = 3;
    localSampleCount = 12;
  } else if (boardArea >= 900) {
    strategicPathQueryBudget = 18;
    strategicEnemyLimit = 8;
    strategicObjectiveLimit = 3;
    strategicRefineTopK = 3;
    localSampleCount = 14;
  }
  if (gameSize === 'VERY_SMALL' || gameSize === 'SMALL') {
    // Small boards do not need heavy strategic path probing each decision.
    strategicPathQueryBudget = Math.min(strategicPathQueryBudget, 4);
    strategicEnemyLimit = Math.min(strategicEnemyLimit, 3);
    strategicObjectiveLimit = Math.min(strategicObjectiveLimit, 2);
    strategicRefineTopK = Math.min(strategicRefineTopK, 1);
    strategicDefaultResolution = 0.75;
    localSampleCount = Math.min(localSampleCount, 10);
  }
  if (gameSize === 'VERY_SMALL') {
    if (isEliminationPressureMission) {
      // Keep a tiny strategic probe budget for elimination-heavy missions so melee units
      // can consistently select long-lane advance endpoints on very small boards.
      // Budget stays at 1 to avoid low-reuse refinement misses dominating path cache stats.
      strategicPathQueryBudget = Math.max(1, Math.min(strategicPathQueryBudget, 1));
      strategicEnemyLimit = Math.max(2, Math.min(strategicEnemyLimit, 3));
      strategicObjectiveLimit = Math.min(strategicObjectiveLimit, 1);
      strategicRefineTopK = 1;
    } else {
      // Hard guard: remove strategic path probes in VERY_SMALL to avoid pathological stalls.
      strategicPathQueryBudget = 0;
      strategicEnemyLimit = 0;
      strategicObjectiveLimit = 0;
      strategicRefineTopK = 0;
    }
  }

  strategicEnemyLimit = strategicPathQueryBudget > 0
    ? Math.max(2, Math.min(strategicEnemyLimit, Math.max(2, attackableEnemyCount)))
    : 0;

  return {
    positionExposureCache: new Map(),
    coverCache: new Map(),
    visibilityCache: new Map(),
    objectiveAdvanceCache: new Map(),
    nearestEnemyDistanceCache: new Map(),
    losPairCache: new Map(),
    pathEngine: new PathfindingEngine(context.battlefield),
    strategicPathQueries: 0,
    strategicPathQueryBudget,
    strategicEnemyLimit,
    strategicObjectiveLimit,
    strategicRefineTopK,
    strategicCoarseResolution,
    strategicDefaultResolution,
    localSampleCount,
    pathBudgetExceeded: false,
  };
}

export function positionKey(position: Position): string {
  return `${position.x.toFixed(2)},${position.y.toFixed(2)}`;
}

export function losPositionKey(a: Position, b: Position): string {
  const keyA = positionKey(a);
  const keyB = positionKey(b);
  return keyA <= keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
}

export function tryConsumeStrategicPathBudget(session: EvaluationSession): boolean {
  if (session.strategicPathQueries >= session.strategicPathQueryBudget) {
    session.pathBudgetExceeded = true;
    return false;
  }
  session.strategicPathQueries += 1;
  return true;
}

export function hasCharacterLineOfSight(
  from: Character,
  to: Character,
  battlefield: Battlefield,
  session: EvaluationSession | null,
  toLosPairKey: (a: Position, b: Position) => string
): boolean {
  const fromPos = battlefield.getCharacterPosition(from);
  const toPos = battlefield.getCharacterPosition(to);
  if (!fromPos || !toPos) return false;

  const fromModel = {
    id: from.id,
    position: fromPos,
    baseDiameter: getBaseDiameterFromSiz(from.finalAttributes.siz ?? 3),
    siz: from.finalAttributes.siz ?? 3,
  };
  const toModel = {
    id: to.id,
    position: toPos,
    baseDiameter: getBaseDiameterFromSiz(to.finalAttributes.siz ?? 3),
    siz: to.finalAttributes.siz ?? 3,
  };

  if (session) {
    const key = toLosPairKey(fromPos, toPos);
    const cached = session.losPairCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = SpatialRules.hasLineOfSight(battlefield, fromModel, toModel);
    session.losPairCache.set(key, result);
    return result;
  }

  return SpatialRules.hasLineOfSight(battlefield, fromModel, toModel);
}

export function hasPositionLineOfSight(
  from: Position,
  to: Position,
  battlefield: Battlefield,
  session: EvaluationSession,
  toLosPairKey: (a: Position, b: Position) => string
): boolean {
  const key = toLosPairKey(from, to);
  const cached = session.losPairCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = battlefield.hasLineOfSight(from, to);
  session.losPairCache.set(key, result);
  return result;
}
