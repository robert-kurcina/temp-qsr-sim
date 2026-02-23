/**
 * Scatter System for Indirect Range Attacks (QSR)
 * 
 * When an Indirect Range Attack misses, the target location scatters:
 * - Distance: misses × 1" (minimum 1 MU)
 * - Direction: Hexagonal template with 6 directions (d6 roll)
 * - Collision: Stops at walls/barriers, reflects off walls
 * - Roll-down: Additional displacement on slopes/precipices
 */

import { Position } from '../battlefield/Position';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/terrain-types';

export interface ScatterResult {
  /** Original target location */
  originalTarget: Position;
  /** Final scattered location */
  finalPosition: Position;
  /** Scatter distance in MU */
  scatterDistance: number;
  /** Scatter direction index (0-5 for 6 hexagonal directions) */
  scatterDirection: number;
  /** Whether scatter was blocked by barrier */
  blocked: boolean;
  /** Barrier that blocked (if any) */
  blockingBarrier?: {
    type: 'wall' | 'obstacle' | 'building' | 'vehicle';
    position: Position;
  };
  /** Whether roll-down occurred */
  rollDownOccurred: boolean;
  /** Roll-down distance (if occurred) */
  rollDownDistance?: number;
  /** Number of misses that caused scatter */
  misses: number;
}

export interface ScatterOptions {
  /** Attacker position */
  attackerPosition: Position;
  /** Original target location */
  targetPosition: Position;
  /** Number of misses from Hit Test */
  misses: number;
  /** Battlefield for collision detection */
  battlefield: Battlefield;
  /** d6 roll for direction (1-6) */
  directionRoll: number;
  /** Random number generator (default: Math.random) */
  rng?: () => number;
}

/**
 * Scatter directions in hexagonal pattern (6 directions at 60° increments)
 * Index matches d6 roll - 1 (0-5)
 * 
 * Direction 0 (d6=1): Forward (0°) — Along LOF toward target
 * Direction 1 (d6=2): Forward-Right (60°)
 * Direction 2 (d6=3): Backward-Right (120°)
 * Direction 3 (d6=4): Backward (180°) — Away from attacker
 * Direction 4 (d6=5): Backward-Left (240°)
 * Direction 5 (d6=6): Forward-Left (300°)
 */
const SCATTER_DIRECTIONS = [
  { angle: 0, name: 'Forward' },        // d6 = 1
  { angle: 60, name: 'Forward-Right' },  // d6 = 2
  { angle: 120, name: 'Backward-Right' }, // d6 = 3
  { angle: 180, name: 'Backward' },      // d6 = 4
  { angle: 240, name: 'Backward-Left' },  // d6 = 5
  { angle: 300, name: 'Forward-Left' },   // d6 = 6
];

/**
 * Calculate scatter distance (QSR: misses × 1", minimum 1 MU)
 */
export function calculateScatterDistance(misses: number): number {
  return Math.max(1, misses);
}

/**
 * Determine scatter direction from d6 roll
 * Returns direction index (0-5) and angle in degrees
 */
export function determineScatterDirectionFromRoll(directionRoll: number): {
  directionIndex: number;
  angleDegrees: number;
  name: string;
} {
  // Clamp roll to 1-6
  const roll = Math.max(1, Math.min(6, directionRoll));
  const directionIndex = roll - 1; // Convert to 0-5 index
  const direction = SCATTER_DIRECTIONS[directionIndex];
  
  return {
    directionIndex,
    angleDegrees: direction.angle,
    name: direction.name,
  };
}

/**
 * Calculate LOF angle from attacker to target (in degrees)
 */
export function calculateLOFAngle(attackerPosition: Position, targetPosition: Position): number {
  const dx = targetPosition.x - attackerPosition.x;
  const dy = targetPosition.y - attackerPosition.y;
  const angleRadians = Math.atan2(dy, dx);
  let angleDegrees = (angleRadians * 180) / Math.PI;
  
  // Normalize to 0-360
  if (angleDegrees < 0) {
    angleDegrees += 360;
  }
  
  return angleDegrees;
}

/**
 * Calculate final scatter position
 */
export function calculateScatterPosition(
  startPosition: Position,
  distance: number,
  angleDegrees: number
): Position {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  return {
    x: startPosition.x + Math.cos(angleRadians) * distance,
    y: startPosition.y + Math.sin(angleRadians) * distance,
  };
}

/**
 * Check if position is within battlefield bounds
 */
export function isWithinBattlefield(
  position: Position,
  battlefield: Battlefield
): boolean {
  return (
    position.x >= 0 &&
    position.x <= battlefield.width &&
    position.y >= 0 &&
    position.y <= battlefield.height
  );
}

/**
 * Check for barrier collision along scatter path
 */
export function checkBarrierCollision(
  startPosition: Position,
  endPosition: Position,
  battlefield: Battlefield
): {
  collided: boolean;
  barrier?: {
    type: 'wall' | 'obstacle' | 'building' | 'vehicle';
    position: Position;
  };
} {
  // Simple line tracing for collision
  const steps = Math.ceil(
    Math.sqrt(
      Math.pow(endPosition.x - startPosition.x, 2) +
        Math.pow(endPosition.y - startPosition.y, 2)
    ) * 4
  ); // 4 steps per MU for precision

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const checkPos: Position = {
      x: startPosition.x + (endPosition.x - startPosition.x) * t,
      y: startPosition.y + (endPosition.y - startPosition.y) * t,
    };

    // Check terrain features for blocking
    const isBlocking = battlefield.terrain.some(feature => {
      if (!feature.bounds) return false;
      const bounds = feature.bounds;
      return (
        checkPos.x >= bounds.x &&
        checkPos.x <= bounds.x + bounds.width &&
        checkPos.y >= bounds.y &&
        checkPos.y <= bounds.y + bounds.height &&
        (feature.type === 'Blocking' || feature.type === 'Impassable')
      );
    });
    
    if (isBlocking) {
      return {
        collided: true,
        barrier: {
          type: 'wall',
          position: checkPos,
        },
      };
    }

    // Check for obstacles (partial blocking)
    const isObstacle = battlefield.terrain.some(feature => {
      if (!feature.bounds) return false;
      const bounds = feature.bounds;
      return (
        checkPos.x >= bounds.x &&
        checkPos.x <= bounds.x + bounds.width &&
        checkPos.y >= bounds.y &&
        checkPos.y <= bounds.y + bounds.height &&
        (feature.type === 'Rough' || feature.type === 'Difficult')
      );
    });
    
    if (isObstacle) {
      return {
        collided: true,
        barrier: {
          type: 'obstacle',
          position: checkPos,
        },
      };
    }
  }

  return { collided: false };
}

/**
 * Calculate roll-down distance for slopes/precipices (QSR)
 * Cliff/Precipice: 0.5 MU per 1 MU dropped + 1 MU per miss
 */
export function calculateRollDown(
  startPosition: Position,
  endPosition: Position,
  battlefield: Battlefield,
  misses: number
): {
  rollDownDistance: number;
  finalPosition: Position;
  occurred: boolean;
} {
  // Check for elevation difference in terrain features
  let startElevation = 0;
  let endElevation = 0;

  for (const feature of battlefield.terrain) {
    if (!feature.bounds) continue;
    const bounds = feature.bounds;
    
    // Check start position
    if (
      startPosition.x >= bounds.x &&
      startPosition.x <= bounds.x + bounds.width &&
      startPosition.y >= bounds.y &&
      startPosition.y <= bounds.y + bounds.height
    ) {
      if (feature.elevation !== undefined && feature.elevation > startElevation) {
        startElevation = feature.elevation;
      }
    }
    
    // Check end position
    if (
      endPosition.x >= bounds.x &&
      endPosition.x <= bounds.x + bounds.width &&
      endPosition.y >= bounds.y &&
      endPosition.y <= bounds.y + bounds.height
    ) {
      if (feature.elevation !== undefined && feature.elevation > endElevation) {
        endElevation = feature.elevation;
      }
    }
  }

  const heightDifference = startElevation - endElevation;

  if (heightDifference <= 0) {
    // No roll-down (not going down)
    return {
      rollDownDistance: 0,
      finalPosition: endPosition,
      occurred: false,
    };
  }

  // Calculate roll-down distance: 0.5 MU per 1 MU dropped + 1 MU per miss
  const rollDownDistance = heightDifference * 0.5 + misses;

  // Calculate direction (continue in same direction)
  const dx = endPosition.x - startPosition.x;
  const dy = endPosition.y - startPosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return {
      rollDownDistance,
      finalPosition: endPosition,
      occurred: true,
    };
  }

  // Normalize and apply roll-down
  const normalizedDx = dx / distance;
  const normalizedDy = dy / distance;

  const finalPosition: Position = {
    x: endPosition.x + normalizedDx * rollDownDistance,
    y: endPosition.y + normalizedDy * rollDownDistance,
  };

  return {
    rollDownDistance,
    finalPosition,
    occurred: true,
  };
}

/**
 * Handle wall reflection (QSR: reflected angle of incident angle)
 */
export function reflectOffWall(
  incomingPosition: Position,
  wallPosition: Position,
  wallNormal: { x: number; y: number },
  remainingDistance: number
): Position {
  // Calculate incoming direction
  const incomingDx = wallPosition.x - incomingPosition.x;
  const incomingDy = wallPosition.y - incomingPosition.y;
  const incomingDist = Math.sqrt(incomingDx * incomingDx + incomingDy * incomingDy);

  if (incomingDist === 0) {
    return wallPosition;
  }

  // Normalize incoming direction
  const incomingNx = incomingDx / incomingDist;
  const incomingNy = incomingDy / incomingDist;

  // Reflect: R = I - 2(I·N)N
  const dot = incomingNx * wallNormal.x + incomingNy * wallNormal.y;
  const reflectedNx = incomingNx - 2 * dot * wallNormal.x;
  const reflectedNy = incomingNy - 2 * dot * wallNormal.y;

  // Apply remaining distance
  return {
    x: wallPosition.x + reflectedNx * remainingDistance,
    y: wallPosition.y + reflectedNy * remainingDistance,
  };
}

/**
 * Main scatter resolution function
 */
export function resolveScatter(options: ScatterOptions): ScatterResult {
  const {
    attackerPosition,
    targetPosition,
    misses,
    battlefield,
    directionRoll,
  } = options;

  // Calculate scatter distance (minimum 1 MU)
  const scatterDistance = calculateScatterDistance(misses);

  // Calculate LOF angle from attacker to target
  const lofAngle = calculateLOFAngle(attackerPosition, targetPosition);

  // Determine scatter direction from d6 roll
  const directionInfo = determineScatterDirectionFromRoll(directionRoll);
  
  // Calculate final scatter angle (LOF angle + scatter direction offset)
  let scatterAngle = lofAngle + directionInfo.angleDegrees;
  scatterAngle = ((scatterAngle % 360) + 360) % 360; // Normalize to 0-360

  // Calculate initial scattered position
  let scatteredPosition = calculateScatterPosition(targetPosition, scatterDistance, scatterAngle);

  // Check for barrier collision
  const collision = checkBarrierCollision(targetPosition, scatteredPosition, battlefield);

  let blocked = false;
  let blockingBarrier: ScatterResult['blockingBarrier'] = undefined;
  let finalPosition = scatteredPosition;

  if (collision.collided && collision.barrier) {
    blocked = true;
    blockingBarrier = collision.barrier;
    finalPosition = collision.barrier.position;
  }

  // Check for roll-down (gravity)
  const rollDown = calculateRollDown(scatteredPosition, finalPosition, battlefield, misses);
  
  if (rollDown.occurred && !blocked) {
    // Check for barrier after roll-down
    const rollDownCollision = checkBarrierCollision(finalPosition, rollDown.finalPosition, battlefield);
    
    if (rollDownCollision.collided && rollDownCollision.barrier) {
      finalPosition = rollDownCollision.barrier.position;
    } else {
      finalPosition = rollDown.finalPosition;
    }
  }

  // Ensure position is within battlefield
  if (!isWithinBattlefield(finalPosition, battlefield)) {
    // Clamp to battlefield bounds
    finalPosition = {
      x: Math.max(0, Math.min(battlefield.width, finalPosition.x)),
      y: Math.max(0, Math.min(battlefield.height, finalPosition.y)),
    };
  }

  return {
    originalTarget: targetPosition,
    finalPosition,
    scatterDistance,
    scatterDirection: directionInfo.directionIndex,
    blocked,
    blockingBarrier,
    rollDownOccurred: rollDown.occurred,
    rollDownDistance: rollDown.rollDownDistance,
    misses,
  };
}

/**
 * Check if indirect attack arc is valid (QSR: midpoint rule)
 * There must exist a midpoint above the battlefield between attacker and target
 * which is no higher than the distance, with LOS to both.
 */
export function isValidIndirectArc(
  attackerPosition: Position,
  targetPosition: Position,
  battlefield: Battlefield,
  attackerHeight: number = 1.5,
  maxArcHeight?: number
): {
  valid: boolean;
  midpoint?: Position;
  arcHeight?: number;
  reason?: string;
} {
  // Calculate midpoint
  const midpoint: Position = {
    x: (attackerPosition.x + targetPosition.x) / 2,
    y: (attackerPosition.y + targetPosition.y) / 2,
  };

  // Calculate distance from attacker to target
  const distance = Math.sqrt(
    Math.pow(targetPosition.x - attackerPosition.x, 2) +
      Math.pow(targetPosition.y - attackerPosition.y, 2)
  );

  // Maximum arc height is the distance (QSR: no higher than distance)
  const maxAllowedHeight = maxArcHeight ?? distance;

  // Check terrain features at midpoint for blocking
  const isMidpointBlocked = battlefield.terrain.some(feature => {
    if (!feature.bounds) return false;
    const bounds = feature.bounds;
    return (
      midpoint.x >= bounds.x &&
      midpoint.x <= bounds.x + bounds.width &&
      midpoint.y >= bounds.y &&
      midpoint.y <= bounds.y + bounds.height &&
      (feature.type === 'Blocking' || feature.type === 'Impassable')
    );
  });
  
  if (isMidpointBlocked) {
    return {
      valid: false,
      midpoint,
      reason: 'Midpoint has blocking terrain',
    };
  }

  // Calculate required arc height (parabolic trajectory)
  // For simplicity, use half distance as minimum arc height
  const minArcHeight = distance * 0.5;

  if (minArcHeight > maxAllowedHeight) {
    return {
      valid: false,
      midpoint,
      arcHeight: minArcHeight,
      reason: `Required arc height (${minArcHeight.toFixed(1)} MU) exceeds maximum (${maxAllowedHeight.toFixed(1)} MU)`,
    };
  }

  return {
    valid: true,
    midpoint,
    arcHeight: minArcHeight,
  };
}
