import { Character } from '../Character';
import { Position } from '../battlefield/Position';
import { TransfixTarget, resolveTransfixEffect } from '../status-system';
import { getBaseDiameterFromSiz } from '../battlefield/size-utils';

export interface TransfixActionDeps {
  battlefield: import('../battlefield/Battlefield').Battlefield | null;
  getCharacterPosition: (character: Character) => Position | undefined;
  transfixUsed: Set<string>;
}

export function executeTransfixAction(
  deps: TransfixActionDeps,
  source: Character,
  targets: Character[],
  options: { rating?: number; testRolls?: Record<string, number[]>; spendDelay?: boolean } = {}
) {
  if (!deps.battlefield) {
    throw new Error('Battlefield not set.');
  }
  const sourcePos = deps.getCharacterPosition(source);
  if (!sourcePos) {
    throw new Error('Missing source position.');
  }
  if (!source.state.isAttentive || !source.state.isOrdered) {
    return [];
  }
  if (deps.transfixUsed.has(source.id)) {
    return [];
  }
  if (options.spendDelay ?? true) {
    source.state.delayTokens += 1;
    source.refreshStatusFlags();
  }
  deps.transfixUsed.add(source.id);

  const targetModels: TransfixTarget[] = targets
    .map(target => {
      const pos = deps.getCharacterPosition(target);
      if (!pos) return null;
      return {
        character: target,
        position: pos,
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz),
      };
    })
    .filter(Boolean) as TransfixTarget[];

  return resolveTransfixEffect(
    deps.battlefield,
    {
      id: source.id,
      character: source,
      position: sourcePos,
      baseDiameter: getBaseDiameterFromSiz(source.finalAttributes.siz),
      siz: source.finalAttributes.siz,
    },
    targetModels,
    { rating: options.rating, testRolls: options.testRolls }
  );
}
