import { Character } from './Character';
import { Battlefield } from './battlefield/Battlefield';
import { SpatialRules, SpatialModel } from './battlefield/spatial-rules';
import { LOSOperations } from './battlefield/LOSOperations';
import { getBaseDiameterFromSiz } from './battlefield/size-utils';
import { attemptHide, evaluateHide, HideCheckResult } from './concealment';
import { getCharacterTraitLevel } from './status-system';

export type BonusActionType =
  | 'Hide'
  | 'Refresh'
  | 'Reposition'
  | 'Circle'
  | 'Disengage'
  | 'PushBack'
  | 'PullBack'
  | 'Reversal';

export interface BonusActionOption {
  type: BonusActionType;
  available: boolean;
  costCascades: number;
  reason?: string;
  maxExtraCascades?: number;
}

export interface BonusActionBudget {
  cascades: number;
  maxActions: number;
}

export interface BonusActionContext {
  battlefield: Battlefield;
  attacker: Character;
  target?: Character;
  cascades: number;
  isCloseCombat?: boolean;
  isCharge?: boolean;
  engaged?: boolean;
}

export interface BonusActionSelection {
  type: BonusActionType;
  extraCascades?: number;
  attackerPosition?: { x: number; y: number };
  targetPosition?: { x: number; y: number };
  rotateDegrees?: number;
  adjustSeparation?: number;
  opponents?: Character[];
}

export interface BonusActionOutcome {
  executed: boolean;
  reason?: string;
  spentCascades?: number;
  moved?: boolean;
  attackerPosition?: { x: number; y: number };
  targetPosition?: { x: number; y: number };
  hideResult?: HideCheckResult;
  refreshApplied?: boolean;
}

export function computeBonusActionBudget(context: BonusActionContext): BonusActionBudget {
  const base = Math.max(0, context.cascades);
  const distractedPenalty = context.attacker.state.delayTokens > 0 ? 1 : 0;
  let cascades = Math.max(0, base - distractedPenalty);

  if (getCharacterTraitLevel(context.attacker, 'Blinders') > 0 && !context.attacker.state.isAttentive) {
    cascades = 0;
  }

  const brawl = context.isCloseCombat ? getCharacterTraitLevel(context.attacker, 'Brawl') : 0;
  cascades += brawl;

  if (context.isCloseCombat && context.isCharge && context.engaged) {
    const bashBonus = hasWeaponTrait(context.attacker, 'Bash') ? 1 : 0;
    cascades += bashBonus;
  }

  const fightDiff = Math.max(
    0,
    getCharacterTraitLevel(context.attacker, 'Fight') - (context.target ? getCharacterTraitLevel(context.target, 'Fight') : 0)
  );
  const maxActions = 1 + (context.attacker.state.isAttentive ? fightDiff : 0);

  return { cascades, maxActions };
}

export function buildBonusActionOptions(context: BonusActionContext): BonusActionOption[] {
  const budget = computeBonusActionBudget(context);
  const options: BonusActionOption[] = [];

  const engaged = context.engaged ?? (context.target ? isEngaged(context) : false);
  const isFree = !engaged;
  const baseContact = engaged;

  options.push(buildOption('Hide', budget.cascades, isFree && context.attacker.state.isAttentive));
  options.push(buildOption('Refresh', budget.cascades, isFree));
  options.push(buildOption('Reposition', budget.cascades, isFree, { maxExtraCascades: Math.max(0, budget.cascades - 1) }));

  if (context.isCloseCombat && context.target) {
    options.push(buildOption('Circle', budget.cascades, engaged, {
      costDelta: diamondCost(baseContact),
    }));
    options.push(buildOption('Disengage', budget.cascades, engaged, { maxExtraCascades: Math.max(0, budget.cascades - 1) }));

    const arrowCost = arrowCostDelta(context.attacker, context.target);
    options.push(buildOption('PushBack', budget.cascades, engaged, {
      costDelta: diamondCost(baseContact) + arrowCost,
      maxExtraCascades: Math.max(0, budget.cascades - 1),
    }));
    options.push(buildOption('PullBack', budget.cascades, engaged, {
      costDelta: diamondCost(baseContact) + arrowCost,
      maxExtraCascades: Math.max(0, budget.cascades - 1),
    }));
    options.push(buildOption('Reversal', budget.cascades, engaged, {
      costDelta: diamondCost(baseContact),
      maxExtraCascades: Math.max(0, budget.cascades - 1),
    }));
  }

  return options;
}

export function applyBonusAction(
  context: BonusActionContext,
  selection: BonusActionSelection
): BonusActionOutcome {
  const budget = computeBonusActionBudget(context);
  if (budget.cascades <= 0) {
    return { executed: false, reason: 'No bonus cascades available.' };
  }

  const cost = computeBonusActionCost(context, selection);
  if (budget.cascades < cost) {
    return { executed: false, reason: 'Not enough cascades.', spentCascades: 0 };
  }

  switch (selection.type) {
    case 'Hide':
      return applyHide(context, cost, selection);
    case 'Refresh':
      return { executed: true, spentCascades: cost, refreshApplied: true };
    case 'Reposition':
      return applyReposition(context, cost, selection);
    case 'Circle':
      return applyCircle(context, cost, selection);
    case 'Disengage':
      return applyDisengage(context, cost, selection);
    case 'PushBack':
      return applyPushBack(context, cost, selection);
    case 'PullBack':
      return applyPullBack(context, cost, selection);
    case 'Reversal':
      return applyReversal(context, cost, selection);
    default:
      return { executed: false, reason: 'Unknown bonus action.' };
  }
}

function buildOption(
  type: BonusActionType,
  cascades: number,
  available: boolean,
  options: { costDelta?: number; maxExtraCascades?: number } = {}
): BonusActionOption {
  const cost = 1 + (options.costDelta ?? 0);
  const isAvailable = available && cascades >= cost;
  return {
    type,
    available: isAvailable,
    costCascades: cost,
    reason: isAvailable ? undefined : 'Insufficient cascades or invalid state.',
    maxExtraCascades: options.maxExtraCascades,
  };
}

function computeBonusActionCost(context: BonusActionContext, selection: BonusActionSelection): number {
  let cost = 1;
  const engaged = context.engaged ?? (context.target ? isEngaged(context) : false);
  const baseContact = engaged;

  switch (selection.type) {
    case 'Circle':
    case 'PushBack':
    case 'PullBack':
    case 'Reversal':
      cost += diamondCost(baseContact);
      break;
    default:
      break;
  }

  if (selection.type === 'PushBack' || selection.type === 'PullBack') {
    cost += arrowCostDelta(context.attacker, context.target ?? null);
  }

  const extra = Math.max(0, selection.extraCascades ?? 0);
  return cost + extra;
}

function applyHide(context: BonusActionContext, cost: number, selection: BonusActionSelection): BonusActionOutcome {
  if (!context.attacker.state.isAttentive) {
    return { executed: false, reason: 'Requires Attentive.', spentCascades: 0 };
  }
  if (!selection.opponents) {
    return { executed: false, reason: 'Opponents required for Hide.', spentCascades: 0 };
  }
  const result = attemptHide(context.battlefield, context.attacker, selection.opponents, () => true);
  if (!result.canHide) {
    return { executed: false, reason: result.reason, spentCascades: 0, hideResult: result };
  }
  return { executed: true, spentCascades: cost, hideResult: result };
}

function applyReposition(context: BonusActionContext, cost: number, selection: BonusActionSelection): BonusActionOutcome {
  const position = selection.attackerPosition;
  if (!position) {
    return { executed: false, reason: 'Missing reposition target.', spentCascades: 0 };
  }
  const mov = context.attacker.finalAttributes.mov ?? context.attacker.attributes.mov ?? 0;
  const extra = Math.max(0, selection.extraCascades ?? 0);
  const maxDistance = mov + Math.floor(extra / 3);
  const current = context.battlefield.getCharacterPosition(context.attacker);
  if (!current) {
    return { executed: false, reason: 'Missing current position.', spentCascades: 0 };
  }
  const distance = LOSOperations.distance(current, position);
  if (distance > maxDistance + 1e-6) {
    return { executed: false, reason: 'Reposition exceeds move limit.', spentCascades: 0 };
  }
  const moved = context.battlefield.moveCharacter(context.attacker, position);
  return {
    executed: moved,
    spentCascades: moved ? cost : 0,
    moved,
    attackerPosition: moved ? position : undefined,
    reason: moved ? undefined : 'Reposition failed.',
  };
}

function applyCircle(context: BonusActionContext, cost: number, selection: BonusActionSelection): BonusActionOutcome {
  if (!context.target) return { executed: false, reason: 'Missing target.', spentCascades: 0 };
  const attackerPos = context.battlefield.getCharacterPosition(context.attacker);
  const targetPos = context.battlefield.getCharacterPosition(context.target);
  if (!attackerPos || !targetPos) return { executed: false, reason: 'Missing positions.', spentCascades: 0 };
  const angle = (selection.rotateDegrees ?? 180) * (Math.PI / 180);
  const dx = attackerPos.x - targetPos.x;
  const dy = attackerPos.y - targetPos.y;
  const rotated = {
    x: targetPos.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: targetPos.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
  const moved = context.battlefield.moveCharacter(context.attacker, selection.attackerPosition ?? rotated);
  return {
    executed: moved,
    spentCascades: moved ? cost : 0,
    moved,
    attackerPosition: moved ? (selection.attackerPosition ?? rotated) : undefined,
    reason: moved ? undefined : 'Circle failed.',
  };
}

function applyDisengage(context: BonusActionContext, cost: number, selection: BonusActionSelection): BonusActionOutcome {
  if (!context.target) return { executed: false, reason: 'Missing target.', spentCascades: 0 };
  const attackerPos = context.battlefield.getCharacterPosition(context.attacker);
  const targetPos = context.battlefield.getCharacterPosition(context.target);
  if (!attackerPos || !targetPos) return { executed: false, reason: 'Missing positions.', spentCascades: 0 };
  const mov = context.attacker.finalAttributes.mov ?? context.attacker.attributes.mov ?? 0;
  const agility = Math.max(0, mov / 2);
  const attackerBase = getBaseDiameterFromSiz(context.attacker.finalAttributes.siz ?? context.attacker.attributes.siz ?? 3);
  const targetBase = getBaseDiameterFromSiz(context.target.finalAttributes.siz ?? context.target.attributes.siz ?? 3);
  const minDistance = Math.max(agility, Math.max(attackerBase, targetBase));
  const extra = Math.max(0, selection.extraCascades ?? 0);
  const maxDistance = minDistance + Math.floor(extra / 3);
  const direction = normalize({
    x: attackerPos.x - targetPos.x,
    y: attackerPos.y - targetPos.y,
  });
  if (!direction) return { executed: false, reason: 'Invalid disengage direction.', spentCascades: 0 };
  const destination = selection.attackerPosition ?? {
    x: attackerPos.x + direction.x * maxDistance,
    y: attackerPos.y + direction.y * maxDistance,
  };
  const moved = context.battlefield.moveCharacter(context.attacker, destination);
  return {
    executed: moved,
    spentCascades: moved ? cost : 0,
    moved,
    attackerPosition: moved ? destination : undefined,
    reason: moved ? undefined : 'Disengage failed.',
  };
}

function applyPushBack(context: BonusActionContext, cost: number, selection: BonusActionSelection): BonusActionOutcome {
  if (!context.target) return { executed: false, reason: 'Missing target.', spentCascades: 0 };
  const attackerPos = context.battlefield.getCharacterPosition(context.attacker);
  const targetPos = context.battlefield.getCharacterPosition(context.target);
  if (!attackerPos || !targetPos) return { executed: false, reason: 'Missing positions.', spentCascades: 0 };
  const attackerBase = getBaseDiameterFromSiz(context.attacker.finalAttributes.siz ?? context.attacker.attributes.siz ?? 3);
  const extra = Math.max(0, selection.extraCascades ?? 0);
  const pushDistance = attackerBase + Math.floor(extra / 3);
  const direction = normalize({
    x: targetPos.x - attackerPos.x,
    y: targetPos.y - attackerPos.y,
  });
  if (!direction) return { executed: false, reason: 'Invalid push direction.', spentCascades: 0 };
  const targetDestination = selection.targetPosition ?? {
    x: targetPos.x + direction.x * pushDistance,
    y: targetPos.y + direction.y * pushDistance,
  };
  const movedTarget = context.battlefield.moveCharacter(context.target, targetDestination);
  if (!movedTarget) return { executed: false, reason: 'Push-back failed.', spentCascades: 0 };
  const attackerDestination = selection.attackerPosition ?? targetPos;
  const movedAttacker = context.battlefield.moveCharacter(context.attacker, attackerDestination);
  return {
    executed: movedAttacker,
    spentCascades: movedAttacker ? cost : 0,
    moved: movedAttacker,
    attackerPosition: movedAttacker ? attackerDestination : undefined,
    targetPosition: targetDestination,
    reason: movedAttacker ? undefined : 'Push-back follow-up failed.',
  };
}

function applyPullBack(context: BonusActionContext, cost: number, selection: BonusActionSelection): BonusActionOutcome {
  if (!context.target) return { executed: false, reason: 'Missing target.', spentCascades: 0 };
  const attackerPos = context.battlefield.getCharacterPosition(context.attacker);
  const targetPos = context.battlefield.getCharacterPosition(context.target);
  if (!attackerPos || !targetPos) return { executed: false, reason: 'Missing positions.', spentCascades: 0 };
  const attackerBase = getBaseDiameterFromSiz(context.attacker.finalAttributes.siz ?? context.attacker.attributes.siz ?? 3);
  const targetBase = getBaseDiameterFromSiz(context.target.finalAttributes.siz ?? context.target.attributes.siz ?? 3);
  const moveDistance = Math.max(attackerBase, targetBase);
  const direction = normalize({
    x: attackerPos.x - targetPos.x,
    y: attackerPos.y - targetPos.y,
  });
  if (!direction) return { executed: false, reason: 'Invalid pull direction.', spentCascades: 0 };
  const destination = selection.attackerPosition ?? {
    x: attackerPos.x + direction.x * moveDistance,
    y: attackerPos.y + direction.y * moveDistance,
  };
  const movedAttacker = context.battlefield.moveCharacter(context.attacker, destination);
  return {
    executed: movedAttacker,
    spentCascades: movedAttacker ? cost : 0,
    moved: movedAttacker,
    attackerPosition: movedAttacker ? destination : undefined,
    reason: movedAttacker ? undefined : 'Pull-back failed.',
  };
}

function applyReversal(context: BonusActionContext, cost: number, selection: BonusActionSelection): BonusActionOutcome {
  if (!context.target) return { executed: false, reason: 'Missing target.', spentCascades: 0 };
  const attackerPos = context.battlefield.getCharacterPosition(context.attacker);
  const targetPos = context.battlefield.getCharacterPosition(context.target);
  if (!attackerPos || !targetPos) return { executed: false, reason: 'Missing positions.', spentCascades: 0 };
  const movedTarget = context.battlefield.moveCharacter(context.target, selection.targetPosition ?? attackerPos);
  const movedAttacker = context.battlefield.moveCharacter(context.attacker, selection.attackerPosition ?? targetPos);
  return {
    executed: movedAttacker && movedTarget,
    spentCascades: movedAttacker && movedTarget ? cost : 0,
    moved: movedAttacker && movedTarget,
    attackerPosition: movedAttacker ? (selection.attackerPosition ?? targetPos) : undefined,
    targetPosition: movedTarget ? (selection.targetPosition ?? attackerPos) : undefined,
    reason: movedAttacker && movedTarget ? undefined : 'Reversal failed.',
  };
}

function diamondCost(isBaseContact: boolean): number {
  return isBaseContact ? 0 : 1;
}

function arrowCostDelta(attacker: Character, target: Character | null): number {
  if (!target) return 0;
  const attackerPhys = Math.max(attacker.finalAttributes.str ?? attacker.attributes.str ?? 0, attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 0);
  const targetPhys = Math.max(target.finalAttributes.str ?? target.attributes.str ?? 0, target.finalAttributes.siz ?? target.attributes.siz ?? 0);
  return Math.max(0, targetPhys - attackerPhys);
}

function normalize(vec: { x: number; y: number }): { x: number; y: number } | null {
  const length = Math.hypot(vec.x, vec.y);
  if (length <= 1e-6) return null;
  return { x: vec.x / length, y: vec.y / length };
}

function isEngaged(context: BonusActionContext): boolean {
  if (!context.target) return false;
  const attackerModel = buildSpatialModel(context.attacker, context.battlefield);
  const targetModel = buildSpatialModel(context.target, context.battlefield);
  if (!attackerModel || !targetModel) return false;
  return SpatialRules.isEngaged(attackerModel, targetModel);
}

function buildSpatialModel(character: Character, battlefield: Battlefield): SpatialModel | null {
  const position = battlefield.getCharacterPosition(character);
  if (!position) return null;
  const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
  return {
    id: character.id,
    position,
    baseDiameter: getBaseDiameterFromSiz(siz),
    siz,
  };
}

function hasWeaponTrait(character: Character, traitName: string): boolean {
  const items = [
    ...(character.profile?.equipment ?? []),
    ...(character.profile?.items ?? []),
    ...(character.profile?.inHandItems ?? []),
    ...(character.profile?.stowedItems ?? []),
  ];
  return items.some(item => item?.traits?.some(trait => trait.toLowerCase().startsWith(traitName.toLowerCase())));
}
