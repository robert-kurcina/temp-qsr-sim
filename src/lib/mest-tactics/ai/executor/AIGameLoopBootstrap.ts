import { Battlefield } from '../../battlefield/Battlefield';
import { GameManager } from '../../engine/GameManager';
import { MissionSide } from '../../mission/MissionSide';
import { InstrumentationLogger } from '../../instrumentation/QSRInstrumentation';
import { createAIExecutor, AIActionExecutor } from './AIActionExecutor';
import {
  initializeAILayersForGameLoop,
  InitializedAILayers,
} from './AILayerInitializationSupport';
import {
  createAIGameLoopDecisionRuntime,
  AIGameLoopDecisionRuntime,
} from './AIGameLoopDecisionRuntime';
import { AIGameLoopConfig } from './AIGameLoopTypes';

interface BootstrapAIGameLoopParams {
  manager: GameManager;
  battlefield: Battlefield;
  sides: MissionSide[];
  config: AIGameLoopConfig;
  logger: InstrumentationLogger | null;
}

interface AIGameLoopBootstrapResult {
  executor: AIActionExecutor;
  aiLayers: InitializedAILayers;
  decisionRuntime: AIGameLoopDecisionRuntime;
}

export function bootstrapAIGameLoopState(
  params: BootstrapAIGameLoopParams
): AIGameLoopBootstrapResult {
  const executor = createAIExecutor(
    params.manager,
    {
      validateActions: params.config.enableValidation,
      enableReplanning: params.config.enableReplanning,
      verboseLogging: params.config.verboseLogging,
    },
    params.logger ?? undefined
  );

  const aiLayers = initializeAILayersForGameLoop(
    params.sides,
    params.battlefield,
    {
      enableStrategic: params.config.enableStrategic,
      enableTactical: params.config.enableTactical,
      enableCharacterAI: params.config.enableCharacterAI,
      allowKOdAttacks: params.config.allowKOdAttacks,
      kodControllerTraitsByCharacterId: params.config.kodControllerTraitsByCharacterId,
      kodCoordinatorTraitsByCharacterId: params.config.kodCoordinatorTraitsByCharacterId,
      visibilityOrMu: params.config.visibilityOrMu,
      maxOrm: params.config.maxOrm,
      allowConcentrateRangeExtension: params.config.allowConcentrateRangeExtension,
      perCharacterFovLos: params.config.perCharacterFovLos,
      allowWaitAction: params.config.allowWaitAction,
      allowHideAction: params.config.allowHideAction,
    }
  );

  const decisionRuntime = createAIGameLoopDecisionRuntime({
    manager: params.manager,
    battlefield: params.battlefield,
    sides: params.sides,
    getConfig: () => params.config,
    getCharacterAIs: () => aiLayers.characterAIs,
    getSideAIs: () => aiLayers.sideAIs,
    getAssemblyAIs: () => aiLayers.assemblyAIs,
    getCharacterSideById: () => aiLayers.characterSideById,
    getCharacterAssemblyById: () => aiLayers.characterAssemblyById,
  });

  return {
    executor,
    aiLayers,
    decisionRuntime,
  };
}
