
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeIndirectRangedAttack } from './indirect-ranged-combat';
import { setRoller, resetRoller, DiceType, Roller } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import type { TestContext } from './TestContext';
import { gameData } from '../data';

const { archetypes, ranged_weapons } = gameData;

describe('makeIndirectRangedAttack', () => {
    let attacker: Character;
    let weapon: Item;

    beforeEach(() => {
        const attackerArchetype = { name: 'Militia', ...archetypes['Militia'] };
        weapon = { name: 'Grenade, HE', ...ranged_weapons['Grenade, HE'] }; // A typical indirect weapon
        const attackerProfile: Profile = { archetype: attackerArchetype, equipment: [weapon] };
        attacker = createCharacter(attackerProfile, 'Attacker'); // RCA 3
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

    it('should still pass the hit test with a large penalty if base attribute is high', () => {
        setRoller(() => [1]); // Ensure no successes from dice
        const result = makeIndirectRangedAttack(attacker, weapon, 10, {}); // ORM > RCA
        // Attacker has RCA 3. System has difficulty 0. Even with 0 successes, score is 3.
        expect(result.pass).toBe(true);
    });

    it('should apply an ORM penalty', () => {
        setRoller(() => [1]);
        makeIndirectRangedAttack(attacker, weapon, 2, {});
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const eventData = diceEvents[0].data as any;
        // ORM of 2 is a -2 Modifier die penalty, which is awarded to the System player.
        expect(eventData.finalPools.p2FinalBonus[DiceType.Modifier] || 0).toBe(2);
    });

    it('should apply a hindrance penalty', () => {
        setRoller(() => [1]);
        attacker.state.wounds = 1;
        makeIndirectRangedAttack(attacker, weapon, 0, {});
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const eventData = diceEvents[0].data as any;
        // Hindrance from wound is a -1 Modifier die penalty, awarded to System.
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
        // Direct Cover is a -1 Base die penalty, awarded to System.
        expect(eventData.finalPools.p2FinalBonus[DiceType.Base] || 0).toBe(1);
    });

    it('should apply an intervening cover penalty', () => {
        setRoller(() => [1]);
        makeIndirectRangedAttack(attacker, weapon, 0, { hasInterveningCover: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const eventData = diceEvents[0].data as any;
        // Intervening Cover is a -1 Modifier die penalty, awarded to System.
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
