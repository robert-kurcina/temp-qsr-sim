export interface SideCoordinatorSignalForTurn {
  sideId: string;
  amILeading: boolean;
  vpMargin: number;
  priority: string;
  potentialDirective?: string;
  pressureDirective?: string;
  urgency: number;
}

export function isCoordinatorUrgentForIp(
  signal: SideCoordinatorSignalForTurn | undefined
): boolean {
  if (!signal) return false;
  if (signal.priority === 'recover_deficit' || signal.priority === 'contest_keys') return true;
  if (signal.potentialDirective === 'expand_potential' || signal.potentialDirective === 'deny_opponent_potential') {
    return true;
  }
  return signal.urgency >= 1.15;
}

export function isCoordinatorDefensiveForIp(
  signal: SideCoordinatorSignalForTurn | undefined
): boolean {
  if (!signal) return false;
  if (signal.potentialDirective === 'protect_current_lead') return true;
  return signal.priority === 'press_advantage' && signal.amILeading && signal.vpMargin >= 2;
}
