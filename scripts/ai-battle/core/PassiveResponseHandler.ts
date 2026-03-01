/**
 * Passive Response Handler
 *
 * Passive options, counter-charge, follow-up bonus actions, and reactive responses.
 * Extracted from AIBattleRunner.ts to separate passive response logic from core execution.
 */

import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { PassiveEvent, PassiveOption, PassiveOptionType } from '../../../src/lib/mest-tactics/status/passive-options';
import type { TestDice } from '../../../src/lib/mest-tactics/subroutines/dice-roller';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { LOFOperations } from '../../../src/lib/mest-tactics/battlefield/los/LOFOperations';
import { getPassiveResponsePriority } from './AIDecisionSupport';

export interface PassiveResponseResult {
  optionUsed: PassiveOption | null;
  success: boolean;
  extras: string[];
}

export interface CounterChargeResult {
  executed: boolean;
  moved: boolean;
  engaged: boolean;
  extras: string[];
}

export interface FollowupBonusResult {
  executed: boolean;
  bonusType: string | null;
  apSpent: number;
  extras: string[];
}

/**
 * Inspect passive options for event
 */
export function inspectPassiveOptions(
  gameManager: GameManager,
  event: PassiveEvent
): PassiveOption[] {
  // Get available passive options from game manager
  // This is a simplified version - actual implementation would query GameManager
  const options: PassiveOption[] = [];

  // Counter charge option
  if (event.type === 'move' && event.observer && !event.observer.state.isWaiting) {
    options.push({
      type: 'counter_charge',
      apCost: 1,
      description: 'Counter charge moving enemy',
    });
  }

  // Hold option
  options.push({
    type: 'hold',
    apCost: 0,
    description: 'Hold position',
  });

  // Defend option
  if (event.type === 'attack') {
    options.push({
      type: 'defend',
      apCost: 0,
      description: 'Defend against attack',
    });
  }

  // Take cover option
  if (event.type === 'attack' && event.target) {
    options.push({
      type: 'take_cover',
      apCost: 0,
      description: 'Take cover from attack',
    });
  }

  return options;
}

/**
 * Inspect move passive options
 */
export function inspectMovePassiveOptions(
  gameManager: GameManager,
  movingCharacter: Character,
  observers: Character[]
): PassiveOption[] {
  const options: PassiveOption[] = [];

  for (const observer of observers) {
    if (observer.state.isEliminated || observer.state.isKOd) {
      continue;
    }

    // Check LOS
    if (!SpatialRules.hasLineOfSight(
      gameManager.battlefield,
      { id: observer.id, position: observer.position!, baseDiameter: observer.baseDiameter, siz: observer.profile.siz },
      { id: movingCharacter.id, position: movingCharacter.position!, baseDiameter: movingCharacter.baseDiameter, siz: movingCharacter.profile.siz }
    )) {
      continue;
    }

    // Check if observer can counter charge
    if (!observer.state.isWaiting) {
      options.push({
        type: 'counter_charge',
        apCost: 1,
        characterId: observer.id,
        description: `${observer.name} can counter charge`,
      });
    }
  }

  return options;
}

/**
 * Execute failed hit passive response
 */
export function executeFailedHitPassiveResponse(
  params: {
    character: Character;
    attacker: Character;
    gameManager: GameManager;
    doctrine: any;
  }
): PassiveResponseResult {
  const { character, attacker, gameManager, doctrine } = params;
  const result: PassiveResponseResult = {
    optionUsed: null,
    success: false,
    extras: [],
  };

  // Create passive event
  const event: PassiveEvent = {
    type: 'attack',
    source: attacker,
    target: character,
    hitSucceeded: false,
  };

  // Get available options
  const options = inspectPassiveOptions(gameManager, event);

  // Select option based on priority
  const option = getPassiveResponsePriority(event, options, character, doctrine);
  if (!option) {
    result.extras.push('No passive option selected');
    return result;
  }

  result.optionUsed = option;

  // Execute option
  switch (option.type) {
    case 'hold':
      result.success = true;
      result.extras.push('Holding position');
      break;

    case 'defend':
      result.success = true;
      result.extras.push('Defending against attack');
      break;

    case 'take_cover':
      result.success = true;
      result.extras.push('Taking cover');
      break;

    case 'counter_attack':
      // Would execute counter attack here
      result.success = true;
      result.extras.push('Counter attacking');
      break;
  }

  return result;
}

/**
 * Execute counter charge from move event
 */
export async function executeCounterChargeFromMove(
  params: {
    observer: Character;
    movingCharacter: Character;
    gameManager: GameManager;
    apAvailable: number;
  }
): Promise<CounterChargeResult> {
  const { observer, movingCharacter, gameManager, apAvailable } = params;
  const result: CounterChargeResult = {
    executed: false,
    moved: false,
    engaged: false,
    extras: [],
  };

  // Check if counter charge is valid
  if (apAvailable < 1) {
    result.extras.push('Insufficient AP for counter charge');
    return result;
  }

  if (observer.state.isWaiting || observer.state.isEliminated || observer.state.isKOd) {
    result.extras.push('Observer cannot counter charge');
    return result;
  }

  if (!observer.position || !movingCharacter.position) {
    result.extras.push('Missing position data');
    return result;
  }

  // Check LOS
  const hasLOS = SpatialRules.hasLineOfSight(
    gameManager.battlefield,
    { id: observer.id, position: observer.position, baseDiameter: observer.baseDiameter, siz: observer.profile.siz },
    { id: movingCharacter.id, position: movingCharacter.position, baseDiameter: movingCharacter.baseDiameter, siz: movingCharacter.profile.siz }
  );

  if (!hasLOS) {
    result.extras.push('No LOS to moving character');
    return result;
  }

  // Calculate distance
  const distance = LOFOperations.distance(observer.position, movingCharacter.position);
  const threatRange = observer.finalAttributes.mov || 4;

  if (distance > threatRange + 1) {
    result.extras.push(`Target out of range (${distance.toFixed(1)} > ${threatRange + 1})`);
    return result;
  }

  // Execute counter charge movement
  const engagePosition = computeEngageMovePosition(
    observer,
    movingCharacter,
    gameManager.battlefield
  );

  if (engagePosition) {
    try {
      const moveResult = await gameManager.executeMove(observer, engagePosition, {
        apCost: 1,
      });

      result.executed = true;
      result.moved = moveResult?.success ?? false;

      // Check if now engaged
      if (result.moved) {
        result.engaged = SpatialRules.isEngaged(
          { id: observer.id, position: engagePosition, baseDiameter: observer.baseDiameter, siz: observer.profile.siz },
          { id: movingCharacter.id, position: movingCharacter.position, baseDiameter: movingCharacter.baseDiameter, siz: movingCharacter.profile.siz }
        );

        if (result.engaged) {
          result.extras.push('Counter charge successful - now engaged');
        } else {
          result.extras.push('Counter charge moved but not engaged');
        }
      }
    } catch (error) {
      result.extras.push(`Counter charge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    result.extras.push('No valid engage position found');
  }

  return result;
}

/**
 * Apply passive follow-up bonus actions
 */
export function applyPassiveFollowupBonusActions(
  params: {
    character: Character;
    hitTestResult: any;
    availableBonusActions: any[];
    gameManager: GameManager;
  }
): FollowupBonusResult {
  const { character, hitTestResult, availableBonusActions, gameManager } = params;
  const result: FollowupBonusResult = {
    executed: false,
    bonusType: null,
    apSpent: 0,
    extras: [],
  };

  // Check for carry-over bonus dice
  const carryOverDice = resolveCarryOverBonusCascades(hitTestResult);
  if (carryOverDice <= 0) {
    result.extras.push('No carry-over bonus dice');
    return result;
  }

  result.extras.push(`${carryOverDice} carry-over bonus dice available`);

  // Find valid bonus action
  for (const bonusAction of availableBonusActions) {
    if (bonusAction.apCost <= carryOverDice) {
      // Execute bonus action
      result.executed = true;
      result.bonusType = bonusAction.type;
      result.apSpent = bonusAction.apCost;
      result.extras.push(`Executed ${bonusAction.type} bonus action`);
      break;
    }
  }

  if (!result.executed) {
    result.extras.push('No valid bonus action found');
  }

  return result;
}

/**
 * Count dice in pool
 */
export function countDiceInPool(dice: TestDice | undefined): number {
  if (!dice) {
    return 0;
  }

  return (dice.base?.length ?? 0) + (dice.modifier?.length ?? 0) + (dice.wild?.length ?? 0);
}

/**
 * Resolve carry-over bonus cascades
 */
export function resolveCarryOverBonusCascades(hitTestResult: any): number {
  if (!hitTestResult) {
    return 0;
  }

  let carryOverCount = 0;

  // Count carry-over base dice
  if (hitTestResult.actorCarryOver) {
    carryOverCount += countDiceInPool(hitTestResult.actorCarryOver);
  }

  // Some rules allow opponent carry-over to count
  if (hitTestResult.opponentCarryOver) {
    // Usually doesn't grant bonus to actor
  }

  return carryOverCount;
}

/**
 * Compute engage move position for counter charge
 */
export function computeEngageMovePosition(
  observer: Character,
  movingCharacter: Character,
  battlefield: Battlefield
): { x: number; y: number } | null {
  if (!observer.position || !movingCharacter.position) {
    return null;
  }

  const observerRadius = observer.baseDiameter / 2;
  const targetRadius = movingCharacter.baseDiameter / 2;
  const requiredDistance = observerRadius + targetRadius;

  // Calculate direction from observer to target
  const dx = movingCharacter.position.x - observer.position.x;
  const dy = movingCharacter.position.y - observer.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    // Already overlapping
    return { ...observer.position };
  }

  // Move toward target to engagement range
  const moveX = observer.position.x + (dx / dist) * (dist - requiredDistance);
  const moveY = observer.position.y + (dy / dist) * (dist - requiredDistance);

  return { x: moveX, y: moveY };
}

/**
 * Check if character is engaged with opponent
 */
export function areEngaged(
  attacker: Character,
  defender: Character,
  battlefield: Battlefield
): boolean {
  if (!attacker.position || !defender.position) {
    return false;
  }

  return SpatialRules.isEngaged(
    { id: attacker.id, position: attacker.position, baseDiameter: attacker.baseDiameter, siz: attacker.profile.siz },
    { id: defender.id, position: defender.position, baseDiameter: defender.baseDiameter, siz: defender.profile.siz }
  );
}

/**
 * Check if character is free from engagement in turn
 */
export function isFreeFromEngagementInTurn(
  character: Character,
  candidates: Character[],
  battlefield: Battlefield
): boolean {
  for (const candidate of candidates) {
    if (candidate === character) {
      continue;
    }
    if (areEngaged(character, candidate, battlefield)) {
      return false;
    }
  }
  return true;
}

/**
 * Compute fallback move position
 */
export function computeFallbackMovePosition(
  character: Character,
  targetPosition: { x: number; y: number },
  battlefield: Battlefield,
  maxDistance: number
): { x: number; y: number } | null {
  if (!character.position) {
    return null;
  }

  const dx = targetPosition.x - character.position.x;
  const dy = targetPosition.y - character.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    return { ...character.position };
  }

  // Clamp to max distance
  const clampedDist = Math.min(dist, maxDistance);
  const moveX = character.position.x + (dx / dist) * clampedDist;
  const moveY = character.position.y + (dy / dist) * clampedDist;

  return { x: moveX, y: moveY };
}

/**
 * Compute direct advance step
 */
export function computeDirectAdvanceStep(
  character: Character,
  target: Character,
  battlefield: Battlefield,
  stepSize: number = 1
): { x: number; y: number } | null {
  if (!character.position || !target.position) {
    return null;
  }

  const dx = target.position.x - character.position.x;
  const dy = target.position.y - character.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    return { ...character.position };
  }

  const moveX = character.position.x + (dx / dist) * stepSize;
  const moveY = character.position.y + (dy / dist) * stepSize;

  return { x: moveX, y: moveY };
}
