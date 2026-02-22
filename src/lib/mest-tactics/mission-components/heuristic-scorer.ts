import { MissionConfig } from '../mission-config';
import { BalanceValidationResult, BalanceWarning } from './balance-validator';

/**
 * Heuristic Balance Score
 * Detailed scoring breakdown for mission balance analysis
 */
export interface HeuristicBalanceScore {
  /** Overall score 0-100 */
  overall: number;
  /** Pass/fail threshold (60+) */
  passed: boolean;
  /** Detailed factor scores */
  factors: {
    /** Victory condition balance */
    victoryConditions: number;
    /** Scoring pace balance */
    scoringPace: number;
    /** Zone/objective balance */
    zoneBalance: number;
    /** Turn structure balance */
    turnStructure: number;
    /** Player interaction balance */
    playerInteraction: number;
  };
  /** Detailed feedback */
  feedback: BalanceFeedback[];
}

/**
 * Balance feedback item
 */
export interface BalanceFeedback {
  /** Factor being addressed */
  factor: keyof HeuristicBalanceScore['factors'];
  /** Severity */
  severity: 'critical' | 'warning' | 'suggestion';
  /** Issue description */
  issue: string;
  /** Recommended fix */
  recommendation: string;
  /** Impact on score */
  scoreImpact: number;
}

/**
 * Heuristic Balance Scorer
 * Provides detailed 0-100 balance scoring with factor breakdown
 */
export class HeuristicBalanceScorer {
  /**
   * Calculate detailed balance score
   */
  static calculate(config: MissionConfig): HeuristicBalanceScore {
    const factors = {
      victoryConditions: this.scoreVictoryConditions(config),
      scoringPace: this.scoreScoringPace(config),
      zoneBalance: this.scoreZoneBalance(config),
      turnStructure: this.scoreTurnStructure(config),
      playerInteraction: this.scorePlayerInteraction(config),
    };

    // Weighted average (victory and scoring are most important)
    const weights = {
      victoryConditions: 0.25,
      scoringPace: 0.25,
      zoneBalance: 0.20,
      turnStructure: 0.15,
      playerInteraction: 0.15,
    };

    const overall = Math.round(
      factors.victoryConditions * weights.victoryConditions +
      factors.scoringPace * weights.scoringPace +
      factors.zoneBalance * weights.zoneBalance +
      factors.turnStructure * weights.turnStructure +
      factors.playerInteraction * weights.playerInteraction
    );

    const feedback = this.generateFeedback(config, factors);

    return {
      overall,
      passed: overall >= 60,
      factors,
      feedback,
    };
  }

  /**
   * Score victory conditions (0-100)
   */
  private static scoreVictoryConditions(config: MissionConfig): number {
    let score = 100;
    const vcs = config.victoryConditions;

    // Must have at least one victory condition
    if (vcs.length === 0) {
      return 0;
    }

    // Check for immediate win conditions (good for pacing)
    const hasImmediate = vcs.some(vc => vc.immediate);
    if (!hasImmediate) {
      score -= 10; // Games may drag without early end possibility
    }

    // Check victory thresholds
    for (const vc of vcs) {
      if (vc.type === 'dominance' || vc.type === 'first_to_vp') {
        const threshold = vc.threshold ?? 5;
        
        // Threshold too low (games end too fast)
        if (threshold < 3) {
          score -= 25;
        }
        // Threshold too high (games drag)
        else if (threshold > 8) {
          score -= 15;
        }
        // Ideal range
        else if (threshold >= 4 && threshold <= 6) {
          score += 5;
        }
      }
    }

    // Multiple victory paths is good
    if (vcs.length >= 2) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score scoring pace (0-100)
   */
  private static scoreScoringPace(config: MissionConfig): number {
    let score = 100;
    const rules = config.scoringRules;

    // Calculate expected VP per turn
    const zoneCount = config.battlefield?.zones?.reduce((sum, z) => sum + z.count, 0) ?? 0;
    let vpPerTurn = 0;

    for (const rule of rules) {
      const vp = typeof rule.vp === 'number' ? rule.vp : 1;
      
      if (rule.trigger === 'turn.end.zone_control') {
        vpPerTurn += vp * (zoneCount > 0 ? zoneCount : 2);
      } else if (rule.trigger === 'turn.end') {
        vpPerTurn += vp;
      }
    }

    // Too much VP per turn (games end too fast)
    if (vpPerTurn > 6) {
      score -= 30;
    }
    // Too little VP per turn (games drag)
    else if (vpPerTurn < 1) {
      score -= 20;
    }
    // Ideal range
    else if (vpPerTurn >= 2 && vpPerTurn <= 4) {
      score += 10;
    }

    // Multiple scoring paths is good
    const uniqueTriggers = new Set(rules.map(r => r.trigger)).size;
    if (uniqueTriggers >= 3) {
      score += 10;
    } else if (uniqueTriggers === 1) {
      score -= 10;
    }

    // First blood bonus is good for early game
    if (rules.some(r => r.trigger === 'first_blood')) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score zone/objective balance (0-100)
   */
  private static scoreZoneBalance(config: MissionConfig): number {
    let score = 100;
    const zones = config.battlefield?.zones ?? [];

    const totalZoneCount = zones.reduce((sum, z) => sum + z.count, 0);

    // No zones (no contestation)
    if (totalZoneCount === 0) {
      score -= 40;
    }
    // Only 1 zone (poor contestation)
    else if (totalZoneCount === 1) {
      score -= 30;
    }
    // 2-4 zones (good contestation)
    else if (totalZoneCount >= 2 && totalZoneCount <= 4) {
      score += 10;
    }
    // Too many zones (board too crowded)
    else if (totalZoneCount > 6) {
      score -= 15;
    }

    // Zone spacing matters
    for (const zone of zones) {
      if (zone.spacing && zone.spacing < 6) {
        score -= 10; // Zones too close together
      }
      if (zone.spacing && zone.spacing > 16) {
        score -= 5; // Zones too far apart
      }
    }

    // Formation variety is good
    const formations = new Set(zones.map(z => z.formation));
    if (formations.size >= 2) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score turn structure (0-100)
   */
  private static scoreTurnStructure(config: MissionConfig): number {
    let score = 100;
    const turnLimit = config.turnLimit;
    const endDieStart = config.endGameDieStart;

    // Turn limit too short
    if (turnLimit < 6) {
      score -= 25;
    }
    // Turn limit too long
    else if (turnLimit > 12) {
      score -= 15;
    }
    // Ideal range
    else if (turnLimit >= 8 && turnLimit <= 10) {
      score += 10;
    }

    // End game die roll timing
    if (endDieStart && turnLimit) {
      const dieWindow = turnLimit - endDieStart;
      
      // Die roll starts too early
      if (dieWindow > 6) {
        score -= 10;
      }
      // Die roll starts too late (no time to roll)
      else if (dieWindow < 2) {
        score -= 15;
      }
      // Good window
      else if (dieWindow >= 3 && dieWindow <= 5) {
        score += 5;
      }
    }

    // End game die roll enabled is good for pacing
    if (config.endGameDieRoll) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score player interaction (0-100)
   */
  private static scorePlayerInteraction(config: MissionConfig): number {
    let score = 100;
    const sideCount = config.sides.max - config.sides.min + 1;

    // Player count
    if (config.sides.min === 2 && config.sides.max === 2) {
      score += 10; // Standard competitive
    } else if (config.sides.max > 4) {
      score -= 15; // Too many players
    }

    // Check for interaction mechanics
    const rules = config.scoringRules;
    
    // Model elimination scoring encourages aggression
    if (rules.some(r => r.trigger === 'model.eliminated')) {
      score += 10;
    }

    // Zone control encourages positioning
    if (rules.some(r => r.trigger === 'turn.end.zone_control')) {
      score += 5;
    }

    // First blood encourages early game action
    if (rules.some(r => r.trigger === 'first_blood')) {
      score += 5;
    }

    // Check special rules for interaction
    if (config.specialRules) {
      const ruleText = JSON.stringify(config.specialRules).toLowerCase();
      
      // Reinforcements encourage dynamic gameplay
      if (ruleText.includes('reinforcement')) {
        score += 5;
      }
      
      // Alert/threat mechanics encourage tension
      if (ruleText.includes('alert') || ruleText.includes('threat')) {
        score += 5;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate detailed feedback
   */
  private static generateFeedback(
    config: MissionConfig,
    factors: HeuristicBalanceScore['factors']
  ): BalanceFeedback[] {
    const feedback: BalanceFeedback[] = [];

    // Victory conditions feedback
    if (factors.victoryConditions < 70) {
      feedback.push({
        factor: 'victoryConditions',
        severity: factors.victoryConditions < 50 ? 'critical' : 'warning',
        issue: 'Victory conditions may cause unbalanced game length',
        recommendation: 'Adjust victory thresholds to 4-6 VP for standard games',
        scoreImpact: 70 - factors.victoryConditions,
      });
    }

    // Scoring pace feedback
    if (factors.scoringPace < 70) {
      feedback.push({
        factor: 'scoringPace',
        severity: factors.scoringPace < 50 ? 'critical' : 'warning',
        issue: 'Scoring pace may cause games to end too quickly or drag',
        recommendation: 'Aim for 2-4 VP per turn average',
        scoreImpact: 70 - factors.scoringPace,
      });
    }

    // Zone balance feedback
    if (factors.zoneBalance < 70) {
      feedback.push({
        factor: 'zoneBalance',
        severity: factors.zoneBalance < 50 ? 'critical' : 'warning',
        issue: 'Zone configuration may limit player interaction',
        recommendation: 'Use 2-4 zones with 8-12 MU spacing',
        scoreImpact: 70 - factors.zoneBalance,
      });
    }

    // Turn structure feedback
    if (factors.turnStructure < 70) {
      feedback.push({
        factor: 'turnStructure',
        severity: factors.turnStructure < 50 ? 'critical' : 'warning',
        issue: 'Turn structure may cause pacing issues',
        recommendation: 'Use 8-10 turn limit with end die starting 3-5 turns before end',
        scoreImpact: 70 - factors.turnStructure,
      });
    }

    return feedback;
  }

  /**
   * Get human-readable report
   */
  static getReport(score: HeuristicBalanceScore): string {
    const lines: string[] = [];

    // Overall score
    const scoreColor = score.overall >= 80 ? '✅' : score.overall >= 60 ? '⚠️' : '❌';
    lines.push(`${scoreColor} Heuristic Balance Score: ${score.overall}/100`);
    lines.push('');

    // Pass/fail
    if (score.passed) {
      lines.push('✅ Mission balance is GOOD');
    } else {
      lines.push('❌ Mission balance needs IMPROVEMENT');
    }
    lines.push('');

    // Factor breakdown
    lines.push('Factor Breakdown:');
    lines.push(`  Victory Conditions: ${this.getFactorRating(score.factors.victoryConditions)}`);
    lines.push(`  Scoring Pace: ${this.getFactorRating(score.factors.scoringPace)}`);
    lines.push(`  Zone Balance: ${this.getFactorRating(score.factors.zoneBalance)}`);
    lines.push(`  Turn Structure: ${this.getFactorRating(score.factors.turnStructure)}`);
    lines.push(`  Player Interaction: ${this.getFactorRating(score.factors.playerInteraction)}`);
    lines.push('');

    // Feedback
    if (score.feedback.length > 0) {
      lines.push('Recommendations:');
      for (const item of score.feedback) {
        const icon = item.severity === 'critical' ? '❌' : item.severity === 'warning' ? '⚠️' : '💡';
        lines.push(`  ${icon} ${item.issue}`);
        lines.push(`     → ${item.recommendation}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get rating string for a factor score
   */
  private static getFactorRating(score: number): string {
    if (score >= 90) return `${score}/100 (Excellent)`;
    if (score >= 80) return `${score}/100 (Good)`;
    if (score >= 70) return `${score}/100 (Fair)`;
    if (score >= 60) return `${score}/100 (Poor)`;
    return `${score}/100 (Critical)`;
  }
}
