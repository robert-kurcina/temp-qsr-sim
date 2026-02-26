/**
 * R4: Cross-Mission Validation Harness
 *
 * Runs all 10 QAI missions and generates enhanced validation report with:
 * - Automated diff flags for suspicious profile cloning
 * - Report-level diagnostics for low-use tactical mechanics
 * - Classification of expected divergence vs suspicious convergence
 * - Fail-fast on behavior regressions
 */

import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Configuration
// ============================================================================

const MISSIONS = [
  'QAI_11', // Elimination
  'QAI_12', // Convergence
  'QAI_13', // Assault
  'QAI_14', // Dominion
  'QAI_15', // Recovery
  'QAI_16', // Escort
  'QAI_17', // Triumvirate
  'QAI_18', // Stealth
  'QAI_19', // Defiance
  'QAI_20', // Breach
];

const OUTPUT_DIR = join(process.cwd(), 'generated', 'ai-battle-reports');
const SCAN_OUTPUT = join(OUTPUT_DIR, 'mission-scan-summary-qai11-20.json');

// Expected behavior divergence thresholds
const DIVERGENCE_THRESHOLDS = {
  // Minimum difference in action distribution between different mission types
  minActionDistributionDiff: 0.15,
  // Minimum wait usage for missions with defensive objectives
  minWaitUsageDefensive: 0.05,
  // Minimum react usage across all missions
  minReactUsage: 0.02,
  // Minimum bonus action usage
  minBonusActionUsage: 0.05,
  // Minimum passive option usage
  minPassiveOptionUsage: 0.05,
  // Maximum allowed similarity between different missions (suspicious if higher)
  maxSuspiciousSimilarity: 0.85,
};

// Mission groups that should have similar behavior (lower divergence expected)
const SIMILAR_MISSION_GROUPS: Record<string, string[]> = {
  'zone-control': ['QAI_12', 'QAI_14', 'QAI_17'],
  'vip-missions': ['QAI_15', 'QAI_16', 'QAI_18', 'QAI_19'],
  'objective-markers': ['QAI_13', 'QAI_20'],
};

// ============================================================================
// Types
// ============================================================================

interface MissionResult {
  mission: string;
  report: string;
  winner: string;
  turns: number;
  actions: number;
  moves: number;
  ranged: number;
  close: number;
  waits: number;
  reacts: number;
  bonusActions?: {
    offered: number;
    executed: number;
  };
  passiveOptions?: {
    offered: number;
    used: number;
  };
  vp: Record<string, number>;
  rp: Record<string, number>;
  immediate: string | null;
  // R4: Diagnostics
  diagnostics?: MissionDiagnostics;
  flags?: BehaviorFlag[];
}

interface MissionDiagnostics {
  // Action distribution percentages
  actionDistribution: {
    moves: number;
    ranged: number;
    close: number;
    waits: number;
    reacts: number;
    other: number;
  };
  // Tactical mechanics usage rates
  tacticalMechanics: {
    waitRate: number;
    reactRate: number;
    bonusActionRate?: number;
    passiveOptionRate?: number;
  };
  // Behavior fingerprint for comparison
  behaviorFingerprint: string;
}

interface BehaviorFlag {
  type: 'suspicious-convergence' | 'low-wait-usage' | 'low-react-usage' | 'low-bonus-usage' | 'low-passive-usage' | 'action-cloning';
  severity: 'warning' | 'error';
  mission: string;
  description: string;
  details: Record<string, unknown>;
}

interface ScanSummary {
  config: {
    gameSize: string;
    density: number;
    runs: number;
    seed: number;
    lighting: string;
    doctrine: string[];
  };
  results: MissionResult[];
  // R4: Classification
  classification: {
    expectedDivergence: boolean;
    suspiciousConvergence: boolean;
    flags: BehaviorFlag[];
  };
  // R4: Summary statistics
  summary: {
    totalMissions: number;
    passedMissions: number;
    failedMissions: number;
    warningCount: number;
    errorCount: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateBehaviorFingerprint(result: MissionResult): string {
  const dist = result.diagnostics?.actionDistribution;
  if (!dist) return 'unknown';
  
  // Create a simple hash of the action distribution
  const values = [
    dist.moves.toFixed(2),
    dist.ranged.toFixed(2),
    dist.close.toFixed(2),
    dist.waits.toFixed(2),
    dist.reacts.toFixed(2),
  ].join('|');
  
  return values;
}

function calculateSimilarity(a: MissionResult, b: MissionResult): number {
  const distA = a.diagnostics?.actionDistribution;
  const distB = b.diagnostics?.actionDistribution;
  
  if (!distA || !distB) return 0;
  
  // Calculate cosine similarity between action distributions
  const vecA = [distA.moves, distA.ranged, distA.close, distA.waits, distA.reacts];
  const vecB = [distB.moves, distB.ranged, distB.close, distB.waits, distB.reacts];
  
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  if (magA === 0 || magB === 0) return 0;
  
  return dotProduct / (magA * magB);
}

function isInSameGroup(missionA: string, missionB: string): boolean {
  for (const group of Object.values(SIMILAR_MISSION_GROUPS)) {
    if (group.includes(missionA) && group.includes(missionB)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateMissionResult(result: MissionResult, allResults: MissionResult[]): BehaviorFlag[] {
  const flags: BehaviorFlag[] = [];
  const totalActions = result.actions || 1;
  
  // Check wait usage
  const waitRate = result.waits / totalActions;
  if (waitRate < DIVERGENCE_THRESHOLDS.minWaitUsageDefensive) {
    // Check if this is a mission that should have defensive wait usage
    const defensiveMissions = ['QAI_14', 'QAI_19']; // Dominion, Defiance
    if (defensiveMissions.includes(result.mission)) {
      flags.push({
        type: 'low-wait-usage',
        severity: 'warning',
        mission: result.mission,
        description: `Wait usage (${(waitRate * 100).toFixed(1)}%) below threshold for defensive mission`,
        details: {
          waitRate,
          threshold: DIVERGENCE_THRESHOLDS.minWaitUsageDefensive,
          totalActions,
          waits: result.waits,
        },
      });
    }
  }
  
  // Check react usage
  const reactRate = result.reacts / totalActions;
  if (reactRate < DIVERGENCE_THRESHOLDS.minReactUsage) {
    flags.push({
      type: 'low-react-usage',
      severity: 'warning',
      mission: result.mission,
      description: `React usage (${(reactRate * 100).toFixed(1)}%) below minimum threshold`,
      details: {
        reactRate,
        threshold: DIVERGENCE_THRESHOLDS.minReactUsage,
        totalActions,
        reacts: result.reacts,
      },
    });
  }
  
  // Check bonus action usage
  if (result.bonusActions) {
    const bonusRate = result.bonusActions.executed / result.bonusActions.offered;
    if (bonusRate < DIVERGENCE_THRESHOLDS.minBonusActionUsage) {
      flags.push({
        type: 'low-bonus-usage',
        severity: 'warning',
        mission: result.mission,
        description: `Bonus action execution rate (${(bonusRate * 100).toFixed(1)}%) below threshold`,
        details: {
          bonusRate,
          threshold: DIVERGENCE_THRESHOLDS.minBonusActionUsage,
          offered: result.bonusActions.offered,
          executed: result.bonusActions.executed,
        },
      });
    }
  }
  
  // Check passive option usage
  if (result.passiveOptions) {
    const passiveRate = result.passiveOptions.used / result.passiveOptions.offered;
    if (passiveRate < DIVERGENCE_THRESHOLDS.minPassiveOptionUsage) {
      flags.push({
        type: 'low-passive-usage',
        severity: 'warning',
        mission: result.mission,
        description: `Passive option usage rate (${(passiveRate * 100).toFixed(1)}%) below threshold`,
        details: {
          passiveRate,
          threshold: DIVERGENCE_THRESHOLDS.minPassiveOptionUsage,
          offered: result.passiveOptions.offered,
          used: result.passiveOptions.used,
        },
      });
    }
  }
  
  // Check for suspicious convergence with other missions
  for (const other of allResults) {
    if (other.mission === result.mission) continue;
    
    const similarity = calculateSimilarity(result, other);
    const inSameGroup = isInSameGroup(result.mission, other.mission);
    
    // Different mission groups should not have high similarity
    if (!inSameGroup && similarity > DIVERGENCE_THRESHOLDS.maxSuspiciousSimilarity) {
      flags.push({
        type: 'suspicious-convergence',
        severity: 'error',
        mission: result.mission,
        description: `Suspicious behavior similarity with ${other.mission} (${(similarity * 100).toFixed(1)}%)`,
        details: {
          similarity,
          comparedWith: other.mission,
          inSameGroup: false,
          threshold: DIVERGENCE_THRESHOLDS.maxSuspiciousSimilarity,
        },
      });
    }
  }
  
  return flags;
}

function classifyScanResults(results: MissionResult[]): {
  expectedDivergence: boolean;
  suspiciousConvergence: boolean;
  flags: BehaviorFlag[];
} {
  const allFlags: BehaviorFlag[] = [];
  
  // Validate each mission
  for (const result of results) {
    const flags = validateMissionResult(result, results);
    allFlags.push(...flags);
  }
  
  const errorFlags = allFlags.filter(f => f.severity === 'error');
  const warningFlags = allFlags.filter(f => f.severity === 'warning');
  
  return {
    expectedDivergence: errorFlags.length === 0,
    suspiciousConvergence: errorFlags.some(f => f.type === 'suspicious-convergence'),
    flags: allFlags,
  };
}

// ============================================================================
// Report Loading
// ============================================================================

function loadMissionReport(missionId: string): MissionResult | null {
  // Read directory and find latest report
  if (!existsSync(OUTPUT_DIR)) {
    console.error(`Output directory not found: ${OUTPUT_DIR}`);
    return null;
  }
  
  const files_in_dir = readdirSync(OUTPUT_DIR);
  const missionFiles = files_in_dir.filter((f: string) => 
    f.startsWith(`qai-${missionId.split('_')[1]}-validation-`) && f.endsWith('.json')
  );
  
  if (missionFiles.length === 0) {
    console.warn(`No reports found for mission ${missionId}`);
    return null;
  }
  
  // Get latest file
  missionFiles.sort();
  const latestFile = missionFiles[missionFiles.length - 1];
  const reportPath = join(OUTPUT_DIR, latestFile);
  
  try {
    const reportData = JSON.parse(readFileSync(reportPath, 'utf-8'));
    
    // Extract tactical mechanics data if available
    let bonusActions: { offered: number; executed: number } | undefined;
    let passiveOptions: { offered: number; used: number } | undefined;
    
    if (reportData.advancedRules) {
      if (reportData.advancedRules.bonusActions) {
        bonusActions = {
          offered: reportData.advancedRules.bonusActions.optionsOffered,
          executed: reportData.advancedRules.bonusActions.executed,
        };
      }
      if (reportData.advancedRules.passiveOptions) {
        passiveOptions = {
          offered: reportData.advancedRules.passiveOptions.optionsOffered,
          used: reportData.advancedRules.passiveOptions.used,
        };
      }
    }
    
    const totalActions = reportData.totals?.totalActions || 1;

    const result: MissionResult = {
      mission: missionId,
      report: `generated/ai-battle-reports/${latestFile}`,
      winner: reportData.winners ? Object.keys(reportData.winners)[0] : 'Unknown',
      turns: reportData.totals?.turnsCompleted || 0,
      actions: totalActions,
      moves: reportData.totals?.moves || 0,
      ranged: reportData.totals?.rangedCombats || 0,
      close: reportData.totals?.closeCombats || 0,
      waits: reportData.totals?.waits || 0,
      reacts: reportData.totals?.reacts || 0,
      bonusActions,
      passiveOptions,
      vp: reportData.missionRuntime?.vpBySide || {},
      rp: reportData.missionRuntime?.rpBySide || {},
      immediate: reportData.missionRuntime?.immediateWinnerSideId || null,
    };
    
    // Calculate diagnostics
    result.diagnostics = {
      actionDistribution: {
        moves: result.moves / totalActions,
        ranged: result.ranged / totalActions,
        close: result.close / totalActions,
        waits: result.waits / totalActions,
        reacts: result.reacts / totalActions,
        other: 1 - ((result.moves + result.ranged + result.close + result.waits + result.reacts) / totalActions),
      },
      tacticalMechanics: {
        waitRate: result.waits / totalActions,
        reactRate: result.reacts / totalActions,
        bonusActionRate: bonusActions ? bonusActions.executed / bonusActions.offered : 0,
        passiveOptionRate: passiveOptions ? passiveOptions.used / passiveOptions.offered : 0,
      },
      behaviorFingerprint: calculateBehaviorFingerprint(result),
    };
    
    return result;
  } catch (error) {
    console.error(`Error loading report ${reportPath}:`, error);
    return null;
  }
}

// ============================================================================
// Main Execution
// ============================================================================

function runMissionScan(): void {
  console.log('='.repeat(80));
  console.log('R4: Cross-Mission Validation Harness');
  console.log('='.repeat(80));
  console.log('');
  
  const results: MissionResult[] = [];
  
  // Load reports for all missions
  for (const missionId of MISSIONS) {
    console.log(`Loading ${missionId}...`);
    const result = loadMissionReport(missionId);
    if (result) {
      results.push(result);
      console.log(`  ✓ Loaded: ${result.report}`);
      console.log(`    Actions: ${result.actions}, Waits: ${result.waits}, Reacts: ${result.reacts}`);
    } else {
      console.log(`  ✗ Failed to load ${missionId}`);
    }
  }
  
  if (results.length === 0) {
    console.error('No mission reports found. Run individual mission validations first.');
    process.exit(1);
  }
  
  console.log('');
  console.log('Analyzing behavior divergence...');
  
  // Classify results
  const classification = classifyScanResults(results);
  
  // Calculate summary
  const errorCount = classification.flags.filter(f => f.severity === 'error').length;
  const warningCount = classification.flags.filter(f => f.severity === 'warning').length;
  
  const summary: ScanSummary = {
    config: {
      gameSize: 'SMALL',
      density: 50,
      runs: 1,
      seed: 424242,
      lighting: 'TWILIGHT',
      doctrine: ['watchman', 'watchman'],
    },
    results,
    classification,
    summary: {
      totalMissions: results.length,
      passedMissions: results.length - errorCount,
      failedMissions: errorCount,
      warningCount,
      errorCount,
    },
  };
  
  // Print summary
  console.log('');
  console.log('='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Missions: ${summary.summary.totalMissions}`);
  console.log(`Passed: ${summary.summary.passedMissions}`);
  console.log(`Failed: ${summary.summary.failedMissions}`);
  console.log(`Warnings: ${summary.summary.warningCount}`);
  console.log(`Errors: ${summary.summary.errorCount}`);
  console.log('');
  
  // Print flags
  if (classification.flags.length > 0) {
    console.log('FLAGS:');
    console.log('-'.repeat(80));
    for (const flag of classification.flags) {
      const icon = flag.severity === 'error' ? '✗' : '⚠';
      console.log(`${icon} [${flag.type}] ${flag.mission}: ${flag.description}`);
    }
    console.log('');
  }
  
  // Print classification
  console.log('CLASSIFICATION:');
  console.log('-'.repeat(80));
  console.log(`Expected Divergence: ${classification.expectedDivergence ? '✓ YES' : '✗ NO'}`);
  console.log(`Suspicious Convergence: ${classification.suspiciousConvergence ? '⚠ DETECTED' : '✓ NONE'}`);
  console.log('');
  
  // Write output
  writeFileSync(SCAN_OUTPUT, JSON.stringify(summary, null, 2));
  console.log(`Report written to: ${SCAN_OUTPUT}`);
  console.log('');
  
  // Exit with error if there are critical failures
  if (!classification.expectedDivergence) {
    console.error('VALIDATION FAILED: Suspicious behavior convergence detected');
    process.exit(1);
  }
  
  console.log('VALIDATION PASSED');
  process.exit(0);
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runMissionScan();
}

export { runMissionScan, MISSIONS, DIVERGENCE_THRESHOLDS };
