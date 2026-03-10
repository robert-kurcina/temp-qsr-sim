import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type {
  ActionStepAudit,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';

type OpportunityAttackPayload = {
  attacker?: Character;
  result?: unknown;
};

interface ApplyOpportunityAttackParams {
  opportunityAttack: unknown;
  active: Character;
  actorStateBefore: ModelStateAudit;
  actorStateAfterOpportunity: ModelStateAudit;
  stepInteractions: ActionStepAudit['interactions'];
  stepOpposedTest: OpposedTestAudit | undefined;
  stepDetails: Record<string, unknown> | undefined;
  toOpposedTestAudit: (rawResult: unknown) => OpposedTestAudit | undefined;
  trackPassiveUsageOpportunityAttack: () => void;
  trackCombatExtras: (result: unknown) => void;
  syncMissionRuntimeForAttack: (
    attacker: Character | undefined,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ) => void;
  extractDamageResolutionFromUnknown: (result: unknown) => unknown;
}

export function getOpportunityAttackFromMoveResult(moveResult: unknown): OpportunityAttackPayload | undefined {
  if (!moveResult || typeof moveResult !== 'object') {
    return undefined;
  }
  return (moveResult as { opportunityAttack?: OpportunityAttackPayload }).opportunityAttack;
}

export function applyOpportunityAttackForRunner(
  params: ApplyOpportunityAttackParams
): {
  applied: boolean;
  opposedTest: OpposedTestAudit | undefined;
  details: Record<string, unknown> | undefined;
} {
  const {
    opportunityAttack,
    active,
    actorStateBefore,
    actorStateAfterOpportunity,
    stepInteractions,
    stepOpposedTest,
    stepDetails,
    toOpposedTestAudit,
    trackPassiveUsageOpportunityAttack,
    trackCombatExtras,
    syncMissionRuntimeForAttack,
    extractDamageResolutionFromUnknown,
  } = params;

  const opportunity = opportunityAttack as OpportunityAttackPayload | undefined;
  if (!opportunity?.attacker) {
    return {
      applied: false,
      opposedTest: stepOpposedTest,
      details: stepDetails,
    };
  }

  trackPassiveUsageOpportunityAttack();
  trackCombatExtras(opportunity.result);
  stepInteractions.push({
    kind: 'opportunity_attack',
    sourceModelId: opportunity.attacker.id,
    targetModelId: active.id,
    success: Boolean((opportunity.result as any)?.result?.hit ?? (opportunity.result as any)?.hit),
    detail: 'Opportunity attack triggered by movement disengage',
  });
  syncMissionRuntimeForAttack(
    opportunity.attacker,
    active,
    actorStateBefore,
    actorStateAfterOpportunity,
    extractDamageResolutionFromUnknown(opportunity.result)
  );

  return {
    applied: true,
    opposedTest: toOpposedTestAudit(opportunity.result) ?? stepOpposedTest,
    details: {
      ...(stepDetails ?? {}),
      opportunityAttack: opportunity as unknown as Record<string, unknown>,
    },
  };
}
