import { describe, it, expect, beforeEach } from 'vitest';
import { performCombatManeuver, CombatManeuverType } from './pushing-and-maneuvers';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { GameManager } from '../engine/GameManager';
import { CharacterStatus } from '../core/types';
import { Battlefield } from '../battlefield/Battlefield';

describe('Pushing Action', () => {
  let character: Character;
  let gameManager: GameManager;

  function createTestCharacter(name: string = 'Test'): Character {
    const profile: Profile = {
      name,
      archetype: { 
        attributes: { 
          cca: 2, rca: 2, ref: 2, int: 2, pow: 2,
          str: 2, for: 2, mov: 2, siz: 3 
        } 
      },
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
      finalTraits: [],
      allTraits: [],
    };
    return new Character(profile);
  }

  beforeEach(() => {
    character = createTestCharacter();
    const battlefield = new Battlefield(24, 24, []);
    gameManager = new GameManager([character], battlefield);
    gameManager.startRound();
    gameManager.beginActivation(character);
  });

  describe('performPushing', () => {
    it('should grant 1 AP and add 1 Delay token when character has no Delay tokens', () => {
      const initialAp = gameManager.getApRemaining(character);
      
      const result = gameManager.executePushing(character);
      
      expect(result.success).toBe(true);
      expect(result.apGained).toBe(1);
      expect(result.delayTokenAdded).toBe(true);
      expect(gameManager.getApRemaining(character)).toBe(initialAp + 1);
      expect(character.state.delayTokens).toBe(1);
    });

    it('should fail if character already has Delay tokens', () => {
      character.state.delayTokens = 1;
      
      const result = gameManager.executePushing(character);
      
      expect(result.success).toBe(false);
      expect(result.apGained).toBe(0);
      expect(result.reason).toBe('Character has Delay tokens');
    });

    it('should fail if character already pushed this Initiative', () => {
      // First push succeeds
      const result1 = gameManager.executePushing(character);
      expect(result1.success).toBe(true);
      
      // Remove the Delay token to test the "already pushed" check
      character.state.delayTokens = 0;
      
      // Second push should fail due to already having pushed
      const result2 = gameManager.executePushing(character);
      
      expect(result2.success).toBe(false);
      expect(result2.apGained).toBe(0);
      expect(result2.reason).toBe('Character already pushed this Initiative');
    });

    it('should reset hasPushedThisInitiative on new round', () => {
      // Push in first round
      gameManager.executePushing(character);
      
      // Start new round
      gameManager.startRound();
      gameManager.beginActivation(character);
      
      // Should be able to push again
      const result = gameManager.executePushing(character);
      
      expect(result.success).toBe(true);
    });
  });
});

describe('Combat Maneuvers', () => {
  describe('Push-back', () => {
    it('should push target away by active model base diameter with 1 cascade', () => {
      const activePos = { x: 0, y: 0 };
      const targetPos = { x: 1, y: 0 };
      const activeBaseDiameter = 1; // 1 MU for SIZ 3
      
      const result = performCombatManeuver(
        CombatManeuverType.PushBack,
        1, // 1 cascade available
        {} as Character, // active
        {} as Character, // target
        activePos,
        targetPos,
        activeBaseDiameter,
        1 // target base diameter
      );
      
      expect(result.success).toBe(true);
      expect(result.cascadesSpent).toBe(1);
      expect(result.targetRepositioned).toBeDefined();
      // Target should be pushed away from active
      if (result.targetRepositioned) {
        expect(result.targetRepositioned.x).toBeGreaterThan(targetPos.x);
      }
    });

    it('should push target +1 MU per 3 additional cascades', () => {
      const activePos = { x: 0, y: 0 };
      const targetPos = { x: 1, y: 0 };
      const activeBaseDiameter = 1;
      
      const result = performCombatManeuver(
        CombatManeuverType.PushBack,
        4, // 1 base + 3 extra = +1 MU
        {} as Character,
        {} as Character,
        activePos,
        targetPos,
        activeBaseDiameter,
        1
      );
      
      expect(result.success).toBe(true);
      expect(result.cascadesSpent).toBe(4);
      // Should push 2 MU total (1 base + 1 extra)
    });

    it('should fail with insufficient cascades', () => {
      const result = performCombatManeuver(
        CombatManeuverType.PushBack,
        0, // No cascades
        {} as Character,
        {} as Character,
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        1,
        1
      );
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Insufficient cascades');
    });
  });

  describe('Pull-back', () => {
    it('should pull active model back by larger base diameter', () => {
      const activePos = { x: 1, y: 0 };
      const targetPos = { x: 0, y: 0 };
      
      const result = performCombatManeuver(
        CombatManeuverType.PullBack,
        2, // 2 cascades required
        {} as Character,
        {} as Character,
        activePos,
        targetPos,
        1, // active base diameter
        1.5 // target base diameter (larger)
      );
      
      expect(result.success).toBe(true);
      expect(result.cascadesSpent).toBe(2);
      expect(result.activeRepositioned).toBeDefined();
    });

    it('should fail with insufficient cascades', () => {
      const result = performCombatManeuver(
        CombatManeuverType.PullBack,
        1, // Need 2 cascades
        {} as Character,
        {} as Character,
        { x: 1, y: 0 },
        { x: 0, y: 0 },
        1,
        1
      );
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Insufficient cascades');
    });
  });

  describe('Reversal', () => {
    it('should swap positions with target', () => {
      const activePos = { x: 0, y: 0 };
      const targetPos = { x: 1, y: 0 };
      
      const result = performCombatManeuver(
        CombatManeuverType.Reversal,
        2, // 2 cascades required
        {} as Character,
        {} as Character,
        activePos,
        targetPos,
        1,
        1
      );
      
      expect(result.success).toBe(true);
      expect(result.cascadesSpent).toBe(2);
      expect(result.activeRepositioned).toEqual(targetPos);
      expect(result.targetRepositioned).toEqual(activePos);
    });

    it('should fail with insufficient cascades', () => {
      const result = performCombatManeuver(
        CombatManeuverType.Reversal,
        1, // Need 2 cascades
        {} as Character,
        {} as Character,
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        1,
        1
      );
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Insufficient cascades');
    });
  });
});
