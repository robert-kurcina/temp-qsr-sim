import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import {
  applyBonusAction,
  buildBonusActionOptions,
  computeBonusActionBudget,
  type BonusActionOption,
  type BonusActionOutcome,
  type BonusActionSelection,
  type BonusActionType,
} from '../../../src/lib/mest-tactics/actions/bonus-actions';
import type { PassiveOption, PassiveOptionType } from '../../../src/lib/mest-tactics/status/passive-options';
import { performTest, type TestDice } from '../../../src/lib/mest-tactics/subroutines/dice-roller';
import type { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';

export function countDiceInPoolForRunner(dice: TestDice | undefined): number {
  if (!dice) return 0;
  return (dice.base ?? 0) + (dice.modifier ?? 0) + (dice.wild ?? 0);
}

export function resolveCarryOverBonusCascadesForRunner(hitTestResult: any): number {
  const carryOverDice = (hitTestResult?.p2Result?.carryOverDice ?? {}) as TestDice;
  const totalDice = countDiceInPoolForRunner(carryOverDice);
  if (totalDice <= 0) return 0;
  const rolls = Array.from({ length: totalDice }, () => Math.floor(Math.random() * 6) + 1);
  return Math.max(0, performTest(carryOverDice, 0, rolls).score);
}

interface ExecuteChainedBonusActionsForRunnerParams {
  actor: Character;
  target: Character;
  battlefield: Battlefield;
  allies: Character[];
  opponents: Character[];
  doctrine: TacticalDoctrine;
  cascades: number;
  isCloseCombat: boolean;
  isCharge?: boolean;
  areEngaged: (attacker: Character, target: Character, battlefield: Battlefield) => boolean;
  buildAutoBonusActionSelections: (
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    allies: Character[],
    opponents: Character[],
    options: BonusActionOption[],
    isCloseCombat: boolean,
    doctrine: TacticalDoctrine
  ) => BonusActionSelection[];
  applyRefreshLocally: (character: Character) => void;
  trackBonusActionOptions?: (options: BonusActionOption[]) => void;
  trackBonusActionOutcome?: (outcome: BonusActionOutcome) => void;
}

interface ExecuteChainedBonusActionsForRunnerResult {
  initialCascades: number;
  maxActions: number;
  spentCascades: number;
  remainingCascades: number;
  actionsUsed: number;
  optionSets: BonusActionOption[][];
  outcomes: BonusActionOutcome[];
  lastOutcome?: BonusActionOutcome;
}

function executeChainedBonusActionsForRunner(
  params: ExecuteChainedBonusActionsForRunnerParams
): ExecuteChainedBonusActionsForRunnerResult {
  const initialCascades = Math.max(0, Math.floor(params.cascades));
  const initialEngaged = params.areEngaged(params.actor, params.target, params.battlefield);
  const budget = computeBonusActionBudget({
    battlefield: params.battlefield,
    attacker: params.actor,
    target: params.target,
    cascades: initialCascades,
    isCloseCombat: params.isCloseCombat,
    isCharge: params.isCharge ?? false,
    engaged: initialEngaged,
  });

  const maxActions = Math.max(0, Math.floor(budget.maxActions ?? 0));
  let remainingCascades = Math.max(0, Math.floor(budget.cascades ?? 0));
  if (remainingCascades <= 0 || maxActions <= 0) {
    return {
      initialCascades,
      maxActions,
      spentCascades: 0,
      remainingCascades: 0,
      actionsUsed: 0,
      optionSets: [],
      outcomes: [],
    };
  }

  const optionSets: BonusActionOption[][] = [];
  const outcomes: BonusActionOutcome[] = [];
  let lastOutcome: BonusActionOutcome | undefined;
  let actionsUsed = 0;
  let spentCascades = 0;

  while (remainingCascades > 0 && actionsUsed < maxActions) {
    const engaged = params.areEngaged(params.actor, params.target, params.battlefield);
    const unconstrainedOptions = buildBonusActionOptions({
      battlefield: params.battlefield,
      attacker: params.actor,
      target: params.target,
      cascades: Number.MAX_SAFE_INTEGER,
      isCloseCombat: params.isCloseCombat,
      engaged,
    });
    const optionByType = new Map<BonusActionType, BonusActionOption>();
    const options = unconstrainedOptions.map(option => {
      const available = option.available && option.costCascades <= remainingCascades;
      const normalized: BonusActionOption = {
        ...option,
        available,
        reason: available ? undefined : option.reason,
      };
      optionByType.set(normalized.type, normalized);
      return normalized;
    });
    optionSets.push(options);
    params.trackBonusActionOptions?.(options);
    if (!options.some(option => option.available)) {
      break;
    }

    const selections = params.buildAutoBonusActionSelections(
      params.actor,
      params.target,
      params.battlefield,
      params.allies,
      params.opponents,
      options,
      params.isCloseCombat,
      params.doctrine
    );
    if (selections.length === 0) {
      break;
    }

    let executedThisStep = false;
    for (const selection of selections) {
      const option = optionByType.get(selection.type);
      if (!option?.available) continue;
      const requiredCascades = option.costCascades + Math.max(0, selection.extraCascades ?? 0);
      if (requiredCascades > remainingCascades) continue;

      const outcome = applyBonusAction(
        {
          battlefield: params.battlefield,
          attacker: params.actor,
          target: params.target,
          cascades: Number.MAX_SAFE_INTEGER,
          isCloseCombat: params.isCloseCombat,
          isCharge: params.isCharge ?? false,
          engaged,
        },
        selection
      );
      lastOutcome = outcome;
      if (outcome.refreshApplied) {
        params.applyRefreshLocally(params.actor);
      }
      if (!outcome.executed) {
        continue;
      }

      const spentForOutcome = Math.max(0, Math.floor(outcome.spentCascades ?? requiredCascades));
      spentCascades += spentForOutcome;
      remainingCascades = Math.max(0, remainingCascades - spentForOutcome);
      actionsUsed += 1;
      outcomes.push(outcome);
      params.trackBonusActionOutcome?.(outcome);
      executedThisStep = true;
      break;
    }

    if (!executedThisStep) {
      break;
    }
  }

  return {
    initialCascades,
    maxActions,
    spentCascades,
    remainingCascades,
    actionsUsed,
    optionSets,
    outcomes,
    lastOutcome,
  };
}

export function applyPassiveFollowupBonusActionsForRunner(params: {
  defender: Character;
  attacker: Character;
  battlefield: Battlefield;
  doctrine: TacticalDoctrine;
  attackType: 'melee' | 'ranged';
  cascades: number;
  areEngaged: (attacker: Character, defender: Character, battlefield: Battlefield) => boolean;
  buildAutoBonusActionSelections: (
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    allies: Character[],
    opponents: Character[],
    options: BonusActionOption[],
    isCloseCombat: boolean,
    doctrine: TacticalDoctrine
  ) => BonusActionSelection[];
  applyRefreshLocally: (character: Character) => void;
  trackBonusActionOptions: (options: BonusActionOption[]) => void;
  trackBonusActionOutcome: (outcome: BonusActionOutcome) => void;
}): {
  bonusActionCascades: number;
  bonusActionOptions?: BonusActionOption[];
  bonusActionOptionSets?: BonusActionOption[][];
  bonusActionOutcome?: BonusActionOutcome;
  bonusActionOutcomes?: BonusActionOutcome[];
} {
  const { defender, attacker, battlefield, doctrine, attackType } = params;
  const cascades = Math.max(0, Math.floor(params.cascades));

  const isCloseCombat = attackType === 'melee';
  const chained = executeChainedBonusActionsForRunner({
    actor: defender,
    target: attacker,
    battlefield,
    allies: [],
    opponents: [attacker],
    doctrine,
    cascades,
    isCloseCombat,
    areEngaged: params.areEngaged,
    buildAutoBonusActionSelections: params.buildAutoBonusActionSelections,
    applyRefreshLocally: params.applyRefreshLocally,
    trackBonusActionOptions: params.trackBonusActionOptions,
    trackBonusActionOutcome: params.trackBonusActionOutcome,
  });
  const bonusActionOptions = chained.optionSets[0];
  const bonusActionOutcome = chained.outcomes.at(-1) ?? chained.lastOutcome;

  return {
    bonusActionCascades: cascades,
    bonusActionOptions,
    bonusActionOptionSets: chained.optionSets.length > 0 ? chained.optionSets : undefined,
    bonusActionOutcome,
    bonusActionOutcomes: chained.outcomes.length > 0 ? chained.outcomes : undefined,
  };
}

export function executeFailedHitPassiveResponseForRunner(params: {
  gameManager: GameManager;
  attacker: Character;
  defender: Character;
  hitTestResult: any;
  attackType: 'melee' | 'ranged';
  options: PassiveOption[];
  doctrine: TacticalDoctrine;
  visibilityOrMu: number;
  pickMeleeWeapon: (character: Character) => any;
  pickRangedWeapon: (character: Character) => any;
  getPassiveResponsePriorityList: (
    doctrine: TacticalDoctrine,
    attackType: 'melee' | 'ranged',
    defender: Character
  ) => PassiveOptionType[];
  applyPassiveFollowupBonusActions: (params: {
    defender: Character;
    attacker: Character;
    battlefield: Battlefield;
    doctrine: TacticalDoctrine;
    attackType: 'melee' | 'ranged';
    cascades: number;
  }) => {
    bonusActionCascades: number;
    bonusActionOptions?: BonusActionOption[];
    bonusActionOptionSets?: BonusActionOption[][];
    bonusActionOutcome?: BonusActionOutcome;
    bonusActionOutcomes?: BonusActionOutcome[];
  };
  trackPassiveUsage: (type: string) => void;
}): { type?: PassiveOptionType; result?: unknown } {
  const available = params.options.filter(option => option.available);
  if (available.length === 0) {
    return {};
  }

  const hasType = (type: PassiveOptionType) => available.some(option => option.type === type);
  const prioritized = params.getPassiveResponsePriorityList(
    params.doctrine,
    params.attackType,
    params.defender
  );

  for (const type of prioritized) {
    if (!hasType(type)) continue;
    if (type === 'CounterStrike' && params.attackType === 'melee') {
      const weapon = params.pickMeleeWeapon(params.defender);
      if (weapon) {
        const result = params.gameManager.executeCounterStrike(
          params.defender,
          params.attacker,
          weapon as any,
          params.hitTestResult as any
        );
        if (result.executed) {
          params.trackPassiveUsage('CounterStrike');
          const battlefield = params.gameManager.battlefield;
          const bonusFollowup = battlefield && result.bonusActionEligible
            ? params.applyPassiveFollowupBonusActions({
                defender: params.defender,
                attacker: params.attacker,
                battlefield,
                doctrine: params.doctrine,
                attackType: params.attackType,
                cascades: resolveCarryOverBonusCascadesForRunner(params.hitTestResult),
              })
            : { bonusActionCascades: 0 };
          return { type: 'CounterStrike', result: { ...result, ...bonusFollowup } };
        }
      }
    }
    if (type === 'CounterFire' && params.attackType === 'ranged') {
      const weapon = params.pickRangedWeapon(params.defender) ?? params.pickMeleeWeapon(params.defender);
      if (weapon) {
        const result = params.gameManager.executeCounterFire(
          params.defender,
          params.attacker,
          weapon as any,
          params.hitTestResult as any,
          { visibilityOrMu: params.visibilityOrMu }
        );
        if (result.executed) {
          params.trackPassiveUsage('CounterFire');
          const battlefield = params.gameManager.battlefield;
          const bonusFollowup = battlefield && result.bonusActionEligible
            ? params.applyPassiveFollowupBonusActions({
                defender: params.defender,
                attacker: params.attacker,
                battlefield,
                doctrine: params.doctrine,
                attackType: params.attackType,
                cascades: resolveCarryOverBonusCascadesForRunner(params.hitTestResult),
              })
            : { bonusActionCascades: 0 };
          return { type: 'CounterFire', result: { ...result, ...bonusFollowup } };
        }
      }
    }
    if (type === 'CounterAction') {
      const result = params.gameManager.executeCounterAction(
        params.defender,
        params.attacker,
        params.hitTestResult as any,
        { attackType: params.attackType }
      );
      if (result.executed) {
        params.trackPassiveUsage('CounterAction');
        const battlefield = params.gameManager.battlefield;
        const bonusFollowup = battlefield
          ? params.applyPassiveFollowupBonusActions({
              defender: params.defender,
              attacker: params.attacker,
              battlefield,
              doctrine: params.doctrine,
              attackType: params.attackType,
              cascades: result.bonusActionCascades ?? 0,
            })
          : { bonusActionCascades: result.bonusActionCascades ?? 0 };
        return { type: 'CounterAction', result: { ...result, ...bonusFollowup } };
      }
    }
  }

  return {};
}

export function executeCounterChargeFromMoveForRunner(params: {
  gameManager: GameManager;
  mover: Character;
  moveOptions: PassiveOption[];
  allEnemies: Character[];
  battlefield: Battlefield;
  visibilityOrMu: number;
  getDoctrineForCharacter: (character: Character) => TacticalDoctrine;
  scoreCounterChargeObserverForDoctrine: (
    doctrine: TacticalDoctrine,
    observer: Character,
    mover: Character,
    battlefield: Battlefield
  ) => number;
  trackPassiveUsage: (type: string) => void;
}): void {
  const available = params.moveOptions.filter(
    option => option.available && option.type === 'CounterCharge'
  );
  if (available.length === 0) return;
  let bestObserver: Character | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const option of available) {
    const observer = params.allEnemies.find(enemy => enemy.id === option.actorId);
    if (!observer) continue;
    const doctrine = params.getDoctrineForCharacter(observer);
    const score = params.scoreCounterChargeObserverForDoctrine(
      doctrine,
      observer,
      params.mover,
      params.battlefield
    );
    if (score > bestScore) {
      bestScore = score;
      bestObserver = observer;
    }
  }
  if (!bestObserver) return;
  const result = params.gameManager.executeCounterCharge(bestObserver, params.mover, {
    visibilityOrMu: params.visibilityOrMu,
    moveApSpent: 1,
  });
  if (result.executed) {
    params.trackPassiveUsage('CounterCharge');
  }
}

export function processMoveConcludedPassivesForRunner(params: {
  gameManager: GameManager;
  battlefield: Battlefield;
  character: Character;
  enemies: Character[];
  visibilityOrMu: number;
  movedDistance: number;
  inspectMovePassiveOptions: (
    gameManager: GameManager,
    battlefield: Battlefield,
    mover: Character,
    opponents: Character[],
    visibilityOrMu: number,
    moveApSpent: number
  ) => { moveConcluded: PassiveOption[]; engagementBroken: PassiveOption[] };
  executeCounterChargeFromMove: (
    gameManager: GameManager,
    mover: Character,
    moveOptions: PassiveOption[],
    allEnemies: Character[],
    battlefield: Battlefield,
    visibilityOrMu: number
  ) => void;
}): void {
  if (params.movedDistance <= 0) {
    return;
  }
  const movePassive = params.inspectMovePassiveOptions(
    params.gameManager,
    params.battlefield,
    params.character,
    params.enemies,
    params.visibilityOrMu,
    1
  );
  params.executeCounterChargeFromMove(
    params.gameManager,
    params.character,
    movePassive.moveConcluded,
    params.enemies,
    params.battlefield,
    params.visibilityOrMu
  );
}

export function applyAutoBonusActionIfPossibleForRunner(params: {
  result: any;
  attacker: Character;
  target: Character;
  battlefield: Battlefield;
  allies: Character[];
  opponents: Character[];
  isCloseCombat: boolean;
  doctrine: TacticalDoctrine;
  isCharge?: boolean;
  areEngaged: (attacker: Character, target: Character, battlefield: Battlefield) => boolean;
  buildAutoBonusActionSelections: (
    attacker: Character,
    target: Character,
    battlefield: Battlefield,
    allies: Character[],
    opponents: Character[],
    options: BonusActionOption[],
    isCloseCombat: boolean,
    doctrine: TacticalDoctrine
  ) => BonusActionSelection[];
  applyRefreshLocally: (character: Character) => void;
}): void {
  const { result, attacker, target, battlefield, allies, opponents, isCloseCombat, doctrine, isCharge } = params;
  if (!result || typeof result !== 'object') return;
  const existing = result.bonusActionOutcome as BonusActionOutcome | undefined;
  if (existing?.executed) return;

  const cascadesRaw = result.result?.hitTestResult?.cascades
    ?? result.hitTestResult?.cascades
    ?? 0;
  const cascades = Number.isFinite(cascadesRaw) ? Number(cascadesRaw) : 0;
  const chained = executeChainedBonusActionsForRunner({
    actor: attacker,
    target,
    battlefield,
    allies,
    opponents,
    doctrine,
    cascades,
    isCloseCombat,
    isCharge: isCharge ?? false,
    areEngaged: params.areEngaged,
    buildAutoBonusActionSelections: params.buildAutoBonusActionSelections,
    applyRefreshLocally: params.applyRefreshLocally,
  });

  if (chained.optionSets.length > 0) {
    result.bonusActionOptions = chained.optionSets[0];
    result.bonusActionOptionSets = chained.optionSets;
  }
  const latestOutcome = chained.outcomes.at(-1) ?? chained.lastOutcome;
  if (latestOutcome) {
    result.bonusActionOutcome = latestOutcome;
  }
  if (chained.outcomes.length > 0) {
    result.bonusActionOutcomes = chained.outcomes;
  }
}
