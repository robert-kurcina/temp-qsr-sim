import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';

interface ExecuteFiddleActionParams {
  decision: ActionDecision;
  character: Character;
  enemies: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  sideName: string;
  hasOpposingInBaseContact: (
    actor: Character,
    opponents: Character[],
    battlefield: Battlefield
  ) => boolean;
  getMarkerKeyIdsInHand: (characterId: string, gameManager: GameManager) => string[];
  sanitizeForAudit: (value: unknown) => unknown;
}

export interface ExecuteFiddleActionResult {
  executed: boolean;
  resultCode: string;
  details: Record<string, unknown>;
}

export function executeFiddleActionForRunner(params: ExecuteFiddleActionParams): ExecuteFiddleActionResult {
  const {
    decision,
    character,
    enemies,
    battlefield,
    gameManager,
    sideName,
    hasOpposingInBaseContact,
    getMarkerKeyIdsInHand,
    sanitizeForAudit,
  } = params;

  if (decision.markerId && decision.objectiveAction) {
    if (decision.objectiveAction === 'acquire_marker') {
      const acquire = gameManager.executeAcquireObjectiveMarker(character, decision.markerId, sideName, {
        spendAp: true,
        opposingInBaseContact: hasOpposingInBaseContact(character, enemies, battlefield),
        isAttentive: character.state.isAttentive,
        isOrdered: character.state.isOrdered,
        isAnimal: false,
        keyIdsInHand: getMarkerKeyIdsInHand(character.id, gameManager),
      });
      const executed = Boolean((acquire as { success?: boolean }).success);
      return {
        executed,
        resultCode: executed
          ? 'fiddle=true:acquire_marker'
          : `fiddle=false:${(acquire as { reason?: string }).reason ?? 'acquire_failed'}`,
        details: {
          objectiveAction: decision.objectiveAction,
          markerId: decision.markerId,
          objectiveMarkerResult: sanitizeForAudit(acquire) as Record<string, unknown>,
        },
      };
    }

    if (decision.objectiveAction === 'share_marker') {
      if (!decision.markerTargetModelId) {
        return {
          executed: false,
          resultCode: 'fiddle=false:no-share-target',
          details: {
            objectiveAction: decision.objectiveAction,
            markerId: decision.markerId,
          },
        };
      }
      const share = gameManager.executeShareIdeaObjectiveMarker(
        character,
        decision.markerId,
        decision.markerTargetModelId,
        sideName,
        { spendAp: true }
      );
      const executed = Boolean((share as { success?: boolean }).success);
      return {
        executed,
        resultCode: executed
          ? 'fiddle=true:share_marker'
          : `fiddle=false:${(share as { reason?: string }).reason ?? 'share_failed'}`,
        details: {
          objectiveAction: decision.objectiveAction,
          markerId: decision.markerId,
          markerTargetModelId: decision.markerTargetModelId,
          objectiveMarkerResult: sanitizeForAudit(share) as Record<string, unknown>,
        },
      };
    }

    if (decision.objectiveAction === 'transfer_marker') {
      if (!decision.markerTargetModelId) {
        return {
          executed: false,
          resultCode: 'fiddle=false:no-transfer-target',
          details: {
            objectiveAction: decision.objectiveAction,
            markerId: decision.markerId,
          },
        };
      }
      const transfer = gameManager.executeTransferObjectiveMarker(
        character,
        decision.markerId,
        decision.markerTargetModelId,
        sideName,
        { spendAp: true }
      );
      const executed = Boolean((transfer as { success?: boolean }).success);
      return {
        executed,
        resultCode: executed
          ? 'fiddle=true:transfer_marker'
          : `fiddle=false:${(transfer as { reason?: string }).reason ?? 'transfer_failed'}`,
        details: {
          objectiveAction: decision.objectiveAction,
          markerId: decision.markerId,
          markerTargetModelId: decision.markerTargetModelId,
          objectiveMarkerResult: sanitizeForAudit(transfer) as Record<string, unknown>,
        },
      };
    }

    if (decision.objectiveAction === 'destroy_marker') {
      const destroy = gameManager.executeDestroyObjectiveMarker(character, decision.markerId, { spendAp: true });
      const executed = Boolean((destroy as { success?: boolean }).success);
      return {
        executed,
        resultCode: executed
          ? 'fiddle=true:destroy_marker'
          : `fiddle=false:${(destroy as { reason?: string }).reason ?? 'destroy_failed'}`,
        details: {
          objectiveAction: decision.objectiveAction,
          markerId: decision.markerId,
          objectiveMarkerResult: sanitizeForAudit(destroy) as Record<string, unknown>,
        },
      };
    }
  }

  const fiddle = gameManager.executeFiddle(character, {
    spendAp: true,
    attribute: 'int',
    difficulty: 2,
  });
  return {
    executed: fiddle.success,
    resultCode: fiddle.success ? 'fiddle=true' : 'fiddle=false',
    details: {
      objectiveAction: decision.objectiveAction,
      markerId: decision.markerId,
      fiddleResult: sanitizeForAudit(fiddle) as Record<string, unknown>,
    },
  };
}
