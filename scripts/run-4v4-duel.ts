/**
 * 4v4 Duel: Average characters with Sword, Broad + Armored Gear + Armor, Light + Shield, Small
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Character } from '../src/lib/mest-tactics/core/Character';
import { buildProfile } from '../src/lib/mest-tactics/mission/assembly-builder';
import { gameData } from '../src/lib/data';
import type { TestDice } from '../src/lib/mest-tactics/subroutines/dice-roller';

interface DuelLog {
  turn: number;
  attacker: string;
  defender: string;
  hitTest: {
    attackerAttr: string;
    attackerDice: string;
    attackerRolls: number[];
    attackerSuccesses: number;
    attackerTotal: number;
    attackerPass: boolean;
    defenderAttr: string;
    defenderDice: string;
    defenderRolls: number[];
    defenderSuccesses: number;
    defenderTotal: number;
    cascades: number;
  };
  damageTest?: {
    attackerAttr: string;
    attackerDice: string;
    attackerRolls: number[];
    attackerSuccesses: number;
    attackerTotal: number;
    attackerPass: boolean;
    defenderAttr: string;
    defenderDice: string;
    defenderRolls: number[];
    defenderSuccesses: number;
    defenderTotal: number;
    impact: number;
    armor: number;
    effectiveAR: number;
    wounds: number;
  };
  result: {
    hit: boolean;
    wounds: number;
    totalWounds: number;
    ko: boolean;
    eliminated: boolean;
  };
}

function rollDice(dice: TestDice, roller: () => number = Math.random): { rolls: number[]; successes: number } {
  const rolls: number[] = [];
  let successes = 0;
  
  // Roll base dice (d6): 1-3 = 0, 4-5 = 1, 6 = 2 successes
  for (let i = 0; i < (dice.base || 0); i++) {
    const roll = Math.floor(roller() * 6) + 1;
    rolls.push(roll);
    if (roll >= 6) successes += 2;
    else if (roll >= 4) successes += 1;
  }
  
  // Roll modifier dice (d6): 1-3 = 0, 4-6 = 1 success
  for (let i = 0; i < (dice.modifier || 0); i++) {
    const roll = Math.floor(roller() * 6) + 1;
    rolls.push(roll);
    if (roll >= 4) successes += 1;
  }
  
  // Roll wild dice (d6): 1-3 = 0, 4-5 = 1, 6 = 3 successes
  for (let i = 0; i < (dice.wild || 0); i++) {
    const roll = Math.floor(roller() * 6) + 1;
    rolls.push(roll);
    if (roll >= 6) successes += 3;
    else if (roll >= 4) successes += 1;
  }
  
  return { rolls, successes };
}

function performTestWithRolls(
  attributeValue: number,
  bonusDice: TestDice = {},
  penaltyDice: TestDice = {},
  roller: () => number = Math.random
): { rolls: number[]; successes: number; total: number } {
  // Calculate final dice pool
  const finalDice: TestDice = {
    base: Math.max(2, (bonusDice.base || 0) - (penaltyDice.base || 0)),
    modifier: (bonusDice.modifier || 0) - (penaltyDice.modifier || 0),
    wild: (bonusDice.wild || 0) - (penaltyDice.wild || 0),
  };
  
  // Roll dice and count successes
  const { rolls, successes } = rollDice(finalDice, roller);
  
  // Calculate total (attribute + successes)
  const total = successes + attributeValue;
  
  return { rolls, successes, total };
}

function runDuel(): DuelLog[] {
  const logs: DuelLog[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
  mkdirSync(outputDir, { recursive: true });

  // Create profile: Average + Sword, Broad + Armored Gear + Armor, Light + Shield, Small
  const profile = buildProfile('Average', { 
    itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'] 
  });

  // Get weapon (Sword, Broad)
  const sword = gameData.melee_weapons['Sword, Broad'];

  // Create 4 characters per side
  const alphaChars: Character[] = [];
  const bravoChars: Character[] = [];

  for (let i = 0; i < 4; i++) {
    const alpha = new Character({ ...profile, name: `A${i}` });
    alpha.state.armor.total = 2; // AR 2 from equipment
    alphaChars.push(alpha);

    const bravo = new Character({ ...profile, name: `Z${i}` });
    bravo.state.armor.total = 2; // AR 2 from equipment
    bravoChars.push(bravo);
  }

  console.log('⚔️  4v4 DUEL: Average vs Average\n');
  console.log('Loadout: Sword, Broad + Armored Gear + Armor, Light + Shield, Small\n');
  
  console.log('📋 Alpha Side:');
  alphaChars.forEach(c => {
    console.log(`  ${c.profile.name}: CCA ${c.finalAttributes.cca}, FOR ${c.finalAttributes.for}, SIZ ${c.finalAttributes.siz}, AR ${c.state.armor.total}`);
  });
  console.log('📋 Bravo Side:');
  bravoChars.forEach(c => {
    console.log(`  ${c.profile.name}: CCA ${c.finalAttributes.cca}, FOR ${c.finalAttributes.for}, SIZ ${c.finalAttributes.siz}, AR ${c.state.armor.total}`);
  });
  console.log('\n────────────────────────────────────────────────────────────\n');

  let turn = 1;
  const maxTurns = 50;

  while (turn <= maxTurns) {
    const alphaActive = alphaChars.filter(c => !c.state.isKOd && !c.state.isEliminated);
    const bravoActive = bravoChars.filter(c => !c.state.isKOd && !c.state.isEliminated);

    if (alphaActive.length === 0 || bravoActive.length === 0) {
      break;
    }

    console.log(`📍 TURN ${turn}`);
    console.log(`  Alpha: ${alphaActive.length} active | Bravo: ${bravoActive.length} active\n`);

    // Each active character attacks one enemy
    for (const attacker of alphaActive) {
      if (bravoActive.length === 0) break;
      
      // Pick a random target from active enemies
      const targetIndex = Math.floor(Math.random() * bravoActive.length);
      const defender = bravoChars.find(c => c.id === bravoActive[targetIndex].id)!;

      const logEntry = resolveAttack(attacker, defender, sword, turn);
      logs.push(logEntry);
    }

    for (const attacker of bravoActive) {
      if (alphaActive.length === 0) break;
      
      // Pick a random target from active enemies
      const targetIndex = Math.floor(Math.random() * alphaActive.length);
      const defender = alphaChars.find(c => c.id === alphaActive[targetIndex].id)!;

      const logEntry = resolveAttack(attacker, defender, sword, turn);
      logs.push(logEntry);
    }

    turn++;
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(`\n📊 Turns: ${turn - 1}`);
  console.log(`\n📍 Final State:`);
  console.log('  Alpha Side:');
  alphaChars.forEach(c => {
    const status = c.state.isEliminated ? '☠️  ELIMINATED' : c.state.isKOd ? '💀 KO\'d' : '✅ Active';
    console.log(`    ${c.profile.name}: ${status} (${c.state.wounds} wounds)`);
  });
  console.log('  Bravo Side:');
  bravoChars.forEach(c => {
    const status = c.state.isEliminated ? '☠️  ELIMINATED' : c.state.isKOd ? '💀 KO\'d' : '✅ Active';
    console.log(`    ${c.profile.name}: ${status} (${c.state.wounds} wounds)`);
  });

  const alphaWinner = alphaChars.some(c => !c.state.isKOd && !c.state.isEliminated) && 
                      bravoChars.every(c => c.state.isKOd || c.state.isEliminated);
  const bravoWinner = bravoChars.some(c => !c.state.isKOd && !c.state.isEliminated) && 
                      alphaChars.every(c => c.state.isKOd || c.state.isEliminated);
  
  console.log(`\n🏆 Winner: ${alphaWinner ? 'Alpha' : bravoWinner ? 'Bravo' : 'Draw'}`);

  // Save JSON report
  const reportPath = join(outputDir, `duel-4v4-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(logs, null, 2));
  console.log(`\n📁 JSON Report: ${reportPath}`);

  return logs;
}

function resolveAttack(attacker: Character, defender: Character, sword: any, turn: number): DuelLog {
  console.log(`  ${attacker.profile.name} attacks ${defender.profile.name}`);

  // Parse Cleave trait from weapon
  let cleaveLevel = 0;
  if (sword.traits) {
    for (const trait of sword.traits) {
      if (trait.toLowerCase().startsWith('cleave')) {
        const match = trait.match(/cleave\s*(\d+)?/i);
        cleaveLevel = match && match[1] ? parseInt(match[1]) : 1;
        break;
      }
    }
  }

  // === HIT TEST (Close Combat: CCA vs CCA) ===
  const attackerRolls = performTestWithRolls(attacker.finalAttributes.cca, { base: 2 }, {}, Math.random);
  const defenderRolls = performTestWithRolls(defender.finalAttributes.cca, { base: 2 }, {}, Math.random);

  const hitScore = attackerRolls.total - defenderRolls.total;
  const hitPass = hitScore >= 0; // Active wins ties
  const cascades = hitPass ? hitScore : 0;

  console.log(`    HIT TEST:`);
  console.log(`      Attacker: CCA ${attacker.finalAttributes.cca} + 2b [${attackerRolls.rolls.join(', ')}] = ${attackerRolls.successes} + ${attacker.finalAttributes.cca} = ${attackerRolls.total} — ${hitPass ? 'PASS' : 'FAIL'}`);
  console.log(`      Defender: CCA ${defender.finalAttributes.cca} + 2b [${defenderRolls.rolls.join(', ')}] = ${defenderRolls.successes} + ${defender.finalAttributes.cca} = ${defenderRolls.total}`);

  let damageWounds = 0;
  let damageTestInfo = undefined;

  if (hitPass) {
    console.log(`      Result: HIT (Cascades: ${cascades})${cleaveLevel > 0 ? ` [Weapon has Cleave ${cleaveLevel}]` : ''}`);

    // === DAMAGE TEST ===
    const impact = sword.impact || 0;
    const dmgBase = 2;
    const dmgModifierDice = 2;

    const damageRolls = performTestWithRolls(dmgBase, { modifier: dmgModifierDice }, {}, Math.random);
    const defenderForRolls = performTestWithRolls(defender.finalAttributes.for, { base: 2 }, {}, Math.random);

    const damageScore = damageRolls.total - defenderForRolls.total;
    const damagePass = damageScore >= 0; // Active wins ties

    const effectiveAR = Math.max(0, defender.state.armor.total - impact);
    if (damagePass) {
      damageWounds = Math.max(0, damageScore - effectiveAR);
      
      // Apply Cleave extra wounds (X-1 for Cleave level X >= 2) BEFORE KO check
      if (cleaveLevel >= 2) {
        const cleaveExtraWounds = cleaveLevel - 1;
        damageWounds += cleaveExtraWounds;
        console.log(`      Cleave ${cleaveLevel}: +${cleaveExtraWounds} extra wound(s)`);
      }
    }

    console.log(`    DAMAGE TEST:`);
    console.log(`      Attacker: Dmg ${dmgBase} + ${dmgModifierDice}m [${damageRolls.rolls.join(', ')}] = ${damageRolls.successes} + ${dmgBase} = ${damageRolls.total} — ${damagePass ? 'PASS' : 'FAIL'}`);
    console.log(`      Defender: FOR ${defender.finalAttributes.for} + 2b [${defenderForRolls.rolls.join(', ')}] = ${defenderForRolls.successes} + ${defender.finalAttributes.for} = ${defenderForRolls.total}`);
    console.log(`      Armor: ${defender.state.armor.total} - Impact ${impact} = Effective AR ${effectiveAR}`);
    console.log(`      Wounds: ${damageWounds}`);

    damageTestInfo = {
      attackerAttr: `Dmg ${dmgBase}`,
      attackerDice: `${dmgModifierDice}m`,
      attackerRolls: damageRolls.rolls,
      attackerSuccesses: damageRolls.successes,
      attackerTotal: damageRolls.total,
      attackerPass: damagePass,
      defenderAttr: `FOR ${defender.finalAttributes.for}`,
      defenderDice: '2b',
      defenderRolls: defenderForRolls.rolls,
      defenderSuccesses: defenderForRolls.successes,
      defenderTotal: defenderForRolls.total,
      impact,
      armor: defender.state.armor.total,
      effectiveAR,
      wounds: damageWounds,
    };
  } else {
    console.log(`      Result: MISS`);
  }

  // Apply wounds
  if (hitPass && damageWounds > 0) {
    defender.state.wounds += damageWounds;
  }

  // Check KO/Elimination
  const siz = defender.finalAttributes.siz;
  const isKOd = defender.state.wounds >= siz;
  const isEliminated = defender.state.wounds >= siz + 3;

  // Cleave trait: If target is KO'd by an attack with Cleave, it is instead Eliminated
  let actuallyEliminated = isEliminated;
  let actuallyKOd = isKOd && !isEliminated;
  
  if (cleaveLevel > 0 && isKOd && !isEliminated) {
    // Cleave converts KO to Elimination
    actuallyEliminated = true;
    actuallyKOd = false;
  }

  // Update character state
  if (actuallyEliminated) {
    defender.state.isEliminated = true;
    defender.state.isKOd = false;
  } else if (actuallyKOd) {
    defender.state.isKOd = true;
  }

  const statusText = actuallyEliminated ? ' — ELIMINATED!' : actuallyKOd ? ' — KO\'d!' : '';
  const cleaveNote = cleaveLevel > 0 && isKOd && actuallyEliminated ? ' [Cleave converts KO to Elimination]' : '';
  console.log(`    ${defender.profile.name}: ${defender.state.wounds}/${siz} wounds${statusText}${cleaveNote}\n`);

  return {
    turn,
    attacker: attacker.profile.name,
    defender: defender.profile.name,
    hitTest: {
      attackerAttr: `CCA ${attacker.finalAttributes.cca}`,
      attackerDice: '2b',
      attackerRolls: attackerRolls.rolls,
      attackerSuccesses: attackerRolls.successes,
      attackerTotal: attackerRolls.total,
      attackerPass: hitPass,
      defenderAttr: `CCA ${defender.finalAttributes.cca}`,
      defenderDice: '2b',
      defenderRolls: defenderRolls.rolls,
      defenderSuccesses: defenderRolls.successes,
      defenderTotal: defenderRolls.total,
      cascades,
    },
    damageTest: damageTestInfo,
    result: {
      hit: hitPass,
      wounds: damageWounds,
      totalWounds: defender.state.wounds,
      ko: isKOd,
      eliminated: isEliminated,
    },
  };
}

runDuel();
