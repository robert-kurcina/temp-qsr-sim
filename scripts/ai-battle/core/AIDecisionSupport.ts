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
import type { PassiveEvent, PassiveOption, PassiveOptionType } from '../../../src/lib/mest-tactics/status/passive-options';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../../src/lib/mest-tactics/battlefield/spatial/size-utils';
import { TerrainType } from '../../../src/lib/mest-tactics/battlefield/terrain/Terrain';
import { TERRAIN_HEIGHTS } from '../../../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { LOFOperations } from '../../../src/lib/mest-tactics/battlefield/los/LOFOperations';
import { getDoctrineComponents, EngagementStyle, PlanningPriority } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { getCharacterTraitLevel } from '../../../src/lib/mest-tactics/status/status-system';
import { getLoadoutProfile } from './CombatExecutor';

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
 * Runner-grade doctrine-aware declared Defend preference.
 */
export function shouldUseDefendDeclaredForDoctrine(
  doctrine: TacticalDoctrine,
  attackType: 'melee' | 'ranged',
  defender: Character
): boolean {
  void doctrine;
  void attackType;
  return defender.state.isAttentive;
}

/**
 * Runner-grade doctrine-aware declared Take Cover preference.
 */
export function shouldUseTakeCoverDeclaredForDoctrine(
  doctrine: TacticalDoctrine,
  defender: Character
): boolean {
  const components = getDoctrineComponents(doctrine);
  if (
    components.aggression === AggressionLevel.Aggressive &&
    components.engagement === EngagementStyle.Melee &&
    components.planning === PlanningPriority.Aggressive
  ) {
    const loadout = getLoadoutProfile(defender);
    const threatened =
      defender.state.wounds > 0 ||
      defender.state.delayTokens > 0 ||
      defender.state.fearTokens > 0;
    if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons && !threatened) {
      return false;
    }
  }
  return true;
}

/**
 * Runner-grade passive response priority list.
 */
export function getPassiveResponsePriorityList(
  doctrine: TacticalDoctrine,
  attackType: 'melee' | 'ranged',
  defender: Character
): PassiveOptionType[] {
  const components = getDoctrineComponents(doctrine);
  const loadout = getLoadoutProfile(defender);
  const prioritize = (list: PassiveOptionType[], preferred: PassiveOptionType[]): PassiveOptionType[] => {
    const seen = new Set<PassiveOptionType>();
    const ordered: PassiveOptionType[] = [];
    for (const type of preferred) {
      if (!seen.has(type)) {
        seen.add(type);
        ordered.push(type);
      }
    }
    for (const type of list) {
      if (!seen.has(type)) {
        seen.add(type);
        ordered.push(type);
      }
    }
    return ordered;
  };

  let priority: PassiveOptionType[];
  if (attackType === 'melee') {
    if (components.aggression === AggressionLevel.Aggressive && components.engagement === EngagementStyle.Melee) {
      priority = ['CounterStrike', 'CounterAction', 'CounterFire'];
    } else if (components.aggression === AggressionLevel.Defensive) {
      priority = ['CounterAction', 'CounterStrike', 'CounterFire'];
    } else {
      priority = ['CounterAction', 'CounterStrike', 'CounterFire'];
    }
  } else {
    if (components.aggression === AggressionLevel.Defensive || components.engagement === EngagementStyle.Ranged) {
      priority = ['CounterFire', 'CounterAction', 'CounterStrike'];
    } else if (components.aggression === AggressionLevel.Aggressive && components.engagement === EngagementStyle.Melee) {
      priority = ['CounterAction', 'CounterFire', 'CounterStrike'];
    } else {
      priority = ['CounterAction', 'CounterFire', 'CounterStrike'];
    }
  }

  if (components.planning === PlanningPriority.Aggressive) {
    priority =
      attackType === 'melee'
        ? prioritize(priority, ['CounterStrike', 'CounterAction'])
        : prioritize(priority, ['CounterFire', 'CounterAction']);
  } else if (components.planning === PlanningPriority.KeysToVictory) {
    priority = prioritize(priority, ['CounterAction']);
  }

  if (!loadout.hasMeleeWeapons) {
    priority = priority.filter(type => type !== 'CounterStrike');
  }
  if (!loadout.hasRangedWeapons) {
    priority = priority.filter(type => type !== 'CounterFire');
  }
  return priority;
}

/**
 * Runner-grade doctrine-aware counter-charge observer scoring.
 */
export function scoreCounterChargeObserverForDoctrine(
  doctrine: TacticalDoctrine,
  observer: Character,
  mover: Character,
  battlefield: Battlefield
): number {
  const components = getDoctrineComponents(doctrine);
  const loadout = getLoadoutProfile(observer);
  const observerPos = battlefield.getCharacterPosition(observer);
  const moverPos = battlefield.getCharacterPosition(mover);
  const distance =
    observerPos && moverPos
      ? Math.hypot(observerPos.x - moverPos.x, observerPos.y - moverPos.y)
      : Number.POSITIVE_INFINITY;

  let score = 0;
  if (components.engagement === EngagementStyle.Melee) score += 1.5;
  if (components.engagement === EngagementStyle.Ranged) score -= 0.6;
  if (components.aggression === AggressionLevel.Aggressive) score += 1.2;
  if (components.aggression === AggressionLevel.Defensive) score -= 0.4;
  if (components.planning === PlanningPriority.Aggressive) score += 0.7;
  if (components.planning === PlanningPriority.KeysToVictory) score -= 0.4;
  if (loadout.hasMeleeWeapons) score += 1.0;
  if (!loadout.hasMeleeWeapons) score -= 1.0;
  if (!loadout.hasRangedWeapons) score += 0.3;
  if (distance <= 8) score += 1.0;
  else if (distance >= 14) score -= 0.5;
  return score;
}

/**
 * Runner-grade battlefield-position spatial model.
 */
export function buildSpatialModelForCharacter(character: Character, battlefield: Battlefield) {
  const position = battlefield.getCharacterPosition(character);
  if (!position) return null;
  const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
  return {
    id: character.id,
    position,
    baseDiameter: getBaseDiameterFromSiz(siz),
    siz,
  };
}

/**
 * Runner-grade ranged lean preference.
 */
export function shouldUseLeanForRangedWithCover(
  attacker: Character,
  defender: Character,
  battlefield: Battlefield
): boolean {
  if (!attacker.state.isAttentive) return false;
  const attackerModel = buildSpatialModelForCharacter(attacker, battlefield);
  const defenderModel = buildSpatialModelForCharacter(defender, battlefield);
  if (!attackerModel || !defenderModel) return false;
  const coverFromAttacker = SpatialRules.getCoverResult(battlefield, attackerModel, defenderModel);
  const coverFromDefender = SpatialRules.getCoverResult(battlefield, defenderModel, attackerModel);
  const hasAttackerCover =
    coverFromDefender.hasLOS && (coverFromDefender.hasDirectCover || coverFromDefender.hasInterveningCover);
  const hasInterveningLaneCover =
    coverFromAttacker.hasLOS && (coverFromAttacker.hasDirectCover || coverFromAttacker.hasInterveningCover);
  return hasAttackerCover || hasInterveningLaneCover;
}

/**
 * Runner-grade detect lean preference.
 */
export function shouldUseLeanForDetectWithCover(
  attacker: Character,
  target: Character,
  battlefield: Battlefield
): boolean {
  if (!attacker.state.isAttentive) return false;
  const attackerModel = buildSpatialModelForCharacter(attacker, battlefield);
  const targetModel = buildSpatialModelForCharacter(target, battlefield);
  if (!attackerModel || !targetModel) return false;
  const coverFromAttacker = SpatialRules.getCoverResult(battlefield, attackerModel, targetModel);
  const coverFromTarget = SpatialRules.getCoverResult(battlefield, targetModel, attackerModel);
  const hasAttackerCover =
    coverFromTarget.hasLOS && (coverFromTarget.hasDirectCover || coverFromTarget.hasInterveningCover);
  const hasInterveningLaneCover =
    coverFromAttacker.hasLOS && (coverFromAttacker.hasDirectCover || coverFromAttacker.hasInterveningCover);
  return hasAttackerCover || hasInterveningLaneCover;
}

export interface RunnerThreatScoringCallbacks {
  isCombatantActive(character: Character): boolean;
  isEngagedAtPositions(
    first: Character,
    firstPosition: Position,
    second: Character,
    secondPosition: Position
  ): boolean;
}

export function scoreIncomingThreatAtPositionForRunner(
  character: Character,
  position: Position,
  enemies: Character[],
  battlefield: Battlefield,
  callbacks: RunnerThreatScoringCallbacks
): number {
  let threat = 0;
  for (const enemy of enemies) {
    if (!callbacks.isCombatantActive(enemy)) continue;
    const enemyPos = battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    const distance = Math.hypot(position.x - enemyPos.x, position.y - enemyPos.y);
    if (distance <= 0.01) {
      threat += 2;
    } else {
      threat += Math.max(0, 1.6 - distance / 12);
    }
    if (battlefield.hasLineOfSight(enemyPos, position)) {
      threat += 0.8;
    }
    if (callbacks.isEngagedAtPositions(character, position, enemy, enemyPos)) {
      threat += 2.5;
    }
  }
  return threat;
}

export function findBestRetreatPositionForRunner(params: {
  actor: Character;
  reference: Character;
  battlefield: Battlefield;
  enemies: Character[];
  maxDistance: number;
  scoreIncomingThreatAtPosition: (
    character: Character,
    position: Position,
    enemies: Character[],
    battlefield: Battlefield
  ) => number;
}): Position | undefined {
  const { actor, reference, battlefield, enemies, maxDistance, scoreIncomingThreatAtPosition } = params;
  const actorPos = battlefield.getCharacterPosition(actor);
  const referencePos = battlefield.getCharacterPosition(reference);
  if (!actorPos || !referencePos) return undefined;

  const baseDirection = {
    x: actorPos.x - referencePos.x,
    y: actorPos.y - referencePos.y,
  };
  const baseLength = Math.hypot(baseDirection.x, baseDirection.y) || 1;
  const dirX = baseDirection.x / baseLength;
  const dirY = baseDirection.y / baseLength;

  const candidateVectors = [
    { x: dirX, y: dirY },
    { x: dirX + dirY * 0.5, y: dirY - dirX * 0.5 },
    { x: dirX - dirY * 0.5, y: dirY + dirX * 0.5 },
    { x: -dirY, y: dirX },
    { x: dirY, y: -dirX },
  ];

  let best: { score: number; position: Position } | null = null;
  for (const vector of candidateVectors) {
    const length = Math.hypot(vector.x, vector.y) || 1;
    const unit = { x: vector.x / length, y: vector.y / length };
    const candidate = {
      x: Math.round(actorPos.x + unit.x * maxDistance),
      y: Math.round(actorPos.y + unit.y * maxDistance),
    };
    if (candidate.x < 0 || candidate.x >= battlefield.width || candidate.y < 0 || candidate.y >= battlefield.height) {
      continue;
    }
    const occupant = battlefield.getCharacterAt(candidate);
    if (occupant && occupant.id !== actor.id) continue;

    const distanceFromReference = Math.hypot(candidate.x - referencePos.x, candidate.y - referencePos.y);
    const breaksLos = !battlefield.hasLineOfSight(referencePos, candidate);
    const threat = scoreIncomingThreatAtPosition(actor, candidate, enemies, battlefield);
    const score = distanceFromReference * 0.35 + (breaksLos ? 2.5 : 0) - threat;

    if (!best || score > best.score) {
      best = { score, position: candidate };
    }
  }

  return best?.position;
}

function getTerrainSeverityForRunner(type: TerrainType | `${TerrainType}`): number {
  switch (type) {
    case TerrainType.Clear:
      return 0;
    case TerrainType.Rough:
      return 1;
    case TerrainType.Difficult:
      return 2;
    case TerrainType.Impassable:
    case TerrainType.Obstacle:
      return 3;
    default:
      return 0;
  }
}

function resolveTerrainHeightKeyForRunner(feature: any): string | null {
  const raw = [
    String(feature?.meta?.name ?? ''),
    String(feature?.meta?.category ?? ''),
    String(feature?.id ?? ''),
    String(feature?.type ?? ''),
  ]
    .join(' ')
    .toLowerCase();

  if (!raw || raw.includes('clear')) return null;
  if (raw.includes('building')) return raw.includes('large') ? 'building-large' : 'building';
  if (raw.includes('wall')) return raw.includes('large') ? 'wall-large' : 'wall';
  if (raw.includes('rock')) return 'rocky';
  if (raw.includes('shrub') || raw.includes('bush')) return 'shrub';
  if (raw.includes('tree')) return 'tree';
  if (raw.includes('cliff')) return 'wall';
  return null;
}

function getTerrainHeightForRunner(feature: any): number {
  const explicitHeight = Number(feature?.meta?.height ?? feature?.elevation);
  if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
    return explicitHeight;
  }
  const key = resolveTerrainHeightKeyForRunner(feature);
  if (!key) return 0;
  return TERRAIN_HEIGHTS[key]?.height ?? 0;
}

export function findPushBackSelectionForRunner(params: {
  attacker: Character;
  target: Character;
  battlefield: Battlefield;
  allies: Character[];
  opponents: Character[];
  countEngagersAtPosition: (
    target: Character,
    targetPosition: Position,
    candidates: Character[],
    battlefield: Battlefield
  ) => number;
}): BonusActionSelection | undefined {
  const { attacker, target, battlefield, allies, opponents, countEngagersAtPosition } = params;
  const attackerPos = battlefield.getCharacterPosition(attacker);
  const targetPos = battlefield.getCharacterPosition(target);
  if (!attackerPos || !targetPos) {
    return undefined;
  }

  const attackerBase = getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3);
  const pushDistance = Math.max(1, Math.round(attackerBase));
  const baseDx = targetPos.x - attackerPos.x;
  const baseDy = targetPos.y - attackerPos.y;
  const baseLength = Math.hypot(baseDx, baseDy) || 1;
  const forward = { x: baseDx / baseLength, y: baseDy / baseLength };

  const directions = [
    forward,
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];

  const friendlyGroup = [attacker, ...allies.filter(ally => ally.id !== attacker.id)];
  const allySupportGroup = allies.filter(ally => ally.id !== attacker.id);
  const enemySupportGroup = opponents.filter(candidate => candidate.id !== target.id);
  const targetFriendlyPressureBefore = countEngagersAtPosition(target, targetPos, friendlyGroup, battlefield);
  const targetEnemySupportBefore = countEngagersAtPosition(target, targetPos, enemySupportGroup, battlefield);
  const attackerEnemyEngagersBefore = countEngagersAtPosition(attacker, attackerPos, opponents, battlefield);
  const attackerAllySupportBefore = countEngagersAtPosition(attacker, attackerPos, allySupportGroup, battlefield);
  const sourceTerrain = battlefield.getTerrainAt(targetPos);
  const sourceTerrainSeverity = getTerrainSeverityForRunner(sourceTerrain.type);
  const sourceTerrainHeight = getTerrainHeightForRunner(sourceTerrain);

  let best: { score: number; position: Position } | null = null;
  for (const direction of directions) {
    const magnitude = Math.hypot(direction.x, direction.y) || 1;
    const unit = { x: direction.x / magnitude, y: direction.y / magnitude };
    const destination = {
      x: Math.round(targetPos.x + unit.x * pushDistance),
      y: Math.round(targetPos.y + unit.y * pushDistance),
    };
    const insideBoard = (
      destination.x >= 0 &&
      destination.x < battlefield.width &&
      destination.y >= 0 &&
      destination.y < battlefield.height
    );
    const destinationTerrain = insideBoard
      ? battlefield.getTerrainAt(destination)
      : { id: 'offboard', type: TerrainType.Impassable, vertices: [] as Position[] };
    const destinationTerrainType = destinationTerrain.type;
    const destinationTerrainSeverity = getTerrainSeverityForRunner(destinationTerrainType);
    const destinationTerrainHeight = insideBoard ? getTerrainHeightForRunner(destinationTerrain) : 0;
    const blockedTerrain =
      !insideBoard ||
      destinationTerrainType === TerrainType.Impassable ||
      destinationTerrainType === TerrainType.Obstacle;
    const movedTarget = insideBoard && !blockedTerrain;
    const pushesOffPrecipice = movedTarget && sourceTerrainHeight - destinationTerrainHeight >= 1;
    const attackerAfterPosition = movedTarget ? targetPos : attackerPos;
    const targetAfterPosition = movedTarget ? destination : targetPos;
    const attackerEnemiesAfter = countEngagersAtPosition(
      attacker,
      attackerAfterPosition,
      movedTarget ? enemySupportGroup : opponents,
      battlefield
    );
    const attackerAlliesAfter = countEngagersAtPosition(
      attacker,
      attackerAfterPosition,
      allySupportGroup,
      battlefield
    );
    const targetFriendlyPressureAfter = countEngagersAtPosition(
      target,
      targetAfterPosition,
      friendlyGroup,
      battlefield
    );
    const targetEnemySupportAfter = countEngagersAtPosition(
      target,
      targetAfterPosition,
      enemySupportGroup,
      battlefield
    );

    let score = 0;
    if (!insideBoard) {
      score += 10;
    } else {
      const occupant = battlefield.getCharacterAt(destination);
      if (occupant && occupant.id !== target.id) {
        continue;
      }
      if (destinationTerrainType === TerrainType.Impassable || destinationTerrainType === TerrainType.Obstacle) {
        score += 9;
      } else if (destinationTerrainType === TerrainType.Difficult) {
        score += 6;
      } else if (destinationTerrainType === TerrainType.Rough) {
        score += 4;
      }
    }
    if (pushesOffPrecipice) {
      score += 8;
    }
    if (destinationTerrainSeverity > sourceTerrainSeverity) {
      score += (destinationTerrainSeverity - sourceTerrainSeverity) * 1.75;
    }

    const attackerOutnumberedBefore = attackerEnemyEngagersBefore > Math.max(1, attackerAllySupportBefore);
    const attackerOutnumberedAfter = attackerEnemiesAfter > Math.max(1, attackerAlliesAfter);
    if (attackerOutnumberedBefore && !attackerOutnumberedAfter) {
      score += 7;
    }
    if (attackerEnemiesAfter < attackerEnemyEngagersBefore) {
      score += (attackerEnemyEngagersBefore - attackerEnemiesAfter) * 2.25;
    }
    if (attackerEnemyEngagersBefore > 1 && attackerEnemiesAfter <= 1) {
      score += 4;
    }

    const targetSupportDelta =
      (targetFriendlyPressureAfter - targetEnemySupportAfter) -
      (targetFriendlyPressureBefore - targetEnemySupportBefore);
    if (targetSupportDelta > 0) {
      score += targetSupportDelta * 2;
    }
    if (
      targetFriendlyPressureBefore <= targetEnemySupportBefore &&
      targetFriendlyPressureAfter > targetEnemySupportAfter
    ) {
      score += 5;
    }
    if (targetEnemySupportAfter < targetEnemySupportBefore) {
      score += (targetEnemySupportBefore - targetEnemySupportAfter) * 1.75;
    }
    if (targetFriendlyPressureAfter < targetFriendlyPressureBefore) {
      score -= (targetFriendlyPressureBefore - targetFriendlyPressureAfter) * 0.8;
    }
    if (
      destinationTerrainSeverity === sourceTerrainSeverity &&
      !pushesOffPrecipice &&
      attackerEnemiesAfter >= attackerEnemyEngagersBefore &&
      targetSupportDelta <= 0
    ) {
      score -= 1;
    }

    if (!best || score > best.score) {
      best = { score, position: destination };
    }
  }

  if (best && best.score > 0.5) {
    return { type: 'PushBack', targetPosition: best.position };
  }
  return undefined;
}

export function getBonusActionPriorityForRunner(params: {
  doctrine: TacticalDoctrine;
  isCloseCombat: boolean;
  attacker: Character;
  target: Character;
  battlefield: Battlefield;
  allies: Character[];
  opponents: Character[];
  countEngagers: (subject: Character, candidates: Character[], battlefield: Battlefield) => number;
}): BonusActionType[] {
  const { doctrine, isCloseCombat, attacker, target, battlefield, allies, opponents, countEngagers } = params;
  const components = getDoctrineComponents(doctrine);
  const loadout = getLoadoutProfile(attacker);
  const fightLevel = getCharacterTraitLevel(attacker, 'Fight');
  const brawlLevel = getCharacterTraitLevel(attacker, 'Brawl');
  const archetypeName =
    typeof attacker.profile.archetype === 'string' ? (attacker.profile.archetype as string).toLowerCase() : '';
  const isBrawlerArchetype = attacker.profile.name.toLowerCase().includes('brawler') || archetypeName.includes('brawler');
  const closeCombatSpecialist = fightLevel + brawlLevel > 0 || isBrawlerArchetype;

  const attackerEnemyEngagers = countEngagers(attacker, opponents, battlefield);
  const attackerAllySupport = countEngagers(attacker, allies, battlefield);
  const attackerOutnumbered = attackerEnemyEngagers > Math.max(1, attackerAllySupport);

  const friendlyGroup = [attacker, ...allies.filter(ally => ally.id !== attacker.id)];
  const targetSupportGroup = opponents.filter(candidate => candidate.id !== target.id);
  const targetFriendlyPressure = countEngagers(target, friendlyGroup, battlefield);
  const targetEnemySupport = countEngagers(target, targetSupportGroup, battlefield);
  const needsOutnumberLeverage = targetFriendlyPressure <= targetEnemySupport;

  const prioritize = (list: BonusActionType[], preferred: BonusActionType[]): BonusActionType[] => {
    const seen = new Set<BonusActionType>();
    const ordered: BonusActionType[] = [];
    for (const type of preferred) {
      if (!seen.has(type)) {
        seen.add(type);
        ordered.push(type);
      }
    }
    for (const type of list) {
      if (!seen.has(type)) {
        seen.add(type);
        ordered.push(type);
      }
    }
    return ordered;
  };
  let base: BonusActionType[];

  if (components.aggression === AggressionLevel.Aggressive) {
    if (isCloseCombat) {
      base =
        components.engagement === EngagementStyle.Melee
          ? ['PushBack', 'Reversal', 'Circle', 'PullBack', 'Disengage', 'Reposition', 'Hide', 'Refresh']
          : ['Reposition', 'PushBack', 'Circle', 'PullBack', 'Hide', 'Disengage', 'Reversal', 'Refresh'];
    } else {
      base = ['Reposition', 'Hide', 'Refresh'];
    }
  } else if (components.aggression === AggressionLevel.Defensive) {
    if (isCloseCombat) {
      base =
        components.engagement === EngagementStyle.Ranged
          ? ['Disengage', 'PullBack', 'Reposition', 'Hide', 'Refresh', 'Circle', 'PushBack', 'Reversal']
          : ['PullBack', 'Disengage', 'Reposition', 'Hide', 'Refresh', 'Circle', 'PushBack', 'Reversal'];
    } else {
      base = ['Hide', 'Reposition', 'Refresh'];
    }
  } else {
    base = isCloseCombat
      ? ['PushBack', 'Circle', 'Reversal', 'PullBack', 'Disengage', 'Reposition', 'Hide', 'Refresh']
      : ['Reposition', 'Hide', 'Refresh'];
  }

  if (components.planning === PlanningPriority.KeysToVictory) {
    base = isCloseCombat
      ? prioritize(base, ['Reposition', 'Disengage', 'Hide', 'Refresh'])
      : prioritize(base, ['Reposition', 'Hide', 'Refresh']);
  } else if (components.planning === PlanningPriority.Aggressive) {
    base = isCloseCombat
      ? prioritize(base, ['PushBack', 'Reversal', 'Circle', 'PullBack'])
      : prioritize(base, ['Reposition', 'Refresh', 'Hide']);
  }

  if (isCloseCombat) {
    if (attackerOutnumbered) {
      base = prioritize(base, ['Disengage', 'PullBack', 'Reversal', 'Reposition']);
    }
    if (needsOutnumberLeverage) {
      base = prioritize(base, ['PushBack', 'Reversal', 'PullBack', 'Circle']);
    }
    if (closeCombatSpecialist) {
      base = prioritize(base, ['PushBack', 'Reversal', 'Circle', 'PullBack']);
    }
    if (brawlLevel > 0 || isBrawlerArchetype) {
      base = prioritize(base, ['PushBack', 'Circle']);
    }
    if (fightLevel > 0) {
      base = prioritize(base, ['Reversal', 'Disengage', 'PullBack']);
    }
    if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) {
      base = prioritize(base, ['PushBack', 'Reversal', 'Disengage']);
    }
  } else if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) {
    base = prioritize(base, ['Reposition', 'Hide', 'Refresh']);
  }

  if (attacker.state.delayTokens > 0) {
    const shouldRefreshEarly =
      attackerOutnumbered || components.aggression === AggressionLevel.Defensive || attacker.state.delayTokens > 1;
    base = shouldRefreshEarly
      ? prioritize(base, ['Refresh'])
      : prioritize(base, ['PushBack', 'Disengage', 'Refresh']);
  }

  const unique: BonusActionType[] = [];
  for (const type of base) {
    if (!unique.includes(type)) {
      unique.push(type);
    }
  }
  return unique;
}

export function findRelocationPositionAgainstThreatsForRunner(params: {
  character: Character;
  battlefield: Battlefield;
  threatSources: Character[];
  primaryThreat?: Character;
  isCombatantActive: (character: Character) => boolean;
  scoreIncomingThreatAtPosition: (
    character: Character,
    position: Position,
    enemies: Character[],
    battlefield: Battlefield
  ) => number;
}): Position | undefined {
  const { character, battlefield, threatSources, primaryThreat, isCombatantActive, scoreIncomingThreatAtPosition } = params;
  const start = battlefield.getCharacterPosition(character);
  if (!start) return undefined;
  const mov = Math.max(1, character.finalAttributes.mov ?? character.attributes.mov ?? 0);
  const maxDistance = mov + 2;
  const activeThreats = threatSources
    .filter(threat => isCombatantActive(threat))
    .map(threat => ({ threat, position: battlefield.getCharacterPosition(threat) }))
    .filter((entry): entry is { threat: Character; position: Position } => Boolean(entry.position));
  const primaryThreatPos = primaryThreat ? battlefield.getCharacterPosition(primaryThreat) : undefined;
  let best: { score: number; pos: Position } | null = null;

  for (let dx = -maxDistance; dx <= maxDistance; dx++) {
    for (let dy = -maxDistance; dy <= maxDistance; dy++) {
      const distance = Math.hypot(dx, dy);
      if (distance <= 0 || distance > maxDistance) continue;
      const candidate = { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
      if (candidate.x < 0 || candidate.x >= battlefield.width || candidate.y < 0 || candidate.y >= battlefield.height) continue;
      const occupant = battlefield.getCharacterAt(candidate);
      if (occupant && occupant.id !== character.id) continue;

      let score = -distance * 0.12;
      if (primaryThreatPos) {
        const breaksPrimaryLos = !battlefield.hasLineOfSight(primaryThreatPos, candidate);
        score += breaksPrimaryLos ? 2.5 : 0;
      }
      if (activeThreats.length > 0) {
        let losExposure = 0;
        for (const { position } of activeThreats) {
          if (battlefield.hasLineOfSight(position, candidate)) {
            losExposure += 1;
          }
        }
        score -= losExposure * 0.5;
        score -= scoreIncomingThreatAtPosition(character, candidate, threatSources, battlefield);
      }

      if (!best || score > best.score) {
        best = { score, pos: candidate };
      }
    }
  }

  return best?.pos;
}

export function findRelocationPositionForRunner(params: {
  character: Character;
  battlefield: Battlefield;
  threatSource?: Character;
  findRelocationPositionAgainstThreats: (
    character: Character,
    battlefield: Battlefield,
    threatSources: Character[],
    primaryThreat?: Character
  ) => Position | undefined;
}): Position | undefined {
  const { character, battlefield, threatSource, findRelocationPositionAgainstThreats } = params;
  const threatSources = threatSource ? [threatSource] : [];
  return findRelocationPositionAgainstThreats(character, battlefield, threatSources, threatSource);
}

export function findTakeCoverPositionForRunner(params: {
  defender: Character;
  attacker: Character;
  battlefield: Battlefield;
  findRelocationPosition: (character: Character, battlefield: Battlefield, threatSource?: Character) => Position | undefined;
}): Position | undefined {
  const { defender, attacker, battlefield, findRelocationPosition } = params;
  const start = battlefield.getCharacterPosition(defender);
  const attackerPos = battlefield.getCharacterPosition(attacker);
  if (!start || !attackerPos) {
    return findRelocationPosition(defender, battlefield, attacker);
  }

  const mov = Math.max(1, defender.finalAttributes.mov ?? defender.attributes.mov ?? 0);
  const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3;
  const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 3;
  const attackerModel = {
    id: attacker.id,
    position: attackerPos,
    baseDiameter: getBaseDiameterFromSiz(attackerSiz),
    siz: attackerSiz,
  };

  let best: { score: number; pos: Position } | null = null;
  for (let dx = -mov; dx <= mov; dx++) {
    for (let dy = -mov; dy <= mov; dy++) {
      const distance = Math.hypot(dx, dy);
      if (distance <= 0 || distance > mov) continue;
      const candidate = { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
      if (candidate.x < 0 || candidate.x >= battlefield.width || candidate.y < 0 || candidate.y >= battlefield.height) continue;
      const occupant = battlefield.getCharacterAt(candidate);
      if (occupant && occupant.id !== defender.id) continue;

      const defenderModel = {
        id: defender.id,
        position: candidate,
        baseDiameter: getBaseDiameterFromSiz(defenderSiz),
        siz: defenderSiz,
      };
      const cover = SpatialRules.getCoverResult(battlefield, attackerModel, defenderModel);
      const hasCover = cover.hasDirectCover || cover.hasInterveningCover;
      const hasHardCover = cover.directCoverFeatures.some(feature => feature.meta?.los === 'Hard');
      const inLos = cover.hasLOS;

      let score = 0;
      if (!inLos) score += 8;
      if (hasCover) score += 4;
      if (hasHardCover) score += 1.5;
      score -= distance * 0.15;

      if (!best || score > best.score) {
        best = { score, pos: candidate };
      }
    }
  }

  return best?.pos ?? findRelocationPosition(defender, battlefield, attacker);
}

export function createBonusSelectionForTypeForRunner(params: {
  type: BonusActionType;
  attacker: Character;
  target: Character;
  battlefield: Battlefield;
  allies: Character[];
  opponents: Character[];
  findRelocationPositionAgainstThreats: (
    character: Character,
    battlefield: Battlefield,
    threatSources: Character[],
    primaryThreat?: Character
  ) => Position | undefined;
  findBestRetreatPosition: (
    actor: Character,
    reference: Character,
    battlefield: Battlefield,
    enemies: Character[],
    maxDistance: number
  ) => Position | undefined;
  findPushBackSelection: (
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    allies: Character[],
    opponents: Character[]
  ) => BonusActionSelection | undefined;
}): BonusActionSelection | undefined {
  const {
    type,
    attacker,
    target,
    battlefield,
    allies,
    opponents,
    findRelocationPositionAgainstThreats,
    findBestRetreatPosition,
    findPushBackSelection,
  } = params;

  if (type === 'Hide') {
    return attacker.state.isHidden ? undefined : { type: 'Hide', opponents };
  }
  if (type === 'Reposition') {
    const relocation = findRelocationPositionAgainstThreats(attacker, battlefield, opponents, target);
    return relocation ? { type: 'Reposition', attackerPosition: relocation } : undefined;
  }
  if (type === 'Disengage') {
    const mov = attacker.finalAttributes.mov ?? attacker.attributes.mov ?? 0;
    const attackerBase = getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3);
    const targetBase = getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3);
    const disengageDistance = Math.max(Math.max(attackerBase, targetBase), mov / 2);
    const retreat = findBestRetreatPosition(attacker, target, battlefield, opponents, disengageDistance);
    return retreat ? { type: 'Disengage', attackerPosition: retreat } : undefined;
  }
  if (type === 'PullBack') {
    const attackerBase = getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3);
    const targetBase = getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3);
    const pullDistance = Math.max(attackerBase, targetBase);
    const retreat = findBestRetreatPosition(attacker, target, battlefield, opponents, pullDistance);
    return retreat ? { type: 'PullBack', attackerPosition: retreat } : undefined;
  }
  if (type === 'PushBack') {
    return findPushBackSelection(attacker, target, battlefield, allies, opponents);
  }
  if (type === 'Circle') {
    const attackerPos = battlefield.getCharacterPosition(attacker);
    const targetPos = battlefield.getCharacterPosition(target);
    if (!attackerPos || !targetPos) return undefined;
    const circlePos = {
      x: Math.round(targetPos.x - (attackerPos.x - targetPos.x)),
      y: Math.round(targetPos.y - (attackerPos.y - targetPos.y)),
    };
    if (
      circlePos.x < 0 ||
      circlePos.x >= battlefield.width ||
      circlePos.y < 0 ||
      circlePos.y >= battlefield.height
    ) {
      return undefined;
    }
    const occupant = battlefield.getCharacterAt(circlePos);
    if (occupant && occupant.id !== attacker.id) {
      return undefined;
    }
    return { type: 'Circle', attackerPosition: circlePos };
  }
  return { type };
}

export function buildAutoBonusActionSelectionsForRunner(params: {
  attacker: Character;
  target: Character;
  battlefield: Battlefield;
  allies: Character[];
  opponents: Character[];
  options: BonusActionOption[];
  isCloseCombat: boolean;
  doctrine: TacticalDoctrine;
  getBonusActionPriority: (
    doctrine: TacticalDoctrine,
    isCloseCombat: boolean,
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    allies: Character[],
    opponents: Character[]
  ) => BonusActionType[];
  createBonusSelectionForType: (
    type: BonusActionType,
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    allies: Character[],
    opponents: Character[]
  ) => BonusActionSelection | undefined;
}): BonusActionSelection[] {
  const {
    attacker,
    target,
    battlefield,
    allies,
    opponents,
    options,
    isCloseCombat,
    doctrine,
    getBonusActionPriority,
    createBonusSelectionForType,
  } = params;
  const available = options.filter(option => option.available);
  if (available.length === 0) return [];
  const byType = new Set<BonusActionType>(available.map(option => option.type));
  const selections: BonusActionSelection[] = [];
  const push = (selection: BonusActionSelection) => {
    if (!selections.some(existing => existing.type === selection.type)) {
      selections.push(selection);
    }
  };

  const prioritizedTypes = getBonusActionPriority(
    doctrine,
    isCloseCombat,
    attacker,
    target,
    battlefield,
    allies,
    opponents
  );
  for (const type of prioritizedTypes) {
    if (!byType.has(type)) continue;
    const selection = createBonusSelectionForType(type, attacker, target, battlefield, allies, opponents);
    if (selection) {
      push(selection);
    }
  }

  for (const option of available) {
    const selection = createBonusSelectionForType(option.type, attacker, target, battlefield, allies, opponents);
    if (selection) {
      push(selection);
    }
  }
  return selections;
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
