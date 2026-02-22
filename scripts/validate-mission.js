#!/usr/bin/env node

/**
 * Mission Config Validator CLI
 * 
 * Usage:
 *   npm run validate:mission -- <path-to-json>
 *   node scripts/validate-mission.js <path-to-json>
 * 
 * Examples:
 *   npm run validate:mission -- src/data/missions/qai-01-elimination.json
 *   npm run validate:mission -- src/data/missions/templates/mission-template.json
 */

import { readFileSync } from 'fs';

function validate() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Mission Config Validator
========================

Usage:
  npm run validate:mission -- <path-to-json>
  node scripts/validate-mission.js <path-to-json>

Examples:
  npm run validate:mission -- src/data/missions/qai-01-elimination.json
  npm run validate:mission -- src/data/missions/templates/mission-template.json
`);
    process.exit(1);
  }

  const filePath = args[0];
  
  try {
    // Read and parse JSON
    console.log(`📄 Validating: ${filePath}`);
    const json = readFileSync(filePath, 'utf-8');
    const config = JSON.parse(json);
    
    console.log('✅ JSON syntax valid');
    
    // Check required fields
    const requiredFields = ['id', 'name', 'description', 'sides', 'victoryConditions', 'scoringRules'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      console.error(`❌ Missing required fields: ${missingFields.join(', ')}`);
      process.exit(1);
    }
    console.log('✅ Required fields present');
    
    // Validate ID format
    if (!/^QAI_[0-9]+$/.test(config.id)) {
      console.warn('⚠️  Warning: Mission ID should match pattern QAI_XX (e.g., QAI_21)');
    } else {
      console.log('✅ Mission ID format valid');
    }
    
    // Validate sides
    if (config.sides.min < 2 || config.sides.max > 4) {
      console.warn('⚠️  Warning: Sides should be between 2 and 4 players');
    }
    if (config.sides.min > config.sides.max) {
      console.error('❌ Error: sides.min cannot be greater than sides.max');
      process.exit(1);
    }
    console.log('✅ Sides configuration valid');
    
    // Validate victory conditions
    if (!Array.isArray(config.victoryConditions) || config.victoryConditions.length === 0) {
      console.error('❌ Error: At least one victory condition is required');
      process.exit(1);
    }
    
    const validVictoryTypes = ['elimination', 'dominance', 'extraction', 'survival', 'vp_majority', 'courier', 'rupture', 'harvest'];
    for (const vc of config.victoryConditions) {
      if (!validVictoryTypes.includes(vc.type)) {
        console.warn(`⚠️  Warning: Unknown victory condition type: ${vc.type}`);
      }
      if (vc.type === 'dominance' && !vc.threshold) {
        console.error('❌ Error: Dominance victory condition requires threshold');
        process.exit(1);
      }
    }
    console.log('✅ Victory conditions valid');
    
    // Validate scoring rules
    if (!Array.isArray(config.scoringRules) || config.scoringRules.length === 0) {
      console.warn('⚠️  Warning: No scoring rules defined - mission may lack progression');
    } else {
      const validTriggers = ['turn.end', 'turn.end.zone_control', 'model.eliminated', 'zone.captured', 'courier.edge_reach', 'vip.extracted', 'vp.destroyed', 'cache.harvested', 'first_blood', 'objective.complete'];
      for (const rule of config.scoringRules) {
        if (!validTriggers.includes(rule.trigger)) {
          console.warn(`⚠️  Warning: Unknown scoring trigger: ${rule.trigger}`);
        }
      }
      console.log('✅ Scoring rules valid');
    }
    
    // Validate turn limit
    if (config.turnLimit) {
      if (config.turnLimit < 6) {
        console.warn('⚠️  Warning: Turn limit below 6 may be too short');
      } else if (config.turnLimit > 15) {
        console.warn('⚠️  Warning: Turn limit above 15 may cause game drag');
      } else {
        console.log('✅ Turn limit valid');
      }
    }
    
    // Balance heuristics
    console.log('\n📊 Balance Analysis:');
    
    // Calculate expected VP per turn
    let vpPerTurn = 0;
    const zoneCount = config.battlefield?.zones?.reduce((sum, z) => sum + z.count, 0) ?? 0;
    
    for (const rule of config.scoringRules) {
      if (rule.trigger === 'turn.end.zone_control') {
        vpPerTurn += (typeof rule.vp === 'number' ? rule.vp : 1) * (zoneCount > 0 ? zoneCount : 2);
      } else if (rule.trigger === 'turn.end') {
        vpPerTurn += typeof rule.vp === 'number' ? rule.vp : 1;
      }
    }
    
    if (vpPerTurn > 6) {
      console.warn('   ⚠️  VP per turn is HIGH - games may end too quickly');
    } else if (vpPerTurn < 1) {
      console.warn('   ⚠️  No turn-based scoring - consider adding steady VP progression');
    } else {
      console.log(`   ✅ VP per turn: ~${vpPerTurn} (balanced)`);
    }
    
    // Check zone count
    if (zoneCount === 0) {
      console.warn('   ⚠️  No zones configured - consider adding for contestation');
    } else if (zoneCount === 1) {
      console.warn('   ⚠️  Only 1 zone - consider 2+ for better contestation');
    } else {
      console.log(`   ✅ Zones: ${zoneCount} (good contestation)`);
    }
    
    // Check victory threshold
    const dominanceVC = config.victoryConditions.find(vc => vc.type === 'dominance');
    if (dominanceVC) {
      const threshold = dominanceVC.threshold;
      if (threshold && threshold < 3) {
        console.warn(`   ⚠️  Victory threshold (${threshold}) is LOW - games may end too quickly`);
      } else if (threshold && threshold > 8) {
        console.warn(`   ⚠️  Victory threshold (${threshold}) is HIGH - games may drag`);
      } else if (threshold) {
        const expectedTurns = Math.ceil(threshold / (vpPerTurn || 1));
        console.log(`   ✅ Expected game length: ~${expectedTurns} turns`);
      }
    }
    
    // Show balance hints if present
    if (config._balance) {
      console.log('\n📋 Designer Notes:');
      if (config._balance.expectedTurns) {
        console.log(`   Expected turns: ${config._balance.expectedTurns}`);
      }
      if (config._balance.difficulty) {
        console.log(`   Difficulty: ${config._balance.difficulty}`);
      }
      if (config._balance.notes) {
        console.log(`   Notes: ${config._balance.notes}`);
      }
    }
    
    console.log('\n✅ Validation PASSED - Mission is ready to play!');
    process.exit(0);
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`❌ Invalid JSON: ${error.message}`);
    } else if (error.code === 'ENOENT') {
      console.error(`❌ File not found: ${filePath}`);
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
    process.exit(1);
  }
}

validate();
