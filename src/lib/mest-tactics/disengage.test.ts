
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeDisengageAction } from './disengage';
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
        const disengagerArchetype = archetypes['Militia'];
        const defenderArchetype = archetypes['Militia'];
        defenderWeapon = { name: 'Sword, Broad', ...melee_weapons['Sword, Broad'] };

        const disengagerProfile: any = { name: 'Disengager Profile', archetype: 'Militia', equipment: [] };
        const defenderProfile: any = { name: 'Defender Profile', archetype: 'Militia', equipment: [defenderWeapon] };

        disengager = await createCharacter(disengagerProfile);
        defender = await createCharacter(defenderProfile);
    });

    it('should automatically pass if context.isAutoPass is true', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { isAutoPass: true });
        expect(result.pass).toBe(true);
    });

    it('should pass the disengage test when roll is high', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, {}, [6, 6, 1], [1, 1]);
        expect(result.pass).toBe(true);
        expect(result.score).toBe(5);
    });

    it('should apply a penalty to the disengager if cornered', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { isCornered: true }, [1, 1], [4, 4, 1]);
        expect(result.score).toBe(-1);
    });

    it('should apply a penalty to the disengager if flanked', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { isFlanked: true }, [1, 1], [6, 6, 1]);
        expect(result.pass).toBe(false);
        expect(result.score).toBe(-3);
    });

    it('should apply a bonus to the disengager for high ground', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { hasHighGround: true }, [4, 4, 1], [1, 1]);
        expect(result.score).toBe(3);
    });

    it('should apply a bonus to the disengager for outnumbering', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { outnumberAdvantage: 1 }, [4, 4, 4], [1, 1]);
        expect(result.score).toBe(4);
    });

    it('should apply a bonus to the defender for outnumbering', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { outnumberAdvantage: -1 }, [1, 1], [6, 4, 4]);
        expect(result.score).toBe(-3);
    });

    it('should apply a penalty for overreach', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { isOverreach: true }, [1, 1], [4, 4, 1]);
        expect(result.score).toBe(-1);
    });

    it('should apply a bonus for size difference', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { sizeAdvantage: 2 }, [1, 1], [6, 6, 4]);
        expect(result.score).toBe(-4);
    });

    it('should apply a bonus for suddenness', () => {
        const result = makeDisengageAction(disengager, defender, defenderWeapon, { hasSuddenness: true }, [4, 4, 1], [1, 1]);
        expect(result.score).toBe(3);
    });
});
