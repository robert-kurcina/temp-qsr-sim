import { Character } from '../core/Character';
import { getCharacterTraitLevel } from './status-system';

export interface KOdAttackRulesConfig {
  enabled: boolean;
  controllerTraits?: string[];
  coordinatorTraits?: string[];
}

const AMORAL_ATTACKER_TRAITS = [
  'Delusional',
  'Coward',
  'Ravenous',
  'Treacherous',
  'Vitriol',
  'Fear',
  'Insane',
  'Poisoner',
  'Terrifying',
  'Torment',
];

const PRIMAL_ATTACKER_TRAITS = ['Beast', 'Beast!', 'Beast+'];
const PRIMAL_OVERRIDE_TRAITS = ['Ravenous', 'Fear', 'Insane', 'Terrifying'];

const PUPPET_ATTACKER_TRAITS = ['Automaton', 'Mindless'];
const PUPPET_CONTROLLER_TRAITS = ['Delusional', 'Coward', 'Treacherous', 'Insane'];

const UNNATURAL_TARGET_TRAITS = [
  'Automaton',
  'Invader',
  'Outsider',
  'Supernatural',
  'Mythos',
  'Fear',
  'Machine',
  'Mindless',
  'Ravenous',
];

function normalizeTraitName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\[\]!+]/g, '')
    .split('>')[0]
    .split('(')[0]
    .trim();
}

function hasAnyTrait(character: Character, traits: string[]): boolean {
  const wanted = traits.map(t => normalizeTraitName(t));
  for (const name of traits) {
    if (getCharacterTraitLevel(character, name) > 0) {
      return true;
    }
  }

  const traitPool: string[] = [];
  if (character.profile?.finalTraits) traitPool.push(...character.profile.finalTraits);
  if (character.profile?.allTraits) traitPool.push(...character.profile.allTraits);
  if (character.allTraits?.length) {
    for (const trait of character.allTraits) {
      if (trait?.name) traitPool.push(trait.source ?? trait.name);
    }
  }

  for (const raw of traitPool) {
    const normalized = normalizeTraitName(raw);
    if (wanted.some(name => normalized.startsWith(name))) {
      return true;
    }
  }

  return false;
}

export function canAttackKOdTarget(
  attacker: Character,
  target: Character,
  config: KOdAttackRulesConfig
): { allowed: boolean; reason?: string } {
  if (!target.state.isKOd || target.state.isEliminated) {
    return { allowed: true };
  }

  if (!config.enabled) {
    return { allowed: false, reason: 'Attacking KOd targets is disabled.' };
  }

  if (hasAnyTrait(target, UNNATURAL_TARGET_TRAITS)) {
    return { allowed: true };
  }

  if (attacker.state.isPanicked) {
    return { allowed: true };
  }

  const isPrimal = hasAnyTrait(attacker, PRIMAL_ATTACKER_TRAITS);
  if (isPrimal) {
    if (hasAnyTrait(attacker, PRIMAL_OVERRIDE_TRAITS)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Primal attacker lacks override traits.' };
  }

  const isPuppet = hasAnyTrait(attacker, PUPPET_ATTACKER_TRAITS);
  if (isPuppet) {
    const controllerTraits = [...(config.controllerTraits ?? []), ...(config.coordinatorTraits ?? [])];
    if (controllerTraits.some(trait => PUPPET_CONTROLLER_TRAITS.includes(trait))) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Puppet attacker lacks controller traits.' };
  }

  if (hasAnyTrait(attacker, AMORAL_ATTACKER_TRAITS)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'KOd target is protected.' };
}

export function getKOdEliminationThreshold(target: Character): number {
  const siz = target.finalAttributes.siz ?? target.attributes.siz ?? 0;
  return Math.max(1, siz - 3);
}
