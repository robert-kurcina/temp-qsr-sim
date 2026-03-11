import type { Character } from '../../core/Character';
import type { Item } from '../../core/Item';
import type { Position } from '../../battlefield/Position';
import type { ActionType, AIContext } from './AIController';
import { getAvailableHands, getItemHandRequirement } from '../../actions/hand-requirements';
import { filterActionsByVP, getActionVPInfo, scoreActionByVP } from './ActionVPFilter';
import { calculateStratagemModifiers, TacticalDoctrine } from '../stratagems/AIStratagems';
import {
  buildScoringContext,
  calculateScoringModifiers,
  type ScoringModifiers,
} from '../stratagems/PredictedScoringIntegration';
import { forecastWaitReact, rolloutWaitReactBranches } from '../tactical/GOAP';
import type {
  ActionFractionalScoringBreakdown,
  FractionalScoringPotential,
} from './UtilityScorerPressureSupport';
import { estimateExpectedTurnsRemaining } from './TurnHorizon';
import { calculateVPUrgency, getPassiveActionPenalty } from './VPUrgencyCalculator';
import { isMeleeThreatWeapon, isRangedThreatWeapon } from '../shared/ThreatProfileSupport';

export interface MutableScoredAction {
  action: ActionType;
  target?: Character;
  position?: Position;
  subAction?: string;
  itemName?: string;
  reason?: string;
  score: number;
  factors: Record<string, number>;
}

export interface ThreatLoadoutProfile {
  hasMeleeWeapons: boolean;
  hasRangedWeapons: boolean;
}

interface BuildPushingActionParams {
  context: AIContext;
  finalActions: MutableScoredAction[];
  canPush: boolean;
  loadout: ThreatLoadoutProfile;
  hasChargeTraitMeleeWeapon: boolean;
  candidateEnemyCount: number;
  characterPos: Position | undefined;
  evaluateCoverAtPosition: (position: Position) => number;
  countEnemyInMeleeRange: (position: Position, range: number) => number;
  countFriendlyInMeleeRange: (position: Position, range: number) => number;
  getInteractableObjectiveMarkerCount: () => number;
  canChargeAnyEnemy: () => boolean;
}

interface AttackTargetCandidate {
  target: Character;
  score: number;
  factors: Record<string, number>;
}

interface MeleeLegalityResult {
  canAttack: boolean;
  requiresReach: boolean;
  requiresOverreach: boolean;
}

interface ChargeOpportunityResult {
  canCharge: boolean;
  destination?: Position;
  travelDistance: number;
  remainingGap: number;
}

interface RangedOpportunityResult {
  canAttack: boolean;
  requiresConcentrate: boolean;
  orm: number;
  leanOpportunity: boolean;
}

interface BuildAttackActionsParams {
  context: AIContext;
  attackTargets: AttackTargetCandidate[];
  canCloseCombat: boolean;
  canMove: boolean;
  canRangedCombat: boolean;
  loadout: ThreatLoadoutProfile;
  doctrinePlanning: 'aggression' | 'keys_to_victory' | 'balanced';
  doctrineEngagement: 'melee' | 'ranged' | 'balanced';
  objectiveActionPressure: number;
  attackPressure: number;
  characterPos: Position | undefined;
  isFreeAtStart: boolean;
  canAffordImmediateMeleeAttack: boolean;
  canAffordImmediateChargeAttack: boolean;
  engagedMeleeAttackApCost: number;
  hasChargeTraitMeleeWeapon: boolean;
  assessMeleeLegality: (
    target: Character,
    isFreeAtStart: boolean
  ) => MeleeLegalityResult;
  evaluateBonusActions: (
    target: Character,
    attackerPosition: Position | undefined
  ) => { score: number };
  evaluateChargeOpportunity: (target: Character) => ChargeOpportunityResult;
  evaluateRangedOpportunity: (target: Character) => RangedOpportunityResult;
  countFriendlyInMeleeRange: (position: Position, range: number) => number;
  countEnemyInMeleeRange: (position: Position, range: number) => number;
  qualifiesForMultipleWeapons: (isMelee: boolean) => boolean;
  getMultipleWeaponsBonus: (isMelee: boolean) => number;
}

interface MovePositionCandidate {
  position: Position;
  score: number;
  factors: {
    visibility: number;
    [key: string]: number;
  };
}

interface ApproachProgress {
  deltaMu: number;
  normalizedDelta: number;
}

interface BuildMoveActionsParams {
  context: AIContext;
  canMove: boolean;
  movePositions: MovePositionCandidate[];
  attackActions: MutableScoredAction[];
  loadout: ThreatLoadoutProfile;
  doctrinePlanning: 'aggression' | 'keys_to_victory' | 'balanced';
  doctrineEngagement: 'melee' | 'ranged' | 'balanced';
  movePressure: number;
  objectiveActionPressure: number;
  characterPos: Position | undefined;
  canAffordImmediateChargeAttack: boolean;
  survivalFactor: number;
  strategicPathBudgetExceeded: boolean;
  isCharacterEngaged: () => boolean;
  evaluateObjectiveAdvance: (position: Position) => number;
  evaluateApproachProgress: (from: Position, to: Position) => ApproachProgress;
  evaluateMeleeSetupValue: (position: Position) => number;
  distanceToClosestAttackableEnemy: (position: Position) => number;
  countEnemySightLinesToPosition: (position: Position) => number;
}

type WaitForecast = ReturnType<typeof forecastWaitReact>;

interface BuildWaitActionParams {
  context: AIContext;
  canWait: boolean;
  attackActions: MutableScoredAction[];
  moveActions: MutableScoredAction[];
  moveCandidatePositions: Position[];
  loadout: ThreatLoadoutProfile;
  doctrinePlanning: 'aggression' | 'keys_to_victory' | 'balanced';
  waitPressure: number;
  objectiveActionPressure: number;
  evaluateWaitTacticalConditions: (
    waitForecast: WaitForecast,
    attackActions: MutableScoredAction[]
  ) => number;
}

interface EvaluateSupportActionCandidatesParams {
  context: AIContext;
}

interface EvaluateWeaponSwapActionCandidatesParams {
  context: AIContext;
}

interface AppendAuxiliaryActionsParams<T extends MutableScoredAction> {
  actions: T[];
  canDisengage: boolean;
  canSupport: boolean;
  canWeaponSwap: boolean;
  isCharacterEngaged: () => boolean;
  evaluateObjectiveActions: () => T[];
  shouldDisengage: () => boolean;
  getEngagedEnemies: () => Character[];
  createDisengageAction: (enemy: Character) => T;
  evaluateSupportActions: () => T[];
  evaluateWeaponSwapActions: () => T[];
}

interface ApplyDoctrineScoringModifiersParams<T extends MutableScoredAction> {
  actions: T[];
  context: AIContext;
  applyCombinedModifiers: (
    actions: T[],
    stratagemModifiers: ReturnType<typeof calculateStratagemModifiers>,
    scoringModifiers: ScoringModifiers
  ) => T[];
}

interface ApplyModifiersAndAppendTempoActionsParams<T extends MutableScoredAction> {
  actions: T[];
  context: AIContext;
  canPush: boolean;
  canRefresh: boolean;
  loadout: ThreatLoadoutProfile;
  hasChargeTraitMeleeWeapon: boolean;
  candidateEnemyCount: number;
  characterPos: Position | undefined;
  applyCombinedModifiers: (
    actions: T[],
    stratagemModifiers: ReturnType<typeof calculateStratagemModifiers>,
    scoringModifiers: ScoringModifiers
  ) => T[];
  evaluateCoverAtPosition: (position: Position) => number;
  countEnemyInMeleeRange: (position: Position, range: number) => number;
  countFriendlyInMeleeRange: (position: Position, range: number) => number;
  getInteractableObjectiveMarkerCount: () => number;
  canChargeAnyEnemy: () => boolean;
}

interface FinalizeActionScoresParams<T extends MutableScoredAction> {
  actions: T[];
  context: AIContext;
  fractionalPotential: FractionalScoringPotential;
  evaluateActionFractionalScoring: (
    action: T,
    scoringPotential: FractionalScoringPotential
  ) => ActionFractionalScoringBreakdown;
}

const DEFAULT_SCORING_MODIFIERS: ScoringModifiers = {
  aggressionMultiplier: 1.0,
  defenseMultiplier: 1.0,
  objectiveMultiplier: 1.0,
  riskMultiplier: 1.0,
  waitBonus: 0,
  playForTime: false,
  desperateMode: false,
};

const WEAPON_CLASSIFICATIONS = [
  'Melee',
  'Firearm',
  'Bow',
  'Range',
  'Thrown',
  'Support',
  'Ordnance',
];

function getDistance(context: AIContext, from: Character, to: Character): number {
  const fromPos = context.battlefield.getCharacterPosition(from);
  const toPos = context.battlefield.getCharacterPosition(to);
  if (!fromPos || !toPos) return 999;
  return Math.hypot(fromPos.x - toPos.x, fromPos.y - toPos.y);
}

function isWeapon(item: Item): boolean {
  return item.classification ? WEAPON_CLASSIFICATIONS.includes(item.classification) : false;
}

function isShield(item: Item): boolean {
  return item.classification === 'Shield' || item.class?.includes('Shield');
}

function getAverageEnemyDistance(enemies: Character[], context: AIContext): number {
  const characterPos = context.battlefield.getCharacterPosition(context.character);
  if (!characterPos || enemies.length === 0) return 999;

  let totalDistance = 0;
  let count = 0;
  for (const enemy of enemies) {
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    totalDistance += Math.hypot(enemyPos.x - characterPos.x, enemyPos.y - characterPos.y);
    count++;
  }

  return count > 0 ? totalDistance / count : 999;
}

export function evaluateSupportActionCandidates(
  params: EvaluateSupportActionCandidatesParams
): MutableScoredAction[] {
  const { context } = params;
  const actions: MutableScoredAction[] = [];

  for (const ally of context.allies) {
    if (ally.state.fearTokens <= 0) continue;
    const distance = getDistance(context, context.character, ally);
    const score = (ally.state.fearTokens * 2.0) / (distance + 1);
    actions.push({
      action: 'rally',
      target: ally,
      score,
      factors: { fear: ally.state.fearTokens, distance },
    });
  }

  for (const ally of context.allies) {
    if (!ally.state.isKOd) continue;
    const distance = getDistance(context, context.character, ally);
    const score = 5.0 / (distance + 1);
    actions.push({
      action: 'revive',
      target: ally,
      score,
      factors: { distance },
    });
  }

  return actions;
}

export function evaluateWeaponSwapActionCandidates(
  params: EvaluateWeaponSwapActionCandidatesParams
): MutableScoredAction[] {
  const { context } = params;
  const actions: MutableScoredAction[] = [];
  const character = context.character;
  const inHand = character.profile?.inHandItems ?? [];
  const stowed = character.profile?.stowedItems ?? [];
  if (stowed.length === 0) return actions;

  const avgDistance = getAverageEnemyDistance(context.enemies, context);
  const currentWeapon = inHand.find(item => isWeapon(item));
  const hasRanged = currentWeapon ? isRangedThreatWeapon(currentWeapon) : false;
  const hasMelee = currentWeapon ? isMeleeThreatWeapon(currentWeapon) : false;

  if (avgDistance > 12 && !hasRanged) {
    const rangedWeapon = stowed.find(item => isRangedThreatWeapon(item));
    if (rangedWeapon) {
      const handsRequired = getItemHandRequirement(rangedWeapon);
      const handsAvailable = getAvailableHands(character);
      if (handsAvailable >= handsRequired) {
        const score = 4.0 + (avgDistance / 24) * 2;
        actions.push({
          action: 'fiddle',
          subAction: 'unstow',
          itemName: rangedWeapon.name,
          score,
          factors: { distance: avgDistance, weaponType: 1 },
          reason: 'Draw ranged weapon for distance',
        });
      }
    }
  }

  if (avgDistance < 4 && hasRanged && !hasMelee) {
    const meleeWeapon = stowed.find(item => isMeleeThreatWeapon(item));
    if (meleeWeapon) {
      const score = 5.0 + (4 - avgDistance);
      actions.push({
        action: 'fiddle',
        subAction: 'unstow',
        itemName: meleeWeapon.name,
        score,
        factors: { distance: avgDistance, weaponType: 2 },
        reason: 'Draw melee weapon for close combat',
      });
    }
  }

  const hasShield = inHand.some(item => isShield(item));
  if (!hasShield && context.enemies.length > 0) {
    const shield = stowed.find(item => isShield(item));
    if (shield) {
      const handsRequired = getItemHandRequirement(shield);
      const handsAvailable = getAvailableHands(character);
      if (handsAvailable >= handsRequired) {
        actions.push({
          action: 'fiddle',
          subAction: 'unstow',
          itemName: shield.name,
          score: 3.5,
          factors: { defensive: 1 },
          reason: 'Draw shield for defense',
        });
      }
    }
  }

  return actions;
}

export function buildMoveActions(params: BuildMoveActionsParams): {
  moveActions: MutableScoredAction[];
  nearestEnemyDistance: number;
} {
  const {
    context,
    canMove,
    movePositions,
    attackActions,
    loadout,
    doctrinePlanning,
    doctrineEngagement,
    movePressure,
    objectiveActionPressure,
    characterPos,
    canAffordImmediateChargeAttack,
    survivalFactor,
    strategicPathBudgetExceeded,
    isCharacterEngaged,
    evaluateObjectiveAdvance,
    evaluateApproachProgress,
    evaluateMeleeSetupValue,
    distanceToClosestAttackableEnemy,
    countEnemySightLinesToPosition,
  } = params;

  if (!canMove) {
    return {
      moveActions: [],
      nearestEnemyDistance: Number.POSITIVE_INFINITY,
    };
  }

  const nearestEnemyDistance = characterPos
    ? distanceToClosestAttackableEnemy(characterPos)
    : Number.POSITIVE_INFINITY;
  const currentExposure = characterPos
    ? countEnemySightLinesToPosition(characterPos)
    : 0;
  const movementAllowance = Math.max(
    1,
    (context.character.finalAttributes.mov ?? context.character.attributes.mov ?? 2) + 2
  );
  let moveMultiplier = attackActions.length > 0
    ? (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons ? 0.95 : 0.9)
    : (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons ? 1.95 : 1.5);
  if (doctrineEngagement === 'melee') {
    moveMultiplier += 0.2;
  } else if (doctrineEngagement === 'ranged') {
    moveMultiplier += currentExposure > 0 ? 0.15 : -0.08;
  }
  if (doctrinePlanning === 'keys_to_victory') {
    moveMultiplier += objectiveActionPressure * 0.4;
  } else if (doctrinePlanning === 'aggression') {
    moveMultiplier += 0.08;
  }

  const advanceBonus = (nearestEnemyDistance > 10
    ? (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons ? 1.45 : 0.9)
    : 0) + movePressure;
  const objectiveAdvanceWeight =
    objectiveActionPressure *
    (doctrinePlanning === 'keys_to_victory' ? 4.2 : doctrinePlanning === 'balanced' ? 2.6 : 1.4);

  const moveActions: MutableScoredAction[] = [];
  for (const pos of movePositions.slice(0, 3)) {
    const objectiveAdvance = evaluateObjectiveAdvance(pos.position);
    const approachProgress = characterPos
      ? evaluateApproachProgress(characterPos, pos.position)
      : { deltaMu: 0, normalizedDelta: 0 };
    const approachWeight = attackActions.length > 0 ? 0.7 : 2.1;
    const objectiveApproachScalar = 1 + (objectiveActionPressure * 0.35);
    const approachBonus =
      ((Math.max(0, approachProgress.deltaMu) * approachWeight) +
      (Math.max(0, approachProgress.normalizedDelta) * 0.9)) *
      objectiveApproachScalar;
    const approachPenalty = approachProgress.deltaMu < 0
      ? Math.abs(approachProgress.deltaMu) * (attackActions.length > 0 ? 1.4 : 2.8)
      : 0;
    const displacementMu = characterPos
      ? Math.hypot(pos.position.x - characterPos.x, pos.position.y - characterPos.y)
      : 0;
    const movementUtilization = clamp(displacementMu / Math.max(1, movementAllowance), 0, 1);
    const longApproachPhase =
      Number.isFinite(nearestEnemyDistance) &&
      nearestEnemyDistance > movementAllowance + 0.75;
    const nearEngagementEnvelope =
      Number.isFinite(nearestEnemyDistance) && nearestEnemyDistance <= 2.75;
    const objectiveMicroPositioning = objectiveAdvance >= 0.3;
    const shouldAllowMicroReposition =
      objectiveMicroPositioning ||
      attackActions.length > 0 ||
      isCharacterEngaged();
    const lowUtilizationPenalty =
      context.apRemaining >= 2 &&
      longApproachPhase &&
      !shouldAllowMicroReposition &&
      movementUtilization < 0.55
        ? 0.7 + ((0.55 - movementUtilization) * 1.6)
        : 0;
    const movementUtilizationBonus = shouldAllowMicroReposition
      ? movementUtilization * 0.18
      : movementUtilization * (longApproachPhase ? 0.85 : 0.45);
    const isClosingMove = approachProgress.deltaMu > 0.05;
    const canUseMoreAllowance =
      displacementMu + 0.1 < movementAllowance &&
      Number.isFinite(nearestEnemyDistance) &&
      nearestEnemyDistance > 1.25;
    const approachUtilizationTarget = longApproachPhase ? 0.92 : 0.78;
    const approachUtilizationGap = isClosingMove && canUseMoreAllowance
      ? Math.max(0, approachUtilizationTarget - movementUtilization)
      : 0;
    const closeApproachBonus = isClosingMove
      ? movementUtilization * (longApproachPhase ? 1.2 : 0.65)
      : 0;
    const closeApproachPenalty =
      isClosingMove &&
      canUseMoreAllowance &&
      !nearEngagementEnvelope &&
      !objectiveMicroPositioning &&
      movementUtilization < approachUtilizationTarget
        ? 1.2 + (approachUtilizationGap * (longApproachPhase ? 7.2 : 5.2))
        : 0;
    const moveWaitForecast = loadout.hasRangedWeapons
      ? forecastWaitReact(context, pos.position)
      : null;
    const exposureReduction = moveWaitForecast
      ? Math.max(0, currentExposure - moveWaitForecast.exposureCount)
      : 0;
    const goapFutureWaitValue = moveWaitForecast
      ? (moveWaitForecast.expectedReactValue * 0.55) +
        (moveWaitForecast.hiddenRevealTargets * 0.8) +
        (moveWaitForecast.refGatePassCount * 0.22) +
        (exposureReduction * 0.2)
      : 0;
    const goapFutureWaitWeight = context.apRemaining >= 2 ? 0.45 : 0.25;
    const meleeSetupValue =
      loadout.hasMeleeWeapons && !canAffordImmediateChargeAttack
        ? evaluateMeleeSetupValue(pos.position)
        : 0;
    const meleeSetupWeight = loadout.hasMeleeWeapons ? 0.85 : 0;
    moveActions.push({
      action: 'move',
      position: pos.position,
      score:
        pos.score * moveMultiplier +
        advanceBonus +
        (objectiveActionPressure * pos.factors.visibility * 0.35) +
        (objectiveAdvance * objectiveAdvanceWeight) +
        approachBonus -
        approachPenalty +
        movementUtilizationBonus -
        closeApproachPenalty +
        closeApproachBonus -
        lowUtilizationPenalty +
        (meleeSetupValue * meleeSetupWeight) +
        (goapFutureWaitValue * goapFutureWaitWeight),
      factors: {
        ...pos.factors,
        moveMultiplier,
        advanceBonus,
        objectiveAdvance,
        objectiveAdvanceWeight,
        approachDeltaMu: approachProgress.deltaMu,
        approachNormalizedDelta: approachProgress.normalizedDelta,
        approachBonus,
        approachPenalty: -approachPenalty,
        moveDisplacementMu: displacementMu,
        moveUtilization: movementUtilization,
        moveUtilizationBonus: movementUtilizationBonus,
        moveCloseApproachBonus: closeApproachBonus,
        moveCloseApproachPenalty: -closeApproachPenalty,
        moveClosingIntent: isClosingMove ? 1 : 0,
        moveCanUseMoreAllowance: canUseMoreAllowance ? 1 : 0,
        moveApproachUtilizationTarget: approachUtilizationTarget,
        moveApproachUtilizationGap: approachUtilizationGap,
        moveLowUtilizationPenalty: -lowUtilizationPenalty,
        moveLongApproachPhase: longApproachPhase ? 1 : 0,
        moveAllowMicroReposition: shouldAllowMicroReposition ? 1 : 0,
        survivalFactor,
        goapFutureWaitValue,
        goapFutureWaitWeight,
        goapExposureReduction: exposureReduction,
        meleeSetupValue,
        meleeSetupWeight,
        strategicPathBudgetExceeded: strategicPathBudgetExceeded ? 1 : 0,
        objectivePressure: objectiveActionPressure,
      },
    });
  }

  return { moveActions, nearestEnemyDistance };
}

export function appendAuxiliaryActions<T extends MutableScoredAction>(
  params: AppendAuxiliaryActionsParams<T>
): void {
  const {
    actions,
    canDisengage,
    canSupport,
    canWeaponSwap,
    isCharacterEngaged,
    evaluateObjectiveActions,
    shouldDisengage,
    getEngagedEnemies,
    createDisengageAction,
    evaluateSupportActions,
    evaluateWeaponSwapActions,
  } = params;

  // Objective-marker interactions are evaluated before other non-combat actions.
  actions.push(...evaluateObjectiveActions());

  if (canDisengage && isCharacterEngaged() && shouldDisengage()) {
    const enemies = getEngagedEnemies();
    for (const enemy of enemies) {
      actions.push(createDisengageAction(enemy));
    }
  }

  if (canSupport) {
    actions.push(...evaluateSupportActions());
  }

  if (canWeaponSwap) {
    actions.push(...evaluateWeaponSwapActions());
  }
}

export function buildAttackActions(params: BuildAttackActionsParams): MutableScoredAction[] {
  const {
    context,
    attackTargets,
    canCloseCombat,
    canMove,
    canRangedCombat,
    loadout,
    doctrinePlanning,
    doctrineEngagement,
    objectiveActionPressure,
    attackPressure,
    characterPos,
    isFreeAtStart,
    canAffordImmediateMeleeAttack,
    canAffordImmediateChargeAttack,
    engagedMeleeAttackApCost,
    hasChargeTraitMeleeWeapon,
    assessMeleeLegality,
    evaluateBonusActions,
    evaluateChargeOpportunity,
    evaluateRangedOpportunity,
    countFriendlyInMeleeRange,
    countEnemyInMeleeRange,
    qualifiesForMultipleWeapons,
    getMultipleWeaponsBonus,
  } = params;

  const attackActions: MutableScoredAction[] = [];
  for (const target of attackTargets) {
    if (canCloseCombat) {
      const meleeLegality = assessMeleeLegality(target.target, isFreeAtStart);
      if (meleeLegality.canAttack) {
        if (!canAffordImmediateMeleeAttack) {
          continue;
        }
        let score = target.score * 1.2;
        if (!loadout.hasMeleeWeapons && loadout.hasRangedWeapons) {
          // Ranged-only models generally should avoid base-contact fights.
          score *= 0.55;
        } else if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) {
          score *= 1.2;
        }
        if (doctrineEngagement === 'melee') {
          score *= 1.15;
        } else if (doctrineEngagement === 'ranged') {
          score *= 0.82;
        }
        if (doctrinePlanning === 'keys_to_victory') {
          score *= Math.max(0.72, 1 - objectiveActionPressure * 0.22);
        } else if (doctrinePlanning === 'aggression') {
          score *= 1.08;
        }
        if (meleeLegality.requiresOverreach) {
          // Overreach trades legality for risk (-1 REF / -1 hit modifier).
          score *= 0.9;
        } else if (meleeLegality.requiresReach) {
          score *= 1.02;
        }
        score *= attackPressure;

        // Multiple Weapons bonus consideration for melee.
        if (qualifiesForMultipleWeapons(true)) {
          const bonus = getMultipleWeaponsBonus(true);
          score += bonus * 0.3;
        }

        // Priority 1: Bonus Action potential (Push-back, Pull-back, Reversal).
        const bonusActionEval = evaluateBonusActions(target.target, characterPos);
        if (bonusActionEval.score > 0) {
          score += bonusActionEval.score * 0.5;
        }

        attackActions.push({
          action: 'close_combat',
          target: target.target,
          score,
          factors: {
            ...target.factors,
            multipleWeapons: qualifiesForMultipleWeapons(true) ? 1 : 0,
            meleeAttackApCost: engagedMeleeAttackApCost,
            meleeRequiresReach: meleeLegality.requiresReach ? 1 : 0,
            meleeRequiresOverreach: meleeLegality.requiresOverreach ? 1 : 0,
          },
        });
      } else if (canMove) {
        // Charge = move into base contact + immediate close combat pressure.
        const chargeOpportunity = evaluateChargeOpportunity(target.target);
        if (chargeOpportunity.canCharge && chargeOpportunity.destination && canAffordImmediateChargeAttack) {
          let score = target.score * 1.16;
          if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) {
            score *= 1.1;
          }
          if (doctrineEngagement === 'melee') {
            score *= 1.12;
          } else if (doctrineEngagement === 'ranged') {
            score *= 0.9;
          }
          if (doctrinePlanning === 'aggression') {
            score *= 1.08;
          }
          score *= attackPressure;
          if (hasChargeTraitMeleeWeapon) {
            score *= 1.08;
          }

          attackActions.push({
            action: 'charge',
            target: target.target,
            position: chargeOpportunity.destination,
            score,
            factors: {
              ...target.factors,
              chargeDistance: chargeOpportunity.travelDistance,
              chargeRemainingGap: chargeOpportunity.remainingGap,
              chargeApproachValue: chargeOpportunity.travelDistance > 0 ? 1 : 0,
              chargeTraitWeapon: hasChargeTraitMeleeWeapon ? 1 : 0,
              chargeAttackApCost: engagedMeleeAttackApCost,
            },
          });
        }
      }
    }

    if (canRangedCombat) {
      // Check if in range for ranged attack using session visibility + ORM logic.
      const rangedOpportunity = evaluateRangedOpportunity(target.target);
      if (rangedOpportunity.canAttack) {
        let score = target.score;

        // Multiple Weapons bonus consideration.
        if (qualifiesForMultipleWeapons(false)) {
          const bonus = getMultipleWeaponsBonus(false);
          score += bonus * 0.3;
        }
        // Heavier ORM penalties make long, low-probability shots less dominant.
        score *= 1 / (1 + (rangedOpportunity.orm * 0.35));
        if (rangedOpportunity.requiresConcentrate && characterPos) {
          // Priority 3: Prefer Concentrate + Attack when outnumbered.
          const friendsNearby = countFriendlyInMeleeRange(characterPos, 1.5);
          const enemiesNearby = countEnemyInMeleeRange(characterPos, 1.5);
          const isOutnumbered = enemiesNearby > friendsNearby;

          if (isOutnumbered) {
            // Concentrate removes opposing outnumber wild-die pressure.
            score *= 1.4;
          } else {
            score *= 0.8;
          }
        }
        if (rangedOpportunity.leanOpportunity) {
          score += 1.2;
        }
        if (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons) {
          score *= 1.12;
        } else if (!loadout.hasRangedWeapons && loadout.hasMeleeWeapons) {
          score *= 0.75;
        }
        if (doctrineEngagement === 'ranged') {
          score *= 1.12;
        } else if (doctrineEngagement === 'melee') {
          score *= 0.86;
        }
        if (doctrinePlanning === 'keys_to_victory') {
          score *= Math.max(0.72, 1 - objectiveActionPressure * 0.2);
        } else if (doctrinePlanning === 'aggression') {
          score *= 1.06;
        }
        score *= attackPressure;

        attackActions.push({
          action: 'ranged_combat',
          target: target.target,
          score,
          factors: {
            ...target.factors,
            multipleWeapons: qualifiesForMultipleWeapons(false) ? 1 : 0,
            requiresConcentrate: rangedOpportunity.requiresConcentrate ? 1 : 0,
            orm: rangedOpportunity.orm,
            leanOpportunity: rangedOpportunity.leanOpportunity ? 1 : 0,
          },
        });
      }
    }
  }

  return attackActions;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildPushingAction(
  params: BuildPushingActionParams
): MutableScoredAction | null {
  const {
    context,
    finalActions,
    canPush,
    loadout,
    hasChargeTraitMeleeWeapon,
    candidateEnemyCount,
    characterPos,
    evaluateCoverAtPosition,
    countEnemyInMeleeRange,
    countFriendlyInMeleeRange,
    getInteractableObjectiveMarkerCount,
    canChargeAnyEnemy,
  } = params;

  if (!canPush) {
    return null;
  }

  const actionCount = finalActions.filter(action =>
    ['move', 'close_combat', 'ranged_combat'].includes(action.action) && action.score > 0.3
  ).length;
  const topActionScore = finalActions[0]?.score ?? 0;
  const secondActionScore = finalActions[1]?.score ?? 0;
  const hasImportantTarget = finalActions.some(action =>
    (action.action === 'close_combat' || action.action === 'ranged_combat') &&
    action.score > 0.7 &&
    action.target &&
    ((action.target.profile?.archetype as any) === 'Elite' ||
      (action.target.profile?.archetype as any) === 'Veteran' ||
      action.factors?.isOutnumbered)
  );
  const needsMovement = finalActions.some(action =>
    action.action === 'move' && action.score > 0.5
  );

  const couldHide = !context.character.state.isHidden &&
    (context.character.profile?.items?.some(item =>
      (item.classification || item.class || '').toLowerCase().includes('range') ||
      (item.classification || item.class || '').toLowerCase().includes('bow')
    ) ?? false);

  let enemiesNearby = 0;
  let isInCover = false;
  if (characterPos) {
    enemiesNearby = context.enemies.filter(enemy => {
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) return false;
      const distance = Math.hypot(characterPos.x - enemyPos.x, characterPos.y - enemyPos.y);
      return distance <= 16;
    }).length;
    isInCover = evaluateCoverAtPosition(characterPos) > 0;
  }
  const couldBenefitFromHiding = couldHide && enemiesNearby > 0 && isInCover;

  const sideHasIP = (context.side?.state.initiativePoints ?? 0) >= 1;
  const ipAggressionBonus = sideHasIP ? 0.3 : 0;
  const doctrine = context.config.tacticalDoctrine ?? TacticalDoctrine.Operative;
  const stratagemModifiers = calculateStratagemModifiers(doctrine);
  const doctrinePushBonus = stratagemModifiers.pushAdvantage ? 0.3 : 0;

  const isInGoodPosition = !context.battlefield.isEngaged?.(context.character) ||
    (characterPos !== undefined &&
      countEnemyInMeleeRange(characterPos, 1.5) <= countFriendlyInMeleeRange(characterPos, 1.5));

  let pushScore = 0;
  if (context.apRemaining === 0) {
    const hasImmediateOpportunity =
      candidateEnemyCount > 0 ||
      getInteractableObjectiveMarkerCount() > 0;
    pushScore += hasImmediateOpportunity ? 0.65 : 0.35;
    if (context.scoringContext && !context.scoringContext.amILeading) {
      pushScore += 0.25;
    }
  }

  if (actionCount >= 2) {
    pushScore += (topActionScore + secondActionScore) * 0.6;
  } else if (actionCount === 1) {
    pushScore += topActionScore * 0.4;
  }
  if (hasImportantTarget) {
    pushScore += 0.5;
  }
  if (needsMovement) {
    pushScore += 0.3;
  }
  if (couldBenefitFromHiding) {
    pushScore += 0.6;
    if (enemiesNearby >= 2) {
      pushScore += 0.2;
    }
  }
  if (sideHasIP) {
    pushScore += ipAggressionBonus;
  }
  if (doctrinePushBonus > 0) {
    pushScore += doctrinePushBonus;
  }

  let pushingChargePenalty = 0;
  let pushingChargeBonus = 0;
  let pushingEnablesCharge = false;
  if (context.apRemaining === 1 && loadout.hasMeleeWeapons && !context.battlefield.isEngaged?.(context.character)) {
    pushingEnablesCharge = canChargeAnyEnemy();
    if (pushingEnablesCharge) {
      if (hasChargeTraitMeleeWeapon) {
        pushingChargeBonus = 0.22;
      } else {
        pushingChargePenalty = -0.65;
      }
    }
  }
  pushScore += pushingChargePenalty + pushingChargeBonus;

  if (!isInGoodPosition) {
    pushScore *= 0.5;
  }

  const delayTokenCost = sideHasIP ? -0.1 : -0.2;
  pushScore += delayTokenCost;
  const minPushThreshold = context.apRemaining === 0 ? 0.05 : 0.2;
  if (pushScore <= minPushThreshold) {
    return null;
  }

  return {
    action: 'pushing',
    score: pushScore,
    factors: {
      actionCount,
      hasImportantTarget: hasImportantTarget ? 1 : 0,
      needsMovement: needsMovement ? 1 : 0,
      couldBenefitFromHiding: couldBenefitFromHiding ? 1 : 0,
      sideHasIP: sideHasIP ? 1 : 0,
      enemiesNearby,
      isInCover: isInCover ? 1 : 0,
      isInGoodPosition: isInGoodPosition ? 1 : 0,
      concentrateBenefit: hasImportantTarget ? 0.5 : 0,
      hideBenefit: couldBenefitFromHiding ? 0.6 : 0,
      ipAggressionBonus,
      doctrinePushBonus,
      pushingEnablesCharge: pushingEnablesCharge ? 1 : 0,
      pushingChargePenalty,
      pushingChargeBonus,
      hasChargeTraitMeleeWeapon: hasChargeTraitMeleeWeapon ? 1 : 0,
      delayTokenCost,
    },
  };
}

export function buildWaitAction(params: BuildWaitActionParams): MutableScoredAction | null {
  const {
    context,
    canWait,
    attackActions,
    moveActions,
    moveCandidatePositions,
    loadout,
    doctrinePlanning,
    waitPressure,
    objectiveActionPressure,
    evaluateWaitTacticalConditions,
  } = params;

  if (!canWait) {
    return null;
  }

  const waitForecast = forecastWaitReact(context);
  const exposure = waitForecast.exposureCount;
  const potentialReactTargets = waitForecast.potentialReactTargets;
  const refBreakpointCount = waitForecast.refGatePassCount;

  // Cap react-related bonuses to prevent runaway Wait scores.
  const gameSize = context.config.gameSize || 'SMALL';
  const sizeMultiplier = {
    VERY_SMALL: 0.5,
    SMALL: 1.0,
    MEDIUM: 1.5,
    LARGE: 2.0,
    VERY_LARGE: 2.5,
  }[gameSize] || 1.0;

  const cappedRefBreakpoints = Math.min(refBreakpointCount, Math.round(3 * sizeMultiplier));
  const cappedReactTargets = Math.min(potentialReactTargets, Math.round(4 * sizeMultiplier));
  const waitRefBonus =
    (cappedRefBreakpoints * 0.78) +
    (Math.max(0, cappedReactTargets - cappedRefBreakpoints) * 0.2);

  const existingDelay = Math.max(0, context.character.state.delayTokens ?? 0);
  const waitDelayAvoidance = waitForecast.potentialReactTargets > 0
    ? Math.min(1.8, 0.3 + (waitForecast.expectedTriggerCount * 0.5) + (existingDelay * 0.25))
    : 0;

  const alliesOnWait = context.allies.filter(ally =>
    ally.state.isWaiting &&
    ally.state.isAttentive &&
    ally.state.isOrdered &&
    !ally.state.isKOd &&
    !ally.state.isEliminated
  ).length;
  const waitCoordinationBonus = alliesOnWait > 0 ? alliesOnWait * 0.5 : 0;

  let waitTacticalBonus =
    evaluateWaitTacticalConditions(waitForecast, attackActions) + waitCoordinationBonus;

  const missionId = context.config.missionId;
  const currentTurn = context.currentTurn ?? 1;
  const eliminationWaitPenalty = missionId === 'QAI_11' ? 1.5 : 0;

  const sideVP = context.side?.state.victoryPoints ?? 0;
  const sideRP = context.side?.state.resourcePoints ?? 0;
  const vpBySide = context.vpBySide ?? {};
  const rpBySide = context.rpBySide ?? {};
  const opponentVP = Object.entries(vpBySide)
    .filter(([sideId]) => sideId !== context.sideId)
    .reduce((max, [, vp]) => Math.max(max, vp), 0);
  const opponentRP = Object.entries(rpBySide)
    .filter(([sideId]) => sideId !== context.sideId)
    .reduce((max, [, rp]) => Math.max(max, rp), 0);
  const vpDeficit = Math.max(0, opponentVP - sideVP);
  const rpDeficit = Math.max(0, opponentRP - sideRP);

  if (vpDeficit > 0) {
    const vpPursuitPenalty = vpDeficit * 3;
    waitTacticalBonus = Math.max(-10, waitTacticalBonus - vpPursuitPenalty);
  }

  if (vpDeficit === 0 && rpDeficit > 0) {
    const rpPursuitPenalty = rpDeficit * 1.5;
    waitTacticalBonus = Math.max(-5, waitTacticalBonus - rpPursuitPenalty);
  }

  if (sideVP > opponentVP) {
    const vpLead = sideVP - opponentVP;
    if (vpLead <= 2) {
      waitTacticalBonus += vpLead * 0.5;
    } else {
      waitTacticalBonus += 1 + (vpLead - 2) * 0.3;
    }
  }

  let zeroVpDesperation = 0;
  if (missionId === 'QAI_11' && sideVP === 0 && sideRP === 0 && currentTurn >= 4) {
    if (currentTurn >= 8) {
      zeroVpDesperation = 20;
    } else if (currentTurn >= 6) {
      zeroVpDesperation = 12;
    } else {
      zeroVpDesperation = 8;
    }
  }

  const hasAttackOption = attackActions.length > 0;
  const bestAttackScore = attackActions[0]?.score ?? 0;
  const bestMoveScore = moveActions.reduce((best, candidate) => Math.max(best, candidate.score), 0);

  const waitMissionBias = waitPressure + (
    doctrinePlanning === 'keys_to_victory'
      ? objectiveActionPressure * 0.35
      : 0
  );
  const waitBaseline =
    2.15 +
    (hasAttackOption ? 0 : 0.9) +
    (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons ? 0.55 : 0.2) +
    (context.config.caution * 1.9) +
    (exposure * 0.22) +
    waitRefBonus +
    waitDelayAvoidance +
    waitMissionBias +
    waitTacticalBonus -
    eliminationWaitPenalty -
    zeroVpDesperation;

  const immediateScore = hasAttackOption ? bestAttackScore : Math.max(0.5, bestMoveScore * 0.85);
  const waitRollout = rolloutWaitReactBranches(context, {
    immediateScore,
    waitBaseline,
    moveCandidates: moveCandidatePositions.slice(0, 3),
    maxMoveCandidates: 3,
  });

  const immediateBranchScore =
    waitRollout.branches.find(branch => branch.id === 'immediate_action')?.score ??
    immediateScore;
  const moveThenWaitBranchScore =
    waitRollout.branches.find(branch => branch.id === 'move_then_wait')?.score ??
    bestMoveScore;
  const waitBranch = waitRollout.branches.find(branch => branch.id === 'wait_now');
  const waitBranchScore = waitBranch?.score ?? waitBaseline;
  const waitBranchForecast = waitBranch?.forecast ?? waitForecast;
  const hiddenRevealTargets = waitBranchForecast.hiddenRevealTargets;
  const waitTriggerForecast = waitBranchForecast.expectedTriggerCount;
  const waitExpectedReactValue = waitBranchForecast.expectedReactValue;
  const waitGoapBranchScore = Math.max(0, waitBranchScore - waitBaseline);
  const preferredBranch = waitRollout.preferred.id;
  const preferredBranchScore = waitRollout.preferred.score;

  const threshold = (
    hiddenRevealTargets > 0 ||
    waitRefBonus + waitDelayAvoidance + waitGoapBranchScore >= 1.15
  ) ? 0.62 : 0.76;
  const beatsImmediate = !hasAttackOption || waitBranchScore >= immediateBranchScore * threshold;
  const branchTolerance = preferredBranch === 'wait_now' ? 1 : 0.95;
  const closeToBestBranch = waitBranchScore >= preferredBranchScore * branchTolerance;
  if (!beatsImmediate || !closeToBestBranch) {
    return null;
  }

  return {
    action: 'wait',
    score: waitBranchScore,
    factors: {
      passiveReadiness: 1,
      caution: context.config.caution,
      exposure,
      hiddenRevealTargets,
      potentialReactTargets,
      refBreakpointCount,
      waitRefBonus,
      waitDelayAvoidance,
      waitExpectedTriggerCount: waitTriggerForecast,
      waitExpectedReactValue,
      waitBaselineScore: waitBaseline,
      waitGoapBranchScore,
      immediateBranchScore,
      moveThenWaitBranchScore,
      waitBranchScore,
      rolloutPreferredScore: preferredBranchScore,
      preferredBranchWaitNow: preferredBranch === 'wait_now' ? 1 : 0,
      preferredBranchMoveThenWait: preferredBranch === 'move_then_wait' ? 1 : 0,
      preferredBranchImmediateAction: preferredBranch === 'immediate_action' ? 1 : 0,
      objectivePressure: objectiveActionPressure,
      waitMissionBias,
    },
  };
}

export function buildRefreshAction(
  context: AIContext,
  canRefresh: boolean
): MutableScoredAction | null {
  const hasDelayTokens = (context.character.state.delayTokens ?? 0) > 0;
  const sideHasIP = (context.side?.state.initiativePoints ?? 0) >= 1;
  if (!canRefresh || !hasDelayTokens || !sideHasIP) {
    return null;
  }

  const delayTokenCount = context.character.state.delayTokens ?? 0;
  const isEngaged = context.battlefield.isEngaged?.(context.character) ?? false;
  const hasExcessIP = (context.side?.state.initiativePoints ?? 0) > 2;
  const isRanged = context.character.profile?.items?.some(item =>
    (item.classification || item.class || '').toLowerCase().includes('range') ||
    (item.classification || item.class || '').toLowerCase().includes('bow')
  ) ?? false;
  const couldBenefitFromActingSooner = isRanged || isEngaged;

  const doctrine = context.config.tacticalDoctrine ?? TacticalDoctrine.Operative;
  const stratagemModifiers = calculateStratagemModifiers(doctrine);
  let doctrineIPModifier = 0;
  if (stratagemModifiers.pushAdvantage) {
    doctrineIPModifier = 0.2;
  } else if (doctrine === TacticalDoctrine.Commander ||
             doctrine === TacticalDoctrine.Defender) {
    doctrineIPModifier = -0.3;
  }

  let refreshScore = 0;
  refreshScore += delayTokenCount * 0.5;
  if (isEngaged) {
    refreshScore += 0.5;
  }
  if (isRanged && !isEngaged) {
    refreshScore += 0.4;
  }
  if (hasExcessIP) {
    refreshScore += 0.3;
  }
  if (couldBenefitFromActingSooner) {
    refreshScore += 0.2;
  }
  refreshScore += doctrineIPModifier;
  if (refreshScore <= 0.2) {
    return null;
  }

  return {
    action: 'refresh',
    score: refreshScore,
    factors: {
      delayTokenCount,
      isEngaged: isEngaged ? 1 : 0,
      isRanged: isRanged ? 1 : 0,
      hasExcessIP: hasExcessIP ? 1 : 0,
      couldBenefitFromActingSooner: couldBenefitFromActingSooner ? 1 : 0,
      doctrineIPModifier,
      ipCost: -0.1,
    },
  };
}

export function applyEliminationApproachPressure<T extends MutableScoredAction>(
  actions: T[],
  attackActionsCount: number,
  nearestEnemyDistance: number,
  missionIdRaw: string | undefined
): void {
  const missionId = String(missionIdRaw ?? '').toUpperCase();
  const isEliminationPressureMission =
    missionId === 'ELIMINATION' ||
    missionId === 'QAI_11' ||
    missionId === 'QAI_17' ||
    missionId === 'QAI_18';
  if (
    !isEliminationPressureMission ||
    attackActionsCount > 0 ||
    !Number.isFinite(nearestEnemyDistance) ||
    nearestEnemyDistance <= 2.5
  ) {
    return;
  }

  const movePressureBonus = 1.15 + Math.min(1.4, Math.max(0, nearestEnemyDistance - 2.5) * 0.08);
  for (const action of actions) {
    if (action.action === 'move') {
      const approachDeltaMu = Number(action.factors?.approachDeltaMu ?? 0);
      const approachNormalizedDelta = Number(action.factors?.approachNormalizedDelta ?? 0);
      const approachPressureBonus =
        (Math.max(0, approachDeltaMu) * 1.25) +
        (Math.max(0, approachNormalizedDelta) * 0.9);
      const approachRetreatPenalty = approachDeltaMu < 0
        ? Math.abs(approachDeltaMu) * 2.4
        : 0;
      action.score += movePressureBonus + approachPressureBonus - approachRetreatPenalty;
      action.factors = {
        ...action.factors,
        eliminationApproachPressure: movePressureBonus,
        eliminationApproachDeltaMu: approachDeltaMu,
        eliminationApproachBonus: approachPressureBonus,
        eliminationApproachRetreatPenalty: -approachRetreatPenalty,
      };
      continue;
    }
    if (
      action.action === 'wait' ||
      action.action === 'hide' ||
      action.action === 'detect' ||
      action.action === 'hold' ||
      action.action === 'fiddle'
    ) {
      action.score -= 1.35;
      action.factors = {
        ...action.factors,
        eliminationApproachPenalty: -1.35,
      };
    }
  }
}

export function applyDoctrineScoringModifiers<T extends MutableScoredAction>(
  params: ApplyDoctrineScoringModifiersParams<T>
): T[] {
  const {
    actions,
    context,
    applyCombinedModifiers,
  } = params;
  const doctrine = context.config.tacticalDoctrine ?? TacticalDoctrine.Operative;
  const stratagemModifiers = calculateStratagemModifiers(doctrine);

  if (!context.scoringContext) {
    return applyCombinedModifiers(actions, stratagemModifiers, DEFAULT_SCORING_MODIFIERS);
  }

  const scoringContext = buildScoringContext(
    context.scoringContext.myKeyScores,
    context.scoringContext.opponentKeyScores,
    {
      totalVPPool: 5,
      hasRPToVPConversion: false,
      currentTurn: context.currentTurn ?? 1,
      maxTurns: context.maxTurns ?? 6,
      endGameTurn: context.endGameTurn ?? context.scoringContext.predictorEndGameTurn,
    }
  );
  const scoringModifiers = calculateScoringModifiers(scoringContext);
  return applyCombinedModifiers(actions, stratagemModifiers, scoringModifiers);
}

export function applyModifiersAndAppendTempoActions<T extends MutableScoredAction>(
  params: ApplyModifiersAndAppendTempoActionsParams<T>
): T[] {
  const {
    actions,
    context,
    canPush,
    canRefresh,
    loadout,
    hasChargeTraitMeleeWeapon,
    candidateEnemyCount,
    characterPos,
    applyCombinedModifiers,
    evaluateCoverAtPosition,
    countEnemyInMeleeRange,
    countFriendlyInMeleeRange,
    getInteractableObjectiveMarkerCount,
    canChargeAnyEnemy,
  } = params;
  const finalActions = applyDoctrineScoringModifiers({
    actions,
    context,
    applyCombinedModifiers,
  });
  finalActions.sort((a, b) => b.score - a.score);

  const pushingAction = buildPushingAction({
    context,
    finalActions,
    canPush,
    loadout,
    hasChargeTraitMeleeWeapon,
    candidateEnemyCount,
    characterPos,
    evaluateCoverAtPosition,
    countEnemyInMeleeRange,
    countFriendlyInMeleeRange,
    getInteractableObjectiveMarkerCount,
    canChargeAnyEnemy,
  });
  if (pushingAction) {
    finalActions.push(pushingAction as T);
  }

  const refreshAction = buildRefreshAction(context, canRefresh);
  if (refreshAction) {
    finalActions.push(refreshAction as T);
  }

  return finalActions;
}

export function finalizeActionScores<T extends MutableScoredAction>(
  params: FinalizeActionScoresParams<T>
): T[] {
  const {
    actions,
    context,
    fractionalPotential,
    evaluateActionFractionalScoring,
  } = params;
  let finalActions = actions;

  // Fallback: if no valid actions, add a hold action.
  if (finalActions.length === 0) {
    finalActions = [{
      action: 'hold',
      score: 0.1,
      factors: {},
    } as T];
  }

  finalActions = applyVpUrgencyAdjustments(finalActions, context);
  applyFractionalScoringAdjustments(
    finalActions,
    fractionalPotential,
    evaluateActionFractionalScoring
  );
  finalActions.sort((a, b) => b.score - a.score);
  return finalActions;
}

export function applyVpUrgencyAdjustments<T extends MutableScoredAction>(
  actions: T[],
  context: AIContext
): T[] {
  const myVP = context.vpBySide?.[context.sideId ?? ''] ?? 0;
  const enemyVP = Object.entries(context.vpBySide ?? {})
    .filter(([sid]) => sid !== context.sideId)
    .reduce((max, [, vp]) => Math.max(max, vp), 0);
  const currentTurn = context.currentTurn ?? 1;
  const maxTurns = context.maxTurns ?? 6;
  const endGameTurn = Number.isFinite(context.endGameTurn)
    ? Number(context.endGameTurn)
    : Number.isFinite(context.scoringContext?.predictorEndGameTurn)
      ? Number(context.scoringContext?.predictorEndGameTurn)
      : undefined;
  const expectedTurnsRemaining = estimateExpectedTurnsRemaining(currentTurn, maxTurns, endGameTurn);
  const effectiveMaxTurns = Math.max(currentTurn, Math.round((currentTurn - 1) + expectedTurnsRemaining));

  const vpUrgency = calculateVPUrgency(myVP, enemyVP, currentTurn, effectiveMaxTurns);
  let filtered = actions;
  if (vpUrgency.urgencyLevel === 'desperate' || vpUrgency.urgencyLevel === 'high') {
    filtered = filterActionsByVP(filtered, vpUrgency, 0.0);
  }

  for (const action of filtered) {
    const vpInfo = getActionVPInfo(
      action.action,
      action.target !== undefined,
      true
    );
    const vpScore = scoreActionByVP(action, vpUrgency);

    if (vpInfo.isPassiveAction && myVP === 0 && currentTurn >= 3) {
      const passivePenalty = getPassiveActionPenalty(vpUrgency.urgencyLevel, currentTurn, myVP);
      action.score = Math.max(0, action.score + passivePenalty);
    }

    action.score += vpScore;
    action.factors = {
      ...action.factors,
      vpUrgencyLevel: vpUrgency.urgencyLevel === 'high' ? 3 : vpUrgency.urgencyLevel === 'medium' ? 2 : 1,
      vpDeficit: vpUrgency.vpDeficit,
      vpScore,
      myVP,
      enemyVP,
    };
  }

  return filtered;
}

export function applyFractionalScoringAdjustments<T extends MutableScoredAction>(
  actions: T[],
  scoringPotential: FractionalScoringPotential,
  evaluateActionFractionalScoring: (
    action: T,
    scoringPotential: FractionalScoringPotential
  ) => ActionFractionalScoringBreakdown
): void {
  for (const action of actions) {
    const fractional = evaluateActionFractionalScoring(action, scoringPotential);
    action.score += fractional.total;
    action.factors = {
      ...action.factors,
      fractionalVpPotential: fractional.vpPotential,
      fractionalVpDenial: fractional.vpDenial,
      fractionalRpPotential: fractional.rpPotential,
      fractionalRpDenial: fractional.rpDenial,
      scoringUrgencyScalar: scoringPotential.urgencyScalar,
      scoringPotentialDelta: scoringPotential.vpPotentialDelta,
    };
  }
}
