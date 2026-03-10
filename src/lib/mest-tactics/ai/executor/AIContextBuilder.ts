import type {
  AIContext,
  AIControllerConfig,
  AIObjectiveMarkerInfo,
  CharacterKnowledge,
} from '../core/AIController';
import type { Battlefield } from '../../battlefield/Battlefield';
import type { Character } from '../../core/Character';
import type { CoordinatorContextSlice } from './CoordinatorContext';

export interface BuildAIContextOptions {
  character: Character;
  allies: Character[];
  enemies: Character[];
  battlefield: Battlefield;
  currentTurn: number;
  currentRound: number;
  apRemaining: number;
  config: AIControllerConfig;
  sideId?: string;
  side?: any;
  objectiveMarkers?: AIObjectiveMarkerInfo[];
  knowledge?: CharacterKnowledge;
  vpBySide?: Record<string, number>;
  rpBySide?: Record<string, number>;
  maxTurns?: number;
  endGameTurn?: number;
  coordinator?: CoordinatorContextSlice;
}

export function buildAIContext(options: BuildAIContextOptions): AIContext {
  const context: AIContext = {
    character: options.character,
    allies: options.allies,
    enemies: options.enemies,
    battlefield: options.battlefield,
    currentTurn: options.currentTurn,
    currentRound: options.currentRound,
    apRemaining: options.apRemaining,
    sideId: options.sideId,
    side: options.side,
    objectiveMarkers: options.objectiveMarkers,
    knowledge: options.knowledge,
    config: options.config,
    vpBySide: options.vpBySide,
    rpBySide: options.rpBySide,
    maxTurns: options.maxTurns,
    endGameTurn: options.endGameTurn,
  };

  if (options.coordinator) {
    context.scoringContext = options.coordinator.scoringContext;
    context.targetCommitments = options.coordinator.targetCommitments;
    context.scrumContinuity = options.coordinator.scrumContinuity;
    context.lanePressure = options.coordinator.lanePressure;
  }

  return context;
}
