import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { resolveMoraleTest } from '../subroutines/morale-test';
import { SpatialRules, SpatialModel } from '../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { getLeadershipBonusDice, isImmuneToPsychology, isExemptFromMoraleTests, isImmuneToHindranceMoralePenalties, hasCoward, getCowardAdditionalFearTokens } from '../traits/combat-traits';

export interface MoraleOptions {
  cohesionRangeMu?: number;
  requireLOS?: boolean;
  rollsById?: Record<string, number[]>;
  visibilityOrMu?: number;
  opposingModels?: Character[];
}
// TODO: Plan AI hooks for compulsory action targeting/paths and bot-driven Morale/Bottle decisions.

export interface FearResult {
  pass: boolean;
  fearAdded: number;
}

export interface AllyFearResult {
  ally: Character;
  fearAdded: number;
}

export function applyFearFromWounds(
  character: Character,
  woundsAdded: number,
  rolls?: number[]
): FearResult {
  if (woundsAdded <= 0) {
    return { pass: true, fearAdded: 0 };
  }
  
  // Insane trait: exempt from Morale Tests unless has Hindrance tokens
  const hasHindranceTokens = character.state.wounds > 0 || character.state.fearTokens > 0 || character.state.delayTokens > 0;
  if (isExemptFromMoraleTests(character, hasHindranceTokens)) {
    return { pass: true, fearAdded: 0 };
  }
  
  const result = resolveMoraleTest(character, character.state.fearTokens, {}, rolls ?? null);
  if (result.pass) {
    return { pass: true, fearAdded: 0 };
  }

  // RAW: failed test yields 1 Fear, or more if failed with multiple cascades.
  // We approximate cascades for failed tests using the negative score difference.
  let fearAdded = Math.max(1, Math.abs(result.score || 0));
  
  // Coward trait: additional Fear tokens on failed Morale
  if (hasCoward(character)) {
    fearAdded += getCowardAdditionalFearTokens(character, true);
  }
  
  character.state.fearTokens += fearAdded;
  updateFearState(character);
  return { pass: false, fearAdded };
}

export function applyFearFromAllyKO(
  battlefield: Battlefield,
  fallen: Character,
  allies: Character[],
  options: MoraleOptions = {}
): AllyFearResult[] {
  const results: AllyFearResult[] = [];
  const fallenSpatial = buildSpatialModel(battlefield, fallen);
  if (!fallenSpatial) return results;

  const cohesionRange = options.cohesionRangeMu ?? resolveCohesionRange(battlefield, fallen, allies, options);
  const requireLOS = options.requireLOS ?? true;

  for (const ally of allies) {
    if (ally.id === fallen.id) continue;
    if (ally.state.isKOd || ally.state.isEliminated) continue;
    const allySpatial = buildSpatialModel(battlefield, ally);
    if (!allySpatial) continue;
    const distance = distanceBetween(allySpatial.position, fallenSpatial.position);
    if (distance > cohesionRange) continue;
    if (requireLOS) {
      const cover = SpatialRules.getCoverResult(battlefield, allySpatial, fallenSpatial);
      if (!cover.hasLOS) continue;
    }
    const rolls = options.rollsById?.[ally.id];
    const fearResult = applyFearFromWounds(ally, 1, rolls);
    results.push({ ally, fearAdded: fearResult.fearAdded });
  }

  return results;
}

export function updateFearState(character: Character): void {
  character.refreshStatusFlags();
}

function defaultCohesionRange(character: Character): number {
  const siz = character.finalAttributes.siz || 3;
  return Math.max(4, siz);
}

function resolveCohesionRange(
  battlefield: Battlefield,
  fallen: Character,
  allies: Character[],
  options: MoraleOptions
): number {
  const visibilityOr = options.visibilityOrMu ?? 16;
  const halfVisibility = Math.floor(visibilityOr / 2);
  const baseRange = Math.max(4, fallen.finalAttributes.siz || 3);

  let range = Math.min(halfVisibility, baseRange);

  if (isHiddenAndObserved(battlefield, fallen, options.opposingModels ?? [])) {
    range = Math.floor(range / 2);
  }

  if (allies.some(ally => isHiddenAndObserved(battlefield, ally, options.opposingModels ?? []))) {
    range = Math.floor(range / 2);
  }

  return Math.max(0.5, range);
}

function isHiddenAndObserved(
  battlefield: Battlefield,
  character: Character,
  opponents: Character[]
): boolean {
  if (!character.state.isHidden) return false;
  if (opponents.length === 0) return true;
  const characterSpatial = buildSpatialModel(battlefield, character);
  if (!characterSpatial) return true;
  for (const opponent of opponents) {
    if (opponent.state.isHidden) continue;
    const opponentSpatial = buildSpatialModel(battlefield, opponent);
    if (!opponentSpatial) continue;
    const cover = SpatialRules.getCoverResult(battlefield, opponentSpatial, characterSpatial);
    if (cover.hasLOS) {
      return true;
    }
  }
  return false;
}

function buildSpatialModel(battlefield: Battlefield, character: Character): SpatialModel | null {
  const position = battlefield.getCharacterPosition(character);
  if (!position) return null;
  const siz = character.finalAttributes.siz || 3;
  return {
    id: character.id,
    position,
    baseDiameter: getBaseDiameterFromSiz(siz),
    siz,
  };
}

function distanceBetween(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
