/**
 * AI Game Loop - Phase 4 Integration
 * 
 * Integrates the full AI pipeline:
 * SideAI → AssemblyAI → CharacterAI → ActionExecutor → GameManager
 * 
 * This is the main entry point for AI-controlled game sessions.
 */

import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { GameManager } from '../engine/GameManager';
import { TurnPhase } from '../../core/types';
import { MissionSide } from '../mission/MissionSide';
import { createAIExecutor, AIActionExecutor, AIExecutionContext } from './AIActionExecutor';
import { createSideAI, SideAI } from '../strategic/SideAI';
import { createSideAssemblyAIs, AssemblyAI } from '../strategic/AssemblyAI';
import { CharacterAI, createSideAI as createCharacterAIs } from '../core/CharacterAI';
import { ActionDecision } from '../core/AIController';
import { isAttackableEnemy } from '../core/ai-utils';

/**
 * AI Game Loop configuration
 */
export interface AIGameLoopConfig {
  /** Enable strategic layer (SideAI) */
  enableStrategic: boolean;
  /** Enable tactical layer (AssemblyAI) */
  enableTactical: boolean;
  /** Enable character-level AI */
  enableCharacterAI: boolean;
  /** Enable action validation */
  enableValidation: boolean;
  /** Enable replanning on failure */
  enableReplanning: boolean;
  /** Verbose logging */
  verboseLogging: boolean;
  /** Maximum actions per character per turn */
  maxActionsPerTurn: number;
  /** Allow attacks against KO'd targets (default false) */
  allowKOdAttacks?: boolean;
  /** Optional controller traits for Puppet KO'd rules */
  kodControllerTraitsByCharacterId?: Record<string, string[]>;
  /** Optional coordinator traits for Puppet KO'd rules */
  kodCoordinatorTraitsByCharacterId?: Record<string, string[]>;
  /** Optional callback after each turn resolves */
  onTurnEnd?: (turn: number) => void;
}

/**
 * Default AI Game Loop configuration
 */
export const DEFAULT_AI_GAME_LOOP_CONFIG: AIGameLoopConfig = {
  enableStrategic: true,
  enableTactical: true,
  enableCharacterAI: true,
  enableValidation: true,
  enableReplanning: true,
  verboseLogging: false,
  maxActionsPerTurn: 3,
  allowKOdAttacks: false,
  onTurnEnd: undefined,
};

/**
 * AI Game Loop execution result
 */
export interface AIGameLoopResult {
  /** Total actions executed */
  totalActions: number;
  /** Successful actions */
  successfulActions: number;
  /** Failed actions */
  failedActions: number;
  /** Actions that required replanning */
  replannedActions: number;
  /** Turn number when game ended */
  finalTurn: number;
  /** Reason for game end */
  endReason?: string;
}

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
  
  // AI layers
  private sideAIs: Map<string, SideAI> = new Map();
  private assemblyAIs: Map<string, AssemblyAI> = new Map();
  private characterAIs: Map<string, CharacterAI> = new Map();
  private sideIds: string[] = [];
  private characterSideById: Map<string, string> = new Map();
  private characterAssemblyById: Map<string, string> = new Map();

  constructor(
    manager: GameManager,
    battlefield: Battlefield,
    sides: MissionSide[],
    config: Partial<AIGameLoopConfig> = {}
  ) {
    this.manager = manager;
    this.battlefield = battlefield;
    this.config = { ...DEFAULT_AI_GAME_LOOP_CONFIG, ...config };
    
    // Create executor
    this.executor = createAIExecutor(manager, {
      validateActions: this.config.enableValidation,
      enableReplanning: this.config.enableReplanning,
      verboseLogging: this.config.verboseLogging,
    });

    // Initialize AI layers
    this.initializeAILayers(sides);
  }

  /**
   * Initialize all AI layers
   */
  private initializeAILayers(sides: MissionSide[]): void {
    this.sideIds = sides.map(side => side.id);
    this.characterSideById.clear();
    this.characterAssemblyById.clear();

    for (const side of sides) {
      for (const member of side.members) {
        this.characterSideById.set(member.character.id, side.id);
        this.characterAssemblyById.set(member.character.id, member.assembly.name);
      }
    }

    for (let i = 0; i < sides.length; i++) {
      const side = sides[i];
      const enemySide = sides[(i + 1) % sides.length];

      // Create SideAI
      if (this.config.enableStrategic) {
        const sideAI = createSideAI(side, this.battlefield, enemySide);
        this.sideAIs.set(side.id, sideAI);
      }

      // Create AssemblyAIs
      if (this.config.enableTactical) {
        const assemblyAIs = createSideAssemblyAIs(side, this.battlefield);
        for (const [assemblyId, assemblyAI] of assemblyAIs.entries()) {
          this.assemblyAIs.set(assemblyId, assemblyAI);
        }
      }
    }

    // Create CharacterAIs
    if (this.config.enableCharacterAI) {
      for (const side of sides) {
        const characters = side.members
          .filter(m => !m.character.state.isEliminated && !m.character.state.isKOd)
          .map(m => m.character);
        
        const charAIs = createCharacterAIs(characters);
        for (const [charId, charAI] of charAIs.entries()) {
          charAI.setConfig({
            allowKOdAttacks: this.config.allowKOdAttacks ?? false,
            kodControllerTraitsByCharacterId: this.config.kodControllerTraitsByCharacterId,
            kodCoordinatorTraitsByCharacterId: this.config.kodCoordinatorTraitsByCharacterId,
          });
          this.characterAIs.set(charId, charAI);
        }
      }
    }
  }

  /**
   * Run a complete AI-controlled game
   */
  runGame(maxTurns: number = 10): AIGameLoopResult {
    const result: AIGameLoopResult = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      replannedActions: 0,
      finalTurn: 0,
    };

    for (let turn = 1; turn <= maxTurns; turn++) {
      this.executor.resetReplanAttempts();
      
      const turnResult = this.runTurn(turn);
      result.totalActions += turnResult.totalActions;
      result.successfulActions += turnResult.successfulActions;
      result.failedActions += turnResult.failedActions;
      result.replannedActions += turnResult.replannedActions;
      result.finalTurn = turn;
      this.config.onTurnEnd?.(turn);

      // Check for game end conditions
      if (this.shouldEndGame(turn)) {
        result.endReason = this.getGameEndReason();
        break;
      }
    }

    return result;
  }

  /**
   * Run a single turn of AI decisions and actions
   */
  runTurn(turn: number): {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    replannedActions: number;
  } {
    const result = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      replannedActions: 0,
    };

    // Initialize turn - set up activation order via initiative
    if (turn === 1 || this.manager.phase !== TurnPhase.Activation) {
      this.manager.advancePhase({ roller: Math.random, roundsPerTurn: this.manager.roundsPerTurn });
    }

    while (!this.manager.isTurnOver()) {
      const character = this.manager.getNextToActivate();
      if (!character) {
        break;
      }
      if (character.state.isEliminated || character.state.isKOd) {
        this.manager.endActivation(character);
        continue;
      }

      const ap = this.manager.beginActivation(character);
      if (ap <= 0) {
        this.manager.endActivation(character);
        continue;
      }

      const charResult = this.runCharacterTurn(character, turn);
      result.totalActions += charResult.totalActions;
      result.successfulActions += charResult.successfulActions;
      result.failedActions += charResult.failedActions;
      result.replannedActions += charResult.replannedActions;

      this.manager.endActivation(character);
    }

    return result;
  }

  /**
   * Run AI decisions for a single character's activation
   */
  runCharacterTurn(
    character: Character,
    turn: number
  ): {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    replannedActions: number;
  } {
    const result = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      replannedActions: 0,
    };

    // Get AI decision hierarchy
    const decision = this.getAIDecision(character);
    if (!decision) {
      return result;
    }

    // Create execution context
    const context = this.createExecutionContext(character);

    // Execute action
    const execResult = this.executor.executeAction(decision, character, context);
    
    result.totalActions++;
    if (execResult.success) {
      result.successfulActions++;
    } else {
      result.failedActions++;
      if (execResult.replanningRecommended) {
        result.replannedActions++;
        
        // Try to get alternative action
        const altDecision = this.getAlternativeDecision(character, decision);
        if (altDecision) {
          const altResult = this.executor.executeAction(altDecision, character, context);
          result.totalActions++;
          if (altResult.success) {
            result.successfulActions++;
          } else {
            result.failedActions++;
          }
        }
      }
    }

    return result;
  }

  /**
   * Get AI decision for a character using full hierarchy
   */
  private getAIDecision(character: Character): ActionDecision | null {
    // Phase 3: Try Strategic Layer first (SideAI → AssemblyAI)
    if (this.config.enableStrategic || this.config.enableTactical) {
      const strategicDecision = this.getStrategicDecision(character);
      if (strategicDecision) {
        return strategicDecision;
      }
    }

    // Phase 1/2: Fall back to CharacterAI
    if (this.config.enableCharacterAI) {
      const charAI = this.characterAIs.get(character.id);
      if (charAI) {
        const context = this.createAIContext(character);
        const aiResult = charAI.decideAction(context);
        return aiResult.decision;
      }
    }

    // Default: Hold
    return {
      type: 'hold',
      reason: 'No AI decision available',
      priority: 0,
      requiresAP: false,
    };
  }

  /**
   * Get decision from strategic/tactical layer
   */
  private getStrategicDecision(character: Character): ActionDecision | null {
    // Find character's side
    const sideId = this.findCharacterSide(character);
    if (!sideId) return null;

    // Get SideAI priorities
    const sideAI = this.sideAIs.get(sideId);
    if (sideAI && this.config.enableStrategic) {
      const assessment = sideAI.assessSituation();
      const priorities = sideAI.getActionPriorities(assessment);
      
      const priority = priorities.get(character.id);
      if (priority) {
        return priority;
      }
    }

    // Get AssemblyAI coordination
    const assemblyId = this.findCharacterAssembly(character);
    if (assemblyId) {
      const assemblyAI = this.assemblyAIs.get(assemblyId);
      if (assemblyAI && this.config.enableTactical) {
        const assembly = character.profile ? { 
          id: assemblyId, 
          name: assemblyId, 
          totalBP: 0, 
          totalCharacters: 0 
        } : null;
        
        if (assembly) {
          const characters = [character];
          const enemies = this.getEnemyCharacters(character);
          
          const targetAssignments = assemblyAI.coordinateTargets(characters, enemies);
          const decisions = assemblyAI.generateCoordinatedActions(
            characters,
            enemies,
            targetAssignments
          );
          
          const decision = decisions.get(character.id);
          if (decision) {
            return decision;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get alternative decision when primary fails
   */
  private getAlternativeDecision(
    character: Character,
    failedDecision: ActionDecision
  ): ActionDecision | null {
    // Simple fallback: if attack failed, try move; if move failed, try hold
    switch (failedDecision.type) {
      case 'close_combat':
      case 'ranged_combat':
        // Try to move into better position
        const nearestEnemy = this.findNearestEnemy(character);
        if (nearestEnemy) {
          const pos = this.battlefield.getCharacterPosition(nearestEnemy);
          if (pos) {
            return {
              type: 'move',
              position: { x: pos.x - 1, y: pos.y },
              reason: 'Move toward enemy (fallback)',
              priority: 2,
              requiresAP: true,
            };
          }
        }
        break;

      case 'move':
        // Can't move, try to attack from current position
        const target = this.findNearestEnemy(character);
        if (target) {
          return {
            type: 'ranged_combat',
            target,
            reason: 'Attack from position (fallback)',
            priority: 2,
            requiresAP: true,
          };
        }
        break;
    }

    // Ultimate fallback: Hold
    return {
      type: 'hold',
      reason: 'Hold position (fallback)',
      priority: 0,
      requiresAP: false,
    };
  }

  /**
   * Create AI execution context
   */
  private createExecutionContext(character: Character): AIExecutionContext {
    return {
      currentTurn: this.manager.currentTurn,
      currentRound: this.manager.currentRound,
      apRemaining: this.manager.getApRemaining(character),
      allies: this.getAllyCharacters(character),
      enemies: this.getEnemyCharacters(character),
      battlefield: this.battlefield,
    };
  }

  /**
   * Create AI context for CharacterAI
   */
  private createAIContext(character: Character): any {
    const aiConfig = this.characterAIs.get(character.id)?.getConfig() ?? {
      aggression: 0.5,
      caution: 0.5,
      accuracyModifier: 0,
      godMode: true,
    };

    return {
      character,
      allies: this.getAllyCharacters(character),
      enemies: this.getEnemyCharacters(character),
      battlefield: this.battlefield,
      currentTurn: this.manager.currentTurn,
      currentRound: this.manager.currentRound,
      apRemaining: this.manager.getApRemaining(character),
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: this.manager.currentTurn,
      },
      config: aiConfig,
    };
  }

  /**
   * Find character's side ID
   */
  private findCharacterSide(character: Character): string | null {
    return this.characterSideById.get(character.id) ?? null;
  }

  /**
   * Find character's assembly ID
   */
  private findCharacterAssembly(character: Character): string | null {
    return this.characterAssemblyById.get(character.id) ?? null;
  }

  /**
   * Get ally characters
   */
  private getAllyCharacters(character: Character): Character[] {
    const sideId = this.findCharacterSide(character);
    if (!sideId) {
      return this.manager.characters.filter(
        c => c !== character && !c.state.isEliminated && !c.state.isKOd
      );
    }
    return this.manager.characters.filter(
      c =>
        c !== character &&
        this.findCharacterSide(c) === sideId &&
        !c.state.isEliminated &&
        !c.state.isKOd
    );
  }

  /**
   * Get enemy characters
   */
  private getEnemyCharacters(character: Character): Character[] {
    const ownSideId = this.findCharacterSide(character);
    return this.manager.characters.filter(
      c =>
        c !== character &&
        (ownSideId === null || this.findCharacterSide(c) !== ownSideId) &&
        isAttackableEnemy(character, c, {
          aggression: 0,
          caution: 0,
          accuracyModifier: 0,
          godMode: true,
          allowKOdAttacks: this.config.allowKOdAttacks ?? false,
          kodControllerTraitsByCharacterId: this.config.kodControllerTraitsByCharacterId,
          kodCoordinatorTraitsByCharacterId: this.config.kodCoordinatorTraitsByCharacterId,
        })
    );
  }

  /**
   * Find nearest enemy
   */
  private findNearestEnemy(character: Character): Character | null {
    const charPos = this.battlefield.getCharacterPosition(character);
    if (!charPos) return null;

    const enemies = this.getEnemyCharacters(character);
    let nearest: Character | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      const enemyPos = this.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const dist = Math.hypot(enemyPos.x - charPos.x, enemyPos.y - charPos.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  /**
   * Check if game should end
   */
  private shouldEndGame(turn: number): boolean {
    // Check if only one side has active models
    const activeBySide = new Map<string, number>();
    
    for (const sideId of this.sideIds) {
      activeBySide.set(sideId, 0);
    }

    for (const character of this.manager.characters) {
      if (!character.state.isEliminated && !character.state.isKOd) {
        const sideId = this.findCharacterSide(character);
        if (sideId) {
          const count = activeBySide.get(sideId) ?? 0;
          activeBySide.set(sideId, count + 1);
        }
      }
    }

    const activeSides = Array.from(activeBySide.values()).filter(c => c > 0).length;
    return activeSides <= 1 || turn >= 10;
  }

  /**
   * Get game end reason
   */
  private getGameEndReason(): string {
    const activeCharacters = this.manager.characters.filter(
      c => !c.state.isEliminated && !c.state.isKOd
    );

    if (activeCharacters.length === 0) {
      return 'All models eliminated';
    }

    const sideCounts = new Map<string, number>();
    for (const char of activeCharacters) {
      const sideId = this.findCharacterSide(char);
      if (sideId) {
        const count = sideCounts.get(sideId) ?? 0;
        sideCounts.set(sideId, count + 1);
      }
    }

    if (sideCounts.size === 1) {
      return 'One side remaining';
    }

    return 'Maximum turns reached';
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
