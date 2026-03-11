import { describe, expect, it } from 'vitest';
import { Character, Profile } from '../../../src/lib/mest-tactics/core';
import { StatisticsTracker } from './StatisticsTracker';
import type { AIResult } from '../../../src/lib/mest-tactics/ai/core/AIController';

function makeTestProfile(name: string): Profile {
  return {
    name,
    archetype: {
      attributes: {
        cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 4, siz: 3,
      },
    },
    items: [],
    totalBp: 30,
    adjustedBp: 30,
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

function makeDebug(overrides: Partial<NonNullable<AIResult['debug']>> = {}): NonNullable<AIResult['debug']> {
  return {
    consideredActions: [],
    scores: {},
    actionAvailability: {},
    reasoning: 'test',
    ...overrides,
  };
}

describe('StatisticsTracker', () => {
  it('tracks wait choice windows from action availability', () => {
    const tracker = new StatisticsTracker();
    const character = makeTestCharacter('model-a');
    tracker.initializeModelUsage([{ characters: [character], name: 'Alpha' }]);

    tracker.trackDecisionChoiceSet(character, makeDebug({ actionAvailability: { wait: 1 } }));
    const stats = tracker.getStats();
    const usage = tracker.getModelUsage(character);

    expect(stats.waitChoicesGiven).toBe(1);
    expect(usage?.waitChoicesGiven).toBe(1);
  });

  it('tracks attack gate and opportunity grade telemetry counters', () => {
    const tracker = new StatisticsTracker();
    const character = makeTestCharacter('model-b');
    tracker.initializeModelUsage([{ characters: [character], name: 'Alpha' }]);

    tracker.trackDecisionChoiceSet(character, makeDebug({
      actionAvailability: { wait: 1 },
      decisionTelemetry: {
        attackOpportunityGrade: 'immediate-low',
        coordinatorDirective: { priority: 'recover_deficit', urgency: 1.2 },
        selectedAction: 'close_combat',
        selectedScore: 2.1,
        bestAttackAction: 'close_combat',
        bestAttackScore: 2.1,
        bestPassiveAction: 'wait',
        bestPassiveScore: 2.6,
        attackGateApplied: true,
        attackGateReason: 'directive_attack_window',
      },
    }));

    tracker.trackDecisionChoiceSet(character, makeDebug({
      actionAvailability: { wait: 0 },
      decisionTelemetry: {
        attackOpportunityGrade: 'immediate-high',
        coordinatorDirective: { priority: 'press_advantage', urgency: 1.3 },
        selectedAction: 'close_combat',
        selectedScore: 3.4,
        bestAttackAction: 'close_combat',
        bestAttackScore: 3.4,
        bestPassiveAction: 'move',
        bestPassiveScore: 2.3,
        attackGateApplied: true,
        attackGateReason: 'immediate_high_window',
      },
    }));

    tracker.trackDecisionChoiceSet(character, makeDebug({
      actionAvailability: { wait: 0 },
      decisionTelemetry: {
        attackOpportunityGrade: 'none',
        coordinatorDirective: { priority: 'neutral', urgency: 0.6 },
        selectedAction: 'wait',
        selectedScore: 1.2,
        bestPassiveAction: 'wait',
        bestPassiveScore: 1.2,
        attackGateApplied: false,
      },
    }));

    const stats = tracker.getStats();
    expect(stats.decisionTelemetrySamples).toBe(3);
    expect(stats.attackGateAppliedDecisions).toBe(2);
    expect(stats.attackGateImmediateHighApplied).toBe(1);
    expect(stats.attackGateDirectiveApplied).toBe(1);
    expect(stats.attackOpportunityImmediateHigh).toBe(1);
    expect(stats.attackOpportunityImmediateLow).toBe(1);
    expect(stats.attackOpportunitySetup).toBe(0);
    expect(stats.attackOpportunityNone).toBe(1);
  });

  it('tracks damage tests from direct combat result payloads', () => {
    const tracker = new StatisticsTracker();
    tracker.trackCombatExtras({
      hitTestResult: { pass: true } as any,
      damageResolution: {
        damageTestResult: { pass: true },
      },
    } as any);

    const stats = tracker.getStats();
    expect(stats.hitTestsAttempted).toBe(1);
    expect(stats.hitTestsPassed).toBe(1);
    expect(stats.damageTestsAttempted).toBe(1);
    expect(stats.damageTestsPassed).toBe(1);
  });

  it('tracks damage tests from wrapped result payloads', () => {
    const tracker = new StatisticsTracker();
    tracker.trackCombatExtras({
      result: {
        hitTestResult: { pass: false },
        damageResolution: {
          damageTestResult: { pass: false },
        },
      },
    } as any);

    const stats = tracker.getStats();
    expect(stats.hitTestsAttempted).toBe(1);
    expect(stats.hitTestsFailed).toBe(1);
    expect(stats.damageTestsAttempted).toBe(1);
    expect(stats.damageTestsFailed).toBe(1);
  });

  it('splits combat assignment delay into damage vs passive/other buckets', () => {
    const tracker = new StatisticsTracker();
    tracker.trackCombatAssignmentsFromStep({
      actionType: 'close_combat',
      affectedModels: [
        {
          relation: 'target',
          before: {
            wounds: 0,
            fearTokens: 0,
            delayTokens: 0,
          },
          after: {
            wounds: 2,
            fearTokens: 0,
            delayTokens: 2,
          },
        },
      ],
      details: {
        damageAssignments: {
          wounds: 2,
          fear: 0,
          delay: 1,
        },
      },
    } as any);

    const stats = tracker.getStats();
    expect(stats.woundsAssigned).toBe(2);
    expect(stats.delayAssigned).toBe(2);
    expect(stats.damageWoundsAssigned).toBe(2);
    expect(stats.damageDelayAssigned).toBe(1);
    expect(stats.passiveOrOtherDelayAssigned).toBe(1);
  });
});
