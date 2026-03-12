/**
 * ROF and Suppression Spatial Management
 * 
 * Handles spatial geometry for:
 * - ROF marker placement along LOF with Cohesion spacing
 * - Suppression marker area effects (1" range)
 * - Core Damage vs Core Defense calculation
 * - Crossing Suppression detection
 * - Firelane Field-of-Fire (FOF) tracking
 * 
 * Source: rules-advanced-rof.md, rules-advanced-suppression.md, rules-advanced-firelane.md
 */

import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { getCharacterTraitLevel } from '../status/status-system';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { SpatialRules, type CoverResult } from '../battlefield/spatial/spatial-rules';
import { TerrainType } from '../battlefield/terrain/Terrain';
import { pointInPolygon, segmentPolygonIntersections } from '../battlefield/terrain/BattlefieldUtils';
import { resolveUnopposedTest } from '../subroutines/dice-roller';

// Helper to create SpatialModel from Position
function createSpatialModel(position: Position, siz: number = 3) {
  return {
    id: 'temp',
    position,
    baseDiameter: getBaseDiameterFromSiz(siz),
    siz,
  };
}

function isHardCoverFeature(feature: { type?: TerrainType | string; los?: string; meta?: { los?: string } } | undefined): boolean {
  if (!feature) return false;
  if (feature.type === TerrainType.Obstacle || feature.type === TerrainType.Blocking) {
    return true;
  }

  const losHint = String(feature.meta?.los ?? feature.los ?? '').toLowerCase();
  return losHint.includes('block') || losHint.includes('hard');
}

function isBlockedByHardCover(result: CoverResult): boolean {
  if (!result.hasLOS && isHardCoverFeature(result.blockingFeature)) {
    return true;
  }

  // Suppression extends through Soft Cover but not Hard Cover, even when LOS still exists.
  const hardCoverOnPath = [
    ...result.directCoverFeatures,
    ...result.interveningCoverFeatures,
  ].some(feature => isHardCoverFeature(feature));
  return hardCoverOnPath;
}

function isSuppressionPathBlockedByHardCover(
  battlefield: Battlefield,
  source: Position,
  target: Position
): boolean {
  const sourceModel = createSpatialModel(source);
  const targetModel = createSpatialModel(target);
  const coverResult = SpatialRules.getCoverResult(battlefield, sourceModel, targetModel);
  if (isBlockedByHardCover(coverResult)) {
    return true;
  }

  // Fallback geometric check: any hard-cover feature intersecting/containing the segment
  // blocks suppression propagation between the marker and character.
  for (const feature of battlefield.terrain) {
    if (!isHardCoverFeature(feature)) continue;

    const sourceInside = pointInPolygon(source, feature.vertices);
    const targetInside = pointInPolygon(target, feature.vertices);
    if (sourceInside || targetInside) {
      return true;
    }

    const intersections = segmentPolygonIntersections(source, target, feature.vertices);
    if (intersections.length > 0) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ROFMarker {
  id: string;
  position: Position;
  /** Which character created this marker */
  creatorId: string;
  /** Initiative when created */
  initiativeCreated: number;
  /** Whether flipped to Suppression side */
  isSuppression: boolean;
}

export interface SuppressionMarker {
  id: string;
  position: Position;
  /** Suppression range (1" = 1 MU) */
  range: number;
  /** Which character created this marker */
  creatorId: string;
}

export interface SuppressionEffect {
  /** Number of markers in range */
  markerCount: number;
  /** Suppression DR (1-4 based on marker count) */
  dr: number;
  /** Whether behind Hard Cover (negates suppression) */
  behindHardCover: boolean;
}

export interface CoreDamageDefense {
  coreDamage: number;
  coreDefense: number;
  ignoresSuppression: boolean;
}

export interface FieldOfFire {
  /** Center position of FOF */
  center: Position;
  /** Facing direction in degrees (0-360) */
  facing: number;
  /** Arc width in degrees (default 90) */
  arcWidth: number;
  /** Maximum range */
  maxRange: number;
}

export interface ROFPlacementResult {
  markers: ROFMarker[];
  primaryTargetId?: string;
  rofDiceBonus: number;
}

export interface SuppressionCrossingResult {
  isCrossing: boolean;
  moraleTestRequired: boolean;
  suppressionTestRequired: boolean;
  suppressionDR: number;
  markersInRange: number;
}

// ============================================================================
// ROF MARKER MANAGEMENT
// ============================================================================

/**
 * Get ROF level from character's weapon
 */
export function getROFLevel(character: Character): number {
  const equipment = character.profile?.equipment || character.profile?.items || [];
  for (const item of equipment) {
    for (const trait of item.traits || []) {
      const match = trait.match(/ROF\s*(\d+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }
  return 0;
}

/**
 * Calculate valid ROF marker positions along LOF
 * 
 * Rules:
 * - Place up to X ROF markers between targets within LOS along LOF
 * - Each marker must not be more than Cohesion apart from last one
 * - Markers must be within LOS, blocked by models
 * - Cannot place within range of Friendly models, Attacker, or target in base-contact with Friendly
 */
export function calculateROFMarkerPositions(
  attacker: Character,
  battlefield: Battlefield,
  rofLevel: number,
  primaryTarget: Character,
  cohesion: number = 4,
  allCharacters?: Character[]
): Position[] {
  const attackerPos = battlefield.getCharacterPosition(attacker);
  const targetPos = battlefield.getCharacterPosition(primaryTarget);
  
  if (!attackerPos || !targetPos) {
    return [];
  }

  const positions: Position[] = [];
  const maxMarkers = rofLevel;
  
  // Calculate LOF vector from attacker to target
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance === 0) {
    return [];
  }

  // Normalize direction
  const dirX = dx / distance;
  const dirY = dy / distance;

  // Place markers along LOF, spaced by cohesion
  // Start from attacker position, move toward target
  let currentDistance = 1; // Start 1 MU from attacker (range of effect)
  
  while (positions.length < maxMarkers && currentDistance < distance) {
    const x = attackerPos.x + dirX * currentDistance;
    const y = attackerPos.y + dirY * currentDistance;
    const position = { x, y };

    // Check LOS from attacker to this position
    const attackerModel = createSpatialModel(attackerPos);
    const positionModel = createSpatialModel(position);
    const hasLOS = SpatialRules.hasLineOfSight(battlefield, attackerModel, positionModel);
    if (!hasLOS) {
      currentDistance += 0.5;
      continue;
    }

    // Check not within 1" of Friendly models
    const battlefieldCharacters = allCharacters
      ?? ((battlefield as unknown as { getAllCharacters?: () => Character[] }).getAllCharacters?.() ?? []);
    const friendlyModels = battlefieldCharacters.filter(c =>
      c.id !== attacker.id && areAllies(attacker, c)
    );
    
    const nearFriendly = friendlyModels.some(friendly => {
      const friendlyPos = battlefield.getCharacterPosition(friendly);
      if (!friendlyPos) return false;
      const distToFriendly = distanceBetween(position, friendlyPos);
      return distToFriendly < 1; // 1" range of effect
    });

    if (nearFriendly) {
      currentDistance += 0.5;
      continue;
    }

    // Check not within 1" of attacker
    const distToAttacker = distanceBetween(position, attackerPos);
    if (distToAttacker < 1) {
      currentDistance += 0.5;
      continue;
    }

    positions.push(position);
    currentDistance += cohesion; // Space by cohesion
  }

  return positions;
}

/**
 * Check if models are allies
 */
function areAllies(char1: Character, char2: Character): boolean {
  if (char1.id === char2.id) {
    return true;
  }

  const side1 = getCharacterSideToken(char1);
  const side2 = getCharacterSideToken(char2);

  if (!side1 || !side2) {
    return false;
  }

  return side1 === side2;
}

/**
 * Resolve side/team token from common runtime metadata slots.
 * Keeps this helper decoupled from GameManager mission-side registries.
 */
function getCharacterSideToken(character: Character): string | null {
  const state = character.state as unknown as Record<string, unknown>;
  const profile = character.profile as unknown as Record<string, unknown>;
  const runtimeCharacter = character as unknown as Record<string, unknown>;

  const candidates = [
    runtimeCharacter.sideId,
    runtimeCharacter.side,
    runtimeCharacter.teamId,
    runtimeCharacter.team,
    runtimeCharacter.factionId,
    runtimeCharacter.faction,
    state?.sideId,
    state?.teamId,
    state?.factionId,
    profile?.sideId,
    profile?.side,
    profile?.teamId,
    profile?.team,
    profile?.factionId,
    profile?.faction,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

/**
 * Calculate distance between two positions
 */
function distanceBetween(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get ROF dice bonus for target based on markers in range
 */
export function getROFDiceBonus(
  target: Character,
  battlefield: Battlefield,
  rofMarkers: ROFMarker[]
): number {
  const targetPos = battlefield.getCharacterPosition(target);
  if (!targetPos) {
    return 0;
  }

  // Count markers within 1" of target
  const markersInRange = rofMarkers.filter(marker => {
    const dist = distanceBetween(marker.position, targetPos);
    return dist <= 1; // 1" range of effect
  });

  // Each marker provides +1 Wild die (ROF die)
  return markersInRange.length;
}

/**
 * Reduce ROF level for additional uses in same Initiative
 */
export function getEffectiveROFLevel(baseROF: number, usesThisInitiative: number): number {
  return Math.max(0, baseROF - usesThisInitiative);
}

// ============================================================================
// SUPPRESSION MARKER MANAGEMENT
// ============================================================================

/**
 * Calculate Suppression effect for character
 * 
 * Rules:
 * - Each Suppression marker has 1" range
 * - Extends through Soft Cover but not Hard Cover
 * - DR based on marker count: 1→1, 2→2, 5→3, 10+→4
 */
export function calculateSuppressionEffect(
  character: Character,
  battlefield: Battlefield,
  suppressionMarkers: SuppressionMarker[]
): SuppressionEffect {
  const characterPos = battlefield.getCharacterPosition(character);
  if (!characterPos) {
    return { markerCount: 0, dr: 0, behindHardCover: false };
  }

  let blockedByHardCoverCount = 0;

  // Count markers within 1" range that are not blocked by Hard Cover.
  const markersInRange = suppressionMarkers.filter(marker => {
    const dist = distanceBetween(marker.position, characterPos);
    if (dist > 1) return false;

    const blockedByHardCover = isSuppressionPathBlockedByHardCover(
      battlefield,
      marker.position,
      characterPos
    );
    if (blockedByHardCover) {
      blockedByHardCoverCount += 1;
      return false;
    }

    return true;
  });

  const markerCount = markersInRange.length;
  
  // Calculate DR: 1→1, 2→2, 5→3, 10+→4
  let dr = 0;
  if (markerCount >= 10) dr = 4;
  else if (markerCount >= 5) dr = 3;
  else if (markerCount >= 2) dr = 2;
  else if (markerCount >= 1) dr = 1;

  // Character is considered behind Hard Cover if in-range suppression exists, but every
  // in-range marker is blocked by Hard Cover.
  const behindHardCover = markerCount === 0 && blockedByHardCoverCount > 0;

  return {
    markerCount,
    dr,
    behindHardCover,
  };
}

/**
 * Check if character is crossing Suppression
 * 
 * Rules:
 * - Moving across or within 1" range, but not away from
 * - Performing any Action except Hide while within 1" range
 * - Being forcibly repositioned into Suppression range
 * - Characters merely involved in a Test are never Crossing
 */
export function checkSuppressionCrossing(
  character: Character,
  battlefield: Battlefield,
  suppressionMarkers: SuppressionMarker[],
  actionType: string,
  isMovingAway: boolean = false
): SuppressionCrossingResult {
  const characterPos = battlefield.getCharacterPosition(character);
  if (!characterPos) {
    return {
      isCrossing: false,
      moraleTestRequired: false,
      suppressionTestRequired: false,
      suppressionDR: 0,
      markersInRange: 0,
    };
  }

  // Get suppression effect
  const effect = calculateSuppressionEffect(character, battlefield, suppressionMarkers);
  
  if (effect.markerCount === 0) {
    return {
      isCrossing: false,
      moraleTestRequired: false,
      suppressionTestRequired: false,
      suppressionDR: 0,
      markersInRange: 0,
    };
  }

  // Determine if crossing
  let isCrossing = false;

  // Moving across or within (but not away)
  if (!isMovingAway && actionType === 'Move') {
    isCrossing = true;
  }

  // Performing action except Hide while within range
  if (actionType !== 'Hide' && actionType !== 'Move') {
    isCrossing = true;
  }

  // Characters merely involved in a Test are never Crossing
  if (actionType === 'Test') {
    isCrossing = false;
  }

  if (!isCrossing) {
    return {
      isCrossing: false,
      moraleTestRequired: false,
      suppressionTestRequired: false,
      suppressionDR: 0,
      markersInRange: effect.markerCount,
    };
  }

  // Morale test required for voluntary crossing
  const moraleTestRequired = actionType === 'Move' && !isMovingAway;
  
  // Suppression test required when crossing
  const suppressionTestRequired = isCrossing;

  return {
    isCrossing,
    moraleTestRequired,
    suppressionTestRequired,
    suppressionDR: effect.dr,
    markersInRange: effect.markerCount,
  };
}

// ============================================================================
// CORE DAMAGE VS CORE DEFENSE
// ============================================================================

/**
 * Calculate Core Damage and Core Defense for Suppression ignoring
 * 
 * Rules:
 * - Core Damage: flat value + number of dice of Damage Rating
 * - Core Defense: AR - Impact - 3 (Concentrate) - markers in range
 * - If Core Damage < Core Defense: ignore Suppression
 */
export function calculateCoreDamageDefense(
  attacker: Character,
  target: Character,
  weapon: { damage: string; impact: number },
  isConcentrate: boolean,
  markersInRange: number,
  battlefield: Battlefield
): CoreDamageDefense {
  // Parse damage rating (e.g., "STR+1w", "2+2m", "3")
  const damageRating = parseDamageRating(weapon.damage, attacker);
  
  // Core Damage = flat value + number of dice
  const coreDamage = damageRating.flatValue + damageRating.diceCount;

  // Get target's Armor Rating
  const targetAR = target.state.armor?.total || 0;
  
  // Core Defense = AR - Impact - Concentrate bonus - markers
  let coreDefense = targetAR;
  coreDefense -= weapon.impact;
  
  if (isConcentrate) {
    coreDefense -= 3;
  }
  
  coreDefense -= markersInRange;

  // Ensure minimum of 0
  coreDefense = Math.max(0, coreDefense);

  // Check if Suppression should be ignored
  const ignoresSuppression = coreDamage < coreDefense;

  return {
    coreDamage,
    coreDefense,
    ignoresSuppression,
  };
}

/**
 * Parse damage rating string
 */
function parseDamageRating(damageString: string, character: Character): { flatValue: number; diceCount: number } {
  // Examples: "STR", "STR+1w", "2+2m", "3", "2+1b"
  const result = { flatValue: 0, diceCount: 0 };
  
  if (!damageString) {
    return result;
  }

  // Get STR value if referenced
  const strValue = character.finalAttributes?.str ?? character.attributes?.str ?? 0;

  // Parse the damage string
  const parts = damageString.split('+');
  
  for (const part of parts) {
    const trimmed = part.trim().toLowerCase();
    
    if (trimmed === 'str') {
      result.flatValue += strValue;
    } else if (trimmed.startsWith('str')) {
      // STR with modifier (e.g., "STR+1" already split)
      result.flatValue += strValue;
    } else if (trimmed.includes('w')) {
      // Wild dice (e.g., "1w", "2w")
      const dice = parseInt(trimmed.replace('w', ''), 10);
      if (!isNaN(dice)) {
        result.diceCount += dice;
      }
    } else if (trimmed.includes('b')) {
      // Base dice (e.g., "1b", "2b")
      const dice = parseInt(trimmed.replace('b', ''), 10);
      if (!isNaN(dice)) {
        result.diceCount += dice;
      }
    } else if (trimmed.includes('m')) {
      // Modifier dice (e.g., "1m", "2m")
      const dice = parseInt(trimmed.replace('m', ''), 10);
      if (!isNaN(dice)) {
        result.diceCount += dice;
      }
    } else {
      // Flat number
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        result.flatValue += num;
      }
    }
  }

  return result;
}

// ============================================================================
// FIRELANE FIELD-OF-FIRE
// ============================================================================

/**
 * Check if position is within Field-of-Fire
 */
export function isWithinFieldOfFire(
  fof: FieldOfFire,
  position: Position,
  battlefield: Battlefield
): boolean {
  const dx = position.x - fof.center.x;
  const dy = position.y - fof.center.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Check range
  if (distance > fof.maxRange) {
    return false;
  }

  // Check angle
  const angleRad = Math.atan2(dy, dx);
  let angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
  
  // Calculate angle difference from facing
  let angleDiff = Math.abs(angleDeg - fof.facing);
  if (angleDiff > 180) {
    angleDiff = 360 - angleDiff;
  }

  // Check if within arc
  return angleDiff <= fof.arcWidth / 2;
}

/**
 * Create Field-of-Fire for Fire-lane weapon
 */
export function createFieldOfFire(
  gunner: Character,
  battlefield: Battlefield,
  facingDegrees: number,
  arcWidth: number = 90,
  maxRange: number = 16
): FieldOfFire {
  const position = battlefield.getCharacterPosition(gunner);
  
  if (!position) {
    return {
      center: { x: 0, y: 0 },
      facing: 0,
      arcWidth: 90,
      maxRange: 16,
    };
  }

  return {
    center: position,
    facing: facingDegrees,
    arcWidth,
    maxRange,
  };
}

/**
 * Get Suppressive Fire marker count for Fire-lane weapon
 */
export function getSuppressiveFireMarkerCount(
  gunner: Character,
  battlefield: Battlefield
): number {
  // Get ROF level from weapon
  const rofLevel = getROFLevel(gunner);
  
  // Check if Attentive (required for Suppressive Fire!)
  if (!gunner.state.isAttentive) {
    return 0;
  }

  return rofLevel;
}

// ============================================================================
// UI RENDERING API - 2D Visualization Data
// ============================================================================

/**
 * ROF marker visualization data for 2D rendering
 */
export interface ROFMarkerVisualization {
  /** Unique marker ID */
  id: string;
  /** Position for rendering (x, y in MU) */
  position: { x: number; y: number };
  /** Marker type: 'rof' or 'suppression' */
  type: 'rof' | 'suppression';
  /** Creator ID for coloring */
  creatorId: string;
  /** Range of effect circle (1" = 1 MU) */
  effectRadius: number;
  /** Whether this is the primary target marker */
  isPrimary: boolean;
  /** Initiative when created (for animation timing) */
  initiative: number;
}

/**
 * Suppression marker visualization data for 2D rendering
 */
export interface SuppressionMarkerVisualization {
  /** Unique marker ID */
  id: string;
  /** Position for rendering (x, y in MU) */
  position: { x: number; y: number };
  /** Suppression range circle (1" = 1 MU) */
  range: number;
  /** Suppression DR (1-4) for intensity coloring */
  dr: number;
  /** Creator ID for coloring */
  creatorId: string;
  /** Number of markers contributing to this DR */
  markerCount: number;
}

/**
 * Field-of-Fire visualization data for 2D rendering
 */
export interface FieldOfFireVisualization {
  /** Center position for rendering */
  center: { x: number; y: number };
  /** Facing direction in degrees (0 = east, 90 = north) */
  facingDegrees: number;
  /** Arc width in degrees (typically 90) */
  arcWidth: number;
  /** Maximum range for cone rendering */
  maxRange: number;
  /** Creator ID for coloring */
  creatorId: string;
  /** Status: 'braced' or 'emplaced' */
  status: 'braced' | 'emplaced';
  /** Suppression marker count for this FOF */
  suppressionCount: number;
}

/**
 * Suppression zone visualization for 2D rendering
 */
export interface SuppressionZoneVisualization {
  /** Zone center position */
  center: { x: number; y: number };
  /** Zone radius (1" = 1 MU) */
  radius: number;
  /** Suppression DR (1-4) for intensity */
  dr: number;
  /** Whether zone is blocked by Hard Cover */
  blockedByHardCover: boolean;
  /** Creator ID for coloring */
  creatorId: string;
}

/**
 * Get ROF marker visualization data for rendering
 */
export function getROFMarkerVisualization(
  markers: ROFMarker[],
  primaryTargetId?: string
): ROFMarkerVisualization[] {
  return markers.map(marker => ({
    id: marker.id,
    position: marker.position,
    type: marker.isSuppression ? 'suppression' : 'rof',
    creatorId: marker.creatorId,
    effectRadius: 1, // 1" range of effect
    isPrimary: false, // Primary is determined by target, not marker
    initiative: marker.initiativeCreated,
  }));
}

/**
 * Get Suppression marker visualization data for rendering
 */
export function getSuppressionMarkerVisualization(
  markers: SuppressionMarker[],
  battlefield: Battlefield
): SuppressionMarkerVisualization[] {
  // Group markers by position to calculate combined DR
  const grouped = new Map<string, SuppressionMarker[]>();
  
  for (const marker of markers) {
    const key = `${marker.position.x.toFixed(2)},${marker.position.y.toFixed(2)}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(marker);
  }

  const visualizations: SuppressionMarkerVisualization[] = [];
  
  for (const [key, groupMarkers] of grouped.entries()) {
    const [x, y] = key.split(',').map(Number);
    const markerCount = groupMarkers.length;
    
    // Calculate DR: 1→1, 2→2, 5→3, 10+→4
    let dr = 0;
    if (markerCount >= 10) dr = 4;
    else if (markerCount >= 5) dr = 3;
    else if (markerCount >= 2) dr = 2;
    else if (markerCount >= 1) dr = 1;

    visualizations.push({
      id: groupMarkers[0].id,
      position: { x, y },
      range: 1, // 1" suppression range
      dr,
      creatorId: groupMarkers[0].creatorId,
      markerCount,
    });
  }

  return visualizations;
}

/**
 * Get Field-of-Fire visualization data for 2D rendering
 * Returns cone/arc data suitable for SVG or Canvas rendering
 */
export function getFieldOfFireVisualization(
  fof: FieldOfFire,
  creatorId: string,
  status: 'braced' | 'emplaced',
  suppressionCount: number
): FieldOfFireVisualization {
  return {
    center: fof.center,
    facingDegrees: fof.facing,
    arcWidth: fof.arcWidth,
    maxRange: fof.maxRange,
    creatorId,
    status,
    suppressionCount,
  };
}

/**
 * Get Suppression zone visualization for a character's position
 * Combines all suppression markers affecting this position
 */
export function getSuppressionZoneVisualization(
  character: Character,
  battlefield: Battlefield,
  suppressionMarkers: SuppressionMarker[]
): SuppressionZoneVisualization | null {
  const characterPos = battlefield.getCharacterPosition(character);
  if (!characterPos) {
    return null;
  }

  const effect = calculateSuppressionEffect(character, battlefield, suppressionMarkers);
  
  if (effect.markerCount === 0) {
    return null;
  }

  // Find the center of suppression (average of marker positions)
  const markersInRange = suppressionMarkers.filter(marker => {
    const dist = distanceBetween(marker.position, characterPos);
    if (dist > 1) return false;
    
    const markerModel = createSpatialModel(marker.position);
    const characterModel = createSpatialModel(characterPos);
    const coverResult = SpatialRules.getCoverResult(battlefield, markerModel, characterModel);
    return !isBlockedByHardCover(coverResult);
  });

  if (markersInRange.length === 0) {
    return null;
  }

  // Calculate center of suppression zone
  const centerX = markersInRange.reduce((sum, m) => sum + m.position.x, 0) / markersInRange.length;
  const centerY = markersInRange.reduce((sum, m) => sum + m.position.y, 0) / markersInRange.length;

  return {
    center: { x: centerX, y: centerY },
    radius: 1, // 1" suppression range
    dr: effect.dr,
    blockedByHardCover: effect.behindHardCover,
    creatorId: markersInRange[0].creatorId,
  };
}

/**
 * Get complete battlefield visualization data for ROF/Suppression
 * Returns all data needed for 2D rendering in a single call
 */
export interface BattlefieldROFVisualization {
  rofMarkers: ROFMarkerVisualization[];
  suppressionMarkers: SuppressionMarkerVisualization[];
  firelanes: FieldOfFireVisualization[];
  suppressionZones: SuppressionZoneVisualization[];
}

export function getBattlefieldROFVisualization(
  battlefield: Battlefield,
  rofMarkers: ROFMarker[],
  suppressionMarkers: SuppressionMarker[],
  firelanes: FieldOfFire[],
  characters: Character[]
): BattlefieldROFVisualization {
  return {
    rofMarkers: getROFMarkerVisualization(rofMarkers),
    suppressionMarkers: getSuppressionMarkerVisualization(suppressionMarkers, battlefield),
    firelanes: firelanes.map((fof, index) => 
      getFieldOfFireVisualization(
        fof,
        `firelane_${index}`,
        'braced', // TODO: Track actual status
        0 // TODO: Track suppression count
      )
    ),
    suppressionZones: characters
      .map(char => getSuppressionZoneVisualization(char, battlefield, suppressionMarkers))
      .filter((zone): zone is SuppressionZoneVisualization => zone !== null),
  };
}

/**
 * Perform Suppression Test
 * 
 * Rules:
 * - Unopposed REF Test DR Suppression effect
 * - Apply Situational Test Modifiers for Defender Range Hit Combat
 * - For each miss, receive Delay token as Stun damage (up to markers in range)
 */
export interface SuppressionTestResult {
  passed: boolean;
  misses: number;
  delayTokensReceived: number;
}

export function performSuppressionTest(
  character: Character,
  suppressionDR: number,
  markersInRange: number,
  rng: () => number = Math.random
): SuppressionTestResult {
  const refAttr = character.finalAttributes?.ref ?? character.attributes?.ref ?? 0;
  const p1Rolls = [Math.floor(rng() * 6) + 1, Math.floor(rng() * 6) + 1];
  const p2Rolls = [Math.floor(rng() * 6) + 1, Math.floor(rng() * 6) + 1];
  const result = resolveUnopposedTest(
    { attributeValue: refAttr },
    { dr: suppressionDR, p1Rolls, p2Rolls }
  );
  const misses = Math.max(0, -result.score);
  
  // Delay tokens = misses, up to markers in range
  const delayTokensReceived = Math.min(misses, markersInRange);
  
  return {
    passed: misses === 0,
    misses,
    delayTokensReceived,
  };
}
