/**
 * Gap Detection Utility (QSR Phase 2.4)
 *
 * Detects gaps between terrain features that can be jumped across.
 * Used for AI tactical awareness of jump opportunities.
 *
 * QSR Reference:
 * - Running Jump: Bonus agility = 1/4 of straight distance moved
 * - Jump Across: Up to Agility (if Attentive)
 * - For every 1 MU down, allow +0.5 MU across
 * - Leap X: Increase Agility by +X MU
 */

import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { TerrainElement } from './terrain/TerrainElement';
import { TERRAIN_HEIGHTS } from './terrain/TerrainElement';

export interface GapInfo {
  /** Start position of gap (edge of terrain A) */
  startPos: Position;
  /** End position of gap (edge of terrain B) */
  endPos: Position;
  /** Gap width in MU */
  width: number;
  /** Height at start (for downward jump bonus) */
  startHeight: number;
  /** Height at end (for landing) */
  endHeight: number;
  /** Terrain type at start */
  startTerrain: string;
  /** Terrain type at end */
  endTerrain: string;
  /** Is this gap jumpable (based on typical MOV 4 character)? */
  isJumpable: boolean;
  /** Is this a wall-to-wall gap? */
  isWallToWall: boolean;
}

export interface JumpCapability {
  /** Character's base Agility */
  agility: number;
  /** Leap X trait bonus */
  leapBonus: number;
  /** Running start bonus (if applicable) */
  runningBonus: number;
  /** Downward jump bonus (if applicable) */
  downwardBonus: number;
  /** Maximum jump range */
  maxRange: number;
}

/**
 * Get terrain height per OVR-003
 */
function getTerrainHeight(terrainName: string): number {
  if (!terrainName) return 0;
  const heightData = TERRAIN_HEIGHTS[terrainName.toLowerCase()];
  return heightData?.height ?? 0;
}

/**
 * Check if terrain is a wall or elevated surface
 */
function isElevatedTerrain(terrainName: string): boolean {
  if (!terrainName) return false;
  const name = terrainName.toLowerCase();
  return name.includes('wall') || 
         name.includes('building') || 
         name.includes('rocky') ||
         name.includes('cliff');
}

/**
 * Detect gaps along a line between two positions
 * QSR: Gaps are impassable terrain between walkable surfaces
 */
export function detectGapAlongLine(
  battlefield: Battlefield,
  from: Position,
  to: Position,
  stepSize: number = 0.5
): GapInfo | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  
  if (distance < 0.1) return null;
  
  const steps = Math.ceil(distance / stepSize);
  const stepX = dx / steps;
  const stepY = dy / steps;
  
  let inGap = false;
  let gapStart: Position | null = null;
  let gapEnd: Position | null = null;
  let startTerrain = '';
  let endTerrain = '';
  
  for (let i = 0; i <= steps; i++) {
    const x = from.x + stepX * i;
    const y = from.y + stepY * i;
    const pos = { x, y };
    
    const terrain = battlefield.getTerrainAt(pos);
    const isWalkable = isWalkableTerrain(terrain as any);
    
    if (!inGap && !isWalkable) {
      // Entering gap
      inGap = true;
      gapStart = i > 0
        ? { x: from.x + stepX * (i - 1), y: from.y + stepY * (i - 1) }
        : from;
      startTerrain = i > 0
        ? (battlefield.getTerrainAt({ x: from.x + stepX * (i - 1), y: from.y + stepY * (i - 1) }) as any).name
        : 'start';
    } else if (inGap && isWalkable) {
      // Exiting gap
      inGap = false;
      gapEnd = pos;
      endTerrain = (terrain as any).name;
      break;
    }
  }

  // If we ended in a gap, the end position is the target
  if (inGap && gapStart) {
    gapEnd = to;
    endTerrain = (battlefield.getTerrainAt(to) as any).name;
  }
  
  if (!gapStart || !gapEnd) return null;
  
  const width = Math.hypot(gapEnd.x - gapStart.x, gapEnd.y - gapStart.y);
  const startHeight = getTerrainHeight(startTerrain);
  const endHeight = getTerrainHeight(endTerrain);
  
  // Typical jump capability for MOV 4 character: ~3 MU
  const isJumpable = width <= 3.0;
  
  // Wall-to-wall if both sides are elevated
  const isWallToWall = isElevatedTerrain(startTerrain) && isElevatedTerrain(endTerrain);
  
  return {
    startPos: gapStart,
    endPos: gapEnd,
    width,
    startHeight,
    endHeight,
    startTerrain,
    endTerrain,
    isJumpable,
    isWallToWall,
  };
}

/**
 * Check if terrain is walkable
 */
function isWalkableTerrain(terrain: TerrainElement | null): boolean {
  if (!terrain || !terrain.info) return false;
  
  // Impassable terrain creates gaps
  if (terrain.info.movement === 'Impassable') return false;
  
  // Blocking LOS terrain may create gaps (walls, buildings)
  if (terrain.info.los === 'Blocking') {
    // But some blocking terrain can be stood upon (walls, rocky)
    const height = getTerrainHeight(terrain.name as any);
    return height > 0; // Can stand on top
  }
  
  return true;
}

/**
 * Calculate jump capability for a character
 * QSR: Max Jump = Agility + Leap Bonus + Running Bonus + Downward Bonus
 */
export function calculateJumpCapability(
  agility: number,
  leapBonus: number = 0,
  hasRunningStart: boolean = false,
  fallDistance: number = 0
): JumpCapability {
  // Running start: +1 MU per 4 MU run (simplified: +2 MU)
  const runningBonus = hasRunningStart ? 2 : 0;
  
  // Downward jump: +0.5 MU across per 1 MU down
  const downwardBonus = fallDistance * 0.5;
  
  const maxRange = agility + leapBonus + runningBonus + downwardBonus;
  
  return {
    agility,
    leapBonus,
    runningBonus,
    downwardBonus,
    maxRange,
  };
}

/**
 * Check if character can jump across a gap
 */
export function canJumpGap(
  gap: GapInfo,
  agility: number,
  leapBonus: number = 0,
  hasRunningStart: boolean = false
): boolean {
  const fallDistance = gap.startHeight - gap.endHeight;
  const capability = calculateJumpCapability(agility, leapBonus, hasRunningStart, fallDistance);
  
  return gap.width <= capability.maxRange;
}

/**
 * Find all gaps around a position within range
 */
export function findGapsAroundPosition(
  battlefield: Battlefield,
  position: Position,
  range: number = 8,
  numDirections: number = 8
): GapInfo[] {
  const gaps: GapInfo[] = [];
  
  for (let i = 0; i < numDirections; i++) {
    const angle = (i / numDirections) * 2 * Math.PI;
    const target = {
      x: position.x + Math.cos(angle) * range,
      y: position.y + Math.sin(angle) * range,
    };
    
    const gap = detectGapAlongLine(battlefield, position, target);
    if (gap && gap.width > 0.5) { // Only significant gaps
      gaps.push(gap);
    }
  }
  
  return gaps;
}

/**
 * Get tactical value of a gap for AI scoring
 * Higher value = more tactically significant
 */
export function getGapTacticalValue(gap: GapInfo): number {
  let score = 0;
  
  // Wall-to-wall gaps are tactically important (chokepoints)
  if (gap.isWallToWall) {
    score += 5;
  }
  
  // Jumpable gaps are opportunities
  if (gap.isJumpable) {
    score += 3;
  }
  
  // Height difference adds tactical value (defensive position)
  if (gap.startHeight > gap.endHeight) {
    score += 2;
  }
  
  // Narrow gaps are easier to cross
  if (gap.width < 2) {
    score += 1;
  }
  
  return score;
}
