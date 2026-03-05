/**
 * Simple Duel: Two Average characters with Sword, Broad + Armored Gear + Armor, Light + Shield, Small
 * Manually resolve close combat attacks with full dice details
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Character } from '../src/lib/mest-tactics/core/Character';
import { buildProfile } from '../src/lib/mest-tactics/mission/assembly-builder';
import { resolveHitTest, HitTestContext } from '../src/lib/mest-tactics/subroutines/hit-test';
import { resolveDamage } from '../src/lib/mest-tactics/subroutines/damage-test';
import { performTest, TestDice, DiceType } from '../src/lib/mest-tactics/subroutines/dice-roller';
import { gameData } from '../src/lib/data';

interface DuelLog {
  turn: number;
  attacker: string;
  defender: string;
  action: string;
  hitTest: {
    pass: boolean;
    score: number;
    attackerRolls: number[];
    defenderRolls: number[];
    attackerPool: string;
    defenderPool: string;
    attackerTotal: number;
    defenderTotal: number;
    cascades: number;
  };
  damageTest?: {
    pass: boolean;
    score: number;
    rolls: number[];
    pool: string;
    total: number;
    impact: number;
    armor: number;
    wounds: number;
  };
  result: {
    hit: boolean;
    ko: boolean;
    eliminated: boolean;
    wounds: number;
    totalWounds: number;
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
): { rolls: number[]; successes: number; total: number; pool: string } {
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

  // Build pool string
  const poolParts: string[] = [];
  if ((finalDice.base ?? 0) > 0) poolParts.push(`${finalDice.base ?? 0}b`);
  if ((finalDice.modifier ?? 0) > 0) poolParts.push(`${finalDice.modifier ?? 0}m`);
  if ((finalDice.wild ?? 0) > 0) poolParts.push(`${finalDice.wild ?? 0}w`);
  const pool = poolParts.join(' + ') || '2b';

  return { rolls, successes, total, pool };
}

function runDuel(): DuelLog[] {
  const logs: DuelLog[] = [];
  
  // Create profiles: Average + Sword, Broad + Armored Gear + Armor, Light + Shield, Small
  const profile = buildProfile('Average', { 
    itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'] 
  });
  
  // Create characters
  const alpha = new Character({ ...profile, name: 'Alpha Duelist' });
  const bravo = new Character({ ...profile, name: 'Bravo Duelist' });
  
  // Manually set armor (Shield Small AR 0 + Armored Gear AR 0 + Armor Light AR 2 = 2)
  alpha.state.armor.total = 2;
  bravo.state.armor.total = 2;
  
  // Set initial positions
  alpha.position = { x: 5, y: 5 };
  bravo.position = { x: 6, y: 5 };
  
  // Get weapon (Sword, Broad)
  const sword = gameData.melee_weapons['Sword, Broad'];
  
  console.log('⚔️  DUEL: Average vs Average\n');
  console.log('Loadout: Sword, Broad + Armored Gear + Armor, Light + Shield, Small\n');
  console.log('📋 Character Profiles:');
  console.log(`  Alpha: CCA ${alpha.finalAttributes.cca}, REF ${alpha.finalAttributes.ref}, FOR ${alpha.finalAttributes.for}, STR ${alpha.finalAttributes.str}, SIZ ${alpha.finalAttributes.siz}`);
  console.log(`    Equipment: ${profile.equipment?.map(e => e.name).join(' + ')}`);
  console.log(`    Armor: AR ${alpha.state.armor.total} (Shield Small + Armored Gear + Armor Light = 0+0+2)`);
  console.log(`  Bravo: CCA ${bravo.finalAttributes.cca}, REF ${bravo.finalAttributes.ref}, FOR ${bravo.finalAttributes.for}, STR ${bravo.finalAttributes.str}, SIZ ${bravo.finalAttributes.siz}`);
  console.log(`    Equipment: ${profile.equipment?.map(e => e.name).join(' + ')}`);
  console.log(`    Armor: AR ${bravo.state.armor.total} (Shield Small + Armored Gear + Armor Light = 0+0+2)`);
  console.log('\n────────────────────────────────────────────────────────────\n');
  
  let turn = 1;
  let attacker = alpha;
  let defender = bravo;
  
  while (!alpha.state.isKOd && !alpha.state.isEliminated &&
         !bravo.state.isKOd && !bravo.state.isEliminated && turn <= 50) {

    console.log(`📍 TURN ${turn}`);
    console.log(`  ${attacker.profile.name} attacks ${defender.profile.name}`);

    // === HIT TEST (Close Combat: CCA vs CCA) ===
    const attackerRolls = performTestWithRolls(
      attacker.finalAttributes.cca,
      { base: 2 },
      {},
      Math.random
    );

    const defenderRolls = performTestWithRolls(
      defender.finalAttributes.cca,
      { base: 2 },
      {},
      Math.random
    );

    const hitScore = attackerRolls.total - defenderRolls.total;
    const hitPass = hitScore >= 0; // Active character wins ties (score 0 means tie)
    const cascades = hitPass ? hitScore : 0;

    console.log(`\n  HIT TEST:`);
    console.log(`    Attacker: CCA ${attacker.finalAttributes.cca} + 2b [${attackerRolls.rolls.join(', ')}] = ${attackerRolls.successes} successes + ${attacker.finalAttributes.cca} = ${attackerRolls.total} — ${hitPass ? 'PASS' : 'FAIL'}`);
    console.log(`    Defender: CCA ${defender.finalAttributes.cca} + 2b [${defenderRolls.rolls.join(', ')}] = ${defenderRolls.successes} successes + ${defender.finalAttributes.cca} = ${defenderRolls.total}`);
    console.log(`    Result: ${hitPass ? `HIT (Cascades: ${cascades})` : 'MISS'}`);
    
    let damageWounds = 0;
    let stunWounds = 0;
    let damageTestInfo = undefined;

    if (hitPass) {
      // === DAMAGE TEST ===
      // Per rules-damage-and-morale.md: Damage Test is Opposed Test vs FOR
      // Sword, Broad dmg = "2+2m" = 2 + 2 modifier dice (d6)
      // Impact = weapon impact (no STR bonus in QSR)
      const impact = sword.impact || 0;

      // Parse damage formula "2+2m" = 2 (base value) + 2 modifier dice
      const dmgBase = 2; // From "2" in "2+2m"
      const dmgModifierDice = 2; // From "2m" in "2+2m" (2 modifier dice = 2d6)
      
      // Attacker rolls damage: dmgBase + dmgModifierDice (d6)
      const damageDice: TestDice = { modifier: dmgModifierDice };
      const damageRolls = performTestWithRolls(
        dmgBase,
        damageDice,
        {},
        Math.random
      );

      // Defender rolls FOR for damage test
      const defenderForRolls = performTestWithRolls(
        defender.finalAttributes.for,
        { base: 2 },
        {},
        Math.random
      );

      // Damage test score
      const damageScore = damageRolls.total - defenderForRolls.total;
      const damagePass = damageScore >= 0; // Active character wins ties

      // Calculate wounds
      let wounds = 0;
      // Effective AR = Armor - Impact (min 0)
      const effectiveAR = Math.max(0, defender.state.armor.total - impact);
      if (damagePass) {
        wounds = Math.max(0, damageScore - effectiveAR);
      }

      console.log(`\n  DAMAGE TEST:`);
      console.log(`    Attacker: Dmg ${dmgBase} + ${dmgModifierDice}m [${damageRolls.rolls.join(', ')}] = ${damageRolls.successes} successes + ${dmgBase} = ${damageRolls.total} — ${damagePass ? 'PASS' : 'FAIL'}`);
      console.log(`    Defender: FOR ${defender.finalAttributes.for} + 2b [${defenderForRolls.rolls.join(', ')}] = ${defenderForRolls.successes} successes + ${defender.finalAttributes.for} = ${defenderForRolls.total}`);
      console.log(`    Armor: ${defender.state.armor.total} - Impact ${impact} = Effective AR ${effectiveAR}`);
      console.log(`    Wounds: ${wounds}`);
      
      damageWounds = wounds;
      
      damageTestInfo = {
        pass: damagePass,
        score: damageScore,
        rolls: damageRolls.rolls,
        pool: damageRolls.pool,
        total: damageRolls.total,
        impact,
        armor: defender.state.armor.total,
        wounds,
      };
    }
    
    // Apply wounds
    if (hitPass && damageWounds > 0) {
      defender.state.wounds += damageWounds;
    }

    // Check KO/Elimination
    const siz = defender.finalAttributes.siz;
    const isKOd = defender.state.wounds >= siz;
    const isEliminated = defender.state.wounds >= siz + 3;
    
    // Update character state
    if (isEliminated) {
      defender.state.isEliminated = true;
      defender.state.isKOd = false;
    } else if (isKOd) {
      defender.state.isKOd = true;
    }

    console.log(`\n  📋 RESULT:`);
    console.log(`    ${defender.profile.name}: ${defender.state.wounds}/${siz} wounds`);
    if (isEliminated) {
      console.log(`    ☠️  ELIMINATED!`);
    } else if (isKOd) {
      console.log(`    💀 KO'd!`);
    }
    
    // Log the action
    logs.push({
      turn,
      attacker: attacker.profile.name,
      defender: defender.profile.name,
      action: 'Close Combat Attack',
      hitTest: {
        pass: hitPass,
        score: hitScore,
        attackerRolls: attackerRolls.rolls,
        defenderRolls: defenderRolls.rolls,
        attackerPool: attackerRolls.pool,
        defenderPool: defenderRolls.pool,
        attackerTotal: attackerRolls.total,
        defenderTotal: defenderRolls.total,
        cascades,
      },
      damageTest: damageTestInfo,
      result: {
        hit: hitPass,
        ko: isKOd,
        eliminated: isEliminated,
        wounds: damageWounds,
        totalWounds: defender.state.wounds,
      },
    });
    
    console.log();
    
    // Switch turns
    [attacker, defender] = [defender, attacker];
    turn++;
  }
  
  console.log('────────────────────────────────────────────────────────────');
  console.log(`\n🏆 Winner: ${alpha.state.isKOd || alpha.state.isEliminated ? 'Bravo' : alpha.state.isKOd || bravo.state.isEliminated ? 'Alpha' : 'Draw'}`);
  console.log(`📊 Turns: ${turn - 1}`);
  console.log(`\n📍 Final State:`);
  console.log(`  Alpha: ${alpha.state.isEliminated ? '☠️  ELIMINATED' : alpha.state.isKOd ? '💀 KO\'d' : '✅ Active'} (${alpha.state.wounds} wounds)`);
  console.log(`  Bravo: ${bravo.state.isEliminated ? '☠️  ELIMINATED' : bravo.state.isKOd ? '💀 KO\'d' : '✅ Active'} (${bravo.state.wounds} wounds)`);
  
  return logs;
}

// Run the duel
const logs = runDuel();

// Save to JSON
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
mkdirSync(outputDir, { recursive: true });
const reportPath = join(outputDir, `duel-${timestamp}.json`);
writeFileSync(reportPath, JSON.stringify(logs, null, 2));
console.log(`\n📁 JSON Report: ${reportPath}`);
