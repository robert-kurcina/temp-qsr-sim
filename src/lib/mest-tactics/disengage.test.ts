
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

const { archetypes, melee_weapons } = gameData;

describe('makeDisengageAction', () => {
    let disengager: Character;
    let defender: Character;
    let defenderWeapon: Item;

    beforeEach(() => {
        const disengagerArchetype = { name: 'Militia', ...archetypes['Militia'] }; // REF 3
        const defenderArchetype = { name: 'Veteran, Fighter', ...archetypes['Veteran, Fighter'] }; // CCA 4
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
        // Disengager (REF:3) rolls 2 base dice. Defender (CCA:4) rolls 2 base dice.
        const rolls = [[6, 6], [6, 6]];
        const statefulRoller: Roller = () => rolls.shift() || [];
        setRoller(statefulRoller);
        const result = makeDisengageAction(disengager, defender, defenderWeapon, {});
        // Disengager: 4 successes, Score 3+4=7. Defender: 4 successes, Score 4+4=8.
        // Final score: 7-8 = -1. Fails. Wait, pass on tie is true. So a score of 0 should pass.
        // Let's force a tie. Disengager has REF 3, 2 dice. Defender has CCA 4, 2 dice.
        // Let's say disengager rolls 6,6 -> 4 successes. Score: 3+4=7
        // Let's say defender rolls 6, 4 -> 3 successes. Score: 4+3=7
        const tieRolls = [[6, 6], [6, 4]];
        const tieRoller: Roller = () => tieRolls.shift() || [];
        setRoller(tieRoller);
        const tieResult = makeDisengageAction(disengager, defender, defenderWeapon, {});
        expect(tieResult.pass).toBe(true);
        expect(tieResult.score).toBe(0);
    });

    it('should apply a penalty to the disengager if cornered', () => {
        setRoller(() => [0]);
        makeDisengageAction(disengager, defender, defenderWeapon, { isCornered: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p2FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a penalty to the disengager if flanked', () => {
        setRoller(() => [0]);
        makeDisengageAction(disengager, defender, defenderWeapon, { isFlanked: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p2FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a bonus to the disengager for high ground', () => {
        setRoller(() => [0]);
        makeDisengageAction(disengager, defender, defenderWeapon, { hasHighGround: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a bonus to the disengager for outnumbering', () => {
        setRoller(() => [0]);
        makeDisengageAction(disengager, defender, defenderWeapon, { outnumberAdvantage: 2 });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalBonus[DiceType.Wild] || 0).toBe(2);
    });

    it('should apply a bonus to the defender for outnumbering', () => {
        setRoller(() => [0]);
        makeDisengageAction(disengager, defender, defenderWeapon, { outnumberAdvantage: -2 }); // Negative means defender has advantage
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p2FinalBonus[DiceType.Wild] || 0).toBe(2);
    });

    it('should apply a penalty for overreach', () => {
        setRoller(() => [0]);
        makeDisengageAction(disengager, defender, defenderWeapon, { isOverreach: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p2FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a bonus for size difference', () => {
        setRoller(() => [0]);
        makeDisengageAction(disengager, defender, defenderWeapon, { sizeAdvantage: 1 });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });

    it('should apply a bonus for suddenness', () => {
        setRoller(() => [0]);
        makeDisengageAction(disengager, defender, defenderWeapon, { hasSuddenness: true });
        const diceEvents = metricsService.getEventsByName('diceTestResolved');
        const hitEventData = diceEvents[0].data as any;
        expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
    });
});
