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
  const requestedDestination = pathWaypoints[pathWaypoints.length - 1];

  if (options.swapTarget) {
    return executeSwapDuringMovement(deps, mover, start, requestedDestination, options);
  }

  // Sprint X: Bonus movement when moving in a straight line
  const sprintBonus = getSprintMovementBonus(mover, options.isMovingStraight ?? false, mover.state.isAttentive, true);

  // Leap X: Agility bonus at start or end of movement
  const leapResult = checkLeapUsage(mover, options.isAtStartOrEndOfMovement ?? false);
  const agilityBonus = leapResult.agilityBonus;

  // Calculate effective movement allowance per QSR:
  // normal Move allowance is MOV + 2 MU, then apply trait-based bonuses.
  const baseMov = mover.finalAttributes.mov ?? 2;
  const effectiveMov = baseMov + 2 + sprintBonus + agilityBonus;

  const plannedPath = planPathWithinAllowance(start, pathWaypoints, effectiveMov, deps.findPathCost);
  if (plannedPath.waypoints.length === 0) {
    if (plannedPath.blockedByPath) {
      return {
        moved: false,
        reason: 'Path blocked by terrain or obstacles',
        directionChangesApplied: 0,
        sprintBonusApplied: sprintBonus,
        leapBonusApplied: agilityBonus,
        eliminated: false,
        exitedBattlefield: false,
        opportunityAttack: false,
        swapped: false,
        swapTargetId: undefined,
        swapApCost: 0,
        delayAppliedToId: undefined,
      };
    }
    const required = plannedPath.requiredForNextSegment ?? effectiveMov;
    return {
      moved: false,
      reason: `Destination out of range: ${required.toFixed(1)} MU exceeds max movement (${effectiveMov} MU)`,
      directionChangesApplied: 0,
      sprintBonusApplied: sprintBonus,
      leapBonusApplied: agilityBonus,
      eliminated: false,
      exitedBattlefield: false,
      opportunityAttack: false,
      swapped: false,
      swapTargetId: undefined,
      swapApCost: 0,
      delayAppliedToId: undefined,
    };
  }

  const engagementLimitedWaypoints = limitPathByEngagement(
    deps,
    mover,
    start,
    plannedPath.waypoints,
    options.opponents ?? []
  );
  if (engagementLimitedWaypoints.length === 0) {
    return {
      moved: false,
      reason: 'Movement must stop when engaged with an Attentive opposing model',
      directionChangesApplied: 0,
      sprintBonusApplied: sprintBonus,
      leapBonusApplied: agilityBonus,
      eliminated: false,
      exitedBattlefield: false,
      opportunityAttack: false,
      swapped: false,
      swapTargetId: undefined,
      swapApCost: 0,
      delayAppliedToId: undefined,
    };
  }
  let selectedWaypoints = engagementLimitedWaypoints;
  let finalDestination = selectedWaypoints[selectedWaypoints.length - 1];

  // QSR MV.8/MV.9: direction changes are capped by MOV, plus one extra facing change allowance.
  let directionChanges = countDirectionChanges(start, selectedWaypoints);
  const maxDirectionChanges = baseMov + 1;
  if (directionChanges > maxDirectionChanges) {
    return {
      moved: false,
      reason: `Too many direction changes: ${directionChanges} exceeds maximum allowed (${maxDirectionChanges})`,
      directionChangesApplied: directionChanges,
      sprintBonusApplied: sprintBonus,
      leapBonusApplied: agilityBonus,
      eliminated: false,
      exitedBattlefield: false,
      opportunityAttack: false,
      swapped: false,
      swapTargetId: undefined,
      swapApCost: 0,
      delayAppliedToId: undefined,
    };
  }

  // Surefooted X: Upgrade terrain effects for landing position.
  let currentTerrain = deps.getTerrainAt(finalDestination);
  if (currentTerrain === 'Impassable') {
    return {
      moved: false,
      reason: 'Destination is impassable terrain',
      directionChangesApplied: directionChanges,
      sprintBonusApplied: sprintBonus,
      leapBonusApplied: agilityBonus,
      eliminated: false,
      exitedBattlefield: false,
      opportunityAttack: false,
      swapped: false,
      swapTargetId: undefined,
      swapApCost: 0,
      delayAppliedToId: undefined,
    };
  }
  let upgradedTerrain = getSurefootedTerrainBonus(mover, currentTerrain);

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
  let movementCost = computePathMovementCost(start, selectedWaypoints, deps.findPathCost);
  if (movementCost === null) {
    return { moved: false, reason: 'Path blocked by terrain or obstacles', directionChangesApplied: directionChanges, sprintBonusApplied: sprintBonus, leapBonusApplied: agilityBonus, eliminated: false, exitedBattlefield: false, opportunityAttack: false, swapped: false, swapTargetId: undefined, swapApCost: 0, delayAppliedToId: undefined };
  }

  // Allow move if within effective movement allowance
  // Add small epsilon for floating point comparison
  if (movementCost > effectiveMov + 1e-6) {
    // Safety fallback: allowance planning should already constrain this.
    return {
      moved: false,
      reason: `Destination out of range: ${movementCost.toFixed(1)} MU exceeds max movement (${effectiveMov} MU)`,
      directionChangesApplied: directionChanges,
      sprintBonusApplied: sprintBonus,
      leapBonusApplied: agilityBonus,
      eliminated: false,
      exitedBattlefield: false,
      opportunityAttack: false,
      swapped: false,
      swapTargetId: undefined,
      swapApCost: 0,
      delayAppliedToId: undefined,
    };
  }

  let moved = deps.moveCharacter(mover, finalDestination);
  if (!moved) {
    const fallbackPaths = buildPlacementFallbackPaths(start, selectedWaypoints);
    for (const candidateWaypoints of fallbackPaths) {
      if (candidateWaypoints.length === 0) continue;
      const candidateDestination = candidateWaypoints[candidateWaypoints.length - 1];
      if (positionsEqual(candidateDestination, finalDestination)) continue;

      const candidateDirectionChanges = countDirectionChanges(start, candidateWaypoints);
      if (candidateDirectionChanges > maxDirectionChanges) continue;

      const candidateTerrain = deps.getTerrainAt(candidateDestination);
      if (candidateTerrain === 'Impassable') continue;

      if (deps.isWithinBounds && !deps.isWithinBounds(candidateDestination, moverBase)) {
        continue;
      }
      if (!deps.canOccupy(candidateDestination, moverBase)) {
        continue;
      }

      const candidateCost = computePathMovementCost(start, candidateWaypoints, deps.findPathCost);
      if (candidateCost === null || candidateCost > effectiveMov + 1e-6) {
        continue;
      }

      if (!deps.moveCharacter(mover, candidateDestination)) {
        continue;
      }

      selectedWaypoints = candidateWaypoints;
      finalDestination = candidateDestination;
      directionChanges = candidateDirectionChanges;
      movementCost = candidateCost;
      currentTerrain = candidateTerrain;
      upgradedTerrain = getSurefootedTerrainBonus(mover, currentTerrain);
      moved = true;
      break;
    }
  }
  if (!moved) {
    return {
      moved: false,
      reason: 'No legal destination available along movement path',
      directionChangesApplied: directionChanges,
      sprintBonusApplied: sprintBonus,
      leapBonusApplied: agilityBonus,
      eliminated: false,
      exitedBattlefield: false,
      opportunityAttack: false,
      swapped: false,
      swapTargetId: undefined,
      swapApCost: 0,
      delayAppliedToId: undefined,
    };
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

function computePathMovementCost(
  start: Position,
  waypoints: Position[],
  findPathCost?: (start: Position, end: Position) => number | null
): number | null {
  const pathSegments = toPathSegments(start, waypoints);
  let movementCost = 0;
  for (const segment of pathSegments) {
    const segmentCost = getSegmentCost(segment.from, segment.to, findPathCost);
    if (segmentCost === null) {
      return null;
    }
    movementCost += segmentCost;
  }
  return movementCost;
}

function buildPlacementFallbackPaths(start: Position, waypoints: Position[]): Position[][] {
  const segments = toPathSegments(start, waypoints);
  const candidates: Position[][] = [];
  const seen = new Set<string>();

  for (let segmentIndex = segments.length - 1; segmentIndex >= 0; segmentIndex--) {
    const segment = segments[segmentIndex];
    const prefix = waypoints.slice(0, segmentIndex);
    const dx = segment.to.x - segment.from.x;
    const dy = segment.to.y - segment.from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1e-6) continue;

    const steps = Math.max(1, Math.ceil(length * 4));
    for (let step = steps; step >= 1; step--) {
      const t = step / steps;
      const probe = {
        x: segment.from.x + dx * t,
        y: segment.from.y + dy * t,
      };
      for (const snapped of snapToGridCandidates(probe)) {
        if (positionsEqual(snapped, segment.from)) continue;
        const candidateWaypoints = [...prefix, snapped];
        const key = candidateWaypoints.map(point => `${point.x},${point.y}`).join('->');
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push(candidateWaypoints);
      }
    }
  }

  return candidates;
}

function snapToGridCandidates(point: Position): Position[] {
  const tenth = (value: number) => Math.round(value * 10) / 10;
  const rawCandidates: Position[] = [
    { x: point.x, y: point.y },
    { x: tenth(point.x), y: tenth(point.y) },
    { x: Math.round(point.x), y: Math.round(point.y) },
    { x: Math.floor(point.x), y: Math.floor(point.y) },
    { x: Math.ceil(point.x), y: Math.ceil(point.y) },
    { x: Math.floor(point.x), y: Math.ceil(point.y) },
    { x: Math.ceil(point.x), y: Math.floor(point.y) },
    { x: point.x + 0.25, y: point.y },
    { x: point.x - 0.25, y: point.y },
    { x: point.x, y: point.y + 0.25 },
    { x: point.x, y: point.y - 0.25 },
    { x: point.x + 0.25, y: point.y + 0.25 },
    { x: point.x + 0.25, y: point.y - 0.25 },
    { x: point.x - 0.25, y: point.y + 0.25 },
    { x: point.x - 0.25, y: point.y - 0.25 },
  ];

  const unique: Position[] = [];
  const seen = new Set<string>();
  for (const candidate of rawCandidates) {
    const key = `${candidate.x},${candidate.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

interface PlannedPathResult {
  waypoints: Position[];
  blockedByPath: boolean;
  requiredForNextSegment?: number;
}

function planPathWithinAllowance(
  start: Position,
  waypoints: Position[],
  movementAllowance: number,
  findPathCost?: (start: Position, end: Position) => number | null
): PlannedPathResult {
  const plannedSegments = toPathSegments(start, waypoints);
  const traversedWaypoints: Position[] = [];
  let usedCost = 0;

  for (const segment of plannedSegments) {
    const segmentCost = getSegmentCost(segment.from, segment.to, findPathCost);
    if (segmentCost === null) {
      return {
        waypoints: traversedWaypoints,
        blockedByPath: true,
      };
    }

    if (usedCost + segmentCost <= movementAllowance + 1e-6) {
      usedCost += segmentCost;
      traversedWaypoints.push(segment.to);
      continue;
    }

    const remaining = Math.max(0, movementAllowance - usedCost);
    if (remaining <= 1e-6) {
      return {
        waypoints: traversedWaypoints,
        blockedByPath: false,
        requiredForNextSegment: usedCost + segmentCost,
      };
    }

    const partial = interpolatePointByCost(
      segment.from,
      segment.to,
      remaining,
      segmentCost,
      findPathCost
    );
    if (!partial || positionsEqual(partial, segment.from)) {
      return {
        waypoints: traversedWaypoints,
        blockedByPath: false,
        requiredForNextSegment: usedCost + segmentCost,
      };
    }

    traversedWaypoints.push(partial);
    return {
      waypoints: traversedWaypoints,
      blockedByPath: false,
      requiredForNextSegment: usedCost + segmentCost,
    };
  }

  return {
    waypoints: traversedWaypoints,
    blockedByPath: false,
  };
}

function getSegmentCost(
  from: Position,
  to: Position,
  findPathCost?: (start: Position, end: Position) => number | null
): number | null {
  if (findPathCost) {
    return findPathCost(from, to);
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.hypot(dx, dy);
}

function interpolatePointByCost(
  from: Position,
  to: Position,
  remainingCost: number,
  totalCost: number,
  findPathCost?: (start: Position, end: Position) => number | null
): Position | null {
  if (!Number.isFinite(totalCost) || totalCost <= 1e-6) {
    return null;
  }

  if (!findPathCost) {
    const ratio = Math.max(0, Math.min(1, remainingCost / totalCost));
    return {
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
    };
  }

  let lo = 0;
  let hi = 1;
  let bestT = 0;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const probe = {
      x: from.x + (to.x - from.x) * mid,
      y: from.y + (to.y - from.y) * mid,
    };
    const cost = findPathCost(from, probe);
    if (cost === null) {
      hi = mid;
      continue;
    }
    if (cost <= remainingCost + 1e-6) {
      bestT = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (bestT <= 1e-6) {
    return null;
  }
  return {
    x: from.x + (to.x - from.x) * bestT,
    y: from.y + (to.y - from.y) * bestT,
  };
}

function limitPathByEngagement(
  deps: MoveActionDeps,
  mover: Character,
  start: Position,
  waypoints: Position[],
  opponents: Character[]
): Position[] {
  if (opponents.length === 0) {
    return waypoints;
  }

  const attentiveOpponents = opponents.filter(opponent => opponent.state.isAttentive);
  if (attentiveOpponents.length === 0) {
    return waypoints;
  }

  const moverBase = getBaseDiameterFromSiz(mover.finalAttributes.siz ?? mover.attributes.siz ?? 3);
  const segments = toPathSegments(start, waypoints);
  const truncatedWaypoints: Position[] = [];

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex];
    let stopT: number | null = null;

    for (const opponent of attentiveOpponents) {
      const opponentPos = deps.getCharacterPosition(opponent);
      if (!opponentPos) continue;
      const opponentBase = getBaseDiameterFromSiz(opponent.finalAttributes.siz ?? opponent.attributes.siz ?? 3);
      const engagementRadius = (moverBase + opponentBase) / 2;
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
      if (engagesAtStart) {
        continue;
      }

      const intersectionT = firstCircleIntersectionT(segment.from, segment.to, opponentPos, engagementRadius);
      if (intersectionT !== null) {
        stopT = stopT === null ? intersectionT : Math.min(stopT, intersectionT);
      } else if (engagesAtEnd && segmentIndex < segments.length - 1) {
        stopT = stopT === null ? 1 : Math.min(stopT, 1);
      } else if (
        segmentIntersectsEngagementZone(segment.from, segment.to, opponentPos, engagementRadius)
        && segmentIndex < segments.length - 1
      ) {
        stopT = stopT === null ? 1 : Math.min(stopT, 1);
      }
    }

    if (stopT !== null) {
      const clampedT = Math.max(0, Math.min(1, stopT));
      const stopPoint = {
        x: segment.from.x + (segment.to.x - segment.from.x) * clampedT,
        y: segment.from.y + (segment.to.y - segment.from.y) * clampedT,
      };
      if (!positionsEqual(stopPoint, segment.from)) {
        truncatedWaypoints.push(stopPoint);
      }
      return truncatedWaypoints;
    }

    truncatedWaypoints.push(segment.to);
  }

  return truncatedWaypoints;
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

function firstCircleIntersectionT(
  from: Position,
  to: Position,
  center: Position,
  radius: number
): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const a = dx * dx + dy * dy;
  if (a <= 1e-9) {
    return null;
  }

  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  const candidates = [t1, t2]
    .filter(t => Number.isFinite(t) && t >= 0 && t <= 1)
    .sort((left, right) => left - right);
  return candidates.length > 0 ? candidates[0] : null;
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
