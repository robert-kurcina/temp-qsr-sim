
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeDisengageAction } from './disengage';
import { setRoller, resetRoller, DiceType, Roller } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import type { TestContext } from './TestContext';
import { gameData } from '../data';

const { archetypes, melee_weapons, armors } = gameData;

describe('makeDisengageAction', () => {
    let disengager: Character;
    let defender: Character;
    let defenderWeapon: Item;

    beforeEach(() => {
        const disengagerArchetype = { name: 'Militia', ...archetypes['Militia'] };
        const defenderArchetype = { name: 'Militia', ...archetypes['Militia'] };
        defenderWeapon = { name: 'Sword', ...melee_weapons['Sword'] };
        const disengagerProfile: Profile = { archetype: disengagerArchetype, equipment: [] };
        const defenderProfile: Profile = { archetype: defenderArchetype, equipment: [defenderWeapon] };
        disengager = createCharacter(disengagerProfile, 'Disengager');
        defender = createCharacter(defenderProfile, 'Defender');
    });

    afterEach(() => {
        resetRoller();
        metricsService.clearEvents();
    });

    it('should automatically pass if context.isAutoPass is true', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { isAutoPass: true });
        expect(result.pass).toBe(true);
    });

    it('should pass the disengage test when roll is high', () => {
        setRoller(() => 6);
        const result = makeDisengageAction(disengager, defender, defenderWeapon, {});
        expect(result.pass).toBe(true);
    });

    it('should apply a penalty to the disengager if cornered', () => {
        setRoller(() => 0);
        makeDisengageAction(disengager, defender, defenderWeapon, { isCornered: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalPenalty[DiceType.Modifier]).toBe(1);
    });

    it('should apply a penalty to the disengager if flanked', () => {
        setRoller(() => 0);
        makeDisengageAction(disengager, defender, defenderWeapon, { isFlanked: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalPenalty[DiceType.Modifier]).toBe(1);
    });

    it('should apply a bonus to the disengager for high ground', () => {
        setRoller(() => 0);
        makeDisengageAction(disengager, defender, defenderWeapon, { hasHighGround: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a bonus to the disengager for outnumbering', () => {
        setRoller(() => 0);
        makeDisengageAction(disengager, defender, defenderWeapon, { outnumberAdvantage: 2 });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalBonus[DiceType.Wild] || 0).toBe(2);
    });

    it('should apply a bonus to the defender for outnumbering', () => {
        setRoller(() => 0);
        makeDisengageAction(disengager, defender, defenderWeapon, { outnumberAdvantage: -2 }); // Negative means defender has advantage
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p2FinalBonus[DiceType.Wild] || 0).toBe(2);
    });

    it('should apply a penalty for overreach', () => {
        setRoller(() => 0);
        makeDisengageAction(disengager, defender, defenderWeapon, { isOverreaching: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalPenalty[DiceType.Modifier]).toBe(1);
    });

    it('should apply a bonus for size difference', () => {
        setRoller(() => 0);
        makeDisengageAction(disengager, defender, defenderWeapon, { sizeAdvantage: 1 });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a bonus for suddenness', () => {
        setRoller(() => 0);
        makeDisengageAction(disengager, defender, defenderWeapon, { hasSuddenness: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });
});
