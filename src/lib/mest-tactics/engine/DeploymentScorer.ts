/**
 * Intelligent Deployment Scoring System (QSR Phase 1.2)
 * 
 * Evaluates deployment positions based on:
 * - Terrain cover quality
 * - Objective proximity
 * - Line of Sight to key areas
 * - Role alignment (melee forward, ranged rear)
 * - Squad cohesion
 * - Movement cost (Rough, Difficult terrain)
 * - Situational Awareness (Visibility OR ×3 Attentive, ×1 Distracted)
 * 
 * Per QSR deployment rules: models deploy within 6" of battlefield edge,
 * with terrain awareness and tactical positioning.
 */

import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Position } from '../battlefield/Position';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/Terrain';
import { LightingCondition, type LightingConditionLike, getVisibilityOR } from '../utils/visibility';
import { DeploymentZone } from '../mission/deployment-system';
import { ObjectiveMarker } from '../mission/objective-markers';

export interface DeploymentScore {
  /** Total weighted score (higher = better) */
  totalScore: number;
  /** Cover quality score (0-10) */
  coverScore: number;
  /** Distance to nearest objective (0-10, closer = higher) */
  objectiveProximity: number;
  /** LOS quality to key areas (0-10) */
  losQuality: number;
  /** Role alignment (melee forward, ranged rear) (0-10) */
  roleAlignment: number;
  /** Squad cohesion maintenance (0-10) */
  cohesionScore: number;
  /** Movement cost (0-10) */
  movementCost: number;
  /** Detailed breakdown for debugging */
  breakdown: {
    coverDetails: string;
    objectiveDetails: string;
    losDetails: string;
    roleDetails: string;
    cohesionDetails: string;
  };
}

export interface DeploymentDoctrine {
  /** How far forward to deploy melee (0 = back, 1 = forward) */
  meleeForwardBias: number;
  /** Priority on objective proximity (0-1) */
  objectiveRush: number;
  /** Cover vs. mobility trade-off (0 = mobility, 1 = cover) */
  coverPreference: number;
  /** Deploy deeper in zone (0 = edge, 1 = deep) */
  depthDeployment: number;
  /** Aggressive forward deployment (0 = conservative, 1 = aggressive) */
  aggression: number;
}

/**
 * Default deployment doctrines per tactical approach
 */
export const DEFAULT_DOCTRINES: Record<string, DeploymentDoctrine> = {
  balanced: {
    meleeForwardBias: 0.5,
    objectiveRush: 0.5,
    coverPreference: 0.5,
    depthDeployment: 0.5,
    aggression: 0.5,
  },
  aggressive: {
    meleeForwardBias: 0.8,
    objectiveRush: 0.7,
    coverPreference: 0.3,
    depthDeployment: 0.7,
    aggression: 0.8,
  },
  defensive: {
    meleeForwardBias: 0.3,
    objectiveRush: 0.3,
    coverPreference: 0.8,
    depthDeployment: 0.3,
    aggression: 0.2,
  },
  objective: {
    meleeForwardBias: 0.5,
    objectiveRush: 0.9,
    coverPreference: 0.4,
    depthDeployment: 0.6,
    aggression: 0.5,
  },
};

/**
 * Evaluate a deployment position for a character
 */
export function evaluateDeploymentPosition(
  position: Position,
  character: Character,
  battlefield: Battlefield,
  zones: DeploymentZone[],
  objectives: ObjectiveMarker[],
  deployedModels: Map<string, { characterId: string; sideId: string; position: Position }>,
  doctrine: DeploymentDoctrine = DEFAULT_DOCTRINES.balanced,
  lighting: LightingConditionLike = { name: 'Day, Clear', visibilityOR: 16 }
): DeploymentScore {
  const profile = character.profile;

  // 1. Cover Score (0-10)
  const coverScore = evaluateCover(position, battlefield, doctrine);

  // 2. Objective Proximity (0-10)
  const objectiveProximity = evaluateObjectiveProximity(position, objectives, doctrine);

  // 3. LOS Quality (0-10) - includes Situational Awareness
  const losQuality = evaluateLOSQuality(position, battlefield, doctrine, lighting as any, character);

  // 4. Role Alignment (0-10)
  const roleAlignment = evaluateRoleAlignment(position, character, profile, battlefield, doctrine);

  // 5. Squad Cohesion (0-10) - QSR: visibility-based cohesion
  const cohesionScore = evaluateCohesion(position, character, deployedModels, doctrine, getVisibilityOR(lighting));

  // 6. Movement Cost (0-10) - NEW: Terrain movement penalty
  const movementCost = evaluateMovementCost(position, battlefield, doctrine);

  // Weighted total (weights can be tuned)
  const weights = {
    cover: 0.20 * doctrine.coverPreference + 0.10,
    objective: 0.20 * doctrine.objectiveRush + 0.08,
    los: 0.20,
    role: 0.15,
    cohesion: 0.12,
    movement: 0.15, // NEW weight for movement cost
  };

  // Normalize weights to sum to 1
  const totalWeight = weights.cover + weights.objective + weights.los + weights.role + weights.cohesion + weights.movement;
  weights.cover /= totalWeight;
  weights.objective /= totalWeight;
  weights.los /= totalWeight;
  weights.role /= totalWeight;
  weights.cohesion /= totalWeight;
  weights.movement /= totalWeight;

  const totalScore =
    coverScore * weights.cover +
    objectiveProximity * weights.objective +
    losQuality * weights.los +
    roleAlignment * weights.role +
    cohesionScore * weights.cohesion +
    movementCost * weights.movement;
  
  return {
    totalScore,
    coverScore,
    objectiveProximity,
    losQuality,
    roleAlignment,
    cohesionScore,
    movementCost,
    breakdown: {
      coverDetails: `Cover: ${coverScore.toFixed(1)}/10 (preference: ${doctrine.coverPreference})`,
      objectiveDetails: `Objective: ${objectiveProximity.toFixed(1)}/10 (rush: ${doctrine.objectiveRush})`,
      losDetails: `LOS: ${losQuality.toFixed(1)}/10 (Visibility OR: ${getVisibilityOR(lighting)} MU)`,
      roleDetails: `Role: ${roleAlignment.toFixed(1)}/10 (forward bias: ${doctrine.meleeForwardBias})`,
      cohesionDetails: `Cohesion: ${cohesionScore.toFixed(1)}/10`,
    } as any,
  };
}

/**
 * Evaluate cover quality at position
 */
function evaluateCover(
  position: Position,
  battlefield: Battlefield,
  doctrine: DeploymentDoctrine
): number {
  const terrain = battlefield.getTerrainAt(position);

  // Base score from terrain type
  let coverScore = 5; // Default neutral

  if (terrain.type === TerrainType.Obstacle || terrain.type === TerrainType.Impassable) {
    coverScore = 9;
  } else if (terrain.type === TerrainType.Rough) {
    coverScore = 7;
  } else if (terrain.type === TerrainType.Difficult) {
    coverScore = 4; // Difficult terrain may hinder movement
  } else if (terrain.type === TerrainType.Clear) {
    coverScore = 3; // No cover
  }
  
  // Adjust based on doctrine preference
  if (doctrine.coverPreference > 0.7) {
    // High cover preference: amplify cover scores
    coverScore = Math.min(10, coverScore * 1.2);
  } else if (doctrine.coverPreference < 0.3) {
    // Low cover preference: value mobility over cover
    coverScore = 10 - coverScore; // Invert
  }
  
  return Math.max(0, Math.min(10, coverScore));
}

/**
 * Evaluate distance to objectives
 */
function evaluateObjectiveProximity(
  position: Position,
  objectives: ObjectiveMarker[],
  doctrine: DeploymentDoctrine
): number {
  if (objectives.length === 0) {
    return 5; // Neutral if no objectives
  }
  
  // Find nearest objective
  let minDistance = Infinity;
  for (const obj of objectives) {
    if (obj.position) {
      const dx = position.x - obj.position.x;
      const dy = position.y - obj.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      minDistance = Math.min(minDistance, distance);
    }
  }
  
  if (minDistance === Infinity) {
    return 5;
  }
  
  // Score: closer = higher (max 10 at distance 0, min 0 at distance 24+)
  let score = 10 - (minDistance / 24) * 10;
  
  // Amplify based on objective rush doctrine
  score *= (0.5 + doctrine.objectiveRush);
  
  return Math.max(0, Math.min(10, score));
}

/**
 * Evaluate LOS quality to key areas
 * QSR: Situational Awareness - Visibility OR ×3 when Attentive, ×1 when Distracted
 */
function evaluateLOSQuality(
  position: Position,
  battlefield: Battlefield,
  doctrine: DeploymentDoctrine,
  lighting: LightingCondition,
  character: Character
): number {
  // QSR Situational Awareness: Visibility multiplier based on status
  // - Attentive + Ordered: Visibility × 3
  // - Distracted: Visibility × 1
  // - Default (Ready): Visibility × 2
  let awarenessMultiplier = 2;
  if (character.state.isAttentive && character.state.isOrdered) {
    awarenessMultiplier = 3;
  } else if (character.state.delayTokens > 0) {
    // Distracted (has Delay tokens)
    awarenessMultiplier = 1;
  }

  const effectiveVisibilityOR = getVisibilityOR(lighting) * awarenessMultiplier;
  
  // LOS quality: count how many directions are visible within effective range
  const checkDistances = [8, 16, 24].filter(d => d <= effectiveVisibilityOR);
  
  let visibleCount = 0;
  let totalCount = 0;

  for (const distance of checkDistances) {
    // Check 8 directions (cardinal + diagonal)
    const directions = [
      { x: position.x + distance, y: position.y },
      { x: position.x - distance, y: position.y },
      { x: position.x, y: position.y + distance },
      { x: position.x, y: position.y - distance },
      { x: position.x + distance, y: position.y + distance },
      { x: position.x - distance, y: position.y - distance },
      { x: position.x + distance, y: position.y - distance },
      { x: position.x - distance, y: position.y + distance },
    ];

    for (const dir of directions) {
      if (dir.x >= 0 && dir.x < battlefield.width &&
          dir.y >= 0 && dir.y < battlefield.height) {
        totalCount++;
        // Check if LOS is clear (not blocked by terrain)
        const terrain = battlefield.getTerrainAt(dir);
        if (terrain.type !== TerrainType.Obstacle && terrain.type !== TerrainType.Impassable) {
          visibleCount++;
        }
      }
    }
  }

  if (totalCount === 0) {
    return 5;
  }

  // Bonus for Attentive status (better awareness)
  const baseScore = (visibleCount / totalCount) * 10;
  const awarenessBonus = character.state.isAttentive ? 1 : 0;
  
  return Math.max(0, Math.min(10, baseScore + awarenessBonus));
}

/**
 * Evaluate movement cost from position
 * QSR: Terrain affects movement - Rough/Difficult costs 2× per MU
 */
function evaluateMovementCost(
  position: Position,
  battlefield: Battlefield,
  doctrine: DeploymentDoctrine
): number {
  const terrain = battlefield.getTerrainAt(position);

  // Base score from terrain movement cost
  let movementScore = 10; // Default clear terrain

  if (terrain.type === TerrainType.Impassable) {
    return 0; // Should be filtered out, but safety check
  } else if (terrain.type === TerrainType.Difficult) {
    movementScore = 3; // 2× movement cost, hard to maneuver
  } else if (terrain.type === TerrainType.Rough) {
    movementScore = 7; // 2× movement cost
  } else if (terrain.type === TerrainType.Obstacle) {
    movementScore = 1; // Can't move through
  }
  
  // Doctrine adjustment: aggressive doctrines value mobility more
  if (doctrine.aggression > 0.7) {
    // High aggression: penalize difficult terrain more
    movementScore *= 0.8;
  } else if (doctrine.coverPreference > 0.7) {
    // Defensive: willing to accept difficult terrain for cover
    movementScore = Math.min(10, movementScore * 1.2);
  }
  
  return Math.max(0, Math.min(10, movementScore));
}

/**
 * Evaluate role alignment (melee forward, ranged rear)
 */
function evaluateRoleAlignment(
  position: Position,
  character: Character,
  profile: Profile | undefined,
  battlefield: Battlefield,
  doctrine: DeploymentDoctrine
): number {
  if (!profile) {
    return 5; // Neutral if no profile
  }
  
  // Determine if character is melee or ranged focused
  const isMelee = isMeleeCharacter(profile);
  const isRanged = isRangedCharacter(profile);
  
  // Calculate position depth in deployment zone
  const zoneDepth = position.y / battlefield.height; // 0 = top, 1 = bottom
  
  if (isMelee && !isRanged) {
    // Melee: prefer forward positions
    const idealDepth = doctrine.meleeForwardBias; // 0-1
    const depthScore = 10 - Math.abs(zoneDepth - idealDepth) * 10;
    return Math.max(0, Math.min(10, depthScore));
  } else if (isRanged && !isMelee) {
    // Ranged: prefer rear positions
    const idealDepth = 1 - doctrine.meleeForwardBias;
    const depthScore = 10 - Math.abs(zoneDepth - idealDepth) * 10;
    return Math.max(0, Math.min(10, depthScore));
  } else {
    // Hybrid: neutral
    return 5;
  }
}

/**
 * Evaluate squad cohesion
 * QSR: Cohesion = half Visibility OR (max 8 MU), ideal deployment spacing
 */
function evaluateCohesion(
  position: Position,
  character: Character,
  deployedModels: Map<string, { characterId: string; sideId: string; position: Position }>,
  doctrine: DeploymentDoctrine,
  visibilityOrMu: number = 16 // Default: Day Clear
): number {
  // Find same-side deployed models
  const sameSideModels = Array.from(deployedModels.values())
    .filter(m => m.characterId !== character.id);

  if (sameSideModels.length === 0) {
    return 5; // No models deployed yet
  }

  // Calculate average distance to same-side models
  let totalDistance = 0;
  let minDistance = Infinity;

  for (const model of sameSideModels) {
    const dx = position.x - model.position.x;
    const dy = position.y - model.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    totalDistance += distance;
    minDistance = Math.min(minDistance, distance);
  }

  const avgDistance = totalDistance / sameSideModels.length;

  // QSR: Ideal cohesion = visibilityOR / 4 to visibilityOR / 2 (max 8 MU)
  const minCohesion = visibilityOrMu / 4;
  const maxCohesion = Math.min(8, visibilityOrMu / 2);
  
  let cohesionScore = 5;
  if (avgDistance >= minCohesion && avgDistance <= maxCohesion) {
    cohesionScore = 10;
  } else if (avgDistance < minCohesion) {
    // Too clustered
    cohesionScore = 10 - (minCohesion - avgDistance) * 2;
  } else {
    // Too spread
    cohesionScore = 10 - (avgDistance - maxCohesion) * 0.5;
  }

  return Math.max(0, Math.min(10, cohesionScore));
}

/**
 * Check if character is melee-focused
 */
function isMeleeCharacter(profile: Profile): boolean {
  const items = profile.items || profile.equipment || [];
  return items.some(item => {
    const classification = (item.classification || item.class || '').toLowerCase();
    return classification.includes('melee') || 
           classification.includes('natural') ||
           item.name?.toLowerCase().includes('sword') ||
           item.name?.toLowerCase().includes('axe') ||
           item.name?.toLowerCase().includes('spear');
  });
}

/**
 * Check if character is ranged-focused
 */
function isRangedCharacter(profile: Profile): boolean {
  const items = profile.items || profile.equipment || [];
  return items.some(item => {
    const classification = (item.classification || item.class || '').toLowerCase();
    return classification.includes('ranged') ||
           classification.includes('bow') ||
           classification.includes('firearm') ||
           item.name?.toLowerCase().includes('bow') ||
           item.name?.toLowerCase().includes('rifle') ||
           item.name?.toLowerCase().includes('pistol');
  });
}
