/**
 * AI Game Loop - Phase 4 Integration
 * 
 * Integrates the full AI pipeline:
 * SideAI → AssemblyAI → CharacterAI → ActionExecutor → GameManager
 * 
 * This is the main entry point for AI-controlled game sessions.
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { GameManager } from '../../engine/GameManager';
import { MissionSide } from '../../mission/MissionSide';
import type { SideAI } from '../strategic/SideAI';
import { AIActionExecutor } from './AIActionExecutor';
import { ActionDecision } from '../core/AIController';
import { InstrumentationLogger } from '../../instrumentation/QSRInstrumentation';
import { AuditService } from '../../audit/AuditService';
import { CharacterTurnResult, runCharacterTurnForGameLoop } from './CharacterTurnRunner';
import { runGameLifecycleForGameLoop } from './GameLifecycleRunner';
import { TurnRunResult, runTurnForGameLoop } from './TurnRunner';
import {
  InitializedAILayers,
} from './AILayerInitializationSupport';
import { estimateImmediateMoveAllowanceForGameLoop } from './DecisionSanitizationSupport';
import {
  createConsiderSquadIPActivationForAIGameLoop,
  createRunGameLifecycleDepsForAIGameLoop,
  createRunCharacterTurnDepsForAIGameLoop,
  createRunTurnDepsForAIGameLoop,
} from './AIGameLoopRunDeps';
import { AIGameLoopDecisionRuntime } from './AIGameLoopDecisionRuntime';
import { bootstrapAIGameLoopState } from './AIGameLoopBootstrap';
import {
  AIGameLoopConfig,
  AIGameLoopResult,
  DEFAULT_AI_GAME_LOOP_CONFIG,
} from './AIGameLoopTypes';

export { DEFAULT_AI_GAME_LOOP_CONFIG };
export type { AIGameLoopConfig, AIGameLoopResult };

/**
 * AI Game Loop Controller
 *
 * Orchestrates the full AI decision and execution pipeline.
 */
export class AIGameLoop {
  config: AIGameLoopConfig;
  private manager: GameManager;
  private battlefield: Battlefield;
  private executor: AIActionExecutor;
  private logger: InstrumentationLogger | null = null;
  private auditService: AuditService | null = null;
  private sides: MissionSide[] = [];
  private aiLayers!: InitializedAILayers;
  private decisionRuntime!: AIGameLoopDecisionRuntime;

  // Compatibility accessors for tests/introspection that touch internals directly.
  private get sideAIs(): Map<string, SideAI> {
    return this.aiLayers.sideAIs;
  }

  constructor(
    manager: GameManager,
    battlefield: Battlefield,
    sides: MissionSide[],
    config: Partial<AIGameLoopConfig> = {},
    logger?: InstrumentationLogger
  ) {
    this.manager = manager;
    this.battlefield = battlefield;
    this.sides = sides;
    this.config = { ...DEFAULT_AI_GAME_LOOP_CONFIG, ...config };
    this.logger = logger || null;
    this.auditService = config.auditService || null;

    const bootstrap = bootstrapAIGameLoopState({
      manager: this.manager,
      battlefield: this.battlefield,
      sides: this.sides,
      config: this.config,
      logger: this.logger,
    });
    this.executor = bootstrap.executor;
    this.aiLayers = bootstrap.aiLayers;
    this.decisionRuntime = bootstrap.decisionRuntime;
  }

  /**
   * Run a complete AI-controlled game
   */
  runGame(maxTurns: number = 10): AIGameLoopResult {
    return runGameLifecycleForGameLoop(
      createRunGameLifecycleDepsForAIGameLoop({
        maxTurns,
        manager: this.manager,
        sideIds: this.aiLayers.sideIds,
        resetReplanAttempts: () => this.executor.resetReplanAttempts(),
        runTurn: turn => this.runTurn(turn),
        onTurnEnd: this.config.onTurnEnd,
        findCharacterSide: character => this.decisionRuntime.findCharacterSide(character),
      })
    );
  }

  /**
   * Run a single turn of AI decisions and actions
   */
  runTurn(turn: number): TurnRunResult {
    return runTurnForGameLoop(
      turn,
      createRunTurnDepsForAIGameLoop({
        manager: this.manager,
        sides: this.sides,
        logger: this.logger,
        auditService: this.auditService,
        runCharacterTurn: (character, currentTurn) => this.runCharacterTurn(character, currentTurn),
        considerSquadIPActivation: createConsiderSquadIPActivationForAIGameLoop({
          sides: this.sides,
          battlefield: this.battlefield,
          manager: this.manager,
          logger: this.logger,
          runCharacterTurn: (activeCharacter, currentTurn) =>
            this.runCharacterTurn(activeCharacter, currentTurn),
        }),
      })
    );
  }

  /**
   * Run AI decisions for a single character's activation
   */
  runCharacterTurn(
    character: Character,
    turn: number
  ): CharacterTurnResult {
    return runCharacterTurnForGameLoop(
      character,
      turn,
      createRunCharacterTurnDepsForAIGameLoop({
        manager: this.manager,
        battlefield: this.battlefield,
        executor: this.executor,
        auditService: this.auditService,
        maxActionsPerTurn: this.config.maxActionsPerTurn,
        decisionRuntime: this.decisionRuntime,
      })
    );
  }

  private getAIDecision(character: Character): ActionDecision | null {
    return this.decisionRuntime.getAIDecision(character);
  }

  private getAlternativeDecision(
    character: Character,
    failedDecision: ActionDecision
  ): ActionDecision | null {
    return this.decisionRuntime.getAlternativeDecision(character, failedDecision);
  }

  private getAggressiveFallbackDecision(
    character: Character,
    apRemaining: number,
    preferredTarget?: Character
  ): ActionDecision | null {
    return this.decisionRuntime.getAggressiveFallbackDecision(
      character,
      apRemaining,
      preferredTarget
    );
  }

  private estimateImmediateMoveAllowance(character: Character): number {
    return estimateImmediateMoveAllowanceForGameLoop(character);
  }

}

/**
 * Create AI Game Loop for a mission
 */
export function createAIGameLoop(
  manager: GameManager,
  battlefield: Battlefield,
  sides: MissionSide[],
  config?: Partial<AIGameLoopConfig>
): AIGameLoop {
  return new AIGameLoop(manager, battlefield, sides, config);
}
