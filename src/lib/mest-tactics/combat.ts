
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

// This is an internal function to centralize all modifier logic.
function _calculateModifiers(
  attacker: Character,
  defender: Character,
  context: TestContext
): { attackerBonus: DicePool, attackerPenalty: DicePool, defenderBonus: DicePool, defenderPenalty: DicePool } {
  const attackerBonus: DicePool = {};
  const attackerPenalty: DicePool = {};
  const defenderBonus: DicePool = {};
  const defenderPenalty: DicePool = {};

  // 1. Calculate Hindrance Penalties
  if (attacker.state.wounds > 0) {
    attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
  }
  if (attacker.state.delayTokens > 0) {
    attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
  }
  if (attacker.state.fearTokens > 0) {
    attackerPenalty[DiceType.Modifier] = (attackerPenalty[DiceType.Modifier] || 0) + 1;
  }

  if (defender.state.wounds > 0) {
    defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + 1;
  }
  if (defender.state.delayTokens > 0) {
    defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + 1;
  }
  if (defender.state.fearTokens > 0) {
    defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + 1;
  }

  // 2. Calculate Contextual Modifiers (from TestContext)
  if (context.isDefending) {
    defenderBonus[DiceType.Base] = (defenderBonus[DiceType.Base] || 0) + 1;
  }
  if (context.isCharge) {
    attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
  }
  if (context.outnumberAdvantage && context.outnumberAdvantage > 0) {
    attackerBonus[DiceType.Wild] = (attackerBonus[DiceType.Wild] || 0) + context.outnumberAdvantage;
  }
  if (context.hasHighGround) {
    attackerBonus[DiceType.Modifier] = (attackerBonus[DiceType.Modifier] || 0) + 1;
  }
  if (context.isCornered) {
    defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + 1;
  }
  if (context.isFlanked) {
    defenderPenalty[DiceType.Modifier] = (defenderPenalty[DiceType.Modifier] || 0) + 1;
  }

  return { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty };
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

export function makeCloseCombatAttack(
  attacker: Character,
  defender: Character,
  weapon: Item,
  context: TestContext = {}
): AttackResult {
  // 1. Calculate all situational and state-based modifiers first.
  const { attackerBonus, attackerPenalty, defenderBonus, defenderPenalty } = _calculateModifiers(attacker, defender, context);

  // 2. Perform the Hit Test (Opposed CCA vs. CCA)
  const { bonusDice: accBonus, penaltyDice: accPenalty, scoreModifier } = parseAccuracy(weapon.accuracy);

  const hitTestAttacker: TestParticipant = {
    attributeValue: attacker.finalAttributes.cca,
    bonusDice: { ...attackerBonus, ...accBonus },
    penaltyDice: { ...attackerPenalty, ...accPenalty },
  };
  const hitTestDefender: TestParticipant = {
    attributeValue: defender.finalAttributes.cca,
    bonusDice: defenderBonus,
    penaltyDice: defenderPenalty,
  };

  const hitTestResult = resolveTest(hitTestAttacker, hitTestDefender, -scoreModifier);

  if (!hitTestResult.pass) {
    return { hit: false, woundsInflicted: 0, remainingImpact: 0, hitTestResult };
  }

  // 3. Perform the Damage Test (Unopposed Dmg vs. FOR)
  const damageFormula = weapon.dmg || 'STR';
  const { value: damageValue, dice: damageDice } = parseDamageFormula(damageFormula, attacker);
  
  const damageTestAttacker: TestParticipant = {
    attributeValue: damageValue,
    bonusDice: { ...damageDice, ...hitTestResult.carryOverDice },
  };
  
  // The damage test is unopposed by a roll, so the defender is a system player.
  const damageTestDefender: TestParticipant = {
    attributeValue: defender.finalAttributes.for,
    isSystemPlayer: true, // This is important for unopposed tests
  };

  const damageTestResult = resolveTest(damageTestAttacker, damageTestDefender, 0);
  
  // 4. Calculate Final Wounds
  const baseImpact = weapon.impact || 0;
  const assistImpact = context.assistingModels || 0;
  const totalImpact = baseImpact + assistImpact;

  const defenderAR = defender.state.armor.total;
  const effectiveAR = Math.max(0, defenderAR - totalImpact);
  const remainingImpact = totalImpact > defenderAR ? totalImpact - defenderAR : 0;
  const woundsDealtByRoll = damageTestResult.pass ? damageTestResult.cascades : 0;
  const woundsInflicted = Math.max(0, woundsDealtByRoll - effectiveAR);

  return {
    hit: true,
    woundsInflicted,
    remainingImpact,
    hitTestResult,
    damageTestResult,
  };
}
