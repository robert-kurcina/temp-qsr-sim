import type { Character } from '../core/Character';
import type { Item } from '../core/Item';
import type { TestResult } from '../subroutines/dice-roller';
import { resolveDamage } from './damage-test';

export interface DamageTestContext {
  hasHardCover?: boolean;
  isConcentrating?: boolean;
  isCloseCombat?: boolean;
}

export interface DamageResult {
  wounds: number; // Represents the number of wounds *added* in this single resolution
  stun: number;
  effects: string[];
}

/**
 * Resolves a damage test after a successful hit.
 * @param attacker The character performing the attack.
 * @param defender The character being attacked.
 * @param weapon The weapon used for the attack.
 * @param hitCascades The number of cascades from the successful hit test.
 * @returns A DamageResult object detailing wounds, stun, and other effects.
 */
export function resolveDamageTest(
  attacker: Character,
  defender: Character,
  weapon: Item,
  hitCascades: number
): DamageResult {
  const carryOverDice =
    hitCascades > 0 ? { base: hitCascades as number } : {};
  const simulatedHitResult: TestResult = {
    pass: true,
    score: hitCascades,
    p1FinalScore: hitCascades,
    p2FinalScore: 0,
    cascades: hitCascades,
    carryOverDice,
    p1Rolls: [],
    p2Rolls: [],
  } as any;

  // Legacy compatibility wrapper: the canonical damage flow now lives in damage-test.ts.
  const resolution = resolveDamage(attacker, defender, weapon, simulatedHitResult);
  defender.state.wounds = resolution.defenderState.wounds;
  defender.state.delayTokens = resolution.defenderState.delayTokens;
  defender.state.isKOd = resolution.defenderState.isKOd;
  defender.state.isEliminated = resolution.defenderState.isEliminated;

  const effects: string[] = [];
  if (resolution.defenderState.isKOd) effects.push('KOd');
  if (resolution.defenderState.isEliminated) effects.push('Eliminated');

  return {
    wounds: resolution.woundsAdded,
    stun: resolution.stunWoundsAdded,
    effects,
  };
}
