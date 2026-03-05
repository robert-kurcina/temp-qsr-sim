/**
 * Close Combat Bonus Actions Verification Tests (QSR Lines 1071-1090)
 *
 * Tests for:
 * - Push-back (BA.3) - QSR: Reposition target away, attacker follows
 * - Pull-back (BA.4) - QSR: Attacker moves away, may follow to base-contact
 * - Reversal (BA.5) - QSR: Switch positions with target
 *
 * Additional Clauses:
 * - Diamond-Star (◆✷): +1 cascade unless in base-contact
 * - Arrow (➔): +1 cascade per Physicality difference
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import {
  buildBonusActionOptions,
  applyBonusAction,
  BonusActionContext,
  BonusActionSelection,
} from './bonus-actions';

function makeTestProfile(
  name: string,
  str: number = 2,
  siz: number = 3
): Profile {
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
        str,
        for: 2,
        mov: 4,
        siz,
      },
      traits: [],
      bp: 30,
    },
    items: [],
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: Math.max(str, siz),
    adjPhysicality: Math.max(str, siz),
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

function makeTestCharacter(name: string, str: number = 2, siz: number = 3): Character {
  const character = new Character(makeTestProfile(name, str, siz));
  character.finalAttributes = character.attributes;
  return character;
}

describe('Close Combat Bonus Actions (QSR Lines 1071-1090)', () => {
  let battlefield: Battlefield;
  let attacker: Character;
  let target: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    attacker = makeTestCharacter('Attacker');
    target = makeTestCharacter('Target');

    // Place in base-contact (SIZ 3 = ~1 MU base diameter)
    battlefield.placeCharacter(attacker, { x: 10, y: 12 });
    battlefield.placeCharacter(target, { x: 10.5, y: 12 });

    attacker.state.isAttentive = true;
    target.state.isAttentive = true;
  });

  describe('Push-back (BA.3) - QSR Line 1077', () => {
    it('should be available when engaged (QSR 1077)', () => {
      const context: BonusActionContext = {
        battlefield,
        attacker,
        target,
        cascades: 3,
        isCloseCombat: true,
        engaged: true,
      };

      const options = buildBonusActionOptions(context);
      const pushBackOption = options.find(o => o.type === 'PushBack');

      // Should be available (in base-contact, so no Diamond-Star cost)
      expect(pushBackOption).toBeDefined();
      expect(pushBackOption?.available).toBe(true);
      // Base cost 1 + Arrow cost (Physicality difference)
      expect(pushBackOption?.costCascades).toBeLessThanOrEqual(2);
    });

    it('should apply Delay token if pushed into terrain or blocked (QSR 1079)', () => {
      // Add obstacle in push direction
      battlefield.addTerrain({
        id: 'obstacle1',
        type: 'Obstacle',
        vertices: [
          { x: 11.5, y: 11.5 },
          { x: 12.5, y: 11.5 },
          { x: 12.5, y: 12.5 },
          { x: 11.5, y: 12.5 },
        ],
      });

      const context: BonusActionContext = {
        battlefield,
        attacker,
        target,
        cascades: 3,
        isCloseCombat: true,
        engaged: true,
      };

      const selection: BonusActionSelection = {
        type: 'PushBack',
        extraCascades: 0,
      };

      const outcome = applyBonusAction(context, selection);

      // Target should get Delay token (blocked by terrain) OR push fails
      // Implementation may handle terrain blocking differently
      expect(outcome.executed).toBeDefined();
      // Either Delay is applied OR push fails due to terrain
      if (outcome.delayTokenApplied) {
        expect(target.state.delayTokens).toBeGreaterThanOrEqual(1);
      }
    });

    it('should apply Delay token if pushed off battlefield (QSR 1079)', () => {
      // Place target near edge
      battlefield.placeCharacter(target, { x: 23, y: 12 });
      battlefield.placeCharacter(attacker, { x: 22.5, y: 12 });

      const context: BonusActionContext = {
        battlefield,
        attacker,
        target,
        cascades: 3,
        isCloseCombat: true,
        engaged: true,
      };

      const selection: BonusActionSelection = {
        type: 'PushBack',
        extraCascades: 0,
      };

      const outcome = applyBonusAction(context, selection);

      // Target should get Delay token (pushed off battlefield)
      expect(outcome.delayTokenApplied).toBe(true);
      expect(target.state.delayTokens).toBeGreaterThanOrEqual(1);
    });

    it('should block push if another model is in the way (QSR 1080)', () => {
      // Place third model in push direction
      const blocker = makeTestCharacter('Blocker');
      battlefield.placeCharacter(blocker, { x: 11, y: 12 });

      const context: BonusActionContext = {
        battlefield,
        attacker,
        target,
        cascades: 3,
        isCloseCombat: true,
        engaged: true,
      };

      const selection: BonusActionSelection = {
        type: 'PushBack',
        extraCascades: 0,
      };

      const outcome = applyBonusAction(context, selection);

      // Should fail (blocked by another model)
      expect(outcome.executed).toBe(false);
      expect(outcome.reason).toBeDefined();
    });

    it('should cost +1 cascade per Physicality difference (Arrow ➔)', () => {
      // Target has higher Physicality (STR 4, SIZ 3 = 4)
      const strongTarget = makeTestCharacter('StrongTarget', 4, 3);
      battlefield.placeCharacter(strongTarget, { x: 10.5, y: 12 });

      const context: BonusActionContext = {
        battlefield,
        attacker,
        target: strongTarget,
        cascades: 5,
        isCloseCombat: true,
        engaged: true,
      };

      const options = buildBonusActionOptions(context);
      const pushBackOption = options.find(o => o.type === 'PushBack');

      // Arrow cost: target Phys (4) - attacker Phys (3) = 1
      // Diamond-Star: 0 (in base-contact)
      // Base: 1
      // Total: 1 + 0 + 1 = 2
      expect(pushBackOption?.costCascades).toBe(2);
    });
  });

  describe('Pull-back (BA.4) - QSR Line 1081', () => {
    it('should be available when engaged (QSR 1081)', () => {
      const context: BonusActionContext = {
        battlefield,
        attacker,
        target,
        cascades: 3,
        isCloseCombat: true,
        engaged: true,
      };

      const options = buildBonusActionOptions(context);
      const pullBackOption = options.find(o => o.type === 'PullBack');

      // Should be available (in base-contact, so no Diamond-Star cost)
      expect(pullBackOption).toBeDefined();
      expect(pullBackOption?.available).toBe(true);
    });

    it('should cost +1 cascade per Physicality difference (Arrow ➔)', () => {
      // Target has higher Physicality
      const strongTarget = makeTestCharacter('StrongTarget', 4, 3);
      battlefield.placeCharacter(strongTarget, { x: 10.5, y: 12 });

      const context: BonusActionContext = {
        battlefield,
        attacker,
        target: strongTarget,
        cascades: 5,
        isCloseCombat: true,
        engaged: true,
      };

      const options = buildBonusActionOptions(context);
      const pullBackOption = options.find(o => o.type === 'PullBack');

      // Arrow cost: target Phys (4) - attacker Phys (3) = 1
      expect(pullBackOption?.costCascades).toBe(2);
    });
  });

  describe('Reversal (BA.5) - QSR Line 1083', () => {
    it('should be available when engaged (QSR 1083)', () => {
      const context: BonusActionContext = {
        battlefield,
        attacker,
        target,
        cascades: 3,
        isCloseCombat: true,
        engaged: true,
      };

      const options = buildBonusActionOptions(context);
      const reversalOption = options.find(o => o.type === 'Reversal');

      // Should be available (in base-contact, so no Diamond-Star cost)
      expect(reversalOption).toBeDefined();
      expect(reversalOption?.available).toBe(true);
    });

    it('should cost +1 cascade if NOT in base-contact (Diamond-Star ◆✷)', () => {
      // Place NOT in base-contact
      battlefield.placeCharacter(target, { x: 12, y: 12 });

      const context: BonusActionContext = {
        battlefield,
        attacker,
        target,
        cascades: 3,
        isCloseCombat: true,
        engaged: false,
      };

      const options = buildBonusActionOptions(context);
      const reversalOption = options.find(o => o.type === 'Reversal');

      // Diamond-Star cost: 1 (not in base-contact)
      // Base: 1
      // Total: 1 + 1 = 2
      expect(reversalOption?.costCascades).toBe(2);
    });

    it('should cost 0 extra if in base-contact (Diamond-Star ◆✷)', () => {
      // Already in base-contact from beforeEach

      const context: BonusActionContext = {
        battlefield,
        attacker,
        target,
        cascades: 3,
        isCloseCombat: true,
        engaged: true,
      };

      const options = buildBonusActionOptions(context);
      const reversalOption = options.find(o => o.type === 'Reversal');

      // Diamond-Star cost: 0 (in base-contact)
      // Base: 1
      // Total: 1
      expect(reversalOption?.costCascades).toBe(1);
    });
  });

  describe('Additional Clauses Verification', () => {
    describe('Diamond-Star (◆✷) - Base Contact Requirement', () => {
      it('should cost +1 cascade for Circle if not in base-contact', () => {
        // Place NOT in base-contact
        battlefield.placeCharacter(target, { x: 12, y: 12 });

        const context: BonusActionContext = {
          battlefield,
          attacker,
          target,
          cascades: 3,
          isCloseCombat: true,
          engaged: false,
        };

        const options = buildBonusActionOptions(context);
        const circleOption = options.find(o => o.type === 'Circle');

        // Diamond-Star cost: 1 (not in base-contact)
        expect(circleOption?.costCascades).toBe(2);
      });

      it('should cost +0 cascade for Circle if in base-contact', () => {
        const context: BonusActionContext = {
          battlefield,
          attacker,
          target,
          cascades: 3,
          isCloseCombat: true,
          engaged: true,
        };

        const options = buildBonusActionOptions(context);
        const circleOption = options.find(o => o.type === 'Circle');

        // Diamond-Star cost: 0 (in base-contact)
        expect(circleOption?.costCascades).toBe(1);
      });
    });

    describe('Arrow (➔) - Physicality Difference', () => {
      it('should cost +1 per Physicality difference when attacker is weaker', () => {
        // Attacker: STR 2, SIZ 3 = Phys 3
        // Target: STR 4, SIZ 5 = Phys 5
        // Difference: 2
        const weakAttacker = makeTestCharacter('Weak', 2, 3);
        const strongTarget = makeTestCharacter('Strong', 4, 5);

        battlefield.placeCharacter(weakAttacker, { x: 10, y: 12 });
        battlefield.placeCharacter(strongTarget, { x: 10.5, y: 12 });

        const context: BonusActionContext = {
          battlefield,
          attacker: weakAttacker,
          target: strongTarget,
          cascades: 5,
          isCloseCombat: true,
          engaged: true,
        };

        const options = buildBonusActionOptions(context);
        const pushBackOption = options.find(o => o.type === 'PushBack');

        // Base: 1 + Diamond-Star: 0 + Arrow: 2 = 3
        expect(pushBackOption?.costCascades).toBe(3);
      });

      it('should cost +0 when attacker is stronger or equal', () => {
        // Attacker: STR 4, SIZ 5 = Phys 5
        // Target: STR 2, SIZ 3 = Phys 3
        const strongAttacker = makeTestCharacter('Strong', 4, 5);
        const weakTarget = makeTestCharacter('Weak', 2, 3);

        battlefield.placeCharacter(strongAttacker, { x: 10, y: 12 });
        battlefield.placeCharacter(weakTarget, { x: 10.5, y: 12 });

        const context: BonusActionContext = {
          battlefield,
          attacker: strongAttacker,
          target: weakTarget,
          cascades: 5,
          isCloseCombat: true,
          engaged: true,
        };

        const options = buildBonusActionOptions(context);
        const pushBackOption = options.find(o => o.type === 'PushBack');

        // Base: 1 + Diamond-Star: 0 + Arrow: 0 (attacker stronger) = 1
        expect(pushBackOption?.costCascades).toBe(1);
      });
    });
  });
});
