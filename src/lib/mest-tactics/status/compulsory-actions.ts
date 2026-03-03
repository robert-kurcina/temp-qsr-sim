import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { SpatialRules, type SpatialModel } from '../battlefield/spatial/spatial-rules';
import { getThreatRange } from '../traits/combat-traits';

// --- Morale State Utility Functions ---

/** Checks if the character has at least 1 Fear token. */
export const isNervous = (character: Character): boolean => character.state.fearTokens >= 1;

/** Checks if the character has at least 2 Fear tokens. */
export const isDisordered = (character: Character): boolean => character.state.fearTokens >= 2;

/** Checks if the character has 3 or more Fear tokens. */
export const isPanicked = (character: Character): boolean => character.state.fearTokens >= 3;

/** Checks if the character has 4 or more Fear tokens and should be eliminated. */
export const isEliminatedByFear = (character: Character): boolean => character.state.fearTokens >= 4;


// --- Compulsory Action Definition ---

/**
 * Defines a compulsory action a character must perform at the start of their activation.
 */
export interface CompulsoryAction {
  actionType: 'Disengage' | 'Move' | 'Rally' | 'Eliminated';
  apCost: number;
  description: string;
  safetyMode?: 'cover' | 'out_of_los' | 'exit_edge';
  safetyTarget?: Position;
  safetyEdge?: BattlefieldEdge;
}

export type BattlefieldEdge = 'north' | 'south' | 'west' | 'east';

export interface CompulsoryActionOptions {
  battlefield?: Battlefield;
  getCharacterPosition?: (character: Character) => Position | undefined;
  opponents?: Character[];
  twoApMovementRange?: (character: Character) => number;
  friendlyEntryEdges?: BattlefieldEdge[];
}

interface SafetyResolution {
  mode: 'cover' | 'out_of_los';
  target: Position;
}

interface PanickedSafetyResolution {
  target: Position;
  edge: BattlefieldEdge;
  usedAlternateEdge: boolean;
}

const EDGE_ORDER: BattlefieldEdge[] = ['north', 'south', 'west', 'east'];
const POSITION_STEP_MU = 0.5;
const ANGLE_SAMPLES = 24;
const DISTANCE_EPSILON = 1e-6;

function getPositionForCharacter(
  character: Character,
  options: CompulsoryActionOptions
): Position | undefined {
  return options.getCharacterPosition?.(character) ?? options.battlefield?.getCharacterPosition(character);
}

function getActiveOpponents(
  actor: Character,
  options: CompulsoryActionOptions
): Character[] {
  return (options.opponents ?? []).filter(opponent =>
    opponent.id !== actor.id
    && !opponent.state.isKOd
    && !opponent.state.isEliminated
    && (opponent.state.isAttentive || opponent.state.isOrdered)
  );
}

function getSiz(character: Character): number {
  return character.finalAttributes?.siz ?? character.attributes?.siz ?? 3;
}

function toSpatialModel(character: Character, position: Position): SpatialModel {
  const siz = getSiz(character);
  return {
    id: character.id,
    position,
    siz,
    baseDiameter: getBaseDiameterFromSiz(siz),
    isPanicked: character.state.isPanicked,
  };
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildMovementSamples(
  origin: Position,
  maxDistance: number,
  battlefield: Battlefield,
  baseDiameter: number
): Position[] {
  const samples: Position[] = [];
  for (let ring = POSITION_STEP_MU; ring <= maxDistance + DISTANCE_EPSILON; ring += POSITION_STEP_MU) {
    for (let i = 0; i < ANGLE_SAMPLES; i++) {
      const angle = (i / ANGLE_SAMPLES) * Math.PI * 2;
      const candidate: Position = {
        x: origin.x + Math.cos(angle) * ring,
        y: origin.y + Math.sin(angle) * ring,
      };
      if (!battlefield.isWithinBounds(candidate, baseDiameter)) continue;
      samples.push(candidate);
    }
  }
  return samples.sort((a, b) => distance(origin, a) - distance(origin, b));
}

function isThreatenedByOpposition(
  candidate: Position,
  opponents: Character[],
  options: CompulsoryActionOptions
): boolean {
  for (const opponent of opponents) {
    const opponentPosition = getPositionForCharacter(opponent, options);
    if (!opponentPosition) continue;
    const twoApMovement = options.twoApMovementRange?.(opponent) ?? (getThreatRange(opponent) * 2);
    if (distance(opponentPosition, candidate) <= twoApMovement + DISTANCE_EPSILON) {
      return true;
    }
  }
  return false;
}

function hasCoverAgainstOpposition(
  actor: Character,
  candidate: Position,
  opponents: Character[],
  battlefield: Battlefield,
  options: CompulsoryActionOptions
): boolean {
  const actorModel = toSpatialModel(actor, candidate);
  for (const opponent of opponents) {
    const opponentPosition = getPositionForCharacter(opponent, options);
    if (!opponentPosition) continue;
    const opponentModel = toSpatialModel(opponent, opponentPosition);
    const cover = SpatialRules.getCoverResult(battlefield, opponentModel, actorModel);
    if (cover.hasLOS && (cover.hasDirectCover || cover.hasInterveningCover)) {
      return true;
    }
  }
  return false;
}

function isOutOfLosAgainstOpposition(
  actor: Character,
  candidate: Position,
  opponents: Character[],
  battlefield: Battlefield,
  options: CompulsoryActionOptions
): boolean {
  if (opponents.length === 0) return true;
  const actorModel = toSpatialModel(actor, candidate);
  for (const opponent of opponents) {
    const opponentPosition = getPositionForCharacter(opponent, options);
    if (!opponentPosition) continue;
    const opponentModel = toSpatialModel(opponent, opponentPosition);
    if (SpatialRules.hasLineOfSight(battlefield, opponentModel, actorModel)) {
      return false;
    }
  }
  return true;
}

function resolveDisorderedSafety(
  actor: Character,
  apCost: number,
  options: CompulsoryActionOptions
): SafetyResolution | null {
  if (!options.battlefield) return null;
  const origin = getPositionForCharacter(actor, options);
  if (!origin) return null;

  const opponents = getActiveOpponents(actor, options);
  const oneApMove = Math.max(0, getThreatRange(actor));
  const maxDistance = oneApMove * Math.max(1, apCost);
  if (maxDistance <= 0) return null;

  const actorDiameter = getBaseDiameterFromSiz(getSiz(actor));
  const samples = buildMovementSamples(origin, maxDistance, options.battlefield, actorDiameter);

  let nearestCover: Position | null = null;
  let nearestOutOfLos: Position | null = null;

  for (const sample of samples) {
    if (isThreatenedByOpposition(sample, opponents, options)) {
      continue;
    }
    if (!nearestCover && hasCoverAgainstOpposition(actor, sample, opponents, options.battlefield, options)) {
      nearestCover = sample;
    }
    if (!nearestOutOfLos && isOutOfLosAgainstOpposition(actor, sample, opponents, options.battlefield, options)) {
      nearestOutOfLos = sample;
    }
    if (nearestCover && nearestOutOfLos) {
      break;
    }
  }

  if (!nearestCover && !nearestOutOfLos) return null;
  if (!nearestCover && nearestOutOfLos) {
    return { mode: 'out_of_los', target: nearestOutOfLos };
  }
  if (nearestCover && !nearestOutOfLos) {
    return { mode: 'cover', target: nearestCover };
  }
  const coverDistance = distance(origin, nearestCover!);
  const outOfLosDistance = distance(origin, nearestOutOfLos!);
  return coverDistance <= outOfLosDistance
    ? { mode: 'cover', target: nearestCover! }
    : { mode: 'out_of_los', target: nearestOutOfLos! };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function edgeDistance(edge: BattlefieldEdge, from: Position, battlefield: Battlefield): number {
  switch (edge) {
    case 'north': return from.y;
    case 'south': return battlefield.height - from.y;
    case 'west': return from.x;
    case 'east': return battlefield.width - from.x;
  }
}

function edgeTarget(
  edge: BattlefieldEdge,
  from: Position,
  battlefield: Battlefield,
  baseDiameter: number
): Position {
  const radius = baseDiameter / 2;
  switch (edge) {
    case 'north':
      return { x: clamp(from.x, radius, battlefield.width - radius), y: radius };
    case 'south':
      return { x: clamp(from.x, radius, battlefield.width - radius), y: battlefield.height - radius };
    case 'west':
      return { x: radius, y: clamp(from.y, radius, battlefield.height - radius) };
    case 'east':
      return { x: battlefield.width - radius, y: clamp(from.y, radius, battlefield.height - radius) };
  }
}

function movesTowardOpposition(
  from: Position,
  to: Position,
  opponents: Character[],
  options: CompulsoryActionOptions
): boolean {
  for (const opponent of opponents) {
    const opponentPosition = getPositionForCharacter(opponent, options);
    if (!opponentPosition) continue;
    if (distance(to, opponentPosition) + DISTANCE_EPSILON < distance(from, opponentPosition)) {
      return true;
    }
  }
  return false;
}

function resolvePanickedSafety(
  actor: Character,
  options: CompulsoryActionOptions
): PanickedSafetyResolution | null {
  if (!options.battlefield) return null;
  const origin = getPositionForCharacter(actor, options);
  if (!origin) return null;

  const opponents = getActiveOpponents(actor, options);
  const actorDiameter = getBaseDiameterFromSiz(getSiz(actor));

  const friendlyEdgesRaw = options.friendlyEntryEdges?.length
    ? options.friendlyEntryEdges
    : EDGE_ORDER;
  const friendlyEdges = EDGE_ORDER.filter(edge => friendlyEdgesRaw.includes(edge));
  const nearestFriendly = [...friendlyEdges].sort(
    (a, b) => edgeDistance(a, origin, options.battlefield!) - edgeDistance(b, origin, options.battlefield!)
  )[0];
  if (!nearestFriendly) return null;

  const friendlyTarget = edgeTarget(nearestFriendly, origin, options.battlefield, actorDiameter);
  if (!movesTowardOpposition(origin, friendlyTarget, opponents, options)) {
    return { target: friendlyTarget, edge: nearestFriendly, usedAlternateEdge: false };
  }

  const alternatives = EDGE_ORDER
    .filter(edge => edge !== nearestFriendly)
    .map(edge => ({
      edge,
      target: edgeTarget(edge, origin, options.battlefield!, actorDiameter),
      distance: edgeDistance(edge, origin, options.battlefield!),
    }))
    .filter(option => !movesTowardOpposition(origin, option.target, opponents, options))
    .sort((a, b) => a.distance - b.distance);

  if (alternatives.length > 0) {
    return {
      target: alternatives[0].target,
      edge: alternatives[0].edge,
      usedAlternateEdge: true,
    };
  }

  return { target: friendlyTarget, edge: nearestFriendly, usedAlternateEdge: true };
}

// --- Main Compulsory Action Logic ---

/**
 * Determines the list of compulsory actions a character must perform based on their fear level and situation.
 *
 * **Rules Reference:** [[rules-status|Rules: Status]] - Fear states and compulsory actions
 * **AI Integration:** AI should use this for compulsory action target selection via Utility Scorer
 *
 * @param character The character to check.
 * @returns An array of CompulsoryAction objects. Returns an empty array if no action is required.
 */
export function getCompulsoryActions(
  character: Character,
  options: CompulsoryActionOptions = {}
): CompulsoryAction[] {
  // 1. Check for immediate elimination from fear.
  if (isEliminatedByFear(character)) {
    character.state.isEliminated = true;
    return [{
      actionType: 'Eliminated',
      apCost: 0, // No action cost, it's a state change.
      description: 'Character is Eliminated due to accumulating 4 or more Fear tokens.',
    }];
  }

  // 2. If not eliminated, check if they are Disordered. If not, no compulsory actions are needed.
  if (!isDisordered(character)) {
    return [];
  }

  const actions: CompulsoryAction[] = [];
  // 3. Determine the AP cost based on whether the character is Panicked.
  const apToSpend = isPanicked(character) ? 2 : 1;

  // 4. Determine the single compulsory action based on the priority list:
  if (character.state.isEngaged) {
    // Priority 1: If Engaged, must Disengage.
    actions.push({
      actionType: 'Disengage',
      apCost: apToSpend,
      description: `Must spend ${apToSpend} AP to Disengage until Free.`,
    });
  } else if (!character.state.isInCover) {
    // Priority 2: If Free and not in cover, must Move to Safety.
    if (isPanicked(character)) {
      const panickedSafety = resolvePanickedSafety(character, options);
      if (!panickedSafety) {
        actions.push({
          actionType: 'Move',
          apCost: apToSpend,
          description: `Must spend ${apToSpend} AP to Move towards Safety (the nearest Friendly battlefield entry edge).`,
        });
      } else {
        const edgeLabel = panickedSafety.edge[0].toUpperCase() + panickedSafety.edge.slice(1);
        const reason = panickedSafety.usedAlternateEdge
          ? 'nearest friendly entry edge moved toward Attentive/Ordered opposition; use another edge'
          : 'nearest friendly entry edge';
        actions.push({
          actionType: 'Move',
          apCost: apToSpend,
          description: `Must spend ${apToSpend} AP to Move towards Safety (exit via ${edgeLabel} edge; ${reason}).`,
          safetyMode: 'exit_edge',
          safetyTarget: panickedSafety.target,
          safetyEdge: panickedSafety.edge,
        });
      }
    } else {
      const disorderedSafety = resolveDisorderedSafety(character, apToSpend, options);
      if (!disorderedSafety) {
        actions.push({
          actionType: 'Move',
          apCost: apToSpend,
          description: `Must spend ${apToSpend} AP to Move towards Safety (the nearest Cover or location out of enemy LOS).`,
        });
      } else {
        const safetyLabel = disorderedSafety.mode === 'cover'
          ? 'nearest Cover position outside opposing 2 AP movement threat'
          : 'nearest out-of-LOS position outside opposing 2 AP movement threat';
        actions.push({
          actionType: 'Move',
          apCost: apToSpend,
          description: `Must spend ${apToSpend} AP to Move towards Safety (${safetyLabel}).`,
          safetyMode: disorderedSafety.mode,
          safetyTarget: disorderedSafety.target,
        });
      }
    }
  } else {
    // Priority 3: If in Cover and not Engaged, must Rally.
    actions.push({
      actionType: 'Rally',
      apCost: apToSpend,
      description: `Must spend ${apToSpend} AP to perform a Rally action.`,
    });
  }

  return actions;
}
