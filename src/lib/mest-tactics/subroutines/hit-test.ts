
import { Character } from '../Character';
import { resolveTest, TestParticipant, DicePool, TestResult, DiceType, mergeDicePools } from '../dice-roller';
import { Item } from '../Item';
import { parseAccuracy } from './accuracy-parser';

export function resolveHitTest(
    attacker: Character,
    defender: Character,
    weapon: Item,
    attackerBonus: DicePool = {},
    attackerPenalty: DicePool = {},
    defenderBonus: DicePool = {},
    defenderPenalty: DicePool = {},
): TestResult {
    
    const attackerAttribute = weapon.classification === 'Melee' ? attacker.finalAttributes.cca : attacker.finalAttributes.rca;
    const defenderAttribute = defender.finalAttributes.ref;

    const { bonusDice: accBonus, penaltyDice: accPenalty } = parseAccuracy(weapon.accuracy);

    const attackerParticipant: TestParticipant = {
        attributeValue: attackerAttribute,
        bonusDice: mergeDicePools(attackerBonus, accBonus),
        penaltyDice: mergeDicePools(attackerPenalty, accPenalty),
    };

    const defenderParticipant: TestParticipant = {
        attributeValue: defenderAttribute,
        bonusDice: defenderBonus,
        penaltyDice: defenderPenalty,
    };

    return resolveTest(attackerParticipant, defenderParticipant);
}
