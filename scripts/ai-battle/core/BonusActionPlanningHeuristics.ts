import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../../src/lib/mest-tactics/battlefield/spatial/size-utils';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type {
  BonusActionOption,
  BonusActionSelection,
  BonusActionType,
} from '../../../src/lib/mest-tactics/actions/bonus-actions';
import type { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { areCharactersEngagedForRunner } from './MovementPlanningSupport';
import {
  buildAutoBonusActionSelectionsForRunner,
  createBonusSelectionForTypeForRunner,
  findBestRetreatPositionForRunner,
  findPushBackSelectionForRunner,
  findRelocationPositionAgainstThreatsForRunner,
  findRelocationPositionForRunner,
  findTakeCoverPositionForRunner,
  getBonusActionPriorityForRunner,
  scoreIncomingThreatAtPositionForRunner,
} from './AIDecisionSupport';

function isCombatantActive(character: Character): boolean {
  return !character.state.isEliminated && !character.state.isKOd;
}

function countEngagers(subject: Character, candidates: Character[], battlefield: Battlefield): number {
  let count = 0;
  for (const candidate of candidates) {
    if (!isCombatantActive(candidate)) continue;
    if (candidate.id === subject.id) continue;
    if (areCharactersEngagedForRunner(subject, candidate, battlefield)) {
      count += 1;
    }
  }
  return count;
}

function isEngagedAtPositions(
  first: Character,
  firstPosition: Position,
  second: Character,
  secondPosition: Position
): boolean {
  const firstSiz = first.finalAttributes.siz ?? first.attributes.siz ?? 3;
  const secondSiz = second.finalAttributes.siz ?? second.attributes.siz ?? 3;
  return SpatialRules.isEngaged(
    {
      id: first.id,
      position: firstPosition,
      baseDiameter: getBaseDiameterFromSiz(firstSiz),
      siz: firstSiz,
    },
    {
      id: second.id,
      position: secondPosition,
      baseDiameter: getBaseDiameterFromSiz(secondSiz),
      siz: secondSiz,
    }
  );
}

function countEngagersAtPosition(
  target: Character,
  targetPosition: Position,
  candidates: Character[],
  battlefield: Battlefield
): number {
  let count = 0;
  for (const candidate of candidates) {
    if (!isCombatantActive(candidate)) continue;
    if (candidate.id === target.id) continue;
    const candidatePos = battlefield.getCharacterPosition(candidate);
    if (!candidatePos) continue;
    if (isEngagedAtPositions(target, targetPosition, candidate, candidatePos)) {
      count += 1;
    }
  }
  return count;
}

function scoreIncomingThreatAtPosition(
  character: Character,
  position: Position,
  enemies: Character[],
  battlefield: Battlefield
): number {
  return scoreIncomingThreatAtPositionForRunner(
    character,
    position,
    enemies,
    battlefield,
    {
      isCombatantActive: candidate => isCombatantActive(candidate),
      isEngagedAtPositions: (first, firstPosition, second, secondPosition) =>
        isEngagedAtPositions(first, firstPosition, second, secondPosition),
    }
  );
}

function findBestRetreatPosition(
  actor: Character,
  reference: Character,
  battlefield: Battlefield,
  enemies: Character[],
  maxDistance: number
): Position | undefined {
  return findBestRetreatPositionForRunner({
    actor,
    reference,
    battlefield,
    enemies,
    maxDistance,
    scoreIncomingThreatAtPosition: (subject, position, hostileModels, field) =>
      scoreIncomingThreatAtPosition(subject, position, hostileModels, field),
  });
}

function findRelocationPositionAgainstThreats(
  character: Character,
  battlefield: Battlefield,
  threatSources: Character[],
  primaryThreat?: Character
): Position | undefined {
  return findRelocationPositionAgainstThreatsForRunner({
    character,
    battlefield,
    threatSources,
    primaryThreat,
    isCombatantActive: candidate => isCombatantActive(candidate),
    scoreIncomingThreatAtPosition: (subject, position, enemies, field) =>
      scoreIncomingThreatAtPosition(subject, position, enemies, field),
  });
}

function findRelocationPosition(
  character: Character,
  battlefield: Battlefield,
  threatSource?: Character
): Position | undefined {
  return findRelocationPositionForRunner({
    character,
    battlefield,
    threatSource,
    findRelocationPositionAgainstThreats: (subject, field, threatSources, primaryThreat) =>
      findRelocationPositionAgainstThreats(subject, field, threatSources, primaryThreat),
  });
}

function findPushBackSelection(
  attacker: Character,
  target: Character,
  battlefield: Battlefield,
  allies: Character[],
  opponents: Character[]
): BonusActionSelection {
  return findPushBackSelectionForRunner({
    attacker,
    target,
    battlefield,
    allies,
    opponents,
    countEngagersAtPosition: (subject, targetPosition, candidates, field) =>
      countEngagersAtPosition(subject, targetPosition, candidates, field),
  });
}

function getBonusActionPriority(
  doctrine: TacticalDoctrine,
  isCloseCombat: boolean,
  attacker: Character,
  target: Character,
  battlefield: Battlefield,
  allies: Character[],
  opponents: Character[]
): BonusActionType[] {
  return getBonusActionPriorityForRunner({
    doctrine,
    isCloseCombat,
    attacker,
    target,
    battlefield,
    allies,
    opponents,
    countEngagers: (subject, candidates, field) => countEngagers(subject, candidates, field),
  });
}

function createBonusSelectionForType(
  type: BonusActionType,
  attacker: Character,
  target: Character,
  battlefield: Battlefield,
  allies: Character[],
  opponents: Character[]
): BonusActionSelection | undefined {
  return createBonusSelectionForTypeForRunner({
    type,
    attacker,
    target,
    battlefield,
    allies,
    opponents,
    findRelocationPositionAgainstThreats: (subject, field, threatSources, primaryThreat) =>
      findRelocationPositionAgainstThreats(subject, field, threatSources, primaryThreat),
    findBestRetreatPosition: (actor, reference, field, enemies, maxDistance) =>
      findBestRetreatPosition(actor, reference, field, enemies, maxDistance),
    findPushBackSelection: (chargeActor, chargeTarget, field, chargeAllies, chargeOpponents) =>
      findPushBackSelection(chargeActor, chargeTarget, field, chargeAllies, chargeOpponents),
  });
}

export function buildAutoBonusActionSelectionsWithHeuristics(params: {
  attacker: Character;
  target: Character;
  battlefield: Battlefield;
  allies: Character[];
  opponents: Character[];
  options: BonusActionOption[];
  isCloseCombat: boolean;
  doctrine: TacticalDoctrine;
}): BonusActionSelection[] {
  return buildAutoBonusActionSelectionsForRunner({
    ...params,
    getBonusActionPriority: (
      currentDoctrine,
      closeCombat,
      actingCharacter,
      targetCharacter,
      field,
      allyModels,
      opponentModels
    ) => getBonusActionPriority(currentDoctrine, closeCombat, actingCharacter, targetCharacter, field, allyModels, opponentModels),
    createBonusSelectionForType: (type, actingCharacter, targetCharacter, field, allyModels, opponentModels) =>
      createBonusSelectionForType(type, actingCharacter, targetCharacter, field, allyModels, opponentModels),
  });
}

export function findTakeCoverPositionWithHeuristics(
  defender: Character,
  attacker: Character,
  battlefield: Battlefield
): Position | undefined {
  return findTakeCoverPositionForRunner({
    defender,
    attacker,
    battlefield,
    findRelocationPosition: (subject, field, threatSource) =>
      findRelocationPosition(subject, field, threatSource),
  });
}
