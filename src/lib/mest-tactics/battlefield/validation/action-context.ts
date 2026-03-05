import { Battlefield } from '../Battlefield';
import { LOSOperations } from '../los/LOSOperations';
import { LOFOperations } from '../los/LOFOperations';
import { CoverResult, SpatialModel, SpatialRules } from '../spatial/spatial-rules';
import { TestContext } from '../../utils/TestContext';
import { Position } from '../Position';
import { TerrainType } from '../terrain/Terrain';
import { pointInPolygon } from '../terrain/BattlefieldUtils';

export interface ActionContextInput {
  battlefield: Battlefield;
  attacker: SpatialModel;
  target: SpatialModel;
  optimalRangeMu?: number;
  orm?: number;
  attackerEngagedOverride?: boolean;
  isLeaning?: boolean;
  agilityMu?: number;
  isTargetLeaning?: boolean;
  lofWidthMu?: number;
}

export interface CloseCombatContextInput extends ActionContextInput {
  moveStart?: Position;
  moveEnd?: Position;
  movedOverClear?: boolean;
  wasFreeAtStart?: boolean;
  imprecisionMu?: number;
  attackerElevationMu?: number;
  targetElevationMu?: number;
  attackerBaseHeightMu?: number;
  targetBaseHeightMu?: number;
  opposingModels?: SpatialModel[];
}

export interface ChargeSnapOptions {
  enabled: boolean;
  remainingMu: number;
  snapThresholdMu?: number;
}

const LEAN_SAMPLE_DIRECTIONS = 16;

function resolveCoverResultWithAgility(input: ActionContextInput): CoverResult {
  const baseCover = SpatialRules.getCoverResult(input.battlefield, input.attacker, input.target);
  if (baseCover.hasLOS || !input.isLeaning) {
    return baseCover;
  }

  const agilityMu = input.agilityMu ?? 0;
  const maxLeanMu = Math.min(agilityMu, input.attacker.baseDiameter);
  if (maxLeanMu <= 0) {
    return baseCover;
  }

  let best: CoverResult | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  const radii = [maxLeanMu, maxLeanMu * 0.75, maxLeanMu * 0.5].filter(radius => radius > 0);

  for (const radius of radii) {
    for (let i = 0; i < LEAN_SAMPLE_DIRECTIONS; i++) {
      const angle = (i / LEAN_SAMPLE_DIRECTIONS) * Math.PI * 2;
      const candidatePosition: Position = {
        x: input.attacker.position.x + Math.cos(angle) * radius,
        y: input.attacker.position.y + Math.sin(angle) * radius,
      };
      if (!input.battlefield.isWithinBounds(candidatePosition, input.attacker.baseDiameter)) {
        continue;
      }
      const cover = SpatialRules.getCoverResult(
        input.battlefield,
        { ...input.attacker, position: candidatePosition },
        input.target
      );
      if (!cover.hasLOS) {
        continue;
      }
      const penaltyScore = (cover.hasDirectCover ? 2 : 0) + (cover.hasInterveningCover ? 1 : 0);
      if (penaltyScore < bestPenalty) {
        best = cover;
        bestPenalty = penaltyScore;
      }
    }
  }

  return best ?? baseCover;
}

export function buildRangedActionContext(input: ActionContextInput): TestContext {
  const cover = resolveCoverResultWithAgility(input);
  const hasHardCover = cover.directCoverFeatures.some(feature => feature.meta?.los === 'Hard');
  const engaged = input.attackerEngagedOverride ?? SpatialRules.isEngaged(input.attacker, input.target);
  const edgeDistance = LOFOperations.distanceEdgeToEdge(input.attacker, input.target);
  const distance = Math.max(0, edgeDistance);
  const optimalRangeMu = input.optimalRangeMu ?? 0;
  const isPointBlank = !engaged && optimalRangeMu > 0 && distance <= optimalRangeMu / 2;
  const lofWidth = input.lofWidthMu ?? 1;
  const modelsAlongLof = LOFOperations.getModelsAlongLOF(
    input.attacker.position,
    input.target.position,
    input.battlefield.getModelBlockers([input.attacker.id, input.target.id]).map(model => ({
      id: model.id,
      position: model.position,
      baseDiameter: model.baseDiameter,
      isFriendly: false,
      isAttentive: input.battlefield.getCharacterById(model.id)?.state?.isAttentive ?? true,
      isOrdered: input.battlefield.getCharacterById(model.id)?.state?.isOrdered ?? true,
    })),
    { lofWidth }
  );

  const context: TestContext = {
    distance,
    isPointBlank,
    hasDirectCover: cover.hasDirectCover,
    hasInterveningCover: cover.hasInterveningCover,
    hasHardCover,
    isLeaning: input.isLeaning,
    isTargetLeaning: input.isTargetLeaning,
    obscuringModels: modelsAlongLof.length,
    isEngaged: engaged,
  };

  if (!cover.hasLOS) {
    context.hasDirectCover = false;
    context.hasInterveningCover = false;
    context.hasHardCover = false;
  }

  if (typeof input.orm === 'number') {
    context.orm = input.orm;
  }

  return context;
}

export function buildLOSResultContext(input: ActionContextInput): Pick<TestContext, 'hasDirectCover' | 'hasInterveningCover' | 'hasHardCover'> & { hasLOS: boolean } {
  const cover = resolveCoverResultWithAgility(input);
  const hasHardCover = cover.directCoverFeatures.some(feature => feature.meta?.los === 'Hard');
  return {
    hasLOS: cover.hasLOS,
    hasDirectCover: cover.hasDirectCover,
    hasInterveningCover: cover.hasInterveningCover,
    hasHardCover,
  };
}

export function computeEdgeDistance(attacker: SpatialModel, target: SpatialModel): number {
  return Math.max(0, LOFOperations.distanceEdgeToEdge(attacker, target));
}

export function computeCenterDistance(attacker: SpatialModel, target: SpatialModel): number {
  return LOSOperations.distance(attacker.position, target.position);
}

export function resolveFriendlyFire(
  input: ActionContextInput,
  models: SpatialModel[]
) {
  const lofWidth = input.lofWidthMu ?? 1;
  return LOFOperations.resolveFriendlyFire(
    input.attacker,
    input.target,
    models,
    { lofWidth }
  );
}

export function buildCloseCombatActionContext(input: CloseCombatContextInput): TestContext {
  const imprecision = input.imprecisionMu ?? 0.5;
  const attacker = input.attacker;
  const target = input.target;

  const endPosition = input.moveEnd ?? attacker.position;
  const startPosition = input.moveStart ?? attacker.position;
  const movedDistance = LOSOperations.distance(startPosition, endPosition);
  const movedOverClear = input.movedOverClear ?? false;
  const wasFreeAtStart = input.wasFreeAtStart ?? true;

  const baseContactDistance = (attacker.baseDiameter + target.baseDiameter) / 2;
  const endDistance = LOSOperations.distance(endPosition, target.position);
  const isBaseContact = endDistance <= baseContactDistance + imprecision;
  const isCharge = movedOverClear && wasFreeAtStart && movedDistance >= attacker.baseDiameter && isBaseContact;

  const attackerBaseHeight = input.attackerBaseHeightMu ?? attacker.baseDiameter;
  const targetBaseHeight = input.targetBaseHeightMu ?? target.baseDiameter;
  const attackerElevation = input.attackerElevationMu ?? 0;
  const targetElevation = input.targetElevationMu ?? 0;
  const hasHighGround = attackerElevation >= targetElevation + targetBaseHeight / 2
    && attackerElevation + attackerBaseHeight > targetElevation + targetBaseHeight;

  const isCornered = isBaseContact && SpatialRules.isEngaged(attacker, target)
    && isNearBlockingTerrainBehind(input.battlefield, attacker.position, target.position, attacker.baseDiameter / 2 + imprecision);

  const isFlanked = isBaseContact
    && SpatialRules.isEngaged(attacker, target)
    && hasFlankingOpponent(attacker, target, input.opposingModels ?? []);

  return {
    isCharge,
    hasHighGround,
    isCornered,
    isFlanked,
  };
}

function isNearBlockingTerrainBehind(
  battlefield: Battlefield,
  attackerPos: Position,
  targetPos: Position,
  distance: number
): boolean {
  const dx = attackerPos.x - targetPos.x;
  const dy = attackerPos.y - targetPos.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return false;
  const ux = dx / length;
  const uy = dy / length;
  const sample = { x: attackerPos.x + ux * distance, y: attackerPos.y + uy * distance };
  for (const feature of battlefield.terrain) {
    if (feature.type === TerrainType.Clear) continue;
    if (pointInPolygon(sample, feature.vertices)) {
      return true;
    }
  }
  return false;
}

function hasFlankingOpponent(
  attacker: SpatialModel,
  target: SpatialModel,
  opponents: SpatialModel[]
): boolean {
  const toTarget = {
    x: target.position.x - attacker.position.x,
    y: target.position.y - attacker.position.y,
  };
  const targetDistance = Math.hypot(toTarget.x, toTarget.y);
  if (targetDistance === 0) return false;
  const targetDir = { x: toTarget.x / targetDistance, y: toTarget.y / targetDistance };

  for (const opponent of opponents) {
    if (opponent.id === target.id) continue;
    const edgeDistance = LOFOperations.distanceEdgeToEdge(attacker, opponent);
    if (edgeDistance > 0) continue;
    const toOpponent = {
      x: opponent.position.x - attacker.position.x,
      y: opponent.position.y - attacker.position.y,
    };
    const oppDistance = Math.hypot(toOpponent.x, toOpponent.y);
    if (oppDistance === 0) continue;
    const oppDir = { x: toOpponent.x / oppDistance, y: toOpponent.y / oppDistance };
    const dot = targetDir.x * oppDir.x + targetDir.y * oppDir.y;
    if (dot < 0) {
      return true;
    }
  }
  return false;
}

export function resolveChargeSnapPosition(
  attacker: SpatialModel,
  target: SpatialModel,
  options: ChargeSnapOptions
): Position | null {
  if (!options.enabled) return null;
  const threshold = options.snapThresholdMu ?? 0.5;
  if (options.remainingMu > threshold) return null;

  const requiredCenterDistance = (attacker.baseDiameter + target.baseDiameter) / 2;
  const currentCenterDistance = LOSOperations.distance(attacker.position, target.position);
  if (currentCenterDistance <= requiredCenterDistance + 1e-6) {
    return attacker.position;
  }

  const delta = currentCenterDistance - requiredCenterDistance;
  if (delta > threshold + 1e-6) return null;

  if (currentCenterDistance === 0) return attacker.position;
  const directionX = (attacker.position.x - target.position.x) / currentCenterDistance;
  const directionY = (attacker.position.y - target.position.y) / currentCenterDistance;
  return {
    x: target.position.x + directionX * requiredCenterDistance,
    y: target.position.y + directionY * requiredCenterDistance,
  };
}
