
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from '../character-factory';
import { resolveMoraleTest } from './morale-test';
import { setRoller, resetRoller, Roller, DiceType } from '../dice-roller';
import { metricsService } from '../MetricsService';
import type { Profile } from '../Profile';
import type { Character } from '../Character';
import { gameData } from '../../data';

const { archetypes } = gameData;

describe('resolveMoraleTest', () => {
  let character: Character;

  beforeEach(async () => {
    const archetype = { name: "Militia", ...archetypes["Militia"] };
    const profile: Profile = { name: 'Test Character', archetype, equipment: [] };
    character = await createCharacter(profile);
    metricsService.clearEvents();
    resetRoller();
  });

  afterEach(() => {
    resetRoller();
  });

  it('should pass morale test if roll is high', () => {
    setRoller(() => [6, 1]);
    const result = resolveMoraleTest(character);
    expect(result.pass).toBe(true);
  });

  it('should fail morale test if roll is low', () => {
    setRoller(() => [1, 6]);
    const result = resolveMoraleTest(character);
    expect(result.pass).toBe(false);
  });

  it('should apply fear tokens as penalty dice', () => {
    const rolls: number[][] = [[1], [1]];
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);

    resolveMoraleTest(character, 2, {});
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply hasAdvantage as a bonus die', () => {
    const rolls: number[][] = [[1], [1]];
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);

    resolveMoraleTest(character, 0, { hasAdvantage: true });
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalBonus[DiceType.Wild] || 0).toBe(1);
  });

  it('should apply isDisadvantaged as a penalty die', () => {
    const rolls: number[][] = [[1], [1]];
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);

    resolveMoraleTest(character, 0, { isDisadvantaged: true });
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Wild] || 0).toBe(1);
  });
});
