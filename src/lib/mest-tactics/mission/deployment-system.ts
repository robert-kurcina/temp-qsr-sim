/**
 * Deployment System (QSR)
 * 
 * Handles pre-game deployment of models:
 * - Deployment zone validation
 * - Alternating deployment
 * - Minimum distance requirements
 * - Terrain-based deployment restrictions
 */

import { Character } from '../core/Character';
import { Position } from '../battlefield/Position';
import { MissionSide } from './MissionSide';
import { Battlefield } from '../battlefield/Battlefield';
import { DeploymentValidationResult } from './bp-validator';
import type { MissionDeploymentType } from '../missions/mission-deployment';

export interface DeploymentZone {
  /** Zone identifier */
  id: string;
  /** Zone name */
  name: string;
  /** Zone bounds (x, y, width, height) */
  bounds: { x: number; y: number; width: number; height: number };
  /** Which side can deploy here */
  sideId: string;
  /** Maximum models that can deploy here */
  maxModels?: number;
  /** Terrain types allowed (optional restriction) */
  allowedTerrain?: string[];
}

export interface DeploymentState {
  /** Current deployment phase */
  phase: 'not_started' | 'deploying' | 'complete';
  /** Side currently deploying */
  activeSideId?: string;
  /** Order of sides for alternating deployment */
  deploymentOrder: string[];
  /** Current index in deployment order */
  currentIndex: number;
  /** Models already deployed */
  deployedModels: Map<string, { characterId: string; sideId: string; position: Position }>;
  /** Models remaining to deploy per side */
  remainingModels: Map<string, string[]>;
  /** Minimum distance between opposing models */
  minDistanceBetweenOpponents: number;
  /** Whether deployment is alternating or simultaneous */
  isAlternating: boolean;
}

export interface DeploymentResult {
  /** Whether deployment was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Updated deployment state */
  state?: DeploymentState;
  /** Deployed model info */
  deployedModel?: {
    characterId: string;
    sideId: string;
    position: Position;
  };
}

export interface DeploymentConfig {
  /** Minimum distance between opposing models (default: 6") */
  minDistanceBetweenOpponents?: number;
  /** Whether to use alternating deployment (default: true) */
  isAlternating?: boolean;
  /** Custom deployment zones */
  zones?: DeploymentZone[];
  /** Battlefield dimensions */
  battlefieldWidth: number;
  battlefieldHeight: number;
}

/**
 * Create default deployment zones based on battlefield size
 * QSR: Deployment zone depth is provided by the caller (typically from canonical game-size data).
 * `opposing_edges` zones span the battlefield's longest dimension.
 * `corners` zones use square corner pockets with side length = deployment depth.
 * `custom` currently falls back to `opposing_edges` when no mission-specific geometry is supplied.
 */
export function createDefaultDeploymentZones(
  battlefieldWidth: number,
  battlefieldHeight: number,
  sideIds: string[],
  deploymentDepth: number = 6,
  deploymentType: MissionDeploymentType = 'opposing_edges'
): DeploymentZone[] {
  if (sideIds.length < 2) {
    return [];
  }

  if (deploymentType === 'corners') {
    return createCornerDeploymentZones(
      battlefieldWidth,
      battlefieldHeight,
      sideIds,
      deploymentDepth
    );
  }

  // Custom deployment geometry is mission-specific. Until that data is provided,
  // preserve deterministic behavior using standard opposing-edge zones.
  return createOpposingEdgeDeploymentZones(
    battlefieldWidth,
    battlefieldHeight,
    sideIds,
    deploymentDepth
  );
}

function createOpposingEdgeDeploymentZones(
  battlefieldWidth: number,
  battlefieldHeight: number,
  sideIds: string[],
  deploymentDepth: number
): DeploymentZone[] {
  const zones: DeploymentZone[] = [];
  const zoneDepth = Math.max(1, Math.floor(deploymentDepth));
  const primaryTopBottom = battlefieldWidth >= battlefieldHeight;
  const edgeOrder = primaryTopBottom
    ? ['north', 'south', 'west', 'east']
    : ['west', 'east', 'north', 'south'];

  for (let i = 0; i < sideIds.length && i < 4; i++) {
    const edge = edgeOrder[i];
    const sideId = sideIds[i];

    if (edge === 'north') {
      zones.push({
        id: 'zone_top',
        name: 'North Deployment Zone',
        bounds: {
          x: 0,
          y: 0,
          width: battlefieldWidth,
          height: Math.min(zoneDepth, battlefieldHeight),
        },
        sideId,
      });
      continue;
    }

    if (edge === 'south') {
      const depth = Math.min(zoneDepth, battlefieldHeight);
      zones.push({
        id: 'zone_bottom',
        name: 'South Deployment Zone',
        bounds: {
          x: 0,
          y: battlefieldHeight - depth,
          width: battlefieldWidth,
          height: depth,
        },
        sideId,
      });
      continue;
    }

    if (edge === 'west') {
      zones.push({
        id: 'zone_left',
        name: 'West Deployment Zone',
        bounds: {
          x: 0,
          y: 0,
          width: Math.min(zoneDepth, battlefieldWidth),
          height: battlefieldHeight,
        },
        sideId,
      });
      continue;
    }

    if (edge === 'east') {
      const depth = Math.min(zoneDepth, battlefieldWidth);
      zones.push({
        id: 'zone_right',
        name: 'East Deployment Zone',
        bounds: {
          x: battlefieldWidth - depth,
          y: 0,
          width: depth,
          height: battlefieldHeight,
        },
        sideId,
      });
    }
  }

  return zones;
}

function createCornerDeploymentZones(
  battlefieldWidth: number,
  battlefieldHeight: number,
  sideIds: string[],
  deploymentDepth: number
): DeploymentZone[] {
  const zones: DeploymentZone[] = [];
  const zoneDepth = Math.max(1, Math.floor(deploymentDepth));
  const depthX = Math.min(zoneDepth, battlefieldWidth);
  const depthY = Math.min(zoneDepth, battlefieldHeight);
  const cornerOrder: Array<'north_west' | 'south_east' | 'north_east' | 'south_west'> = [
    'north_west',
    'south_east',
    'north_east',
    'south_west',
  ];

  for (let i = 0; i < sideIds.length && i < 4; i++) {
    const corner = cornerOrder[i];
    const sideId = sideIds[i];

    if (corner === 'north_west') {
      zones.push({
        id: 'zone_north_west',
        name: 'North-West Deployment Zone',
        bounds: {
          x: 0,
          y: 0,
          width: depthX,
          height: depthY,
        },
        sideId,
      });
      continue;
    }

    if (corner === 'south_east') {
      zones.push({
        id: 'zone_south_east',
        name: 'South-East Deployment Zone',
        bounds: {
          x: battlefieldWidth - depthX,
          y: battlefieldHeight - depthY,
          width: depthX,
          height: depthY,
        },
        sideId,
      });
      continue;
    }

    if (corner === 'north_east') {
      zones.push({
        id: 'zone_north_east',
        name: 'North-East Deployment Zone',
        bounds: {
          x: battlefieldWidth - depthX,
          y: 0,
          width: depthX,
          height: depthY,
        },
        sideId,
      });
      continue;
    }

    zones.push({
      id: 'zone_south_west',
      name: 'South-West Deployment Zone',
      bounds: {
        x: 0,
        y: battlefieldHeight - depthY,
        width: depthX,
        height: depthY,
      },
      sideId,
    });
  }

  return zones;
}

/**
 * Initialize deployment state
 */
export function initializeDeployment(
  sides: MissionSide[],
  config: DeploymentConfig
): DeploymentState {
  const sideIds = sides.map(s => s.id);
  const deploymentOrder = [...sideIds]; // Can be randomized if needed
  
  const remainingModels = new Map<string, string[]>();
  for (const side of sides) {
    remainingModels.set(
      side.id,
      side.members.map(m => m.id)
    );
  }

  return {
    phase: 'not_started',
    activeSideId: undefined,
    deploymentOrder,
    currentIndex: 0,
    deployedModels: new Map(),
    remainingModels,
    minDistanceBetweenOpponents: config.minDistanceBetweenOpponents ?? 6,
    isAlternating: config.isAlternating ?? true,
  };
}

/**
 * Start deployment phase
 */
export function startDeployment(state: DeploymentState): DeploymentState {
  return {
    ...state,
    phase: 'deploying',
    activeSideId: state.deploymentOrder[0],
    currentIndex: 0,
  };
}

/**
 * Validate if a position is within a deployment zone
 */
export function isValidDeploymentPosition(
  position: Position,
  zone: DeploymentZone,
  battlefield?: Battlefield
): { valid: boolean; reason?: string } {
  const { bounds } = zone;
  
  // Check if position is within zone bounds
  const inBounds =
    position.x >= bounds.x &&
    position.x <= bounds.x + bounds.width &&
    position.y >= bounds.y &&
    position.y <= bounds.y + bounds.height;

  if (!inBounds) {
    return {
      valid: false,
      reason: `Position (${position.x}, ${position.y}) is outside deployment zone "${zone.name}"`,
    };
  }

  // Check terrain if battlefield provided
  if (battlefield && zone.allowedTerrain) {
    const terrain = battlefield.getTerrainAt(position);
    if (!zone.allowedTerrain.includes(terrain.type)) {
      return {
        valid: false,
        reason: `Terrain "${terrain.type}" not allowed in this zone`,
      };
    }
  }

  return { valid: true };
}

/**
 * Check minimum distance from opposing models
 */
export function checkMinimumDistance(
  position: Position,
  sideId: string,
  deployedModels: Map<string, { characterId: string; sideId: string; position: Position }>,
  minDistance: number
): { valid: boolean; closestDistance?: number; violatingModel?: string } {
  let closestDistance = Infinity;
  let violatingModel: string | undefined;

  for (const [key, model] of deployedModels.entries()) {
    // Skip models from same side
    if (model.sideId === sideId) {
      continue;
    }

    const dx = position.x - model.position.x;
    const dy = position.y - model.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < closestDistance) {
      closestDistance = distance;
    }

    if (distance < minDistance) {
      violatingModel = model.characterId;
    }
  }

  if (violatingModel) {
    return {
      valid: false,
      closestDistance,
      violatingModel,
    };
  }

  return {
    valid: true,
    closestDistance: closestDistance === Infinity ? undefined : closestDistance,
  };
}

/**
 * Deploy a single model
 */
export function deployModel(
  state: DeploymentState,
  characterId: string,
  sideId: string,
  position: Position,
  zones: DeploymentZone[],
  battlefield?: Battlefield
): DeploymentResult {
  // Check if it's this side's turn
  if (state.activeSideId !== sideId) {
    return {
      success: false,
      error: `Not ${sideId}'s turn to deploy`,
    };
  }

  // Check if character is remaining
  const remaining = state.remainingModels.get(sideId) || [];
  if (!remaining.includes(characterId)) {
    return {
      success: false,
      error: `Character ${characterId} has already been deployed or doesn't exist`,
    };
  }

  // Find valid zone for this side
  const validZones = zones.filter(z => z.sideId === sideId);
  if (validZones.length === 0) {
    return {
      success: false,
      error: `No deployment zone found for side ${sideId}`,
    };
  }

  // Check if position is in any valid zone
  let inValidZone = false;
  let zoneReason: string | undefined;
  for (const zone of validZones) {
    const result = isValidDeploymentPosition(position, zone, battlefield);
    if (result.valid) {
      inValidZone = true;
      break;
    }
    zoneReason = result.reason;
  }

  if (!inValidZone) {
    return {
      success: false,
      error: zoneReason || `Position not in valid deployment zone`,
    };
  }

  // Check minimum distance from opponents
  const distanceCheck = checkMinimumDistance(
    position,
    sideId,
    state.deployedModels,
    state.minDistanceBetweenOpponents
  );

  if (!distanceCheck.valid) {
    return {
      success: false,
      error: `Too close to opposing model ${distanceCheck.violatingModel} (${distanceCheck.closestDistance?.toFixed(1)}" < ${state.minDistanceBetweenOpponents}")`,
    };
  }

  // Check zone model limit
  for (const zone of validZones) {
    if (zone.maxModels) {
      const modelsInZone = Array.from(state.deployedModels.values()).filter(
        m => {
          const pos = m.position;
          return (
            pos.x >= zone.bounds.x &&
            pos.x <= zone.bounds.x + zone.bounds.width &&
            pos.y >= zone.bounds.y &&
            pos.y <= zone.bounds.y + zone.bounds.height
          );
        }
      ).length;

      if (modelsInZone >= zone.maxModels) {
        return {
          success: false,
          error: `Zone "${zone.name}" is full (${zone.maxModels} models)`,
        };
      }
    }
  }

  // Deploy the model
  const newDeployedModels = new Map(state.deployedModels);
  newDeployedModels.set(characterId, {
    characterId,
    sideId,
    position,
  });

  const newRemaining = new Map(state.remainingModels);
  newRemaining.set(sideId, remaining.filter(id => id !== characterId));

  // Determine next active side
  let nextIndex = state.currentIndex;
  let nextSideId = state.activeSideId;
  
  if (state.isAlternating) {
    nextIndex = (state.currentIndex + 1) % state.deploymentOrder.length;
    nextSideId = state.deploymentOrder[nextIndex];
  }

  // Check if deployment is complete
  const allDeployed = Array.from(newRemaining.values()).every(
    models => models.length === 0
  );

  return {
    success: true,
    state: {
      ...state,
      deployedModels: newDeployedModels,
      remainingModels: newRemaining,
      currentIndex: nextIndex,
      activeSideId: allDeployed ? undefined : nextSideId,
      phase: allDeployed ? 'complete' : state.phase,
    },
    deployedModel: {
      characterId,
      sideId,
      position,
    },
  };
}

/**
 * Get deployment status summary
 */
export function getDeploymentStatus(state: DeploymentState): {
  phase: string;
  activeSide?: string;
  deployed: number;
  remaining: number;
  sideBreakdown: Array<{
    sideId: string;
    deployed: number;
    remaining: number;
  }>;
} {
  const sideBreakdown: Array<{
    sideId: string;
    deployed: number;
    remaining: number;
  }> = [];

  let totalDeployed = 0;
  let totalRemaining = 0;

  for (const sideId of state.deploymentOrder) {
    const remaining = state.remainingModels.get(sideId) || [];
    const deployed = state.deployedModels.size - 
      Array.from(state.deployedModels.values()).filter(m => m.sideId !== sideId).length;
    
    // Recalculate deployed for this side
    const sideDeployed = Array.from(state.deployedModels.values()).filter(
      m => m.sideId === sideId
    ).length;

    sideBreakdown.push({
      sideId,
      deployed: sideDeployed,
      remaining: remaining.length,
    });

    totalDeployed += sideDeployed;
    totalRemaining += remaining.length;
  }

  return {
    phase: state.phase,
    activeSide: state.activeSideId,
    deployed: totalDeployed,
    remaining: totalRemaining,
    sideBreakdown,
  };
}

/**
 * Validate complete deployment (all models deployed correctly)
 */
export function validateCompleteDeployment(
  state: DeploymentState,
  zones: DeploymentZone[]
): DeploymentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if all models are deployed
  for (const [sideId, remaining] of state.remainingModels.entries()) {
    if (remaining.length > 0) {
      errors.push(`Side ${sideId} has ${remaining.length} models not deployed`);
    }
  }

  // Check minimum distances between all opposing models
  const deployedBySide = new Map<string, Array<{ characterId: string; position: Position }>>();
  for (const [characterId, model] of state.deployedModels.entries()) {
    const sideModels = deployedBySide.get(model.sideId) || [];
    sideModels.push({ characterId, position: model.position });
    deployedBySide.set(model.sideId, sideModels);
  }

  const sideIds = Array.from(deployedBySide.keys());
  for (let i = 0; i < sideIds.length; i++) {
    for (let j = i + 1; j < sideIds.length; j++) {
      const sideA = deployedBySide.get(sideIds[i]) || [];
      const sideB = deployedBySide.get(sideIds[j]) || [];

      for (const modelA of sideA) {
        for (const modelB of sideB) {
          const dx = modelA.position.x - modelB.position.x;
          const dy = modelA.position.y - modelB.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < state.minDistanceBetweenOpponents) {
            errors.push(
              `Models ${modelA.characterId} and ${modelB.characterId} too close (${distance.toFixed(1)}" < ${state.minDistanceBetweenOpponents}")`
            );
          }
        }
      }
    }
  }

  // Check zone constraints
  for (const zone of zones) {
    const modelsInZone = Array.from(state.deployedModels.values()).filter(
      m => {
        const pos = m.position;
        return (
          pos.x >= zone.bounds.x &&
          pos.x <= zone.bounds.x + zone.bounds.width &&
          pos.y >= zone.bounds.y &&
          pos.y <= zone.bounds.y + zone.bounds.height
        );
      }
    );

    if (zone.maxModels && modelsInZone.length > zone.maxModels) {
      errors.push(
        `Zone "${zone.name}" has ${modelsInZone.length} models (max: ${zone.maxModels})`
      );
    }

    // Warn if zone is empty
    if (modelsInZone.length === 0 && zone.sideId) {
      warnings.push(`Zone "${zone.name}" is empty`);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    deployedCount: state.deployedModels.size,
    remainingCount: Array.from(state.remainingModels.values()).reduce(
      (sum, models) => sum + models.length,
      0
    ),
  };
}
