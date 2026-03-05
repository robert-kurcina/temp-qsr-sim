import { Character } from '../core/Character';
import { Position } from '../battlefield/Position';
import { Item } from '../core/Item';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { getSprintLevel, getLeapAgilityBonus, checkLeapUsage, getSurefootedTerrainBonus, TerrainType } from '../traits/combat-traits';
import { resolveDeclaredWeapon } from './declared-weapon';

export interface MoveActionDeps {
  getCharacterPosition: (character: Character) => Position | undefined;
  moveCharacter: (character: Character, position: Position) => boolean;
  swapCharacters?: (first: Character, second: Character) => boolean;
  spendApForSwap?: (character: Character, amount: number) => boolean;
  getTerrainAt: (position: Position) => TerrainType;
  canOccupy: (position: Position, baseDiameter: number) => boolean; // QSR: Footprint validation
  isWithinBounds?: (position: Position, baseDiameter: number) => boolean;
  eliminateOnFearExit?: (character: Character) => void;
  executeCloseCombatAttack: (
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: {
      attacker: { id: string; position: Position; baseDiameter: number; siz: number };
      target: { id: string; position: Position; baseDiameter: number; siz: number };
      allowBonusActions: boolean;
      weaponIndex?: number;
    }
  ) => unknown;
  /** Optional pathfinding engine for calculating actual movement cost */
  findPathCost?: (start: Position, end: Position) => number | null;
}

export function executeMoveAction(
  deps: MoveActionDeps,
  mover: Character,
  destination: Position,
  options: {
    opponents?: Character[];
    isFriendlyToMover?: (candidate: Character) => boolean;
    swapTarget?: Character;
    allowOpportunityAttack?: boolean;
    opportunityWeapon?: Item;
    isMovingStraight?: boolean;
    isAtStartOrEndOfMovement?: boolean;
    path?: Position[];
  } = {}
) {
  const start = deps.getCharacterPosition(mover);
  if (!start) {
    throw new Error('Missing mover position.');
  }

  const pathWaypoints = buildPathWaypoints(start, destination, options.path);
  const finalDestination = pathWaypoints[pathWaypoints.length - 1];

  if (options.swapTarget) {
    return executeSwapDuringMovement(deps, mover, start, finalDestination, options);
  }

  // Sprint X: Bonus movement when moving in a straight line
  const sprintBonus = getSprintMovementBonus(mover, options.isMovingStraight ?? false, mover.state.isAttentive, true);

  // Leap X: Agility bonus at start or end of movement
  const leapResult = checkLeapUsage(mover, options.isAtStartOrEndOfMovement ?? false);
  const agilityBonus = leapResult.agilityBonus;

  // Surefooted X: Upgrade terrain effects
  const currentTerrain = deps.getTerrainAt(destination);
  if (currentTerrain === 'Impassable') {
    return { moved: false, reason: 'Destination is impassable terrain', directionChangesApplied: 0, sprintBonusApplied: sprintBonus, leapBonusApplied: agilityBonus };
  }
  const upgradedTerrain = getSurefootedTerrainBonus(mover, currentTerrain);

  // Calculate effective movement allowance per QSR:
  // normal Move allowance is MOV + 2 MU, then apply trait-based bonuses.
  const baseMov = mover.finalAttributes.mov ?? 2;
  const effectiveMov = baseMov + 2 + sprintBonus + agilityBonus;

  // QSR MV.8/MV.9: direction changes are capped by MOV, plus one extra facing
  // change allowance before applying movement-trait effects.
  const directionChanges = countDirectionChanges(start, pathWaypoints);
  const maxDirectionChanges = baseMov + 1;
  if (directionChanges > maxDirectionChanges) {
    return {
      moved: false,
      reason: `Too many direction changes: ${directionChanges} exceeds maximum allowed (${maxDirectionChanges})`,
    };
  }

  // QSR MV.6: if movement would pass through engagement with an Attentive opposing
  // model, movement must stop when engaged (cannot continue beyond that point).
  if (options.opponents?.length) {
    const moverBase = getBaseDiameterFromSiz(mover.finalAttributes.siz ?? mover.attributes.siz ?? 3);
    const attentiveOpponents = options.opponents.filter(opponent => opponent.state.isAttentive);
    if (attentiveOpponents.length > 0) {
      const pathSegments = toPathSegments(start, pathWaypoints);
      for (const opponent of attentiveOpponents) {
        const opponentPos = deps.getCharacterPosition(opponent);
        if (!opponentPos) continue;
        const opponentBase = getBaseDiameterFromSiz(opponent.finalAttributes.siz ?? opponent.attributes.siz ?? 3);
        for (const segment of pathSegments) {
          const engagesAtStart = SpatialRules.isEngaged(
            {
              id: mover.id,
              position: segment.from,
              baseDiameter: moverBase,
              siz: mover.finalAttributes.siz,
              isPanicked: mover.state.isPanicked,
            },
            {
              id: opponent.id,
              position: opponentPos,
              baseDiameter: opponentBase,
              siz: opponent.finalAttributes.siz,
              isPanicked: opponent.state.isPanicked,
            }
          );
          const engagesAtEnd = SpatialRules.isEngaged(
            {
              id: mover.id,
              position: segment.to,
              baseDiameter: moverBase,
              siz: mover.finalAttributes.siz,
              isPanicked: mover.state.isPanicked,
            },
            {
              id: opponent.id,
              position: opponentPos,
              baseDiameter: opponentBase,
              siz: opponent.finalAttributes.siz,
              isPanicked: opponent.state.isPanicked,
            }
          );
          if (engagesAtStart || engagesAtEnd) {
            continue;
          }
          if (segmentIntersectsEngagementZone(segment.from, segment.to, opponentPos, (moverBase + opponentBase) / 2)) {
            return { moved: false, reason: 'Movement must stop when engaged with an Attentive opposing model' };
          }
        }
      }
    }
  }

  // Check for impassable terrain at destination
  if ((currentTerrain as any) === 'Impassable') {
    return { moved: false, reason: 'Destination is impassable terrain', directionChangesApplied: directionChanges, sprintBonusApplied: sprintBonus, leapBonusApplied: agilityBonus, eliminated: false, exitedBattlefield: false, opportunityAttack: false, swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined };
  }

  // QSR: Check if model can fit at destination (footprint validation)
  const moverBase = getBaseDiameterFromSiz(mover.finalAttributes.siz ?? mover.attributes.siz ?? 3);
  if (deps.isWithinBounds && !deps.isWithinBounds(finalDestination, moverBase)) {
    // QSR EL.2: Exiting the battlefield while Disordered/Panicked eliminates the model.
    if ((mover.state.isDisordered || mover.state.isPanicked) && deps.eliminateOnFearExit) {
      deps.eliminateOnFearExit(mover);
      return { moved: true, eliminated: true, exitedBattlefield: true, directionChangesApplied: directionChanges, sprintBonusApplied: sprintBonus, leapBonusApplied: agilityBonus, opportunityAttack: false, swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined };
    }
    return { moved: false, reason: 'Destination is outside battlefield bounds', directionChangesApplied: directionChanges, sprintBonusApplied: sprintBonus, leapBonusApplied: agilityBonus, eliminated: false, exitedBattlefield: false, opportunityAttack: false, swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined };
  }
  if (!deps.canOccupy(finalDestination, moverBase)) {
    return { moved: false, reason: `Destination too small for model (requires ${moverBase.toFixed(1)} MU clearance)`, directionChangesApplied: directionChanges, sprintBonusApplied: sprintBonus, leapBonusApplied: agilityBonus, eliminated: false, exitedBattlefield: false, opportunityAttack: false, swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined };
  }

  // Calculate movement cost using pathfinding if available, otherwise use straight-line distance
  let movementCost = 0;
  const pathSegments = toPathSegments(start, pathWaypoints);
  for (const segment of pathSegments) {
    if (deps.findPathCost) {
      const segmentCost = deps.findPathCost(segment.from, segment.to);
      if (segmentCost === null) {
        return { moved: false, reason: 'Path blocked by terrain or obstacles', directionChangesApplied: directionChanges, sprintBonusApplied: sprintBonus, leapBonusApplied: agilityBonus, eliminated: false, exitedBattlefield: false, opportunityAttack: false, swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined };
      }
      movementCost += segmentCost;
    } else {
      const dx = segment.to.x - segment.from.x;
      const dy = segment.to.y - segment.from.y;
      movementCost += Math.hypot(dx, dy);
    }
  }

  // Allow move if within effective movement allowance
  // Add small epsilon for floating point comparison
  if (movementCost > effectiveMov + 1e-6) {
    return { moved: false, reason: `Destination out of range: ${movementCost.toFixed(1)} MU exceeds max movement (${effectiveMov} MU)`, directionChangesApplied: directionChanges, sprintBonusApplied: sprintBonus, leapBonusApplied: agilityBonus, eliminated: false, exitedBattlefield: false, opportunityAttack: false, swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined };
  }

  const moved = deps.moveCharacter(mover, finalDestination);
  if (!moved) {
    return { moved: false, directionChangesApplied: directionChanges, sprintBonusApplied: sprintBonus, leapBonusApplied: agilityBonus, eliminated: false, exitedBattlefield: false, opportunityAttack: false, swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined };
  }

  let opportunity: { attacker: Character; result: unknown } | null = null;
  if (options.allowOpportunityAttack && options.opponents?.length && options.opportunityWeapon) {
    for (const opponent of options.opponents) {
      if (!opponent.state.isAttentive || !opponent.state.isOrdered) continue;
      const opponentPos = deps.getCharacterPosition(opponent);
      if (!opponentPos) continue;
      const moverBase = getBaseDiameterFromSiz(mover.finalAttributes.siz);
      const opponentBase = getBaseDiameterFromSiz(opponent.finalAttributes.siz);
      const wasEngaged = SpatialRules.isEngaged(
        {
          id: mover.id,
          position: start,
          baseDiameter: moverBase,
          siz: mover.finalAttributes.siz,
          isPanicked: mover.state.isPanicked,
        },
        {
          id: opponent.id,
          position: opponentPos,
          baseDiameter: opponentBase,
          siz: opponent.finalAttributes.siz,
          isPanicked: opponent.state.isPanicked,
        }
      );
      const nowEngaged = SpatialRules.isEngaged(
        {
          id: mover.id,
          position: finalDestination,
          baseDiameter: moverBase,
          siz: mover.finalAttributes.siz,
          isPanicked: mover.state.isPanicked,
        },
        {
          id: opponent.id,
          position: opponentPos,
          baseDiameter: opponentBase,
          siz: opponent.finalAttributes.siz,
          isPanicked: opponent.state.isPanicked,
        }
      );
      if (wasEngaged && !nowEngaged) {
        const resolved = resolveDeclaredWeapon(opponent, options.opportunityWeapon);
        const result = deps.executeCloseCombatAttack(opponent, mover, resolved.weapon, {
          attacker: { id: opponent.id, position: opponentPos, baseDiameter: opponentBase, siz: opponent.finalAttributes.siz },
          target: { id: mover.id, position: finalDestination, baseDiameter: moverBase, siz: mover.finalAttributes.siz },
          allowBonusActions: true,
          weaponIndex: resolved.weaponIndex,
        });
        opportunity = { attacker: opponent, result };
        break;
      }
    }
  }

  return {
    moved: true,
    opportunityAttack: opportunity,
    sprintBonusApplied: sprintBonus > 0,
    leapBonusApplied: agilityBonus > 0,
    terrainUpgraded: currentTerrain !== upgradedTerrain,
    directionChangesApplied: directionChanges,
    eliminated: false,
    exitedBattlefield: false,
    swapped: false,
    swapTargetId: undefined,
    swapApCost: 0,
    delayAppliedToId: undefined,
  };
}

function executeSwapDuringMovement(
  deps: MoveActionDeps,
  mover: Character,
  moverStart: Position,
  destination: Position,
  options: {
    opponents?: Character[];
    isFriendlyToMover?: (candidate: Character) => boolean;
    swapTarget?: Character;
    allowOpportunityAttack?: boolean;
    opportunityWeapon?: Item;
    isMovingStraight?: boolean;
    isAtStartOrEndOfMovement?: boolean;
    path?: Position[];
  }
) {
  const swapTarget = options.swapTarget;
  if (!swapTarget) {
    return { moved: false, reason: 'Swap target is required for swap movement', swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined, directionChangesApplied: 0, sprintBonusApplied: false, leapBonusApplied: false, eliminated: false, exitedBattlefield: false, opportunityAttack: false, terrainUpgraded: false };
  }
  if (!deps.swapCharacters) {
    return { moved: false, reason: 'Swap movement is not supported by current movement context', swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined, directionChangesApplied: 0, sprintBonusApplied: false, leapBonusApplied: false, eliminated: false, exitedBattlefield: false, opportunityAttack: false, terrainUpgraded: false };
  }

  const targetStart = deps.getCharacterPosition(swapTarget);
  if (!targetStart) {
    return { moved: false, reason: 'Swap target has no battlefield position', swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined, directionChangesApplied: 0, sprintBonusApplied: false, leapBonusApplied: false, eliminated: false, exitedBattlefield: false, opportunityAttack: false, terrainUpgraded: false };
  }

  if (options.isFriendlyToMover && !options.isFriendlyToMover(swapTarget)) {
    return { moved: false, reason: 'Swap target must be a Friendly model', swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined, directionChangesApplied: 0, sprintBonusApplied: false, leapBonusApplied: false, eliminated: false, exitedBattlefield: false, opportunityAttack: false, terrainUpgraded: false };
  }

  const moverModel = buildSpatialModel(mover, moverStart);
  const targetModel = buildSpatialModel(swapTarget, targetStart);
  if (!isInBaseContact(moverModel, targetModel)) {
    return { moved: false, reason: 'Swap requires base-contact with target model', swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined, directionChangesApplied: 0, sprintBonusApplied: false, leapBonusApplied: false, eliminated: false, exitedBattlefield: false, opportunityAttack: false, terrainUpgraded: false };
  }

  if (!positionsEqual(destination, targetStart)) {
    return { moved: false, reason: 'Swap destination must be the target model position', swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined, directionChangesApplied: 0, sprintBonusApplied: false, leapBonusApplied: false, eliminated: false, exitedBattlefield: false, opportunityAttack: false, terrainUpgraded: false };
  }

  const targetEngagedToAttentiveOrderedOpponent = (options.opponents ?? [])
    .filter(opponent => opponent.state.isAttentive && opponent.state.isOrdered)
    .some(opponent => {
      const opponentPos = deps.getCharacterPosition(opponent);
      if (!opponentPos) return false;
      const opponentModel = buildSpatialModel(opponent, opponentPos);
      return SpatialRules.isEngaged(targetModel, opponentModel);
    });
  if (targetEngagedToAttentiveOrderedOpponent) {
    return {
      moved: false,
      reason: 'Cannot swap with target engaged to an Attentive Ordered opposing model',
      swapped: false,
      swapTargetId: undefined,
      swapApCost: 0,
      delayAppliedToId: undefined,
      directionChangesApplied: 0,
      sprintBonusApplied: false,
      leapBonusApplied: false,
      eliminated: false,
      exitedBattlefield: false,
      opportunityAttack: false,
      terrainUpgraded: false,
    };
  }

  const targetFree = isCharacterFreeAgainstOpponents(deps, swapTarget, options.opponents ?? []);
  const qualifiesAsDisorderedDistracted = swapTarget.state.isDisordered && swapTarget.state.isDistracted;
  const qualifiesAsAttentiveFriendlyFree = swapTarget.state.isAttentive && targetFree;
  if (!qualifiesAsDisorderedDistracted && !qualifiesAsAttentiveFriendlyFree) {
    return {
      moved: false,
      reason: 'Swap target must be Disordered+Distracted or Attentive Friendly Free',
      swapped: false,
      swapTargetId: undefined,
      swapApCost: 0,
      delayAppliedToId: undefined,
      directionChangesApplied: 0,
      sprintBonusApplied: false,
      leapBonusApplied: false,
      eliminated: false,
      exitedBattlefield: false,
      opportunityAttack: false,
      terrainUpgraded: false,
    };
  }

  const swapsThisInitiative = mover.state.swapsThisInitiative ?? 0;
  const swapApCost = swapsThisInitiative === 0 ? 0 : 1;
  if (swapApCost > 0) {
    if (!deps.spendApForSwap) {
      return { moved: false, reason: 'Swap AP cost cannot be resolved in this context', swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined, directionChangesApplied: 0, sprintBonusApplied: false, leapBonusApplied: false, eliminated: false, exitedBattlefield: false, opportunityAttack: false, terrainUpgraded: false };
    }
    if (!deps.spendApForSwap(mover, swapApCost)) {
      return { moved: false, reason: 'Not enough AP for additional Swap this Initiative', swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined, directionChangesApplied: 0, sprintBonusApplied: false, leapBonusApplied: false, eliminated: false, exitedBattlefield: false, opportunityAttack: false, terrainUpgraded: false };
    }
  }

  const swapped = deps.swapCharacters(mover, swapTarget);
  if (!swapped) {
    return { moved: false, reason: 'Swap movement failed', swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined, directionChangesApplied: 0, sprintBonusApplied: false, leapBonusApplied: false, eliminated: false, exitedBattlefield: false, opportunityAttack: false, terrainUpgraded: false };
  }

  const disorderedParticipant = mover.state.isDisordered ? mover : (swapTarget.state.isDisordered ? swapTarget : null);
  if (disorderedParticipant) {
    disorderedParticipant.state.delayTokens += 1;
    disorderedParticipant.refreshStatusFlags();
  }

  mover.state.swapsThisInitiative = swapsThisInitiative + 1;

  return {
    moved: true,
    swapped: true,
    swapTargetId: swapTarget.id,
    swapApCost,
    delayAppliedToId: disorderedParticipant?.id,
    directionChangesApplied: 0,
    sprintBonusApplied: false,
    leapBonusApplied: false,
    eliminated: false,
    exitedBattlefield: false,
    opportunityAttack: false,
    terrainUpgraded: false,
  };
}

function getSprintMovementBonus(character: Character, isMovingStraight: boolean, isAttentive: boolean, isFree: boolean): number {
  const sprintLevel = getSprintLevel(character);
  if (sprintLevel <= 0 || !isMovingStraight) {
    return 0;
  }
  // X × 4" if Attentive Free, otherwise X × 2"
  if (isAttentive && isFree) {
    return sprintLevel * 4;
  }
  return sprintLevel * 2;
}

function buildPathWaypoints(start: Position, destination: Position, path?: Position[]): Position[] {
  if (!path || path.length === 0) {
    return [destination];
  }
  const waypoints = [...path];
  const last = waypoints[waypoints.length - 1];
  if (!positionsEqual(last, destination)) {
    waypoints.push(destination);
  }
  // Avoid zero-length first segment when caller includes current position.
  if (waypoints.length > 0 && positionsEqual(waypoints[0], start)) {
    waypoints.shift();
  }
  return waypoints.length > 0 ? waypoints : [destination];
}

function positionsEqual(a: Position, b: Position, epsilon = 1e-6): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

function countDirectionChanges(start: Position, waypoints: Position[]): number {
  const segments = toPathSegments(start, waypoints);
  let changes = 0;
  let prevDir: { x: number; y: number } | null = null;
  for (const segment of segments) {
    const dx = segment.to.x - segment.from.x;
    const dy = segment.to.y - segment.from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1e-6) continue;
    const dir = { x: dx / length, y: dy / length };
    if (prevDir) {
      const dot = prevDir.x * dir.x + prevDir.y * dir.y;
      if (dot < 1 - 1e-6) {
        changes += 1;
      }
    }
    prevDir = dir;
  }
  return changes;
}

function toPathSegments(start: Position, waypoints: Position[]): Array<{ from: Position; to: Position }> {
  const segments: Array<{ from: Position; to: Position }> = [];
  let current = start;
  for (const waypoint of waypoints) {
    segments.push({ from: current, to: waypoint });
    current = waypoint;
  }
  return segments;
}

function segmentIntersectsEngagementZone(
  from: Position,
  to: Position,
  center: Position,
  engagementRadius: number
): boolean {
  const distance = distancePointToSegment(center, from, to);
  return distance <= engagementRadius + 1e-6;
}

function distancePointToSegment(point: Position, a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function buildSpatialModel(character: Character, position: Position) {
  return {
    id: character.id,
    position,
    baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? character.attributes.siz ?? 3),
    siz: character.finalAttributes.siz ?? character.attributes.siz ?? 3,
    isPanicked: character.state.isPanicked,
  };
}

function isInBaseContact(
  first: { id: string; position: Position; baseDiameter: number; siz?: number; isPanicked?: boolean },
  second: { id: string; position: Position; baseDiameter: number; siz?: number; isPanicked?: boolean }
): boolean {
  return SpatialRules.distanceEdgeToEdge(first, second) <= 1e-6;
}

function isCharacterFreeAgainstOpponents(
  deps: MoveActionDeps,
  character: Character,
  opponents: Character[]
): boolean {
  if (opponents.length === 0) {
    return !character.state.isEngaged;
  }

  const characterPos = deps.getCharacterPosition(character);
  if (!characterPos) {
    return false;
  }
  const characterModel = buildSpatialModel(character, characterPos);
  for (const opponent of opponents) {
    const opponentPos = deps.getCharacterPosition(opponent);
    if (!opponentPos) continue;
    const opponentModel = buildSpatialModel(opponent, opponentPos);
    if (SpatialRules.isEngaged(characterModel, opponentModel)) {
      return false;
    }
  }
  return true;
}
