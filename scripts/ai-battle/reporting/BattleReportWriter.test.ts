import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BattleReport } from '../../shared/BattleReportTypes';
import { buildBattleAuditTrace, writeBattleArtifacts } from './BattleReportWriter';

const TEST_RUN_ID = 'unit-test-battle-artifacts';

function cleanup(): void {
  const reportJson = join(process.cwd(), 'generated', 'ai-battle-reports', `battle-report-${TEST_RUN_ID}.json`);
  const visualDir = join(process.cwd(), 'generated', 'battle-reports', `battle-report-${TEST_RUN_ID}`);
  if (existsSync(reportJson)) {
    rmSync(reportJson, { force: true });
  }
  if (existsSync(visualDir)) {
    rmSync(visualDir, { recursive: true, force: true });
  }
}

function createMockReport(): BattleReport {
  return {
    config: {
      missionId: 'QAI_11',
      missionName: 'Elimination',
      gameSize: 'VERY_SMALL' as any,
      battlefieldWidth: 24,
      battlefieldHeight: 24,
      maxTurns: 6,
      endGameTurn: 4,
      sides: [],
      densityRatio: 0,
      lighting: 'Day, Clear' as any,
      visibilityOrMu: 16,
      maxOrm: 3,
      allowConcentrateRangeExtension: true,
      perCharacterFovLos: false,
      verbose: false,
    },
    winner: 'Alpha',
    finalCounts: [],
    stats: {
      totalActions: 0,
      moves: 0,
      movesWhileWaiting: 0,
      closeCombats: 0,
      rangedCombats: 0,
      disengages: 0,
      waits: 0,
      waitsSelectedPlanner: 0,
      waitsSelectedUtility: 0,
      waitChoicesGiven: 0,
      waitChoicesTaken: 0,
      waitChoicesSucceeded: 0,
      waitMaintained: 0,
      waitUpkeepPaid: 0,
      detects: 0,
      hides: 0,
      reacts: 0,
      reactChoiceWindows: 0,
      reactChoicesGiven: 0,
      reactChoicesTaken: 0,
      waitTriggeredReacts: 0,
      reactWoundsInflicted: 0,
      waitReactWoundsInflicted: 0,
      eliminations: 0,
      kos: 0,
      turnsCompleted: 0,
      losChecks: 0,
      lofChecks: 0,
      totalPathLength: 0,
      modelsMoved: 0,
      hitTestsAttempted: 12,
      hitTestsPassed: 7,
      hitTestsFailed: 5,
      damageTestsAttempted: 6,
      damageTestsPassed: 4,
      damageTestsFailed: 2,
      woundsAssigned: 3,
      fearAssigned: 0,
      delayAssigned: 4,
    },
    usage: {
      totalTokens: 0,
      tokensPerActivation: 0,
      decisionLatencyMs: 0,
    },
    nestedSections: {
      sides: [],
      battlefieldLayout: {
        widthMu: 24,
        heightMu: 24,
        densityRatio: 0,
        terrainFeatures: [],
        deployments: [],
      },
    },
    advancedRules: {
      bonusActions: {
        opportunities: 0,
        optionsOffered: 0,
        optionsAvailable: 0,
        offeredByType: {},
        availableByType: {},
        executed: 0,
        executedByType: {},
      },
      passiveOptions: {
        opportunities: 0,
        optionsOffered: 0,
        optionsAvailable: 0,
        offeredByType: {},
        availableByType: {},
        rejectedByReason: {},
        rejectedByReasonByTurn: {},
        rejectedStatusByType: {},
        prefilteredByReason: {},
        prefilteredByReasonByTurn: {},
        used: 0,
        usedByType: {
          Defend: 2,
        },
      },
      situationalModifiers: {
        testsObserved: 0,
        modifiedTests: 0,
        modifiersApplied: 0,
        byType: {
          concentrate: 3,
          flanked: 1,
        },
      },
    },
    log: [],
  } as unknown as BattleReport;
}

describe('writeBattleArtifacts', () => {
  afterEach(() => {
    cleanup();
  });

  it('writes report/audit/viewer artifacts under one shared run id', () => {
    cleanup();
    const report = createMockReport();
    const artifacts = writeBattleArtifacts(report, {
      runId: TEST_RUN_ID,
      audit: true,
      viewer: true,
    });

    expect(artifacts.runId).toBe(TEST_RUN_ID);
    expect(artifacts.reportPath).toContain(`generated/ai-battle-reports/battle-report-${TEST_RUN_ID}.json`);
    expect(artifacts.auditPath).toContain(`generated/battle-reports/battle-report-${TEST_RUN_ID}/audit.json`);
    expect(artifacts.viewerPath).toContain(`generated/battle-reports/battle-report-${TEST_RUN_ID}/battle-report.html`);
    expect(existsSync(artifacts.reportPath)).toBe(true);
    expect(existsSync(artifacts.auditPath!)).toBe(true);
    expect(existsSync(artifacts.viewerPath!)).toBe(true);
  });

  it('builds fallback audit trace and injects terrain metadata from report battlefield', () => {
    const report = createMockReport() as any;
    report.battlefield = {
      terrainFeatures: [
        {
          id: 't1',
          type: 'Difficult',
          vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
          meta: { category: 'area' },
        },
      ],
    };
    const trace = buildBattleAuditTrace(report);
    expect(trace.session.missionId).toBe('QAI_11');
    expect((trace as any).terrain).toBeDefined();
    expect((trace as any).terrain[0].id).toBe('t1');
    expect((trace as any).combatMetrics.hitTests.passRate).toBeCloseTo(7 / 12, 6);
    expect((trace as any).combatMetrics.situationalModifiersByType.concentrate).toBe(3);
  });

  it('writes external entity manifest files and stores paths in audit.entities.exportPaths', () => {
    cleanup();
    const report = createMockReport();
    (report as any).entities = {
      version: '1.0',
      sides: [
        { id: 'side-1-alpha', name: 'Alpha', sideIndex: 0, tacticalDoctrine: 'operative', assemblyIds: ['assembly-1-alpha'], totalBp: 100 },
      ],
      assemblies: [
        { id: 'assembly-1-alpha', name: 'Alpha Assembly', sideId: 'side-1-alpha', sideName: 'Alpha', sideIndex: 0, members: ['alpha-1'], totalBp: 100 },
      ],
      characters: [
        { id: 'alpha-1', name: 'Alpha One', sideId: 'side-1-alpha', sideName: 'Alpha', sideIndex: 0, assemblyId: 'assembly-1-alpha', assemblyName: 'Alpha Assembly', assemblyIndex: 0, profileId: 'profile-1', loadoutId: 'loadout-1', totalBp: 40 },
      ],
      profiles: [
        { id: 'profile-1', name: 'Alpha One', archetype: 'Veteran', loadoutId: 'loadout-1', totalBp: 40 },
      ],
      loadouts: [
        { id: 'loadout-1', techAge: 'Classical', itemNames: ['Sword, Broad'], weapons: ['Sword, Broad'], armors: [], gear: [], hasShield: false, totalBp: 8 },
      ],
      byModelId: {
        'alpha-1': {
          sideId: 'side-1-alpha',
          sideName: 'Alpha',
          sideIndex: 0,
          assemblyId: 'assembly-1-alpha',
          assemblyName: 'Alpha Assembly',
          profileId: 'profile-1',
          loadoutId: 'loadout-1',
          characterId: 'alpha-1',
        },
      },
    };

    const artifacts = writeBattleArtifacts(report, {
      runId: TEST_RUN_ID,
      audit: true,
      viewer: false,
    });
    const audit = JSON.parse(readFileSync(artifacts.auditPath!, 'utf-8')) as any;
    expect(audit.entities?.exportPaths?.index).toBe('entities/index.json');
    const baseDir = join(process.cwd(), 'generated', 'battle-reports', `battle-report-${TEST_RUN_ID}`);
    expect(existsSync(join(baseDir, 'entities', 'index.json'))).toBe(true);
    expect(existsSync(join(baseDir, 'entities', 'model-index.json'))).toBe(true);
  });
});
