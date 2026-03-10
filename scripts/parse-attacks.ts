/**
 * Parse battle report and output detailed attack actions with Hit/Damage test dice
 */

import { readFileSync } from 'node:fs';

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('Usage: node --import tsx scripts/parse-attacks.ts <battle-report.json>');
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf-8'));

// Get the run report (for validation) or direct report
const battleData = report.runReports ? report.runReports[0] : report;
const audit = battleData.audit || { turns: [] };

console.log('════════════════════════════════════════════════════════════');
console.log('           ATTACK ACTION DETAILS - HIT & DAMAGE TESTS');
console.log('════════════════════════════════════════════════════════════\n');

for (const turn of audit.turns || []) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  TURN ${turn.turn}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  for (const activation of turn.activations || []) {
    const modelName = activation.modelName;
    const sideName = activation.sideName;

    for (const step of activation.steps || []) {
      if (step.actionType === 'close_combat' || step.actionType === 'ranged_combat') {
        const actionType = step.actionType === 'close_combat' ? '⚔️ CLOSE COMBAT' : '🔫 RANGED COMBAT';
        const weaponName = step.details?.weaponName || 'Unknown';
        const target = step.targets?.[0]?.modelName || 'Unknown';
        const targetSide = step.targets?.[0]?.side || 'Unknown';

        console.log(`\n${actionType}`);
        console.log(`  Attacker: ${modelName} (${sideName})`);
        console.log(`  Weapon: ${weaponName}`);
        console.log(`  Target: ${target} (${targetSide})`);

        // Hit Test - check multiple locations
        const attackResult = step.details?.attackResult;
        const hitTestResult = attackResult?.result?.hitTestResult || 
                              attackResult?.hitTestResult ||
                              step.opposedTest;
        const hitNotation = hitTestResult?.pass === true ? 'pass' : hitTestResult?.pass === false ? 'fail' : 'n/a';

        if (hitTestResult) {
          console.log(`\n  📊 HIT TEST:`);
          console.log(`    Result: ${hitTestResult.pass ? '✅ HIT' : '❌ MISS'}`);
          console.log(`    Score: ${hitTestResult.score}`);

          // Show rolls if available
          if (hitTestResult.p1Rolls && hitTestResult.p1Rolls.length > 0) {
            const rolls = hitTestResult.p1Rolls.map((r: any) => typeof r === 'object' ? r.value : r).join(', ');
            console.log(`    Attacker Rolls: [${rolls}]`);
          }
          if (hitTestResult.p2Rolls && hitTestResult.p2Rolls.length > 0) {
            const rolls = hitTestResult.p2Rolls.map((r: any) => typeof r === 'object' ? r.value : r).join(', ');
            console.log(`    Defender Rolls: [${rolls}]`);
          }

          if (hitTestResult.participant1Score !== undefined) {
            console.log(`    Attacker Score: ${hitTestResult.participant1Score}`);
          }
          if (hitTestResult.participant2Score !== undefined) {
            console.log(`    Defender Score: ${hitTestResult.participant2Score}`);
          }
          if (hitTestResult.cascades !== undefined) {
            console.log(`    Cascades: ${hitTestResult.cascades}`);
          }
          if (hitTestResult.p1FinalScore !== undefined) {
            console.log(`    Attacker Final: ${hitTestResult.p1FinalScore}`);
          }
          if (hitTestResult.p2FinalScore !== undefined) {
            console.log(`    Defender Final: ${hitTestResult.p2FinalScore}`);
          }

          // Show pools
          if (hitTestResult.finalPools) {
            const pools = hitTestResult.finalPools;
            if (pools.p1 || pools.p2) {
              console.log(`    Pools: P1=${pools.p1 ?? '?'}, P2=${pools.p2 ?? '?'}`);
            }
          }
        }

        // Damage Test (only if hit)
        const damageResolution = attackResult?.result?.damageResolution || 
                                 attackResult?.damageResolution ||
                                 step.details?.react?.result?.result?.damageResolution;
        const damageNotation = damageResolution?.damageTestResult?.pass === true
          ? 'pass'
          : damageResolution?.damageTestResult?.pass === false
            ? 'fail'
            : 'n/a';
        console.log(`  Notation: ${step.actionType} ${hitNotation}/${damageNotation}(${target})`);

        if (damageResolution && hitTestResult?.pass) {
          console.log(`\n  💥 DAMAGE RESOLUTION:`);
          console.log(`    Impact: ${damageResolution.impact}`);
          console.log(`    Wounds Added: ${damageResolution.woundsAdded}`);
          console.log(`    Stun Wounds: ${damageResolution.stunWoundsAdded}`);
          console.log(`    Delay Tokens: ${damageResolution.delayTokensAdded}`);

          const damageTestResult = damageResolution.damageTestResult;
          if (damageTestResult && damageTestResult !== '[truncated]' && typeof damageTestResult === 'object') {
            if (damageTestResult.pass !== undefined) {
              console.log(`    Damage Test: ${damageTestResult.pass ? '✅ PASSED' : '❌ FAILED'}`);
              console.log(`    Score: ${damageTestResult.score}`);
            }
            if (damageTestResult.rolls && damageTestResult.rolls.length > 0) {
              const rolls = damageTestResult.rolls.map((r: any) => typeof r === 'object' ? r.value : r).join(', ');
              console.log(`    Rolls: [${rolls}]`);
            }
            if (damageTestResult.pool !== undefined) {
              console.log(`    Pool: FOR ${damageTestResult.pool}`);
            }
          } else if (damageResolution.woundsAdded > 0) {
            console.log(`    (Damage test details truncated)`);
          }
        }

        // Normalized result
        const normalized = step.details?.normalized;
        if (normalized) {
          console.log(`\n  📋 FINAL: Hit=${normalized.hit}, KO=${normalized.ko}, Elim=${normalized.eliminated}`);
        }
      }
    }
  }
}

console.log('\n════════════════════════════════════════════════════════════');
