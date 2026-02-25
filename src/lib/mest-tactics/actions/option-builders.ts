import { Item } from '../core/Item';
import { Character } from '../core/Character';
import { buildBonusActionOptions } from './bonus-actions';
import { buildReactOptions, ReactEvent, ReactOption, sortReactOptions } from './react-actions';
import { buildPassiveOptions, PassiveEvent, PassiveOption, buildActiveToggleOptions, ActiveToggleOption } from '../status/passive-options';

export function getPassiveOptions(event: PassiveEvent): PassiveOption[] {
  return buildPassiveOptions(event);
}

export function getActiveToggleOptions(params: { attacker: Character; weapon?: Item; isEngaged?: boolean }): ActiveToggleOption[] {
  return buildActiveToggleOptions(params);
}

export function getBonusActionOptions(context: Parameters<typeof buildBonusActionOptions>[0]) {
  return buildBonusActionOptions(context);
}

export function getReactOptions(event: ReactEvent): ReactOption[] {
  return buildReactOptions(event);
}

export function getReactOptionsSorted(event: ReactEvent): ReactOption[] {
  return sortReactOptions(buildReactOptions(event));
}
