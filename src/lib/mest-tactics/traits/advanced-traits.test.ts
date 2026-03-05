/**
 * Advanced Traits Runtime Tests
 *
 * These tests intentionally cover only runtime-owned behavior paths.
 * Clause-restatement/spec-only assertions were removed to reduce duplication.
 */

import { describe, it, expect } from 'vitest';
import { Character } from '../core/Character';
import { buildProfile } from '../mission/assembly-builder';
import type { Item } from '../core/Item';
import { Battlefield } from '../battlefield/Battlefield';
import {
  getROFLevel,
  getEffectiveROFLevel,
  getSuppressiveFireMarkerCount,
} from './rof-suppression-spatial';
import {
  applyStatusTraitOnHit,
  getPendingStatusTokenCount,
  getStatusTokenCount,
  promotePendingStatusTokens,
} from '../status/status-system';
import {
  getLeadershipLevel,
  getSurefootedTerrainBonus,
  upgradeTerrain,
  type TerrainType as SurefootedTerrainType,
} from './combat-traits';

function createTestCharacter(archetype = 'Average', itemNames: any[] = []): Character {
  const profile = buildProfile(archetype, { itemNames });
  return new Character(profile);
}

function assignTraits(character: Character, traits: string[]): void {
  character.profile.finalTraits = [...traits];
  character.profile.allTraits = [...traits];
}

function createMockWeapon(name: string, traits: string[]): Item {
  return {
    name,
    class: 'Ranged',
    classification: 'Ranged',
    type: 'Ranged',
    bp: 0,
    or: '8',
    accuracy: '+0',
    impact: 0,
    dmg: 'STR',
    traits,
    range: 8,
  } as Item;
}

describe('Advanced Traits Runtime', () => {
  describe('ROF and Suppressive Fire runtime helpers', () => {
    it('extracts ROF level from equipped weapon traits', () => {
      const attacker = createTestCharacter();
      attacker.profile.equipment = [createMockWeapon('Support Carbine', ['ROF 3'])];

      expect(getROFLevel(attacker)).toBe(3);
    });

    it('reduces effective ROF by initiative reuse and clamps at zero', () => {
      expect(getEffectiveROFLevel(3, 0)).toBe(3);
      expect(getEffectiveROFLevel(3, 1)).toBe(2);
      expect(getEffectiveROFLevel(3, 2)).toBe(1);
      expect(getEffectiveROFLevel(3, 3)).toBe(0);
      expect(getEffectiveROFLevel(3, 4)).toBe(0);
    });

    it('requires Attentive state for Suppressive Fire marker count', () => {
      const battlefield = new Battlefield(24, 24);
      const gunner = createTestCharacter();
      gunner.profile.equipment = [createMockWeapon('Machine Gun', ['ROF 2'])];

      gunner.state.isAttentive = false;
      expect(getSuppressiveFireMarkerCount(gunner, battlefield)).toBe(0);

      gunner.state.isAttentive = true;
      expect(getSuppressiveFireMarkerCount(gunner, battlefield)).toBe(2);
    });
  });

  describe('Advanced status-trait application', () => {
    it('applies Burn X tokens based on rating and target SIZ', () => {
      const defender = createTestCharacter();
      applyStatusTraitOnHit(defender, 'Burn X', { rating: 6 });

      // Average SIZ is 3, so rating 6 => 2 Burn tokens.
      expect(getStatusTokenCount(defender, 'Burn')).toBe(2);
    });

    it('applies Acid X only when effective armor is zero', () => {
      const defender = createTestCharacter();
      defender.state.armor.total = 1;
      const blocked = applyStatusTraitOnHit(defender, 'Acid X', { rating: 4, impact: 0 });
      expect(blocked.applied).toBe(false);
      expect(getStatusTokenCount(defender, 'Acid')).toBe(0);

      defender.state.armor.total = 0;
      const applied = applyStatusTraitOnHit(defender, 'Acid X', { rating: 4, impact: 0 });
      expect(applied.applied).toBe(true);
      expect(getStatusTokenCount(defender, 'Acid')).toBe(2);
    });

    it('queues Poison X as pending then promotes to active tokens', () => {
      const defender = createTestCharacter();
      defender.state.armor.total = 0;

      const result = applyStatusTraitOnHit(defender, 'Poison X', { rating: 5, impact: 0 });
      expect(result.applied).toBe(true);
      expect(getPendingStatusTokenCount(defender, 'Poison')).toBeGreaterThan(0);
      expect(getStatusTokenCount(defender, 'Poison')).toBe(0);

      promotePendingStatusTokens(defender, 'Poison');
      expect(getPendingStatusTokenCount(defender, 'Poison')).toBe(0);
      expect(getStatusTokenCount(defender, 'Poison')).toBeGreaterThan(0);
    });
  });

  describe('Advanced movement/leadership trait helpers', () => {
    it('reads Leadership levels from character trait pools', () => {
      const leader = createTestCharacter();
      assignTraits(leader, ['Leadership 2']);

      expect(getLeadershipLevel(leader)).toBe(2);
    });

    it('upgrades terrain via Surefooted levels', () => {
      const scout = createTestCharacter();
      assignTraits(scout, ['Surefooted 2']);

      expect(getSurefootedTerrainBonus(scout, 'Difficult')).toBe('Rough');

      assignTraits(scout, ['Surefooted 3']);
      expect(getSurefootedTerrainBonus(scout, 'Difficult')).toBe('Clear');
    });

    it('preserves non-upgradable terrain types', () => {
      const terrain: SurefootedTerrainType = 'Impassable';
      expect(upgradeTerrain(terrain, 3)).toBe('Impassable');
    });
  });
});
