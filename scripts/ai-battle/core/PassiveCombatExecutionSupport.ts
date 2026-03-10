import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import {
  TacticalDoctrine,
} from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { PassiveOption, PassiveOptionType } from '../../../src/lib/mest-tactics/status/passive-options';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import {
  applyAutoBonusActionIfPossibleForRunner,
  applyPassiveFollowupBonusActionsForRunner,
  executeCounterChargeFromMoveForRunner,
  executeFailedHitPassiveResponseForRunner,
  processMoveConcludedPassivesForRunner,
} from './PassiveCombatFollowups';
import {
  getPassiveResponsePriorityList,
  scoreCounterChargeObserverForDoctrine,
} from './AIDecisionSupport';
import { buildAutoBonusActionSelectionsWithHeuristics } from './BonusActionPlanningHeuristics';
import { areCharactersEngagedForRunner } from './MovementPlanningSupport';
import { pickMeleeWeaponForRunner, pickRangedWeaponForRunner } from './CombatRuntimeSupport';

interface CreatePassiveCombatExecutionSupportParams {
  tracker: StatisticsTracker;
  doctrineByCharacterId: Map<string, TacticalDoctrine>;
}

interface AutoBonusActionParams {
  result: any;
  attacker: Character;
  target: Character;
  battlefield: Battlefield;
  allies: Character[];
  opponents: Character[];
  isCloseCombat: boolean;
  doctrine: TacticalDoctrine;
  isCharge?: boolean;
}

interface FailedHitPassiveResponseParams {
  gameManager: GameManager;
  attacker: Character;
  defender: Character;
  hitTestResult: any;
  attackType: 'melee' | 'ranged';
  options: PassiveOption[];
  doctrine: TacticalDoctrine;
  visibilityOrMu: number;
}

interface PassiveCombatExecutionSupport {
  applyAutoBonusActionIfPossible: (params: AutoBonusActionParams) => void;
  executeFailedHitPassiveResponse: (
    params: FailedHitPassiveResponseParams
  ) => { type?: PassiveOptionType; result?: unknown };
  processMoveConcludedPassives: (
    gameManager: GameManager,
    battlefield: Battlefield,
    character: Character,
    enemies: Character[],
    visibilityOrMu: number,
    movedDistance: number
  ) => void;
}

function applyRefreshLocally(character: Character): void {
  if (character.state.delayTokens > 0) {
    character.state.delayTokens = Math.max(0, character.state.delayTokens - 1);
  } else if (character.state.isAttentive && character.state.fearTokens > 0) {
    character.state.fearTokens = Math.max(0, character.state.fearTokens - 1);
  }
  character.refreshStatusFlags();
}

export function createPassiveCombatExecutionSupportForRunner(
  params: CreatePassiveCombatExecutionSupportParams
): PassiveCombatExecutionSupport {
  const { tracker, doctrineByCharacterId } = params;

  const inspectMovePassiveOptions = (
    gameManager: GameManager,
    battlefield: Battlefield,
    mover: Character,
    opponents: Character[],
    visibilityOrMu: number,
    moveApSpent: number
  ): { moveConcluded: PassiveOption[]; engagementBroken: PassiveOption[] } => {
    const moveConcluded = tracker.inspectPassiveOptions(gameManager, {
      kind: 'MoveConcluded',
      mover,
      observers: opponents,
      battlefield,
      moveApSpent,
      visibilityOrMu,
    });
    const engagementBroken = tracker.inspectPassiveOptions(gameManager, {
      kind: 'EngagementBroken',
      mover,
      opponents,
      battlefield,
    });
    return { moveConcluded, engagementBroken };
  };

  const applyAutoBonusActionIfPossible = (supportParams: AutoBonusActionParams): void => {
    applyAutoBonusActionIfPossibleForRunner({
      ...supportParams,
      areEngaged: (attacker, target, battlefield) =>
        areCharactersEngagedForRunner(attacker, target, battlefield),
      buildAutoBonusActionSelections: (
        attacker,
        target,
        battlefield,
        allies,
        opponents,
        options,
        isCloseCombat,
        doctrine
      ) => buildAutoBonusActionSelectionsWithHeuristics({
        attacker,
        target,
        battlefield,
        allies,
        opponents,
        options,
        isCloseCombat,
        doctrine,
      }),
      applyRefreshLocally,
    });
  };

  const executeFailedHitPassiveResponse = (supportParams: FailedHitPassiveResponseParams) =>
    executeFailedHitPassiveResponseForRunner({
      ...supportParams,
      pickMeleeWeapon: character => pickMeleeWeaponForRunner(character),
      pickRangedWeapon: character => pickRangedWeaponForRunner(character),
      getPassiveResponsePriorityList,
      applyPassiveFollowupBonusActions: followup =>
        applyPassiveFollowupBonusActionsForRunner({
          ...followup,
          areEngaged: (attacker, defender, battlefield) =>
            areCharactersEngagedForRunner(attacker, defender, battlefield),
          buildAutoBonusActionSelections: (
            attacker,
            target,
            battlefield,
            allies,
            opponents,
            options,
            isCloseCombat,
            doctrine
          ) => buildAutoBonusActionSelectionsWithHeuristics({
            attacker,
            target,
            battlefield,
            allies,
            opponents,
            options,
            isCloseCombat,
            doctrine,
          }),
          applyRefreshLocally,
          trackBonusActionOptions: options => tracker.trackBonusActionOptions(options),
          trackBonusActionOutcome: outcome => tracker.trackBonusActionOutcome(outcome),
        }),
      trackPassiveUsage: type => tracker.trackPassiveUsage(type as PassiveOptionType),
    });

  const processMoveConcludedPassives = (
    gameManager: GameManager,
    battlefield: Battlefield,
    character: Character,
    enemies: Character[],
    visibilityOrMu: number,
    movedDistance: number
  ): void => {
    processMoveConcludedPassivesForRunner({
      gameManager,
      battlefield,
      character,
      enemies,
      visibilityOrMu,
      movedDistance,
      inspectMovePassiveOptions: (
        manager,
        field,
        mover,
        opponents,
        visibility,
        moveApSpent
      ) => inspectMovePassiveOptions(manager, field, mover, opponents, visibility, moveApSpent),
      executeCounterChargeFromMove: (
        manager,
        mover,
        moveOptions,
        allEnemies,
        field,
        visibility
      ) => executeCounterChargeFromMoveForRunner({
        gameManager: manager,
        mover,
        moveOptions,
        allEnemies,
        battlefield: field,
        visibilityOrMu: visibility,
        getDoctrineForCharacter: model => doctrineByCharacterId.get(model.id) ?? TacticalDoctrine.Operative,
        scoreCounterChargeObserverForDoctrine,
        trackPassiveUsage: type => tracker.trackPassiveUsage(type as PassiveOptionType),
      }),
    });
  };

  return {
    applyAutoBonusActionIfPossible,
    executeFailedHitPassiveResponse,
    processMoveConcludedPassives,
  };
}

