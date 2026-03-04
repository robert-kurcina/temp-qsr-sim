import { describe, it, expect } from 'vitest';
import {
  canonicalizeKeywordToken,
  getCanonicalItemClassification,
  getCanonicalTechLevelForAge,
  isKnownKeyword,
} from './canonical-metadata';

describe('canonical-metadata', () => {
  it('maps item class labels through canonical item_classifications', () => {
    const mapped = getCanonicalItemClassification('Range - Modern');
    expect(mapped).toEqual({
      waeClass: 'Weapon',
      itemType: 'Modern',
      itemClass: 'Range',
    });
  });

  it('returns null for unknown item class labels', () => {
    expect(getCanonicalItemClassification('Unknown - Class')).toBeNull();
  });

  it('canonicalizes known keyword tokens case-insensitively', () => {
    expect(canonicalizeKeywordToken(' movement ')).toBe('Movement');
    expect(canonicalizeKeywordToken('psychology')).toBe('Psychology');
  });

  it('keeps unknown keyword tokens unchanged except trim', () => {
    expect(canonicalizeKeywordToken('  Tactical  ')).toBe('Tactical');
    expect(isKnownKeyword('Tactical')).toBe(false);
  });

  it('maps tech ages through canonical tech_level rows', () => {
    expect(getCanonicalTechLevelForAge('Medieval')).toBe(5);
    expect(getCanonicalTechLevelForAge('Quantum')).toBe(16);
  });
});

