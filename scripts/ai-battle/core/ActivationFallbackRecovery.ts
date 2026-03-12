import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../../src/lib/mest-tactics/battlefield/spatial/size-utils';
import type {
  ActionStepAudit,
  AuditVector,
  ModelEffectAudit,
  ModelStateAudit,
} from '../../shared/BattleReportTypes';
import type { ReactAuditResult } from '../validation/ValidationMetrics';
import { pickMeleeWeaponForRunner } from './CombatRuntimeSupport';
import {
  computeDirectAdvanceStepForRunner,
  snapToOpenCellForRunner,
} from './MovementPlanningSupport';

export interface StalledDecisionFallbackAdvanceParams {
  character: Character;
  enemies: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  visibilityOrMu: number;
  apBefore: number;
  computeFallbackMovePosition: (
    actor: Character,
    enemies: Character[],
    battlefield: Battlefield
  ) => { x: number; y: number } | null;
  snapshotModelState: (character: Character) => ModelStateAudit;
  processReacts: (
    active: Character,
    opponents: Character[],
    gameManager: GameManager,
    trigger: 'Move' | 'NonMove',
    movedDistance: number,
    reactingToEngaged: boolean,
    visibilityOrMu: number
  ) => ReactAuditResult;
  createMovementVector: (
    start: { x: number; y: number },
    end: { x: number; y: number },
    stepMu?: number
  ) => AuditVector;
  createModelEffect: (
    character: Character,
    relation: ModelEffectAudit['relation'],
    before: ModelStateAudit,
    after: ModelStateAudit
  ) => ModelEffectAudit | null;
  sanitizeForAudit: (value: unknown) => unknown;
  useCheapFallback?: boolean;
}

export interface StalledDecisionFallbackAdvanceResult {
  attempted: boolean;
  executed: boolean;
  apAfter: number;
  movedDistance: number;
  moveResult?: unknown;
  opportunityAttack?: unknown;
  reactResult?: ReactAuditResult;
  stateBefore?: ModelStateAudit;
  stateBeforeReact?: ModelStateAudit;
  stateAfter?: ModelStateAudit;
  step?: ActionStepAudit;
}

export function runStalledDecisionFallbackAdvance(
  params: StalledDecisionFallbackAdvanceParams
): StalledDecisionFallbackAdvanceResult {
  const {
    character,
    enemies,
    battlefield,
    gameManager,
    visibilityOrMu,
    apBefore,
    computeFallbackMovePosition,
    snapshotModelState,
    processReacts,
    createMovementVector,
    createModelEffect,
    sanitizeForAudit,
    useCheapFallback = false,
  } = params;

  // Fallback advance is an AP spend; skip path planning when AP is exhausted.
  if (apBefore <= 0 || gameManager.getApRemaining(character) <= 0) {
    return {
      attempted: false,
      executed: false,
      apAfter: gameManager.getApRemaining(character),
      movedDistance: 0,
    };
  }

  const fallback = (
    useCheapFallback ? computeCheapFallbackMovePosition(character, enemies, battlefield) : null
  ) ?? computeFallbackMovePosition(character, enemies, battlefield);
  if (!fallback) {
    return {
      attempted: false,
      executed: false,
      apAfter: gameManager.getApRemaining(character),
      movedDistance: 0,
    };
  }

  if (!gameManager.spendAp(character, 1)) {
    return {
      attempted: false,
      executed: false,
      apAfter: gameManager.getApRemaining(character),
      movedDistance: 0,
    };
  }

  const fallbackStart = battlefield.getCharacterPosition(character);
  const stateBefore = snapshotModelState(character);
  const opportunityWeapon = pickMeleeWeaponForRunner(character);

  const moveResult = gameManager.executeMove(character, fallback, {
    opponents: enemies,
    allowOpportunityAttack: true,
    opportunityWeapon: opportunityWeapon ?? undefined,
  });
  const apAfterMoveAttempt = gameManager.getApRemaining(character);
  if (!moveResult.moved) {
    return {
      attempted: true,
      executed: false,
      apAfter: apAfterMoveAttempt,
      movedDistance: 0,
      moveResult,
      stateBefore,
    };
  }

  const fallbackEnd = battlefield.getCharacterPosition(character);
  const movedDistance = fallbackStart && fallbackEnd
    ? Math.hypot(fallbackEnd.x - fallbackStart.x, fallbackEnd.y - fallbackStart.y)
    : 0;
  const wasEngagedAtStart = movedDistance > 0 && !!fallbackStart
    && isEngagedWithAnyOpponent(character, enemies, battlefield, fallbackStart);
  const isEngagedAtEnd = movedDistance > 0 && !!fallbackEnd
    && isEngagedWithAnyOpponent(character, enemies, battlefield, fallbackEnd);
  const becameEngagedByMove = movedDistance > 0 && !wasEngagedAtStart && isEngagedAtEnd;
  const stateBeforeReact = snapshotModelState(character);
  const reactResult = processReacts(
    character,
    enemies,
    gameManager,
    movedDistance > 0 ? 'Move' : 'NonMove',
    movedDistance,
    becameEngagedByMove,
    visibilityOrMu
  );
  const stateAfter = snapshotModelState(character);
  const apAfter = gameManager.getApRemaining(character);

  const vectors: AuditVector[] = [];
  if (fallbackStart && fallbackEnd && movedDistance > 0) {
    vectors.push(createMovementVector(fallbackStart, fallbackEnd, 0.5));
  }
  if (reactResult.vector) {
    vectors.push(reactResult.vector);
  }

  const affectedModels: ModelEffectAudit[] = [];
  const selfEffect = createModelEffect(character, 'self', stateBefore, stateAfter);
  if (selfEffect) {
    affectedModels.push(selfEffect);
  }

  const step: ActionStepAudit = {
    sequence: 0,
    actionType: 'move',
    decisionReason: 'Fallback advance after stalled decision',
    resultCode: 'move=true:forced',
    success: true,
    apBefore,
    apAfter,
    apSpent: Math.max(0, apBefore - apAfter),
    actorPositionBefore: fallbackStart ?? undefined,
    actorPositionAfter: fallbackEnd ?? undefined,
    actorStateBefore: stateBefore,
    actorStateAfter: stateAfter,
    vectors,
    targets: [],
    affectedModels,
    interactions: reactResult.executed
      ? [{
          kind: 'react',
          sourceModelId: reactResult.reactor?.id ?? '',
          targetModelId: character.id,
          success: true,
          detail: reactResult.resultCode,
        }]
      : [],
    opposedTest: reactResult.opposedTest,
    details: {
      moveResult: sanitizeForAudit(moveResult) as Record<string, unknown>,
      react: reactResult.details,
    },
  };

  return {
    attempted: true,
    executed: true,
    apAfter,
    movedDistance,
    moveResult,
    opportunityAttack: (moveResult as { opportunityAttack?: unknown }).opportunityAttack,
    reactResult,
    stateBefore,
    stateBeforeReact,
    stateAfter,
    step,
  };
}

function computeCheapFallbackMovePosition(
  actor: Character,
  enemies: Character[],
  battlefield: Battlefield
): { x: number; y: number } | null {
  const actorPos = battlefield.getCharacterPosition(actor);
  if (!actorPos || enemies.length === 0) return null;

  let nearestEnemyPos: { x: number; y: number } | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const enemyPos = battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    const distance = Math.hypot(enemyPos.x - actorPos.x, enemyPos.y - actorPos.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEnemyPos = enemyPos;
    }
  }
  if (!nearestEnemyPos || nearestDistance <= 1) {
    return null;
  }

  const mov = actor.finalAttributes?.mov ?? actor.attributes?.mov ?? 2;
  const moveAllowance = Math.max(1, mov + 2);
  const directAdvance = computeDirectAdvanceStepForRunner(actorPos, nearestEnemyPos, moveAllowance);
  if (!directAdvance) {
    return null;
  }

  return snapToOpenCellForRunner(directAdvance, actor, battlefield) ??
    snapToOpenCellForRunner(actorPos, actor, battlefield);
}

function isEngagedWithAnyOpponent(
  active: Character,
  opponents: Character[],
  battlefield: Battlefield,
  activePosition: { x: number; y: number }
): boolean {
  const activeSiz = active.finalAttributes?.siz ?? active.attributes?.siz ?? 3;
  const activeModel = {
    id: active.id,
    position: activePosition,
    baseDiameter: getBaseDiameterFromSiz(activeSiz),
    siz: activeSiz,
  };
  for (const opponent of opponents) {
    const opponentPosition = battlefield.getCharacterPosition(opponent);
    if (!opponentPosition) continue;
    const opponentSiz = opponent.finalAttributes?.siz ?? opponent.attributes?.siz ?? 3;
    const opponentModel = {
      id: opponent.id,
      position: opponentPosition,
      baseDiameter: getBaseDiameterFromSiz(opponentSiz),
      siz: opponentSiz,
    };
    if (SpatialRules.isEngaged(activeModel, opponentModel)) return true;
  }
  return false;
}
