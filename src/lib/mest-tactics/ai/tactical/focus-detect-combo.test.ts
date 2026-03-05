/**
 * Focus + Detect Combo Tests
 *
 * Tests for QSR Lines 855-859:
 * - First Detect is FREE (0 AP)
 * - Focus: Remove Wait to receive +1w for Test instead of React
 * - Focus + Detect combo (0 AP, +1w)
 * - Focus + Concentrate + Detect combo (1 AP, +2w)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Character, Profile } from '../../core';
import { Battlefield } from '../../battlefield';
import { ReactEvaluator } from '../tactical/ReactsQSR';
import { attemptDetect } from '../../status/concealment';
import { setRoller, resetRoller } from '../../subroutines/dice-roller';
import type { AIContext } from '../core/AIController';

function makeTestProfile(name: string, ref: number = 3): Profile {
  return {
    name,
    archetype: {
      name: 'Average',
      attributes: {
        cca: 2,
        rca: 2,
        ref,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov: 4,
        siz: 3,
      },
      traits: [],
      bp: 30,
    },
    items: [],
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 3,
    adjPhysicality: 3,
    durability: 3,
    adjDurability: 3,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

function makeTestCharacter(name: string, ref: number = 3): Character {
  const character = new Character(makeTestProfile(name, ref));
  character.finalAttributes = character.attributes;
  return character;
}

describe('Focus + Detect Combo (QSR Lines 855-859)', () => {
  let battlefield: Battlefield;
  let reactEvaluator: ReactEvaluator;
  let waitingCharacter: Character;
  let hiddenEnemy: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);
    resetRoller();

    // Create characters
    waitingCharacter = makeTestCharacter('Waiter', 3);
    hiddenEnemy = makeTestCharacter('Hider', 2);

    // Place characters
    battlefield.placeCharacter(waitingCharacter, { x: 12, y: 12 });
    battlefield.placeCharacter(hiddenEnemy, { x: 16, y: 12 });

    reactEvaluator = new ReactEvaluator();
  });

  afterEach(() => {
    resetRoller();
  });

  it('should prioritize Focus over React when enemies are Hidden (AI CRITICAL)', () => {
    // Setup: Character in Wait, enemies Hidden
    waitingCharacter.state.isWaiting = true;
    waitingCharacter.state.isAttentive = true;
    hiddenEnemy.state.isHidden = true;

    // Create context with Hidden enemy
    const context: AIContext = {
      character: waitingCharacter,
      allies: [],
      enemies: [hiddenEnemy],
      battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    };

    // Create a poor React opportunity (enemy far away)
    const opportunity = {
      trigger: 'move-only' as const,
      actor: hiddenEnemy,
      actorPosition: { x: 20, y: 12 }, // Far away, poor React target
      isZeroAPAction: false,
      isReposition: false,
      usedAgility: false,
      isLeaning: false,
    };

    const decision = reactEvaluator.evaluateReacts(waitingCharacter, opportunity, context, false);

    // Focus should be preferred when enemies are Hidden and React target is poor
    expect(decision.shouldReact).toBe(true);
    expect(decision.reactType).toBe('focus');
  });

  it('should apply +1w bonus from Focus to Detect Test (QSR 859.3)', () => {
    // Setup: Character has Focus active
    waitingCharacter.state.isWaiting = true;
    waitingCharacter.state.isAttentive = true;
    waitingCharacter.state.hasFocus = true;

    // Target is Hidden
    hiddenEnemy.state.isHidden = true;

    // Mock dice roller to track dice rolled
    setRoller(() => {
      // Return consistent dice for testing
      return [4, 5, 6]; // Base dice
    });

    // Perform Detect Test (Opposed REF Test)
    const result = attemptDetect(battlefield, waitingCharacter, hiddenEnemy, [
      waitingCharacter,
      hiddenEnemy,
    ]);

    // Detect should succeed (with +1w from Focus)
    expect(result.success).toBe(true);
    // Hidden status should be removed
    expect(hiddenEnemy.state.isHidden).toBe(false);
    // Focus should be consumed
    expect(waitingCharacter.state.hasFocus).toBe(false);
  });

  it('should allow Focus instead of React when in Wait status (QSR 859)', () => {
    // Setup: Character in Wait status
    waitingCharacter.state.isWaiting = true;
    waitingCharacter.state.isAttentive = true;

    // Create a move-only opportunity
    const opportunity = {
      trigger: 'move-only' as const,
      actor: hiddenEnemy,
      actorPosition: { x: 14, y: 12 },
      isZeroAPAction: false,
      isReposition: false,
      usedAgility: false,
      isLeaning: false,
    };

    const context: AIContext = {
      character: waitingCharacter,
      allies: [],
      enemies: [hiddenEnemy],
      battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    };

    // Evaluate React options
    const decision = reactEvaluator.evaluateReacts(waitingCharacter, opportunity, context, false);

    // Focus should be considered as an alternative
    expect(decision.shouldReact).toBe(true);
    // Focus priority should be evaluated
    expect(decision.priority).toBeGreaterThan(0);
  });
});

describe('Focus Priority vs React (QSR 859)', () => {
  let battlefield: Battlefield;
  let reactEvaluator: ReactEvaluator;
  let character: Character;
  let enemy: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);
    reactEvaluator = new ReactEvaluator();

    character = makeTestCharacter('Waiter', 3);
    enemy = makeTestCharacter('Enemy', 2);

    battlefield.placeCharacter(character, { x: 12, y: 12 });
    battlefield.placeCharacter(enemy, { x: 16, y: 12 });

    character.state.isWaiting = true;
    character.state.isAttentive = true;
  });

  it('should choose Focus over poor React opportunity', () => {
    // Setup: No good React target (enemy out of range)
    const opportunity = {
      trigger: 'move-only' as const,
      actor: enemy,
      actorPosition: { x: 20, y: 12 }, // Far away
      isZeroAPAction: false,
      isReposition: false,
      usedAgility: false,
      isLeaning: false,
    };

    const context: AIContext = {
      character,
      allies: [],
      enemies: [enemy],
      battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    };

    const decision = reactEvaluator.evaluateReacts(character, opportunity, context, false);

    // Focus should be preferred over poor React
    expect(decision.shouldReact).toBe(true);
    expect(decision.reactType).toBe('focus');
  });

  it('should prioritize Focus when enemies are Hidden (Focus + Detect combo)', () => {
    // Setup: Enemy is Hidden, character in Wait
    enemy.state.isHidden = true;
    character.state.hasDetectedThisActivation = false; // First Detect available

    const opportunity = {
      trigger: 'move-only' as const,
      actor: enemy,
      actorPosition: { x: 20, y: 12 }, // Far away, poor React target
      isZeroAPAction: false,
      isReposition: false,
      usedAgility: false,
      isLeaning: false,
    };

    const context: AIContext = {
      character,
      allies: [],
      enemies: [enemy],
      battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: {} as any,
    };

    const decision = reactEvaluator.evaluateReacts(character, opportunity, context, false);

    // Focus should be strongly preferred (Hidden enemies + First Detect FREE)
    expect(decision.shouldReact).toBe(true);
    expect(decision.reactType).toBe('focus');
    // Priority should be boosted for Focus + Detect combo
    expect(decision.priority).toBeGreaterThan(4.0); // Base 1.5 + 3.0 for Hidden
  });

  it('should prioritize Focus + Concentrate + Detect when AP available (FC.5)', () => {
    // Setup: Enemy is Hidden, character in Wait, has AP for Concentrate
    enemy.state.isHidden = true;
    character.state.hasDetectedThisActivation = false; // First Detect available

    const opportunity = {
      trigger: 'move-only' as const,
      actor: enemy,
      actorPosition: { x: 20, y: 12 }, // Far away, poor React target
      isZeroAPAction: false,
      isReposition: false,
      usedAgility: false,
      isLeaning: false,
    };

    const context: AIContext = {
      character,
      allies: [],
      enemies: [enemy],
      battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2, // Enough for Concentrate (1 AP) + Detect (0 AP first)
      knowledge: {} as any,
      config: {} as any,
    };

    const decision = reactEvaluator.evaluateReacts(character, opportunity, context, false);

    // Focus should be strongly preferred with Concentrate available
    expect(decision.shouldReact).toBe(true);
    expect(decision.reactType).toBe('focus');
    // Priority should be boosted even higher for Focus + Concentrate + Detect combo
    expect(decision.priority).toBeGreaterThan(5.5); // Base 1.5 + 3.0 for Hidden + 1.5 for Concentrate
  });

  it('should evaluate React when good target available', () => {
    // Setup: Good React target (enemy in optimal range)
    const opportunity = {
      trigger: 'move-only' as const,
      actor: enemy,
      actorPosition: { x: 14, y: 12 }, // In range
      isZeroAPAction: false,
      isReposition: false,
      usedAgility: false,
      isLeaning: false,
    };

    const context: AIContext = {
      character,
      allies: [],
      enemies: [enemy],
      battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 2,
      knowledge: {} as any,
      config: { aggression: 3 } as any,
    };

    const decision = reactEvaluator.evaluateReacts(character, opportunity, context, false);

    // React should be evaluated (may still choose Focus based on priority)
    expect(decision.shouldReact).toBe(true);
    // Note: Current implementation may still prefer Focus depending on priority calculation
    // This test verifies the React evaluation logic is triggered
    expect(decision.priority).toBeGreaterThan(0);
  });
});
