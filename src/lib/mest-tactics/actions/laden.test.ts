import { describe, it, expect } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';

const makeProfile = (name: string): Profile => ({
  name,
  archetype: { attributes: { cca: 4, rca: 0, ref: 5, int: 0, pow: 0, str: 3, for: 0, mov: 6, siz: 3 } },
  items: [],
  totalBp: 0,
  adjustedBp: 0,
  adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
  physicality: 0,
  adjPhysicality: 0,
  durability: 0,
  adjDurability: 0,
  burden: { totalLaden: 0, totalBurden: 0 } as any,
  totalHands: 0,
  totalDeflect: 0,
  totalAR: 0,
  finalTraits: [],
  allTraits: [],
});

describe('laden effects', () => {
  it('should reduce MOV but keep REF/CCA when attentive ordered', () => {
    const profile = makeProfile('Attentive');
    profile.burden = { totalLaden: 3, totalBurden: 2 };
    const character = new Character(profile);
    character.refreshStatusFlags();
    expect(character.finalAttributes.mov).toBe(4);
    expect(character.finalAttributes.ref).toBe(5);
    expect(character.finalAttributes.cca).toBe(4);
  });

  it('should reduce MOV/REF/CCA when not attentive ordered', () => {
    const profile = makeProfile('Distracted');
    profile.burden = { totalLaden: 3, totalBurden: 2 };
    const character = new Character(profile);
    character.state.delayTokens = 1;
    character.refreshStatusFlags();
    expect(character.finalAttributes.mov).toBe(4);
    expect(character.finalAttributes.ref).toBe(3);
    expect(character.finalAttributes.cca).toBe(2);
  });
});
