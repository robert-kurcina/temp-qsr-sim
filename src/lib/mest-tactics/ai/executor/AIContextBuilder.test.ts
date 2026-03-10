import { describe, expect, it } from 'vitest';
import { buildAIContext } from './AIContextBuilder';
import type { AIControllerConfig } from '../core/AIController';
import type { Character } from '../../core/Character';
import type { Battlefield } from '../../battlefield/Battlefield';

function stubCharacter(id: string): Character {
  return { id } as Character;
}

function stubConfig(): AIControllerConfig {
  return {
    aggression: 0.5,
    caution: 0.5,
    accuracyModifier: 0,
    godMode: true,
  };
}

describe('buildAIContext', () => {
  it('builds base context fields', () => {
    const actor = stubCharacter('actor-1');
    const ally = stubCharacter('ally-1');
    const enemy = stubCharacter('enemy-1');
    const context = buildAIContext({
      character: actor,
      allies: [ally],
      enemies: [enemy],
      battlefield: {} as Battlefield,
      currentTurn: 2,
      currentRound: 1,
      apRemaining: 2,
      config: stubConfig(),
      sideId: 'Alpha',
      vpBySide: { Alpha: 1, Bravo: 0 },
      rpBySide: { Alpha: 3, Bravo: 2 },
      maxTurns: 6,
      endGameTurn: 3,
    });

    expect(context.character.id).toBe('actor-1');
    expect(context.allies[0].id).toBe('ally-1');
    expect(context.enemies[0].id).toBe('enemy-1');
    expect(context.sideId).toBe('Alpha');
    expect(context.vpBySide).toEqual({ Alpha: 1, Bravo: 0 });
    expect(context.maxTurns).toBe(6);
    expect(context.endGameTurn).toBe(3);
  });

  it('attaches coordinator slice when provided', () => {
    const context = buildAIContext({
      character: stubCharacter('actor-2'),
      allies: [],
      enemies: [],
      battlefield: {} as Battlefield,
      currentTurn: 1,
      currentRound: 1,
      apRemaining: 1,
      config: stubConfig(),
      coordinator: {
        scoringContext: {
          myKeyScores: {},
          opponentKeyScores: {},
          amILeading: true,
          vpMargin: 1,
          winningKeys: [],
          losingKeys: [],
        },
        targetCommitments: { enemyA: 1.4 },
        scrumContinuity: { enemyA: 0.8 },
        lanePressure: { enemyA: 0.7 },
      },
    });

    expect(context.scoringContext?.amILeading).toBe(true);
    expect(context.targetCommitments).toEqual({ enemyA: 1.4 });
    expect(context.scrumContinuity).toEqual({ enemyA: 0.8 });
    expect(context.lanePressure).toEqual({ enemyA: 0.7 });
  });
});
