import { describe, expect, it } from 'vitest';
import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { buildProfile } from '../../mission/assembly-builder';
import { getTacticallyRelevantEnemies } from './TacticalHeuristics';

function createFighter(id: string): Character {
  const profile = buildProfile('Average', { itemNames: ['Sword, Broad'] });
  const character = new Character(profile);
  character.id = id;
  character.name = id;
  return character;
}

describe('TacticalHeuristics.getTacticallyRelevantEnemies', () => {
  it('returns in-range enemies when present', () => {
    const battlefield = new Battlefield(24, 24, []);
    const actor = createFighter('Actor');
    const nearEnemy = createFighter('NearEnemy');
    const farEnemy = createFighter('FarEnemy');

    battlefield.placeCharacter(actor, { x: 2, y: 2 });
    battlefield.placeCharacter(nearEnemy, { x: 8, y: 2 });
    battlefield.placeCharacter(farEnemy, { x: 22, y: 22 });

    const relevant = getTacticallyRelevantEnemies({
      character: actor,
      allies: [],
      enemies: [nearEnemy, farEnemy],
      allSides: [],
      sideId: 'Alpha',
      battlefield,
      config: {
        visibilityOrMu: 10,
        gameSize: 'SMALL',
        perCharacterFovLos: false,
      },
    });

    expect(relevant.map(enemy => enemy.id)).toEqual(['NearEnemy']);
  });

  it('falls back to nearest known enemies when none are within visibility range', () => {
    const battlefield = new Battlefield(40, 40, []);
    const actor = createFighter('Actor');
    const enemyA = createFighter('EnemyA');
    const enemyB = createFighter('EnemyB');
    const enemyC = createFighter('EnemyC');

    battlefield.placeCharacter(actor, { x: 2, y: 2 });
    battlefield.placeCharacter(enemyA, { x: 20, y: 2 });
    battlefield.placeCharacter(enemyB, { x: 24, y: 2 });
    battlefield.placeCharacter(enemyC, { x: 30, y: 30 });

    const relevant = getTacticallyRelevantEnemies({
      character: actor,
      allies: [],
      enemies: [enemyC, enemyB, enemyA],
      allSides: [],
      sideId: 'Alpha',
      battlefield,
      config: {
        visibilityOrMu: 8,
        gameSize: 'VERY_SMALL',
        perCharacterFovLos: true,
      },
    });

    expect(relevant.map(enemy => enemy.id)).toEqual(['EnemyA', 'EnemyB']);
  });
});
