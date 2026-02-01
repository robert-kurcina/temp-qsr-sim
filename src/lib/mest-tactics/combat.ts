
import { Character } from './Character';
import { resolveTest, TestParticipant, DiceType, DicePool } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';

export interface AttackResult {
  hit: boolean;
  woundsInflicted: number;
  remainingImpact: number;
  hitTestResult: any; 
  damageTestResult?: any;
}

const parseDiceString = (diceString: string): DicePool => {
  const dice: DicePool = {};
  const value = parseInt(diceString.slice(1, -1), 10) || 1;
  const type = diceString.endsWith('m') ? DiceType.Modifier : diceString.endsWith('b') ? DiceType.Base : DiceType.Wild;
  dice[type] = value;
  return dice;
};

function parseAccuracy(accuracy: string | number | undefined): { bonusDice: DicePool, penaltyDice: DicePool, scoreModifier: number } {
  const result = { bonusDice: {}, penaltyDice: {}, scoreModifier: 0 };
  if (accuracy === undefined || accuracy === '-') return result;

  if (typeof accuracy === 'number') {
    result.scoreModifier = accuracy;
  } else if (accuracy.endsWith('m') || accuracy.endsWith('b') || accuracy.endsWith('w')) {
    if (accuracy.startsWith('-')) {
      result.penaltyDice = parseDiceString(accuracy);
    } else {
      result.bonusDice = parseDiceString(accuracy.startsWith('+') ? accuracy : '+' + accuracy);
    }
  } else {
    result.scoreModifier = parseInt(accuracy, 10) || 0;
  }
  return result;
}

function parseDamageFormula(formula: string, attacker: Character): { value: number; dice: DicePool } {
  let value = 0;
  const dice: DicePool = {};
  for (const part of formula.split('+')) {
    if (part.toUpperCase() === 'STR') {
      value += attacker.finalAttributes.str;
    } else if (part.endsWith('w') || part.endsWith('b') || part.endsWith('m')) {
      const parsed = parseDiceString('+' + part);
      for(const key in parsed) {
        const type = key as DiceType;
        dice[type] = (dice[type] || 0) + parsed[type]!;
      }
    } else {
      value += parseInt(part, 10) || 0;
    }
  }
  return { value, dice };
}

function getHindrancePenalty(character: Character): DicePool {
  const penalty: DicePool = {};
  const hindranceCount = (character.state.wounds > 0 ? 1 : 0) + 
                         (character.state.delayTokens > 0 ? 1 : 0) + 
                         (character.state.fearTokens > 0 ? 1 : 0);

  if (hindranceCount > 0) {
    penalty[DiceType.Modifier] = hindranceCount;
  }
  return penalty;
}

export function makeCloseCombatAttack(
  attacker: Character,
  defender: Character,
  weapon: Item,
  context: TestContext = {}
): AttackResult {
  // 1. Perform the Hit Test (Opposed CCA vs. CCA)
  const { bonusDice: accBonus, penaltyDice: accPenalty, scoreModifier } = parseAccuracy(weapon.accuracy);

  const hitTestAttacker: TestParticipant = {
    attributeValue: attacker.finalAttributes.cca,
    bonusDice: accBonus,
    penaltyDice: { ...getHindrancePenalty(attacker), ...accPenalty },
  };
  const hitTestDefender: TestParticipant = {
    attributeValue: defender.finalAttributes.cca,
    penaltyDice: getHindrancePenalty(defender),
  };

  const hitTestResult = resolveTest(hitTestAttacker, hitTestDefender, -scoreModifier, context);

  if (!hitTestResult.pass) {
    return { hit: false, woundsInflicted: 0, remainingImpact: 0, hitTestResult };
  }

  // 2. Perform the Damage Test (Opposed Dmg vs. FOR)
  const damageFormula = weapon.dmg || 'STR';
  const { value: damageValue, dice: damageDice } = parseDamageFormula(damageFormula, attacker);
  
  const damageTestAttacker: TestParticipant = {
    attributeValue: damageValue,
    bonusDice: { ...damageDice, ...hitTestResult.carryOverDice },
  };
  
  // This is now an opposed test
  const damageTestDefender: TestParticipant = {
    attributeValue: defender.finalAttributes.for,
  };

  const damageTestResult = resolveTest(damageTestAttacker, damageTestDefender, 0, {});
  
  // 3. Calculate Final Wounds
  const impact = weapon.impact || 0;
  const defenderAR = defender.state.armor.total;
  const effectiveAR = Math.max(0, defenderAR - impact);
  const remainingImpact = Math.max(0, impact - defenderAR);
  const woundsDealtByRoll = damageTestResult.pass ? damageTestResult.cascades : 0;
  const woundsInflicted = Math.max(0, woundsDealtByRoll - effectiveAR);

  // DO NOT MUTATE STATE. The caller is responsible for applying wounds.
  // defender.state.wounds += woundsInflicted; <--- This was the bug!

  return {
    hit: true,
    woundsInflicted,
    remainingImpact,
    hitTestResult,
    damageTestResult,
  };
}
