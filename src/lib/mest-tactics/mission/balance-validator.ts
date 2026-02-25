import { MissionConfig, GameSize } from '../mission-config';

/**
 * Balance validation result
 */
export interface BalanceValidationResult {
  /** Overall balance score (0-100) */
  score: number;
  /** Validation passed */
  passed: boolean;
  /** Errors (must fix) */
  errors: BalanceWarning[];
  /** Warnings (should consider) */
  warnings: BalanceWarning[];
  /** Suggestions (optional improvements) */
  suggestions: BalanceWarning[];
}

/**
 * Balance warning
 */
export interface BalanceWarning {
  /** Severity level */
  severity: 'error' | 'warning' | 'suggestion';
  /** Rule that was violated */
  rule: string;
  /** Warning message */
  message: string;
  /** Recommended fix */
  recommendation: string;
}

/**
 * Balance Validator
 * Performs static analysis on mission configurations
 */
export class BalanceValidator {
  /**
   * Validate mission configuration
   */
  static validate(config: MissionConfig): BalanceValidationResult {
    const errors: BalanceWarning[] = [];
    const warnings: BalanceWarning[] = [];
    const suggestions: BalanceWarning[] = [];

    // Run all balance checks
    this.checkVictoryThreshold(config, errors, warnings, suggestions);
    this.checkScoringPace(config, errors, warnings, suggestions);
    this.checkZoneCount(config, errors, warnings, suggestions);
    this.checkTurnLimit(config, errors, warnings, suggestions);
    this.checkSides(config, errors, warnings, suggestions);

    // Calculate score
    const score = this.calculateScore(errors, warnings, suggestions);

    return {
      score,
      passed: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Check victory condition thresholds
   */
  private static checkVictoryThreshold(
    config: MissionConfig,
    errors: BalanceWarning[],
    warnings: BalanceWarning[],
    suggestions: BalanceWarning[]
  ): void {
    for (const victory of config.victoryConditions) {
      if (victory.type === 'dominance' && victory.threshold) {
        if (victory.threshold < 3) {
          errors.push({
            severity: 'error',
            rule: 'victory_threshold',
            message: `Victory threshold (${victory.threshold}) is too low`,
            recommendation: 'Set threshold to 3-5 for 2-player games',
          });
        } else if (victory.threshold > 8) {
          warnings.push({
            severity: 'warning',
            rule: 'victory_threshold',
            message: `Victory threshold (${victory.threshold}) is very high`,
            recommendation: 'Consider threshold of 4-6 for standard game length',
          });
        }
      }
    }
  }

  /**
   * Check scoring pace (VP per turn)
   */
  private static checkScoringPace(
    config: MissionConfig,
    errors: BalanceWarning[],
    warnings: BalanceWarning[],
    suggestions: BalanceWarning[]
  ): void {
    // Calculate expected VP per turn
    let totalVpPerTurn = 0;
    for (const rule of config.scoringRules) {
      if (rule.trigger === 'turn.end.zone_control') {
        // Assume average 2 zones controlled
        totalVpPerTurn += (typeof rule.vp === 'number' ? rule.vp : 1) * 2;
      } else if (rule.trigger === 'turn.end') {
        totalVpPerTurn += typeof rule.vp === 'number' ? rule.vp : 1;
      }
    }

    if (totalVpPerTurn > 6) {
      errors.push({
        severity: 'error',
        rule: 'scoring_pace',
        message: `VP per turn (${totalVpPerTurn}) is too high`,
        recommendation: 'Reduce to 2-4 VP per turn for balanced games',
      });
    } else if (totalVpPerTurn > 4) {
      warnings.push({
        severity: 'warning',
        rule: 'scoring_pace',
        message: `VP per turn (${totalVpPerTurn}) is above average`,
        recommendation: 'Consider reducing to 2-3 VP per turn',
      });
    } else if (totalVpPerTurn < 1) {
      suggestions.push({
        severity: 'suggestion',
        rule: 'scoring_pace',
        message: 'No turn-based scoring detected',
        recommendation: 'Consider adding 1-2 VP per turn for steady progression',
      });
    }
  }

  /**
   * Check zone count for contestation
   */
  private static checkZoneCount(
    config: MissionConfig,
    errors: BalanceWarning[],
    warnings: BalanceWarning[],
    suggestions: BalanceWarning[]
  ): void {
    const totalZones = config.battlefield?.zones?.reduce(
      (sum, zone) => sum + zone.count,
      0
    ) ?? 0;

    if (totalZones === 0) {
      errors.push({
        severity: 'error',
        rule: 'zone_count',
        message: 'No zones configured',
        recommendation: 'Add at least 2 zones for contestation',
      });
    } else if (totalZones === 1) {
      errors.push({
        severity: 'error',
        rule: 'zone_count',
        message: 'Only 1 zone configured',
        recommendation: 'Add at least 2 zones for contestation',
      });
    } else if (totalZones > 8) {
      warnings.push({
        severity: 'warning',
        rule: 'zone_count',
        message: `Many zones configured (${totalZones})`,
        recommendation: 'Consider 3-5 zones for focused gameplay',
      });
    }
  }

  /**
   * Check turn limit
   */
  private static checkTurnLimit(
    config: MissionConfig,
    errors: BalanceWarning[],
    warnings: BalanceWarning[],
    suggestions: BalanceWarning[]
  ): void {
    if (config.turnLimit < 6) {
      warnings.push({
        severity: 'warning',
        rule: 'turn_limit',
        message: `Turn limit (${config.turnLimit}) is very short`,
        recommendation: 'Consider 8-12 turns for standard games',
      });
    } else if (config.turnLimit > 15) {
      suggestions.push({
        severity: 'suggestion',
        rule: 'turn_limit',
        message: `Turn limit (${config.turnLimit}) is long`,
        recommendation: 'Consider 10-12 turns to prevent game drag',
      });
    }
  }

  /**
   * Check sides configuration
   */
  private static checkSides(
    config: MissionConfig,
    errors: BalanceWarning[],
    warnings: BalanceWarning[],
    suggestions: BalanceWarning[]
  ): void {
    if (config.sides.min < 2) {
      errors.push({
        severity: 'error',
        rule: 'sides',
        message: 'Minimum sides must be at least 2',
        recommendation: 'Set min sides to 2',
      });
    }

    if (config.sides.max > 4) {
      warnings.push({
        severity: 'warning',
        rule: 'sides',
        message: `Maximum sides (${config.sides.max}) is high`,
        recommendation: 'Consider max 4 sides for balanced gameplay',
      });
    }

    if (config.sides.min !== config.sides.max) {
      suggestions.push({
        severity: 'suggestion',
        rule: 'sides',
        message: 'Variable player count detected',
        recommendation: 'Playtest with all supported player counts',
      });
    }
  }

  /**
   * Calculate overall balance score
   */
  private static calculateScore(
    errors: BalanceWarning[],
    warnings: BalanceWarning[],
    suggestions: BalanceWarning[]
  ): number {
    let score = 100;

    // Errors are critical (-30 each)
    score -= errors.length * 30;

    // Warnings are significant (-10 each)
    score -= warnings.length * 10;

    // Suggestions are minor (-3 each)
    score -= suggestions.length * 3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get human-readable validation report
   */
  static getReport(result: BalanceValidationResult): string {
    const lines: string[] = [];

    // Score
    const scoreColor = result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : '❌';
    lines.push(`${scoreColor} Balance Score: ${result.score}/100`);
    lines.push('');

    // Status
    if (result.passed) {
      lines.push('✅ Validation PASSED');
    } else {
      lines.push('❌ Validation FAILED');
    }
    lines.push('');

    // Errors
    if (result.errors.length > 0) {
      lines.push('❌ Errors (must fix):');
      for (const error of result.errors) {
        lines.push(`   - ${error.message}`);
        lines.push(`     → ${error.recommendation}`);
      }
      lines.push('');
    }

    // Warnings
    if (result.warnings.length > 0) {
      lines.push('⚠️ Warnings (should consider):');
      for (const warning of result.warnings) {
        lines.push(`   - ${warning.message}`);
        lines.push(`     → ${warning.recommendation}`);
      }
      lines.push('');
    }

    // Suggestions
    if (result.suggestions.length > 0) {
      lines.push('💡 Suggestions (optional):');
      for (const suggestion of result.suggestions) {
        lines.push(`   - ${suggestion.message}`);
        lines.push(`     → ${suggestion.recommendation}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
