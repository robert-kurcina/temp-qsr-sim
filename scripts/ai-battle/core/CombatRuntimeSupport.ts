import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { ModelStateAudit } from '../../shared/BattleReportTypes';

const UNARMED_WEAPON = {
  id: 'natural-unarmed',
  name: 'Unarmed',
  class: 'Natural',
  classification: 'Natural',
  type: 'Natural',
  bp: -3,
  or: '-',
  accuracy: '-1m',
  impact: 0,
  dmg: '2-1m',
  traits: ['[Stub]'],
} as const;

function asItemPool(character: Character): any[] {
  const hasTrackedHandState = Array.isArray(character.profile?.inHandItems);
  if (hasTrackedHandState) {
    return (character.profile?.inHandItems ?? []).filter(Boolean);
  }
  return (character.profile?.equipment || character.profile?.items || []).filter(Boolean);
}

function isMeleeLike(item: any): boolean {
  const classification = String(item?.classification ?? item?.class ?? '').toLowerCase();
  return classification.includes('melee') || classification.includes('natural');
}

export function pickMeleeWeaponForRunner(character: Character): any | null {
  const inHand = asItemPool(character);
  const meleeWeapon = inHand.find(item => isMeleeLike(item));
  if (meleeWeapon) return meleeWeapon;
  if (inHand.length > 0) return inHand[0];
  return UNARMED_WEAPON;
}

export function pickRangedWeaponForRunner(character: Character): any | null {
  const equipment = asItemPool(character);
  return equipment.find(item =>
    item?.classification === 'Bow' ||
    item?.classification === 'Thrown' ||
    item?.classification === 'Range' ||
    item?.classification === 'Firearm' ||
    item?.classification === 'Support' ||
    ((item?.classification === 'Melee' || item?.classification === 'Natural' || item?.class === 'Melee' || item?.class === 'Natural') &&
      Array.isArray(item?.traits) &&
      item.traits.some((trait: string) => trait.toLowerCase().includes('throwable')))
  ) || null;
}

export function normalizeAttackResultForRunner(result: any): {
  hit?: boolean;
  ko: boolean;
  eliminated: boolean;
} {
  const hit = result?.result?.hit ?? result?.hit;
  const damageResolution = result?.result?.damageResolution ?? result?.damageResolution;
  const ko = Boolean(damageResolution?.defenderState?.isKOd ?? damageResolution?.defenderKOd);
  const eliminated = Boolean(damageResolution?.defenderState?.isEliminated ?? damageResolution?.defenderEliminated);
  return { hit, ko, eliminated };
}

export function extractWoundsAddedFromDamageResolutionForRunner(
  damageResolution: unknown,
  targetStateBefore: ModelStateAudit,
  targetStateAfter: ModelStateAudit
): number {
  if (damageResolution && typeof damageResolution === 'object') {
    const payload = damageResolution as Record<string, unknown>;
    const woundsAdded = payload.woundsAdded;
    const stunWoundsAdded = payload.stunWoundsAdded;
    if (typeof woundsAdded === 'number' || typeof stunWoundsAdded === 'number') {
      return Math.max(0, (Number(woundsAdded) || 0) + (Number(stunWoundsAdded) || 0));
    }
  }
  const delta = (targetStateAfter.wounds ?? 0) - (targetStateBefore.wounds ?? 0);
  return Math.max(0, delta);
}

export function extractDamageResolutionFromStepDetailsForRunner(
  details: Record<string, unknown> | undefined
): unknown {
  if (!details) return undefined;
  const attackResult = details.attackResult as Record<string, unknown> | undefined;
  if (!attackResult) return undefined;
  const nestedResult = attackResult.result as Record<string, unknown> | undefined;
  return nestedResult?.damageResolution ?? attackResult.damageResolution;
}

export function extractDamageResolutionFromUnknownForRunner(result: unknown): unknown {
  if (!result || typeof result !== 'object') {
    return undefined;
  }
  const payload = result as Record<string, unknown>;
  const nestedResult = payload.result as Record<string, unknown> | undefined;
  return nestedResult?.damageResolution ?? payload.damageResolution;
}
