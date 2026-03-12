import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { SpatialRules, SpatialModel } from '../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { getCharacterTraitLevel } from './status-system';
import type { Item } from '../core/Item';
import type { ResolveTestResult, TestDice } from '../subroutines/dice-roller';

export type PassiveOptionType =
  | 'TakeCover'
  | 'CounterStrike'
  | 'CounterFire'
  | 'CounterAction'
  | 'CounterCharge'
  | 'React'
  | 'HiddenReposition'
  | 'BonusAction'
  | 'Defend'
  | 'OpportunityAttack';

export interface PassiveOption {
  id: string;
  type: PassiveOptionType;
  actorId: string;
  targetId?: string;
  available: boolean;
  reason?: string;
  payload?: Record<string, unknown>;
}

export type PassiveEvent =
  | {
      kind: 'RangedAttackDeclared';
      type?: 'RangedAttackDeclared'; // Backward compatibility
      attacker: Character;
      defender: Character;
      battlefield: Battlefield;
      weapon?: Item;
    }
  | {
      kind: 'CloseCombatAttackDeclared';
      type?: 'CloseCombatAttackDeclared'; // Backward compatibility
      attacker: Character;
      defender: Character;
      battlefield: Battlefield;
      weapon?: Item;
    }
  | {
      kind: 'HitTestFailed';
      type?: 'HitTestFailed'; // Backward compatibility
      attacker: Character;
      defender: Character;
      battlefield?: Battlefield;
      attackType?: 'melee' | 'ranged';
      hitTestResult?: ResolveTestResult;
      visibilityOrMu?: number;
    }
  | {
      kind: 'MoveConcluded';
      type?: 'MoveConcluded'; // Backward compatibility
      mover: Character;
      observers: Character[];
      battlefield?: Battlefield;
      moveApSpent?: number;
      visibilityOrMu?: number;
    }
  | {
      kind: 'EngagementBroken';
      type?: 'EngagementBroken'; // Backward compatibility
      mover: Character;
      opponents: Character[];
      battlefield?: Battlefield;
    }
  | {
      kind: 'HiddenExposure';
      type?: 'HiddenExposure'; // Backward compatibility
      character: Character;
    };

export type ActiveToggleType =
  | 'Overreach'
  | 'Lean'
  | 'BonusAction'
  | 'React'
  | 'Focus';

export interface ActiveToggleOption {
  id: string;
  type: ActiveToggleType;
  label: string;
  available: boolean;
  reason?: string;
  defaultEnabled?: boolean;
  payload?: Record<string, unknown>;
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

function countCarryOverDice(dice?: TestDice): number {
  if (!dice) return 0;
  return (dice.base ?? 0) + (dice.modifier ?? 0) + (dice.wild ?? 0);
}

function isFailedHitTest(result?: ResolveTestResult): boolean {
  if (!result) return true;
  if (typeof result.pass === 'boolean') {
    return result.pass === false;
  }
  if (typeof result.score === 'number') {
    return result.score < 0;
  }
  return true;
}

function hasTrait(character: Character, name: string): boolean {
  return getCharacterTraitLevel(character, name) > 0;
}

function attentiveOrderedRequirementReason(character: Character): string {
  const isAttentive = character.state.isAttentive;
  const isOrdered = character.state.isOrdered;
  if (!isAttentive && !isOrdered) return 'Requires Attentive+Ordered.';
  if (!isAttentive) return 'Requires Attentive.';
  if (!isOrdered) return 'Requires Ordered.';
  return 'Requires Attentive+Ordered.';
}

function resolveLosVisibilityFailureReason(params: {
  battlefield?: Battlefield;
  sourceModel: SpatialModel | null;
  targetModel: SpatialModel | null;
  hasLOS: boolean;
  withinVisibility: boolean;
}): string | null {
  const { battlefield, sourceModel, targetModel, hasLOS, withinVisibility } = params;
  if (!withinVisibility) {
    return 'Out of Visibility OR range.';
  }
  if (hasLOS) {
    return null;
  }
  if (!battlefield || !sourceModel || !targetModel) {
    return 'LOS unavailable.';
  }
  const cover = SpatialRules.getCoverResult(battlefield, sourceModel, targetModel);
  if (cover.blockingModelId) {
    return 'LOS blocked by model.';
  }
  return 'LOS blocked.';
}

export function buildPassiveOptions(event: PassiveEvent): PassiveOption[] {
  if (event.kind === 'RangedAttackDeclared') {
    const { attacker, defender, battlefield } = event;
    const options: PassiveOption[] = [];
    const attackerModel = buildSpatialModel(attacker, battlefield);
    const defenderModel = buildSpatialModel(defender, battlefield);
    if (!attackerModel || !defenderModel) return options;

    const engaged = SpatialRules.isEngaged(attackerModel, defenderModel);
    const cover = SpatialRules.getCoverResult(battlefield, attackerModel, defenderModel);
    const defenderRef = defender.finalAttributes.ref ?? defender.attributes.ref ?? 0;
    const attackerRef = attacker.finalAttributes.ref ?? attacker.attributes.ref ?? 0;
    const canUse = defender.state.isAttentive
      && defender.state.isOrdered
      && !engaged
      && cover.hasLOS
      && defenderRef >= attackerRef;
    const takeCoverReason = canUse
      ? undefined
      : (!defender.state.isAttentive || !defender.state.isOrdered)
        ? attentiveOrderedRequirementReason(defender)
        : engaged
          ? 'Requires defender to be Free.'
          : !cover.hasLOS
            ? 'Requires LOS.'
            : defenderRef < attackerRef
              ? 'Requires defender REF >= attacker REF.'
              : 'Unavailable.';
    options.push({
      id: `${defender.id}:TakeCover`,
      type: 'TakeCover',
      actorId: defender.id,
      targetId: attacker.id,
      available: canUse,
      reason: takeCoverReason,
      payload: {
        maxMove: defender.finalAttributes.mov ?? defender.attributes.mov ?? 0,
        requiresLOS: true,
      },
    });
    const canDefend = defender.state.isAttentive;
    options.push({
      id: `${defender.id}:Defend`,
      type: 'Defend',
      actorId: defender.id,
      targetId: attacker.id,
      available: canDefend,
      reason: canDefend ? undefined : 'Requires Attentive.',
    });
    return options;
  }

  if (event.kind === 'CloseCombatAttackDeclared') {
    const { attacker, defender, battlefield } = event;
    const options: PassiveOption[] = [];
    const attackerModel = buildSpatialModel(attacker, battlefield);
    const defenderModel = buildSpatialModel(defender, battlefield);
    if (!attackerModel || !defenderModel) return options;
    const engaged = SpatialRules.isEngaged(attackerModel, defenderModel);
    const canDefend = defender.state.isAttentive && engaged;
    const defendReason = canDefend
      ? undefined
      : !defender.state.isAttentive
        ? 'Requires Attentive.'
        : 'Requires melee engagement.';
    options.push({
      id: `${defender.id}:Defend`,
      type: 'Defend',
      actorId: defender.id,
      targetId: attacker.id,
      available: canDefend,
      reason: defendReason,
    });
    return options;
  }

  if (event.kind === 'HitTestFailed') {
    const options: PassiveOption[] = [];
    const canReact = event.defender.state.isAttentive && event.defender.state.isOrdered;
    const battlefield = event.battlefield;
    const defenderModel = battlefield ? buildSpatialModel(event.defender, battlefield) : null;
    const attackerModel = battlefield ? buildSpatialModel(event.attacker, battlefield) : null;
    const engaged = defenderModel && attackerModel ? SpatialRules.isEngaged(attackerModel, defenderModel) : false;
    const hasLOS = defenderModel && attackerModel && battlefield
      ? SpatialRules.hasLineOfSight(battlefield, defenderModel, attackerModel)
      : false;
    const defenderRef = event.defender.finalAttributes.ref ?? event.defender.attributes.ref ?? 0;
    const attackerRef = event.attacker.finalAttributes.ref ?? event.attacker.attributes.ref ?? 0;
    const visibilityOrMu = event.visibilityOrMu ?? 16;
    const edgeDistance = defenderModel && attackerModel
      ? SpatialRules.distanceEdgeToEdge(defenderModel, attackerModel)
      : Infinity;
    const withinVisibility = edgeDistance <= visibilityOrMu;
    const losFailureReason = resolveLosVisibilityFailureReason({
      battlefield,
      sourceModel: defenderModel,
      targetModel: attackerModel,
      hasLOS,
      withinVisibility,
    });
    const carryOverCount = event.hitTestResult
      ? countCarryOverDice(event.hitTestResult.p2Result?.carryOverDice)
      : null;
    const hasCarryOver = carryOverCount === null ? true : carryOverCount > 0;
    const failedHitTest = isFailedHitTest(event.hitTestResult);
    const hasCounterStrikeTrait = hasTrait(event.defender, 'Counter-strike!')
      || hasTrait(event.defender, 'Counter-strike');

    options.push({
      id: `${event.defender.id}:CounterAction`,
      type: 'CounterAction',
      actorId: event.defender.id,
      targetId: event.attacker.id,
      available: canReact && failedHitTest && hasCarryOver && (event.attackType !== 'ranged' || defenderRef >= attackerRef),
      reason: canReact && failedHitTest && hasCarryOver && (event.attackType !== 'ranged' || defenderRef >= attackerRef)
        ? undefined
        : !canReact
          ? attentiveOrderedRequirementReason(event.defender)
          : !failedHitTest
            ? 'Requires failed Hit Test.'
          : !hasCarryOver
            ? 'Requires carry-over from the failed Hit Test.'
            : 'Requires defender REF >= attacker REF.',
    });

    options.push({
      id: `${event.defender.id}:React`,
      type: 'React',
      actorId: event.defender.id,
      targetId: event.attacker.id,
      available: canReact,
      reason: canReact ? undefined : attentiveOrderedRequirementReason(event.defender),
    });

    const allowStrike = canReact && failedHitTest && event.attackType === 'melee' && engaged && hasCarryOver;
    options.push({
      id: `${event.defender.id}:CounterStrike`,
      type: 'CounterStrike',
      actorId: event.defender.id,
      targetId: event.attacker.id,
      available: allowStrike && hasCounterStrikeTrait,
      reason: allowStrike && hasCounterStrikeTrait
        ? undefined
        : !canReact
          ? attentiveOrderedRequirementReason(event.defender)
          : !failedHitTest
            ? 'Requires failed Hit Test.'
          : !hasCarryOver
            ? 'Requires carry-over from the failed Hit Test.'
          : !engaged || event.attackType !== 'melee'
            ? 'Requires melee engagement.'
            : 'Requires Counter-strike! trait.',
    });

    const allowFire = canReact
      && failedHitTest
      && event.attackType === 'ranged'
      && hasLOS
      && withinVisibility
      && !engaged
      && !event.attacker.state.isHidden
      && defenderRef >= attackerRef;
    options.push({
      id: `${event.defender.id}:CounterFire`,
      type: 'CounterFire',
      actorId: event.defender.id,
      targetId: event.attacker.id,
      available: allowFire,
      reason: allowFire
        ? undefined
        : !canReact
          ? attentiveOrderedRequirementReason(event.defender)
          : !failedHitTest
            ? 'Requires failed Hit Test.'
          : losFailureReason
            ? losFailureReason
            : engaged
              ? 'Requires defender to be Free.'
              : event.attacker.state.isHidden
                ? 'Requires Revealed attacker.'
                : defenderRef < attackerRef
                  ? 'Requires defender REF >= attacker REF.'
                  : 'Requires ranged attack context.',
    });

    return options;
  }

  if (event.kind === 'MoveConcluded') {
    const options: PassiveOption[] = [];
    const battlefield = event.battlefield;
    if (!battlefield) {
      for (const observer of event.observers) {
        options.push({
          id: `${observer.id}:CounterCharge`,
          type: 'CounterCharge',
          actorId: observer.id,
          targetId: event.mover.id,
          available: false,
          reason: 'Battlefield context required to evaluate CounterCharge.',
        });
      }
      return options;
    }

    const moverModel = buildSpatialModel(event.mover, battlefield);
    if (!moverModel) return options;

    for (const observer of event.observers) {
      const observerModel = buildSpatialModel(observer, battlefield);
      if (!observerModel) continue;
      const canReact = observer.state.isAttentive && observer.state.isOrdered;
      const hasLOS = SpatialRules.hasLineOfSight(battlefield, observerModel, moverModel);
      const visibilityOrMu = event.visibilityOrMu ?? 16;
      const edgeDistance = SpatialRules.distanceEdgeToEdge(observerModel, moverModel);
      const withinVisibility = edgeDistance <= visibilityOrMu;
      const losFailureReason = resolveLosVisibilityFailureReason({
        battlefield,
        sourceModel: observerModel,
        targetModel: moverModel,
        hasLOS,
        withinVisibility,
      });
      const moveLimit = observer.finalAttributes.mov ?? observer.attributes.mov ?? 0;
      const canEngage = edgeDistance <= moveLimit;
      const observerRef = observer.finalAttributes.ref ?? observer.attributes.ref ?? 0;
      const moverMov = event.mover.finalAttributes.mov ?? event.mover.attributes.mov ?? 0;
      const requiredAp = observerRef > moverMov ? 1 : 2;
      const moveApSpent = event.moveApSpent ?? 2;
      options.push({
        id: `${observer.id}:CounterCharge`,
        type: 'CounterCharge',
        actorId: observer.id,
        targetId: event.mover.id,
        available: canReact && hasLOS && withinVisibility && canEngage && moveApSpent >= requiredAp,
        reason: canReact && hasLOS && withinVisibility && canEngage && moveApSpent >= requiredAp
          ? undefined
          : !canReact
            ? attentiveOrderedRequirementReason(observer)
            : losFailureReason
              ? losFailureReason
              : !canEngage
                ? 'Requires move to engage.'
                : 'Requires target to spend enough AP on movement.',
      });
    }

    return options;
  }

  if (event.kind === 'EngagementBroken') {
    const options: PassiveOption[] = [];
    const battlefield = event.battlefield;
    if (!battlefield) {
      for (const opponent of event.opponents) {
        options.push({
          id: `${opponent.id}:OpportunityAttack`,
          type: 'OpportunityAttack',
          actorId: opponent.id,
          targetId: event.mover.id,
          available: false,
          reason: 'Battlefield context required to evaluate Opportunity Attack.',
        });
      }
      return options;
    }

    const moverModel = buildSpatialModel(event.mover, battlefield);
    if (!moverModel) return options;

    for (const opponent of event.opponents) {
      const opponentModel = buildSpatialModel(opponent, battlefield);
      if (!opponentModel) continue;
      const wasEngaged = SpatialRules.isEngaged(moverModel, opponentModel);
      const canReact = opponent.state.isAttentive && opponent.state.isOrdered;
      options.push({
        id: `${opponent.id}:OpportunityAttack`,
        type: 'OpportunityAttack',
        actorId: opponent.id,
        targetId: event.mover.id,
        available: canReact && wasEngaged,
        reason: canReact && wasEngaged
          ? undefined
          : !canReact
            ? attentiveOrderedRequirementReason(opponent)
            : 'Requires opponent engaged with mover.',
      });
    }
    return options;
  }

  if (event.kind === 'HiddenExposure') {
    return [
      {
        id: `${event.character.id}:HiddenReposition`,
        type: 'HiddenReposition',
        actorId: event.character.id,
        available: !event.character.state.isKOd && !event.character.state.isEliminated,
        reason: 'Available when Hidden status is removed.',
        payload: {
          maxMove: event.character.finalAttributes.mov ?? event.character.attributes.mov ?? 0,
        },
      },
    ];
  }

  return [];
}

export function buildActiveToggleOptions(params: {
  attacker: Character;
  weapon?: Item;
  isEngaged?: boolean;
}): ActiveToggleOption[] {
  const options: ActiveToggleOption[] = [];
  const classification = params.weapon?.classification || params.weapon?.class || '';
  const isMelee = classification.toLowerCase().includes('melee');
  const hasStub = params.weapon?.traits?.some(trait => trait.includes('[Stub]')) ?? false;
  const isNatural = classification.toLowerCase().includes('natural');
  const isTwoHanded = params.weapon?.traits?.some(trait => trait.includes('[2H]') || trait.includes('2H')) ?? false;

  options.push({
    id: `${params.attacker.id}:Overreach`,
    type: 'Overreach',
    label: 'Overreach',
    available: isMelee && !isNatural && !hasStub && !isTwoHanded && params.attacker.state.isAttentive,
    reason: isMelee && !isNatural && !hasStub && !isTwoHanded && params.attacker.state.isAttentive
      ? undefined
      : 'Requires an Attentive attacker with a non-natural, non-stub melee weapon (2H weapons cannot Overreach).',
  });

  options.push({
    id: `${params.attacker.id}:Lean`,
    type: 'Lean',
    label: 'Lean',
    available: params.attacker.state.isAttentive,
    reason: params.attacker.state.isAttentive ? undefined : 'Requires Attentive.',
  });

  options.push({
    id: `${params.attacker.id}:BonusAction`,
    type: 'BonusAction',
    label: 'Bonus Action',
    available: true,
  });

  options.push({
    id: `${params.attacker.id}:React`,
    type: 'React',
    label: 'React',
    available: params.attacker.state.isAttentive && params.attacker.state.isOrdered,
    reason: params.attacker.state.isAttentive && params.attacker.state.isOrdered
      ? undefined
      : attentiveOrderedRequirementReason(params.attacker),
  });

  options.push({
    id: `${params.attacker.id}:Focus`,
    type: 'Focus',
    label: 'Focus',
    available: params.attacker.state.isAttentive,
    reason: params.attacker.state.isAttentive ? undefined : 'Requires Attentive.',
  });

  return options;
}
