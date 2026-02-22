
import { Character } from '../core/Character';

// --- Morale State Utility Functions ---

/** Checks if the character has at least 1 Fear token. */
export const isNervous = (character: Character): boolean => character.state.fearTokens >= 1;

/** Checks if the character has at least 2 Fear tokens. */
export const isDisordered = (character: Character): boolean => character.state.fearTokens >= 2;

/** Checks if the character has 3 or more Fear tokens. */
export const isPanicked = (character: Character): boolean => character.state.fearTokens >= 3;

/** Checks if the character has 4 or more Fear tokens and should be eliminated. */
export const isEliminatedByFear = (character: Character): boolean => character.state.fearTokens >= 4;


// --- Compulsory Action Definition ---

/**
 * Defines a compulsory action a character must perform at the start of their activation.
 */
export interface CompulsoryAction {
  actionType: 'Disengage' | 'Move' | 'Rally' | 'Eliminated';
  apCost: number;
  description: string;
}

// --- Main Compulsory Action Logic ---

/**
 * Determines the list of compulsory actions a character must perform based on their fear level and situation.
 * TODO: Review for min-max AI hook to choose compulsory action targets/paths.
 * 
 * @param character The character to check.
 * @returns An array of CompulsoryAction objects. Returns an empty array if no action is required.
 */
export function getCompulsoryActions(character: Character): CompulsoryAction[] {
  // 1. Check for immediate elimination from fear.
  if (isEliminatedByFear(character)) {
    character.state.isEliminated = true;
    return [{
      actionType: 'Eliminated',
      apCost: 0, // No action cost, it's a state change.
      description: 'Character is Eliminated due to accumulating 4 or more Fear tokens.',
    }];
  }

  // 2. If not eliminated, check if they are Disordered. If not, no compulsory actions are needed.
  if (!isDisordered(character)) {
    return [];
  }

  const actions: CompulsoryAction[] = [];
  // 3. Determine the AP cost based on whether the character is Panicked.
  const apToSpend = isPanicked(character) ? 2 : 1;

  // 4. Determine the single compulsory action based on the priority list:
  if (character.state.isEngaged) {
    // Priority 1: If Engaged, must Disengage.
    actions.push({
      actionType: 'Disengage',
      apCost: apToSpend,
      description: `Must spend ${apToSpend} AP to Disengage until Free.`,
    });
  } else if (!character.state.isInCover) {
    // Priority 2: If Free and not in cover, must Move to Safety.
    const safetyDefinition = isPanicked(character)
      ? 'the nearest Friendly battlefield entry edge'
      : 'the nearest Cover or location out of enemy LOS';
    actions.push({
      actionType: 'Move',
      apCost: apToSpend,
      description: `Must spend ${apToSpend} AP to Move towards Safety (${safetyDefinition}).`,
    });
  } else {
    // Priority 3: If in Cover and not Engaged, must Rally.
    actions.push({
      actionType: 'Rally',
      apCost: apToSpend,
      description: `Must spend ${apToSpend} AP to perform a Rally action.`,
    });
  }

  return actions;
}
