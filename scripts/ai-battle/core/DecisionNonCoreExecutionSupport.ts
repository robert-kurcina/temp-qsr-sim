import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import { attemptDetect, attemptHide } from '../../../src/lib/mest-tactics/status/concealment';
import { shouldUseLeanForDetectWithCover } from './AIDecisionSupport';
import { executeFiddleActionForRunner } from './FiddleActionResolution';
import { executeSupportActionForRunner } from './SupportActionResolution';
import {
  executeDetectActionForRunner,
  executeHideActionForRunner,
} from './ConcealmentActionResolution';
import {
  executePushingActionForRunner,
  executeRefreshActionForRunner,
} from './TempoActionResolution';

const NON_CORE_DECISION_TYPES = new Set<ActionDecision['type']>([
  'detect',
  'hide',
  'pushing',
  'refresh',
  'rally',
  'revive',
  'fiddle',
]);

type NonCoreDecisionType =
  | 'detect'
  | 'hide'
  | 'pushing'
  | 'refresh'
  | 'rally'
  | 'revive'
  | 'fiddle';

interface ExecuteNonCoreDecisionParams {
  decision: ActionDecision;
  character: Character;
  enemies: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  sideName: string;
  apBefore: number;
  allowHideAction: boolean;
  sideInitiativePoints: number;
  hasOpposingInBaseContact: (
    actor: Character,
    opponents: Character[],
    field: Battlefield
  ) => boolean;
  getMarkerKeyIdsInHand: (characterId: string, manager: GameManager) => string[];
  trackAttempt: (character: Character, action: 'detect' | 'hide') => void;
  incrementAction: (actionType: string) => void;
  trackSuccess: (character: Character, action: 'detect' | 'hide') => void;
  trackSituationalModifiers: (payload: unknown) => void;
  trackSituationalModifierType: (type: string) => void;
  sanitizeForAudit: (value: unknown) => unknown;
}

interface NonCoreDecisionExecutionResult {
  actionExecuted: boolean;
  resultCode: string;
  details?: Record<string, unknown>;
}

function isNonCoreDecisionType(type: ActionDecision['type']): type is NonCoreDecisionType {
  return NON_CORE_DECISION_TYPES.has(type);
}

export async function executeNonCoreDecisionForRunner(
  params: ExecuteNonCoreDecisionParams
): Promise<NonCoreDecisionExecutionResult | null> {
  const {
    decision,
    character,
    enemies,
    battlefield,
    gameManager,
    sideName,
    apBefore,
    allowHideAction,
    sideInitiativePoints,
    hasOpposingInBaseContact,
    getMarkerKeyIdsInHand,
    trackAttempt,
    incrementAction,
    trackSuccess,
    trackSituationalModifiers,
    trackSituationalModifierType,
    sanitizeForAudit,
  } = params;

  if (!isNonCoreDecisionType(decision.type)) {
    return null;
  }

  switch (decision.type) {
    case 'detect': {
      const detectResult = executeDetectActionForRunner({
        hasTarget: Boolean(decision.target),
        trackAttempt: () => {
          trackAttempt(character, 'detect');
        },
        incrementAction: () => {
          incrementAction('Detect');
        },
        spendAp: amount => gameManager.spendAp(character, amount),
        computeLean: () => shouldUseLeanForDetectWithCover(character, decision.target!, battlefield),
        executeDetect: useLean => attemptDetect(battlefield, character, decision.target!, enemies, {
          attackerLeaning: useLean,
        }),
        trackSituationalModifiers: useLean => {
          trackSituationalModifiers({ isLeaning: useLean });
        },
        trackLeanModifierType: () => {
          trackSituationalModifierType('detect_lean');
        },
        trackSuccess: () => {
          trackSuccess(character, 'detect');
        },
        sanitizeForAudit,
      });
      return {
        actionExecuted: detectResult.executed,
        resultCode: detectResult.resultCode,
        details: detectResult.details,
      };
    }
    case 'pushing': {
      const pushingResult = executePushingActionForRunner({
        apBefore,
        isAttentive: character.state.isAttentive,
        incrementAction: () => {
          incrementAction('Pushing');
        },
        executePushing: () => gameManager.executePushing(character),
        sanitizeForAudit,
      });
      return {
        actionExecuted: pushingResult.executed,
        resultCode: pushingResult.resultCode,
        details: pushingResult.details,
      };
    }
    case 'refresh': {
      const refreshResult = executeRefreshActionForRunner({
        incrementAction: () => {
          incrementAction('Refresh');
        },
        delayBefore: character.state.delayTokens ?? 0,
        refreshForCharacter: () => gameManager.refreshForCharacter(character),
        onRefreshSuccess: () => {
          character.refreshStatusFlags();
        },
        getDelayAfter: () => character.state.delayTokens ?? 0,
        sideInitiativePoints,
      });
      return {
        actionExecuted: refreshResult.executed,
        resultCode: refreshResult.resultCode,
        details: refreshResult.details,
      };
    }
    case 'hide': {
      const hideResult = executeHideActionForRunner({
        allowHideAction,
        trackAttempt: () => {
          trackAttempt(character, 'hide');
        },
        incrementAction: () => {
          incrementAction('Hide');
        },
        executeHide: () => attemptHide(
          battlefield,
          character,
          enemies,
          (amount: number) => gameManager.spendAp(character, amount)
        ),
        trackSuccess: () => {
          trackSuccess(character, 'hide');
        },
        sanitizeForAudit,
      });
      return {
        actionExecuted: hideResult.executed,
        resultCode: hideResult.resultCode,
        details: hideResult.details,
      };
    }
    case 'rally':
    case 'revive': {
      const supportResult = executeSupportActionForRunner({
        actionType: decision.type,
        actor: character,
        target: decision.target,
        gameManager,
        sanitizeForAudit,
      });
      return {
        actionExecuted: supportResult.executed,
        resultCode: supportResult.resultCode,
        details: supportResult.details,
      };
    }
    case 'fiddle': {
      const fiddleResult = executeFiddleActionForRunner({
        decision,
        character,
        enemies,
        battlefield,
        gameManager,
        sideName,
        hasOpposingInBaseContact: (actor, opponents, field) =>
          hasOpposingInBaseContact(actor, opponents, field),
        getMarkerKeyIdsInHand: (characterId, manager) => getMarkerKeyIdsInHand(characterId, manager),
        sanitizeForAudit,
      });
      return {
        actionExecuted: fiddleResult.executed,
        resultCode: fiddleResult.resultCode,
        details: fiddleResult.details,
      };
    }
    default:
      return null;
  }
}
