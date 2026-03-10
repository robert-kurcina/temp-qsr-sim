import { describe, expect, it, vi } from 'vitest';
import { Battlefield } from '../../battlefield/Battlefield';
import { Character, Profile } from '../../core';
import { ActionDecision } from '../core/AIController';
import {
  isEngagedWithEnemyTargetForGameLoop,
  isValidDecisionForGameLoop,
  resolveReachableMoveDestinationForGameLoop,
  sanitizeDecisionForExecutionForGameLoop,
} from './DecisionSanitizationSupport';
import { runCharacterTurnForGameLoop } from './CharacterTurnRunner';

function makeTestProfile(name: string): Profile {
  return {
    name,
    archetype: {
      name: 'Average',
      attributes: {
        cca: 2,
        rca: 2,
        ref: 2,
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

function makeTestCharacter(name: string): Character {
  const character = new Character(makeTestProfile(name));
  character.finalAttributes = character.attributes;
  return character;
}

function makeTestMeleeWeapon(traits: string[] = []): any {
  return {
    name: 'test-weapon',
    class: 'Melee',
    classification: 'Melee',
    type: 'Weapon',
    bp: 1,
    traits,
  };
}

describe('DecisionSanitizationSupport P0 legality gates', () => {
  it('rejects close combat decisions when target is outside melee engagement', () => {
    const battlefield = new Battlefield(24, 24);
    const actor = makeTestCharacter('actor');
    const target = makeTestCharacter('target');
    battlefield.placeCharacter(actor, { x: 4, y: 12 });
    battlefield.placeCharacter(target, { x: 10, y: 12 });

    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'illegal melee at range',
      priority: 3,
      requiresAP: true,
    };

    const valid = isValidDecisionForGameLoop(decision, actor, {
      battlefield,
      getEnemyCharacters: () => [target],
      hasRangedWeapon: () => false,
    });

    expect(valid).toBe(false);
  });

  it('accepts close combat decisions when target is within Reach envelope', () => {
    const battlefield = new Battlefield(24, 24);
    const actor = makeTestCharacter('actor');
    const target = makeTestCharacter('target');
    actor.allTraits = [{ name: 'Reach', level: 1 } as any];
    (actor.profile as any).items = [makeTestMeleeWeapon()];
    (actor.profile as any).equipment = [makeTestMeleeWeapon()];
    battlefield.placeCharacter(actor, { x: 4, y: 12 });
    battlefield.placeCharacter(target, { x: 6, y: 12 }); // edge distance 1.0 MU

    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'reach melee legal',
      priority: 3,
      requiresAP: true,
    };

    const valid = isValidDecisionForGameLoop(decision, actor, {
      battlefield,
      getEnemyCharacters: () => [target],
      hasRangedWeapon: () => false,
    });

    expect(isEngagedWithEnemyTargetForGameLoop(actor, target, battlefield)).toBe(true);
    expect(valid).toBe(true);
  });

  it('accepts close combat decisions when target is only in Overreach envelope', () => {
    const battlefield = new Battlefield(24, 24);
    const actor = makeTestCharacter('actor');
    const target = makeTestCharacter('target');
    (actor.profile as any).items = [makeTestMeleeWeapon()];
    (actor.profile as any).equipment = [makeTestMeleeWeapon()];
    battlefield.placeCharacter(actor, { x: 4, y: 12 });
    battlefield.placeCharacter(target, { x: 6, y: 12 }); // edge distance 1.0 MU

    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'overreach melee legal',
      priority: 3,
      requiresAP: true,
    };

    const valid = isValidDecisionForGameLoop(decision, actor, {
      battlefield,
      getEnemyCharacters: () => [target],
      hasRangedWeapon: () => false,
    });

    expect(isEngagedWithEnemyTargetForGameLoop(actor, target, battlefield)).toBe(true);
    expect(valid).toBe(true);
  });

  it('rejects overreach-only close combat when it is not the first action', () => {
    const battlefield = new Battlefield(24, 24);
    const actor = makeTestCharacter('actor');
    const target = makeTestCharacter('target');
    (actor.profile as any).items = [makeTestMeleeWeapon()];
    (actor.profile as any).equipment = [makeTestMeleeWeapon()];
    battlefield.placeCharacter(actor, { x: 4, y: 12 });
    battlefield.placeCharacter(target, { x: 6, y: 12 }); // edge distance 1.0 MU (overreach envelope)

    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'overreach no longer legal on second action',
      priority: 3,
      requiresAP: true,
    };

    const valid = isValidDecisionForGameLoop(
      decision,
      actor,
      {
        battlefield,
        getEnemyCharacters: () => [target],
        hasRangedWeapon: () => false,
      },
      {
        actionsTakenThisInitiative: 1,
      }
    );

    expect(valid).toBe(false);
  });

  it('rejects charge decisions when actor is already engaged', () => {
    const battlefield = new Battlefield(24, 24);
    const actor = makeTestCharacter('actor');
    const engagedEnemy = makeTestCharacter('engaged-enemy');
    const chargeTarget = makeTestCharacter('charge-target');

    battlefield.placeCharacter(actor, { x: 4, y: 12 });
    battlefield.placeCharacter(engagedEnemy, { x: 5, y: 12 }); // engaged at start
    battlefield.placeCharacter(chargeTarget, { x: 12, y: 12 });

    const decision: ActionDecision = {
      type: 'charge',
      target: chargeTarget,
      position: { x: 11, y: 12 },
      reason: 'illegal charge while engaged',
      priority: 3,
      requiresAP: true,
    };

    const valid = isValidDecisionForGameLoop(decision, actor, {
      battlefield,
      getEnemyCharacters: () => [engagedEnemy, chargeTarget],
      hasRangedWeapon: () => false,
    });

    expect(valid).toBe(false);
  });

  it('falls back when close combat decision is not legally engaged', () => {
    const battlefield = new Battlefield(24, 24);
    const actor = makeTestCharacter('actor');
    const target = makeTestCharacter('target');
    battlefield.placeCharacter(actor, { x: 4, y: 12 });
    battlefield.placeCharacter(target, { x: 10, y: 12 });

    const fallbackDecision: ActionDecision = {
      type: 'move',
      position: { x: 6, y: 12 },
      reason: 'fallback',
      priority: 2,
      requiresAP: true,
    };

    const fallbackSpy = vi.fn(() => fallbackDecision);
    const sanitized = sanitizeDecisionForExecutionForGameLoop(
      actor,
      {
        type: 'close_combat',
        target,
        reason: 'invalid direct melee',
        priority: 3,
        requiresAP: true,
      },
      2,
      {
        battlefield,
        getEnemyCharacters: () => [target],
        hasRangedWeapon: () => false,
        hasMeleeWeapon: () => true,
        fallbackDecision: fallbackSpy,
      }
    );

    expect(fallbackSpy).toHaveBeenCalledTimes(1);
    expect(sanitized).toEqual(fallbackDecision);
  });

  it('falls back when close combat only works via overreach on a non-first action', () => {
    const battlefield = new Battlefield(24, 24);
    const actor = makeTestCharacter('actor');
    const target = makeTestCharacter('target');
    (actor.profile as any).items = [makeTestMeleeWeapon()];
    (actor.profile as any).equipment = [makeTestMeleeWeapon()];
    battlefield.placeCharacter(actor, { x: 4, y: 12 });
    battlefield.placeCharacter(target, { x: 6, y: 12 });

    const fallbackDecision: ActionDecision = {
      type: 'move',
      position: { x: 6, y: 12 },
      reason: 'fallback',
      priority: 2,
      requiresAP: true,
    };

    const fallbackSpy = vi.fn(() => fallbackDecision);
    const sanitized = sanitizeDecisionForExecutionForGameLoop(
      actor,
      {
        type: 'close_combat',
        target,
        reason: 'invalid second-action overreach',
        priority: 3,
        requiresAP: true,
      },
      2,
      {
        battlefield,
        getEnemyCharacters: () => [target],
        hasRangedWeapon: () => false,
        hasMeleeWeapon: () => true,
        fallbackDecision: fallbackSpy,
      },
      {
        actionsTakenThisInitiative: 1,
      }
    );

    expect(fallbackSpy).toHaveBeenCalledTimes(1);
    expect(sanitized).toEqual(fallbackDecision);
  });

  it('clamps over-range move destinations to legal partial movement', () => {
    const battlefield = new Battlefield(24, 24);
    const actor = makeTestCharacter('actor');
    battlefield.placeCharacter(actor, { x: 2, y: 2 });

    const resolved = resolveReachableMoveDestinationForGameLoop(
      actor,
      { x: 20, y: 2 },
      battlefield
    );

    expect(resolved).toBeTruthy();
    const start = battlefield.getCharacterPosition(actor)!;
    const distance = Math.hypot((resolved!.x - start.x), (resolved!.y - start.y));
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThanOrEqual(6.05); // MOV 4 + 2 MU allowance
  });
});

describe('CharacterTurnRunner AP continuity', () => {
  it('continues consuming AP across multiple legal actions in one activation', () => {
    const actor = {
      id: 'actor',
      profile: { name: 'actor' },
      state: { isEliminated: false, isKOd: false, isDistracted: false },
    } as unknown as Character;

    let ap = 2;
    const manager = {
      currentTurn: 1,
      getApRemaining: vi.fn(() => ap),
      getCharacterPosition: vi.fn(() => ({ x: 4, y: 4 })),
    };

    const decision: ActionDecision = {
      type: 'move',
      position: { x: 6, y: 4 },
      reason: 'advance',
      priority: 2,
      requiresAP: true,
    };

    const sanitizeDecisionForExecution = vi.fn(
      (_: Character, d: ActionDecision, _ap: number, _actionsTakenThisInitiative?: number) => d
    );

    const result = runCharacterTurnForGameLoop(actor, 1, {
      manager: manager as any,
      battlefield: {} as any,
      executor: {
        executeAction: vi.fn((chosen: ActionDecision) => {
          if (chosen.requiresAP && ap > 0) {
            ap -= 1;
          }
          return {
            success: true,
            action: chosen,
            character: actor,
            replanningRecommended: false,
          };
        }),
      } as any,
      auditService: null,
      maxActionsPerTurn: 3,
      getAIDecision: vi.fn(() => decision),
      getAggressiveFallbackDecision: vi.fn(() => null),
      getAlternativeDecision: vi.fn(() => null),
      sanitizeDecisionForExecution,
      createExecutionContext: vi.fn(() => ({
        currentTurn: 1,
        currentRound: 1,
        apRemaining: ap,
        allies: [],
        enemies: [],
        battlefield: {} as any,
      })),
      captureModelState: vi.fn(() => ({
        wounds: 0,
        delayTokens: 0,
        fearTokens: 0,
        isKOd: false,
        isEliminated: false,
        isHidden: false,
        isWaiting: false,
        isAttentive: true,
        isOrdered: true,
      })),
      getSideNameForCharacter: vi.fn(() => 'Alpha'),
      findCharacterSide: vi.fn(() => 'A'),
      buildPressureTopologySignature: vi.fn(() => undefined),
    });

    expect(result.totalActions).toBe(2);
    expect(result.successfulActions).toBe(2);
    expect(result.failedActions).toBe(0);
    expect(ap).toBe(0);
    expect(sanitizeDecisionForExecution).toHaveBeenNthCalledWith(
      1,
      actor,
      decision,
      2,
      0
    );
    expect(sanitizeDecisionForExecution).toHaveBeenNthCalledWith(
      2,
      actor,
      decision,
      1,
      1
    );
  });
});
