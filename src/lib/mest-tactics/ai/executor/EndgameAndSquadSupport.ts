import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { MissionSide } from '../../mission/MissionSide';
import { GameManager } from '../../engine/GameManager';
import { InstrumentationLogger } from '../../instrumentation/QSRInstrumentation';

export interface SquadActivationResult {
  success: boolean;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
}

export function shouldEndGameForGameLoop(
  turn: number,
  sideIds: string[],
  characters: Character[],
  findCharacterSide: (character: Character) => string | null
): boolean {
  const activeBySide = new Map<string, number>();

  for (const sideId of sideIds) {
    activeBySide.set(sideId, 0);
  }

  for (const character of characters) {
    if (!character.state.isEliminated && !character.state.isKOd) {
      const sideId = findCharacterSide(character);
      if (sideId) {
        const count = activeBySide.get(sideId) ?? 0;
        activeBySide.set(sideId, count + 1);
      }
    }
  }

  const activeSides = Array.from(activeBySide.values()).filter(c => c > 0).length;
  return activeSides <= 1 || turn >= 10;
}

export function getGameEndReasonForGameLoop(
  characters: Character[],
  findCharacterSide: (character: Character) => string | null
): string {
  const activeCharacters = characters.filter(
    c => !c.state.isEliminated && !c.state.isKOd
  );

  if (activeCharacters.length === 0) {
    return 'All models eliminated';
  }

  const sideCounts = new Map<string, number>();
  for (const char of activeCharacters) {
    const sideId = findCharacterSide(char);
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

export function considerSquadIPActivationForGameLoop(
  character: Character,
  turn: number,
  deps: {
    sides: MissionSide[];
    battlefield: Battlefield;
    manager: GameManager;
    logger: InstrumentationLogger | null;
    runCharacterTurn: (character: Character, turn: number) => {
      totalActions: number;
      successfulActions: number;
      failedActions: number;
      replannedActions: number;
    };
  }
): SquadActivationResult {
  const result: SquadActivationResult = {
    success: false,
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
  };

  const side = deps.sides.find(s =>
    s.members.some(m => m.character.id === character.id)
  );
  if (!side) return result;

  const ipAvailable = side.state.initiativePoints ?? 0;
  if (ipAvailable < 1) return result;

  const characterPos = deps.battlefield.getCharacterPosition(character);
  if (!characterPos) return result;

  const readySquadMembers: Character[] = [];
  for (const member of side.members) {
    if (member.character.id === character.id) continue;
    if (member.character.state.isEliminated || member.character.state.isKOd) continue;
    if (!member.character.state.isReady) continue;
    if (member.character.state.isWaiting) continue;

    const memberPos = deps.battlefield.getCharacterPosition(member.character);
    if (!memberPos) continue;

    const distance = Math.hypot(memberPos.x - characterPos.x, memberPos.y - characterPos.y);
    if (distance <= 8) {
      readySquadMembers.push(member.character);
    }
  }

  if (readySquadMembers.length === 0) return result;

  const firstSquadMember = readySquadMembers[0];
  const ap = deps.manager.beginActivation(firstSquadMember);
  if (ap <= 0 || firstSquadMember.state.isEliminated || firstSquadMember.state.isKOd) {
    deps.manager.endActivation(firstSquadMember);
    return result;
  }

  const spent = deps.manager.maintainInitiative(side);
  if (!spent) {
    deps.manager.endActivation(firstSquadMember);
    return result;
  }

  if (deps.logger) {
    deps.logger.logIpSpending(side.id, character.id, 'push', turn);
  }

  if (!firstSquadMember.state.isEliminated && !firstSquadMember.state.isKOd) {
    const squadResult = deps.runCharacterTurn(firstSquadMember, turn);
    result.totalActions += squadResult.totalActions;
    result.successfulActions += squadResult.successfulActions;
    result.failedActions += squadResult.failedActions;
    result.success = true;
  }

  deps.manager.endActivation(firstSquadMember);
  return result;
}

export function getSideNameForCharacterForGameLoop(
  character: Character,
  sides: MissionSide[]
): string {
  const side = sides.find(s => s.members.some(m => m.character.id === character.id));
  return side?.name || 'Unknown';
}

