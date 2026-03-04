import { describe, expect, it } from 'vitest';
import { Character } from '../core/Character';
import { evaluateRangeWithVisibility, evaluateWeaponOrExpressionMu, getVisibilityOrForLighting, parseWeaponOptimalRangeMu } from './visibility';

function makeCharacter(str = 3): Character {
  return new Character({
    name: 'tester',
    attributes: {
      cca: 2,
      rca: 2,
      ref: 2,
      int: 2,
      pow: 2,
      str,
      for: 2,
      mov: 2,
      siz: 3,
    },
    items: [],
    equipment: [],
  } as any);
}

describe('visibility helpers', () => {
  it('maps lighting presets to visibility OR', () => {
    expect(getVisibilityOrForLighting('Day, Clear')).toBe(16);
    expect(getVisibilityOrForLighting('Day, Rain/Fog')).toBe(8);
    expect(getVisibilityOrForLighting('Twilight, Overcast')).toBe(8);
    expect(getVisibilityOrForLighting('Night')).toBe(4);
  });

  it('enforces max ORM under normal range checks', () => {
    const inRange = evaluateRangeWithVisibility(52, 24, {
      visibilityOrMu: 16,
      maxOrm: 3,
      allowConcentrateRangeExtension: false,
    });
    expect(inRange.inRange).toBe(true);
    expect(inRange.orm).toBe(3);

    const outOfRange = evaluateRangeWithVisibility(65, 24, {
      visibilityOrMu: 16,
      maxOrm: 3,
      allowConcentrateRangeExtension: false,
    });
    expect(outOfRange.inRange).toBe(false);
    expect(outOfRange.orm).toBe(4);
  });

  it('supports concentrate extension (double OR, ignore max ORM)', () => {
    const result = evaluateRangeWithVisibility(31, 24, {
      visibilityOrMu: 16,
      maxOrm: 0,
      allowConcentrateRangeExtension: true,
    });
    expect(result.inRange).toBe(true);
    expect(result.requiresConcentrate).toBe(true);
    expect(result.concentratedOrMu).toBe(32);

    const beyondMaxOr = evaluateRangeWithVisibility(33, 24, {
      visibilityOrMu: 16,
      maxOrm: 0,
      allowConcentrateRangeExtension: true,
    });
    expect(beyondMaxOr.inRange).toBe(false);
  });

  it('parses thrown and expression-based OR values', () => {
    const attacker = makeCharacter(4);

    const thrownOr = parseWeaponOptimalRangeMu(attacker, {
      name: 'Thrown Knife',
      class: 'Weapon',
      type: 'Weapon',
      bp: 1,
      classification: 'Thrown',
      or: '-',
      accuracy: '+0',
      impact: 0,
      dmg: '-',
      traits: [],
    } as any);
    expect(thrownOr).toBe(4);

    const expressionOr = parseWeaponOptimalRangeMu(attacker, {
      name: 'Rifle',
      class: 'Weapon',
      type: 'Weapon',
      bp: 1,
      classification: 'Firearm',
      or: 'OR(STR+2)',
      accuracy: '+0',
      impact: 0,
      dmg: '-',
      traits: [],
    } as any);
    expect(expressionOr).toBe(6);
  });

  it('evaluates explicit OR expressions including negative results', () => {
    const attacker = makeCharacter(3);
    expect(evaluateWeaponOrExpressionMu(attacker, 'STR+2')).toBe(5);
    expect(evaluateWeaponOrExpressionMu(attacker, 'STR-5')).toBe(-2);
    expect(evaluateWeaponOrExpressionMu(attacker, 'OR(STR+1)')).toBe(4);
    expect(evaluateWeaponOrExpressionMu(attacker, '-')).toBeNull();
  });
});
