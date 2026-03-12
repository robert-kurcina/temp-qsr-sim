
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from '../utils/character-factory';
import { resolveMoraleTest } from './morale-test';
import { setRoller, resetRoller, DiceType } from '../subroutines/dice-roller';
import { metricsService } from '../engine/MetricsService';
import type { Profile } from '../core/Profile';
import type { Character } from '../core/Character';
import { gameData } from '../../data';

const { archetypes } = gameData;

describe('resolveMoraleTest', () => {
  let character: Character;

  beforeEach(async () => {
    const archetype = { name: "Militia", ...archetypes["Militia"] };
    const profile: Profile = { name: 'Test Character', archetype, equipment: [] } as any;
    character = await createCharacter(profile);
    metricsService.clearEvents();
    setRoller((diceCount: number) => Array.from({ length: diceCount }, () => 1));
  });

  afterEach(() => {
    resetRoller();
  });

  it('should pass morale test if roll is high', () => {
    const result = resolveMoraleTest(character, 0, {}, [6, 6]);
    expect(result.pass).toBe(true);
  });

  it('should pass morale test if roll is low and its a tie', () => {
    const result = resolveMoraleTest(character, 0, {}, [1, 1]);
    expect(result.pass).toBe(true);
  });

  it('should apply fear tokens as penalty dice', () => {
    resolveMoraleTest(character, 2, {}, [1, 1]);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Modifier] || 0).toBe(2);
  });

  it('should apply hasAdvantage as a bonus die', () => {
    resolveMoraleTest(character, 0, { hasAdvantage: true }, [1, 1, 1]);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalBonus[DiceType.Wild] || 0).toBe(1);
  });

  it('should apply isDisadvantaged as a penalty die', () => {
    resolveMoraleTest(character, 0, { isDisadvantaged: true }, [1, 1, 1]);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Wild] || 0).toBe(1);
  });
});
