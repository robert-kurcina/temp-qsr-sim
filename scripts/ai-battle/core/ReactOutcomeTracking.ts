import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type {
  ActionStepAudit,
  AuditVector,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';
import type { ReactAuditResult } from '../validation/ValidationMetrics';

interface ApplyReactOutcomeTrackingParams {
  reactResult: ReactAuditResult | undefined;
  active: Character;
  actorStateBeforeReact: ModelStateAudit;
  actorStateAfterReact: ModelStateAudit;
  onReactChoiceTaken: () => void;
  onReactExecuted: () => void;
  trackPassiveUsageReact: () => void;
  trackReactorAttemptSuccess: (reactor: Character) => void;
  trackReactWoundsInflicted: (wounds: number) => void;
  trackWaitTriggeredReact: () => void;
  trackWaitReactWoundsInflicted: (wounds: number) => void;
  extractDamageResolutionFromUnknown: (result: unknown) => unknown;
  extractWoundsAddedFromDamageResolution: (
    damageResolution: unknown,
    before: ModelStateAudit,
    after: ModelStateAudit
  ) => number;
  syncMissionRuntimeForAttack: (
    attacker: Character | undefined,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ) => void;
}

interface MergeReactOutcomeIntoStepParams {
  reactResult: ReactAuditResult | undefined;
  activeModelId: string;
  stepInteractions: ActionStepAudit['interactions'];
  stepVectors: AuditVector[];
  stepOpposedTest: OpposedTestAudit | undefined;
  stepDetails: Record<string, unknown> | undefined;
}

export function applyReactOutcomeTrackingForRunner(params: ApplyReactOutcomeTrackingParams): void {
  const {
    reactResult,
    active,
    actorStateBeforeReact,
    actorStateAfterReact,
    onReactChoiceTaken,
    onReactExecuted,
    trackPassiveUsageReact,
    trackReactorAttemptSuccess,
    trackReactWoundsInflicted,
    trackWaitTriggeredReact,
    trackWaitReactWoundsInflicted,
    extractDamageResolutionFromUnknown,
    extractWoundsAddedFromDamageResolution,
    syncMissionRuntimeForAttack,
  } = params;

  if (!reactResult?.executed) {
    return;
  }

  if (reactResult.reactor) {
    onReactChoiceTaken();
    const damageResolution = extractDamageResolutionFromUnknown(reactResult.rawResult);
    syncMissionRuntimeForAttack(
      reactResult.reactor,
      active,
      actorStateBeforeReact,
      actorStateAfterReact,
      damageResolution
    );
    const reactWounds = extractWoundsAddedFromDamageResolution(
      damageResolution,
      actorStateBeforeReact,
      actorStateAfterReact
    );
    trackReactWoundsInflicted(reactWounds);
    if (reactResult.reactorWasWaiting) {
      trackWaitTriggeredReact();
      trackWaitReactWoundsInflicted(reactWounds);
    }
    trackReactorAttemptSuccess(reactResult.reactor);
  }

  onReactExecuted();
  trackPassiveUsageReact();
}

export function mergeReactOutcomeIntoStepForRunner(
  params: MergeReactOutcomeIntoStepParams
): {
  opposedTest: OpposedTestAudit | undefined;
  details: Record<string, unknown> | undefined;
} {
  const {
    reactResult,
    activeModelId,
    stepInteractions,
    stepVectors,
    stepOpposedTest,
    stepDetails,
  } = params;

  if (!reactResult?.executed) {
    if (reactResult && (
      reactResult.details
      || reactResult.choiceWindowOffered !== undefined
      || reactResult.choicesGiven !== undefined
    )) {
      return {
        opposedTest: stepOpposedTest,
        details: {
          ...(stepDetails ?? {}),
          reactGate: {
            executed: false,
            choiceWindowOffered: reactResult.choiceWindowOffered ?? false,
            choicesGiven: reactResult.choicesGiven ?? 0,
            ...(reactResult.details ?? {}),
          },
        },
      };
    }
    return {
      opposedTest: stepOpposedTest,
      details: stepDetails,
    };
  }

  stepInteractions.push({
    kind: 'react',
    sourceModelId: reactResult.reactor?.id ?? '',
    targetModelId: activeModelId,
    success: true,
    detail: reactResult.resultCode,
  });
  if (reactResult.vector) {
    stepVectors.push(reactResult.vector);
  }

  return {
    opposedTest: reactResult.opposedTest ?? stepOpposedTest,
    details: reactResult.details
      ? {
          ...(stepDetails ?? {}),
          react: reactResult.details,
        }
      : stepDetails,
  };
}
