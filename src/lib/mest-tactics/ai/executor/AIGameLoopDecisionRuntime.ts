import { ModelStateAudit } from '../../audit/AuditService';
import { Battlefield } from '../../battlefield/Battlefield';
import { Character } from '../../core/Character';
import { GameManager } from '../../engine/GameManager';
import { MissionSide } from '../../mission/MissionSide';
import { ActionDecision } from '../core/AIController';
import { CharacterAI } from '../core/CharacterAI';
import { AssemblyAI } from '../strategic/AssemblyAI';
import { SideAI } from '../strategic/SideAI';
import { AIExecutionContext } from './AIActionExecutor';
import {
  createCharacterAIContextForGameLoop,
  createExecutionContextForGameLoop,
  findCharacterAssemblyForGameLoop,
  findCharacterSideForGameLoop,
  findNearestEnemyForGameLoop,
  getAllyCharactersForGameLoop,
  getEnemyCharactersForGameLoop,
} from './AICharacterContextSupport';
import {
  estimateImmediateMoveAllowanceForGameLoop,
  findEngagedEnemyForGameLoop,
  isEngagedWithAnyEnemyForGameLoop,
  isEngagedWithEnemyTargetForGameLoop,
  isValidDecisionForGameLoop,
  resolveReachableMoveDestinationForGameLoop,
  sanitizeDecisionForExecutionForGameLoop,
} from './DecisionSanitizationSupport';
import {
  getAIDecisionForGameLoop,
  getAggressiveFallbackDecisionForGameLoop,
  getAlternativeDecisionForGameLoop,
} from './DecisionSelectionSupport';
import { getSideNameForCharacterForGameLoop } from './EndgameAndSquadSupport';
import { hasMeleeWeapon, hasRangedWeapon } from './LoadoutProfile';
import { buildPressureTopologySignatureForGameLoop } from './PressureTopologySupport';

export interface AIGameLoopDecisionRuntimeConfig {
  enableStrategic: boolean;
  enableTactical: boolean;
  enableCharacterAI: boolean;
  allowKOdAttacks?: boolean;
  kodControllerTraitsByCharacterId?: Record<string, string[]>;
  kodCoordinatorTraitsByCharacterId?: Record<string, string[]>;
  allowWaitAction?: boolean;
  allowHideAction?: boolean;
}

interface AIGameLoopDecisionRuntimeDeps {
  manager: GameManager;
  battlefield: Battlefield;
  sides: MissionSide[];
  getConfig: () => AIGameLoopDecisionRuntimeConfig;
  getCharacterAIs: () => Map<string, CharacterAI>;
  getSideAIs: () => Map<string, SideAI>;
  getAssemblyAIs: () => Map<string, AssemblyAI>;
  getCharacterSideById: () => Map<string, string>;
  getCharacterAssemblyById: () => Map<string, string>;
}

export interface AIGameLoopDecisionRuntime {
  captureModelState: (character: Character) => ModelStateAudit;
  getAIDecision: (character: Character) => ActionDecision | null;
  getAlternativeDecision: (
    character: Character,
    failedDecision: ActionDecision
  ) => ActionDecision | null;
  getAggressiveFallbackDecision: (
    character: Character,
    apRemaining: number,
    preferredTarget?: Character
  ) => ActionDecision | null;
  sanitizeDecisionForExecution: (
    character: Character,
    decision: ActionDecision,
    apRemaining: number,
    actionsTakenThisInitiative?: number
  ) => ActionDecision | null;
  buildPressureTopologySignature: (
    actionType: string,
    sideId: string,
    attacker: Character,
    target: Character
  ) => string | undefined;
  createExecutionContext: (character: Character) => AIExecutionContext;
  findCharacterSide: (character: Character) => string | null;
  getSideNameForCharacter: (character: Character) => string;
}

export function createAIGameLoopDecisionRuntime(
  deps: AIGameLoopDecisionRuntimeDeps
): AIGameLoopDecisionRuntime {
  const findCharacterSide = (character: Character): string | null =>
    findCharacterSideForGameLoop(character, deps.getCharacterSideById());

  const findCharacterAssembly = (character: Character): string | null =>
    findCharacterAssemblyForGameLoop(character, deps.getCharacterAssemblyById());

  const getAllyCharacters = (character: Character): Character[] =>
    getAllyCharactersForGameLoop(
      character,
      deps.manager.characters,
      deps.getCharacterSideById()
    );

  const getEnemyCharacters = (character: Character): Character[] => {
    const config = deps.getConfig();
    return getEnemyCharactersForGameLoop(
      character,
      deps.manager.characters,
      deps.getCharacterSideById(),
      {
        allowKOdAttacks: config.allowKOdAttacks,
        kodControllerTraitsByCharacterId: config.kodControllerTraitsByCharacterId,
        kodCoordinatorTraitsByCharacterId: config.kodCoordinatorTraitsByCharacterId,
      }
    );
  };

  const findNearestEnemy = (character: Character): Character | null =>
    findNearestEnemyForGameLoop(character, deps.battlefield, getEnemyCharacters(character));

  const createAIContext = (character: Character): any => {
    const aiConfig = deps.getCharacterAIs().get(character.id)?.getConfig() ?? {
      aggression: 0.5,
      caution: 0.5,
      accuracyModifier: 0,
      godMode: true,
    };
    return createCharacterAIContextForGameLoop({
      character,
      manager: deps.manager,
      battlefield: deps.battlefield,
      allies: getAllyCharacters(character),
      enemies: getEnemyCharacters(character),
      sideId: findCharacterSide(character),
      aiConfig,
    });
  };

  const isEngagedWithEnemyTarget = (character: Character, target: Character): boolean =>
    isEngagedWithEnemyTargetForGameLoop(character, target, deps.battlefield);

  const isEngagedWithAnyEnemy = (character: Character): boolean =>
    isEngagedWithAnyEnemyForGameLoop(character, deps.battlefield, getEnemyCharacters(character));

  const findEngagedEnemy = (character: Character): Character | null =>
    findEngagedEnemyForGameLoop(character, deps.battlefield, getEnemyCharacters(character));

  const resolveReachableMoveDestination = (
    character: Character,
    desired: { x: number; y: number }
  ): { x: number; y: number } | null =>
    resolveReachableMoveDestinationForGameLoop(character, desired, deps.battlefield);

  const isValidDecision = (decision: ActionDecision, character: Character): boolean => {
    const config = deps.getConfig();
    return isValidDecisionForGameLoop(decision, character, {
      battlefield: deps.battlefield,
      allowWaitAction: config.allowWaitAction,
      allowHideAction: config.allowHideAction,
      getEnemyCharacters,
      hasRangedWeapon,
    });
  };

  const createDecisionSelectionDeps = (): Parameters<typeof getAIDecisionForGameLoop>[1] => {
    const config = deps.getConfig();
    return {
      config: {
        enableStrategic: config.enableStrategic,
        enableTactical: config.enableTactical,
        enableCharacterAI: config.enableCharacterAI,
      },
      battlefield: deps.battlefield,
      characterAIs: deps.getCharacterAIs(),
      sideAIs: deps.getSideAIs(),
      assemblyAIs: deps.getAssemblyAIs(),
      getAIContext: createAIContext,
      findCharacterSide,
      findCharacterAssembly,
      getEnemyCharacters,
      findNearestEnemy,
      isValidDecision,
      isEngagedWithAnyEnemy,
      isEngagedWithEnemyTarget,
      findEngagedEnemy,
      resolveReachableMoveDestination,
      estimateImmediateMoveAllowance: estimateImmediateMoveAllowanceForGameLoop,
      hasMeleeWeapon,
      hasRangedWeapon,
      getApRemaining: character => deps.manager.getApRemaining(character),
    };
  };

  return {
    captureModelState: (character: Character): ModelStateAudit => ({
      wounds: character.state.wounds || 0,
      delayTokens: character.state.delayTokens || 0,
      fearTokens: character.state.fearTokens || 0,
      isKOd: character.state.isKOd || false,
      isEliminated: character.state.isEliminated || false,
      isHidden: character.state.isHidden || false,
      isWaiting: character.state.isWaiting || false,
      isAttentive: character.state.isAttentive || false,
      isOrdered: character.state.isOrdered || false,
    }),

    getAIDecision: (character: Character): ActionDecision | null =>
      getAIDecisionForGameLoop(character, createDecisionSelectionDeps()),

    getAlternativeDecision: (
      character: Character,
      failedDecision: ActionDecision
    ): ActionDecision | null =>
      getAlternativeDecisionForGameLoop(
        character,
        failedDecision,
        createDecisionSelectionDeps()
      ),

    getAggressiveFallbackDecision: (
      character: Character,
      apRemaining: number,
      preferredTarget?: Character
    ): ActionDecision | null =>
      getAggressiveFallbackDecisionForGameLoop(
        character,
        apRemaining,
        preferredTarget,
        createDecisionSelectionDeps()
      ),

    sanitizeDecisionForExecution: (
      character: Character,
      decision: ActionDecision,
      apRemaining: number,
      actionsTakenThisInitiative: number = 0
    ): ActionDecision | null => {
      const config = deps.getConfig();
      return sanitizeDecisionForExecutionForGameLoop(
        character,
        decision,
        apRemaining,
        {
          battlefield: deps.battlefield,
          allowWaitAction: config.allowWaitAction,
          allowHideAction: config.allowHideAction,
          getEnemyCharacters,
          hasRangedWeapon,
          hasMeleeWeapon,
          fallbackDecision: (actor, ap, preferredTarget) =>
            getAggressiveFallbackDecisionForGameLoop(
              actor,
              ap,
              preferredTarget,
              createDecisionSelectionDeps()
            ),
        },
        {
          actionsTakenThisInitiative,
        }
      );
    },

    buildPressureTopologySignature: (
      actionType: string,
      sideId: string,
      attacker: Character,
      target: Character
    ): string | undefined =>
      buildPressureTopologySignatureForGameLoop(actionType, sideId, attacker, target, {
        battlefield: deps.battlefield,
        allCharacters: deps.manager.characters,
        findCharacterSide,
      }),

    createExecutionContext: (character: Character): AIExecutionContext =>
      createExecutionContextForGameLoop({
        character,
        manager: deps.manager,
        battlefield: deps.battlefield,
        allies: getAllyCharacters(character),
        enemies: getEnemyCharacters(character),
      }),

    findCharacterSide,

    getSideNameForCharacter: (character: Character): string =>
      getSideNameForCharacterForGameLoop(character, deps.sides),
  };
}
