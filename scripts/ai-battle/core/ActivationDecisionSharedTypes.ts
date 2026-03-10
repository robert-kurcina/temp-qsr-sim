import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { ActionStepAudit, ModelStateAudit, OpposedTestAudit } from '../../shared/BattleReportTypes';

export interface MoveAndOpportunityResult {
  moved: boolean;
  moveResult: ReturnType<GameManager['executeMove']>;
  opposedTest: OpposedTestAudit | undefined;
  details: Record<string, unknown> | undefined;
}

export interface WaitActionResult {
  executed: boolean;
  resultCode: string;
  details: Record<string, unknown>;
}

export interface ActionValidator {
  validateActionDecision: (
    decision: ActionDecision,
    character: Character,
    context: any
  ) => { isValid: boolean; errors: string[] };
}

export interface MoveAndOpportunityExecutor {
  (
    gameManager: GameManager,
    character: Character,
    destination: { x: number; y: number },
    enemies: Character[],
    actorStateBefore: ModelStateAudit,
    stepInteractions: ActionStepAudit['interactions'],
    stepOpposedTest: OpposedTestAudit | undefined,
    stepDetails: Record<string, unknown> | undefined
  ): MoveAndOpportunityResult;
}

