import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { GameManager } from '../../engine/GameManager';
import { isAttackableEnemy } from '../core/ai-utils';
import { buildAIContext } from './AIContextBuilder';
import { buildCoordinatorContextSlice } from './CoordinatorContext';
import { createEmptyKnowledge } from './Knowledge';
import { AIExecutionContext } from './AIActionExecutor';
import { buildResourceSnapshotForCharacterSide } from './SideResourceSnapshot';

interface EnemySelectionPolicy {
  allowKOdAttacks?: boolean;
  kodControllerTraitsByCharacterId?: Record<string, string[]>;
  kodCoordinatorTraitsByCharacterId?: Record<string, string[]>;
}

interface CreateCharacterAIContextParams {
  character: Character;
  manager: GameManager;
  battlefield: Battlefield;
  allies: Character[];
  enemies: Character[];
  sideId: string | null;
  aiConfig: unknown;
}

export function findCharacterSideForGameLoop(
  character: Character,
  characterSideById: Map<string, string>
): string | null {
  return characterSideById.get(character.id) ?? null;
}

export function findCharacterAssemblyForGameLoop(
  character: Character,
  characterAssemblyById: Map<string, string>
): string | null {
  return characterAssemblyById.get(character.id) ?? null;
}

export function getAllyCharactersForGameLoop(
  character: Character,
  allCharacters: Character[],
  characterSideById: Map<string, string>
): Character[] {
  const sideId = findCharacterSideForGameLoop(character, characterSideById);
  if (!sideId) {
    return allCharacters.filter(
      c => c !== character && !c.state.isEliminated && !c.state.isKOd
    );
  }
  return allCharacters.filter(
    c =>
      c !== character &&
      findCharacterSideForGameLoop(c, characterSideById) === sideId &&
      !c.state.isEliminated &&
      !c.state.isKOd
  );
}

export function getEnemyCharactersForGameLoop(
  character: Character,
  allCharacters: Character[],
  characterSideById: Map<string, string>,
  policy: EnemySelectionPolicy
): Character[] {
  const ownSideId = findCharacterSideForGameLoop(character, characterSideById);
  return allCharacters.filter(
    c =>
      c !== character &&
      (ownSideId === null || findCharacterSideForGameLoop(c, characterSideById) !== ownSideId) &&
      isAttackableEnemy(character, c, {
        aggression: 0,
        caution: 0,
        accuracyModifier: 0,
        godMode: true,
        allowKOdAttacks: policy.allowKOdAttacks ?? false,
        kodControllerTraitsByCharacterId: policy.kodControllerTraitsByCharacterId,
        kodCoordinatorTraitsByCharacterId: policy.kodCoordinatorTraitsByCharacterId,
      })
  );
}

export function findNearestEnemyForGameLoop(
  character: Character,
  battlefield: Battlefield,
  enemies: Character[]
): Character | null {
  const charPos = battlefield.getCharacterPosition(character);
  if (!charPos) return null;

  let nearest: Character | null = null;
  let nearestDist = Infinity;

  for (const enemy of enemies) {
    const enemyPos = battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;

    const dist = Math.hypot(enemyPos.x - charPos.x, enemyPos.y - charPos.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }

  return nearest;
}

export function createExecutionContextForGameLoop(params: {
  character: Character;
  manager: GameManager;
  battlefield: Battlefield;
  allies: Character[];
  enemies: Character[];
}): AIExecutionContext {
  const { character, manager, battlefield, allies, enemies } = params;
  return {
    currentTurn: manager.currentTurn,
    currentRound: manager.currentRound,
    apRemaining: manager.getApRemaining(character),
    allies,
    enemies,
    battlefield,
  };
}

export function createCharacterAIContextForGameLoop(params: CreateCharacterAIContextParams): any {
  const {
    character,
    manager,
    battlefield,
    allies,
    enemies,
    sideId,
    aiConfig,
  } = params;

  let scoringContext: any = undefined;
  let targetCommitments: Record<string, number> | undefined = undefined;
  let scrumContinuity: Record<string, number> | undefined = undefined;
  let lanePressure: Record<string, number> | undefined = undefined;
  let vpBySide: Record<string, number> | undefined = undefined;
  let rpBySide: Record<string, number> | undefined = undefined;
  let maxTurns: number | undefined = undefined;
  let endGameTurn: number | undefined = undefined;

  if (sideId) {
    const coordinatorManager = manager.getSideCoordinatorManager();
    const coordinator = coordinatorManager?.getCoordinator(sideId);
    const coordinatorSlice = buildCoordinatorContextSlice({
      coordinator,
      currentTurn: manager.currentTurn,
      includeFractionalPotentialLedger: true,
    });
    scoringContext = coordinatorSlice.scoringContext;
    targetCommitments = coordinatorSlice.targetCommitments;
    scrumContinuity = coordinatorSlice.scrumContinuity;
    lanePressure = coordinatorSlice.lanePressure;

    const resourceSnapshot = buildResourceSnapshotForCharacterSide(
      manager.missionSides,
      sideId,
      manager.maxTurns,
      6
    );
    vpBySide = resourceSnapshot.vpBySide;
    rpBySide = resourceSnapshot.rpBySide;
    maxTurns = resourceSnapshot.maxTurns;
    endGameTurn = manager.getEndGameTriggerState().triggerTurn;
  }

  return buildAIContext({
    character,
    allies,
    enemies,
    battlefield,
    currentTurn: manager.currentTurn,
    currentRound: manager.currentRound,
    apRemaining: manager.getApRemaining(character),
    sideId: sideId ?? undefined,
    knowledge: createEmptyKnowledge(manager.currentTurn),
    config: aiConfig as any,
    vpBySide,
    rpBySide,
    maxTurns,
    endGameTurn,
    coordinator: {
      scoringContext,
      targetCommitments,
      scrumContinuity,
      lanePressure,
    },
  });
}
