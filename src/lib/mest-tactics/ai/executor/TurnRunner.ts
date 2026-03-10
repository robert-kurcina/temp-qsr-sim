import { TurnPhase } from '../../core/types';
import { Character } from '../../core/Character';
import { GameManager } from '../../engine/GameManager';
import { MissionSide } from '../../mission/MissionSide';
import { InstrumentationLogger } from '../../instrumentation/QSRInstrumentation';
import { AuditService } from '../../audit/AuditService';
import { CharacterTurnResult } from './CharacterTurnRunner';

export interface TurnRunResult {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  replannedActions: number;
}

export interface SquadActivationResult {
  success: boolean;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
}

export interface RunTurnDependencies {
  manager: GameManager;
  sides: MissionSide[];
  logger: InstrumentationLogger | null;
  auditService: AuditService | null;
  runCharacterTurn: (character: Character, turn: number) => CharacterTurnResult;
  considerSquadIPActivation: (character: Character, turn: number) => SquadActivationResult;
}

export function runTurnForGameLoop(turn: number, deps: RunTurnDependencies): TurnRunResult {
  const result: TurnRunResult = {
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    replannedActions: 0,
  };

  if (turn === 1 || deps.manager.phase !== TurnPhase.Activation) {
    deps.manager.advancePhase({
      roller: Math.random,
      roundsPerTurn: deps.manager.roundsPerTurn,
      sides: deps.sides,
    });
  }

  if (deps.logger) {
    const ipBySide: Record<string, number> = {};
    for (const side of deps.sides) {
      ipBySide[side.id] = side.state.initiativePoints ?? 0;
    }
    deps.logger.logInitiativePoints(turn, ipBySide);
  }

  while (!deps.manager.isTurnOver()) {
    const character = deps.manager.getNextToActivate();
    if (!character) {
      break;
    }
    if (character.state.isEliminated || character.state.isKOd) {
      deps.manager.endActivation(character);
      continue;
    }

    const ap = deps.manager.beginActivation(character);
    if (ap <= 0) {
      deps.manager.endActivation(character);
      continue;
    }

    if (deps.auditService) {
      const side = deps.sides.find(s => s.members.some(m => m.character.id === character.id));
      deps.auditService.startActivation({
        activationSequence: 0,
        turn,
        sideIndex: side ? deps.sides.indexOf(side) : 0,
        sideName: side?.name || 'Unknown',
        modelId: character.id,
        modelName: character.name || character.id,
        initiative: character.initiative || 0,
        apStart: ap,
        waitAtStart: character.state.isWaiting || false,
        delayTokensAtStart: character.state.delayTokens || 0,
      });
    }

    const charResult = deps.runCharacterTurn(character, turn);
    result.totalActions += charResult.totalActions;
    result.successfulActions += charResult.successfulActions;
    result.failedActions += charResult.failedActions;
    result.replannedActions += charResult.replannedActions;

    if (charResult.successfulActions > 0) {
      const squadActivationResult = deps.considerSquadIPActivation(character, turn);
      if (squadActivationResult.success) {
        result.totalActions += squadActivationResult.totalActions;
        result.successfulActions += squadActivationResult.successfulActions;
        result.failedActions += squadActivationResult.failedActions;
      }
    }

    if (deps.auditService) {
      const apRemaining = deps.manager.getApRemaining(character);
      deps.auditService.endActivation(
        apRemaining,
        character.state.isWaiting || false,
        false,
        character.state.delayTokens || 0
      );
    }

    deps.manager.endActivation(character);
  }

  deps.manager.advancePhase({
    roller: Math.random,
    roundsPerTurn: deps.manager.roundsPerTurn,
  });
  return result;
}

