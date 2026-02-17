import { Character } from './Character';
import { Battlefield } from './battlefield/Battlefield';
import { SpatialRules, SpatialModel } from './battlefield/spatial-rules';
import { getBaseDiameterFromSiz } from './battlefield/size-utils';
import { getCharacterTraitLevel } from './status-system';
import type { Item } from './Item';
import type { ResolveTestResult, TestDice } from './dice-roller';

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
      attacker: Character;
      defender: Character;
      battlefield: Battlefield;
      weapon?: Item;
    }
  | {
      kind: 'CloseCombatAttackDeclared';
      attacker: Character;
      defender: Character;
      battlefield: Battlefield;
      weapon?: Item;
    }
  | {
      kind: 'HitTestFailed';
      attacker: Character;
      defender: Character;
      battlefield?: Battlefield;
      attackType?: 'melee' | 'ranged';
      hitTestResult?: ResolveTestResult;
      visibilityOrMu?: number;
    }
  | {
      kind: 'MoveConcluded';
      mover: Character;
      observers: Character[];
      battlefield?: Battlefield;
      moveApSpent?: number;
      visibilityOrMu?: number;
    }
  | {
      kind: 'EngagementBroken';
      mover: Character;
      opponents: Character[];
      battlefield?: Battlefield;
    }
  | {
      kind: 'HiddenExposure';
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

function hasTrait(character: Character, name: string): boolean {
  return getCharacterTraitLevel(character, name) > 0;
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
    options.push({
      id: `${defender.id}:TakeCover`,
      type: 'TakeCover',
      actorId: defender.id,
      targetId: attacker.id,
      available: canUse,
      reason: canUse ? undefined : 'Requires Attentive+Ordered, not engaged, in LOS, and REF >= attacker.',
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
      reason: canDefend ? undefined : 'Requires Attentive defender.',
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
    options.push({
      id: `${defender.id}:Defend`,
      type: 'Defend',
      actorId: defender.id,
      targetId: attacker.id,
      available: canDefend,
      reason: canDefend ? undefined : 'Requires Attentive defender engaged in melee.',
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
    const carryOverCount = event.hitTestResult
      ? countCarryOverDice(event.hitTestResult.p2Result?.carryOverDice)
      : null;
    const hasCarryOver = carryOverCount === null ? true : carryOverCount > 0;
    const hasCounterStrikeTrait = hasTrait(event.defender, 'Counter-strike!')
      || hasTrait(event.defender, 'Counter-strike');

    options.push({
      id: `${event.defender.id}:CounterAction`,
      type: 'CounterAction',
      actorId: event.defender.id,
      targetId: event.attacker.id,
      available: canReact && hasCarryOver && (event.attackType !== 'ranged' || defenderRef >= attackerRef),
      reason: canReact && hasCarryOver && (event.attackType !== 'ranged' || defenderRef >= attackerRef)
        ? undefined
        : !canReact
          ? 'Requires Attentive+Ordered.'
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
      reason: canReact ? undefined : 'Requires Attentive+Ordered.',
    });

    const allowStrike = canReact && event.attackType === 'melee' && engaged;
    options.push({
      id: `${event.defender.id}:CounterStrike`,
      type: 'CounterStrike',
      actorId: event.defender.id,
      targetId: event.attacker.id,
      available: allowStrike && hasCounterStrikeTrait,
      reason: allowStrike && hasCounterStrikeTrait
        ? undefined
        : !canReact
          ? 'Requires Attentive+Ordered.'
          : !engaged || event.attackType !== 'melee'
            ? 'Requires melee engagement.'
            : 'Requires Counter-strike! trait.',
    });

    const allowFire = canReact
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
          ? 'Requires Attentive+Ordered.'
          : !hasLOS || !withinVisibility
            ? 'Requires LOS within Visibility.'
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
            ? 'Requires Attentive+Ordered observer.'
            : !hasLOS || !withinVisibility
              ? 'Requires LOS within Visibility.'
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
        reason: canReact && wasEngaged ? undefined : 'Requires Attentive+Ordered opponent engaged with mover.',
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

  options.push({
    id: `${params.attacker.id}:Overreach`,
    type: 'Overreach',
    label: 'Overreach',
    available: isMelee && !isNatural && !hasStub && params.attacker.state.isAttentive,
    reason: isMelee && !isNatural && !hasStub && params.attacker.state.isAttentive
      ? undefined
      : 'Requires an Attentive attacker with a non-natural, non-stub melee weapon.',
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
      : 'Requires Attentive+Ordered.',
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
