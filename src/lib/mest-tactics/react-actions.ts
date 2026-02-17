import { Character } from './Character';
import { Battlefield } from './battlefield/Battlefield';
import { SpatialRules } from './battlefield/spatial-rules';
import { getBaseDiameterFromSiz } from './battlefield/size-utils';

export type ReactTriggerType = 'Move' | 'NonMove';

export interface ReactEvent {
  battlefield: Battlefield;
  active: Character;
  opponents: Character[];
  trigger: ReactTriggerType;
  movedDistance?: number;
  reactingToReact?: boolean;
  isGroupAction?: boolean;
}

export interface ReactOption {
  actor: Character;
  target: Character;
  type: 'Overwatch' | 'ReactAction';
  available: boolean;
  requiredRef: number;
  effectiveRef: number;
  reason?: string;
}

export function sortReactOptions(options: ReactOption[]): ReactOption[] {
  return [...options].sort((a, b) => {
    if (b.effectiveRef !== a.effectiveRef) return b.effectiveRef - a.effectiveRef;
    const bInit = b.actor.initiative ?? 0;
    const aInit = a.actor.initiative ?? 0;
    if (bInit !== aInit) return bInit - aInit;
    return a.actor.name.localeCompare(b.actor.name);
  });
}

export function buildReactOptions(event: ReactEvent): ReactOption[] {
  const options: ReactOption[] = [];
  const activePos = event.battlefield.getCharacterPosition(event.active);
  if (!activePos) return options;
  const activeRef = event.active.finalAttributes.ref ?? event.active.attributes.ref ?? 0;
  const activeMov = event.active.finalAttributes.mov ?? event.active.attributes.mov ?? 0;
  const activeBase = getBaseDiameterFromSiz(event.active.finalAttributes.siz ?? event.active.attributes.siz ?? 3);
  const movedDistance = event.movedDistance ?? 0;
  const requiresMovementTrigger = movedDistance >= activeBase / 2;

  for (const opponent of event.opponents) {
    if (!opponent.state.isWaiting) {
      options.push({
        actor: opponent,
        target: event.active,
        type: event.trigger === 'Move' ? 'Overwatch' : 'ReactAction',
        available: false,
        requiredRef: 0,
        effectiveRef: 0,
        reason: 'Requires Wait status.',
      });
      continue;
    }
    const opponentPos = event.battlefield.getCharacterPosition(opponent);
    if (!opponentPos) continue;
    const opponentModel = {
      id: opponent.id,
      position: opponentPos,
      baseDiameter: getBaseDiameterFromSiz(opponent.finalAttributes.siz ?? opponent.attributes.siz ?? 3),
      siz: opponent.finalAttributes.siz ?? opponent.attributes.siz ?? 3,
    };
    const activeModel = {
      id: event.active.id,
      position: activePos,
      baseDiameter: activeBase,
      siz: event.active.finalAttributes.siz ?? event.active.attributes.siz ?? 3,
    };
    const hasLOS = SpatialRules.hasLineOfSight(event.battlefield, opponentModel, activeModel);
    if (!hasLOS) {
      options.push({
        actor: opponent,
        target: event.active,
        type: event.trigger === 'Move' ? 'Overwatch' : 'ReactAction',
        available: false,
        requiredRef: 0,
        effectiveRef: 0,
        reason: 'Requires LOS.',
      });
      continue;
    }

    const waitBonus = opponent.state.isWaiting ? 1 : 0;
    const soloBonus = event.isGroupAction ? 1 : 0;
    const effectiveRef = (opponent.finalAttributes.ref ?? opponent.attributes.ref ?? 0) + waitBonus + soloBonus;
    const requiredRefBase = event.trigger === 'Move' ? activeMov : activeRef;
    const requiredRef = requiredRefBase + (event.reactingToReact ? 1 : 0);
    const available = effectiveRef >= requiredRef
      && (event.trigger !== 'Move' || requiresMovementTrigger);
    options.push({
      actor: opponent,
      target: event.active,
      type: event.trigger === 'Move' ? 'Overwatch' : 'ReactAction',
      available,
      requiredRef,
      effectiveRef,
      reason: available
        ? undefined
        : event.trigger === 'Move' && !requiresMovementTrigger
          ? 'Move did not trigger Overwatch threshold.'
          : 'Insufficient REF to React.',
    });
  }

  return options;
}
