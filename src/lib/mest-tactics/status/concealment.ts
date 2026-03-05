import { Battlefield } from '../battlefield/Battlefield';
import { Character } from '../core/Character';
import { SpatialModel, SpatialRules } from '../battlefield/spatial/spatial-rules';
import { LOSOperations } from '../battlefield/los/LOSOperations';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { TerrainType } from '../battlefield/terrain/Terrain';
import { resolveTest, ResolveTestResult, TestParticipant } from '../subroutines/dice-roller';
import { pointInPolygon } from '../battlefield/terrain/BattlefieldUtils';
import { getSneakyLevel } from '../traits/combat-traits';

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
    // QSR Line 846: If not in LOS, Hide is zero AP
    return { canHide: true, apCost: 0, hasOpposingLOS, hasCoverAgainstLOS };
  }

  if (hasCoverAgainstLOS) {
    // QSR Line 846: If in LOS but behind Cover, Hide costs 1 AP
    // QSR Line 19989 / Sneaky X: Sneaky X models Hide at no cost
    const sneakyLevel = getSneakyLevel(character);
    const apCost = sneakyLevel > 0 ? 0 : 1;
    return { canHide: true, apCost, hasOpposingLOS, hasCoverAgainstLOS };
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

/**
 * QSR Line 851: Voluntary Hide Removal
 * "The Active model may voluntarily remove Hidden status at the start or end of its Action."
 */
export function voluntarilyRemoveHidden(character: Character, reason: 'start_of_action' | 'end_of_action'): void {
  character.state.isHidden = false;
}

/**
 * QSR Line 851.2-851.3: Forced Hide Removal (Out of Cover)
 * "It must remove Hidden status when it is out of Cover. It will not reposition."
 */
export interface ForcedHideRemovalResult {
  removed: boolean;
  reason?: string;
}

export function forceRemoveHiddenIfExposed(
  battlefield: Battlefield,
  character: Character,
  opponents: Character[]
): ForcedHideRemovalResult {
  if (!character.state.isHidden) {
    return { removed: false, reason: 'Not Hidden' };
  }

  const characterSpatial = buildSpatialModel(battlefield, character);
  if (!characterSpatial) {
    return { removed: false, reason: 'No position' };
  }

  // Check if character is without Cover from any opponent
  for (const opponent of opponents) {
    if (opponent.state.isHidden || opponent.state.isKOd || opponent.state.isEliminated) continue;
    const opponentSpatial = buildSpatialModel(battlefield, opponent);
    if (!opponentSpatial) continue;

    const cover = SpatialRules.getCoverResult(battlefield, opponentSpatial, characterSpatial);
    if (!cover.hasLOS) continue;

    const inCover = cover.hasDirectCover || cover.hasInterveningCover;
    if (!inCover) {
      // QSR 851.2: Must remove Hidden when out of Cover
      // QSR 851.3: No reposition allowed
      character.state.isHidden = false;
      return { removed: true, reason: 'Out of Cover from opponent' };
    }
  }

  return { removed: false, reason: 'Still in Cover' };
}

/**
 * QSR Line 849: Active Model Loses Hidden at Initiative Start
 * "If the Active model is without Cover at the start of its Initiative,
 *  it loses its Hidden status. Allow it to reposition."
 */
export interface InitiativeHiddenCheckOptions {
  allowReposition?: boolean;
  revealReposition?: (options: RevealRepositionOptions) => PositionResult | null;
}

export interface InitiativeHiddenCheckResult {
  mustReveal: boolean;
  canReposition: boolean;
  repositioned?: boolean;
  position?: { x: number; y: number };
  reason?: string;
}

export function checkHiddenAtInitiativeStart(
  battlefield: Battlefield,
  character: Character,
  opponents: Character[],
  options: InitiativeHiddenCheckOptions = {}
): InitiativeHiddenCheckResult {
  if (!character.state.isHidden) {
    return { mustReveal: false, canReposition: false, reason: 'Not Hidden' };
  }

  const characterSpatial = buildSpatialModel(battlefield, character);
  if (!characterSpatial) {
    return { mustReveal: false, canReposition: false, reason: 'No position' };
  }

  // Check if character is without Cover from any opponent
  let isWithoutCover = false;

  for (const opponent of opponents) {
    if (opponent.state.isHidden || opponent.state.isKOd || opponent.state.isEliminated) continue;
    const opponentSpatial = buildSpatialModel(battlefield, opponent);
    if (!opponentSpatial) continue;

    const cover = SpatialRules.getCoverResult(battlefield, opponentSpatial, characterSpatial);
    if (!cover.hasLOS) continue;

    const inCover = cover.hasDirectCover || cover.hasInterveningCover;
    if (!inCover) {
      isWithoutCover = true;
      break;
    }
  }

  if (!isWithoutCover) {
    return { mustReveal: false, canReposition: false, reason: 'Still in Cover' };
  }

  // QSR 849: Active model loses Hidden at Initiative start if without Cover
  // Allow it to reposition
  character.state.isHidden = false;

  if (options.allowReposition !== false && options.revealReposition) {
    const reposition = options.revealReposition({
      battlefield,
      character,
      opponents,
    });
    if (reposition) {
      const success = battlefield.moveCharacter(character, reposition.position);
      if (success) {
        return {
          mustReveal: true,
          canReposition: true,
          repositioned: true,
          position: reposition.position,
          reason: 'Lost Hidden at Initiative start, repositioned to Cover',
        };
      }
    }
  }

  return {
    mustReveal: true,
    canReposition: options.allowReposition !== false,
    reason: 'Lost Hidden at Initiative start (without Cover)',
  };
}

/**
 * QSR Lines 847.1-847.4: Hidden Status Effects
 * "When Hidden; Visibility and Cohesion distance are halved unless not within Opposing LOS,
 *  and all Terrain is degraded except for that crossed using Agility.
 *  Ignore this rule if the entire path of movement is out of LOS from all Revealed Opposing models."
 */
export interface HiddenEffectsOptions {
  visibilityOrMu?: number;
  cohesionBase?: number;
  isEntirePathOutOfLOS?: boolean;
}

export interface HiddenEffectsResult {
  effectiveVisibility: number;
  effectiveCohesion: number;
  terrainDegraded: boolean;
  reason?: string;
}

export function getHiddenEffects(
  character: Character,
  opponents: Character[],
  battlefield: Battlefield,
  options: HiddenEffectsOptions = {}
): HiddenEffectsResult {
  if (!character.state.isHidden) {
    return {
      effectiveVisibility: options.visibilityOrMu ?? 16,
      effectiveCohesion: options.cohesionBase ?? 8,
      terrainDegraded: false,
      reason: 'Not Hidden',
    };
  }

  const visibilityOrMu = options.visibilityOrMu ?? 16;
  const cohesionBase = options.cohesionBase ?? 8;
  const isEntirePathOutOfLOS = options.isEntirePathOutOfLOS ?? false;

  // QSR 847.4: Exception - entire path out of LOS = no effects
  if (isEntirePathOutOfLOS) {
    return {
      effectiveVisibility: visibilityOrMu,
      effectiveCohesion: cohesionBase,
      terrainDegraded: false,
      reason: 'Entire path out of LOS - no Hidden effects',
    };
  }

  // QSR 847.1: Check if within Opposing LOS
  let isInOpposingLOS = false;
  const characterSpatial = buildSpatialModel(battlefield, character);

  if (characterSpatial) {
    for (const opponent of opponents) {
      if (opponent.state.isHidden || opponent.state.isKOd || opponent.state.isEliminated) continue;
      const opponentSpatial = buildSpatialModel(battlefield, opponent);
      if (!opponentSpatial) continue;

      const cover = SpatialRules.getCoverResult(battlefield, opponentSpatial, characterSpatial);
      if (cover.hasLOS) {
        isInOpposingLOS = true;
        break;
      }
    }
  }

  // QSR 847.1: Visibility and Cohesion halved UNLESS not within Opposing LOS
  const effectiveVisibility = isInOpposingLOS ? Math.floor(visibilityOrMu / 2) : visibilityOrMu;
  const effectiveCohesion = isInOpposingLOS ? Math.floor(cohesionBase / 2) : cohesionBase;

  // QSR 847.3: Terrain degraded (except Agility) when Hidden and in Opposing LOS
  const terrainDegraded = isInOpposingLOS;

  return {
    effectiveVisibility,
    effectiveCohesion,
    terrainDegraded,
    reason: isInOpposingLOS ? 'Hidden effects active (in Opposing LOS)' : 'Not in Opposing LOS - reduced effects',
  };
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

  // QSR Line 852.1: Models further than Visibility × 3 do not automatically lose Hidden
  // unless within LOS of Opposing models in Wait status.
  const visibilityOrMu = options.visibilityOrMu ?? 16;
  const longRangeThreshold = visibilityOrMu * 3;

  for (const opponent of opponents) {
    if (opponent.state.isHidden) continue;
    const opponentSpatial = buildSpatialModel(battlefield, opponent);
    if (!opponentSpatial) continue;

    const distance = SpatialRules.distanceEdgeToEdge(characterSpatial, opponentSpatial);

    // QSR 852.1: Beyond Visibility×3, only Wait models can reveal
    if (distance > longRangeThreshold && !opponent.state.isWaiting) {
      continue;
    }

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

/**
 * QSR Line 850: Mutual Exposure Rules
 * "If the Active model and one or more Passive models become without Cover from each other,
 *  allow the Passive models to first reposition. All models must lose their Hidden status,
 *  but the Active model may not reposition."
 */
export interface MutualExposureOptions {
  isActiveModel: boolean;
  allowReposition?: boolean;
  revealReposition?: (options: RevealRepositionOptions) => PositionResult | null;
  visibilityOrMu?: number;
}

export interface MutualExposureResult {
  mustReveal: boolean;
  canReposition: boolean;
  repositioned?: boolean;
  position?: { x: number; y: number };
  reason?: string;
}

export function resolveMutualHiddenExposure(
  battlefield: Battlefield,
  character: Character,
  opponents: Character[],
  options: MutualExposureOptions = { isActiveModel: false }
): MutualExposureResult {
  if (!character.state.isHidden) return { mustReveal: false, canReposition: false };

  const characterSpatial = buildSpatialModel(battlefield, character);
  if (!characterSpatial) return { mustReveal: false, canReposition: false, reason: 'No position' };

  const isActiveModel = options.isActiveModel ?? false;
  let mutualExposureFound = false;

  for (const opponent of opponents) {
    if (opponent.state.isHidden) continue;
    const opponentSpatial = buildSpatialModel(battlefield, opponent);
    if (!opponentSpatial) continue;

    const cover = SpatialRules.getCoverResult(battlefield, opponentSpatial, characterSpatial);
    if (!cover.hasLOS) continue;

    // Check if both are without Cover from each other
    const characterInCover = cover.hasDirectCover || cover.hasInterveningCover;
    if (!characterInCover) {
      mutualExposureFound = true;
      break;
    }
  }

  if (!mutualExposureFound) {
    return { mustReveal: false, canReposition: false };
  }

  // QSR 850: Mutual exposure - all lose Hidden
  // Active model may NOT reposition, Passive models may reposition first
  if (isActiveModel) {
    // Active model: must lose Hidden, may NOT reposition
    character.state.isHidden = false;
    return {
      mustReveal: true,
      canReposition: false,
      reason: 'Mutual exposure: Active model loses Hidden, no reposition',
    };
  } else {
    // Passive model: may reposition first, then lose Hidden if still exposed
    if (options.allowReposition !== false && options.revealReposition) {
      const reposition = options.revealReposition({
        battlefield,
        character,
        opponents,
      });
      if (reposition) {
        const success = battlefield.moveCharacter(character, reposition.position);
        if (success) {
          // Check if still in mutual exposure after reposition
          // For now, assume reposition found cover
          return {
            mustReveal: false,
            canReposition: true,
            repositioned: true,
            position: reposition.position,
            reason: 'Passive model repositioned to avoid mutual exposure',
          };
        }
      }
    }
    // Couldn't reposition or reposition not allowed - lose Hidden
    character.state.isHidden = false;
    return {
      mustReveal: true,
      canReposition: options.allowReposition !== false,
      reason: 'Mutual exposure: Passive model loses Hidden',
    };
  }
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
