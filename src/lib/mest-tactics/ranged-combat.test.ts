
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeRangedCombatAttack } from './ranged-combat';
import { setRoller, resetRoller, DiceType, Roller } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import { gameData } from '../data';
import { Battlefield } from './battlefield/Battlefield';
import { TerrainElement } from './battlefield/TerrainElement';

const { archetypes, ranged_weapons, armors } = gameData;

describe('makeRangedCombatAttack', () => {
  let attacker: Character;
  let defender: Character;
  let attackerWeapon: Item;

  beforeEach(async () => {
    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] };
    const defenderArchetype = { name: "Militia", ...archetypes["Militia"] };
    attackerWeapon = { name: "Rifle, Light, Semi/A", ...ranged_weapons["Rifle, Light, Semi/A"] };
    const defenderArmor = { name: "Armor, Medium Mail", ...armors["Armor, Medium Mail"] };

    const attackerProfile: Profile = { name: 'Attacker Profile', archetype: attackerArchetype, equipment: [attackerWeapon] };
    const defenderProfile: Profile = { name: 'Defender Profile', archetype: defenderArchetype, equipment: [defenderArmor] };

    attacker = await createCharacter(attackerProfile);
    defender = await createCharacter(defenderProfile);

    metricsService.clearEvents();
    resetRoller();
  });

  afterEach(() => {
    resetRoller();
  });

  it('should force a successful hit and create a damage resolution', async () => {
    setRoller(() => [6, 6]);
    const result = makeRangedCombatAttack(attacker, defender, attackerWeapon, 0, { forceHit: true });
    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
    expect(result.damageResolution.woundsAdded).toBe(2);
  });

  it('should force a miss and not create a damage resolution', async () => {
    const result = makeRangedCombatAttack(attacker, defender, attackerWeapon, 0, { forceMiss: true });
    expect(result.hit).toBe(false);
    expect(result.damageResolution).toBeUndefined();
  });

  it('should add a point-blank bonus for the attacker', () => {
    const rolls: number[][] = [[1, 1, 1], [1, 1]];
    const statefulRoller: Roller = () => rolls.shift() || [1, 1];
    setRoller(statefulRoller);

    makeRangedCombatAttack(attacker, defender, attackerWeapon, 0, { isPointBlank: true });

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
  });

  it('should add a cover bonus for the defender with direct cover', () => {
    const rolls: number[][] = [[1, 1], [1, 1, 1]];
    const statefulRoller: Roller = () => rolls.shift() || [1, 1];
    setRoller(statefulRoller);

    makeRangedCombatAttack(attacker, defender, attackerWeapon, 0, { hasDirectCover: true });

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p2FinalBonus[DiceType.Base] || 0).toBe(1);
  });

  it('should add a cover bonus for the defender with intervening cover', () => {
    const rolls: number[][] = [[1, 1], [1, 1, 1]];
    const statefulRoller: Roller = () => rolls.shift() || [1, 1];
    setRoller(statefulRoller);

    makeRangedCombatAttack(attacker, defender, attackerWeapon, 0, { hasInterveningCover: true });

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p2FinalBonus[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply an ORM penalty to the attacker', () => {
    const rolls: number[][] = [[1, 1], [1, 1]];
    const statefulRoller: Roller = () => rolls.shift() || [1, 1];
    setRoller(statefulRoller);

    makeRangedCombatAttack(attacker, defender, attackerWeapon, 1, {});

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p1FinalPenalty[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply cover from spatial context', () => {
    const battlefield = new Battlefield(12, 12);
    const tree = new TerrainElement('Tree', { x: 6, y: 6 });
    battlefield.addTerrain(tree.toFeature());

    const rolls: number[][] = [[1, 1], [1, 1, 1]];
    const statefulRoller: Roller = () => rolls.shift() || [1, 1];
    setRoller(statefulRoller);

    const spatial = {
      battlefield,
      attacker: { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2 },
      target: { id: 'defender', position: { x: 6, y: 6 }, baseDiameter: 2 },
    };

    makeRangedCombatAttack(attacker, defender, attackerWeapon, 0, {}, spatial);

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p2FinalBonus[DiceType.Base] || 0).toBe(1);
  });
});
