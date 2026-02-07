
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeIndirectRangedAttack } from './indirect-ranged-combat';
import { setRoller, resetRoller, DiceType } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import { gameData } from '../data';

const { archetypes, ranged_weapons } = gameData;

describe('makeIndirectRangedAttack', () => {
    let attacker: Character;
    let weapon: Item;

    beforeEach(async () => {
        const attackerArchetype = { name: 'Militia', ...archetypes['Militia'] }; // RCA 2
        weapon = { name: 'Grenade, HE', ...ranged_weapons['Grenade, HE'] };
        const attackerProfile: Profile = { name: 'Attacker Profile', archetype: attackerArchetype, equipment: [weapon] };
        attacker = await createCharacter(attackerProfile);
    });

    afterEach(() => {
        resetRoller();
        metricsService.clearEvents();
    });

    it('should pass the hit test with a high roll', () => {
        setRoller(() => [6]);
        const result = makeIndirectRangedAttack(attacker, weapon, 0, {});
        expect(result.pass).toBe(true);
    });

    it('should fail the hit test with a large penalty', () => {
        const attackerAttribute = attacker.finalAttributes.rca;
        const orm = attackerAttribute + 1; // ORM > RCA = miss
        const result = makeIndirectRangedAttack(attacker, weapon, orm, {});
        expect(result.pass).toBe(false);
    });

    it('should apply an ORM penalty', () => {
        setRoller(() => [1]);
        makeIndirectRangedAttack(attacker, weapon, 2, {});
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const eventData = diceEvents[0].data as any;
        expect(eventData.finalPools.p2FinalBonus[DiceType.Modifier] || 0).toBe(2);
    });

    it('should apply a hindrance penalty', () => {
        setRoller(() => [1]);
        attacker.state.woundTokens = 1;
        makeIndirectRangedAttack(attacker, weapon, 0, {});
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const eventData = diceEvents[0].data as any;
        expect(eventData.finalPools.p2FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a point-blank bonus', () => {
        setRoller(() => [1]);
        makeIndirectRangedAttack(attacker, weapon, 0, { isPointBlank: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const eventData = diceEvents[0].data as any;
        expect(eventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a direct cover penalty', () => {
        setRoller(() => [1]);
        makeIndirectRangedAttack(attacker, weapon, 0, { hasDirectCover: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const eventData = diceEvents[0].data as any;
        expect(eventData.finalPools.p2FinalBonus[DiceType.Base] || 0).toBe(1);
    });

    it('should apply an intervening cover penalty', () => {
        setRoller(() => [1]);
        makeIndirectRangedAttack(attacker, weapon, 0, { hasInterveningCover: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const eventData = diceEvents[0].data as any;
        expect(eventData.finalPools.p2FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a weapon accuracy bonus', () => {
        setRoller(() => [1]);
        weapon.accuracy = 'Acc(+1b)';
        makeIndirectRangedAttack(attacker, weapon, 0, {});
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const eventData = diceEvents[0].data as any;
        expect(eventData.finalPools.p1FinalBonus[DiceType.Base] || 0).toBe(1);
    });
});
