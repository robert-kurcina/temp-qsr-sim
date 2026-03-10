import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { BattleReport, TurnAudit } from '../../shared/BattleReportTypes';

type SideStrategy = NonNullable<BattleReport['sideStrategies']>[string];
type StrategyTraceEntry = NonNullable<SideStrategy['decisionTrace']>[number];
type CoordinatorDecision = NonNullable<TurnAudit['coordinatorDecisions']>[number];

function normalizeTargetScoreList(values: unknown): Array<{ targetId: string; score: number; attackerCount: number }> {
  if (!Array.isArray(values)) return [];
  return values.map((entry: any) => ({
    targetId: String(entry?.targetId ?? ''),
    score: Number(entry?.score ?? 0),
    attackerCount: Number(entry?.attackerCount ?? 0),
  }));
}

function normalizeOpponentPressureList(values: unknown): Array<{ key: string; predicted: number; confidence: number }> {
  if (!Array.isArray(values)) return [];
  return values.map((entry: any) => ({
    key: String(entry?.key ?? ''),
    predicted: Number(entry?.predicted ?? 0),
    confidence: Number(entry?.confidence ?? 0),
  }));
}

function normalizePressureBucket(value: unknown): {
  updates: number;
  signatureSamples: number;
  signatureMatches: number;
  signatureBreaks: number;
  missingSignatureUpdates: number;
  signatureCoverageRate: number;
  breakRate: number;
  matchRate: number;
} {
  const bucket = (value ?? {}) as any;
  return {
    updates: Number(bucket.updates ?? 0),
    signatureSamples: Number(bucket.signatureSamples ?? 0),
    signatureMatches: Number(bucket.signatureMatches ?? 0),
    signatureBreaks: Number(bucket.signatureBreaks ?? 0),
    missingSignatureUpdates: Number(bucket.missingSignatureUpdates ?? 0),
    signatureCoverageRate: Number(bucket.signatureCoverageRate ?? 0),
    breakRate: Number(bucket.breakRate ?? 0),
    matchRate: Number(bucket.matchRate ?? 0),
  };
}

export function normalizePressureContinuityDiagnostics(
  value: unknown
): SideStrategy['pressureContinuityDiagnostics'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const diagnostics = value as any;
  return {
    scrum: normalizePressureBucket(diagnostics.scrum),
    lane: normalizePressureBucket(diagnostics.lane),
    combined: normalizePressureBucket(diagnostics.combined),
  };
}

export function normalizeDecisionTraceEntry(
  entry: unknown,
  defaults: { sideId: string; doctrine: string; turn: number }
): StrategyTraceEntry {
  const trace = (entry ?? {}) as any;
  return {
    turn: Number(trace.turn ?? defaults.turn),
    sideId: String(trace.sideId ?? defaults.sideId),
    doctrine: String(trace.doctrine ?? defaults.doctrine),
    observations: {
      amILeading: Boolean(trace.observations?.amILeading),
      vpMargin: Number(trace.observations?.vpMargin ?? 0),
      winningKeys: Array.isArray(trace.observations?.winningKeys) ? trace.observations.winningKeys : [],
      losingKeys: Array.isArray(trace.observations?.losingKeys) ? trace.observations.losingKeys : [],
      topOpponentKeyPressure: normalizeOpponentPressureList(trace.observations?.topOpponentKeyPressure),
      topTargetCommitments: normalizeTargetScoreList(trace.observations?.topTargetCommitments),
      topScrumContinuity: normalizeTargetScoreList(trace.observations?.topScrumContinuity),
      topLanePressure: normalizeTargetScoreList(trace.observations?.topLanePressure),
      fractionalPotential: trace.observations?.fractionalPotential
        ? {
            myVpPotential: Number(trace.observations.fractionalPotential.myVpPotential ?? 0),
            opponentVpPotential: Number(trace.observations.fractionalPotential.opponentVpPotential ?? 0),
            potentialDelta: Number(trace.observations.fractionalPotential.potentialDelta ?? 0),
            urgency: Number(trace.observations.fractionalPotential.urgency ?? 0),
          }
        : undefined,
    },
    response: {
      priority: String(trace.response?.priority ?? 'neutral'),
      advice: Array.isArray(trace.response?.advice) ? trace.response.advice : [],
      focusTargets: Array.isArray(trace.response?.focusTargets) ? trace.response.focusTargets : [],
      potentialDirective: typeof trace.response?.potentialDirective === 'string'
        ? trace.response.potentialDirective
        : undefined,
      pressureDirective: typeof trace.response?.pressureDirective === 'string'
        ? trace.response.pressureDirective
        : undefined,
    },
  };
}

export function normalizeDecisionTrace(
  value: unknown,
  defaults: { sideId: string; doctrine: string }
): StrategyTraceEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry: unknown) =>
    normalizeDecisionTraceEntry(entry, {
      sideId: defaults.sideId,
      doctrine: defaults.doctrine,
      turn: Number((entry as any)?.turn ?? 0),
    })
  );
}

export function normalizeSideStrategy(
  sideId: string,
  strategy: unknown
): SideStrategy {
  const typed = (strategy ?? {}) as any;
  const doctrine = String(typed.doctrine ?? TacticalDoctrine.Operative);
  return {
    doctrine,
    advice: Array.isArray(typed.advice) ? typed.advice : [],
    context: typed.context ? {
      amILeading: Boolean(typed.context.amILeading),
      vpMargin: Number(typed.context.vpMargin ?? 0),
      winningKeys: Array.isArray(typed.context.winningKeys) ? typed.context.winningKeys : [],
      losingKeys: Array.isArray(typed.context.losingKeys) ? typed.context.losingKeys : [],
    } : undefined,
    pressureContinuityDiagnostics: normalizePressureContinuityDiagnostics(typed.pressureContinuityDiagnostics),
    decisionTrace: normalizeDecisionTrace(typed.decisionTrace, { sideId, doctrine }),
  };
}

export function selectCurrentTurnTrace(
  decisionTrace: StrategyTraceEntry[] | undefined,
  currentTurn: number
): StrategyTraceEntry | undefined {
  if (!decisionTrace || decisionTrace.length === 0) return undefined;
  return decisionTrace
    .filter(entry => Number(entry.turn ?? -1) === currentTurn)
    .at(-1);
}

export function buildCoordinatorDecisionFromTrace(
  sideId: string,
  doctrine: string,
  trace: StrategyTraceEntry
): CoordinatorDecision {
  return {
    sideId,
    doctrine,
    trace,
  };
}
