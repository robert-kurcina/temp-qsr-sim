/**
 * Combat Executor
 *
 * Combat execution for close combat, ranged combat, and disengage actions.
 * Extracted from AIBattleRunner.ts to separate execution logic from decision making.
 */

import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Item } from '../../../src/lib/mest-tactics/core/Item';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { AuditVector } from '../../shared/BattleReportTypes';

export interface AttackResult {
  success: boolean;
  woundsInflicted: number;
  targetEliminated: boolean;
  attackerWoundsTaken: number;
  extras: string[];
}

export interface WeaponSelection {
  weapon: Item;
  reason: string;
}

/**
 * Execute close combat attack
 */
export async function executeCloseCombat(
  gameManager: GameManager,
  attacker: Character,
  defender: Character,
  weapon: Item | null,
  options: {
    overreach?: boolean;
    declaredAction?: string;
    captureAudit?: boolean;
  } = {}
): Promise<AttackResult> {
  const result: AttackResult = {
    success: false,
    woundsInflicted: 0,
    targetEliminated: false,
    attackerWoundsTaken: 0,
    extras: [],
  };

  try {
    // Execute close combat through GameManager
    const attackResult = await gameManager.executeCloseCombatAttack(
      attacker,
      defender,
      weapon,
      {
        overreach: options.overreach,
        declaredAction: options.declaredAction,
      }
    );

    result.success = attackResult?.hitTestResult?.actorWins ?? false;
    result.woundsInflicted = attackResult?.damageResult?.woundsInflicted ?? 0;
    result.targetEliminated = defender.state.isEliminated ?? false;
    result.attackerWoundsTaken = attackResult?.damageResult?.attackerWoundsTaken ?? 0;

    if (attackResult?.hitTestResult?.margin) {
      result.extras.push(`Margin: ${attackResult.hitTestResult.margin}`);
    }

  } catch (error) {
    console.error('Close combat execution failed:', error);
    result.extras.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Execute ranged combat attack
 */
export async function executeRangedCombat(
  gameManager: GameManager,
  attacker: Character,
  defender: Character,
  weapon: Item | null,
  options: {
    leaning?: boolean;
    declaredAction?: string;
    captureAudit?: boolean;
    vectors?: AuditVector[];
  } = {}
): Promise<AttackResult> {
  const result: AttackResult = {
    success: false,
    woundsInflicted: 0,
    targetEliminated: false,
    attackerWoundsTaken: 0,
    extras: [],
  };

  try {
    // Execute ranged combat through GameManager
    const attackResult = await gameManager.executeRangedAttack(
      attacker,
      defender,
      weapon,
      {
        leaning: options.leaning,
        declaredAction: options.declaredAction,
      }
    );

    result.success = attackResult?.hitTestResult?.actorWins ?? false;
    result.woundsInflicted = attackResult?.damageResult?.woundsInflicted ?? 0;
    result.targetEliminated = defender.state.isEliminated ?? false;

    if (attackResult?.hitTestResult?.margin) {
      result.extras.push(`Margin: ${attackResult.hitTestResult.margin}`);
    }

    // Track range band
    if (attackResult?.rangeBand) {
      result.extras.push(`Range: ${attackResult.rangeBand}`);
    }

  } catch (error) {
    console.error('Ranged combat execution failed:', error);
    result.extras.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Execute disengage action
 */
export async function executeDisengage(
  gameManager: GameManager,
  character: Character,
  options: {
    captureAudit?: boolean;
  } = {}
): Promise<{
  success: boolean;
  moved: boolean;
  woundsTaken: number;
  extras: string[];
}> {
  const result = {
    success: false,
    moved: false,
    woundsTaken: 0,
    extras: [],
  };

  try {
    const disengageResult = await gameManager.executeDisengageAction(character);

    result.success = disengageResult?.success ?? false;
    result.moved = disengageResult?.moved ?? false;
    result.woundsTaken = disengageResult?.woundsTaken ?? 0;

    if (disengageResult?.testResult?.margin) {
      result.extras.push(`Test margin: ${disengageResult.testResult.margin}`);
    }

  } catch (error) {
    console.error('Disengage execution failed:', error);
    result.extras.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Pick best melee weapon for character
 */
export function pickMeleeWeapon(character: Character): WeaponSelection | null {
  const items = character.items || [];

  // Find melee weapons
  const meleeWeapons = items.filter(item => {
    const classification = String(item.classification ?? item.class ?? '').toLowerCase();
    return classification.includes('melee') || 
           classification.includes('sword') ||
           classification.includes('axe') ||
           classification.includes('spear');
  });

  if (meleeWeapons.length === 0) {
    // No melee weapons, use natural attacks
    return {
      weapon: { id: 'natural', name: 'Natural Weapons', classification: 'Natural' } as Item,
      reason: 'No melee weapons equipped, using natural attacks',
    };
  }

  // Pick first available melee weapon (could be enhanced with weapon quality logic)
  return {
    weapon: meleeWeapons[0],
    reason: `Selected ${meleeWeapons[0].name}`,
  };
}

/**
 * Pick best ranged weapon for character
 */
export function pickRangedWeapon(character: Character): WeaponSelection | null {
  const items = character.items || [];

  // Find ranged weapons
  const rangedWeapons = items.filter(item => {
    const classification = String(item.classification ?? item.class ?? '').toLowerCase();
    return classification.includes('ranged') || 
           classification.includes('rifle') ||
           classification.includes('pistol') ||
           classification.includes('bow') ||
           classification.includes('gun');
  });

  if (rangedWeapons.length === 0) {
    return null;
  }

  // Pick first available ranged weapon (could be enhanced with range/ammo logic)
  return {
    weapon: rangedWeapons[0],
    reason: `Selected ${rangedWeapons[0].name}`,
  };
}

/**
 * Normalize attack result from various formats
 */
export function normalizeAttackResult(result: any): {
  hitTestResult?: any;
  damageResult?: any;
  rangeBand?: string;
  success: boolean;
} {
  if (!result) {
    return { success: false };
  }

  return {
    hitTestResult: result.hitTestResult || result,
    damageResult: result.damageResult,
    rangeBand: result.rangeBand,
    success: result.hitTestResult?.actorWins ?? result.actorWins ?? false,
  };
}

/**
 * Extract wounds added from damage resolution
 */
export function extractWoundsAddedFromDamageResolution(
  damageResolution: any,
  isAttacker: boolean
): number {
  if (!damageResolution) {
    return 0;
  }

  if (typeof damageResolution === 'number') {
    return damageResolution;
  }

  if (typeof damageResolution === 'object') {
    if (isAttacker) {
      return damageResolution.attackerWoundsTaken ?? damageResolution.woundsInflicted ?? 0;
    } else {
      return damageResolution.defenderWoundsTaken ?? damageResolution.woundsInflicted ?? 0;
    }
  }

  return 0;
}

/**
 * Extract damage resolution from step details
 */
export function extractDamageResolutionFromStepDetails(
  details: Record<string, unknown> | undefined
): unknown {
  if (!details) {
    return undefined;
  }

  return details.damageResolution || details.damage || details.wounds;
}

/**
 * Extract damage resolution from unknown result type
 */
export function extractDamageResolutionFromUnknown(result: unknown): unknown {
  if (!result || typeof result !== 'object') {
    return undefined;
  }

  const obj = result as Record<string, unknown>;
  return obj.damageResolution || obj.damageResult || obj.damage;
}

/**
 * Track combat extras (margin, range band, etc.)
 */
export function trackCombatExtras(result: unknown): string[] {
  const extras: string[] = [];

  if (!result || typeof result !== 'object') {
    return extras;
  }

  const obj = result as Record<string, unknown>;

  if (obj.margin !== undefined) {
    extras.push(`Margin: ${obj.margin}`);
  }

  if (obj.rangeBand !== undefined) {
    extras.push(`Range: ${obj.rangeBand}`);
  }

  if (obj.cover !== undefined) {
    extras.push(`Cover: ${obj.cover}`);
  }

  return extras;
}

/**
 * Check if decision type is an attack
 */
export function isAttackDecisionType(type: string): boolean {
  return type === 'close_combat' || type === 'ranged_combat' || type === 'attack';
}

/**
 * Check if character has ranged weapon
 */
export function hasRangedWeapon(character: Character): boolean {
  const items = character.items || [];
  return items.some(item => {
    const classification = String(item.classification ?? item.class ?? '').toLowerCase();
    return classification.includes('ranged') || 
           classification.includes('rifle') ||
           classification.includes('pistol') ||
           classification.includes('bow') ||
           classification.includes('gun');
  });
}

/**
 * Check if character has melee weapon
 */
export function hasMeleeWeapon(character: Character): boolean {
  const items = character.items || [];
  return items.some(item => {
    const classification = String(item.classification ?? item.class ?? '').toLowerCase();
    return classification.includes('melee') || 
           classification.includes('sword') ||
           classification.includes('axe') ||
           classification.includes('spear');
  });
}

/**
 * Get loadout profile for character
 */
export function getLoadoutProfile(character: Character): {
  hasMeleeWeapons: boolean;
  hasRangedWeapons: boolean;
  primaryWeaponType: 'melee' | 'ranged' | 'mixed' | 'none';
} {
  const hasMelee = hasMeleeWeapon(character);
  const hasRanged = hasRangedWeapon(character);

  let primaryWeaponType: 'melee' | 'ranged' | 'mixed' | 'none' = 'none';
  if (hasMelee && hasRanged) {
    primaryWeaponType = 'mixed';
  } else if (hasMelee) {
    primaryWeaponType = 'melee';
  } else if (hasRanged) {
    primaryWeaponType = 'ranged';
  }

  return {
    hasMeleeWeapons: hasMelee,
    hasRangedWeapons: hasRanged,
    primaryWeaponType,
  };
}
