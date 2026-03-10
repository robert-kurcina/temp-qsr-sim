import { Character } from '../../core/Character';

type AttackDecisionType = 'charge' | 'close_combat' | 'ranged_combat';

export interface SideCoordinatorLike {
  clearTargetCommitment(targetId: string): void;
  recordTargetCommitment(
    targetId: string,
    attackerId: string,
    currentTurn: number,
    weight: number,
    actionType?: string,
    topologySignature?: string
  ): void;
}

export interface SideCoordinatorManagerHost {
  getSideCoordinatorManager(): {
    getCoordinator(sideId: string): SideCoordinatorLike | undefined;
  } | null | undefined;
}

export interface TargetStateSnapshot {
  isKOd?: boolean;
  isEliminated?: boolean;
}

export interface UpdateSideTargetCommitmentParams {
  coordinatorHost: SideCoordinatorManagerHost;
  sideId: string;
  attacker: Character;
  target: Character;
  actionType: string;
  actionExecuted: boolean;
  turn: number;
  targetStateAfter?: TargetStateSnapshot;
  topologySignature?: string;
}

export function isAttackDecisionType(type: string): type is AttackDecisionType {
  return type === 'close_combat' || type === 'charge' || type === 'ranged_combat';
}

export function getTargetCommitmentWeight(actionType: string, actionExecuted: boolean): number {
  const baseWeight =
    actionType === 'charge'
      ? 1.2
      : actionType === 'close_combat'
        ? 1.0
        : actionType === 'ranged_combat'
          ? 0.9
          : 0;
  if (baseWeight <= 0) return 0;
  return actionExecuted ? baseWeight : baseWeight * 0.2;
}

function isTargetOutOfPlay(target: Character, targetStateAfter?: TargetStateSnapshot): boolean {
  return Boolean(
    targetStateAfter?.isKOd ||
    targetStateAfter?.isEliminated ||
    target.state.isKOd ||
    target.state.isEliminated
  );
}

export function updateSideTargetCommitment(params: UpdateSideTargetCommitmentParams): void {
  const {
    coordinatorHost,
    sideId,
    attacker,
    target,
    actionType,
    actionExecuted,
    turn,
    targetStateAfter,
    topologySignature,
  } = params;
  const coordinatorManager = coordinatorHost.getSideCoordinatorManager();
  if (!coordinatorManager) return;
  const coordinator = coordinatorManager.getCoordinator(sideId);
  if (!coordinator) return;

  if (isTargetOutOfPlay(target, targetStateAfter)) {
    coordinator.clearTargetCommitment(target.id);
    return;
  }

  const commitmentWeight = getTargetCommitmentWeight(actionType, actionExecuted);
  if (commitmentWeight <= 0) return;

  coordinator.recordTargetCommitment(
    target.id,
    attacker.id,
    turn,
    commitmentWeight,
    actionType,
    topologySignature
  );
}
