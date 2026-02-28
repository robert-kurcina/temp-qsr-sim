/**
 * Bonus Actions Unit Tests
 *
 * Tests for all 8 Bonus Actions with Additional Clauses from MEST Tactics QSR:
 * - Circle (◆✷) - Adjust separation
 * - Disengage (—) - Become Free
 * - Hide (—) - Become Hidden
 * - Push-back (◆➔) - Reposition target away
 * - Pull-back (➔) - Reposition self away
 * - Reversal (◆✷) - Switch positions
 * - Reposition (—) - Move up to base-diameter
 * - Refresh (—) - Remove Delay token
 *
 * Additional Clauses tested:
 * - ◆ Diamond-Star: +1 cascade unless in base-contact
 * - ➔ Arrow: +1 cascade per Physicality difference
 * - ✷ Starburst: Adjust separation by base-diameter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/Terrain';
import {
  applyBonusAction,
  buildBonusActionOptions,
  computeBonusActionBudget,
  type BonusActionContext,
  type BonusActionSelection,
  type BonusActionType,
} from './bonus-actions';
import { getCharacterTraitLevel } from '../status/status-system';

// ============================================================================
// Test Helpers
// ============================================================================

const makeProfile = (
  name: string,
  attrs: { cca: number; rca: number; ref: number; int: number; pow: number; str: number; for: number; mov: number; siz: number },
  traits: string[] = []
): Profile => ({
  name,
  archetype: { attributes: attrs },
  items: [],
  totalBp: 0,
  adjustedBp: 0,
  adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
  physicality: 0,
  adjPhysicality: 0,
  durability: 0,
  adjDurability: 0,
  burden: { totalLaden: 0, totalBurden: 0 },
  totalHands: 0,
  totalDeflect: 0,
  totalAR: 0,
  finalTraits: traits,
  allTraits: traits,
});

function addSquareTerrain(
  battlefield: Battlefield,
  id: string,
  type: TerrainType,
  center: { x: number; y: number }
) {
  battlefield.addTerrain({
    id,
    type,
    vertices: [
      { x: center.x - 0.5, y: center.y - 0.5 },
      { x: center.x + 0.5, y: center.y - 0.5 },
      { x: center.x + 0.5, y: center.y + 0.5 },
      { x: center.x - 0.5, y: center.y + 0.5 },
    ],
  });
}

function createTestContext(
  battlefield: Battlefield,
  attacker: Character,
  target?: Character,
  cascades: number = 2,
  isCloseCombat: boolean = true,
  engaged: boolean = true
): BonusActionContext {
  return {
    battlefield,
    attacker,
    target,
    cascades,
    isCloseCombat,
    engaged,
  };
}

// ============================================================================
// BUDGET COMPUTATION TESTS
// ============================================================================

describe('Bonus Actions - Budget Computation', () => {
  describe('computeBonusActionBudget', () => {
    it('should provide 1 cascade base budget', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
      battlefield.placeCharacter(attacker, { x: 5, y: 5 });

      const budget = computeBonusActionBudget(createTestContext(battlefield, attacker, undefined, 2));
      expect(budget.cascades).toBe(2);
      expect(budget.maxActions).toBe(1);
    });

    it('should reduce cascades by 1 when Distracted', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
      attacker.state.delayTokens = 1; // Distracted
      battlefield.placeCharacter(attacker, { x: 5, y: 5 });

      const budget = computeBonusActionBudget(createTestContext(battlefield, attacker, undefined, 2));
      expect(budget.cascades).toBe(1);
    });

    it('should set cascades to 0 when [Blinders] and not Attentive', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }, ['[Blinders]']));
      attacker.state.isAttentive = false;
      battlefield.placeCharacter(attacker, { x: 5, y: 5 });

      const budget = computeBonusActionBudget(createTestContext(battlefield, attacker, undefined, 3));
      expect(budget.cascades).toBe(0);
    });

    it('should add Brawl cascades for Close Combat', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }, ['Brawl']));
      battlefield.placeCharacter(attacker, { x: 5, y: 5 });

      const budget = computeBonusActionBudget(createTestContext(battlefield, attacker, undefined, 2, true, true));
      expect(budget.cascades).toBe(3); // 2 base + 1 Brawl
    });

    it('should add Fight bonus to maxActions when Attentive', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }, ['Fight']));
      attacker.state.isAttentive = true;
      const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
      battlefield.placeCharacter(attacker, { x: 5, y: 5 });
      battlefield.placeCharacter(target, { x: 6, y: 5 });

      const budget = computeBonusActionBudget(createTestContext(battlefield, attacker, target, 3, true, true));
      expect(budget.maxActions).toBeGreaterThan(1); // Fight provides extra actions
    });
  });
});

// ============================================================================
// HIDE ACTION TESTS
// ============================================================================

describe('Bonus Actions - Hide (—)', () => {
  it('should allow Hide action when Free and Attentive', () => {
    const battlefield = new Battlefield(12, 12);
    addSquareTerrain(battlefield, 'cover', TerrainType.Blocking, { x: 3, y: 5 });
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    attacker.state.isAttentive = true;
    battlefield.placeCharacter(attacker, { x: 4, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, undefined, 2, true, false));
    const hideOption = options.find(o => o.type === 'Hide');
    expect(hideOption).toBeDefined();
    expect(hideOption?.available).toBe(true);
    expect(hideOption?.costCascades).toBe(1);
  });

  it('should not allow Hide when Engaged', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 2, true, true));
    const hideOption = options.find(o => o.type === 'Hide');
    expect(hideOption?.available).toBe(false);
  });
});

// ============================================================================
// REFRESH ACTION TESTS
// ============================================================================

describe('Bonus Actions - Refresh (—)', () => {
  it('should allow Refresh action when Free', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    attacker.state.delayTokens = 2;
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, undefined, 2, true, false));
    const refreshOption = options.find(o => o.type === 'Refresh');
    expect(refreshOption).toBeDefined();
    expect(refreshOption?.available).toBe(true);
    expect(refreshOption?.costCascades).toBe(1);
  });

  it('should remove 1 Delay token when Refresh is applied', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    attacker.state.delayTokens = 2;
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });

    const outcome = applyBonusAction(
      createTestContext(battlefield, attacker, undefined, 2, true, false),
      { type: 'Refresh' }
    );

    expect(outcome.executed).toBe(true);
    expect(outcome.refreshApplied).toBe(true);
    expect(outcome.spentCascades).toBe(1);
  });
});

// ============================================================================
// REPOSITION ACTION TESTS
// ============================================================================

describe('Bonus Actions - Reposition (—)', () => {
  it('should allow Reposition action when Free', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, undefined, 2, true, false));
    const repositionOption = options.find(o => o.type === 'Reposition');
    expect(repositionOption).toBeDefined();
    expect(repositionOption?.available).toBe(true);
    expect(repositionOption?.costCascades).toBe(1);
  });

  it('should allow extra cascades for additional movement', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, undefined, 3, true, false));
    const repositionOption = options.find(o => o.type === 'Reposition');
    expect(repositionOption?.maxExtraCascades).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// CIRCLE ACTION TESTS (◆✷)
// ============================================================================

describe('Bonus Actions - Circle (◆✷)', () => {
  it('should cost 1 cascade when in base-contact', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 }); // base-contact

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 2, true, true));
    const circleOption = options.find(o => o.type === 'Circle');
    expect(circleOption).toBeDefined();
    expect(circleOption?.costCascades).toBe(1);
  });

  it('should not be available with insufficient cascades', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 0, true, true));
    const circleOption = options.find(o => o.type === 'Circle');
    expect(circleOption?.available).toBe(false);
  });
});

// ============================================================================
// DISENGAGE ACTION TESTS (—)
// ============================================================================

describe('Bonus Actions - Disengage (—)', () => {
  it('should allow Disengage action when Engaged', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 2, true, true));
    const disengageOption = options.find(o => o.type === 'Disengage');
    expect(disengageOption).toBeDefined();
    expect(disengageOption?.available).toBe(true);
    expect(disengageOption?.costCascades).toBe(1);
  });

  it('should not be in options when Free', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, undefined, 2, true, false));
    const disengageOption = options.find(o => o.type === 'Disengage');
    // Disengage is only available when Engaged, so it won't be in options when Free
    expect(disengageOption).toBeUndefined();
  });
});

// ============================================================================
// PUSH-BACK ACTION TESTS (◆➔)
// ============================================================================

describe('Bonus Actions - Push-back (◆➔)', () => {
  it('should cost 1 cascade when in base-contact with equal Physicality', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 2, true, true));
    const pushBackOption = options.find(o => o.type === 'PushBack');
    expect(pushBackOption).toBeDefined();
    expect(pushBackOption?.costCascades).toBe(1);
  });

  it('should cost +1 cascade per Physicality difference (Arrow clause)', () => {
    const battlefield = new Battlefield(12, 12);
    // Attacker: STR 2, SIZ 3, Physicality 3
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    // Target: STR 4, SIZ 5, Physicality 5 (difference of 2)
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 4, for: 2, mov: 2, siz: 5 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 4, true, true));
    const pushBackOption = options.find(o => o.type === 'PushBack');
    // Arrow clause: +1 cascade per Physicality difference
    expect(pushBackOption?.costCascades).toBeGreaterThanOrEqual(2);
  });

  it('should apply Delay token when target moves into degraded terrain', () => {
    const battlefield = new Battlefield(12, 12);
    addSquareTerrain(battlefield, 'rough-cell', TerrainType.Rough, { x: 7, y: 5 });
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const outcome = applyBonusAction(
      createTestContext(battlefield, attacker, target, 2, true, true),
      { type: 'PushBack' }
    );

    expect(outcome.executed).toBe(true);
    expect(outcome.delayTokenApplied).toBe(true);
  });

  it('should apply Delay token when blocked by obstacle', () => {
    const battlefield = new Battlefield(12, 12);
    addSquareTerrain(battlefield, 'obstacle-cell', TerrainType.Obstacle, { x: 7, y: 5 });
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const outcome = applyBonusAction(
      createTestContext(battlefield, attacker, target, 2, true, true),
      { type: 'PushBack' }
    );

    expect(outcome.executed).toBe(true);
    expect(outcome.delayTokenApplied).toBe(true);
  });
});

// ============================================================================
// PULL-BACK ACTION TESTS (➔)
// ============================================================================

describe('Bonus Actions - Pull-back (➔)', () => {
  it('should cost 1 cascade when in base-contact with equal Physicality', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 2, true, true));
    const pullBackOption = options.find(o => o.type === 'PullBack');
    expect(pullBackOption?.costCascades).toBe(1);
  });

  it('should cost +1 cascade per Physicality difference (Arrow clause)', () => {
    const battlefield = new Battlefield(12, 12);
    // Attacker: STR 2, SIZ 3, Physicality 3
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    // Target: STR 4, SIZ 5, Physicality 5 (difference of 2)
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 4, for: 2, mov: 2, siz: 5 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 4, true, true));
    const pullBackOption = options.find(o => o.type === 'PullBack');
    expect(pullBackOption?.costCascades).toBeGreaterThanOrEqual(2);
  });

  it('should allow extra movement when Attacker Physicality > Target SIZ', () => {
    const battlefield = new Battlefield(12, 12);
    // Attacker: STR 4, SIZ 5, Physicality 5
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 4, for: 2, mov: 2, siz: 5 }));
    // Target: SIZ 2
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 2 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 4, true, true));
    const pullBackOption = options.find(o => o.type === 'PullBack');
    // Should allow extra cascades for additional movement
    expect(pullBackOption?.maxExtraCascades).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// REVERSAL ACTION TESTS (◆✷)
// ============================================================================

describe('Bonus Actions - Reversal (◆✷)', () => {
  it('should cost 1 cascade when in base-contact', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 2, true, true));
    const reversalOption = options.find(o => o.type === 'Reversal');
    expect(reversalOption).toBeDefined();
    expect(reversalOption?.costCascades).toBe(1);
  });

  it('should not be available with insufficient cascades', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(target, { x: 6, y: 5 });

    const options = buildBonusActionOptions(createTestContext(battlefield, attacker, target, 0, true, true));
    const reversalOption = options.find(o => o.type === 'Reversal');
    expect(reversalOption?.available).toBe(false);
  });
});

// ============================================================================
// TRAIT INTERACTION TESTS
// ============================================================================

describe('Bonus Actions - Trait Interactions', () => {
  describe('Brawl trait', () => {
    it('should add +1 cascade for Brawl 1', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }, ['Brawl']));
      battlefield.placeCharacter(attacker, { x: 5, y: 5 });

      const budget = computeBonusActionBudget(createTestContext(battlefield, attacker, undefined, 2, true, true));
      expect(budget.cascades).toBe(3); // 2 base + 1 Brawl
    });
  });

  describe('Fight trait', () => {
    it('should add extra maxActions when Fight > opponent', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }, ['Fight']));
      attacker.state.isAttentive = true;
      const target = new Character(makeProfile('target', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }));
      battlefield.placeCharacter(attacker, { x: 5, y: 5 });
      battlefield.placeCharacter(target, { x: 6, y: 5 });

      const budget = computeBonusActionBudget(createTestContext(battlefield, attacker, target, 3, true, true));
      expect(budget.maxActions).toBeGreaterThan(1);
    });
  });

  describe('[Blinders] trait', () => {
    it('should reduce cascades to 0 when not Attentive', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }, ['[Blinders]']));
      attacker.state.isAttentive = false;
      battlefield.placeCharacter(attacker, { x: 5, y: 5 });

      const budget = computeBonusActionBudget(createTestContext(battlefield, attacker, undefined, 3, true, true));
      expect(budget.cascades).toBe(0);
    });

    it('should allow cascades when Attentive', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov: 2, siz: 3 }, ['[Blinders]']));
      attacker.state.isAttentive = true;
      battlefield.placeCharacter(attacker, { x: 5, y: 5 });

      const budget = computeBonusActionBudget(createTestContext(battlefield, attacker, undefined, 2, true, true));
      expect(budget.cascades).toBe(2);
    });
  });
});

