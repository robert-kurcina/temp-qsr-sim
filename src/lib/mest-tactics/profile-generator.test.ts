import { describe, it, expect, beforeEach } from 'vitest';
import { createProfiles } from './profile-generator';
import { Archetype } from './Archetype';
import { gameData } from '../data'; // Using the bundled data

describe('createProfiles', () => {
  let veteranArchetypeData: Archetype;
  const veteranArchetypeName = 'Veteran';

  beforeEach(() => {
    veteranArchetypeData = {
      species: 'Humanoid',
      attributes: { cca: 3, rca: 3, ref: 3, int: 2, pow: 3, str: 2, for: 2, mov: 2, siz: 3 },
      traits: ['Grit'],
      bp: 61,
      class: 'Common'
    };
  });

  it('should create a single profile with a specified primary item', () => {
    const primaryItemName = ['Sword, Broad'];
    const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, [], primaryItemName);

    expect(profiles).toHaveLength(1);
    const profile = profiles[0];
    expect(profile.name).toBe('veteran-sword-broad-loadout');
    
    expect(profile.archetype).toHaveProperty(veteranArchetypeName);
    expect(profile.archetype[veteranArchetypeName]).toEqual(veteranArchetypeData);

    expect(profile.items).toHaveLength(1);
    expect(profile.items[0].name).toBe('Sword, Broad');

    const swordData = gameData.melee_weapons['Sword, Broad'];
    expect(profile.totalBp).toBe(veteranArchetypeData.bp + swordData.bp);
  });

  it('should create a single profile with multiple specified items and calculate all new properties', () => {
    // This loadout uses 4 hands (Rifle 2, Pistol 1, Shield 1), which is valid.
    const itemNames = ['Rifle, Medium, Semi/A', 'Pistol, Medium, Auto', 'Armor, Medium', 'Shield, Medium'];
    const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, [], itemNames);

    expect(profiles).toHaveLength(1);
    const profile = profiles[0];

    // BP
    const pistolData = gameData.ranged_weapons['Pistol, Medium, Auto']; // 47 BP
    const rifleData = gameData.ranged_weapons['Rifle, Medium, Semi/A']; // 36 BP
    const armorData = gameData.armors['Armor, Medium']; // 13 BP
    const shieldData = gameData.armors['Shield, Medium']; // 10 BP
    const expectedAdjustedBp = veteranArchetypeData.bp + pistolData.bp + Math.ceil(rifleData.bp / 2) + armorData.bp + shieldData.bp;
    expect(profile.adjustedBp).toBe(expectedAdjustedBp); // 61 + 47 + 18 + 13 + 10 = 149

    // Physicality & Durability
    expect(profile.physicality).toBe(3); // max(str:2, siz:3)
    expect(profile.adjPhysicality).toBe(3);
    expect(profile.durability).toBe(3); // max(for:2, siz:3)
    expect(profile.adjDurability).toBe(3);

    // Burden
    expect(profile.burden.totalLaden).toBe(3); // Armor(2) + Shield(1)
    expect(profile.burden.totalBurden).toBe(0); // 3 (Laden) - 3 (adjPhysicality)

    // Final Traits - check for combined/leveled traits
    expect(profile.finalTraits).toEqual(expect.arrayContaining([
        'Grit', 'ROF 3', '2H', 'Melee', 'Conceal', 'Burst', '1H', 'Jitter', 'Feed', 'Armor 5', 'Laden', 'Deflect 2', 'Coverage'
    ]));
  });
  
  it('should correctly calculate adjPhysicality with Brawn trait', () => {
    veteranArchetypeData.traits.push('Brawn 2');
    const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, [], ['Sword, Broad']);
    const profile = profiles[0];
    expect(profile.physicality).toBe(3);
    expect(profile.adjPhysicality).toBe(5); // 3 + 2
  });

  it('should throw an error for multiple armor items of the same type', () => {
    const itemNames = ['Armor, Medium', 'Armor, Light'];
    expect(() => createProfiles(veteranArchetypeName, veteranArchetypeData, [], itemNames)).toThrow();
  });

  it('should throw an error if total hands required exceeds 4', () => {
    const itemNames = ['Rifle, Medium, Semi/A', 'Rifle, Medium, Semi/A', 'Rifle, Medium, Semi/A']; // 3 x [2H] = 6 hands
    const create = () => createProfiles(veteranArchetypeName, veteranArchetypeData, [], itemNames);
    expect(create).toThrow('Invalid loadout: Exceeds maximum of 4 hands required.');
  });

  it('should throw an error if total weapons exceeds 3', () => {
    const bowName = Object.keys(gameData.bow_weapons)[0];
    const weaponNames = [
      'Sword, Broad',
      'Pistol, Medium, Auto',
      'Rifle, Medium, Semi/A',
      bowName
    ];
    const create = () => createProfiles(veteranArchetypeName, veteranArchetypeData, [], weaponNames);
    expect(create).toThrow('Invalid loadout: A maximum of 3 weapons are allowed.');
  });

  it('should prioritize 2H weapons for in-hand items', () => {
    const equipmentName = Object.keys(gameData.equipment)[0];
    const itemNames = [
      'Rifle, Medium, Semi/A',
      'Pistol, Medium, Auto',
      'Shield, Medium',
      equipmentName
    ];
    const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, [], itemNames);
    const profile = profiles[0];

    expect(profile.inHandItems?.length).toBe(1);
    expect(profile.inHandItems?.[0].name).toBe('Rifle, Medium, Semi/A');
    expect(profile.stowedItems?.map(item => item.name)).toEqual(expect.arrayContaining([
      'Pistol, Medium, Auto',
      'Shield, Medium',
      equipmentName
    ]));
  });

  it('should place 1H weapons before shields in hand', () => {
    const itemNames = [
      'Pistol, Medium, Auto',
      'Shield, Medium',
      'Sword, Broad'
    ];
    const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, [], itemNames);
    const profile = profiles[0];

    expect(profile.inHandItems?.length).toBe(2);
    expect(profile.inHandItems?.map(item => item.name)).toEqual([
      'Pistol, Medium, Auto',
      'Sword, Broad'
    ]);
    expect(profile.stowedItems?.map(item => item.name)).toEqual(expect.arrayContaining([
      'Shield, Medium'
    ]));
  });
});
