import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Item } from '../../../src/lib/mest-tactics/core/Item';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import {
  shouldUseDefendDeclaredForDoctrine,
  shouldUseTakeCoverDeclaredForDoctrine,
  getPassiveResponsePriorityList,
  scoreCounterChargeObserverForDoctrine,
  buildSpatialModelForCharacter,
  shouldUseLeanForRangedWithCover,
  shouldUseLeanForDetectWithCover,
} from './AIDecisionSupport';

function makeItem(classification: string): Item {
  return { name: classification, classification } as unknown as Item;
}

function makeCharacter(params: {
  id: string;
  attentive?: boolean;
  wounds?: number;
  delay?: number;
  fear?: number;
  items?: Item[];
}): Character {
  const items = params.items ?? [];
  return {
    id: params.id,
    profile: {
      name: params.id,
      archetype: {},
      items,
      equipment: items,
      inHandItems: [],
      stowedItems: [],
    },
    attributes: { siz: 3 },
    finalAttributes: { siz: 3 },
    state: {
      isAttentive: params.attentive ?? true,
      wounds: params.wounds ?? 0,
      delayTokens: params.delay ?? 0,
      fearTokens: params.fear ?? 0,
    },
  } as unknown as Character;
}

describe('AIDecisionSupport runner helper exports', () => {
  it('uses attentive state for declared Defend', () => {
    const attentive = makeCharacter({ id: 'a', attentive: true });
    const distracted = makeCharacter({ id: 'b', attentive: false });

    expect(shouldUseDefendDeclaredForDoctrine(TacticalDoctrine.Operative, 'melee', attentive)).toBe(true);
    expect(shouldUseDefendDeclaredForDoctrine(TacticalDoctrine.Operative, 'ranged', distracted)).toBe(false);
  });

  it('suppresses declared Take Cover for aggressive melee doctrine when not threatened', () => {
    const meleeOnly = makeCharacter({
      id: 'defender',
      items: [makeItem('Melee Sword')],
      wounds: 0,
      delay: 0,
      fear: 0,
    });
    const threatened = makeCharacter({
      id: 'threatened',
      items: [makeItem('Melee Sword')],
      wounds: 1,
      delay: 0,
      fear: 0,
    });

    expect(shouldUseTakeCoverDeclaredForDoctrine(TacticalDoctrine.Juggernaut, meleeOnly)).toBe(false);
    expect(shouldUseTakeCoverDeclaredForDoctrine(TacticalDoctrine.Juggernaut, threatened)).toBe(true);
  });

  it('filters passive response priorities by loadout profile', () => {
    const meleeOnly = makeCharacter({ id: 'm', items: [makeItem('Melee Spear')] });
    const rangedOnly = makeCharacter({ id: 'r', items: [makeItem('Bow')] });

    const meleePriorities = getPassiveResponsePriorityList(TacticalDoctrine.Operative, 'ranged', meleeOnly);
    const rangedPriorities = getPassiveResponsePriorityList(TacticalDoctrine.Operative, 'melee', rangedOnly);

    expect(meleePriorities).not.toContain('CounterFire');
    expect(rangedPriorities).not.toContain('CounterStrike');
  });

  it('builds spatial model from battlefield positions', () => {
    const actor = makeCharacter({ id: 'actor' });
    const battlefield = {
      getCharacterPosition: (c: Character) => (c.id === 'actor' ? { x: 4, y: 6 } : undefined),
    } as unknown as Battlefield;

    const model = buildSpatialModelForCharacter(actor, battlefield);
    expect(model).toBeTruthy();
    expect(model?.position).toEqual({ x: 4, y: 6 });
    expect(model?.baseDiameter).toBeGreaterThan(0);
  });

  it('returns false for lean checks when attacker is not attentive', () => {
    const attacker = makeCharacter({ id: 'attacker', attentive: false });
    const target = makeCharacter({ id: 'target', attentive: true });
    const battlefield = {} as Battlefield;

    expect(shouldUseLeanForRangedWithCover(attacker, target, battlefield)).toBe(false);
    expect(shouldUseLeanForDetectWithCover(attacker, target, battlefield)).toBe(false);
  });

  it('scores closer counter-charge observers higher than distant ones', () => {
    const observer = makeCharacter({ id: 'observer', items: [makeItem('Melee Sword')] });
    const mover = makeCharacter({ id: 'mover' });
    const nearField = {
      getCharacterPosition: (c: Character) => (c.id === 'observer' ? { x: 1, y: 1 } : { x: 4, y: 1 }),
    } as unknown as Battlefield;
    const farField = {
      getCharacterPosition: (c: Character) => (c.id === 'observer' ? { x: 1, y: 1 } : { x: 20, y: 1 }),
    } as unknown as Battlefield;

    const nearScore = scoreCounterChargeObserverForDoctrine(
      TacticalDoctrine.Operative,
      observer,
      mover,
      nearField
    );
    const farScore = scoreCounterChargeObserverForDoctrine(
      TacticalDoctrine.Operative,
      observer,
      mover,
      farField
    );

    expect(nearScore).toBeGreaterThan(farScore);
  });
});
