/**
 * Intelligent Deployment Placer (QSR Phase 1.2)
 * 
 * Assigns deployment positions to models using:
 * - Greedy assignment algorithm
 * - Terrain-aware scoring
 * - Role-based positioning
 * - Doctrine-aware placement
 * 
 * Usage:
 * ```typescript
 * const placements = assignDeploymentPositions(side, battlefield, zones, objectives, doctrine);
 * ```
 */

import { Character } from '../core/Character';
import { Position } from '../battlefield/Position';
import { Battlefield } from '../battlefield/Battlefield';
import { DeploymentZone, DeploymentState, initializeDeployment, startDeployment, deployModel } from '../mission/deployment-system';
import { ObjectiveMarker } from '../mission/ObjectiveMarker';
import { LightingCondition } from '../utils/visibility';
import {
  evaluateDeploymentPosition,
  DeploymentDoctrine,
  DEFAULT_DOCTRINES
} from './DeploymentScorer';

// Re-export for convenience
export { DEFAULT_DOCTRINES };

export interface DeploymentPlacement {
  characterId: string;
  position: Position;
  score: number;
}

export interface DeploymentAssignment {
  sideId: string;
  placements: DeploymentPlacement[];
  success: boolean;
  error?: string;
}

/**
 * Generate candidate positions within a deployment zone
 */
export function generateCandidatePositions(
  zone: DeploymentZone,
  battlefield: Battlefield,
  gridSize: number = 1
): Position[] {
  const positions: Position[] = [];
  const { bounds } = zone;
  
  for (let x = bounds.x; x < bounds.x + bounds.width; x += gridSize) {
    for (let y = bounds.y; y < bounds.y + bounds.height; y += gridSize) {
      // Check if position is valid (not blocking terrain)
      const terrain = battlefield.getTerrainAt({ x, y });
      if (terrain.type !== 'blocking' && terrain.type !== 'impassable') {
        positions.push({ x, y });
      }
    }
  }
  
  return positions;
}

/**
 * Assign deployment positions to all models on a side
 * Uses greedy assignment: best position for each model in priority order
 */
export function assignDeploymentPositions(
  sideId: string,
  characters: Character[],
  battlefield: Battlefield,
  zones: DeploymentZone[],
  objectives: ObjectiveMarker[],
  doctrine: DeploymentDoctrine = DEFAULT_DOCTRINES.balanced,
  alreadyDeployed: Map<string, { characterId: string; sideId: string; position: Position }> = new Map(),
  lighting: LightingCondition = { name: 'Day, Clear', visibilityOR: 16 }
): DeploymentAssignment {
  const placements: DeploymentPlacement[] = [];
  const deployedModels = new Map(alreadyDeployed);

  // Sort characters by role priority (melee first, then ranged, then support)
  const sortedCharacters = sortCharactersByPriority(characters, doctrine);

  // Find valid zones for this side
  const validZones = zones.filter(z => z.sideId === sideId);
  if (validZones.length === 0) {
    return {
      sideId,
      placements: [],
      success: false,
      error: `No deployment zone found for side ${sideId}`,
    };
  }

  // Generate all candidate positions
  const allCandidates = validZones.flatMap(zone =>
    generateCandidatePositions(zone, battlefield)
  );

  // Greedy assignment: for each character, find best available position
  for (const character of sortedCharacters) {
    let bestPosition: Position | null = null;
    let bestScore = -Infinity;

    for (const position of allCandidates) {
      // Skip if position already taken
      const isTaken = Array.from(deployedModels.values()).some(
        m => Math.abs(m.position.x - position.x) < 0.5 &&
             Math.abs(m.position.y - position.y) < 0.5
      );

      if (isTaken) {
        continue;
      }

      // Evaluate position with Situational Awareness and Movement Cost
      const score = evaluateDeploymentPosition(
        position,
        character,
        battlefield,
        zones,
        objectives,
        deployedModels,
        doctrine,
        lighting
      );

      if (score.totalScore > bestScore) {
        bestScore = score.totalScore;
        bestPosition = position;
      }
    }
    
    if (bestPosition) {
      placements.push({
        characterId: character.id,
        position: bestPosition,
        score: bestScore,
      });
      
      // Mark position as taken
      deployedModels.set(character.id, {
        characterId: character.id,
        sideId,
        position: bestPosition,
      });
    }
  }
  
  return {
    sideId,
    placements,
    success: placements.length === characters.length,
    error: placements.length < characters.length 
      ? `Could only place ${placements.length}/${characters.length} models` 
      : undefined,
  };
}

/**
 * Sort characters by deployment priority
 * Melee characters first (need to be forward), then ranged, then support
 */
function sortCharactersByPriority(
  characters: Character[],
  doctrine: DeploymentDoctrine
): Character[] {
  return [...characters].sort((a, b) => {
    const aProfile = a.profile;
    const bProfile = b.profile;
    
    if (!aProfile || !bProfile) {
      return 0;
    }
    
    const aIsMelee = isMeleeCharacter(aProfile);
    const bIsMelee = isMeleeCharacter(bProfile);
    const aIsRanged = isRangedCharacter(aProfile);
    const bIsRanged = isRangedCharacter(bProfile);
    
    // High melee forward bias: melee first
    if (doctrine.meleeForwardBias > 0.5) {
      if (aIsMelee && !bIsMelee) return -1;
      if (bIsMelee && !aIsMelee) return 1;
    }
    
    // Low melee forward bias: ranged first (deploy rear)
    if (doctrine.meleeForwardBias < 0.5) {
      if (aIsRanged && !bIsRanged) return -1;
      if (bIsRanged && !aIsRanged) return 1;
    }
    
    // Default: melee first, then ranged, then support
    if (aIsMelee && !bIsMelee) return -1;
    if (bIsMelee && !aIsMelee) return 1;
    if (aIsRanged && !bIsRanged) return -1;
    if (bIsRanged && !aIsRanged) return 1;
    
    return 0;
  });
}

/**
 * Check if character is melee-focused
 */
function isMeleeCharacter(profile: any): boolean {
  const items = profile.items || profile.equipment || [];
  return items.some((item: any) => {
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
function isRangedCharacter(profile: any): boolean {
  const items = profile.items || profile.equipment || [];
  return items.some((item: any) => {
    const classification = (item.classification || item.class || '').toLowerCase();
    return classification.includes('ranged') ||
           classification.includes('bow') ||
           classification.includes('firearm') ||
           item.name?.toLowerCase().includes('bow') ||
           item.name?.toLowerCase().includes('rifle') ||
           item.name?.toLowerCase().includes('pistol');
  });
}

/**
 * Execute intelligent deployment for all sides
 * Uses alternating deployment per QSR rules
 */
export function executeIntelligentDeployment(
  sides: Array<{
    sideId: string;
    characters: Character[];
    doctrine?: DeploymentDoctrine;
  }>,
  battlefield: Battlefield,
  zones: DeploymentZone[],
  objectives: ObjectiveMarker[] = [],
  minDistanceBetweenOpponents: number = 6
): {
  success: boolean;
  error?: string;
  placements: Map<string, Position>;
  state?: any;
} {
  const allPlacements = new Map<string, Position>();
  const deployedModels = new Map<string, { characterId: string; sideId: string; position: Position }>();
  
  // Initialize deployment state
  const sideIds = sides.map(s => s.sideId);
  let state = initializeDeployment(
    sides.map(s => ({ 
      id: s.sideId, 
      members: s.characters.map(c => ({ id: c.id, character: c })) 
    })) as any,
    {
      battlefieldWidth: battlefield.width,
      battlefieldHeight: battlefield.height,
      minDistanceBetweenOpponents,
    }
  );
  state = startDeployment(state);
  
  // Alternating deployment
  const totalModels = sides.reduce((sum, s) => sum + s.characters.length, 0);
  let deployed = 0;
  
  while (deployed < totalModels && state.phase === 'deploying') {
    const currentSideId = state.activeSideId!;
    const side = sides.find(s => s.sideId === currentSideId);
    
    if (!side) {
      return {
        success: false,
        error: `Side ${currentSideId} not found`,
        placements: allPlacements,
      };
    }
    
    // Get next character to deploy
    const remaining = state.remainingModels.get(currentSideId) || [];
    if (remaining.length === 0) {
      break;
    }
    
    const characterId = remaining[0];
    const character = side.characters.find(c => c.id === characterId);
    
    if (!character) {
      return {
        success: false,
        error: `Character ${characterId} not found`,
        placements: allPlacements,
      };
    }
    
    // Find best position for this character
    const assignment = assignDeploymentPositions(
      currentSideId,
      [character],
      battlefield,
      zones,
      objectives,
      side.doctrine || DEFAULT_DOCTRINES.balanced,
      deployedModels
    );
    
    if (!assignment.success || assignment.placements.length === 0) {
      return {
        success: false,
        error: assignment.error || 'Failed to find valid position',
        placements: allPlacements,
      };
    }
    
    const placement = assignment.placements[0];
    
    // Validate minimum distance
    const distanceValid = validateMinimumDistance(
      placement.position,
      currentSideId,
      deployedModels,
      minDistanceBetweenOpponents
    );
    
    if (!distanceValid.valid) {
      // Try to find alternative position
      const altPosition = findAlternativePosition(
        placement.position,
        currentSideId,
        battlefield,
        zones,
        deployedModels,
        minDistanceBetweenOpponents
      );
      
      if (altPosition) {
        placement.position = altPosition;
      } else {
        return {
          success: false,
          error: `No valid position for ${characterId}: ${distanceValid.reason}`,
          placements: allPlacements,
        };
      }
    }
    
    // Place the model
    allPlacements.set(characterId, placement.position);
    deployedModels.set(characterId, {
      characterId,
      sideId: currentSideId,
      position: placement.position,
    });
    
    // Update state (simulate deployModel call)
    const validZones = zones.filter(z => z.sideId === currentSideId);
    const result = deployModel(
      state,
      characterId,
      currentSideId,
      placement.position,
      validZones,
      battlefield
    );
    
    if (result.state) {
      state = result.state;
    } else if (result.success) {
      // Manual state update
      state.deployedModels.set(characterId, {
        characterId,
        sideId: currentSideId,
        position: placement.position,
      });
      state.remainingModels.set(
        currentSideId,
        state.remainingModels.get(currentSideId)!.filter(id => id !== characterId)
      );
      
      if (state.isAlternating) {
        state.currentIndex = (state.currentIndex + 1) % state.deploymentOrder.length;
        state.activeSideId = state.deploymentOrder[state.currentIndex];
      }
      
      const allDeployed = Array.from(state.remainingModels.values()).every(m => m.length === 0);
      if (allDeployed) {
        state.phase = 'complete';
        state.activeSideId = undefined;
      }
    }
    
    deployed++;
  }
  
  return {
    success: state.phase === 'complete',
    placements: allPlacements,
    state,
  };
}

/**
 * Validate minimum distance from opposing models
 */
function validateMinimumDistance(
  position: Position,
  sideId: string,
  deployedModels: Map<string, { characterId: string; sideId: string; position: Position }>,
  minDistance: number
): { valid: boolean; reason?: string } {
  for (const [key, model] of deployedModels.entries()) {
    if (model.sideId === sideId) {
      continue; // Skip same-side models
    }
    
    const dx = position.x - model.position.x;
    const dy = position.y - model.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < minDistance) {
      return {
        valid: false,
        reason: `Too close to ${model.characterId} (${distance.toFixed(1)}" < ${minDistance}")`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Find alternative position if primary is invalid
 */
function findAlternativePosition(
  primaryPosition: Position,
  sideId: string,
  battlefield: Battlefield,
  zones: DeploymentZone[],
  deployedModels: Map<string, { characterId: string; sideId: string; position: Position }>,
  minDistance: number
): Position | null {
  const validZones = zones.filter(z => z.sideId === sideId);
  const candidates = validZones.flatMap(zone => 
    generateCandidatePositions(zone, battlefield, 2) // Coarser grid for speed
  );
  
  // Sort by distance from primary position (prefer close alternatives)
  candidates.sort((a, b) => {
    const distA = Math.sqrt((a.x - primaryPosition.x) ** 2 + (a.y - primaryPosition.y) ** 2);
    const distB = Math.sqrt((b.x - primaryPosition.x) ** 2 + (b.y - primaryPosition.y) ** 2);
    return distA - distB;
  });
  
  for (const position of candidates) {
    const distanceValid = validateMinimumDistance(position, sideId, deployedModels, minDistance);
    if (distanceValid.valid) {
      return position;
    }
  }
  
  return null;
}
