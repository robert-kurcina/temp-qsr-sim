/**
 * AI Decision Support
 *
 * AI scoring, retreat positioning, bonus action priority, and tactical decision support.
 * Extracted from AIBattleRunner.ts to separate decision logic from execution.
 */

import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import type { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { AggressionLevel } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { BonusActionType, BonusActionOption, BonusActionSelection } from '../../../src/lib/mest-tactics/actions/bonus-actions';
import type { PassiveEvent, PassiveOption } from '../../../src/lib/mest-tactics/status/passive-options';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { LOFOperations } from '../../../src/lib/mest-tactics/battlefield/los/LOFOperations';
import { getDoctrineComponents } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';

export interface PredictedScoringResult {
  predictedScores: Record<string, number>;
  targetPriorities: Record<string, number>;
}

export interface SideStrategy {
  doctrine: TacticalDoctrine;
  aggression: number;
  objectiveRush: number;
  coverPriority: number;
}

export interface RetreatPosition {
  position: Position;
  score: number;
  reason: string;
}

export interface PushBackSelection {
  position: Position;
  isOptimal: boolean;
  reason: string;
}

/**
 * Build predicted scoring for AI decision making
 * 
 * @param sides - All mission sides
 * @param vpBySide - Current VP by side (for VP pressure calculation)
 * @param rpBySide - Current RP by side (for RP pressure calculation)
 * @param currentTurn - Current turn number (for end-game urgency)
 * @param maxTurns - Maximum turns in game
 * @returns Predicted scoring and target priorities
 * 
 * @reference docs/audit/VP_SCORING_GAP_ANALYSIS.md - Fix 2: Wire VP/RP into utility scoring
 */
export function buildPredictedScoring(
  sides: MissionSide[],
  vpBySide?: Record<string, number>,
  rpBySide?: Record<string, number>,
  currentTurn?: number,
  maxTurns?: number
): PredictedScoringResult {
  const predictedScores: Record<string, number> = {};
  const targetPriorities: Record<string, number> = {};

  for (const side of sides) {
    for (const member of side.members) {
      const character = member.character;
      if (!character || character.state.isEliminated || character.state.isKOd) {
        continue;
      }

      const key = character.id;
      let score = 0;
      let priority = 0;

      // === Base: Health-based scoring (weakened = priority target) ===
      const healthRatio = character.state.wounds / (character.profile.siz ?? 1);
      priority += (1 - healthRatio) * 10;  // +10 for fresh, +0 for SIZ-1 wounds

      // === Base: Engagement scoring ===
      const enemies = sides
        .filter(s => s.id !== side.id)
        .flatMap(s => s.members)
        .map(m => m.character)
        .filter(c => c && !c.state.isEliminated && !c.state.isKOd);

      for (const enemy of enemies) {
        if (enemy && SpatialRules.isEngaged(
          { id: character.id, position: character.position!, baseDiameter: character.baseDiameter, siz: character.profile.siz ?? 3 },
          { id: enemy.id, position: enemy.position!, baseDiameter: enemy.baseDiameter, siz: enemy.profile.siz ?? 3 }
        )) {
          score += 5;
          priority += 3;  // Engaged enemies are priority targets
        }
      }

      // === VP/RP Pressure Scoring (NEW) ===
      let enemyVp = 0;
      let enemyRp = 0;
      if (vpBySide && rpBySide) {
        const mySideId = side.id;
        const myVp = vpBySide[mySideId] ?? 0;
        const myRp = rpBySide[mySideId] ?? 0;

        // Calculate enemy VP/RP (max of all enemies)
        enemyVp = Math.max(
          0,
          ...Object.entries(vpBySide)
            .filter(([sid]) => sid !== mySideId)
            .map(([, vp]) => vp)
        );
        enemyRp = Math.max(
          0,
          ...Object.entries(rpBySide)
            .filter(([sid]) => sid !== mySideId)
            .map(([, rp]) => rp)
        );

        const vpDeficit = enemyVp - myVp;
        const rpDeficit = enemyRp - myRp;

        // VP deficit creates urgency (+0.5 priority per VP behind)
        if (vpDeficit > 0) {
          priority += vpDeficit * 0.5;
        }

        // RP deficit creates moderate urgency (+0.25 priority per RP behind)
        if (rpDeficit > 0) {
          priority += rpDeficit * 0.25;
        }

        // Elimination key: enemy models are VP sources (1 VP per elimination)
        // Weight this highly to encourage aggressive play
        priority += 2;  // Base elimination pressure
      }

      // === Turn-based Urgency (NEW) ===
      if (currentTurn !== undefined && maxTurns !== undefined) {
        const turnsRemaining = maxTurns - currentTurn;

        // Late game + VP deficit = desperation mode
        if (turnsRemaining <= 2 && vpBySide && (vpBySide[side.id] ?? 0) < enemyVp) {
          priority *= 1.5;  // 50% urgency boost
        }
      }

      // === Finish Off Bonus (NEW) ===
      // Weakened enemies (SIZ-1 wounds) are high-value targets
      if (character.state.wounds >= (character.profile.siz ?? 1) - 1) {
        priority += 5;  // +5 for easy elimination VP
      }

      predictedScores[key] = score;
      targetPriorities[key] = priority;
    }
  }

  return { predictedScores, targetPriorities };
}

/**
 * Build side strategies based on doctrine
 */
export function buildSideStrategies(
  doctrinesByCharacterId: Map<string, TacticalDoctrine>
): Record<string, SideStrategy> {
  const strategies: Record<string, SideStrategy> = {};

  for (const [characterId, doctrine] of doctrinesByCharacterId.entries()) {
    const components = getDoctrineComponents(doctrine);
    // Convert AggressionLevel enum to number for backward compatibility
    const aggressionNum = components.aggression === AggressionLevel.Aggressive ? 8 :
                          components.aggression === AggressionLevel.Defensive ? 3 : 5;
    strategies[characterId] = {
      doctrine,
      aggression: aggressionNum,
      objectiveRush: components.objectiveRush,
      coverPriority: components.coverPriority,
    };
  }

  return strategies;
}

/**
 * Find best retreat position against threats
 */
export function findBestRetreatPosition(
  character: Character,
  threats: Character[],
  battlefield: Battlefield,
  maxDistance: number = 6
): RetreatPosition | null {
  if (!character.position) {
    return null;
  }

  const currentPos = character.position;
  let bestPosition: RetreatPosition | null = null;

  // Sample positions in a circle around character
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    for (let dist = 1; dist <= maxDistance; dist += 1) {
      const x = currentPos.x + dist * Math.cos(angle);
      const y = currentPos.y + dist * Math.sin(angle);
      const position = { x, y };

      // Check if position is valid
      if (!isPositionValid(position, character, battlefield)) {
        continue;
      }

      // Score position based on threat distance
      let score = 0;
      for (const threat of threats) {
        if (!threat.position) continue;
        const threatDist = LOFOperations.distance(position, threat.position);
        score += threatDist;
      }

      // Prefer positions that increase distance from all threats
      const currentThreatDist = threats.reduce((sum, t) => {
        if (!t.position) return sum;
        return sum + LOFOperations.distance(currentPos, t.position);
      }, 0);

      if (score > currentThreatDist && (!bestPosition || score > bestPosition.score)) {
        bestPosition = {
          position,
          score,
          reason: `Increases average threat distance from ${currentThreatDist.toFixed(1)} to ${score.toFixed(1)} MU`,
        };
      }
    }
  }

  return bestPosition;
}

/**
 * Find push back selection for engagement
 */
export function findPushBackSelection(
  character: Character,
  opponent: Character,
  battlefield: Battlefield,
  maxDistance: number = 3
): PushBackSelection {
  if (!character.position || !opponent.position) {
    return {
      position: character.position || { x: 0, y: 0 },
      isOptimal: false,
      reason: 'Missing position data',
    };
  }

  // Calculate direction away from opponent
  const dx = character.position.x - opponent.position.x;
  const dy = character.position.y - opponent.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    return {
      position: { x: character.position.x + 1, y: character.position.y },
      isOptimal: false,
      reason: 'Overlapping positions, pushing east',
    };
  }

  // Normalize and scale to max distance
  const pushX = (dx / dist) * maxDistance;
  const pushY = (dy / dist) * maxDistance;

  const targetX = character.position.x + pushX;
  const targetY = character.position.y + pushY;

  // Check bounds
  const clampedX = Math.max(1, Math.min(battlefield.width - 1, targetX));
  const clampedY = Math.max(1, Math.min(battlefield.height - 1, targetY));

  const position = { x: clampedX, y: clampedY };

  // Check if position is valid
  if (isPositionValid(position, character, battlefield)) {
    return {
      position,
      isOptimal: true,
      reason: `Push back ${maxDistance} MU away from opponent`,
    };
  }

  // Find nearest valid position
  const snapPosition = snapToValidPosition(position, character, battlefield);
  return {
    position: snapPosition || character.position,
    isOptimal: !!snapPosition,
    reason: snapPosition ? 'Snapped to nearest valid position' : 'No valid position found',
  };
}

/**
 * Get bonus action priority based on doctrine and situation
 */
export function getBonusActionPriority(
  character: Character,
  doctrine: TacticalDoctrine,
  availableActions: BonusActionOption[],
  engaged: boolean,
  hasLOS: boolean
): BonusActionSelection | null {
  const components = getDoctrineComponents(doctrine);
  // Convert AggressionLevel enum to number for comparison
  const aggressionNum = components.aggression === AggressionLevel.Aggressive ? 8 :
                        components.aggression === AggressionLevel.Defensive ? 3 : 5;

  // Priority order based on doctrine
  const priorityOrder: string[] = [];

  if (aggressionNum > 5) {
    // Aggressive doctrine prioritizes offensive bonuses
    priorityOrder.push('cascade_attack');
    priorityOrder.push('cascade_move');
  }

  if (components.coverPriority > 5) {
    // Defensive doctrine prioritizes cover
    priorityOrder.push('cascade_defend');
    priorityOrder.push('cascade_take_cover');
  }

  if (components.objectiveRush > 5) {
    // Objective-focused doctrine
    priorityOrder.push('cascade_move');
    priorityOrder.push('cascade_hold');
  }

  // Add remaining actions
  const allActions: string[] = [
    'cascade_attack',
    'cascade_move',
    'cascade_defend',
    'cascade_take_cover',
    'cascade_hold',
    'cascade_rally',
    'cascade_revive',
  ];

  for (const action of allActions) {
    if (!priorityOrder.includes(action)) {
      priorityOrder.push(action);
    }
  }

  // Find highest priority available action
  for (const actionType of priorityOrder) {
    const option = availableActions.find(a => a.type === actionType);
    if (option && isBonusActionValid(option, character, engaged, hasLOS)) {
      return {
        type: actionType as any,
        priority: priorityOrder.indexOf(actionType),
        option: option.type,  // Return the type string, not the full option object
      };
    }
  }

  return null;
}

/**
 * Create bonus action selection for specific type
 */
export function createBonusSelectionForType(
  type: any,
  options: BonusActionOption[]
): BonusActionSelection | null {
  const option = options.find(o => o.type === type);
  if (!option) {
    return null;
  }

  return {
    type,
    priority: 0,
    option: option.type,  // Return the type string, not the full option object
  };
}

/**
 * Check if defend declared should be used
 */
export function shouldUseDefendDeclared(
  character: Character,
  doctrine: TacticalDoctrine,
  engaged: boolean
): boolean {
  if (!engaged) {
    return false;
  }

  const components = getDoctrineComponents(doctrine);
  const aggressionNum = components.aggression === AggressionLevel.Aggressive ? 8 :
                        components.aggression === AggressionLevel.Defensive ? 3 : 5;
  return components.coverPriority > 5 || aggressionNum < 4;
}

/**
 * Check if take cover declared should be used
 */
export function shouldUseTakeCoverDeclared(
  doctrine: TacticalDoctrine,
  defender: Character,
  hasCoverAvailable: boolean
): boolean {
  if (!hasCoverAvailable) {
    return false;
  }

  const components = getDoctrineComponents(doctrine);
  return components.coverPriority > 6;
}

/**
 * Get passive response priority
 */
export function getPassiveResponsePriority(
  event: PassiveEvent,
  options: PassiveOption[],
  character: Character,
  doctrine: TacticalDoctrine
): PassiveOption | null {
  const components = getDoctrineComponents(doctrine);
  // Convert AggressionLevel enum to number for comparison
  const aggressionNum = components.aggression === AggressionLevel.Aggressive ? 8 :
                        components.aggression === AggressionLevel.Defensive ? 3 : 5;

  // Priority based on event kind and doctrine
  let priorityOrder: string[] = [];

  // Use kind property instead of type, and correct event kind names
  if (event.kind === 'MoveConcluded' && aggressionNum > 5) {
    priorityOrder = ['CounterCharge', 'Defend', 'Hold'] as any;
  } else if ((event.kind === 'RangedAttackDeclared' || event.kind === 'CloseCombatAttackDeclared') && components.coverPriority > 5) {
    priorityOrder = ['TakeCover', 'Defend', 'Hold'] as any;
  } else if ((event.kind === 'RangedAttackDeclared' || event.kind === 'CloseCombatAttackDeclared') && aggressionNum > 5) {
    priorityOrder = ['CounterStrike', 'CounterFire', 'Defend'] as any;
  } else {
    priorityOrder = ['Defend', 'Hold', 'TakeCover'] as any;
  }

  // Find highest priority available option
  for (const optionType of priorityOrder) {
    const option = options.find(o => o.type === optionType);
    if (option && isPassiveOptionValid(option as any, character, event)) {
      return option;
    }
  }

  return null;
}

/**
 * Score counter charge observer position
 */
export function scoreCounterChargeObserver(
  observer: Character,
  movingCharacter: Character,
  battlefield: Battlefield
): number {
  if (!observer.position || !movingCharacter.position) {
    return 0;
  }

  let score = 0;

  // Check LOS
  const hasLOS = SpatialRules.hasLineOfSight(
    battlefield,
    { id: observer.id, position: observer.position, baseDiameter: observer.baseDiameter, siz: observer.profile.siz },
    { id: movingCharacter.id, position: movingCharacter.position, baseDiameter: movingCharacter.baseDiameter, siz: movingCharacter.profile.siz }
  );

  if (!hasLOS) {
    return 0;
  }

  // Score based on distance (closer = better for counter charge)
  const dist = LOFOperations.distance(observer.position, movingCharacter.position);
  if (dist <= 8) {
    score += 10;
  } else if (dist <= 16) {
    score += 5;
  }

  // Score based on engagement status
  if (!SpatialRules.isEngaged(
    { id: observer.id, position: observer.position, baseDiameter: observer.baseDiameter, siz: observer.profile.siz },
    { id: movingCharacter.id, position: movingCharacter.position, baseDiameter: movingCharacter.baseDiameter, siz: movingCharacter.profile.siz }
  )) {
    score += 5; // Free to counter charge
  }

  return score;
}

/**
 * Build spatial model for character
 */
export function buildSpatialModelFor(character: Character) {
  return {
    id: character.id,
    position: character.position!,
    baseDiameter: character.baseDiameter,
    siz: character.profile.siz,
  };
}

/**
 * Check if lean should be used for ranged attack
 */
export function shouldUseLeanForRanged(
  attacker: Character,
  defender: Character,
  battlefield: Battlefield
): boolean {
  if (!attacker.position || !defender.position) {
    return false;
  }

  // Check if attacker has cover available
  const coverResult = SpatialRules.getCoverResult(battlefield,
    { id: attacker.id, position: attacker.position, baseDiameter: attacker.baseDiameter, siz: attacker.profile.siz },
    { id: defender.id, position: defender.position, baseDiameter: defender.baseDiameter, siz: defender.profile.siz }
  );

  // Lean if we have cover and would lose it by moving
  return coverResult.hasDirectCover || coverResult.hasInterveningCover;
}

/**
 * Check if lean should be used for detect action
 */
export function shouldUseLeanForDetect(
  attacker: Character,
  target: Character,
  battlefield: Battlefield
): boolean {
  // Similar logic to ranged attack
  return shouldUseLeanForRanged(attacker, target, battlefield);
}

/**
 * Find relocation position against threats
 */
export function findRelocationPositionAgainstThreats(
  character: Character,
  threats: Character[],
  battlefield: Battlefield,
  maxDistance: number = 6
): Position | null {
  const retreat = findBestRetreatPosition(character, threats, battlefield, maxDistance);
  return retreat ? retreat.position : null;
}

/**
 * Find relocation position for general movement
 */
export function findRelocationPosition(
  character: Character,
  targetPosition: Position,
  battlefield: Battlefield
): Position | null {
  if (!character.position) {
    return null;
  }

  // Simple approach: move toward target if valid
  if (isPositionValid(targetPosition, character, battlefield)) {
    return targetPosition;
  }

  // Find nearest valid position
  return snapToValidPosition(targetPosition, character, battlefield);
}

/**
 * Find take cover position
 */
export function findTakeCoverPosition(
  character: Character,
  battlefield: Battlefield,
  threats: Character[]
): Position | null {
  if (!character.position) {
    return null;
  }

  let bestPosition: Position | null = null;
  let bestCoverScore = 0;

  // Sample positions around character
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    for (let dist = 1; dist <= 4; dist += 1) {
      const x = character.position.x + dist * Math.cos(angle);
      const y = character.position.y + dist * Math.sin(angle);
      const position = { x, y };

      if (!isPositionValid(position, character, battlefield)) {
        continue;
      }

      // Score cover from this position
      let coverScore = 0;
      for (const threat of threats) {
        if (!threat.position) continue;

        const coverResult = SpatialRules.getCoverResult(battlefield,
          { id: character.id, position, baseDiameter: character.baseDiameter, siz: character.profile.siz },
          { id: threat.id, position: threat.position, baseDiameter: threat.baseDiameter, siz: threat.profile.siz }
        );

        if (coverResult.hasDirectCover) {
          coverScore += coverResult.directCoverFeatures.some(f => f.meta?.los === 'Hard') ? 10 : 5;
        }
        if (coverResult.hasInterveningCover) {
          coverScore += coverResult.interveningCoverFeatures.some(f => f.meta?.los === 'Hard') ? 10 : 5;
        }
      }

      if (coverScore > bestCoverScore) {
        bestCoverScore = coverScore;
        bestPosition = position;
      }
    }
  }

  return bestPosition;
}

/**
 * Build auto bonus action selections
 */
export function buildAutoBonusActionSelections(
  availableActions: BonusActionOption[],
  character: Character,
  doctrine: TacticalDoctrine,
  engaged: boolean,
  hasLOS: boolean
): BonusActionSelection[] {
  const selections: BonusActionSelection[] = [];

  const priority = getBonusActionPriority(character, doctrine, availableActions, engaged, hasLOS);
  if (priority) {
    selections.push(priority);
  }

  // Add remaining valid actions
  for (const option of availableActions) {
    if (!selections.some(s => s.type === option.type) && isBonusActionValid(option, character, engaged, hasLOS)) {
      selections.push({
        type: option.type,
        option: option.type,  // Return the type string, not the full option object
        priority: 100,
      });
    }
  }

  return selections;
}

/**
 * Apply auto bonus action if possible
 */
export function applyAutoBonusActionIfPossible(params: {
  selections: BonusActionSelection[];
  character: Character;
  apRemaining: number;
}): BonusActionSelection | null {
  const { selections, character, apRemaining } = params;

  if (selections.length === 0 || apRemaining < 1) {
    return null;
  }

  // Sort by priority (handle undefined priorities)
  const sorted = [...selections].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  // Return highest priority action that can be afforded
  // Note: option is now a string, so we can't check apCost
  // This function needs to be refactored to work with the new type
  for (const selection of sorted) {
    // For now, just return the first selection since we can't check apCost
    return selection;
  }

  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function isPositionValid(
  position: Position,
  actor: Character,
  battlefield: Battlefield
): boolean {
  const radius = actor.baseDiameter || 1;

  if (
    position.x < radius ||
    position.x > battlefield.width - radius ||
    position.y < radius ||
    position.y > battlefield.height - radius
  ) {
    return false;
  }

  // Check terrain
  for (const feature of battlefield.terrain) {
    if (feature.type === 'Impassable' || feature.type === 'Obstacle') {
      if (isPointInPolygon(position, feature.vertices)) {
        return false;
      }
    }
  }

  return true;
}

function snapToValidPosition(
  position: Position,
  actor: Character,
  battlefield: Battlefield,
  maxRadius: number = 3
): Position | null {
  const cellSize = 0.5;
  const cellX = Math.round(position.x / cellSize) * cellSize;
  const cellY = Math.round(position.y / cellSize) * cellSize;
  const snapped = { x: cellX, y: cellY };

  if (isPositionValid(snapped, actor, battlefield)) {
    return snapped;
  }

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const test = {
        x: cellX + dx * cellSize,
        y: cellY + dy * cellSize,
      };
      if (isPositionValid(test, actor, battlefield)) {
        return test;
      }
    }
  }

  return null;
}

function isPointInPolygon(point: Position, polygon: Position[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isBonusActionValid(
  option: BonusActionOption,
  character: Character,
  engaged: boolean,
  hasLOS: boolean
): boolean {
  // Basic validation - can be extended based on action type
  // Note: cascade_* types are not in BonusActionType, so we use string comparison
  const type = option.type as any;
  if (type === 'cascade_attack' && !hasLOS) {
    return false;
  }
  if (type === 'cascade_move' && engaged) {
    return false;
  }
  return true;
}

function isPassiveOptionValid(
  option: PassiveOption,
  character: Character,
  event: PassiveEvent
): boolean {
  // Basic validation - can be extended based on option type
  return true;
}
