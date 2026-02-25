import { describe, it, expect } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { canAttackKOdTarget, getKOdEliminationThreshold } from './kod-rules';

const makeProfile = (name: string, traits: string[] = [], attrs?: Partial<Profile['archetype']['attributes']>): Profile => ({
  name,
  archetype: { attributes: { cca: 1, rca: 1, ref: 1, int: 1, pow: 1, str: 1, for: 1, mov: 3, siz: 3, ...(attrs ?? {}) } },
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

describe('KOd attack rules', () => {
  it('disallows KOd attacks when disabled', () => {
    const attacker = new Character(makeProfile('Attacker'));
    const target = new Character(makeProfile('Target'));
    target.state.isKOd = true;

    const result = canAttackKOdTarget(attacker, target, { enabled: false });
    expect(result.allowed).toBe(false);
  });

  it('allows KOd attacks vs Unnatural targets when enabled', () => {
    const attacker = new Character(makeProfile('Attacker'));
    const target = new Character(makeProfile('Target', ['Automaton']));
    target.state.isKOd = true;

    const result = canAttackKOdTarget(attacker, target, { enabled: true });
    expect(result.allowed).toBe(true);
  });

  it('allows Panicked attackers when enabled', () => {
    const attacker = new Character(makeProfile('Attacker'));
    const target = new Character(makeProfile('Target'));
    attacker.state.isPanicked = true;
    target.state.isKOd = true;

    const result = canAttackKOdTarget(attacker, target, { enabled: true });
    expect(result.allowed).toBe(true);
  });

  it('enforces Primal override traits', () => {
    const attacker = new Character(makeProfile('Beast', ['Beast']));
    const target = new Character(makeProfile('Target'));
    target.state.isKOd = true;

    const denied = canAttackKOdTarget(attacker, target, { enabled: true });
    expect(denied.allowed).toBe(false);

    attacker.profile.finalTraits = ['Beast', 'Ravenous'];
    attacker.profile.allTraits = ['Beast', 'Ravenous'];
    const allowed = canAttackKOdTarget(attacker, target, { enabled: true });
    expect(allowed.allowed).toBe(true);
  });

  it('uses controller traits for Puppet attackers', () => {
    const attacker = new Character(makeProfile('Automaton', ['Automaton']));
    const target = new Character(makeProfile('Target'));
    target.state.isKOd = true;

    const denied = canAttackKOdTarget(attacker, target, { enabled: true });
    expect(denied.allowed).toBe(false);

    const allowed = canAttackKOdTarget(attacker, target, { enabled: true, controllerTraits: ['Delusional'] });
    expect(allowed.allowed).toBe(true);
  });

  it('computes elimination threshold from SIZ', () => {
    const small = new Character(makeProfile('Small', [], { siz: 2 }));
    const large = new Character(makeProfile('Large', [], { siz: 6 }));
    expect(getKOdEliminationThreshold(small)).toBe(1);
    expect(getKOdEliminationThreshold(large)).toBe(3);
  });
});
