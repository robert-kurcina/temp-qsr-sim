import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import type {
  ActionStepAudit,
  AuditVector,
  GameConfig,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';
import {
  assessCloseCombatLegalityForRunner,
  areCharactersEngagedForRunner,
  computeEngageMovePositionForRunner,
} from './MovementPlanningSupport';
import { pickMeleeWeaponForRunner } from './CombatRuntimeSupport';
import {
  executeCloseCombatActionForRunner,
  executeDisengageActionForRunner,
  executeRangedCombatActionForRunner,
  type CombatActionResolutionDeps,
} from './CombatActionResolution';

const CORE_DECISION_TYPES = new Set<ActionDecision['type']>([
  'hold',
  'wait',
  'move',
  'charge',
  'close_combat',
  'ranged_combat',
  'disengage',
]);

type CoreDecisionType =
  | 'hold'
  | 'wait'
  | 'move'
  | 'charge'
  | 'close_combat'
  | 'ranged_combat'
  | 'disengage';

interface CoreDecisionExecutionResult {
  actionExecuted: boolean;
  resultCode: string;
  opposedTest?: OpposedTestAudit;
  rangeCheck?: ActionStepAudit['rangeCheck'];
  details?: Record<string, unknown>;
  vectors: AuditVector[];
}

interface WaitActionResult {
  executed: boolean;
  resultCode: string;
  details: Record<string, unknown>;
}

interface MoveAndOpportunityResult {
  moved: boolean;
  moveResult: unknown;
  opposedTest: OpposedTestAudit | undefined;
  details: Record<string, unknown> | undefined;
}

interface ExecuteCoreDecisionParams {
  decision: ActionDecision;
  character: Character;
  allies: Character[];
  enemies: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  config: GameConfig;
  sideIndex: number;
  turn: number;
  apBefore: number;
  actionValidator: {
    validateActionDecision: (
      decision: ActionDecision,
      character: Character,
      context: any
    ) => { isValid: boolean; errors: string[] };
  };
  computeFallbackMovePosition: (
    actor: Character,
    enemies: Character[],
    battlefield: Battlefield
  ) => Position | null;
  maximizeClosingMoveDestination: (
    actor: Character,
    intendedDestination: Position,
    enemies: Character[],
    battlefield: Battlefield
  ) => Position;
  executeMoveAndTrackOpportunity: (
    gameManager: GameManager,
    character: Character,
    destination: Position,
    enemies: Character[],
    actorStateBefore: ModelStateAudit,
    stepInteractions: ActionStepAudit['interactions'],
    stepOpposedTest: OpposedTestAudit | undefined,
    stepDetails: Record<string, unknown> | undefined
  ) => MoveAndOpportunityResult;
  executeWaitAction: (
    character: Character,
    opponents: Character[],
    gameManager: GameManager,
    visibilityOrMu: number,
    selectionSource: string | undefined,
    allowWaitAction: boolean
  ) => WaitActionResult;
  buildExecutorValidationContext: (params: {
    turn: number;
    apRemaining: number;
    allies: Character[];
    enemies: Character[];
    battlefield: Battlefield;
  }) => unknown;
  sanitizeForAudit: (value: unknown) => unknown;
  buildCombatActionResolutionDeps: () => CombatActionResolutionDeps;
  incrementAction: (actionType: string) => void;
  actorStateBefore: ModelStateAudit;
  stepInteractions: ActionStepAudit['interactions'];
  actionsTakenThisInitiative?: number;
  initialOpposedTest?: OpposedTestAudit;
  initialRangeCheck?: ActionStepAudit['rangeCheck'];
  initialDetails?: Record<string, unknown>;
}

function isCoreDecisionType(type: ActionDecision['type']): type is CoreDecisionType {
  return CORE_DECISION_TYPES.has(type);
}

export async function executeCoreDecisionForRunner(
  params: ExecuteCoreDecisionParams
): Promise<CoreDecisionExecutionResult | null> {
  const {
    decision,
    character,
    allies,
    enemies,
    battlefield,
    gameManager,
    config,
    sideIndex,
    turn,
    apBefore,
    actionValidator,
    computeFallbackMovePosition,
    maximizeClosingMoveDestination,
    executeMoveAndTrackOpportunity,
    executeWaitAction,
    buildExecutorValidationContext,
    sanitizeForAudit,
    buildCombatActionResolutionDeps,
    incrementAction,
    actorStateBefore,
    stepInteractions,
    actionsTakenThisInitiative = 0,
    initialOpposedTest,
    initialRangeCheck,
    initialDetails,
  } = params;

  if (!isCoreDecisionType(decision.type)) {
    return null;
  }
  const traceSlowSteps = process.env.AI_BATTLE_TRACE_SLOW_STEPS === '1';

  let actionExecuted = false;
  let resultCode = '';
  let stepOpposedTest = initialOpposedTest;
  let stepRangeCheck = initialRangeCheck;
  let stepDetails = initialDetails;
  const vectors: AuditVector[] = [];

  switch (decision.type) {
    case 'hold': {
      if (apBefore > 0) {
        const fallback = computeFallbackMovePosition(character, enemies, battlefield);
        if (fallback && gameManager.spendAp(character, 1)) {
          const moveOutcome = executeMoveAndTrackOpportunity(
            gameManager,
            character,
            fallback,
            enemies,
            actorStateBefore,
            stepInteractions,
            stepOpposedTest,
            undefined
          );
          if (moveOutcome.moved) {
            stepOpposedTest = moveOutcome.opposedTest;
            incrementAction('Move');
            actionExecuted = true;
            resultCode = 'move=true:from-hold';
            stepDetails = {
              source: 'hold_fallback_move',
              moveResult: sanitizeForAudit(moveOutcome.moveResult) as Record<string, unknown>,
              opportunityAttack: (
                moveOutcome.details as { opportunityAttack?: Record<string, unknown> } | undefined
              )?.opportunityAttack,
            };
            break;
          }
        }
      }

      const waitFromHold = executeWaitAction(
        character,
        enemies,
        gameManager,
        config.visibilityOrMu,
        'utility',
        config.allowWaitAction !== false
      );
      resultCode = waitFromHold.resultCode;
      stepDetails = waitFromHold.details;
      actionExecuted = waitFromHold.executed;
      break;
    }
    case 'wait': {
      const waitDecision = executeWaitAction(
        character,
        enemies,
        gameManager,
        config.visibilityOrMu,
        decision.planning?.source,
        config.allowWaitAction !== false
      );
      resultCode = waitDecision.resultCode;
      stepDetails = waitDecision.details;
      actionExecuted = waitDecision.executed;
      break;
    }
    case 'move': {
      if (!gameManager.spendAp(character, 1)) {
        resultCode = 'move=false:not-enough-ap';
        break;
      }
      const destinationResolveStartMs = Date.now();
      let destination = decision.position ?? computeFallbackMovePosition(character, enemies, battlefield);
      const destinationResolveMs = Date.now() - destinationResolveStartMs;
      if (!destination) {
        resultCode = 'move=false:no-destination';
        break;
      }
      const maximizeStartMs = Date.now();
      destination = maximizeClosingMoveDestination(
        character,
        destination,
        enemies,
        battlefield
      );
      const maximizeMs = Date.now() - maximizeStartMs;
      const executeMoveStartMs = Date.now();
      const moveOutcome = executeMoveAndTrackOpportunity(
        gameManager,
        character,
        destination,
        enemies,
        actorStateBefore,
        stepInteractions,
        stepOpposedTest,
        undefined
      );
      const executeMoveMs = Date.now() - executeMoveStartMs;
      if (traceSlowSteps && (destinationResolveMs > 1000 || maximizeMs > 1000 || executeMoveMs > 1000)) {
        console.warn(
          `[DEBUG] slow move internals ${character.profile.name}: destinationResolveMs=${destinationResolveMs.toFixed(1)}, maximizeMs=${maximizeMs.toFixed(1)}, executeMoveMs=${executeMoveMs.toFixed(1)}`
        );
      }
      if (moveOutcome.moved) {
        incrementAction('Move');
        actionExecuted = true;
        resultCode = 'move=true';
      } else {
        resultCode = `move=false:${(moveOutcome.moveResult as { reason?: string })?.reason ?? 'blocked'}`;
      }
      stepOpposedTest = moveOutcome.opposedTest;
      stepDetails = {
        ...(moveOutcome.details ?? {}),
        moveResult: sanitizeForAudit(moveOutcome.moveResult) as Record<string, unknown>,
      };
      break;
    }
    case 'charge':
    case 'close_combat': {
      if (!decision.target) {
        resultCode = 'close_combat=false:no-target';
        break;
      }

      const isChargeDecision = decision.type === 'charge';
      const meleeWeapon = pickMeleeWeaponForRunner(character);
      if (!meleeWeapon) {
        resultCode = 'close_combat=false:no-weapon';
        break;
      }
      const projectedAttackCost = gameManager.getAttackApCost(character, meleeWeapon as any);

      let movedForEngagement = false;
      const wasEngaged = areCharactersEngagedForRunner(character, decision.target, battlefield);
      const preMoveMeleeLegality = assessCloseCombatLegalityForRunner(character, decision.target, battlefield, {
        actionsTakenThisInitiative,
      });
      if (isChargeDecision && wasEngaged) {
        resultCode = 'charge=false:already-engaged';
        break;
      }
      if (isChargeDecision && !wasEngaged && apBefore < (1 + projectedAttackCost)) {
        resultCode = `charge=false:not-enough-ap-for-charge-attack(${1 + projectedAttackCost})`;
        break;
      }

      const canAttackWithoutMoving = !isChargeDecision && !wasEngaged && preMoveMeleeLegality.canAttack;
      if (!wasEngaged && !canAttackWithoutMoving) {
        const engagePos = computeEngageMovePositionForRunner(character, decision.target, battlefield, {
          requireEngagement: true,
        });
        if (!engagePos && isChargeDecision) {
          resultCode = 'charge=false:out-of-range';
          break;
        }
        if (engagePos) {
          if (!gameManager.spendAp(character, 1)) {
            resultCode = isChargeDecision
              ? 'charge=false:not-enough-ap-for-move'
              : 'close_combat=false:not-enough-ap-for-move';
            break;
          }
          const moveOutcome = executeMoveAndTrackOpportunity(
            gameManager,
            character,
            engagePos,
            enemies,
            actorStateBefore,
            stepInteractions,
            stepOpposedTest,
            stepDetails
          );
          if (moveOutcome.moved) {
            stepOpposedTest = moveOutcome.opposedTest;
            stepDetails = {
              ...(moveOutcome.details ?? {}),
              engageMoveResult: sanitizeForAudit(moveOutcome.moveResult) as Record<string, unknown>,
            };
            movedForEngagement = true;
            actionExecuted = true;
            incrementAction('Move');
          } else if (isChargeDecision) {
            resultCode = `charge=false:${(moveOutcome.moveResult as { reason?: string })?.reason ?? 'blocked'}`;
          }
        }
      }

      const postMoveMeleeLegality = assessCloseCombatLegalityForRunner(character, decision.target, battlefield, {
        actionsTakenThisInitiative,
      });
      if (postMoveMeleeLegality.canAttack) {
        const meleeValidation = actionValidator.validateActionDecision(
          {
            ...decision,
            type: 'close_combat',
            target: decision.target,
          },
          character,
          buildExecutorValidationContext({
            turn,
            apRemaining: gameManager.getApRemaining(character),
            allies,
            enemies,
            battlefield,
          })
        );
        if (!meleeValidation.isValid) {
          const validationError = meleeValidation.errors.join(', ') || 'invalid close combat';
          resultCode = isChargeDecision
            ? `charge=false:validation:${validationError}`
            : `close_combat=false:validation:${validationError}`;
          stepDetails = {
            ...(stepDetails ?? {}),
            validation: sanitizeForAudit(meleeValidation) as Record<string, unknown>,
          };
          break;
        }

        const attackCost = gameManager.getAttackApCost(character, meleeWeapon as any);
        if (!gameManager.spendAp(character, attackCost)) {
          resultCode = isChargeDecision
            ? `charge=false:not-enough-ap-for-attack(${attackCost})`
            : `close_combat=false:not-enough-ap(${attackCost})`;
          break;
        }
        const closeExecuted = await executeCloseCombatActionForRunner({
          attacker: character,
          defender: decision.target,
          battlefield,
          gameManager,
          config,
          sideIndex,
          allies,
          opponents: enemies,
          isCharge: decision.type === 'charge' || movedForEngagement,
          isOverreach: postMoveMeleeLegality.requiresOverreach,
          deps: buildCombatActionResolutionDeps(),
        });
        actionExecuted = actionExecuted || closeExecuted.executed;
        resultCode = closeExecuted.resultCode;
        if (closeExecuted.executed) {
          incrementAction('CloseCombatAttack');
        }
        stepOpposedTest = closeExecuted.opposedTest;
        stepDetails = closeExecuted.details;
      } else if (!actionExecuted) {
        resultCode = isChargeDecision ? 'charge=false:not-engaged' : 'close_combat=false:not-engaged';
      }
      break;
    }
    case 'ranged_combat': {
      if (!decision.target) {
        resultCode = 'ranged=false:no-target';
        break;
      }
      const ranged = await executeRangedCombatActionForRunner({
        attacker: character,
        defender: decision.target,
        battlefield,
        gameManager,
        config,
        sideIndex,
        allies,
        opponents: enemies,
        deps: buildCombatActionResolutionDeps(),
      });
      actionExecuted = ranged.executed;
      resultCode = ranged.result;
      if (ranged.executed) {
        incrementAction('RangedAttack');
      }
      stepOpposedTest = ranged.opposedTest;
      stepRangeCheck = ranged.rangeCheck;
      if (ranged.vectors.length > 0) {
        vectors.push(...ranged.vectors);
      }
      stepDetails = ranged.details;
      break;
    }
    case 'disengage': {
      if (!decision.target) {
        resultCode = 'disengage=false:no-target';
        break;
      }
      if (!gameManager.spendAp(character, 1)) {
        resultCode = 'disengage=false:not-enough-ap';
        break;
      }
      incrementAction('Disengage');
      const disengage = await executeDisengageActionForRunner({
        disengager: character,
        defender: decision.target,
        battlefield,
        gameManager,
        config,
        sideIndex,
        allies,
        opponents: enemies,
        deps: buildCombatActionResolutionDeps(),
      });
      actionExecuted = disengage.executed;
      resultCode = disengage.resultCode;
      stepOpposedTest = disengage.opposedTest;
      stepDetails = disengage.details;
      break;
    }
    default:
      return null;
  }

  return {
    actionExecuted,
    resultCode,
    opposedTest: stepOpposedTest,
    rangeCheck: stepRangeCheck,
    details: stepDetails,
    vectors,
  };
}
