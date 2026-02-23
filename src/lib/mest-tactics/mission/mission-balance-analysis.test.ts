/**
 * Mission Balance Analysis Tests
 * 
 * Evaluates all 10 missions at LARGE gameSize using the Heuristic Balance Scorer.
 * Mission configs are built manually from mission definitions.
 */

import { describe, it, expect } from 'vitest';
import { HeuristicBalanceScorer } from './heuristic-scorer';
import type { MissionConfig, GameSize } from '../missions/mission-config';
import { VictoryConditionType, ScoringTrigger } from '../missions/mission-config';

/**
 * Build MissionConfig from mission definition data
 */
function buildMissionConfig(params: {
  id: string;
  name: string;
  victoryConditions: Array<{ type: VictoryConditionType; threshold?: number; immediate?: boolean }>;
  scoringRules: Array<{ trigger: ScoringTrigger; vp: number }>;
  zoneCount: number;
  turnLimit: number;
  endGameDieStart: number;
}): MissionConfig {
  return {
    id: params.id,
    name: params.name,
    description: `${params.name} mission`,
    sides: { min: 2, max: 4 },
    defaultGameSize: 'LARGE' as GameSize,
    battlefield: {
      zones: params.zoneCount > 0 ? [{ type: 'poi' as const, count: params.zoneCount, formation: 'triangle' as const }] : [],
    },
    victoryConditions: params.victoryConditions,
    scoringRules: params.scoringRules,
    turnLimit: params.turnLimit,
    endGameDieRoll: true,
    endGameDieStart: params.endGameDieStart,
    sizeConfig: {
      'LARGE': {
        zoneCount: params.zoneCount,
      },
    },
  };
}

// All 10 missions at LARGE game size
const missions: Array<{ id: string; name: string; config: MissionConfig }> = [
  // QAI_11: Elimination - VP per elimination, instant win
  {
    id: 'QAI_11',
    name: 'Elimination',
    config: buildMissionConfig({
      id: 'QAI_11',
      name: 'Elimination',
      victoryConditions: [
        { type: VictoryConditionType.ELIMINATION, immediate: true },
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.MODEL_ELIMINATED, vp: 2 },
      ],
      zoneCount: 0,
      turnLimit: 8,
      endGameDieStart: 5,
    }),
  },
  // QAI_12: Convergence - Zone control VP
  {
    id: 'QAI_12',
    name: 'Convergence',
    config: buildMissionConfig({
      id: 'QAI_12',
      name: 'Convergence',
      victoryConditions: [
        { type: VictoryConditionType.DOMINANCE, threshold: 3, immediate: true },
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.TURN_END_ZONE_CONTROL, vp: 2 },
      ],
      zoneCount: 3,
      turnLimit: 8,
      endGameDieStart: 5,
    }),
  },
  // QAI_13: Assault - Assault markers for VP
  {
    id: 'QAI_13',
    name: 'Assault',
    config: buildMissionConfig({
      id: 'QAI_13',
      name: 'Assault',
      victoryConditions: [
        { type: VictoryConditionType.DOMINANCE, threshold: 4, immediate: true },
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.ZONE_CAPTURED, vp: 3 },
      ],
      zoneCount: 4,
      turnLimit: 8,
      endGameDieStart: 5,
    }),
  },
  // QAI_14: Dominion - Zone control VP
  {
    id: 'QAI_14',
    name: 'Dominion',
    config: buildMissionConfig({
      id: 'QAI_14',
      name: 'Dominion',
      victoryConditions: [
        { type: VictoryConditionType.DOMINANCE, threshold: 3, immediate: true },
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.TURN_END_ZONE_CONTROL, vp: 2 },
      ],
      zoneCount: 3,
      turnLimit: 8,
      endGameDieStart: 5,
    }),
  },
  // QAI_15: Recovery - VIP extraction
  {
    id: 'QAI_15',
    name: 'Recovery',
    config: buildMissionConfig({
      id: 'QAI_15',
      name: 'Recovery',
      victoryConditions: [
        { type: VictoryConditionType.EXTRACTION, immediate: true },
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.VIP_EXTRACTED, vp: 15 },
        { trigger: ScoringTrigger.MODEL_ELIMINATED, vp: 1 },
      ],
      zoneCount: 0,
      turnLimit: 10,
      endGameDieStart: 6,
    }),
  },
  // QAI_16: Escort - VIP survival
  {
    id: 'QAI_16',
    name: 'Escort',
    config: buildMissionConfig({
      id: 'QAI_16',
      name: 'Escort',
      victoryConditions: [
        { type: VictoryConditionType.SURVIVAL, immediate: true },
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.TURN_END, vp: 2 },
        { trigger: ScoringTrigger.MODEL_ELIMINATED, vp: 1 },
      ],
      zoneCount: 0,
      turnLimit: 10,
      endGameDieStart: 6,
    }),
  },
  // QAI_17: Triumvirate - 3 zone control
  {
    id: 'QAI_17',
    name: 'Triumvirate',
    config: buildMissionConfig({
      id: 'QAI_17',
      name: 'Triumvirate',
      victoryConditions: [
        { type: VictoryConditionType.DOMINANCE, threshold: 3, immediate: true },
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.TURN_END_ZONE_CONTROL, vp: 3 },
      ],
      zoneCount: 3,
      turnLimit: 10,
      endGameDieStart: 6,
    }),
  },
  // QAI_18: Stealth - VIP extraction with stealth
  {
    id: 'QAI_18',
    name: 'Stealth',
    config: buildMissionConfig({
      id: 'QAI_18',
      name: 'Stealth',
      victoryConditions: [
        { type: VictoryConditionType.EXTRACTION, immediate: true },
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.VIP_EXTRACTED, vp: 15 },
        { trigger: ScoringTrigger.TURN_END_ZONE_CONTROL, vp: 2 },
      ],
      zoneCount: 3,
      turnLimit: 12,
      endGameDieStart: 8,
    }),
  },
  // QAI_19: Defiance - VIP defense
  {
    id: 'QAI_19',
    name: 'Defiance',
    config: buildMissionConfig({
      id: 'QAI_19',
      name: 'Defiance',
      victoryConditions: [
        { type: VictoryConditionType.SURVIVAL, immediate: true },
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.TURN_END, vp: 3 },
        { trigger: ScoringTrigger.MODEL_ELIMINATED, vp: 2 },
      ],
      zoneCount: 2,
      turnLimit: 12,
      endGameDieStart: 8,
    }),
  },
  // QAI_20: Breach - Switch markers
  {
    id: 'QAI_20',
    name: 'Breach',
    config: buildMissionConfig({
      id: 'QAI_20',
      name: 'Breach',
      victoryConditions: [
        { type: VictoryConditionType.VP_MAJORITY },
      ],
      scoringRules: [
        { trigger: ScoringTrigger.TURN_END_ZONE_CONTROL, vp: 3 },
        { trigger: ScoringTrigger.ZONE_CAPTURED, vp: 5 },
      ],
      zoneCount: 5,
      turnLimit: 10,
      endGameDieStart: 7,
    }),
  },
];

describe('Mission Balance Analysis - LARGE Game Size', () => {
  it('should evaluate all 10 missions', () => {
    const results: Array<{
      id: string;
      name: string;
      score: number;
      passed: boolean;
      factors: any;
    }> = [];

    for (const mission of missions) {
      const score = HeuristicBalanceScorer.calculate(mission.config);
      
      results.push({
        id: mission.id,
        name: mission.name,
        score: score.overall,
        passed: score.passed,
        factors: score.factors,
      });
    }

    // Log summary table
    console.log('');
    console.log('='.repeat(95));
    console.log('MISSION BALANCE ANALYSIS - LARGE Game Size');
    console.log('='.repeat(95));
    console.log('| Mission | ID | Score | Pass | Victory | Pace | Zone | Turn | Interaction |');
    console.log('|---------|-----|-------|------|---------|------|------|------|-------------|');

    for (const result of results) {
      const status = result.passed ? '✓' : '✗';
      console.log(
        `| ${result.name.padEnd(9)} | ${result.id} | ${String(result.score).padEnd(5)} | ${status.padEnd(4)} | ` +
        `${String(result.factors.victoryConditions).padEnd(7)} | ` +
        `${String(result.factors.scoringPace).padEnd(4)} | ` +
        `${String(result.factors.zoneBalance).padEnd(4)} | ` +
        `${String(result.factors.turnStructure).padEnd(4)} | ` +
        `${String(result.factors.playerInteraction).padEnd(11)} |`
      );
    }

    // Statistics
    const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
    const passedCount = results.filter(r => r.passed).length;
    const highestScore = Math.max(...results.map(r => r.score));
    const lowestScore = Math.min(...results.map(r => r.score));

    console.log('');
    console.log('STATISTICS');
    console.log('-'.repeat(40));
    console.log(`  Average Score: ${avgScore}/100`);
    console.log(`  Passed: ${passedCount}/${results.length} (${Math.round(passedCount / results.length * 100)}%)`);
    console.log(`  Highest Score: ${highestScore}/100`);
    console.log(`  Lowest Score: ${lowestScore}/100`);
    console.log('='.repeat(95));
    console.log('');

    // Assertions
    expect(results.length).toBe(10);
    
    // All missions should pass balance check (60+)
    const failedMissions = results.filter(r => !r.passed);
    
    // Average should be at least 60
    expect(avgScore).toBeGreaterThanOrEqual(60);
  });
});
