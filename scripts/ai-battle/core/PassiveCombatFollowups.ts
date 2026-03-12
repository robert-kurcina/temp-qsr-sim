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

const COUNTER_STRIKE_MIN_DAMAGE_POTENTIAL = 2;
const COUNTER_FIRE_MIN_DAMAGE_POTENTIAL = 1;
const COUNTER_ACTION_MIN_CARRY_OVER = 1;

interface PassiveResponseCandidate {
  type: PassiveOptionType;
  score: number;
  execute: () => { type?: PassiveOptionType; result?: unknown };
}

export function countDiceInPoolForRunner(dice: TestDice | undefined): number {
  if (!dice) return 0;
  return (dice.base ?? 0) + (dice.modifier ?? 0) + (dice.wild ?? 0);
}

function getCarryOverCount(hitTestResult: any): number {
  const carryOverDice = (hitTestResult?.p2Result?.carryOverDice ?? {}) as TestDice;
  return countDiceInPoolForRunner(carryOverDice);
}

function isFailedHitTest(hitTestResult: any): boolean {
  if (typeof hitTestResult?.pass === 'boolean') {
    return hitTestResult.pass === false;
  }
  if (typeof hitTestResult?.score === 'number') {
    return hitTestResult.score < 0;
  }
  return false;
}

function parseNumericTraitLevel(character: Character, prefix: string): number {
  const traitCandidates = [
    ...(Array.isArray((character as any)?.profile?.finalTraits) ? (character as any).profile.finalTraits : []),
    ...(Array.isArray((character as any)?.profile?.allTraits) ? (character as any).profile.allTraits : []),
  ]
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim());
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}\\s*(\\d+)?$`, 'i');
  let best = 0;
  for (const trait of traitCandidates) {
    const match = trait.match(pattern);
    if (!match) continue;
    const parsed = Number.parseInt(match[1] ?? '1', 10);
    if (Number.isFinite(parsed) && parsed > best) {
      best = parsed;
    }
  }
  return best;
}

function estimateCounterDamagePotential(weapon: any, target: Character, carryOverCount: number): number {
  const weaponImpact = Number.isFinite(weapon?.impact) ? Number(weapon.impact) : 0;
  const targetArmor = Math.max(0, Number((target as any)?.state?.armor?.total ?? 0));
  const impactPressure = Math.max(0, weaponImpact - targetArmor);
  const hasDamageFormula = typeof weapon?.dmg === 'string' && weapon.dmg !== '-';
  const damageFormulaBonus = hasDamageFormula ? 1 : 0;
  return carryOverCount + impactPressure + damageFormulaBonus;
}

function estimateCounterActionSetupScore(
  defender: Character,
  attackType: 'melee' | 'ranged',
  carryOverCount: number
): number {
  const expectedCascades = carryOverCount * 0.8;
  const fight = parseNumericTraitLevel(defender, 'Fight');
  const brawl = parseNumericTraitLevel(defender, 'Brawl');
  const setupTraits = Math.max(0, fight - 1) + Math.max(0, brawl - 1);
  const threat = Math.max(
    0,
    Number(defender.state.wounds ?? 0) + Number(defender.state.delayTokens ?? 0) + Number(defender.state.fearTokens ?? 0)
  );
  const combatContextBonus = attackType === 'melee' ? 0.8 : 0.2;
  return expectedCascades + setupTraits + Math.min(2, threat * 0.25) + combatContextBonus;
}

function priorityWeightForType(type: PassiveOptionType, prioritized: PassiveOptionType[]): number {
  const index = prioritized.indexOf(type);
  if (index < 0) return 0;
  return Math.max(0, (prioritized.length - index) * 4);
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
  trackPassiveRejection?: (reason: string) => void;
}): { type?: PassiveOptionType; result?: unknown } {
  if (!isFailedHitTest(params.hitTestResult)) {
    params.trackPassiveRejection?.('Requires failed Hit Test.');
    return {};
  }
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
  const isPrioritized = (type: PassiveOptionType): boolean => prioritized.includes(type);
  const carryOverCount = getCarryOverCount(params.hitTestResult);
  const candidates: PassiveResponseCandidate[] = [];

  if (hasType('CounterStrike') && !isPrioritized('CounterStrike')) {
    params.trackPassiveRejection?.('Not prioritized by doctrine.');
  }
  if (hasType('CounterStrike') && carryOverCount < 1) {
    params.trackPassiveRejection?.('Requires carry-over from the failed Hit Test.');
  }
  if (isPrioritized('CounterStrike') && hasType('CounterStrike') && params.attackType === 'melee' && carryOverCount >= 1) {
    const weapon = params.pickMeleeWeapon(params.defender);
    if (weapon) {
      const damagePotential = estimateCounterDamagePotential(weapon, params.attacker, carryOverCount);
      if (damagePotential >= COUNTER_STRIKE_MIN_DAMAGE_POTENTIAL) {
        const score = priorityWeightForType('CounterStrike', prioritized) + damagePotential * 6;
        candidates.push({
          type: 'CounterStrike',
          score,
          execute: () => {
            const result = params.gameManager.executeCounterStrike(
              params.defender,
              params.attacker,
              weapon as any,
              params.hitTestResult as any
            );
            if (!result.executed) return {};
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
            return {
              type: 'CounterStrike',
              result: {
                ...result,
                ...bonusFollowup,
                passiveSelectionScore: score,
                passiveSelectionContext: {
                  carryOverCount,
                  damagePotential,
                },
              },
            };
          },
        });
      } else {
        params.trackPassiveRejection?.('Low damage potential.');
      }
    } else {
      params.trackPassiveRejection?.('No weapon available.');
    }
  }

  if (hasType('CounterFire') && !isPrioritized('CounterFire')) {
    params.trackPassiveRejection?.('Not prioritized by doctrine.');
  }
  if (hasType('CounterFire') && carryOverCount < 1) {
    params.trackPassiveRejection?.('Requires carry-over from the failed Hit Test.');
  }
  if (isPrioritized('CounterFire') && hasType('CounterFire') && params.attackType === 'ranged' && carryOverCount >= 1) {
    const weapon = params.pickRangedWeapon(params.defender) ?? params.pickMeleeWeapon(params.defender);
    if (weapon) {
      const damagePotential = estimateCounterDamagePotential(weapon, params.attacker, carryOverCount);
      if (damagePotential >= COUNTER_FIRE_MIN_DAMAGE_POTENTIAL) {
        const score = priorityWeightForType('CounterFire', prioritized) + damagePotential * 5;
        candidates.push({
          type: 'CounterFire',
          score,
          execute: () => {
            const result = params.gameManager.executeCounterFire(
              params.defender,
              params.attacker,
              weapon as any,
              params.hitTestResult as any,
              { visibilityOrMu: params.visibilityOrMu }
            );
            if (!result.executed) return {};
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
            return {
              type: 'CounterFire',
              result: {
                ...result,
                ...bonusFollowup,
                passiveSelectionScore: score,
                passiveSelectionContext: {
                  carryOverCount,
                  damagePotential,
                },
              },
            };
          },
        });
      } else {
        params.trackPassiveRejection?.('Low damage potential.');
      }
    } else {
      params.trackPassiveRejection?.('No weapon available.');
    }
  }

  if (hasType('CounterAction') && !isPrioritized('CounterAction')) {
    params.trackPassiveRejection?.('Not prioritized by doctrine.');
  }
  if (hasType('CounterAction') && carryOverCount < COUNTER_ACTION_MIN_CARRY_OVER) {
    params.trackPassiveRejection?.('Requires carry-over from the failed Hit Test.');
  }
  if (isPrioritized('CounterAction') && hasType('CounterAction') && carryOverCount >= COUNTER_ACTION_MIN_CARRY_OVER) {
    const setupScore = estimateCounterActionSetupScore(params.defender, params.attackType, carryOverCount);
    const score = priorityWeightForType('CounterAction', prioritized) + setupScore * 5;
    candidates.push({
      type: 'CounterAction',
      score,
      execute: () => {
        const result = params.gameManager.executeCounterAction(
          params.defender,
          params.attacker,
          params.hitTestResult as any,
          { attackType: params.attackType }
        );
        if (!result.executed) return {};
        params.trackPassiveUsage('CounterAction');
        const battlefield = params.gameManager.battlefield;
        const cascades = Math.max(0, result.bonusActionCascades ?? 0);
        const bonusFollowup = battlefield && cascades > 0
          ? params.applyPassiveFollowupBonusActions({
              defender: params.defender,
              attacker: params.attacker,
              battlefield,
              doctrine: params.doctrine,
              attackType: params.attackType,
              cascades,
            })
          : { bonusActionCascades: cascades };
        return {
          type: 'CounterAction',
          result: {
            ...result,
            ...bonusFollowup,
            passiveSelectionScore: score,
            passiveSelectionContext: {
              carryOverCount,
              setupScore,
            },
          },
        };
      },
    });
  }

  candidates.sort((left, right) => right.score - left.score);
  for (const candidate of candidates) {
    const executed = candidate.execute();
    if (executed.type) {
      return executed;
    }
    params.trackPassiveRejection?.('Execution failed.');
  }
  if (available.length > 0) {
    params.trackPassiveRejection?.('No viable passive candidate.');
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
