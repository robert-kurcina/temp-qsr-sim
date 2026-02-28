import { Battlefield } from '../battlefield/Battlefield';
import { Character } from '../core/Character';
import { SpatialModel, SpatialRules } from '../battlefield/spatial/spatial-rules';
import { LOSOperations } from '../battlefield/los/LOSOperations';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { TerrainType } from '../battlefield/terrain/Terrain';
import { resolveTest, ResolveTestResult, TestParticipant } from '../subroutines/dice-roller';

export interface HideCheckResult {
  canHide: boolean;
  apCost: number;
  hasOpposingLOS: boolean;
  hasCoverAgainstLOS: boolean;
  reason?: string;
}

export interface HideOptions {
  includeHiddenOpponents?: boolean;
}

export interface DetectOptions {
  detectOrMu?: number;
  visibilityOrMu?: number; // QSR: Detection limited by Visibility OR
  allowReposition?: boolean;
  revealReposition?: (options: RevealRepositionOptions) => PositionResult | null;
  attackerLeaning?: boolean;
  targetLeaning?: boolean;
}

export interface RevealExposureOptions {
  allowReposition?: boolean;
  revealReposition?: (options: RevealRepositionOptions) => PositionResult | null;
  visibilityOrMu?: number;
}

export interface PositionResult {
  position: { x: number; y: number };
  reason?: string;
}

export interface RevealRepositionOptions {
  battlefield: Battlefield;
  character: Character;
  revealer?: Character;
  opponents: Character[];
}

export interface DetectResult {
  success: boolean;
  result?: ResolveTestResult;
  revealed?: boolean;
  repositioned?: boolean;
  position?: { x: number; y: number };
  reason?: string;
}

export function evaluateHide(
  battlefield: Battlefield,
  character: Character,
  opponents: Character[],
  options: HideOptions = {}
): HideCheckResult {
  if (!battlefield) {
    return { canHide: false, apCost: 0, hasOpposingLOS: false, hasCoverAgainstLOS: false, reason: 'No battlefield.' };
  }
  const characterSpatial = buildSpatialModel(battlefield, character);
  if (!characterSpatial) {
    return { canHide: false, apCost: 0, hasOpposingLOS: false, hasCoverAgainstLOS: false, reason: 'No position.' };
  }
  const includeHiddenOpponents = options.includeHiddenOpponents ?? false;
  const visibleOpponents = opponents.filter(opponent => includeHiddenOpponents || !opponent.state.isHidden);

  let hasOpposingLOS = false;
  let hasCoverAgainstLOS = true;

  for (const opponent of visibleOpponents) {
    const opponentSpatial = buildSpatialModel(battlefield, opponent);
    if (!opponentSpatial) continue;
    const cover = SpatialRules.getCoverResult(battlefield, opponentSpatial, characterSpatial);
    if (cover.hasLOS) {
      hasOpposingLOS = true;
      const inCover = cover.hasDirectCover || cover.hasInterveningCover;
      if (!inCover) {
        hasCoverAgainstLOS = false;
      }
    }
  }

  if (!hasOpposingLOS) {
    return { canHide: true, apCost: 0, hasOpposingLOS, hasCoverAgainstLOS };
  }

  if (hasCoverAgainstLOS) {
    return { canHide: true, apCost: 1, hasOpposingLOS, hasCoverAgainstLOS };
  }

  return {
    canHide: false,
    apCost: 0,
    hasOpposingLOS,
    hasCoverAgainstLOS,
    reason: 'Exposed to opposing LOS.',
  };
}

export function attemptHide(
  battlefield: Battlefield,
  character: Character,
  opponents: Character[],
  spendAp: (amount: number) => boolean,
  options: HideOptions = {}
): HideCheckResult {
  const check = evaluateHide(battlefield, character, opponents, options);
  if (!check.canHide) return check;
  if (check.apCost > 0 && !spendAp(check.apCost)) {
    return { ...check, canHide: false, reason: 'Not enough AP.' };
  }
  character.state.isHidden = true;
  return check;
}

export function attemptDetect(
  battlefield: Battlefield,
  attacker: Character,
  target: Character,
  opponents: Character[],
  options: DetectOptions = {}
): DetectResult {
  if (!battlefield) return { success: false, reason: 'No battlefield.' };
  if (!target.state.isHidden) return { success: false, reason: 'Target is not Hidden.' };
  const attackerSpatial = buildSpatialModel(battlefield, attacker);
  const targetSpatial = buildSpatialModel(battlefield, target);
  if (!attackerSpatial || !targetSpatial) return { success: false, reason: 'Missing position.' };

  const cover = SpatialRules.getCoverResult(battlefield, attackerSpatial, targetSpatial);
  if (!cover.hasLOS) return { success: false, reason: 'No LOS to target.' };

  // QSR: Detection range limited by Visibility OR
  const detectRange = options.detectOrMu ?? options.visibilityOrMu ?? 16;
  const distance = LOSOperations.distance(attackerSpatial.position, targetSpatial.position);
  if (distance > detectRange) {
    return { success: false, reason: `Out of detect range (${distance.toFixed(1)} MU > ${detectRange} MU).` };
  }

  const attackerParticipant: TestParticipant = {
    character: attacker,
    attribute: 'ref',
    penaltyDice: options.attackerLeaning ? { base: 1 } : undefined,
  };
  const defenderParticipant: TestParticipant = {
    character: target,
    attribute: 'ref',
    penaltyDice: options.targetLeaning ? { base: 1 } : undefined,
  };
  const result = resolveTest(attackerParticipant, defenderParticipant);
  if (!result.pass) {
    return { success: false, result, reason: 'Detect test failed.' };
  }

  const revealResult = revealHiddenTarget(battlefield, target, attacker, opponents, options);
  return {
    success: true,
    result,
    revealed: true,
    repositioned: revealResult.repositioned,
    position: revealResult.position ?? undefined,
  };
}

export function resolveHiddenExposure(
  battlefield: Battlefield,
  character: Character,
  opponents: Character[],
  options: RevealExposureOptions = {}
): { revealed: boolean; repositioned?: boolean; position?: { x: number; y: number } } {
  if (!character.state.isHidden) return { revealed: false };
  const characterSpatial = buildSpatialModel(battlefield, character);
  if (!characterSpatial) return { revealed: false };

  for (const opponent of opponents) {
    if (opponent.state.isHidden) continue;
    const opponentSpatial = buildSpatialModel(battlefield, opponent);
    if (!opponentSpatial) continue;
    const cover = SpatialRules.getCoverResult(battlefield, opponentSpatial, characterSpatial);
    if (!cover.hasLOS) continue;
    const inCover = cover.hasDirectCover || cover.hasInterveningCover;
    if (!inCover) {
      const revealResult = revealHiddenTarget(battlefield, character, opponent, opponents, options);
      return {
        revealed: true,
        repositioned: revealResult.repositioned,
        position: revealResult.position ?? undefined,
      };
    }
  }

  return { revealed: false };
}

export function resolveWaitReveal(
  battlefield: Battlefield,
  waitingCharacter: Character,
  opponents: Character[],
  options: RevealExposureOptions = {}
): { revealed: Character[] } {
  const revealed: Character[] = [];
  if (!waitingCharacter.state.isWaiting) return { revealed };
  const waitingSpatial = buildSpatialModel(battlefield, waitingCharacter);
  if (!waitingSpatial) return { revealed };
  const baseVisibility = options.visibilityOrMu ?? 16;
  const effectiveVisibility = baseVisibility * 2;

  for (const opponent of opponents) {
    if (!opponent.state.isHidden) continue;
    const opponentSpatial = buildSpatialModel(battlefield, opponent);
    if (!opponentSpatial) continue;
    const edgeDistance = SpatialRules.distanceEdgeToEdge(waitingSpatial, opponentSpatial);
    if (edgeDistance > effectiveVisibility) continue;
    const cover = SpatialRules.getCoverResult(battlefield, waitingSpatial, opponentSpatial);
    if (!cover.hasLOS) continue;
    const inCover = cover.hasDirectCover || cover.hasInterveningCover;
    if (!inCover) {
      revealHiddenTarget(battlefield, opponent, waitingCharacter, opponents, options);
      revealed.push(opponent);
    }
  }

  return { revealed };
}

function revealHiddenTarget(
  battlefield: Battlefield,
  target: Character,
  revealer: Character | undefined,
  opponents: Character[],
  options: RevealExposureOptions | DetectOptions
): { repositioned: boolean; position?: { x: number; y: number } } {
  target.state.isHidden = false;
  if (options.allowReposition === false) {
    return { repositioned: false };
  }
  const reposition = options.revealReposition ?? findRepositionForReveal;
  const result = reposition({ battlefield, character: target, revealer, opponents });
  if (!result) return { repositioned: false };
  const success = battlefield.moveCharacter(target, result.position);
  return { repositioned: success, position: success ? result.position : undefined };
}

export function findRepositionForReveal(options: RevealRepositionOptions): PositionResult | null {
  /**
   * Evaluate concealment utility
   *
   * **Rules Reference:** [[rules-actions|Rules: Actions]] - Hide action
   * **Rules Reference:** [[rules-visibility|Rules: Visibility]] - Hidden status and detection
   *
   * Note: This is a basic implementation. For production AI, consider implementing
   * min-max AI scoring with threat maps, cover value, and objective pressure.
   */
  // TODO: Review/replace with min-max AI scoring (threat maps, cover value, objective pressure).
  const { battlefield, character, revealer, opponents } = options;
  const position = battlefield.getCharacterPosition(character);
  if (!position) return null;
  const mov = character.finalAttributes?.mov ?? character.attributes?.mov ?? 0;
  if (mov <= 0) return null;

  const radius = Math.max(1, Math.floor(mov));
  const candidates: { x: number; y: number }[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      candidates.push({ x: position.x + dx, y: position.y + dy });
    }
  }

  const revealerSpatial = revealer ? buildSpatialModel(battlefield, revealer) : null;
  let best: { point: { x: number; y: number }; score: number } | null = null;

  for (const point of candidates) {
    if (!battlefield.grid.isValid(point)) continue;
    const occupied = battlefield.getCharacterAt(point);
    if (occupied && occupied.id !== character.id) continue;
    if (isBlockedByTerrain(battlefield, point)) continue;
    const targetSpatial: SpatialModel = {
      id: character.id,
      position: point,
      baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz),
      siz: character.finalAttributes.siz,
    };

    let visible = false;
    for (const opponent of opponents) {
      if (opponent.state.isHidden) continue;
      const opponentSpatial = buildSpatialModel(battlefield, opponent);
      if (!opponentSpatial) continue;
      const cover = SpatialRules.getCoverResult(battlefield, opponentSpatial, targetSpatial);
      if (cover.hasLOS) {
        visible = true;
        break;
      }
    }
    if (visible) continue;

    let score = 0;
    if (revealerSpatial) {
      score += LOSOperations.distance(revealerSpatial.position, point);
    }
    if (!best || score > best.score) {
      best = { point, score };
    }
  }

  return best ? { position: best.point } : null;
}

function buildSpatialModel(battlefield: Battlefield, character: Character): SpatialModel | null {
  const position = battlefield.getCharacterPosition(character);
  if (!position) return null;
  const siz = character.finalAttributes?.siz ?? character.attributes?.siz ?? 3;
  return {
    id: character.id,
    position,
    baseDiameter: getBaseDiameterFromSiz(siz),
    siz,
  };
}

function isBlockedByTerrain(battlefield: Battlefield, point: { x: number; y: number }): boolean {
  for (const feature of battlefield.terrain) {
    if (feature.type !== TerrainType.Impassable && feature.type !== TerrainType.Obstacle) continue;
    if (pointInPolygon(point, feature.vertices)) {
      return true;
    }
  }
  return false;
}

function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}
