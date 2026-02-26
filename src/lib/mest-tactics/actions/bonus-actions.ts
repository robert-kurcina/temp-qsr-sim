import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { SpatialRules, SpatialModel } from '../battlefield/spatial/spatial-rules';
import { LOSOperations } from '../battlefield/los/LOSOperations';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { TerrainType } from '../battlefield/terrain/Terrain';
import { attemptHide, evaluateHide, HideCheckResult } from '../status/concealment';
import { getCharacterTraitLevel } from '../status/status-system';

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
  type?: BonusActionType;
  executed: boolean;
  reason?: string;
  spentCascades?: number;
  moved?: boolean;
  delayTokenApplied?: boolean;
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
    return { type: selection.type, executed: false, reason: 'No bonus cascades available.' };
  }

  const cost = computeBonusActionCost(context, selection);
  if (budget.cascades < cost) {
    return { type: selection.type, executed: false, reason: 'Not enough cascades.', spentCascades: 0 };
  }

  let outcome: BonusActionOutcome;
  switch (selection.type) {
    case 'Hide':
      outcome = applyHide(context, cost, selection);
      break;
    case 'Refresh':
      outcome = { executed: true, spentCascades: cost, refreshApplied: true };
      break;
    case 'Reposition':
      outcome = applyReposition(context, cost, selection);
      break;
    case 'Circle':
      outcome = applyCircle(context, cost, selection);
      break;
    case 'Disengage':
      outcome = applyDisengage(context, cost, selection);
      break;
    case 'PushBack':
      outcome = applyPushBack(context, cost, selection);
      break;
    case 'PullBack':
      outcome = applyPullBack(context, cost, selection);
      break;
    case 'Reversal':
      outcome = applyReversal(context, cost, selection);
      break;
    default:
      outcome = { executed: false, reason: 'Unknown bonus action.' };
      break;
  }
  return { type: selection.type, ...outcome };
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
  const destination = toGridPosition(position);
  const mov = context.attacker.finalAttributes.mov ?? context.attacker.attributes.mov ?? 0;
  const extra = Math.max(0, selection.extraCascades ?? 0);
  const maxDistance = mov + Math.floor(extra / 3);
  const current = context.battlefield.getCharacterPosition(context.attacker);
  if (!current) {
    return { executed: false, reason: 'Missing current position.', spentCascades: 0 };
  }
  const distance = LOSOperations.distance(current, destination);
  if (distance > maxDistance + 1e-6) {
    return { executed: false, reason: 'Reposition exceeds move limit.', spentCascades: 0 };
  }
  const moved = context.battlefield.moveCharacter(context.attacker, destination);
  return {
    executed: moved,
    spentCascades: moved ? cost : 0,
    moved,
    attackerPosition: moved ? destination : undefined,
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
  const destination = toGridPosition(selection.attackerPosition ?? rotated);
  const moved = context.battlefield.moveCharacter(context.attacker, destination);
  return {
    executed: moved,
    spentCascades: moved ? cost : 0,
    moved,
    attackerPosition: moved ? destination : undefined,
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
  const destinationGrid = toGridPosition(destination);
  const moved = context.battlefield.moveCharacter(context.attacker, destinationGrid);
  return {
    executed: moved,
    spentCascades: moved ? cost : 0,
    moved,
    attackerPosition: moved ? destinationGrid : undefined,
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
  const targetDestinationRaw = selection.targetPosition ?? {
    x: targetPos.x + direction.x * pushDistance,
    y: targetPos.y + direction.y * pushDistance,
  };
  const targetDestination = toGridPosition(targetDestinationRaw);
  const insideBoard = isInsideBoard(context.battlefield, targetDestination);
  const targetTerrain = insideBoard ? context.battlefield.getTerrainAt(targetDestination).type : TerrainType.Impassable;
  const blockedTerrain = targetTerrain === TerrainType.Impassable || targetTerrain === TerrainType.Obstacle;
  const degradedTerrain = targetTerrain === TerrainType.Rough || targetTerrain === TerrainType.Difficult;
  const destinationOccupant = insideBoard ? context.battlefield.getCharacterAt(targetDestination) : null;
  if (destinationOccupant && destinationOccupant.id !== context.target.id) {
    return { executed: false, reason: 'Push-back blocked by another model.', spentCascades: 0 };
  }

  let movedTarget = false;
  let delayTokenApplied = false;
  let reason: string | undefined;

  if (!insideBoard || blockedTerrain) {
    // QSR: if pushed into wall/obstacle/impassable bounds, target takes Delay.
    context.target.state.delayTokens += 1;
    context.target.refreshStatusFlags();
    delayTokenApplied = true;
    reason = 'Push-back blocked by terrain/boundary; target gained Delay token.';
  } else {
    movedTarget = context.battlefield.moveCharacter(context.target, targetDestination);
    if (!movedTarget) {
      return { executed: false, reason: 'Push-back failed.', spentCascades: 0 };
    }
    if (degradedTerrain) {
      context.target.state.delayTokens += 1;
      context.target.refreshStatusFlags();
      delayTokenApplied = true;
      reason = 'Push-back into degraded terrain; target gained Delay token.';
    }
  }

  let movedAttacker = false;
  const attackerDestination = selection.attackerPosition ?? (movedTarget ? targetPos : undefined);
  if (attackerDestination) {
    const attackerDestinationGrid = toGridPosition(attackerDestination);
    if (
      isInsideBoard(context.battlefield, attackerDestinationGrid) &&
      (!context.battlefield.getCharacterAt(attackerDestinationGrid) || context.battlefield.getCharacterAt(attackerDestinationGrid)?.id === context.attacker.id)
    ) {
      movedAttacker = context.battlefield.moveCharacter(context.attacker, attackerDestinationGrid);
    }
  }

  return {
    executed: movedTarget || delayTokenApplied,
    spentCascades: movedTarget || delayTokenApplied ? cost : 0,
    moved: movedTarget || movedAttacker,
    delayTokenApplied,
    attackerPosition: movedAttacker ? toGridPosition(attackerDestination!) : undefined,
    targetPosition: movedTarget ? targetDestination : undefined,
    reason,
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
  const destinationGrid = toGridPosition(destination);
  const movedAttacker = context.battlefield.moveCharacter(context.attacker, destinationGrid);
  return {
    executed: movedAttacker,
    spentCascades: movedAttacker ? cost : 0,
    moved: movedAttacker,
    attackerPosition: movedAttacker ? destinationGrid : undefined,
    reason: movedAttacker ? undefined : 'Pull-back failed.',
  };
}

function applyReversal(context: BonusActionContext, cost: number, selection: BonusActionSelection): BonusActionOutcome {
  if (!context.target) return { executed: false, reason: 'Missing target.', spentCascades: 0 };
  const attackerPos = context.battlefield.getCharacterPosition(context.attacker);
  const targetPos = context.battlefield.getCharacterPosition(context.target);
  if (!attackerPos || !targetPos) return { executed: false, reason: 'Missing positions.', spentCascades: 0 };
  const targetDestination = toGridPosition(selection.targetPosition ?? attackerPos);
  const attackerDestination = toGridPosition(selection.attackerPosition ?? targetPos);
  const movedTarget = context.battlefield.moveCharacter(context.target, targetDestination);
  const movedAttacker = context.battlefield.moveCharacter(context.attacker, attackerDestination);
  return {
    executed: movedAttacker && movedTarget,
    spentCascades: movedAttacker && movedTarget ? cost : 0,
    moved: movedAttacker && movedTarget,
    attackerPosition: movedAttacker ? attackerDestination : undefined,
    targetPosition: movedTarget ? targetDestination : undefined,
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

function toGridPosition(position: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
}

function isInsideBoard(battlefield: Battlefield, position: { x: number; y: number }): boolean {
  return (
    position.x >= 0 &&
    position.x < battlefield.width &&
    position.y >= 0 &&
    position.y < battlefield.height
  );
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
