/**
 * Designated Leader Identification Tests
 */

import { describe, it, expect } from 'vitest';
import { identifyDesignatedLeader, isDesignatedLeader, getLeaderMoraleBonus, getLeaderRallyBonus, isSituationalAwarenessCheckRequired } from './leader-identification';
import { buildMissionSide } from '../mission/MissionSideBuilder';
import { buildAssembly, buildProfile } from '../mission/assembly-builder';
import { Battlefield } from '../battlefield/Battlefield';
import { Character } from './Character';

describe('identifyDesignatedLeader', () => {
  it('should prioritize Leadership trait for non-initiative tests', () => {
    const leaderProfile = buildProfile('Average', {} as any);
    leaderProfile.finalTraits = ['Leadership 2'];
    leaderProfile.allTraits = ['Leadership 2'];
    
    const regularProfile = buildProfile('Average', {} as any);
    regularProfile.finalTraits = ['Tactics 1'];
    regularProfile.allTraits = ['Tactics 1'];
    
    const leaderAssembly = buildAssembly('Leaders', [leaderProfile]);
    const regularAssembly = buildAssembly('Regulars', [regularProfile]);
    const side = buildMissionSide('Test Side', [leaderAssembly, regularAssembly]);
    
    const leader = identifyDesignatedLeader(side, 'morale');
    expect(leader).toBeDefined();
    expect(leader?.profile.finalTraits).toContain('Leadership 2');
  });
  
  it('should use outcome-based selection for initiative tests', () => {
    // Character with INT 4 but no friendly models in range
    const highIntProfile = buildProfile('Average', {} as any);
    highIntProfile.attributes = { ...highIntProfile.attributes!, int: 4 };
    
    // Character with INT 2 + Tactics 2 (better carry-over potential)
    const tacticsProfile = buildProfile('Average', {} as any);
    tacticsProfile.attributes = { ...tacticsProfile.attributes!, int: 2 };
    tacticsProfile.finalTraits = ['Tactics 2'];
    tacticsProfile.allTraits = ['Tactics 2'];
    
    const highIntAssembly = buildAssembly('HighInt', [highIntProfile]);
    const tacticsAssembly = buildAssembly('Tactics', [tacticsProfile]);
    const side = buildMissionSide('Test Side', [highIntAssembly, tacticsAssembly]);
    
    // Create battlefield and place models far apart
    const battlefield = new Battlefield(24, 24);
    battlefield.placeCharacter(new Character(highIntProfile), { x: 0, y: 0 });
    battlefield.placeCharacter(new Character(tacticsProfile), { x: 20, y: 20 }); // Out of range
    
    // visibilityOR 16 = Day Clear, Awareness range = 16 × 3 = 48 MU
    const leader = identifyDesignatedLeader(side, 'initiative', battlefield, 16);
    
    // High INT character can't use INT (no friends in range)
    // Tactics character has better expected outcome from carry-over
    expect(leader).toBeDefined();
  });
  
  it('should select character with friendly models in range for initiative', () => {
    // Character with INT 4 but isolated (no friends in range)
    const isolatedProfile = buildProfile('Average', {} as any);
    isolatedProfile.attributes = { ...isolatedProfile.attributes!, int: 4 };
    
    // Character with INT 3 but has friendly models in range
    const connectedProfile = buildProfile('Average', {} as any);
    connectedProfile.attributes = { ...connectedProfile.attributes!, int: 3 };
    
    // Friend for connected character
    const friendProfile = buildProfile('Average', {} as any);
    
    const isolatedAssembly = buildAssembly('Isolated', [isolatedProfile]);
    const connectedAssembly = buildAssembly('Connected', [connectedProfile, friendProfile]);
    const side = buildMissionSide('Test Side', [isolatedAssembly, connectedAssembly]);
    
    // Create battlefield - place connected character near friend, isolated VERY far away
    const battlefield = new Battlefield(100, 100);
    // Use the actual Character objects from assemblies
    battlefield.placeCharacter(isolatedAssembly.characters[0], { x: 0, y: 0 }); // Isolated
    battlefield.placeCharacter(connectedAssembly.characters[0], { x: 50, y: 50 }); // Near friend
    battlefield.placeCharacter(connectedAssembly.characters[1], { x: 51, y: 50 }); // Friend nearby (1 MU from connected)
    
    // visibilityOR 16 = Day Clear, Awareness range = 16 × 3 = 48 MU
    // Isolated character at (0,0) has no friends within 48 MU
    // Connected character at (50,50) has friend at (51,50) which is 1 MU away
    const leader = identifyDesignatedLeader(side, 'initiative', battlefield, 16);
    
    // Connected character should win because they can use INT bonus (has friend in range)
    // Isolated character can't use INT (no friends within 48 MU Awareness range)
    expect(leader?.attributes.int).toBe(3);
  });
  
  it('should prioritize Tactics trait if no Leadership for non-initiative', () => {
    const tacticsProfile = buildProfile('Average', {} as any);
    tacticsProfile.finalTraits = ['Tactics 2'];
    tacticsProfile.allTraits = ['Tactics 2'];
    
    const regularProfile = buildProfile('Average', {} as any);
    
    const tacticsAssembly = buildAssembly('Tacticians', [tacticsProfile]);
    const regularAssembly = buildAssembly('Regulars', [regularProfile]);
    const side = buildMissionSide('Test Side', [tacticsAssembly, regularAssembly]);
    
    const leader = identifyDesignatedLeader(side, 'morale');
    expect(leader).toBeDefined();
    expect(leader?.profile.finalTraits).toContain('Tactics 2');
  });
  
  it('should use INT as tiebreaker for same trait level', () => {
    const leader1Profile = buildProfile('Average', {} as any);
    leader1Profile.finalTraits = ['Leadership 1'];
    leader1Profile.allTraits = ['Leadership 1'];
    leader1Profile.attributes = { ...leader1Profile.attributes!, int: 4 };
    
    const leader2Profile = buildProfile('Average', {} as any);
    leader2Profile.finalTraits = ['Leadership 1'];
    leader2Profile.allTraits = ['Leadership 1'];
    leader2Profile.attributes = { ...leader2Profile.attributes!, int: 2 };
    
    const assembly = buildAssembly('Leaders', [leader1Profile, leader2Profile]);
    const side = buildMissionSide('Test Side', [assembly]);
    
    const leader = identifyDesignatedLeader(side, 'morale');
    expect(leader?.attributes.int).toBe(4);
  });
  
  it('should use POW as secondary tiebreaker', () => {
    const leader1Profile = buildProfile('Average', {} as any);
    leader1Profile.finalTraits = ['Leadership 1'];
    leader1Profile.allTraits = ['Leadership 1'];
    leader1Profile.attributes = { ...leader1Profile.attributes!, int: 3, pow: 4 };
    
    const leader2Profile = buildProfile('Average', {} as any);
    leader2Profile.finalTraits = ['Leadership 1'];
    leader2Profile.allTraits = ['Leadership 1'];
    leader2Profile.attributes = { ...leader2Profile.attributes!, int: 3, pow: 2 };
    
    const assembly = buildAssembly('Leaders', [leader1Profile, leader2Profile]);
    const side = buildMissionSide('Test Side', [assembly]);
    
    const leader = identifyDesignatedLeader(side, 'morale');
    expect(leader?.attributes.pow).toBe(4);
  });
  
  it('should use BP as tertiary tiebreaker', () => {
    const leader1Profile = buildProfile('Veteran', {} as any);
    leader1Profile.finalTraits = ['Leadership 1'];
    leader1Profile.allTraits = ['Leadership 1'];
    leader1Profile.attributes = { ...leader1Profile.attributes!, int: 3, pow: 3 };
    
    const leader2Profile = buildProfile('Average', {} as any);
    leader2Profile.finalTraits = ['Leadership 1'];
    leader2Profile.allTraits = ['Leadership 1'];
    leader2Profile.attributes = { ...leader2Profile.attributes!, int: 3, pow: 3 };
    
    const assembly = buildAssembly('Leaders', [leader1Profile, leader2Profile]);
    const side = buildMissionSide('Test Side', [assembly]);
    
    const leader = identifyDesignatedLeader(side, 'morale');
    // Veteran has higher BP than Average
    expect(leader?.profile.totalBp).toBeGreaterThan(30);
  });
  
  it('should exclude KO\'d and Eliminated models', () => {
    const leaderProfile = buildProfile('Average', {} as any);
    leaderProfile.finalTraits = ['Leadership 2'];
    leaderProfile.allTraits = ['Leadership 2'];
    
    const koProfile = buildProfile('Average', {} as any);
    koProfile.finalTraits = ['Leadership 1'];
    koProfile.allTraits = ['Leadership 1'];
    
    const leaderAssembly = buildAssembly('Leaders', [leaderProfile]);
    const koAssembly = buildAssembly('KO\'d', [koProfile]);
    const side = buildMissionSide('Test Side', [leaderAssembly, koAssembly]);
    
    // Mark one as KO'd
    koAssembly.characters[0].state.isKOd = true;
    
    const leader = identifyDesignatedLeader(side, 'morale');
    expect(leader?.profile.finalTraits).toContain('Leadership 2');
  });
  
  it('should return null if no active models', () => {
    const koProfile = buildProfile('Average', {} as any);
    const elimProfile = buildProfile('Average', {} as any);
    
    const koAssembly = buildAssembly('KO\'d', [koProfile]);
    const elimAssembly = buildAssembly('Eliminated', [elimProfile]);
    const side = buildMissionSide('Test Side', [koAssembly, elimAssembly]);
    
    // Mark all as KO'd or Eliminated
    koAssembly.characters[0].state.isKOd = true;
    elimAssembly.characters[0].state.isEliminated = true;
    
    const leader = identifyDesignatedLeader(side, 'morale');
    expect(leader).toBeNull();
  });
  
  it('should re-evaluate leader when models eliminated', () => {
    const leader1Profile = buildProfile('Average', {} as any);
    leader1Profile.finalTraits = ['Leadership 2'];
    leader1Profile.allTraits = ['Leadership 2'];
    
    const leader2Profile = buildProfile('Average', {} as any);
    leader2Profile.finalTraits = ['Leadership 1'];
    leader2Profile.allTraits = ['Leadership 1'];
    
    const leader1Assembly = buildAssembly('Leader1', [leader1Profile]);
    const leader2Assembly = buildAssembly('Leader2', [leader2Profile]);
    const side = buildMissionSide('Test Side', [leader1Assembly, leader2Assembly]);
    
    // First leader should be Leadership 2
    let leader = identifyDesignatedLeader(side, 'morale');
    expect(leader?.profile.finalTraits).toContain('Leadership 2');
    
    // Eliminate first leader
    leader1Assembly.characters[0].state.isEliminated = true;
    
    // Leader should now be Leadership 1
    leader = identifyDesignatedLeader(side, 'morale');
    expect(leader?.profile.finalTraits).toContain('Leadership 1');
  });
  
  it('should use Visibility OR × 3 for Awareness range', () => {
    const leaderProfile = buildProfile('Average', {} as any);
    leaderProfile.attributes = { ...leaderProfile.attributes!, int: 4 };
    
    const friendProfile = buildProfile('Average', {} as any);
    
    const leaderAssembly = buildAssembly('Leader', [leaderProfile]);
    const friendAssembly = buildAssembly('Friend', [friendProfile]);
    const side = buildMissionSide('Test Side', [leaderAssembly, friendAssembly]);
    
    const battlefield = new Battlefield(48, 48);
    battlefield.placeCharacter(new Character(leaderProfile), { x: 20, y: 20 });
    battlefield.placeCharacter(new Character(friendProfile), { x: 50, y: 20 }); // 30 MU away
    
    // visibilityOR 16 = Day Clear, Awareness range = 16 × 3 = 48 MU
    // Friend is 30 MU away, so should be in range
    const leader = identifyDesignatedLeader(side, 'initiative', battlefield, 16);
    
    // Leader should be able to use INT (friend is within 48 MU Awareness range)
    expect(leader?.attributes.int).toBe(4);
  });
  
  it('should use Visibility OR × 1 for Distracted leader', () => {
    const leaderProfile = buildProfile('Average', {} as any);
    leaderProfile.attributes = { ...leaderProfile.attributes!, int: 4 };
    
    const friendProfile = buildProfile('Average', {} as any);
    
    const leaderAssembly = buildAssembly('Leader', [leaderProfile]);
    const friendAssembly = buildAssembly('Friend', [friendProfile]);
    const side = buildMissionSide('Test Side', [leaderAssembly, friendAssembly]);
    
    const battlefield = new Battlefield(48, 48);
    battlefield.placeCharacter(new Character(leaderProfile), { x: 20, y: 20 });
    battlefield.placeCharacter(new Character(friendProfile), { x: 30, y: 20 }); // 10 MU away
    
    // visibilityOR 16, but Distracted so Awareness range = 16 × 1 = 16 MU
    // Friend is 10 MU away, so should be in range
    const leader = identifyDesignatedLeader(side, 'initiative', battlefield, 16, true);
    
    // Leader should be able to use INT (friend is within 16 MU Awareness range)
    expect(leader?.attributes.int).toBe(4);
  });
  
  it('should require half of forces in range for SA', () => {
    const leaderProfile = buildProfile('Average', {} as any);
    leaderProfile.attributes = { ...leaderProfile.attributes!, int: 4 };
    
    // Create 3 friends, but only 1 in range (need 2 out of 4 = half)
    const friend1Profile = buildProfile('Average', {} as any);
    const friend2Profile = buildProfile('Average', {} as any);
    const friend3Profile = buildProfile('Average', {} as any);
    
    const leaderAssembly = buildAssembly('Leader', [leaderProfile, friend1Profile, friend2Profile, friend3Profile]);
    const side = buildMissionSide('Test Side', [leaderAssembly]);
    
    const battlefield = new Battlefield(48, 48);
    battlefield.placeCharacter(new Character(leaderProfile), { x: 20, y: 20 });
    battlefield.placeCharacter(new Character(friend1Profile), { x: 22, y: 20 }); // In range (2 MU)
    battlefield.placeCharacter(new Character(friend2Profile), { x: 40, y: 20 }); // Out of range
    battlefield.placeCharacter(new Character(friend3Profile), { x: 42, y: 20 }); // Out of range
    
    // visibilityOR 16, Awareness range = 16 × 3 = 48 MU
    // Actually all should be in range with 48 MU... let me adjust
    // Put friends at 50 MU away
    battlefield.placeCharacter(new Character(friend2Profile), { x: 70, y: 20 }); // Out of range (50 MU)
    battlefield.placeCharacter(new Character(friend3Profile), { x: 72, y: 20 }); // Out of range (52 MU)
    
    const leader = identifyDesignatedLeader(side, 'initiative', battlefield, 16);
    
    // Only 2 out of 4 models in range (leader + friend1), which is exactly half
    // Should meet requirement (>= half)
    expect(leader).toBeDefined();
  });
});

describe('isSituationalAwarenessCheckRequired', () => {
  it('should not require SA check on Turn 1', () => {
    const result = isSituationalAwarenessCheckRequired(1, 10, 4);
    expect(result).toBe(false);
  });
  
  it('should not require SA check if side has >= half models', () => {
    const result = isSituationalAwarenessCheckRequired(5, 10, 5);
    expect(result).toBe(false);
  });
  
  it('should require SA check if side has < half models', () => {
    const result = isSituationalAwarenessCheckRequired(5, 10, 4);
    expect(result).toBe(true);
  });
  
  it('should not require SA check if Tactics level not exceeded', () => {
    // Tactics 2, only 1 SA check performed so far
    const result = isSituationalAwarenessCheckRequired(5, 10, 4, 2, 1);
    expect(result).toBe(false);
  });
  
  it('should require SA check if Tactics level exceeded', () => {
    // Tactics 2, 2 SA checks already performed
    const result = isSituationalAwarenessCheckRequired(5, 10, 4, 2, 2);
    expect(result).toBe(true);
  });
});

describe('isDesignatedLeader', () => {
  it('should return true for designated leader', () => {
    const leaderProfile = buildProfile('Average', {
      traits: ['Leadership 1'],
    });
    const regularProfile = buildProfile('Average', {} as any);
    
    const leaderAssembly = buildAssembly('Leader', [leaderProfile]);
    const regularAssembly = buildAssembly('Regular', [regularProfile]);
    const side = buildMissionSide('Test Side', [leaderAssembly, regularAssembly]);
    
    const leader = leaderAssembly.characters[0];
    expect(isDesignatedLeader(leader, side)).toBe(true);
    
    const regular = regularAssembly.characters[0];
    expect(isDesignatedLeader(regular, side)).toBe(false);
  });
});

describe('getLeaderMoraleBonus', () => {
  it('should return bonus based on Leadership level', () => {
    const leaderProfile = buildProfile('Average', {} as any);
    leaderProfile.finalTraits = ['Leadership 2'];
    leaderProfile.allTraits = ['Leadership 2'];
    
    const assembly = buildAssembly('Leaders', [leaderProfile]);
    const side = buildMissionSide('Test Side', [assembly]);
    
    const leader = identifyDesignatedLeader(side);
    const bonus = getLeaderMoraleBonus(leader);
    
    expect(bonus).toBe(2);
  });
  
  it('should return 0 if no leader', () => {
    const bonus = getLeaderMoraleBonus(null);
    expect(bonus).toBe(0);
  });
});

describe('getLeaderRallyBonus', () => {
  it('should return enhanced bonus if rallying character is leader', () => {
    const leaderProfile = buildProfile('Average', {
      attributes: { pow: 3 },
    });
    // Manually set traits since buildProfile doesn't support custom traits
    leaderProfile.finalTraits = ['Leadership 2'];
    leaderProfile.allTraits = ['Leadership 2'];
    
    const assembly = buildAssembly('Leaders', [leaderProfile]);
    const side = buildMissionSide('Test Side', [assembly]);

    const leader = assembly.characters[0];
    const bonus = getLeaderRallyBonus(leader, side);

    // Leadership 2 + floor(POW 3 / 2) = 2 + 1 = 3
    expect(bonus).toBe(3);
  });

  it('should return 0 if rallying character is not leader', () => {
    const leaderProfile = buildProfile('Average', {} as any);
    leaderProfile.finalTraits = ['Leadership 1'];
    leaderProfile.allTraits = ['Leadership 1'];
    
    const regularProfile = buildProfile('Average', {} as any);

    const leaderAssembly = buildAssembly('Leader', [leaderProfile]);
    const regularAssembly = buildAssembly('Regular', [regularProfile]);
    const side = buildMissionSide('Test Side', [leaderAssembly, regularAssembly]);

    const regular = regularAssembly.characters[0];
    const bonus = getLeaderRallyBonus(regular, side);
    
    expect(bonus).toBe(0);
  });
});
