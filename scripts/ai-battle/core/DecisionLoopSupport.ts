import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import type { ActionStepAudit } from '../../shared/BattleReportTypes';

interface BuildDecisionTargetsParams {
  decision: ActionDecision;
  allSides: { characters: Character[] }[];
  sideName: string;
  actorId: string;
  resolveSideName: (characterId: string) => string | undefined;
}

interface ValidateDecisionParams {
  actionValidator: {
    validateActionDecision: (decision: ActionDecision, character: Character, context: any) => {
      isValid: boolean;
      errors: string[];
    };
  };
  decision: ActionDecision;
  character: Character;
  turn: number;
  apBefore: number;
  allies: Character[];
  enemies: Character[];
  battlefield: Battlefield;
  shouldValidateWithExecutor: (decision: ActionDecision) => boolean;
  computeFallbackMovePosition: (
    actor: Character,
    enemies: Character[],
    battlefield: Battlefield
  ) => Position | null;
  buildValidationContext: (params: {
    turn: number;
    apRemaining: number;
    allies: Character[];
    enemies: Character[];
    battlefield: Battlefield;
  }) => unknown;
  sanitizeForAudit: (value: unknown) => unknown;
}

export function buildDecisionTargetsForAuditForRunner(
  params: BuildDecisionTargetsParams
): ActionStepAudit['targets'] {
  const {
    decision,
    allSides,
    sideName,
    actorId,
    resolveSideName,
  } = params;

  if (decision.target) {
    const targetSide = resolveSideName(decision.target.id);
    return [{
      modelId: decision.target.id,
      modelName: decision.target.profile.name,
      side: targetSide,
      relation: decision.target.id === actorId
        ? 'self'
        : (targetSide === sideName ? 'ally' : 'enemy'),
    }];
  }

  if (!decision.markerTargetModelId) {
    return [];
  }

  const markerTarget = allSides
    .flatMap(side => side.characters)
    .find(candidate => candidate.id === decision.markerTargetModelId);
  if (!markerTarget) {
    return [];
  }
  const targetSide = resolveSideName(markerTarget.id);
  return [{
    modelId: markerTarget.id,
    modelName: markerTarget.profile.name,
    side: targetSide,
    relation: targetSide === sideName ? 'ally' : 'enemy',
  }];
}

export function validateDecisionForExecutionForRunner(
  params: ValidateDecisionParams
): {
  resultCode?: string;
  details?: Record<string, unknown>;
} {
  const {
    actionValidator,
    decision,
    character,
    turn,
    apBefore,
    allies,
    enemies,
    battlefield,
    shouldValidateWithExecutor,
    computeFallbackMovePosition,
    buildValidationContext,
    sanitizeForAudit,
  } = params;

  let validationDecision: ActionDecision | undefined;
  if (decision.type === 'move' && !decision.position && apBefore > 0) {
    const fallbackMove = computeFallbackMovePosition(character, enemies, battlefield);
    if (fallbackMove) {
      validationDecision = { ...decision, position: fallbackMove };
    }
  } else if (shouldValidateWithExecutor(decision)) {
    validationDecision = decision;
  }

  if (!validationDecision) {
    return {};
  }

  const validationContext = buildValidationContext({
    turn,
    apRemaining: apBefore,
    allies,
    enemies,
    battlefield,
  });
  const decisionValidation = actionValidator.validateActionDecision(
    validationDecision,
    character,
    validationContext
  );
  if (decisionValidation.isValid) {
    return {};
  }

  const validationError = decisionValidation.errors.join(', ') || 'invalid decision';
  return {
    resultCode: `${decision.type}=false:validation:${validationError}`,
    details: {
      validation: sanitizeForAudit(decisionValidation) as Record<string, unknown>,
    },
  };
}
