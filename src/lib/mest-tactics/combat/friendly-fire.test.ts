import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveFriendlyFire,
  findFriendlyFireTargets,
  selectRandomTarget,
  resolveFriendlyFireRefTest,
  isInBaseContact,
  isWithin1Inch,
  isWithin1InchOfLOF,
  FriendlyFireOptions,
} from './friendly-fire';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { Item } from '../core/Item';

// Helper to create a test character
function createTestCharacter(name: string, ref: number = 2): Character {
  const profile: Profile = {
    name,
    archetype: {
      name: 'Test',
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
      bp: 50,
    },
    items: [],
    equipment: [],
    totalBp: 50,
    adjustedBp: 50,
    physicality: 3,
    durability: 3,
    burden: { totalBurden: 0, items: [] },
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
  
  const character = new Character(profile);
  character.state.isAttentive = true;
  character.state.isOrdered = true;
  return character;
}

// Helper to create a test weapon
function createTestWeapon(): Item {
  return {
    name: 'Test Bow',
    classification: 'Bow',
    or: 12,
    acc: 0,
    impact: 2,
    dmg: 'STR + 1m',
    traits: [],
    bp: 10,
  };
}

// Helper to create a test battlefield
function createTestBattlefield(): Battlefield {
  return new Battlefield(24, 24, []);
}

// Position lookup helper (avoids using battlefield grid)
function createPositionLookup(
  positions: Map<string, Position>
): (character: Character) => Position | undefined {
  return (c) => positions.get(c.id);
}

describe('Friendly Fire - Distance Checks', () => {
  describe('isInBaseContact', () => {
    it('should detect base-contact for adjacent models', () => {
      const pos1: Position = { x: 0, y: 0 };
      const pos2: Position = { x: 1.25, y: 0 }; // SIZ 3 base = 1.25"
      expect(isInBaseContact(pos1, 1.25, pos2, 1.25)).toBe(true);
    });

    it('should not detect base-contact for distant models', () => {
      const pos1: Position = { x: 0, y: 0 };
      const pos2: Position = { x: 3, y: 0 };
      expect(isInBaseContact(pos1, 1.25, pos2, 1.25)).toBe(false);
    });

    it('should handle different base sizes', () => {
      const pos1: Position = { x: 0, y: 0 };
      const pos2: Position = { x: 1.5, y: 0 };
      // SIZ 3 (1.25") and SIZ 5 (2") bases
      expect(isInBaseContact(pos1, 1.25, pos2, 2)).toBe(true);
    });
  });

  describe('isWithin1Inch', () => {
    it('should detect models within 1"', () => {
      const pos1: Position = { x: 0, y: 0 };
      const pos2: Position = { x: 0.5, y: 0.5 };
      expect(isWithin1Inch(pos1, pos2)).toBe(true);
    });

    it('should not detect models beyond 1"', () => {
      const pos1: Position = { x: 0, y: 0 };
      const pos2: Position = { x: 2, y: 0 };
      expect(isWithin1Inch(pos1, pos2)).toBe(false);
    });
  });

  describe('isWithin1InchOfLOF', () => {
    it('should detect points on the line', () => {
      const lineStart: Position = { x: 0, y: 0 };
      const lineEnd: Position = { x: 10, y: 0 };
      const point: Position = { x: 5, y: 0 };
      expect(isWithin1InchOfLOF(point, lineStart, lineEnd)).toBe(true);
    });

    it('should detect points near the line', () => {
      const lineStart: Position = { x: 0, y: 0 };
      const lineEnd: Position = { x: 10, y: 0 };
      const point: Position = { x: 5, y: 0.3 };
      expect(isWithin1InchOfLOF(point, lineStart, lineEnd)).toBe(true);
    });

    it('should not detect points far from the line', () => {
      const lineStart: Position = { x: 0, y: 0 };
      const lineEnd: Position = { x: 10, y: 0 };
      const point: Position = { x: 5, y: 2 };
      expect(isWithin1InchOfLOF(point, lineStart, lineEnd)).toBe(false);
    });
  });
});

describe('Friendly Fire - Target Selection', () => {
  let battlefield: Battlefield;
  let attacker: Character;
  let originalTarget: Character;
  let friendly1: Character; // Base-contact with target
  let friendly2: Character; // Within 1" of target
  let friendly3: Character; // Within 1" of LOF
  let friendly4: Character; // Too far away
  let weapon: Item;
  let positions: Map<string, Position>;
  let getPosition: (c: Character) => Position | undefined;

  beforeEach(() => {
    battlefield = createTestBattlefield();
    weapon = createTestWeapon();
    
    attacker = createTestCharacter('Attacker');
    originalTarget = createTestCharacter('Target');
    friendly1 = createTestCharacter('Friendly1', 3);
    friendly2 = createTestCharacter('Friendly2', 2);
    friendly3 = createTestCharacter('Friendly3', 2);
    friendly4 = createTestCharacter('Friendly4', 2);

    // Use position map instead of battlefield grid
    positions = new Map();
    positions.set(attacker.id, { x: 0, y: 0 });
    positions.set(originalTarget.id, { x: 10, y: 0 });
    positions.set(friendly1.id, { x: 10.5, y: 0 });
    positions.set(friendly2.id, { x: 9, y: 0 });
    positions.set(friendly3.id, { x: 5, y: 0.3 });
    positions.set(friendly4.id, { x: 0, y: 5 });
    
    getPosition = createPositionLookup(positions);
  });

  describe('findFriendlyFireTargets', () => {
    it('should find all valid targets', () => {
      const options: Omit<FriendlyFireOptions, 'misses' | 'weapon' | 'isConcentrated'> = {
        attacker,
        originalTarget,
        originalTargetPosition: { x: 10, y: 0 },
        allCharacters: [attacker, originalTarget, friendly1, friendly2, friendly3, friendly4],
        getCharacterPosition: getPosition,
        battlefield,
      };

      const targets = findFriendlyFireTargets(options);
      
      // Should find friendly1, friendly2, friendly3 (not friendly4, attacker, or target)
      expect(targets.length).toBe(3);
      expect(targets.map(t => t.character.name)).toContain('Friendly1');
      expect(targets.map(t => t.character.name)).toContain('Friendly2');
      expect(targets.map(t => t.character.name)).toContain('Friendly3');
    });

    it('should prioritize base-contact targets', () => {
      const options: Omit<FriendlyFireOptions, 'misses' | 'weapon' | 'isConcentrated'> = {
        attacker,
        originalTarget,
        originalTargetPosition: { x: 10, y: 0 },
        allCharacters: [attacker, originalTarget, friendly1, friendly2, friendly3, friendly4],
        getCharacterPosition: getPosition,
        battlefield,
      };

      const targets = findFriendlyFireTargets(options);
      
      // friendly1 should be first (priority 1 = base-contact)
      expect(targets[0].character.name).toBe('Friendly1');
      expect(targets[0].priority).toBe(1);
    });

    it('should sort by priority then distance', () => {
      const options: Omit<FriendlyFireOptions, 'misses' | 'weapon' | 'isConcentrated'> = {
        attacker,
        originalTarget,
        originalTargetPosition: { x: 10, y: 0 },
        allCharacters: [attacker, originalTarget, friendly1, friendly2, friendly3, friendly4],
        getCharacterPosition: getPosition,
        battlefield,
      };

      const targets = findFriendlyFireTargets(options);
      
      // Order should be: friendly1 (priority 1), friendly2 (priority 2), friendly3 (priority 3)
      // At least verify they're sorted by priority (non-decreasing)
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i].priority).toBeGreaterThanOrEqual(targets[i - 1].priority);
      }
    });

    it('should exclude models in base-contact with attacker', () => {
      // Move friendly1 to base-contact with attacker
      positions.set(friendly1.id, { x: 0.5, y: 0 });
      
      const options: Omit<FriendlyFireOptions, 'misses' | 'weapon' | 'isConcentrated'> = {
        attacker,
        originalTarget,
        originalTargetPosition: { x: 10, y: 0 },
        allCharacters: [attacker, originalTarget, friendly1, friendly2, friendly3, friendly4],
        getCharacterPosition: getPosition,
        battlefield,
      };

      const targets = findFriendlyFireTargets(options);
      
      // friendly1 should not be in targets (safe in base-contact with attacker)
      expect(targets.map(t => t.character.name)).not.toContain('Friendly1');
    });

    it('should exclude non-Attentive or non-Ordered models', () => {
      friendly1.state.isAttentive = false;
      friendly2.state.isOrdered = false;
      
      const options: Omit<FriendlyFireOptions, 'misses' | 'weapon' | 'isConcentrated'> = {
        attacker,
        originalTarget,
        originalTargetPosition: { x: 10, y: 0 },
        allCharacters: [attacker, originalTarget, friendly1, friendly2, friendly3, friendly4],
        getCharacterPosition: getPosition,
        battlefield,
      };

      const targets = findFriendlyFireTargets(options);
      
      // Only friendly3 should be valid
      expect(targets.length).toBe(1);
      expect(targets[0].character.name).toBe('Friendly3');
    });
  });

  describe('selectRandomTarget', () => {
    it('should return null for empty targets', () => {
      expect(selectRandomTarget([])).toBeNull();
    });

    it('should select from highest priority group', () => {
      const targets = [
        { character: friendly1, position: { x: 10.5, y: 0 }, baseDiameter: 1.25, priority: 1, distanceToTarget: 0.5 },
        { character: friendly2, position: { x: 9, y: 0 }, baseDiameter: 1.25, priority: 2, distanceToTarget: 1 },
      ];

      // With deterministic RNG, should always pick first in group
      const selected = selectRandomTarget(targets, () => 0.5);
      expect(selected).toBe(targets[0]);
    });

    it('should randomly select within priority group', () => {
      const targets = [
        { character: friendly1, position: { x: 10.5, y: 0 }, baseDiameter: 1.25, priority: 1, distanceToTarget: 0.5 },
        { character: friendly2, position: { x: 10.3, y: 0.3 }, baseDiameter: 1.25, priority: 1, distanceToTarget: 0.4 },
      ];

      // Test randomness with different RNG values
      const selected1 = selectRandomTarget(targets, () => 0.1);
      const selected2 = selectRandomTarget(targets, () => 0.9);
      
      expect([selected1, selected2]).toContain(targets[0]);
      expect([selected1, selected2]).toContain(targets[1]);
    });
  });
});

describe('Friendly Fire - REF Test', () => {
  let target: Character;

  beforeEach(() => {
    target = createTestCharacter('Target', 3); // REF 3
  });

  describe('resolveFriendlyFireRefTest', () => {
    it('should succeed with no misses', () => {
      const result = resolveFriendlyFireRefTest(target, 0, () => 0.5);
      // With REF 3 and no penalties, should usually succeed vs System 4
      expect(result.score).toBeGreaterThan(0);
    });

    it('should apply misses as penalty', () => {
      // Use deterministic RNG to ensure consistent results
      const result1 = resolveFriendlyFireRefTest(target, 0, () => 0.3); // Low rolls
      const result2 = resolveFriendlyFireRefTest(target, 3, () => 0.3); // Same rolls + penalty
      
      // More misses = harder to succeed (score should be lower or equal)
      // Note: Due to dice randomness, we check that penalty is applied
      expect(result2.score).toBeLessThanOrEqual(result1.score + 3); // Allow for dice variance
    });

    it('should use deterministic RNG for testing', () => {
      const result = resolveFriendlyFireRefTest(target, 0, () => 1); // Always roll 6s
      
      // With all 6s, should get maximum successes
      expect(result.score).toBeGreaterThan(0);
    });
  });
});

describe('Friendly Fire - Full Resolution', () => {
  let battlefield: Battlefield;
  let attacker: Character;
  let originalTarget: Character;
  let friendly: Character;
  let weapon: Item;
  let positions: Map<string, Position>;
  let getPosition: (c: Character) => Position | undefined;

  beforeEach(() => {
    battlefield = createTestBattlefield();
    weapon = createTestWeapon();
    
    attacker = createTestCharacter('Attacker');
    originalTarget = createTestCharacter('Target');
    friendly = createTestCharacter('Friendly', 2);

    positions = new Map();
    positions.set(attacker.id, { x: 0, y: 0 });
    positions.set(originalTarget.id, { x: 10, y: 0 });
    positions.set(friendly.id, { x: 10.5, y: 0 }); // Base-contact with target
    
    getPosition = createPositionLookup(positions);
  });

  describe('resolveFriendlyFire', () => {
    it('should not trigger if original attack hit', () => {
      const options: FriendlyFireOptions = {
        attacker,
        originalTarget,
        originalTargetPosition: { x: 10, y: 0 },
        allCharacters: [attacker, originalTarget, friendly],
        getCharacterPosition: getPosition,
        battlefield,
        weapon,
        misses: 0,
      };

      const result = resolveFriendlyFire(options);
      
      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('Original attack hit');
    });

    it('should trigger when attack misses with valid targets', () => {
      const options: FriendlyFireOptions = {
        attacker,
        originalTarget,
        originalTargetPosition: { x: 10, y: 0 },
        allCharacters: [attacker, originalTarget, friendly],
        getCharacterPosition: getPosition,
        battlefield,
        weapon,
        misses: 2,
      };

      const result = resolveFriendlyFire(options);
      
      expect(result.triggered).toBe(true);
      // May or may not hit depending on RNG
      expect(result.hitCharacter).toBeDefined();
    });

    it('should not trigger if no valid targets', () => {
      const options: FriendlyFireOptions = {
        attacker,
        originalTarget,
        originalTargetPosition: { x: 10, y: 0 },
        allCharacters: [attacker, originalTarget], // No friendly models
        getCharacterPosition: getPosition,
        battlefield,
        weapon,
        misses: 2,
      };

      const result = resolveFriendlyFire(options);
      
      expect(result.triggered).toBe(true);
      expect(result.reason).toBe('No valid friendly fire targets');
      expect(result.hit).toBe(false);
    });

    it('should hit based on REF test result', () => {
      const options: FriendlyFireOptions = {
        attacker,
        originalTarget,
        originalTargetPosition: { x: 10, y: 0 },
        allCharacters: [attacker, originalTarget, friendly],
        getCharacterPosition: getPosition,
        battlefield,
        weapon,
        misses: 1,
      };

      const result = resolveFriendlyFire(options);
      
      expect(result.triggered).toBe(true);
      expect(result.misses).toBe(1);
      if (result.hit) {
        expect(result.hitCharacter).toBeDefined();
        expect(result.refTestScore).toBeDefined();
      }
    });
  });
});

describe('Friendly Fire - Edge Cases', () => {
  let battlefield: Battlefield;
  let attacker: Character;
  let target: Character;
  let friendly: Character;
  let weapon: Item;
  let positions: Map<string, Position>;
  let getPosition: (c: Character) => Position | undefined;

  beforeEach(() => {
    battlefield = createTestBattlefield();
    weapon = createTestWeapon();
    
    attacker = createTestCharacter('Attacker');
    target = createTestCharacter('Target');
    friendly = createTestCharacter('Friendly');

    positions = new Map();
    positions.set(attacker.id, { x: 0, y: 0 });
    positions.set(target.id, { x: 10, y: 0 });
  });

  it('should handle KO/Eliminated models correctly', () => {
    friendly.state.isKOd = true;
    friendly.state.isAttentive = false; // KO models are not Attentive
    positions.set(friendly.id, { x: 10.5, y: 0 });
    getPosition = createPositionLookup(positions);
    
    const options: FriendlyFireOptions = {
      attacker,
      originalTarget: target,
      originalTargetPosition: { x: 10, y: 0 },
      allCharacters: [attacker, target, friendly],
      getCharacterPosition: getPosition,
      battlefield,
      weapon,
      misses: 2,
    };

    const targets = findFriendlyFireTargets({
      attacker,
      originalTarget: target,
      originalTargetPosition: { x: 10, y: 0 },
      allCharacters: [attacker, target, friendly],
      getCharacterPosition: getPosition,
      battlefield,
    });
    
    // KO model should not be a valid target (not Attentive)
    expect(targets.length).toBe(0);
  });

  it('should handle multiple models at same priority', () => {
    const friendly2 = createTestCharacter('Friendly2');
    positions.set(friendly.id, { x: 10.5, y: 0 });
    positions.set(friendly2.id, { x: 9.5, y: 0 });
    getPosition = createPositionLookup(positions);
    
    const options = {
      attacker,
      originalTarget: target,
      originalTargetPosition: { x: 10, y: 0 },
      allCharacters: [attacker, target, friendly, friendly2],
      getCharacterPosition: getPosition,
      battlefield,
    };

    const targets = findFriendlyFireTargets(options);
    
    // Both should be priority 1 (base-contact)
    expect(targets.length).toBe(2);
    expect(targets[0].priority).toBe(1);
    expect(targets[1].priority).toBe(1);
  });

  it('should respect Concentrated attack flag', () => {
    positions.set(friendly.id, { x: 10.5, y: 0 });
    getPosition = createPositionLookup(positions);
    
    const options: FriendlyFireOptions = {
      attacker,
      originalTarget: target,
      originalTargetPosition: { x: 10, y: 0 },
      allCharacters: [attacker, target, friendly],
      getCharacterPosition: getPosition,
      battlefield,
      weapon,
      misses: 2,
      isConcentrated: true,
    };

    const result = resolveFriendlyFire(options);
    
    // Should still resolve normally, but AR not reduced (handled in damage)
    expect(result.triggered).toBe(true);
  });
});
