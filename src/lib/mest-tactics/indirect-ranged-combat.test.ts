
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeIndirectRangedAttack } from './indirect-ranged-combat';
import { setRoller, resetRoller, DiceType, Roller } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import { gameData } from '../data';

const { archetypes, ranged_weapons } = gameData;

describe('makeIndirectRangedAttack', () => {
  let attacker: Character;
  let weapon: Item;
  const attackerAttribute = 3;

  beforeEach(async () => {
    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] };
    weapon = { name: "Rifle, Light, Semi/A", ...ranged_weapons["Rifle, Light, Semi/A"] };

    const attackerProfile: Profile = { name: 'Attacker Profile', archetype: attackerArchetype, equipment: [weapon] };

    attacker = await createCharacter(attackerProfile);

    metricsService.clearEvents();
    resetRoller();
  });

  afterEach(() => {
    resetRoller();
  });

  it('should pass the hit test with a high roll', () => {
    setRoller(() => [6]);
    const result = makeIndirectRangedAttack(attacker, weapon, 0, {});
    expect(result.pass).toBe(true);
  });

  it('should fail the hit test with a large penalty', () => {
    setRoller(() => [1]);
    const orm = attackerAttribute + 1; // ORM > RCA = miss
    const result = makeIndirectRangedAttack(attacker, weapon, orm, { hasHindrance: true });
    expect(result.pass).toBe(false);
  });

  it('should apply an ORM penalty', () => {
    const rolls: number[][] = [[1]];
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);

    makeIndirectRangedAttack(attacker, weapon, 2, {});
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply a hindrance penalty', () => {
    const rolls: number[][] = [[1]];
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);

    makeIndirectRangedAttack(attacker, weapon, 0, { hasHindrance: true });
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply a point-blank bonus', () => {
    const rolls: number[][] = [[1]];
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);
    makeIndirectRangedAttack(attacker, weapon, 0, { isPointBlank: true });
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply a direct cover penalty', () => {
    const rolls: number[][] = [[1]];
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);
    makeIndirectRangedAttack(attacker, weapon, 0, { hasDirectCover: true });
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Base] || 0).toBe(1);
  });

  it('should apply an intervening cover penalty', () => {
    const rolls: number[][] = [[1]];
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);
    makeIndirectRangedAttack(attacker, weapon, 0, { hasInterveningCover: true });
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply a weapon accuracy bonus', () => {
    const rolls: number[][] = [[1]];
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);
    weapon.accuracy = '+1b';
    makeIndirectRangedAttack(attacker, weapon, 0, {});
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalBonus[DiceType.Base] || 0).toBe(1);
  });
});
