/**
 * QSR Instrumentation System Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InstrumentationGrade,
  InstrumentationLogger,
  InstrumentationConfig,
  LoggedActionType,
  createLoggedTestResult,
  createLoggedDiceRoll,
  createLoggedTraitSource,
  createLoggedSituationalModifier,
  DEFAULT_INSTRUMENTATION_CONFIG,
} from './QSRInstrumentation';

// ============================================================================
// INSTRUMENTATION GRADE TESTS
// ============================================================================

describe('QSR Instrumentation - Grades', () => {
  describe('InstrumentationGrade enum', () => {
    it('should have all grade levels', () => {
      expect(InstrumentationGrade.NONE).toBe(0);
      expect(InstrumentationGrade.SUMMARY).toBe(1);
      expect(InstrumentationGrade.BY_ACTION).toBe(2);
      expect(InstrumentationGrade.BY_ACTION_WITH_TESTS).toBe(3);
      expect(InstrumentationGrade.BY_ACTION_WITH_DICE).toBe(4);
      expect(InstrumentationGrade.FULL_DETAIL).toBe(5);
    });
  });

  describe('DEFAULT_INSTRUMENTATION_CONFIG', () => {
    it('should default to SUMMARY grade', () => {
      expect(DEFAULT_INSTRUMENTATION_CONFIG.grade).toBe(InstrumentationGrade.SUMMARY);
    });

    it('should have features disabled by default', () => {
      expect(DEFAULT_INSTRUMENTATION_CONFIG.includeTraitSources).toBe(false);
      expect(DEFAULT_INSTRUMENTATION_CONFIG.includeSituationalModifiers).toBe(false);
      expect(DEFAULT_INSTRUMENTATION_CONFIG.includeAIReasoning).toBe(false);
    });

    it('should default to both output formats', () => {
      expect(DEFAULT_INSTRUMENTATION_CONFIG.format).toBe('both');
    });
  });
});

// ============================================================================
// LOGGER LIFECYCLE TESTS
// ============================================================================

describe('QSR Instrumentation - Logger Lifecycle', () => {
  describe('InstrumentationLogger', () => {
    let logger: InstrumentationLogger;

    beforeEach(() => {
      logger = new InstrumentationLogger();
    });

    it('should start with null battle log', () => {
      expect(logger.getBattleLog()).toBeNull();
    });

    it('should create battle log on startBattle', () => {
      logger.startBattle('test-battle-001');
      const log = logger.getBattleLog();
      
      expect(log).not.toBeNull();
      expect(log?.battleId).toBe('test-battle-001');
      expect(log?.startedAt).toBeDefined();
    });

    it('should end battle and return log', () => {
      logger.startBattle('test-battle-001');
      const result = logger.endBattle(5);
      
      expect(result).not.toBeNull();
      expect(result?.battleId).toBe('test-battle-001');
      expect(result?.totalTurns).toBe(5);
      expect(result?.endedAt).toBeDefined();
    });

    it('should return null when ending without starting', () => {
      const result = logger.endBattle(5);
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// GRADE FILTERING TESTS
// ============================================================================

describe('QSR Instrumentation - Grade Filtering', () => {
  let logger: InstrumentationLogger;

  beforeEach(() => {
    logger = new InstrumentationLogger();
    logger.startBattle('test-battle-001');
  });

  const createTestAction = () => ({
    turn: 1,
    initiative: 1,
    actorId: 'char-1',
    actorName: 'Test Character',
    actionType: LoggedActionType.CLOSE_COMBAT,
    description: 'Attacked enemy',
    apSpent: 2,
    apRemaining: 0,
    targetId: 'char-2',
    targetName: 'Enemy',
    testResults: [
      createLoggedTestResult('Close Combat Hit', 4, 3, true, 2, 1),
    ],
    diceRolls: [
      createLoggedDiceRoll('Base', [3, 5, 6], 2, 1),
      createLoggedDiceRoll('Modifier', [4], 0, 0),
    ],
    traitsUsed: [
      createLoggedTraitSource('Fight', 'archetype', 'Veteran', '+1 cascade', 1),
    ],
    situationalModifiers: [
      createLoggedSituationalModifier('Charge', '+1m', 'Moved into base-contact'),
    ],
    outcome: 'Hit, 2 Wounds',
    timestamp: new Date().toISOString(),
  });

  it('should filter all details for Grade 0 (NONE)', () => {
    logger.configure({ grade: InstrumentationGrade.NONE });
    logger.logAction(createTestAction());
    
    const log = logger.getBattleLog();
    expect(log?.actions.length).toBe(0);
  });

  it('should include basic info for Grade 1 (SUMMARY)', () => {
    logger.configure({ grade: InstrumentationGrade.SUMMARY });
    logger.logAction(createTestAction());
    
    const log = logger.getBattleLog();
    expect(log?.actions.length).toBe(1);
    expect(log?.actions[0].testResults).toBeUndefined();
    expect(log?.actions[0].diceRolls).toBeUndefined();
    expect(log?.actions[0].traitsUsed).toBeUndefined();
  });

  it('should include action details for Grade 2 (BY_ACTION)', () => {
    logger.configure({ grade: InstrumentationGrade.BY_ACTION });
    logger.logAction(createTestAction());
    
    const log = logger.getBattleLog();
    expect(log?.actions.length).toBe(1);
    expect(log?.actions[0].apSpent).toBe(2);
    expect(log?.actions[0].targetName).toBe('Enemy');
    expect(log?.actions[0].testResults).toBeUndefined();
  });

  it('should include test results for Grade 3 (BY_ACTION_WITH_TESTS)', () => {
    logger.configure({ grade: InstrumentationGrade.BY_ACTION_WITH_TESTS });
    logger.logAction(createTestAction());
    
    const log = logger.getBattleLog();
    expect(log?.actions.length).toBe(1);
    expect(log?.actions[0].testResults).toBeDefined();
    expect(log?.actions[0].testResults?.length).toBe(1);
    expect(log?.actions[0].diceRolls).toBeUndefined();
  });

  it('should include dice rolls for Grade 4 (BY_ACTION_WITH_DICE)', () => {
    logger.configure({ grade: InstrumentationGrade.BY_ACTION_WITH_DICE });
    logger.logAction(createTestAction());
    
    const log = logger.getBattleLog();
    expect(log?.actions.length).toBe(1);
    expect(log?.actions[0].testResults).toBeDefined();
    expect(log?.actions[0].diceRolls).toBeDefined();
    expect(log?.actions[0].diceRolls?.length).toBe(2);
    expect(log?.actions[0].traitsUsed).toBeUndefined();
  });

  it('should include all details for Grade 5 (FULL_DETAIL)', () => {
    logger.configure({ 
      grade: InstrumentationGrade.FULL_DETAIL,
      includeTraitSources: true,
      includeSituationalModifiers: true
    });
    logger.logAction(createTestAction());
    
    const log = logger.getBattleLog();
    expect(log?.actions.length).toBe(1);
    expect(log?.actions[0].testResults).toBeDefined();
    expect(log?.actions[0].diceRolls).toBeDefined();
    expect(log?.actions[0].traitsUsed).toBeDefined();
    expect(log?.actions[0].situationalModifiers).toBeDefined();
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('QSR Instrumentation - Helper Functions', () => {
  describe('createLoggedTestResult', () => {
    it('should create test result with all fields', () => {
      const result = createLoggedTestResult('Close Combat Hit', 4, 3, true, 2, 1);
      
      expect(result.testType).toBe('Close Combat Hit');
      expect(result.score).toBe(4);
      expect(result.opponentScore).toBe(3);
      expect(result.passed).toBe(true);
      expect(result.cascades).toBe(2);
      expect(result.carryOver).toBe(1);
    });

    it('should handle undefined opponent score', () => {
      const result = createLoggedTestResult('Morale Test', 3, undefined, true, 1, 0);
      
      expect(result.opponentScore).toBeUndefined();
    });
  });

  describe('createLoggedDiceRoll', () => {
    it('should create dice roll with all fields', () => {
      const roll = createLoggedDiceRoll('Base', [3, 5, 6], 2, 1);
      
      expect(roll.diceType).toBe('Base');
      expect(roll.rolls).toEqual([3, 5, 6]);
      expect(roll.successes).toBe(2);
      expect(roll.carryOver).toBe(1);
    });
  });

  describe('createLoggedTraitSource', () => {
    it('should create trait source with all fields', () => {
      const trait = createLoggedTraitSource('Fight', 'archetype', 'Veteran', '+1 cascade', 1);
      
      expect(trait.trait).toBe('Fight');
      expect(trait.level).toBe(1);
      expect(trait.sourceType).toBe('archetype');
      expect(trait.sourceName).toBe('Veteran');
      expect(trait.effect).toBe('+1 cascade');
    });

    it('should handle undefined level', () => {
      const trait = createLoggedTraitSource('Grit', 'archetype', 'Elite', 'Morale immunity');
      
      expect(trait.level).toBeUndefined();
    });
  });

  describe('createLoggedSituationalModifier', () => {
    it('should create modifier with all fields', () => {
      const mod = createLoggedSituationalModifier('Charge', '+1m', 'Moved into base-contact');
      
      expect(mod.name).toBe('Charge');
      expect(mod.value).toBe('+1m');
      expect(mod.reason).toBe('Moved into base-contact');
    });
  });
});

// ============================================================================
// SUMMARY STATISTICS TESTS
// ============================================================================

describe('QSR Instrumentation - Summary Statistics', () => {
  let logger: InstrumentationLogger;

  beforeEach(() => {
    logger = new InstrumentationLogger({ grade: InstrumentationGrade.BY_ACTION_WITH_TESTS });
    logger.startBattle('test-battle-001');
  });

  it('should count total actions', () => {
    logger.logAction({
      turn: 1,
      initiative: 1,
      actorId: 'char-1',
      actorName: 'Test',
      actionType: LoggedActionType.MOVE,
      description: 'Moved',
      apSpent: 2,
      apRemaining: 0,
      outcome: 'Reached cover',
      timestamp: new Date().toISOString(),
    });

    logger.logAction({
      turn: 1,
      initiative: 2,
      actorId: 'char-2',
      actorName: 'Test2',
      actionType: LoggedActionType.CLOSE_COMBAT,
      description: 'Attacked',
      apSpent: 2,
      apRemaining: 0,
      outcome: 'Hit',
      timestamp: new Date().toISOString(),
    });

    const log = logger.endBattle(1);
    expect(log?.summary.totalActions).toBe(2);
  });

  it('should count actions by type', () => {
    logger.logAction({
      turn: 1,
      initiative: 1,
      actorId: 'char-1',
      actorName: 'Test',
      actionType: LoggedActionType.MOVE,
      description: 'Moved',
      apSpent: 2,
      apRemaining: 0,
      outcome: 'Reached cover',
      timestamp: new Date().toISOString(),
    });

    logger.logAction({
      turn: 1,
      initiative: 2,
      actorId: 'char-1',
      actorName: 'Test',
      actionType: LoggedActionType.MOVE,
      description: 'Moved again',
      apSpent: 2,
      apRemaining: 0,
      outcome: 'Advanced',
      timestamp: new Date().toISOString(),
    });

    logger.logAction({
      turn: 1,
      initiative: 3,
      actorId: 'char-2',
      actorName: 'Test2',
      actionType: LoggedActionType.CLOSE_COMBAT,
      description: 'Attacked',
      apSpent: 2,
      apRemaining: 0,
      outcome: 'Hit',
      timestamp: new Date().toISOString(),
    });

    const log = logger.endBattle(1);
    expect(log?.summary.actionsByType['Move']).toBe(2);
    expect(log?.summary.actionsByType['Close Combat']).toBe(1);
  });

  it('should count tests and results', () => {
    logger.logAction({
      turn: 1,
      initiative: 1,
      actorId: 'char-1',
      actorName: 'Test',
      actionType: LoggedActionType.CLOSE_COMBAT,
      description: 'Attacked',
      apSpent: 2,
      apRemaining: 0,
      testResults: [
        createLoggedTestResult('Hit', 4, 3, true, 2, 1),
        createLoggedTestResult('Damage', 3, 2, true, 1, 0),
      ],
      outcome: 'Hit, 2 Wounds',
      timestamp: new Date().toISOString(),
    });

    const log = logger.endBattle(1);
    expect(log?.summary.totalTests).toBe(2);
    expect(log?.summary.testsPassed).toBe(2);
    expect(log?.summary.testsFailed).toBe(0);
    expect(log?.summary.totalCascades).toBe(3);
  });

  it('should count dice rolls', () => {
    logger.configure({ grade: InstrumentationGrade.BY_ACTION_WITH_DICE });
    
    logger.logAction({
      turn: 1,
      initiative: 1,
      actorId: 'char-1',
      actorName: 'Test',
      actionType: LoggedActionType.CLOSE_COMBAT,
      description: 'Attacked',
      apSpent: 2,
      apRemaining: 0,
      testResults: [
        createLoggedTestResult('Hit', 4, 3, true, 2, 1),
      ],
      diceRolls: [
        createLoggedDiceRoll('Base', [3, 5, 6], 2, 1),
        createLoggedDiceRoll('Modifier', [4, 6], 1, 0),
        createLoggedDiceRoll('Wild', [6], 1, 1),
      ],
      outcome: 'Hit',
      timestamp: new Date().toISOString(),
    });

    const log = logger.endBattle(1);
    expect(log?.summary.totalDiceRolled).toBe(6); // 3 + 2 + 1
  });

  it('should count Wait and React actions', () => {
    logger.logAction({
      turn: 1,
      initiative: 1,
      actorId: 'char-1',
      actorName: 'Test',
      actionType: LoggedActionType.WAIT,
      description: 'Waited',
      apSpent: 0,
      apRemaining: 2,
      outcome: 'Wait status',
      timestamp: new Date().toISOString(),
    });

    logger.logAction({
      turn: 1,
      initiative: 2,
      actorId: 'char-2',
      actorName: 'Test2',
      actionType: LoggedActionType.REACT,
      description: 'Reacted',
      apSpent: 0,
      apRemaining: 2,
      outcome: 'Counter-strike',
      timestamp: new Date().toISOString(),
    });

    const log = logger.endBattle(1);
    expect(log?.summary.waitActions).toBe(1);
    expect(log?.summary.reactActions).toBe(1);
  });
});

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

describe('QSR Instrumentation - Configuration', () => {
  let logger: InstrumentationLogger;

  beforeEach(() => {
    logger = new InstrumentationLogger();
  });

  it('should update grade via configure', () => {
    logger.configure({ grade: InstrumentationGrade.FULL_DETAIL });
    const log = logger.getBattleLog();
    // Config is stored internally
    logger.startBattle('test');
    const fullLog = logger.getBattleLog();
    expect(fullLog?.config.grade).toBe(InstrumentationGrade.FULL_DETAIL);
  });

  it('should update features via configure', () => {
    logger.configure({ 
      includeTraitSources: true,
      includeSituationalModifiers: true,
      includeAIReasoning: true
    });
    
    logger.startBattle('test');
    const fullLog = logger.getBattleLog();
    expect(fullLog?.config.includeTraitSources).toBe(true);
    expect(fullLog?.config.includeSituationalModifiers).toBe(true);
    expect(fullLog?.config.includeAIReasoning).toBe(true);
  });

  it('should update format via configure', () => {
    logger.configure({ format: 'json' });
    
    logger.startBattle('test');
    const fullLog = logger.getBattleLog();
    expect(fullLog?.config.format).toBe('json');
  });
});

// ============================================================================
// EXPORT TESTS
// ============================================================================

describe('QSR Instrumentation - Export', () => {
  let logger: InstrumentationLogger;

  beforeEach(() => {
    logger = new InstrumentationLogger({ grade: InstrumentationGrade.SUMMARY });
    logger.startBattle('test-battle-001');
  });

  it('should export to JSON', () => {
    const exportLogger = new InstrumentationLogger({ grade: InstrumentationGrade.BY_ACTION });
    exportLogger.startBattle('export-test-001');
    
    const action: any = {
      turn: 1,
      initiative: 1,
      actorId: 'char-1',
      actorName: 'Test',
      actionType: LoggedActionType.MOVE,
      description: 'Moved',
      apSpent: 2,
      apRemaining: 0,
      outcome: 'Reached cover',
      timestamp: new Date().toISOString(),
    };
    
    exportLogger.logAction(action);
    
    // Check buffer directly
    const log = exportLogger.getBattleLog();
    expect(log).not.toBeNull();
    expect(log?.actions.length).toBe(1);

    // Export before ending battle
    const json = exportLogger.exportToJSON();
    
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!);
    expect(parsed.battleId).toBe('export-test-001');
    expect(parsed.actions.length).toBe(1);
  });

  it('should return null when no battle log', () => {
    const newLogger = new InstrumentationLogger();
    const json = newLogger.exportToJSON();
    expect(json).toBeNull();
  });
});
