import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeDisengageAction } from './disengage';
import { setRoller, resetRoller, DiceType, Roller } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import { gameData } from '../data';

const { archetypes, melee_weapons } = gameData;

describe('makeDisengageAction', () => {
    let disengager: Character;
    let defender: Character;
    let defenderWeapon: Item;

    beforeEach(async () => {
        const disengagerArchetype = { name: 'Militia', ...archetypes['Militia'] };
        const defenderArchetype = { name: 'Militia', ...archetypes['Militia'] };
        defenderWeapon = { name: 'Sword, Broad', ...melee_weapons['Sword, Broad'] };
        const disengagerProfile: Profile = { name: 'Disengager Profile', archetype: disengagerArchetype, equipment: [] };
        const defenderProfile: Profile = { name: 'Defender Profile', archetype: defenderArchetype, equipment: [defenderWeapon] };
        disengager = await createCharacter(disengagerProfile);
        defender = await createCharacter(defenderProfile);

        metricsService.clearEvents();
    });

    it('should automatically pass if context.isAutoPass is true', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { isAutoPass: true });
        expect(result.pass).toBe(true);
    });

    it('should pass the disengage test when roll is high', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, {}, [6, 6, 6], [1, 1]);
        expect(result.pass).toBe(true);
        expect(result.score).toBe(7);
    });

    it('should apply a penalty to the disengager if cornered', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { isCornered: true }, [1,1], [1, 1]);
        expect(result.testResult.p1Result.score).toBe(0);
    });

    it('should apply a penalty to the disengager if flanked', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { isFlanked: true }, [], [1, 1]);
        expect(result.testResult.p1Result.score).toBe(0);
    });

    it('should apply a bonus to the disengager for high ground', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { hasHighGround: true }, [6, 6], [1, 1]);
        expect(result.testResult.p1Result.score).toBe(2);
    });

    it('should apply a bonus to the disengager for outnumbering', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { outnumberAdvantage: 1 }, [6, 6, 6], [1, 1]);
        expect(result.testResult.p1Result.score).toBe(3);
    });

    it('should apply a bonus to the defender for outnumbering', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { outnumberAdvantage: -1 }, [1, 1], [6, 6, 6]);
        expect(result.testResult.p2Result.score).toBe(3);
    });

    it('should apply a penalty for overreach', () => {
        defenderWeapon.traits.push('Reach');
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { isOverreach: true }, [1, 1], [1]);
        expect(result.testResult.p2Result.score).toBe(0);
    });

    it('should apply a bonus for size difference', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { sizeAdvantage: 2 }, [1, 1], [6, 6, 6]);
        expect(result.testResult.p2Result.score).toBe(3);
    });

    it('should apply a bonus for suddenness', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { hasSuddenness: true }, [6, 6, 6], [1, 1]);
        expect(result.testResult.p1Result.score).toBe(3);
    });
});
