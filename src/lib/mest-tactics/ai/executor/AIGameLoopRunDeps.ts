import { AuditService } from '../../audit/AuditService';
import { Battlefield } from '../../battlefield/Battlefield';
import { Character } from '../../core/Character';
import { GameManager } from '../../engine/GameManager';
import { MissionSide } from '../../mission/MissionSide';
import { InstrumentationLogger } from '../../instrumentation/QSRInstrumentation';
import { AIActionExecutor } from './AIActionExecutor';
import { AIGameLoopDecisionRuntime } from './AIGameLoopDecisionRuntime';
import { CharacterTurnResult, RunCharacterTurnDependencies } from './CharacterTurnRunner';
import { RunGameLifecycleDeps } from './GameLifecycleRunner';
import { RunTurnDependencies, SquadActivationResult, TurnRunResult } from './TurnRunner';
import {
  considerSquadIPActivationForGameLoop,
  getGameEndReasonForGameLoop,
  shouldEndGameForGameLoop,
} from './EndgameAndSquadSupport';

interface CreateRunTurnDepsParams {
  manager: GameManager;
  sides: MissionSide[];
  logger: InstrumentationLogger | null;
  auditService: AuditService | null;
  runCharacterTurn: (character: Character, turn: number) => CharacterTurnResult;
  considerSquadIPActivation: (character: Character, turn: number) => SquadActivationResult;
}

interface CreateRunCharacterTurnDepsParams {
  manager: GameManager;
  battlefield: Battlefield;
  executor: AIActionExecutor;
  auditService: AuditService | null;
  maxActionsPerTurn: number;
  decisionRuntime: AIGameLoopDecisionRuntime;
}

interface CreateRunGameLifecycleDepsParams {
  maxTurns: number;
  manager: GameManager;
  sideIds: string[];
  resetReplanAttempts: () => void;
  runTurn: (turn: number) => TurnRunResult;
  onTurnEnd?: (turn: number) => void;
  findCharacterSide: (character: Character) => string | null;
}

interface CreateConsiderSquadIPActivationParams {
  sides: MissionSide[];
  battlefield: Battlefield;
  manager: GameManager;
  logger: InstrumentationLogger | null;
  runCharacterTurn: (character: Character, turn: number) => CharacterTurnResult;
}

export function createRunTurnDepsForAIGameLoop(
  params: CreateRunTurnDepsParams
): RunTurnDependencies {
  return {
    manager: params.manager,
    sides: params.sides,
    logger: params.logger,
    auditService: params.auditService,
    runCharacterTurn: params.runCharacterTurn,
    considerSquadIPActivation: params.considerSquadIPActivation,
  };
}

export function createRunCharacterTurnDepsForAIGameLoop(
  params: CreateRunCharacterTurnDepsParams
): RunCharacterTurnDependencies {
  return {
    manager: params.manager,
    battlefield: params.battlefield,
    executor: params.executor,
    auditService: params.auditService,
    maxActionsPerTurn: params.maxActionsPerTurn,
    getAIDecision: actor => params.decisionRuntime.getAIDecision(actor),
    getAggressiveFallbackDecision: (actor, apRemaining, preferredTarget) =>
      params.decisionRuntime.getAggressiveFallbackDecision(actor, apRemaining, preferredTarget),
    getAlternativeDecision: (actor, failedDecision) =>
      params.decisionRuntime.getAlternativeDecision(actor, failedDecision),
    sanitizeDecisionForExecution: (actor, decision, apRemaining, actionsTakenThisInitiative) =>
      params.decisionRuntime.sanitizeDecisionForExecution(
        actor,
        decision,
        apRemaining,
        actionsTakenThisInitiative
      ),
    createExecutionContext: actor => params.decisionRuntime.createExecutionContext(actor),
    captureModelState: actor => params.decisionRuntime.captureModelState(actor),
    getSideNameForCharacter: actor => params.decisionRuntime.getSideNameForCharacter(actor),
    findCharacterSide: actor => params.decisionRuntime.findCharacterSide(actor),
    buildPressureTopologySignature: (actionType, sideId, attacker, target) =>
      params.decisionRuntime.buildPressureTopologySignature(actionType, sideId, attacker, target),
  };
}

export function createRunGameLifecycleDepsForAIGameLoop(
  params: CreateRunGameLifecycleDepsParams
): RunGameLifecycleDeps {
  return {
    maxTurns: params.maxTurns,
    resetReplanAttempts: params.resetReplanAttempts,
    runTurn: params.runTurn,
    onTurnEnd: params.onTurnEnd,
    shouldEndGame: turn =>
      shouldEndGameForGameLoop(
        turn,
        params.sideIds,
        params.manager.characters,
        character => params.findCharacterSide(character)
      ),
    getEndReason: () =>
      getGameEndReasonForGameLoop(
        params.manager.characters,
        character => params.findCharacterSide(character)
      ),
  };
}

export function createConsiderSquadIPActivationForAIGameLoop(
  params: CreateConsiderSquadIPActivationParams
): RunTurnDependencies['considerSquadIPActivation'] {
  return (character: Character, turn: number): SquadActivationResult =>
    considerSquadIPActivationForGameLoop(character, turn, {
      sides: params.sides,
      battlefield: params.battlefield,
      manager: params.manager,
      logger: params.logger,
      runCharacterTurn: (activeCharacter, currentTurn) =>
        params.runCharacterTurn(activeCharacter, currentTurn),
    });
}
