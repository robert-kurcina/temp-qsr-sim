/**
 * Designated Leader Identification System
 * 
 * Identifies temporary designated leaders for tests that require it
 * (Situational Awareness, Morale, Rally, etc.).
 * 
 * Leader is the best fit at time of test, not a permanent role.
 * Re-evaluated before each test based on which candidate provides
 * the BEST OUTCOME for that specific test.
 */

import { Character } from '../core/Character';
import { MissionSide } from '../mission/MissionSide';
import { Battlefield } from '../battlefield/Battlefield';

/**
 * Check if character has a trait (by name prefix match)
 */
function hasTrait(character: Character, traitName: string): boolean {
  const allTraits = [
    ...(character.profile?.finalTraits || []),
    ...(character.profile?.allTraits || []),
  ];
  return allTraits.some(t => t.startsWith(traitName));
}

/**
 * Get trait level (e.g., 'Leadership 2' -> 2)
 */
function getTraitLevel(character: Character, traitName: string): number {
  const allTraits = [
    ...(character.profile?.finalTraits || []),
    ...(character.profile?.allTraits || []),
  ];
  
  for (const trait of allTraits) {
    if (trait.startsWith(traitName)) {
      const match = trait.match(/(\d+)$/);
      if (match) {
        return parseInt(match[1], 10);
      }
      return 1; // Default level if no number specified
    }
  }
  return 0;
}

/**
 * Check if character has friendly models within LOS and Awareness range for Situational Awareness
 * 
 * Per QSR rules:
 * - Awareness range = Visibility OR × 3 (or × 1 if Distracted)
 * - Leader needs half of forces within LOS and Awareness range (counting itself)
 * - Hidden characters behind Cover from Leader are NOT counted
 * - Do not count KO'd or Eliminated models
 * 
 * @param leader - Designated Leader character
 * @param side - Side the leader belongs to
 * @param battlefield - Battlefield for LOS/range checks
 * @param visibilityOR - Visibility OR for current lighting conditions
 * @param isDistracted - Whether leader is Distracted (reduces range to Visibility × 1)
 * @returns Object with count and whether SA requirements are met
 */
function checkSituationalAwareness(
  leader: Character,
  side: MissionSide,
  battlefield: Battlefield,
  visibilityOR: number,
  isDistracted: boolean = false
): {
  modelsInRange: number;
  totalActiveModels: number;
  awarenessRange: number;
  meetsRequirement: boolean;
} {
  const charPos = battlefield.getCharacterPosition(leader);
  if (!charPos) {
    return { modelsInRange: 0, totalActiveModels: 0, awarenessRange: 0, meetsRequirement: false };
  }
  
  // Awareness range: Visibility OR × 3 (or × 1 if Distracted)
  const awarenessRange = visibilityOR * (isDistracted ? 1 : 3);
  
  // Count active models (excluding KO'd and Eliminated)
  let totalActiveModels = 0;
  let modelsInRange = 0;
  
  for (const member of side.members) {
    // Skip KO'd and Eliminated models
    if (member.character.state.isKOd || member.character.state.isEliminated) {
      continue;
    }
    
    totalActiveModels++;
    
    // Skip if this is the leader (always counts)
    if (member.character.id === leader.id) {
      modelsInRange++;
      continue;
    }
    
    // Skip Hidden characters behind Cover from Leader's perspective
    // (Simplified: check if character is Hidden)
    if (member.character.state.isHidden) {
      continue;
    }
    
    const friendPos = battlefield.getCharacterPosition(member.character);
    if (!friendPos) {
      continue;
    }
    
    // Check range
    const distance = Math.hypot(
      charPos.x - friendPos.x,
      charPos.y - friendPos.y
    );
    
    if (distance <= awarenessRange) {
      // Simple LOS check - would need full LOS validation in production
      modelsInRange++;
    }
  }
  
  // Leader needs half of forces within range (counting itself)
  const requiredModels = Math.ceil(totalActiveModels / 2);
  const meetsRequirement = modelsInRange >= requiredModels;
  
  return {
    modelsInRange,
    totalActiveModels,
    awarenessRange,
    meetsRequirement,
  };
}

/**
 * Check if Situational Awareness check is required this turn
 * 
 * Per QSR rules:
 * - Do NOT check on Turn 1
 * - Check when Side has been reduced to less than half its original model count
 * - Characters with Tactics X avoid the first X turns requiring SA checks
 * 
 * @param currentTurn - Current turn number
 * @param originalModelCount - Original model count at start of battle
 * @param currentModelCount - Current active model count
 * @param tacticsLevel - Total Tactics trait level in side (for avoiding SA checks)
 * @param saChecksPerformed - Number of SA checks already performed this battle
 * @returns true if SA check is required
 */
export function isSituationalAwarenessCheckRequired(
  currentTurn: number,
  originalModelCount: number,
  currentModelCount: number,
  tacticsLevel: number = 0,
  saChecksPerformed: number = 0
): boolean {
  // Do not check on Turn 1
  if (currentTurn <= 1) {
    return false;
  }
  
  // Check if side has been reduced to less than half
  const halfCount = originalModelCount / 2;
  if (currentModelCount >= halfCount) {
    return false;
  }
  
  // Tactics X avoids the first X turns requiring SA checks
  if (saChecksPerformed < tacticsLevel) {
    return false;
  }
  
  return true;
}

/**
 * Calculate expected Initiative Test outcome for a candidate leader
 * 
 * Considers:
 * - INT attribute (but only if Situational Awareness requirements met)
 * - Tactics trait (carry-over dice generation)
 * - Situational Awareness (requires half of forces in LOS and Awareness range)
 * - Leadership trait (morale benefits)
 * 
 * @param candidate - Candidate leader character
 * @param side - Side the candidate belongs to
 * @param battlefield - Battlefield for LOS/range checks
 * @param visibilityOR - Visibility OR for current lighting conditions
 * @param isDistracted - Whether candidate is Distracted (reduces Awareness range)
 * @returns Expected outcome with canUseINT flag
 */
function calculateInitiativeOutcome(
  candidate: Character,
  side: MissionSide,
  battlefield: Battlefield,
  visibilityOR: number = 16, // Default Day, Clear
  isDistracted: boolean = false
): {
  expectedSuccesses: number;
  expectedCarryOver: number;
  canUseINT: boolean;
  saCheck: {
    modelsInRange: number;
    totalActiveModels: number;
    awarenessRange: number;
    meetsRequirement: boolean;
  } | null;
  score: number;
} {
  const intAttr = candidate.attributes.int || 0;
  const tacticsLevel = getTraitLevel(candidate, 'Tactics');
  const leadershipLevel = getTraitLevel(candidate, 'Leadership');
  
  // Check Situational Awareness requirements
  const saCheck = checkSituationalAwareness(
    candidate,
    side,
    battlefield,
    visibilityOR,
    isDistracted
  );
  
  // Can use INT bonus only if SA requirements are met
  const canUseINT = saCheck.meetsRequirement;
  
  // Expected successes from INT (if available)
  const expectedSuccesses = canUseINT ? intAttr : 0;
  
  // Expected carry-over dice from Tactics (each level = +1 Base die, 6s carry over)
  // Probability of rolling 6 on d6 = 1/6, each 6 = 2 successes + carry-over
  const expectedCarryOver = tacticsLevel * 0.17; // ~17% chance per die
  
  // Leadership provides morale benefits (not directly IP but valuable)
  const leadershipBonus = leadershipLevel * 0.3;
  
  // Total score = successes + carryOver value + leadership value
  const score = expectedSuccesses + (expectedCarryOver * 2) + leadershipBonus;
  
  return {
    expectedSuccesses,
    expectedCarryOver,
    canUseINT,
    saCheck,
    score,
  };
}

/**
 * Identify designated leader for a side at time of test
 * 
 * Selection is OUTCOME-BASED - picks the candidate that provides
 * the BEST expected outcome for the specific test type.
 * 
 * For Initiative Tests, considers:
 * - INT attribute (but only if Situational Awareness requirements met)
 * - Tactics trait (carry-over dice generation)
 * - Leadership trait (morale benefits)
 * - Friendly models in LOS and Awareness range (Visibility OR × 3, or × 1 if Distracted)
 * - Situational Awareness: needs half of forces in range (counting self)
 * 
 * @param side - The side to identify leader for
 * @param testType - Type of test requiring leader ('initiative' | 'morale' | 'rally')
 * @param battlefield - Battlefield for LOS/range checks (required for initiative)
 * @param visibilityOR - Visibility OR for current lighting (default 16 = Day, Clear)
 * @param isDistracted - Whether leader is Distracted (reduces Awareness range)
 * @returns Character designated as leader, or null if no valid candidate
 */
export function identifyDesignatedLeader(
  side: MissionSide,
  testType: string = 'general',
  battlefield: Battlefield | null = null,
  visibilityOR: number = 16,
  isDistracted: boolean = false
): Character | null {
  // Filter to active, non-KO'd, non-Eliminated models
  const candidates = side.members
    .filter(m => !m.character.state.isKOd && !m.character.state.isEliminated)
    .map(m => m.character);
  
  if (candidates.length === 0) {
    return null;
  }
  
  // For Initiative Tests, use outcome-based selection
  if (testType === 'initiative' && battlefield) {
    return selectBestInitiativeLeader(candidates, side, battlefield, visibilityOR, isDistracted);
  }
  
  // For other tests, use trait/priority-based selection
  return selectBestPriorityLeader(candidates, testType);
}

/**
 * Select leader based on best expected Initiative Test outcome
 */
function selectBestInitiativeLeader(
  candidates: Character[],
  side: MissionSide,
  battlefield: Battlefield,
  visibilityOR: number = 16,
  isDistracted: boolean = false
): Character | null {
  let bestCandidate: Character | null = null;
  let bestScore = -Infinity;
  
  for (const candidate of candidates) {
    const outcome = calculateInitiativeOutcome(
      candidate,
      side,
      battlefield,
      visibilityOR,
      isDistracted
    );
    
    if (outcome.score > bestScore) {
      bestScore = outcome.score;
      bestCandidate = candidate;
    }
  }
  
  return bestCandidate;
}

/**
 * Select leader based on trait priority (fallback for non-initiative tests)
 */
function selectBestPriorityLeader(
  candidates: Character[],
  testType: string
): Character | null {
  // Priority 1: Leadership trait (Leader keyword)
  const leaders = candidates.filter(c => hasTrait(c, 'Leadership'));
  if (leaders.length > 0) {
    // Pick highest Leadership level, then highest INT
    return leaders.sort((a, b) => {
      const aLevel = getTraitLevel(a, 'Leadership');
      const bLevel = getTraitLevel(b, 'Leadership');
      if (aLevel !== bLevel) {
        return bLevel - aLevel;
      }
      return (b.attributes.int || 0) - (a.attributes.int || 0);
    })[0];
  }
  
  // Priority 2: Tactics trait (Leader keyword)
  const tacticians = candidates.filter(c => hasTrait(c, 'Tactics'));
  if (tacticians.length > 0) {
    // Pick highest Tactics level, then highest INT
    return tacticians.sort((a, b) => {
      const aLevel = getTraitLevel(a, 'Tactics');
      const bLevel = getTraitLevel(b, 'Tactics');
      if (aLevel !== bLevel) {
        return bLevel - aLevel;
      }
      return (b.attributes.int || 0) - (a.attributes.int || 0);
    })[0];
  }
  
  // Priority 3: Highest INT (tactical awareness)
  const byINT = [...candidates].sort((a, b) => 
    (b.attributes.int || 0) - (a.attributes.int || 0)
  );
  const topINT = byINT[0];
  const tiedByINT = byINT.filter(c => c.attributes.int === topINT.attributes.int);
  
  if (tiedByINT.length === 1) {
    return topINT;
  }
  
  // Priority 4: Highest POW (willpower/command presence)
  const byPOW = tiedByINT.sort((a, b) => 
    (b.attributes.pow || 0) - (a.attributes.pow || 0)
  );
  const topPOW = byPOW[0];
  const tiedByPOW = byPOW.filter(c => c.attributes.pow === topPOW.attributes.pow);
  
  if (tiedByPOW.length === 1) {
    return topPOW;
  }
  
  // Priority 5: Highest BP (veteran/experienced model)
  const byBP = tiedByPOW.sort((a, b) => 
    (b.profile?.totalBp || 0) - (a.profile?.totalBp || 0)
  );
  
  return byBP[0] || null;
}

/**
 * Check if character is designated leader for their side
 * 
 * @param character - Character to check
 * @param side - Side the character belongs to
 * @param testType - Type of test requiring leader
 * @returns true if character is designated leader
 */
export function isDesignatedLeader(
  character: Character,
  side: MissionSide,
  testType: string = 'general'
): boolean {
  const leader = identifyDesignatedLeader(side, testType);
  return leader?.id === character.id;
}

/**
 * Get leader bonus for morale tests
 * 
 * @param leader - Designated leader character
 * @returns Bonus to apply to morale test (based on Leadership level)
 */
export function getLeaderMoraleBonus(leader: Character | null): number {
  if (!leader) return 0;
  
  const leadershipLevel = getTraitLevel(leader, 'Leadership');
  return leadershipLevel; // +1 per Leadership level
}

/**
 * Get leader bonus for rally actions
 * 
 * @param rallyingCharacter - Character performing rally
 * @param side - Side the rallying character belongs to
 * @returns Bonus to apply to rally test
 */
export function getLeaderRallyBonus(
  rallyingCharacter: Character,
  side: MissionSide
): number {
  const isLeader = isDesignatedLeader(rallyingCharacter, side, 'rally');
  
  if (isLeader) {
    // Leader rallying provides enhanced bonus
    const leadershipLevel = getTraitLevel(rallyingCharacter, 'Leadership');
    const powBonus = rallyingCharacter.attributes.pow || 0;
    return leadershipLevel + Math.floor(powBonus / 2);
  }
  
  return 0;
}
