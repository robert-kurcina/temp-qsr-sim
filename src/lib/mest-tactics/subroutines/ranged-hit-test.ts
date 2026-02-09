
import { Character } from '../Character';
import { resolveTest, TestParticipant, TestDice, TestResult } from '../dice-roller';
import { Item } from '../Item';
import { parseAccuracy } from './accuracy-parser';

export function resolveRangedHitTest(
    attacker: Character,
    defender: Character,
    weapon: Item,
    attackerBonus: TestDice = {},
    attackerPenalty: TestDice = {},
    defenderBonus: TestDice = {},
    defenderPenalty: TestDice = {},
): TestResult {
    
    // Get the base attribute values for the test
    const attackerAttribute = weapon.classification === 'Thrown' ? attacker.finalAttributes.cca : attacker.finalAttributes.rca;
    const defenderAttribute = defender.finalAttributes.ref;

    const accuracyBonus = parseAccuracy(weapon.accuracy);

    const attackerParticipant: TestParticipant = {
        attributeValue: attackerAttribute,
        bonusDice: { ...attackerBonus, ...accuracyBonus },
        penaltyDice: attackerPenalty,
    };

    const defenderParticipant: TestParticipant = {
        attributeValue: defenderAttribute,
        bonusDice: defenderBonus,
        penaltyDice: defenderPenalty,
    };

    return resolveTest(attackerParticipant, defenderParticipant);
}
