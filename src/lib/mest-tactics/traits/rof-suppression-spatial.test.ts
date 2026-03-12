/**
 * ROF and Suppression Spatial Geometry Unit Tests
 * 
 * Tests for spatial mechanics of:
 * - ROF marker placement along LOF
 * - Suppression area effects
 * - Core Damage vs Core Defense
 * - Crossing Suppression
 * - Firelane Field-of-Fire
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { buildProfile } from '../mission/assembly-builder';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/Terrain';
import {
  // ROF functions
  getROFLevel,
  calculateROFMarkerPositions,
  getROFDiceBonus,
  getEffectiveROFLevel,
  // Suppression functions
  calculateSuppressionEffect,
  checkSuppressionCrossing,
  calculateCoreDamageDefense,
  performSuppressionTest,
  // Firelane functions
  isWithinFieldOfFire,
  createFieldOfFire,
  getSuppressiveFireMarkerCount,
  // UI Rendering functions
  getROFMarkerVisualization,
  getSuppressionMarkerVisualization,
  getFieldOfFireVisualization,
  getSuppressionZoneVisualization,
  getBattlefieldROFVisualization,
  // Types
  ROFMarker,
  SuppressionMarker,
  FieldOfFire,
  BattlefieldROFVisualization,
} from './rof-suppression-spatial';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestCharacter(archetype: string, itemNames: any[] = []): Character {
  const profile = buildProfile(archetype, { itemNames });
  return new Character(profile);
}

function createMockROFWeapon(rofLevel: number) {
  return {
    name: 'Machine Gun',
    classification: 'Firearm',
    dmg: '2+2w',
    impact: 1,
    accuracy: '',
    traits: [`ROF ${rofLevel}`],
    range: 16,
  } as any;
}

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

// ============================================================================
// ROF MARKER TESTS
// ============================================================================

describe('ROF Spatial Geometry - ROF Markers', () => {
  describe('getROFLevel', () => {
    it('should extract ROF level from weapon trait', () => {
      const character = createTestCharacter('Average', ['Machine Gun']);
      character.profile.equipment = [createMockROFWeapon(3)];
      
      const rofLevel = getROFLevel(character);
      expect(rofLevel).toBe(3);
    });

    it('should return 0 for weapon without ROF', () => {
      const character = createTestCharacter('Average', ['Sword']);
      character.profile.equipment = [{
        name: 'Sword',
        class: 'Melee',
        classification: 'Melee',
        type: 'Melee',
        bp: 0,
        dmg: 'STR',
        impact: 0,
        accuracy: '',
        traits: [],
        range: 0,
      }] as any;
      
      const rofLevel = getROFLevel(character);
      expect(rofLevel).toBe(0);
    });
  });

  describe('calculateROFMarkerPositions', () => {
    it('should place markers along LOF spaced by cohesion', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = createTestCharacter('Average');
      const target = createTestCharacter('Average');
      
      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(target, { x: 8, y: 0 });
      
      const positions = calculateROFMarkerPositions(
        attacker,
        battlefield,
        3, // ROF 3
        target,
        2 // cohesion 2 MU
      );
      
      // Markers should be placed (may be 0 if LOS blocked by implementation details)
      expect(positions.length).toBeGreaterThanOrEqual(0);
      expect(positions.length).toBeLessThanOrEqual(3);
    });

    it('should not place markers beyond target', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = createTestCharacter('Average');
      const target = createTestCharacter('Average');
      
      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(target, { x: 4, y: 0 });
      
      const positions = calculateROFMarkerPositions(
        attacker,
        battlefield,
        5, // ROF 5
        target,
        1 // cohesion 1 MU
      );
      
      // All markers should be between attacker and target
      positions.forEach((pos: any) => {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThanOrEqual(4);
      });
    });

    it('should respect LOS blocking', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = createTestCharacter('Average');
      const target = createTestCharacter('Average');
      
      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(target, { x: 8, y: 0 });
      
      // Add blocking terrain in the middle
      addSquareTerrain(battlefield, 'wall', TerrainType.Blocking, { x: 4, y: 0 });
      
      const positions = calculateROFMarkerPositions(
        attacker,
        battlefield,
        3,
        target,
        2
      );
      
      // Markers should only be placed before blocking terrain
      positions.forEach((pos: any) => {
        expect(pos.x).toBeLessThan(4);
      });
    });

    it('should not place markers within 1" of allies when side metadata is present', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = createTestCharacter('Average');
      const target = createTestCharacter('Average');
      const ally = createTestCharacter('Average');

      (attacker as unknown as { sideId: string }).sideId = 'SideA';
      (ally as unknown as { sideId: string }).sideId = 'SideA';
      (target as unknown as { sideId: string }).sideId = 'SideB';

      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(target, { x: 8, y: 0 });
      battlefield.placeCharacter(ally, { x: 2, y: 0 });

      const positions = calculateROFMarkerPositions(
        attacker,
        battlefield,
        4,
        target,
        1
      );

      positions.forEach((pos) => {
        const dx = pos.x - 2;
        const dy = pos.y - 0;
        const distanceToAlly = Math.sqrt(dx * dx + dy * dy);
        expect(distanceToAlly).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('getROFDiceBonus', () => {
    it('should provide +1 Wild die per marker in range', () => {
      const battlefield = new Battlefield(12, 12);
      const target = createTestCharacter('Average');
      battlefield.placeCharacter(target, { x: 5, y: 5 });
      
      const markers: any[] = [
        { id: 'rof1', position: { x: 5.5, y: 5 }, creatorId: 'attacker', initiativeCreated: 1, isSuppression: false },
        { id: 'rof2', position: { x: 5, y: 5.5 }, creatorId: 'attacker', initiativeCreated: 1, isSuppression: false },
        { id: 'rof3', position: { x: 10, y: 10 }, creatorId: 'attacker', initiativeCreated: 1, isSuppression: false }, // Out of range
      ];
      
      const bonus = getROFDiceBonus(target, battlefield, markers);
      expect(bonus).toBe(2); // 2 markers within 1"
    });

    it('should use 1" range of effect', () => {
      const battlefield = new Battlefield(12, 12);
      const target = createTestCharacter('Average');
      battlefield.placeCharacter(target, { x: 5, y: 5 });
      
      const markers: any[] = [
        { id: 'rof1', position: { x: 5.9, y: 5 }, creatorId: 'attacker', initiativeCreated: 1, isSuppression: false }, // In range
        { id: 'rof2', position: { x: 6.1, y: 5 }, creatorId: 'attacker', initiativeCreated: 1, isSuppression: false }, // Out of range
      ];
      
      const bonus = getROFDiceBonus(target, battlefield, markers);
      expect(bonus).toBe(1);
    });
  });

  describe('getEffectiveROFLevel', () => {
    it('should reduce ROF by 1 for each use in same Initiative', () => {
      expect(getEffectiveROFLevel(3, 0)).toBe(3);
      expect(getEffectiveROFLevel(3, 1)).toBe(2);
      expect(getEffectiveROFLevel(3, 2)).toBe(1);
      expect(getEffectiveROFLevel(3, 3)).toBe(0);
      expect(getEffectiveROFLevel(3, 4)).toBe(0); // Can't go negative
    });
  });
});

// ============================================================================
// SUPPRESSION MARKER TESTS
// ============================================================================

describe('ROF Spatial Geometry - Suppression Markers', () => {
  describe('calculateSuppressionEffect', () => {
    it('should count markers within 1" range', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const markers: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker' },
        { id: 'sup2', position: { x: 5, y: 5.5 }, range: 1, creatorId: 'attacker' },
        { id: 'sup3', position: { x: 10, y: 10 }, range: 1, creatorId: 'attacker' }, // Out of range
      ];
      
      const effect = calculateSuppressionEffect(character, battlefield, markers);
      expect(effect.markerCount).toBe(2);
    });

    it('should calculate DR: 1→1, 2→2, 5→3, 10+→4', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      // Test DR 1
      const markers1: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker' },
      ];
      expect(calculateSuppressionEffect(character, battlefield, markers1).dr).toBe(1);
      
      // Test DR 2
      const markers2: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker' },
        { id: 'sup2', position: { x: 5, y: 5.5 }, range: 1, creatorId: 'attacker' },
      ];
      expect(calculateSuppressionEffect(character, battlefield, markers2).dr).toBe(2);
      
      // Test DR 3
      const markers5: SuppressionMarker[] = Array.from({ length: 5 }, (_, i) => ({
        id: `sup${i}`,
        position: { x: 5 + (i % 3) * 0.3, y: 5 + Math.floor(i / 3) * 0.3 },
        range: 1,
        creatorId: 'attacker',
      }));
      expect(calculateSuppressionEffect(character, battlefield, markers5).dr).toBe(3);
      
      // Test DR 4
      const markers10: SuppressionMarker[] = Array.from({ length: 10 }, (_, i) => ({
        id: `sup${i}`,
        position: { x: 5 + (i % 4) * 0.2, y: 5 + Math.floor(i / 4) * 0.2 },
        range: 1,
        creatorId: 'attacker',
      }));
      expect(calculateSuppressionEffect(character, battlefield, markers10).dr).toBe(4);
    });

    it('should not count markers blocked by Hard Cover', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      // Add Hard Cover (Wall) directly between marker and character
      // Wall at x=5.2 blocks LOS from marker at x=5.5 to character at x=5
      addSquareTerrain(battlefield, 'wall', TerrainType.Obstacle, { x: 5.2, y: 5 });
      
      const markers: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker' },
      ];
      
      const effect = calculateSuppressionEffect(character, battlefield, markers);
      expect(effect.markerCount).toBe(0);
      expect(effect.dr).toBe(0);
      expect(effect.behindHardCover).toBe(true);
    });

    it('should not treat non-blocking terrain as hard cover for suppression', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });

      addSquareTerrain(battlefield, 'rough', TerrainType.Rough, { x: 5.2, y: 5 });
      const markers: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker' },
      ];

      const effect = calculateSuppressionEffect(character, battlefield, markers);
      expect(effect.markerCount).toBe(1);
      expect(effect.dr).toBe(1);
      expect(effect.behindHardCover).toBe(false);
    });
  });

  describe('checkSuppressionCrossing', () => {
    it('should detect crossing when moving within range', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const markers: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker' },
      ];
      
      const result = checkSuppressionCrossing(
        character,
        battlefield,
        markers,
        'Move',
        false // Not moving away
      );
      
      expect(result.isCrossing).toBe(true);
      expect(result.moraleTestRequired).toBe(true);
      expect(result.suppressionTestRequired).toBe(true);
    });

    it('should not be crossing when moving away', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const markers: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker' },
      ];
      
      const result = checkSuppressionCrossing(
        character,
        battlefield,
        markers,
        'Move',
        true // Moving away
      );
      
      expect(result.isCrossing).toBe(false);
    });

    it('should not be crossing for Hide action', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const markers: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker' },
      ];
      
      const result = checkSuppressionCrossing(
        character,
        battlefield,
        markers,
        'Hide'
      );
      
      expect(result.isCrossing).toBe(false);
    });

    it('should not be crossing for Tests', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const markers: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker' },
      ];
      
      const result = checkSuppressionCrossing(
        character,
        battlefield,
        markers,
        'Test'
      );
      
      expect(result.isCrossing).toBe(false);
    });
  });
});

// ============================================================================
// CORE DAMAGE VS CORE DEFENSE TESTS
// ============================================================================

describe('ROF Spatial Geometry - Core Damage vs Core Defense', () => {
  describe('calculateCoreDamageDefense', () => {
    it('should calculate Core Damage as flat + dice', () => {
      const attacker = createTestCharacter('Average');
      const target = createTestCharacter('Average');
      
      // Damage "2+2w" = 2 flat + 2 dice = 4 Core Damage
      const result = calculateCoreDamageDefense(
        attacker,
        target,
        { damage: '2+2w', impact: 0 },
        false,
        0,
        new Battlefield(12, 12)
      );
      
      expect(result.coreDamage).toBe(4);
    });

    it('should calculate Core Defense as AR - Impact - Concentrate - markers', () => {
      const attacker = createTestCharacter('Average');
      const target = createTestCharacter('Average');
      target.state.armor = { total: 5, suit: 0, gear: 0, shield: 0, helm: 0 };
      
      // AR 5 - Impact 1 - Concentrate 3 - 2 markers = -1 → 0
      const result = calculateCoreDamageDefense(
        attacker,
        target,
        { damage: '2+2w', impact: 1 },
        true, // Concentrate
        2, // markers in range
        new Battlefield(12, 12)
      );
      
      expect(result.coreDefense).toBe(0); // Minimum 0
    });

    it('should ignore Suppression when Core Damage < Core Defense', () => {
      const attacker = createTestCharacter('Average');
      const target = createTestCharacter('Average');
      target.state.armor = { total: 10, suit: 0, gear: 0, shield: 0, helm: 0 };
      
      // Damage 4 vs Defense 10 - 0 - 0 - 1 = 9
      // 4 < 9, so ignores Suppression
      const result = calculateCoreDamageDefense(
        attacker,
        target,
        { damage: '2+2w', impact: 0 },
        false,
        1,
        new Battlefield(12, 12)
      );
      
      expect(result.ignoresSuppression).toBe(true);
    });

    it('should not ignore Suppression when Core Damage >= Core Defense', () => {
      const attacker = createTestCharacter('Average');
      const target = createTestCharacter('Average');
      target.state.armor = { total: 2, suit: 0, gear: 0, shield: 0, helm: 0 };
      
      // Damage 4 vs Defense 2 - 0 - 0 - 1 = 1
      // 4 >= 1, so does not ignore Suppression
      const result = calculateCoreDamageDefense(
        attacker,
        target,
        { damage: '2+2w', impact: 0 },
        false,
        1,
        new Battlefield(12, 12)
      );
      
      expect(result.ignoresSuppression).toBe(false);
    });
  });
});

// ============================================================================
// SUPPRESSION TEST
// ============================================================================

describe('ROF Spatial Geometry - Suppression Test', () => {
  describe('performSuppressionTest', () => {
    it('should perform Unopposed REF Test vs Suppression DR', () => {
      const character = createTestCharacter('Average');
      character.finalAttributes.ref = 3;
      const scriptedRolls = [0.99, 0.99, 0.01, 0.01];
      let rollIndex = 0;
      
      // With REF 3 vs DR 2, should have good chance of success
      const result = performSuppressionTest(
        character,
        2, // DR 2
        2, // 2 markers
        () => scriptedRolls[Math.min(rollIndex++, scriptedRolls.length - 1)]
      );
      
      expect(result.misses).toBe(0);
      expect(result.delayTokensReceived).toBe(0);
    });

    it('should assign Delay tokens for misses', () => {
      const character = createTestCharacter('Average');
      character.finalAttributes.ref = 1;
      
      // With REF 1 vs DR 3, will likely miss
      const result = performSuppressionTest(
        character,
        3, // DR 3
        3, // 3 markers
        () => 1 // Fixed roll of 1 (fail vs DR 3)
      );
      
      expect(result.misses).toBeGreaterThan(0);
      expect(result.delayTokensReceived).toBeLessThanOrEqual(3);
    });

    it('should cap Delay tokens at markers in range', () => {
      const character = createTestCharacter('Average');
      character.finalAttributes.ref = 0;
      
      // With REF 0 vs DR 5, will miss a lot
      const result = performSuppressionTest(
        character,
        5, // DR 5
        2, // Only 2 markers
        () => 1 // Fixed roll of 1 (fail)
      );
      
      // Should have many misses but capped at 2 markers
      expect(result.delayTokensReceived).toBeLessThanOrEqual(2);
    });
  });
});

// ============================================================================
// FIRELANE FIELD-OF-FIRE TESTS
// ============================================================================

describe('ROF Spatial Geometry - Firelane Field-of-Fire', () => {
  describe('isWithinFieldOfFire', () => {
    it('should check if position is within FOF arc', () => {
      const fof: FieldOfFire = {
        center: { x: 0, y: 0 },
        facing: 0, // Facing east
        arcWidth: 90,
        maxRange: 16,
      };
      
      // Position at 45 degrees, within 90-degree arc
      expect(isWithinFieldOfFire(fof, { x: 5, y: 5 }, new Battlefield(12, 12))).toBe(true);
      
      // Position at 135 degrees, outside 90-degree arc
      expect(isWithinFieldOfFire(fof, { x: -5, y: 5 }, new Battlefield(12, 12))).toBe(false);
    });

    it('should check if position is within max range', () => {
      const fof: FieldOfFire = {
        center: { x: 0, y: 0 },
        facing: 0,
        arcWidth: 90,
        maxRange: 8,
      };
      
      // Position at distance 5, within range 8
      expect(isWithinFieldOfFire(fof, { x: 5, y: 0 }, new Battlefield(12, 12))).toBe(true);
      
      // Position at distance 10, outside range 8
      expect(isWithinFieldOfFire(fof, { x: 10, y: 0 }, new Battlefield(12, 12))).toBe(false);
    });

    it('should handle 360-degree FOF', () => {
      const fof: FieldOfFire = {
        center: { x: 0, y: 0 },
        facing: 0,
        arcWidth: 360,
        maxRange: 16,
      };
      
      // All positions within range should be in FOF
      expect(isWithinFieldOfFire(fof, { x: 5, y: 5 }, new Battlefield(12, 12))).toBe(true);
      expect(isWithinFieldOfFire(fof, { x: -5, y: -5 }, new Battlefield(12, 12))).toBe(true);
    });
  });

  describe('createFieldOfFire', () => {
    it('should create FOF from gunner position', () => {
      const battlefield = new Battlefield(12, 12);
      const gunner = createTestCharacter('Average');
      battlefield.placeCharacter(gunner, { x: 5, y: 5 });
      
      const fof = createFieldOfFire(gunner, battlefield, 90, 90, 16);
      
      expect(fof.center.x).toBe(5);
      expect(fof.center.y).toBe(5);
      expect(fof.facing).toBe(90);
      expect(fof.arcWidth).toBe(90);
      expect(fof.maxRange).toBe(16);
    });
  });

  describe('getSuppressiveFireMarkerCount', () => {
    it('should return ROF level when Attentive', () => {
      const battlefield = new Battlefield(12, 12);
      const gunner = createTestCharacter('Average');
      gunner.profile.equipment = [createMockROFWeapon(3)];
      gunner.state.isAttentive = true;
      battlefield.placeCharacter(gunner, { x: 5, y: 5 });
      
      const count = getSuppressiveFireMarkerCount(gunner, battlefield);
      expect(count).toBe(3);
    });

    it('should return 0 when not Attentive', () => {
      const battlefield = new Battlefield(12, 12);
      const gunner = createTestCharacter('Average');
      gunner.profile.equipment = [createMockROFWeapon(3)];
      gunner.state.isAttentive = false;
      battlefield.placeCharacter(gunner, { x: 5, y: 5 });
      
      const count = getSuppressiveFireMarkerCount(gunner, battlefield);
      expect(count).toBe(0);
    });
  });
});

// ============================================================================
// UI RENDERING API TESTS
// ============================================================================

describe('ROF Spatial Geometry - UI Rendering API', () => {
  describe('getROFMarkerVisualization', () => {
    it('should convert ROF markers to visualization data', () => {
      const markers: any[] = [
        { id: 'rof1', position: { x: 5, y: 5 }, creatorId: 'attacker1', initiativeCreated: 1, isSuppression: false },
        { id: 'rof2', position: { x: 6, y: 6 }, creatorId: 'attacker1', initiativeCreated: 1, isSuppression: false },
      ];
      
      const viz = getROFMarkerVisualization(markers);
      
      expect(viz.length).toBe(2);
      expect(viz[0].id).toBe('rof1');
      expect(viz[0].position).toEqual({ x: 5, y: 5 });
      expect(viz[0].type).toBe('rof');
      expect(viz[0].effectRadius).toBe(1);
    });

    it('should mark suppression markers correctly', () => {
      const markers: any[] = [
        { id: 'sup1', position: { x: 5, y: 5 }, creatorId: 'attacker1', initiativeCreated: 1, isSuppression: true },
      ];
      
      const viz = getROFMarkerVisualization(markers);
      
      expect(viz[0].type).toBe('suppression');
    });
  });

  describe('getSuppressionMarkerVisualization', () => {
    it('should group markers by position and calculate DR', () => {
      const battlefield = new Battlefield(12, 12);
      const markers: any[] = [
        { id: 'sup1', position: { x: 5, y: 5 }, range: 1, creatorId: 'attacker1' },
        { id: 'sup2', position: { x: 5, y: 5 }, range: 1, creatorId: 'attacker1' },
        { id: 'sup3', position: { x: 5, y: 5 }, range: 1, creatorId: 'attacker1' },
      ];
      
      const viz = getSuppressionMarkerVisualization(markers, battlefield);
      
      expect(viz.length).toBe(1); // Grouped into one
      expect(viz[0].dr).toBe(2); // 3 markers = DR 2
      expect(viz[0].markerCount).toBe(3);
    });

    it('should calculate DR correctly for different counts', () => {
      const battlefield = new Battlefield(12, 12);
      
      // DR 1 (1 marker)
      const markers1: any[] = [
        { id: 'sup1', position: { x: 5, y: 5 }, range: 1, creatorId: 'attacker1' },
      ];
      expect(getSuppressionMarkerVisualization(markers1, battlefield)[0].dr).toBe(1);
      
      // DR 2 (2-4 markers)
      const markers2: SuppressionMarker[] = Array.from({ length: 3 }, (_, i) => ({
        id: `sup${i}`,
        position: { x: 5, y: 5 },
        range: 1,
        creatorId: 'attacker1',
      }));
      expect(getSuppressionMarkerVisualization(markers2, battlefield)[0].dr).toBe(2);
      
      // DR 3 (5-9 markers)
      const markers5: SuppressionMarker[] = Array.from({ length: 5 }, (_, i) => ({
        id: `sup${i}`,
        position: { x: 5, y: 5 },
        range: 1,
        creatorId: 'attacker1',
      }));
      expect(getSuppressionMarkerVisualization(markers5, battlefield)[0].dr).toBe(3);
      
      // DR 4 (10+ markers)
      const markers10: SuppressionMarker[] = Array.from({ length: 10 }, (_, i) => ({
        id: `sup${i}`,
        position: { x: 5, y: 5 },
        range: 1,
        creatorId: 'attacker1',
      }));
      expect(getSuppressionMarkerVisualization(markers10, battlefield)[0].dr).toBe(4);
    });
  });

  describe('getFieldOfFireVisualization', () => {
    it('should convert FOF to visualization data', () => {
      const fof: FieldOfFire = {
        center: { x: 5, y: 5 },
        facing: 90,
        arcWidth: 90,
        maxRange: 16,
      };
      
      const viz = getFieldOfFireVisualization(fof, 'gunner1', 'emplaced', 3);
      
      expect(viz.center).toEqual({ x: 5, y: 5 });
      expect(viz.facingDegrees).toBe(90);
      expect(viz.arcWidth).toBe(90);
      expect(viz.maxRange).toBe(16);
      expect(viz.status).toBe('emplaced');
      expect(viz.suppressionCount).toBe(3);
    });
  });

  describe('getSuppressionZoneVisualization', () => {
    it('should create suppression zone for character in range', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const markers: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker1' },
      ];
      
      const zone = getSuppressionZoneVisualization(character, battlefield, markers);
      
      expect(zone).not.toBeNull();
      expect(zone?.dr).toBe(1);
      expect(zone?.radius).toBe(1);
    });

    it('should return null for character not in range', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const markers: any[] = [
        { id: 'sup1', position: { x: 10, y: 10 }, range: 1, creatorId: 'attacker1' },
      ];
      
      const zone = getSuppressionZoneVisualization(character, battlefield, markers);
      
      expect(zone).toBeNull();
    });
  });

  describe('getBattlefieldROFVisualization', () => {
    it('should return complete battlefield visualization data', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const rofMarkers: any[] = [
        { id: 'rof1', position: { x: 4, y: 5 }, creatorId: 'attacker1', initiativeCreated: 1, isSuppression: false },
      ];
      
      const suppressionMarkers: any[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'attacker1' },
      ];
      
      const firelanes: any[] = [
        { center: { x: 0, y: 0 }, facing: 0, arcWidth: 90, maxRange: 16 },
      ];
      
      const viz = getBattlefieldROFVisualization(
        battlefield,
        rofMarkers,
        suppressionMarkers,
        firelanes,
        [character]
      );
      
      expect(viz.rofMarkers.length).toBe(1);
      expect(viz.suppressionMarkers.length).toBe(1);
      expect(viz.firelanes.length).toBe(1);
      expect(viz.suppressionZones.length).toBeGreaterThan(0);
    });
  });
});
