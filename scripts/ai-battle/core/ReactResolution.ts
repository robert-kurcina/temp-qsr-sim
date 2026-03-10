import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../../src/lib/mest-tactics/battlefield/spatial/size-utils';
import type { ReactOption } from '../../../src/lib/mest-tactics/actions/react-actions';
import {
  getCommittedHands,
  getItemHandRequirement,
  getTotalHands,
} from '../../../src/lib/mest-tactics/actions/hand-requirements';
import { pickMeleeWeaponForRunner, pickRangedWeaponForRunner } from './CombatRuntimeSupport';
import type { ReactAuditResult } from '../validation/ValidationMetrics';

interface ProcessReactsParams {
  active: Character;
  opponents: Character[];
  gameManager: GameManager;
  trigger: 'Move' | 'NonMove';
  movedDistance: number;
  reactingToEngaged?: boolean;
  visibilityOrMu: number;
  trackReactChoiceWindow: (options: unknown[]) => void;
  trackCombatExtras: (result: unknown) => void;
  sanitizeForAudit: (value: unknown) => unknown;
  toOpposedTestAudit: (rawResult: unknown) => unknown;
}

interface ReactExploitAssessment {
  overCommittedBy: number;
  hasTwoHandedInHand: boolean;
  hasShieldInHand: boolean;
  exploitableOnReact: boolean;
}

interface RankedReactOption {
  option: ReactOption;
  score: number;
  canMeleeExploit: boolean;
  selectionReason: string;
}

function assessActiveReactExploitOpportunity(active: Character): ReactExploitAssessment {
  const totalHands = getTotalHands(active);
  const committedHands = getCommittedHands(active);
  const overCommittedBy = Math.max(0, committedHands - totalHands);
  const inHandItems = active.profile?.inHandItems ?? [];
  const hasTwoHandedInHand = inHandItems.some(item => getItemHandRequirement(item) >= 2);
  const hasShieldInHand = inHandItems.some(item => {
    const text = `${item?.name ?? ''} ${item?.classification ?? ''} ${item?.class ?? ''}`.toLowerCase();
    return text.includes('shield');
  });
  return {
    overCommittedBy,
    hasTwoHandedInHand,
    hasShieldInHand,
    exploitableOnReact: overCommittedBy > 0 && hasTwoHandedInHand,
  };
}

function rankReactOptionForRunner(
  option: ReactOption,
  active: Character,
  gameManager: GameManager,
  exploitAssessment: ReactExploitAssessment
): RankedReactOption {
  const engaged = areCharactersEngagedForReact(option.actor, active, gameManager);
  const meleeWeapon = engaged ? pickMeleeWeaponForRunner(option.actor) : null;
  const canMeleeExploit = Boolean(engaged && meleeWeapon);
  const refMargin = (option.effectiveRef ?? 0) - (option.requiredRef ?? 0);
  let score = refMargin * 100 + (option.effectiveRef ?? 0);
  let selectionReason = 'highest_ref_margin';
  if (option.type === 'ReactAction') {
    score += 5;
  }
  if (canMeleeExploit) {
    score += 25;
  }
  if (exploitAssessment.exploitableOnReact && canMeleeExploit) {
    score += 10_000;
    selectionReason = 'overcommitted_react_exploit';
  }
  return {
    option,
    score,
    canMeleeExploit,
    selectionReason,
  };
}

function selectReactOptionForRunner(
  options: ReactOption[],
  active: Character,
  gameManager: GameManager,
  exploitAssessment: ReactExploitAssessment
): RankedReactOption | null {
  if (options.length === 0) return null;
  const ranked = options
    .map(option => rankReactOptionForRunner(option, active, gameManager, exploitAssessment))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if ((right.option.effectiveRef ?? 0) !== (left.option.effectiveRef ?? 0)) {
        return (right.option.effectiveRef ?? 0) - (left.option.effectiveRef ?? 0);
      }
      return left.option.actor.name.localeCompare(right.option.actor.name);
    });
  return ranked[0];
}

export function processReactsForRunner(params: ProcessReactsParams): ReactAuditResult {
  const {
    active,
    opponents,
    gameManager,
    trigger,
    movedDistance,
    reactingToEngaged = false,
    visibilityOrMu,
    trackReactChoiceWindow,
    trackCombatExtras,
    sanitizeForAudit,
    toOpposedTestAudit,
  } = params;

  const options = (gameManager.getReactOptionsSorted({
    battlefield: gameManager.battlefield!,
    active,
    opponents,
    trigger,
    movedDistance,
    reactingToEngaged,
    visibilityOrMu,
  }) ?? []) as ReactOption[];
  trackReactChoiceWindow(options);
  const choicesGiven = options.filter(option => option.available).length;
  const exploitAssessment = assessActiveReactExploitOpportunity(active);
  const mismatchedAvailable = options.find(option =>
    option.available && option.target && option.target.id !== active.id
  );
  const matchedAvailable = options.filter(option =>
    option.available && (!option.target || option.target.id === active.id)
  );
  const selected = selectReactOptionForRunner(matchedAvailable, active, gameManager, exploitAssessment);
  const first = selected?.option;

  if (mismatchedAvailable && !first) {
    return {
      executed: false,
      reactor: mismatchedAvailable.actor,
      reactorWasWaiting: Boolean(mismatchedAvailable.actor.state.isWaiting),
      choiceWindowOffered: choicesGiven > 0,
      choicesGiven,
      details: {
        actorId: mismatchedAvailable.actor.id,
        targetId: mismatchedAvailable.target?.id ?? '',
        expectedTargetId: active.id,
        reason: 'react-target-mismatch',
        requiredRef: mismatchedAvailable.requiredRef,
        effectiveRef: mismatchedAvailable.effectiveRef,
        gateReason: mismatchedAvailable.reason ?? 'Target mismatch.',
      },
    };
  }
  if (!first) {
    const bestBlocked = options[0];
    return {
      executed: false,
      choiceWindowOffered: choicesGiven > 0,
      choicesGiven,
      details: bestBlocked
        ? {
            actorId: bestBlocked.actor.id,
            targetId: bestBlocked.target?.id ?? active.id,
            reason: 'react-gate-failed',
            requiredRef: bestBlocked.requiredRef,
            effectiveRef: bestBlocked.effectiveRef,
            gateReason: bestBlocked.reason ?? 'Unavailable.',
          }
        : undefined,
    };
  }

  const reactorWasWaiting = Boolean(first.actor.state.isWaiting);
  const reactorPos = gameManager.battlefield?.getCharacterPosition(first.actor);
  const activePos = gameManager.battlefield?.getCharacterPosition(active);
  let reactType: 'standard' | 'react_action' = 'standard';
  let actionMode: 'ranged' | 'close' | undefined = 'ranged';
  let weaponUsed: any | null = null;
  let react:
    | { executed: boolean; result?: unknown; reason?: string }
    | { executed: boolean; result?: unknown; reason?: string; [key: string]: unknown };

  if (first.type === 'StandardReact') {
    const weapon = pickRangedWeaponForRunner(first.actor);
    if (!weapon) {
      return {
        executed: false,
        reactor: first.actor,
        reactorWasWaiting,
        choiceWindowOffered: choicesGiven > 0,
        choicesGiven,
        details: {
          actorId: first.actor.id,
          targetId: active.id,
          reason: 'standard-react-no-weapon',
          requiredRef: first.requiredRef,
          effectiveRef: first.effectiveRef,
          gateReason: first.reason ?? 'Passed gate.',
        },
      };
    }
    weaponUsed = weapon;
    react = gameManager.executeStandardReact(first.actor, active, weapon, { visibilityOrMu });
  } else {
    reactType = 'react_action';
    const engaged = areCharactersEngagedForReact(first.actor, active, gameManager);
    const meleeWeapon = engaged ? pickMeleeWeaponForRunner(first.actor) : null;
    if (engaged && meleeWeapon) {
      actionMode = 'close';
      weaponUsed = meleeWeapon;
      react = gameManager.executeReactAction(first.actor, () =>
        gameManager.executeCloseCombatAttack(first.actor, active, meleeWeapon)
      ) as { executed: boolean; result?: unknown; reason?: string };
    } else {
      const rangedWeapon = pickRangedWeaponForRunner(first.actor);
      if (!rangedWeapon) {
        return {
          executed: false,
          reactor: first.actor,
          reactorWasWaiting,
          choiceWindowOffered: choicesGiven > 0,
          choicesGiven,
          details: {
            actorId: first.actor.id,
            targetId: active.id,
            reason: 'react-action-no-weapon',
            requiredRef: first.requiredRef,
            effectiveRef: first.effectiveRef,
            gateReason: first.reason ?? 'Passed gate.',
          },
        };
      }
      actionMode = 'ranged';
      weaponUsed = rangedWeapon;
      react = gameManager.executeReactAction(first.actor, () =>
        gameManager.executeRangedAttack(first.actor, active, rangedWeapon)
      ) as { executed: boolean; result?: unknown; reason?: string };
    }
  }

  if (!react.executed) {
    return {
      executed: false,
      reactor: first.actor,
      reactorWasWaiting,
      choiceWindowOffered: choicesGiven > 0,
      choicesGiven,
      details: {
        actorId: first.actor.id,
        targetId: active.id,
        reason: first.type === 'StandardReact' ? 'standard-react-not-executed' : 'react-action-not-executed',
        requiredRef: first.requiredRef,
        effectiveRef: first.effectiveRef,
        gateReason: first.reason ?? 'Passed gate.',
        reactResult: sanitizeForAudit(react) as Record<string, unknown>,
      },
    };
  }
  trackCombatExtras((react as any).result);
  return {
    executed: true,
    reactor: first.actor,
    reactorWasWaiting,
    choiceWindowOffered: choicesGiven > 0,
    choicesGiven,
    resultCode: reactType === 'standard'
      ? 'react=true:standard'
      : `react=true:action:${actionMode ?? 'unknown'}`,
    rawResult: (react as any).result ?? react,
    vector: reactorPos && activePos ? {
      kind: 'los',
      from: reactorPos,
      to: activePos,
      distanceMu: Math.hypot(activePos.x - reactorPos.x, activePos.y - reactorPos.y),
    } : undefined,
    opposedTest: toOpposedTestAudit((react as any).result),
      details: {
        actorId: first.actor.id,
        actorName: first.actor.profile.name,
        targetId: active.id,
        targetName: active.profile.name,
        selectionReason: selected?.selectionReason ?? 'default',
        reactExploitOpportunity: exploitAssessment.exploitableOnReact,
        activeOverCommittedBy: exploitAssessment.overCommittedBy,
        activeHasTwoHandedInHand: exploitAssessment.hasTwoHandedInHand,
        activeHasShieldInHand: exploitAssessment.hasShieldInHand,
        selectedCanMeleeExploit: selected?.canMeleeExploit ?? false,
        reactType,
        actionMode,
        requiredRef: first.requiredRef,
      effectiveRef: first.effectiveRef,
      gateReason: first.reason ?? 'Passed gate.',
      weaponName: (weaponUsed as any)?.name ?? (weaponUsed as any)?.id ?? 'weapon',
      reactResult: sanitizeForAudit(react) as Record<string, unknown>,
    },
  };
}

function areCharactersEngagedForReact(
  reactor: Character,
  active: Character,
  gameManager: GameManager
): boolean {
  const battlefield = gameManager.battlefield;
  if (!battlefield) return false;
  const reactorPos = battlefield.getCharacterPosition(reactor);
  const activePos = battlefield.getCharacterPosition(active);
  if (!reactorPos || !activePos) return false;
  const reactorSiz = reactor.finalAttributes?.siz ?? reactor.attributes?.siz ?? 3;
  const activeSiz = active.finalAttributes?.siz ?? active.attributes?.siz ?? 3;
  return SpatialRules.isEngaged(
    {
      id: reactor.id,
      position: reactorPos,
      baseDiameter: getBaseDiameterFromSiz(reactorSiz),
      siz: reactorSiz,
    },
    {
      id: active.id,
      position: activePos,
      baseDiameter: getBaseDiameterFromSiz(activeSiz),
      siz: activeSiz,
    }
  );
}
