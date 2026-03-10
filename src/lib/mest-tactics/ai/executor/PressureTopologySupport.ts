import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import { Character } from '../../core/Character';

interface TopologyContextDeps {
  battlefield: Battlefield;
  allCharacters: Character[];
  findCharacterSide: (character: Character) => string | null;
}

export function buildPressureTopologySignatureForGameLoop(
  actionType: string,
  sideId: string,
  attacker: Character,
  target: Character,
  deps: TopologyContextDeps
): string | undefined {
  const attackerPos = deps.battlefield.getCharacterPosition(attacker);
  const targetPos = deps.battlefield.getCharacterPosition(target);
  if (!attackerPos || !targetPos) {
    return undefined;
  }

  if (actionType === 'close_combat' || actionType === 'charge') {
    return buildScrumTopologySignatureForGameLoop(
      sideId,
      attacker,
      target,
      attackerPos,
      targetPos,
      deps
    );
  }
  if (actionType === 'ranged_combat') {
    return buildLaneTopologySignatureForGameLoop(
      sideId,
      attacker,
      target,
      attackerPos,
      targetPos,
      deps
    );
  }
  return undefined;
}

function buildScrumTopologySignatureForGameLoop(
  sideId: string,
  attacker: Character,
  target: Character,
  attackerPos: Position,
  targetPos: Position,
  deps: TopologyContextDeps
): string {
  const attackerModel = buildSpatialModelForGameLoop(attacker, attackerPos);
  const targetModel = buildSpatialModelForGameLoop(target, targetPos);
  const engagedAroundTarget: string[] = [];
  const engagedAroundAttacker: string[] = [];

  for (const candidate of deps.allCharacters) {
    if (candidate.id === target.id || candidate.state.isKOd || candidate.state.isEliminated) {
      continue;
    }
    const candidatePos = deps.battlefield.getCharacterPosition(candidate);
    if (!candidatePos) continue;
    const candidateModel = buildSpatialModelForGameLoop(candidate, candidatePos);
    if (SpatialRules.isEngaged(targetModel, candidateModel)) {
      engagedAroundTarget.push(`${getSideTokenForGameLoop(sideId, candidate, deps.findCharacterSide)}:${candidate.id}`);
    }
    if (candidate.id !== attacker.id && SpatialRules.isEngaged(attackerModel, candidateModel)) {
      engagedAroundAttacker.push(`${getSideTokenForGameLoop(sideId, candidate, deps.findCharacterSide)}:${candidate.id}`);
    }
  }

  engagedAroundTarget.sort();
  engagedAroundAttacker.sort();
  const edgeDistance = quantizeDistanceForGameLoop(
    SpatialRules.distanceEdgeToEdge(attackerModel, targetModel),
    0.25
  );
  return [
    'scrum',
    `target=${target.id}`,
    `dist=${edgeDistance}`,
    `engagedTarget=${engagedAroundTarget.join(',') || '-'}`,
    `engagedAttacker=${engagedAroundAttacker.join(',') || '-'}`,
  ].join('|');
}

function buildLaneTopologySignatureForGameLoop(
  sideId: string,
  attacker: Character,
  target: Character,
  attackerPos: Position,
  targetPos: Position,
  deps: TopologyContextDeps
): string {
  const attackerModel = buildSpatialModelForGameLoop(attacker, attackerPos);
  const targetModel = buildSpatialModelForGameLoop(target, targetPos);
  const cover = SpatialRules.getCoverResult(deps.battlefield, attackerModel, targetModel);
  const hasLof = SpatialRules.hasLineOfFire(deps.battlefield, attackerModel, targetModel);
  const distance = Math.hypot(attackerPos.x - targetPos.x, attackerPos.y - targetPos.y);
  const rangeBucket = quantizeDistanceForGameLoop(distance, 0.5);
  const angleBucket = computeAngleBucketForGameLoop(targetPos, attackerPos, 8);
  const coverMask = `${cover.hasLOS ? 1 : 0}${cover.hasDirectCover ? 1 : 0}${cover.hasInterveningCover ? 1 : 0}`;
  const directCover = cover.directCoverFeatures.map(feature => feature.id).sort().slice(0, 3).join(',') || '-';
  const interveningCover = cover.interveningCoverFeatures.map(feature => feature.id).sort().slice(0, 3).join(',') || '-';

  return [
    'lane',
    `side=${sideId}`,
    `target=${target.id}`,
    `angle=${angleBucket}`,
    `range=${rangeBucket}`,
    `lof=${hasLof ? 1 : 0}`,
    `cover=${coverMask}`,
    `block=${cover.blockingModelId ?? cover.blockingFeature?.id ?? '-'}`,
    `modelCover=${cover.coveringModelId ?? '-'}`,
    `direct=${directCover}`,
    `intervening=${interveningCover}`,
  ].join('|');
}

function buildSpatialModelForGameLoop(character: Character, position: Position) {
  const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
  return {
    id: character.id,
    position,
    siz,
    baseDiameter: getBaseDiameterFromSiz(siz),
    isPanicked: character.state?.isPanicked ?? false,
  };
}

function getSideTokenForGameLoop(
  sideId: string,
  character: Character,
  findCharacterSide: (character: Character) => string | null
): 'f' | 'e' | 'u' {
  const modelSideId = findCharacterSide(character);
  if (!modelSideId) {
    return 'u';
  }
  return modelSideId === sideId ? 'f' : 'e';
}

function quantizeDistanceForGameLoop(distance: number, step: number): string {
  if (!Number.isFinite(distance) || !Number.isFinite(step) || step <= 0) {
    return 'na';
  }
  const bucket = Math.round(distance / step) * step;
  return bucket.toFixed(2);
}

function computeAngleBucketForGameLoop(origin: Position, target: Position, slices: number): number {
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    return 0;
  }
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return 0;
  }
  const normalized = (Math.atan2(dy, dx) + (Math.PI * 2)) % (Math.PI * 2);
  const safeSlices = Math.max(1, Math.floor(slices));
  return Math.floor((normalized / (Math.PI * 2)) * safeSlices) % safeSlices;
}

