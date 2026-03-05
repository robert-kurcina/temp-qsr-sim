
import { Character } from '../core/Character';
import { resolveTest, TestParticipant, TestDice, ResolveTestResult, mergeTestDice } from '../subroutines/dice-roller';
import { Item } from '../core/Item';
import { parseAccuracy } from './accuracy-parser';

// Backward compatibility type alias
export type HitTestContext = {
  attacker: Character;
  defender: Character;
  weapon: Item;
  attackerBonus?: TestDice;
  attackerPenalty?: TestDice;
  defenderBonus?: TestDice;
  defenderPenalty?: TestDice;
};

export function resolveHitTest(
    attacker: Character,
    defender: Character,
    weapon: Item,
    attackerBonus: TestDice = {},
    attackerPenalty: TestDice = {},
    defenderBonus: TestDice = {},
    defenderPenalty: TestDice = {},
    p1Rolls: number[] | null = null,
    p2Rolls: number[] | null = null,
): ResolveTestResult {

    const attackerAttribute = weapon.classification === 'Melee' ? attacker.finalAttributes.cca : attacker.finalAttributes.rca;
    const defenderAttribute = weapon.classification === 'Melee' ? defender.finalAttributes.cca : defender.finalAttributes.ref;

    const { bonusDice: accBonus, penaltyDice: accPenalty } = parseAccuracy(weapon.accuracy);

    const attackerParticipant: TestParticipant = {
        attributeValue: attackerAttribute,
        bonusDice: mergeTestDice(attackerBonus, accBonus),
        penaltyDice: mergeTestDice(attackerPenalty, accPenalty),
    };

    const defenderParticipant: TestParticipant = {
        attributeValue: defenderAttribute,
        bonusDice: defenderBonus,
        penaltyDice: defenderPenalty,
    };

    return resolveTest(attackerParticipant, defenderParticipant, p1Rolls, p2Rolls);
}
