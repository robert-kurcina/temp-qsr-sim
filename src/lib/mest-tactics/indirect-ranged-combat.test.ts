
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeIndirectRangedAttack } from './indirect-ranged-combat';
import { setRoller, resetRoller, DiceType, Roller } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import { gameData } from '../data';
import { Battlefield } from './battlefield/Battlefield';
import { TerrainElement } from './battlefield/TerrainElement';

const { archetypes, ranged_weapons } = gameData;

describe('makeIndirectRangedAttack', () => {
  let attacker: Character;
  let weapon: Item;

  beforeEach(async () => {
    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] };
    weapon = { name: "Rifle, Light, Semi/A", ...ranged_weapons["Rifle, Light, Semi/A"] };

    const attackerProfile: Profile = { name: 'Attacker Profile', archetype: attackerArchetype, equipment: [weapon] };

    attacker = await createCharacter(attackerProfile);
    attacker.finalAttributes = attacker.profile.archetype.attributes;

    metricsService.clearEvents();
    resetRoller();
  });

  afterEach(() => {
    resetRoller();
  });

  it('should pass the hit test with a high roll', () => {
    const rolls = Array(20).fill(6);
    const result = makeIndirectRangedAttack(attacker, weapon, 0, {}, rolls);
    expect(result.pass).toBe(true);
  });

  it('should fail the hit test with a large penalty', () => {
    const rolls = [1, 1];
    const orm = attacker.finalAttributes.rca + 1; // ORM > RCA = miss
    const result = makeIndirectRangedAttack(attacker, weapon, orm, { hasHindrance: true }, rolls);
    expect(result.pass).toBe(false);
  });

  it('should apply an ORM penalty', () => {
    const rolls = [1,1];
    makeIndirectRangedAttack(attacker, weapon, 2, {}, rolls);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Modifier] || 0).toBe(2);
  });

  it('should apply a hindrance penalty', () => {
    const rolls = [1,1];
    attacker.state.isDisordered = true;
    makeIndirectRangedAttack(attacker, weapon, 0, { hasHindrance: true }, rolls);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply a point-blank bonus', () => {
    const rolls = [1,1,1];
    makeIndirectRangedAttack(attacker, weapon, 0, { isPointBlank: true }, rolls);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply a direct cover penalty', () => {
    const rolls = [1,1];
    makeIndirectRangedAttack(attacker, weapon, 0, { hasDirectCover: true }, rolls);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Base] || 0).toBe(1);
  });

  it('should apply an intervening cover penalty', () => {
    const rolls = [1,1];
    makeIndirectRangedAttack(attacker, weapon, 0, { hasInterveningCover: true }, rolls);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply a weapon accuracy bonus', () => {
    const rolls = [1,1,1];
    weapon.accuracy = '+1b';
    makeIndirectRangedAttack(attacker, weapon, 0, {}, rolls);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalBonus[DiceType.Base] || 0).toBe(1);
  });

  it('should apply cover from spatial context', () => {
    const battlefield = new Battlefield(12, 12);
    const tree = new TerrainElement('Tree', { x: 6, y: 6 });
    battlefield.addTerrain(tree.toFeature());

    const rolls = [1, 1];
    const spatial = {
      battlefield,
      attacker: { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2 },
      target: { id: 'defender', position: { x: 6, y: 6 }, baseDiameter: 2 },
    };

    makeIndirectRangedAttack(attacker, weapon, 0, {}, rolls, spatial);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const eventData = diceEvents[0].data as any;
    expect(eventData.finalPools.p1FinalPenalty[DiceType.Base] || 0).toBe(0);
  });

  it('should apply status traits when a target character is provided', async () => {
    const targetArchetype = { name: "Militia", ...archetypes["Militia"] };
    const targetProfile: Profile = { name: 'Target Profile', archetype: targetArchetype, equipment: [] };
    const target = await createCharacter(targetProfile);
    target.finalAttributes = target.profile.archetype.attributes;

    weapon = { name: "Deceptor Rifle", ...ranged_weapons["Deceptor Rifle"] };
    const rolls = Array(20).fill(6);

    const roller: Roller = () => [6, 6];
    setRoller(roller);

    const result = makeIndirectRangedAttack(attacker, weapon, 0, {}, rolls, undefined, target);
    expect(result.pass).toBe(true);
    expect(target.state.statusTokens.Confused || 0).toBeGreaterThan(0);
  });
});
