import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../../src/lib/mest-tactics/battlefield/spatial/size-utils';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type {
  ActionStepAudit,
  AuditVector,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';
import type { ReactAuditResult } from '../validation/ValidationMetrics';
import { mergeReactOutcomeIntoStepForRunner } from './ReactOutcomeTracking';

interface ApplyActionExecutionReactPostProcessingParams {
  actionExecuted: boolean;
  character: Character;
  enemies: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  visibilityOrMu: number;
  startPos?: Position;
  stepVectors: AuditVector[];
  stepInteractions: ActionStepAudit['interactions'];
  stepOpposedTest: OpposedTestAudit | undefined;
  stepDetails: Record<string, unknown> | undefined;
  snapshotModelState: (model: Character) => ModelStateAudit;
  createMovementVector: (start: Position, end: Position, stepMu?: number) => AuditVector;
  incrementTotalActions: () => void;
  trackPathMovement: (model: Character, movedDistance: number) => void;
  processMoveConcludedPassives: (movedDistance: number) => void;
  processReacts: (
    active: Character,
    opponents: Character[],
    gameManager: GameManager,
    trigger: 'Move' | 'NonMove',
    movedDistance: number,
    reactingToEngaged: boolean,
    visibilityOrMu: number
  ) => ReactAuditResult;
  trackReactOutcome: (
    reactResult: ReactAuditResult | undefined,
    active: Character,
    actorStateBeforeReact: ModelStateAudit,
    actorStateAfterReact: ModelStateAudit
  ) => void;
}

export interface ActionExecutionReactPostProcessingResult {
  endPos?: Position;
  movedDistance: number;
  stepOpposedTest: OpposedTestAudit | undefined;
  stepDetails: Record<string, unknown> | undefined;
}

export function applyActionExecutionReactPostProcessingForRunner(
  params: ApplyActionExecutionReactPostProcessingParams
): ActionExecutionReactPostProcessingResult {
  const {
    actionExecuted,
    character,
    enemies,
    battlefield,
    gameManager,
    visibilityOrMu,
    startPos,
    stepVectors,
    stepInteractions,
    stepOpposedTest,
    stepDetails,
    snapshotModelState,
    createMovementVector,
    incrementTotalActions,
    trackPathMovement,
    processMoveConcludedPassives,
    processReacts,
    trackReactOutcome,
  } = params;

  const endPos = battlefield.getCharacterPosition(character);
  if (!actionExecuted) {
    return {
      endPos: endPos ?? undefined,
      movedDistance: 0,
      stepOpposedTest,
      stepDetails,
    };
  }

  incrementTotalActions();
  const movedDistance = startPos && endPos
    ? Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y)
    : 0;
  trackPathMovement(character, movedDistance);
  if (startPos && endPos && movedDistance > 0) {
    stepVectors.push(createMovementVector(startPos, endPos, 0.5));
  }
  processMoveConcludedPassives(movedDistance);

  let mergedStepDetails = stepDetails;
  if (movedDistance > 0 && character.state?.isHidden) {
    const resolver = (gameManager as unknown as {
      resolveHiddenExposure?: (
        model: Character,
        opponents: Character[],
        options?: { allowReposition?: boolean; visibilityOrMu?: number }
      ) => { revealed: boolean; repositioned?: boolean; position?: Position };
    }).resolveHiddenExposure;
    if (typeof resolver === 'function') {
      const hiddenExposure = resolver(character, enemies, {
        allowReposition: false,
        visibilityOrMu,
      });
      if (hiddenExposure?.revealed) {
        mergedStepDetails = {
          ...(mergedStepDetails ?? {}),
          hiddenExposure,
        };
      }
    }
  }

  const trigger = movedDistance > 0 ? 'Move' : 'NonMove';
  const wasEngagedAtStart = trigger === 'Move'
    && movedDistance > 0
    && !!startPos
    && isEngagedWithAnyOpponent(character, enemies, battlefield, startPos);
  const isEngagedAtEnd = trigger === 'Move'
    && movedDistance > 0
    && !!endPos
    && isEngagedWithAnyOpponent(character, enemies, battlefield, endPos);
  const becameEngagedByMove = trigger === 'Move' && movedDistance > 0 && !wasEngagedAtStart && isEngagedAtEnd;
  const actorStateBeforeReact = snapshotModelState(character);
  const reactResult = processReacts(
    character,
    enemies,
    gameManager,
    trigger,
    movedDistance,
    becameEngagedByMove,
    visibilityOrMu
  );
  const actorStateAfterReact = snapshotModelState(character);
  trackReactOutcome(
    reactResult,
    character,
    actorStateBeforeReact,
    actorStateAfterReact
  );

  const mergedReactStep = mergeReactOutcomeIntoStepForRunner({
    reactResult,
    activeModelId: character.id,
    stepInteractions,
    stepVectors,
    stepOpposedTest,
    stepDetails: mergedStepDetails,
  });
  return {
    endPos: endPos ?? undefined,
    movedDistance,
    stepOpposedTest: mergedReactStep.opposedTest,
    stepDetails: mergedReactStep.details,
  };
}

function isEngagedWithAnyOpponent(
  active: Character,
  opponents: Character[],
  battlefield: Battlefield,
  activePosition: Position
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
    if (SpatialRules.isEngaged(activeModel, opponentModel)) {
      return true;
    }
  }

  return false;
}
