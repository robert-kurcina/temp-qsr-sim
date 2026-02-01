/**
 * Represents the situational context in which a test is being made.
 * This object gathers all relevant data beyond the active and passive characters
 * to determine any situational bonus or penalty dice.
 */
export interface TestContext {
  // --- Action & Choice Modifiers ---
  isCharge?: boolean;       // For the +1m Charge bonus
  isDefending?: boolean;    // For the +1b Defend bonus
  isOverreach?: boolean;    // For the -1 Overreach penalty
  isSudden?: boolean;       // For the +1m Suddenness bonus
  isConcentrating?: boolean;// For the +1w Concentrate bonus
  isFocusing?: boolean;     // For the +1w Focus bonus
  isBlindAttack?: boolean;  // For the -1w Blind penalty
  isFiddle?: boolean;       // For the +1m Help bonus

  // --- Close Combat Spatial Modifiers ---
  assistingModels?: number; // For the +1 Assist bonus (per model)
  outnumberAdvantage?: number; // For the +1w Outnumber bonus (per threshold)
  hasHighGround?: boolean;  // For the +1m High Ground bonus
  isCornered?: boolean;     // For the -1m Cornered penalty
  isFlanked?: boolean;      // For the -1m Flanked penalty

  // --- Ranged Combat & Detection Modifiers ---
  distance?: number;        // For Point-blank, Elevation, and Distance modifiers
  orm?: number;             // For the -1m Distance penalty per ORM
  elevationAdvantage?: number; // For the +1m Elevation bonus
  obscuringModels?: number; // For the -1m Obscured penalty
  isLeaning?: boolean;      // For the -1b Leaning penalty (active character)
  isTargetLeaning?: boolean;// For the -1b Leaning penalty (passive character)

  // --- Cover Modifiers ---
  hasInterveningCover?: boolean; // For the -1m Intervening Cover penalty
  hasDirectCover?: boolean;    // For the -1b Direct Cover penalty
  hasHardCover?: boolean;      // For the -1w Hard Cover penalty

  // --- Miscellaneous Modifiers ---
  isGroupAction?: boolean;  // For the +1 Solo bonus
  helpingModels?: number;   // For the +1m Help bonus
  isSafe?: boolean;         // For the +1w Safety bonus (Morale)
  isConfined?: boolean;     // For the -1m Confined penalty
}
