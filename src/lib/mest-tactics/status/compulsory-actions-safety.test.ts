import { describe, expect, it } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainElement } from '../battlefield/terrain/TerrainElement';
import { getCompulsoryActions } from './compulsory-actions';

function createCharacter(id: string, mov = 4, siz = 3): Character {
  const profile: Profile = {
    name: id,
    archetype: {
      attributes: {
        cca: 2,
        rca: 2,
        ref: 2,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov,
        siz,
      },
    },
    items: [],
  };
  const character = new Character(profile);
  character.id = id;
  character.finalAttributes = { ...character.attributes };
  return character;
}

describe('compulsory safety resolution', () => {
  it('selects nearest cover safety for Disordered movement when available', () => {
    const battlefield = new Battlefield(20, 20);
    battlefield.addTerrain(new TerrainElement('Shrub', { x: 8, y: 6 }).toFeature());

    const actor = createCharacter('actor', 4, 3);
    const opponent = createCharacter('opponent', 1, 3);
    opponent.finalAttributes.mov = 1;

    battlefield.placeCharacter(actor, { x: 6, y: 6 });
    battlefield.placeCharacter(opponent, { x: 10, y: 6 });

    actor.state.fearTokens = 2;
    actor.refreshStatusFlags();
    actor.state.isInCover = false;

    const actions = getCompulsoryActions(actor, {
      battlefield,
      opponents: [opponent],
      twoApMovementRange: () => 2,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe('Move');
    expect(actions[0].safetyMode).toBe('cover');
    expect(actions[0].safetyTarget).toBeDefined();
  });

  it('selects out-of-LOS safety for Disordered movement when cover is unavailable', () => {
    const battlefield = new Battlefield(20, 20);
    battlefield.addTerrain(new TerrainElement('Medium Wall', { x: 8, y: 6 }).toFeature());

    const actor = createCharacter('actor', 4, 3);
    const opponent = createCharacter('opponent', 1, 3);
    opponent.finalAttributes.mov = 1;

    battlefield.placeCharacter(actor, { x: 6, y: 6 });
    battlefield.placeCharacter(opponent, { x: 10, y: 6 });

    actor.state.fearTokens = 2;
    actor.refreshStatusFlags();
    actor.state.isInCover = false;

    const actions = getCompulsoryActions(actor, {
      battlefield,
      opponents: [opponent],
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe('Move');
    expect(actions[0].safetyMode).toBe('out_of_los');
    expect(actions[0].safetyTarget).toBeDefined();
  });

  it('uses an alternate exit edge for Panicked safety when nearest friendly edge moves toward opposition', () => {
    const battlefield = new Battlefield(20, 20);
    const actor = createCharacter('actor', 4, 3);
    const opponent = createCharacter('opponent', 4, 3);

    battlefield.placeCharacter(actor, { x: 10, y: 10 });
    battlefield.placeCharacter(opponent, { x: 18, y: 10 });

    actor.state.fearTokens = 3;
    actor.refreshStatusFlags();
    actor.state.isInCover = false;

    const actions = getCompulsoryActions(actor, {
      battlefield,
      opponents: [opponent],
      friendlyEntryEdges: ['east'],
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe('Move');
    expect(actions[0].safetyMode).toBe('exit_edge');
    expect(actions[0].safetyEdge).not.toBe('east');
    expect(actions[0].description).toContain('use another edge');
  });

  it('uses nearest friendly entry edge for Panicked safety when it does not move toward opposition', () => {
    const battlefield = new Battlefield(20, 20);
    const actor = createCharacter('actor', 4, 3);
    const opponent = createCharacter('opponent', 4, 3);

    battlefield.placeCharacter(actor, { x: 10, y: 10 });
    battlefield.placeCharacter(opponent, { x: 2, y: 10 });

    actor.state.fearTokens = 3;
    actor.refreshStatusFlags();
    actor.state.isInCover = false;

    const actions = getCompulsoryActions(actor, {
      battlefield,
      opponents: [opponent],
      friendlyEntryEdges: ['east'],
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe('Move');
    expect(actions[0].safetyMode).toBe('exit_edge');
    expect(actions[0].safetyEdge).toBe('east');
    expect(actions[0].description).toContain('nearest friendly entry edge');
  });
});
