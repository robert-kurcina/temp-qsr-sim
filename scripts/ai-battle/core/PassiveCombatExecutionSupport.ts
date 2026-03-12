import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { SpatialRules, type SpatialModel } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../../src/lib/mest-tactics/battlefield/spatial/size-utils';
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

function getAttentiveOrderedReason(character: Character): string | null {
  if (!character.state.isAttentive && !character.state.isOrdered) return 'Requires Attentive+Ordered.';
  if (!character.state.isAttentive) return 'Requires Attentive.';
  if (!character.state.isOrdered) return 'Requires Ordered.';
  return null;
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
    const currentTurn = gameManager.currentTurn;
    const moverModel = buildSpatialModel(mover, battlefield);
    const prefilteredObservers: Character[] = [];
    for (const observer of opponents) {
      const statusReason = getAttentiveOrderedReason(observer);
      if (statusReason) {
        tracker.trackPassivePrefilter(statusReason, 1, currentTurn);
        continue;
      }

      if (!moverModel) {
        prefilteredObservers.push(observer);
        continue;
      }

      const observerModel = buildSpatialModel(observer, battlefield);
      if (!observerModel) {
        tracker.trackPassivePrefilter('LOS unavailable.', 1, currentTurn);
        continue;
      }

      const edgeDistance = SpatialRules.distanceEdgeToEdge(observerModel, moverModel);
      if (edgeDistance > visibilityOrMu) {
        tracker.trackPassivePrefilter('Out of Visibility OR range.', 1, currentTurn);
        continue;
      }

      const moveLimit = observer.finalAttributes.mov ?? observer.attributes.mov ?? 0;
      if (edgeDistance > moveLimit) {
        tracker.trackPassivePrefilter('Requires move to engage.', 1, currentTurn);
        continue;
      }

      const observerRef = observer.finalAttributes.ref ?? observer.attributes.ref ?? 0;
      const moverMov = mover.finalAttributes.mov ?? mover.attributes.mov ?? 0;
      const requiredAp = observerRef > moverMov ? 1 : 2;
      if (moveApSpent < requiredAp) {
        tracker.trackPassivePrefilter('Requires target to spend enough AP on movement.', 1, currentTurn);
        continue;
      }

      prefilteredObservers.push(observer);
    }

    const moveConcluded = tracker.inspectPassiveOptions(gameManager, {
      kind: 'MoveConcluded',
      mover,
      observers: prefilteredObservers,
      battlefield,
      moveApSpent,
      visibilityOrMu,
    });

    const prefilteredOpportunityOpponents: Character[] = [];
    for (const opponent of opponents) {
      const statusReason = getAttentiveOrderedReason(opponent);
      if (statusReason) {
        tracker.trackPassivePrefilter(statusReason, 1, currentTurn);
        continue;
      }

      if (!moverModel) {
        prefilteredOpportunityOpponents.push(opponent);
        continue;
      }

      const opponentModel = buildSpatialModel(opponent, battlefield);
      if (!opponentModel) {
        tracker.trackPassivePrefilter('Requires opponent engaged with mover.', 1, currentTurn);
        continue;
      }

      const wasEngaged = SpatialRules.isEngaged(moverModel, opponentModel);
      if (!wasEngaged) {
        tracker.trackPassivePrefilter('Requires opponent engaged with mover.', 1, currentTurn);
        continue;
      }

      prefilteredOpportunityOpponents.push(opponent);
    }

    const engagementBroken = tracker.inspectPassiveOptions(gameManager, {
      kind: 'EngagementBroken',
      mover,
      opponents: prefilteredOpportunityOpponents,
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
      trackPassiveRejection: reason => tracker.trackPassiveRejection(reason, 1, supportParams.gameManager.currentTurn),
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
