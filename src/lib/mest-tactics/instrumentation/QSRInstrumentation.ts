/**
 * QSR Instrumentation System
 * 
 * Provides configurable detail levels for battle reports and action logging.
 * Enables troubleshooting of combat, Wait status, Damage application, and AI behavior.
 * 
 * Detail Levels (Grades):
 * - [0] None: No instrumentation
 * - [1] Summary: High-level battle summary only
 * - [2] By Action: Actions performed by each model
 * - [3] By Action with Tests: Actions + Test results (pass/fail, cascades)
 * - [4] By Action with Tests and Dice Rolls: Actions + Tests + individual dice results
 * - [5] Full Detail: Actions + Tests + Dice + Traits by source + Situational Modifiers
 */

import { Character } from '../core/Character';
import { Item } from '../core/Item';

// ============================================================================
// INSTRUMENTATION GRADES
// ============================================================================

/**
 * Instrumentation detail level
 */
export enum InstrumentationGrade {
  /** No instrumentation */
  NONE = 0,
  /** Summary information only (default) */
  SUMMARY = 1,
  /** Actions performed by each model */
  BY_ACTION = 2,
  /** Actions + Test results */
  BY_ACTION_WITH_TESTS = 3,
  /** Actions + Tests + Dice rolls */
  BY_ACTION_WITH_DICE = 4,
  /** Full detail: Actions + Tests + Dice + Traits + Modifiers */
  FULL_DETAIL = 5,
}

/**
 * Instrumentation configuration
 */
export interface InstrumentationConfig {
  /** Detail level (0-5) */
  grade: InstrumentationGrade;
  /** Include trait source information (archetype, item) */
  includeTraitSources?: boolean;
  /** Include situational test modifiers */
  includeSituationalModifiers?: boolean;
  /** Include AI decision reasoning */
  includeAIReasoning?: boolean;
  /** Output format */
  format?: 'json' | 'console' | 'both';
}

/**
 * Default instrumentation config
 */
export const DEFAULT_INSTRUMENTATION_CONFIG: InstrumentationConfig = {
  grade: InstrumentationGrade.SUMMARY,
  includeTraitSources: false,
  includeSituationalModifiers: false,
  includeAIReasoning: false,
  format: 'both',
};

// ============================================================================
// ACTION LOGGING TYPES
// ============================================================================

/**
 * Action type enumeration
 */
export enum LoggedActionType {
  MOVE = 'Move',
  CLOSE_COMBAT = 'Close Combat',
  RANGE_COMBAT = 'Range Combat',
  DISENGAGE = 'Disengage',
  WAIT = 'Wait',
  HIDE = 'Hide',
  RALLY = 'Rally',
  REVIVE = 'Revive',
  FIDDLE = 'Fiddle',
  REACT = 'React',
  BONUS_ACTION = 'Bonus Action',
  PASSIVE_OPTION = 'Passive Option',
  INITIATIVE_TEST = 'Initiative Test',
  MORALE_TEST = 'Morale Test',
  SUPPRESSION_TEST = 'Suppression Test',
  OTHER = 'Other',
}

/**
 * Test result logging
 */
export interface LoggedTestResult {
  /** Test type */
  testType: string;
  /** Test score (successes) */
  score: number;
  /** Opponent score (if opposed) */
  opponentScore?: number;
  /** Pass/fail result */
  passed: boolean;
  /** Cascades generated */
  cascades: number;
  /** Carry-over dice */
  carryOver: number;
}

/**
 * Dice roll logging
 */
export interface LoggedDiceRoll {
  /** Dice type (Base, Modifier, Wild) */
  diceType: 'Base' | 'Modifier' | 'Wild';
  /** Individual die results */
  rolls: number[];
  /** Successes from this roll */
  successes: number;
  /** Carry-over from this roll */
  carryOver: number;
}

/**
 * Trait source logging
 */
export interface LoggedTraitSource {
  /** Trait name */
  trait: string;
  /** Trait level */
  level?: number;
  /** Source type */
  sourceType: 'archetype' | 'item' | 'status' | 'terrain';
  /** Source name (archetype name, item name, etc.) */
  sourceName: string;
  /** Applied effect */
  effect: string;
}

/**
 * Situational modifier logging
 */
export interface LoggedSituationalModifier {
  /** Modifier name */
  name: string;
  /** Modifier value (e.g., +1m, -1b) */
  value: string;
  /** Reason for modifier */
  reason: string;
}

/**
 * Complete action log entry
 */
export interface LoggedAction {
  /** Turn number */
  turn: number;
  /** Initiative number */
  initiative: number;
  /** Actor character ID */
  actorId: string;
  /** Actor character name */
  actorName: string;
  /** Action type */
  actionType: LoggedActionType;
  /** Action description */
  description: string;
  /** AP spent */
  apSpent: number;
  /** AP remaining after action */
  apRemaining: number;
  /** Target character ID (if applicable) */
  targetId?: string;
  /** Target character name (if applicable) */
  targetName?: string;
  /** Test results (grade 3+) */
  testResults?: LoggedTestResult[];
  /** Dice rolls (grade 4+) */
  diceRolls?: LoggedDiceRoll[];
  /** Traits used (grade 5) */
  traitsUsed?: LoggedTraitSource[];
  /** Situational modifiers (grade 5) */
  situationalModifiers?: LoggedSituationalModifier[];
  /** AI reasoning (if AI-controlled) */
  aiReasoning?: string;
  /** Outcome summary */
  outcome: string;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// BATTLE LOG STRUCTURE
// ============================================================================

/**
 * Complete battle log
 */
export interface BattleLog {
  /** Battle ID */
  battleId: string;
  /** Instrumentation config used */
  config: InstrumentationConfig;
  /** Start timestamp */
  startedAt: string;
  /** End timestamp */
  endedAt: string;
  /** Total turns */
  totalTurns: number;
  /** Action log entries */
  actions: LoggedAction[];
  /** Summary statistics */
  summary: BattleLogSummary;
}

/**
 * Battle log summary statistics
 */
export interface BattleLogSummary {
  /** Total actions performed */
  totalActions: number;
  /** Actions by type */
  actionsByType: Record<string, number>;
  /** Total tests performed */
  totalTests: number;
  /** Tests passed */
  testsPassed: number;
  /** Tests failed */
  testsFailed: number;
  /** Total cascades generated */
  totalCascades: number;
  /** Total dice rolled */
  totalDiceRolled: number;
  /** Traits used count */
  traitsUsedCount: number;
  /** Wait actions performed */
  waitActions: number;
  /** React actions performed */
  reactActions: number;
  /** Bonus actions performed */
  bonusActions: number;
  /** Casualties per side */
  casualties: Record<string, number>;
}

// ============================================================================
// INSTRUMENTATION LOGGER
// ============================================================================

/**
 * Instrumentation logger class
 */
export class InstrumentationLogger {
  private config: InstrumentationConfig;
  private battleLog: BattleLog | null = null;
  private actionBuffer: LoggedAction[] = [];

  constructor(config: InstrumentationConfig = DEFAULT_INSTRUMENTATION_CONFIG) {
    this.config = config;
  }

  /**
   * Start logging for a battle
   */
  startBattle(battleId: string): void {
    this.battleLog = {
      battleId,
      config: { ...this.config },
      startedAt: new Date().toISOString(),
      endedAt: '',
      totalTurns: 0,
      actions: [],
      summary: {
        totalActions: 0,
        actionsByType: {},
        totalTests: 0,
        testsPassed: 0,
        testsFailed: 0,
        totalCascades: 0,
        totalDiceRolled: 0,
        traitsUsedCount: 0,
        waitActions: 0,
        reactActions: 0,
        bonusActions: 0,
        casualties: {},
      },
    };
    this.actionBuffer = [];
  }

  /**
   * End logging for a battle
   */
  endBattle(totalTurns: number): BattleLog | null {
    if (!this.battleLog) return null;

    this.battleLog.endedAt = new Date().toISOString();
    this.battleLog.totalTurns = totalTurns;
    this.battleLog.actions = [...this.actionBuffer];

    // Calculate summary statistics
    this.calculateSummary();

    const log = this.battleLog;
    this.battleLog = null;
    this.actionBuffer = [];

    return log;
  }

  /**
   * Log an action
   */
  logAction(action: LoggedAction): void {
    if (!this.battleLog || this.config.grade === InstrumentationGrade.NONE) {
      return;
    }

    // Filter detail based on grade
    const filteredAction = this.filterActionByGrade(action);
    this.actionBuffer.push(filteredAction);
    
    // Sync to battle log for immediate access
    this.battleLog.actions = [...this.actionBuffer];

    // Update summary counters
    this.updateSummary(action);

    // Console output if configured
    if (this.config.format === 'console' || this.config.format === 'both') {
      this.printToConsole(action);
    }
  }

  /**
   * Filter action details based on instrumentation grade
   */
  private filterActionByGrade(action: LoggedAction): LoggedAction {
    if (this.config.grade < InstrumentationGrade.BY_ACTION_WITH_TESTS) {
      // Remove test results for grade 1-2
      delete action.testResults;
    }

    if (this.config.grade < InstrumentationGrade.BY_ACTION_WITH_DICE) {
      // Remove dice rolls for grade 1-3
      delete action.diceRolls;
    }

    if (this.config.grade < InstrumentationGrade.FULL_DETAIL) {
      // Remove traits and modifiers for grade 1-4
      delete action.traitsUsed;
      delete action.situationalModifiers;
    }

    if (!this.config.includeAIReasoning) {
      delete action.aiReasoning;
    }

    return action;
  }

  /**
   * Update summary statistics
   */
  private updateSummary(action: LoggedAction): void {
    if (!this.battleLog) return;

    const summary = this.battleLog.summary;
    summary.totalActions++;

    // Count by action type
    const actionType = action.actionType;
    summary.actionsByType[actionType] = (summary.actionsByType[actionType] || 0) + 1;

    // Count specific action types
    if (actionType === LoggedActionType.WAIT) {
      summary.waitActions++;
    } else if (actionType === LoggedActionType.REACT) {
      summary.reactActions++;
    } else if (actionType === LoggedActionType.BONUS_ACTION) {
      summary.bonusActions++;
    }

    // Count tests and cascades
    if (action.testResults) {
      for (const test of action.testResults) {
        summary.totalTests++;
        if (test.passed) {
          summary.testsPassed++;
        } else {
          summary.testsFailed++;
        }
        summary.totalCascades += test.cascades;
      }
    }

    // Count dice rolls
    if (action.diceRolls) {
      for (const roll of action.diceRolls) {
        summary.totalDiceRolled += roll.rolls.length;
      }
    }

    // Count traits used
    if (action.traitsUsed) {
      summary.traitsUsedCount += action.traitsUsed.length;
    }
  }

  /**
   * Calculate final summary statistics
   */
  private calculateSummary(): void {
    if (!this.battleLog) return;

    // Additional calculations can be added here
  }

  /**
   * Print action to console
   */
  private printToConsole(action: LoggedAction): void {
    if (this.config.grade === InstrumentationGrade.NONE) return;

    const grade = this.config.grade;
    const indent = '  ';

    // Grade 1: Summary
    if (grade >= InstrumentationGrade.SUMMARY) {
      console.log(`\n[T${action.turn} I${action.initiative}] ${action.actorName}: ${action.actionType}`);
      console.log(`${indent}${action.description}`);
      console.log(`${indent}Outcome: ${action.outcome}`);
    }

    // Grade 2+: Action details
    if (grade >= InstrumentationGrade.BY_ACTION) {
      console.log(`${indent}AP: ${action.apSpent} spent, ${action.apRemaining} remaining`);
      if (action.targetName) {
        console.log(`${indent}Target: ${action.targetName}`);
      }
    }

    // Grade 3+: Test results
    if (grade >= InstrumentationGrade.BY_ACTION_WITH_TESTS && action.testResults) {
      console.log(`${indent}Tests:`);
      for (const test of action.testResults) {
        const result = test.passed ? '✓ PASS' : '✗ FAIL';
        console.log(`${indent}${indent}${test.testType}: ${result} (Score: ${test.score}, Cascades: ${test.cascades})`);
      }
    }

    // Grade 4+: Dice rolls
    if (grade >= InstrumentationGrade.BY_ACTION_WITH_DICE && action.diceRolls) {
      console.log(`${indent}Dice:`);
      for (const roll of action.diceRolls) {
        console.log(`${indent}${indent}${roll.diceType}: [${roll.rolls.join(', ')}] → ${roll.successes} successes`);
      }
    }

    // Grade 5: Traits and modifiers
    if (grade >= InstrumentationGrade.FULL_DETAIL) {
      if (action.traitsUsed && action.traitsUsed.length > 0) {
        console.log(`${indent}Traits:`);
        for (const trait of action.traitsUsed) {
          console.log(`${indent}${indent}${trait.trait}${trait.level ? ` ${trait.level}` : ''} (${trait.sourceType}: ${trait.sourceName}) → ${trait.effect}`);
        }
      }

      if (action.situationalModifiers && action.situationalModifiers.length > 0) {
        console.log(`${indent}Modifiers:`);
        for (const mod of action.situationalModifiers) {
          console.log(`${indent}${indent}${mod.name}: ${mod.value} (${mod.reason})`);
        }
      }
    }

    // AI reasoning
    if (action.aiReasoning && this.config.includeAIReasoning) {
      console.log(`${indent}AI Reasoning: ${action.aiReasoning}`);
    }
  }

  /**
   * Get current battle log
   */
  getBattleLog(): BattleLog | null {
    return this.battleLog;
  }

  /**
   * Export battle log as JSON
   */
  exportToJSON(): string | null {
    if (!this.battleLog) return null;
    return JSON.stringify(this.battleLog, null, 2);
  }

  /**
   * Set instrumentation grade
   */
  setGrade(grade: InstrumentationGrade): void {
    this.config.grade = grade;
  }

  /**
   * Enable/disable specific features
   */
  configure(options: Partial<InstrumentationConfig>): void {
    this.config = { ...this.config, ...options };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a logged test result
 */
export function createLoggedTestResult(
  testType: string,
  score: number,
  opponentScore: number | undefined,
  passed: boolean,
  cascades: number,
  carryOver: number
): LoggedTestResult {
  return {
    testType,
    score,
    opponentScore,
    passed,
    cascades,
    carryOver,
  };
}

/**
 * Create a logged dice roll
 */
export function createLoggedDiceRoll(
  diceType: 'Base' | 'Modifier' | 'Wild',
  rolls: number[],
  successes: number,
  carryOver: number
): LoggedDiceRoll {
  return {
    diceType,
    rolls,
    successes,
    carryOver,
  };
}

/**
 * Create a logged trait source
 */
export function createLoggedTraitSource(
  trait: string,
  sourceType: 'archetype' | 'item' | 'status' | 'terrain',
  sourceName: string,
  effect: string,
  level?: number
): LoggedTraitSource {
  return {
    trait,
    level,
    sourceType,
    sourceName,
    effect,
  };
}

/**
 * Create a logged situational modifier
 */
export function createLoggedSituationalModifier(
  name: string,
  value: string,
  reason: string
): LoggedSituationalModifier {
  return {
    name,
    value,
    reason,
  };
}

/**
 * Get trait sources from character and items
 */
export function getTraitSources(character: Character): LoggedTraitSource[] {
  const sources: LoggedTraitSource[] = [];

  // Archetype traits
  if (character.profile?.allTraits) {
    for (const trait of character.profile.allTraits) {
      sources.push({
        trait,
        sourceType: 'archetype',
        sourceName: character.profile.archetypeName || 'Unknown',
        effect: 'Trait bonus',
      });
    }
  }

  // Item traits
  const items = [
    ...(character.profile?.equipment || []),
    ...(character.profile?.items || []),
    ...(character.profile?.inHandItems || []),
  ];

  for (const item of items) {
    if (item.traits) {
      for (const trait of item.traits) {
        sources.push({
          trait,
          sourceType: 'item',
          sourceName: item.name,
          effect: 'Item trait',
        });
      }
    }
  }

  return sources;
}

// ============================================================================
// GLOBAL LOGGER INSTANCE
// ============================================================================

/**
 * Global instrumentation logger instance
 */
let globalLogger: InstrumentationLogger | null = null;

/**
 * Get or create global logger
 */
export function getInstrumentationLogger(): InstrumentationLogger {
  if (!globalLogger) {
    globalLogger = new InstrumentationLogger(DEFAULT_INSTRUMENTATION_CONFIG);
  }
  return globalLogger;
}

/**
 * Set global logger configuration
 */
export function configureInstrumentation(config: InstrumentationConfig): void {
  const logger = getInstrumentationLogger();
  logger.configure(config);
}

/**
 * Set global instrumentation grade
 */
export function setInstrumentationGrade(grade: InstrumentationGrade): void {
  const logger = getInstrumentationLogger();
  logger.setGrade(grade);
}
