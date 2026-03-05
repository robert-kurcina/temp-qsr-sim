import { Character } from '../core/Character';
import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { SpatialModel } from './spatial/spatial-rules';
import { LOSOperations } from './los/LOSOperations';
import { getBaseDiameterFromSiz } from './spatial/size-utils';

export function normalizeVector(vec: { x: number; y: number }): { x: number; y: number } | null {
  const length = Math.hypot(vec.x, vec.y);
  if (length <= 1e-6) return null;
  return { x: vec.x / length, y: vec.y / length };
}

export function buildSpatialModel(
  battlefield: Battlefield | null,
  getCharacterPosition: (character: Character) => Position | undefined,
  character: Character
): SpatialModel | null {
  if (!battlefield) return null;
  const position = getCharacterPosition(character);
  if (!position) return null;
  const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
  return {
    id: character.id,
    position,
    baseDiameter: getBaseDiameterFromSiz(siz),
    siz,
    isPanicked: character.state.isPanicked || character.state.fearTokens >= 3,
  };
}

export function resolveEngagePosition(
  mover: SpatialModel,
  target: SpatialModel,
  moveLimit: number
): Position | null {
  const distance = LOSOperations.distance(mover.position, target.position);
  const baseContact = (mover.baseDiameter + target.baseDiameter) / 2;
  const requiredMove = Math.max(0, distance - baseContact);
  if (requiredMove > moveLimit || distance === 0) {
    return null;
  }
  const dx = target.position.x - mover.position.x;
  const dy = target.position.y - mover.position.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return mover.position;
  }
  const ratio = requiredMove / length;
  return {
    x: mover.position.x + dx * ratio,
    y: mover.position.y + dy * ratio,
  };
}
