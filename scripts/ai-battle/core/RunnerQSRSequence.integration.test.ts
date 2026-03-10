import { afterEach, describe, expect, it, vi } from 'vitest';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Profile } from '../../../src/lib/mest-tactics/core/Profile';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { resetRoller, setRoller } from '../../../src/lib/mest-tactics/subroutines/dice-roller';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import type { GameConfig } from '../AIBattleConfig';
import { createEmptyStats } from '../validation/ValidationMetrics';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import { resolveCharacterTurnForRunner } from './CharacterTurnResolutionSupport';
import { executeActivationDecisionStepForRunner } from './ActivationDecisionStepSupport';
import { processReactsForRunner } from './ReactResolution';

function makeProfile(name: string, ref = 2, mov = 4, items: any[] = []): Profile {
  return {
    name,
    archetype: {
      attributes: {
        cca: 2,
        rca: 2,
        ref,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov,
        siz: 3,
      },
      bp: 30,
      traits: [],
    } as any,
    items,
    equipment: items,
    totalBp: 30,
    adjustedBp: 30,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 0,
    adjPhysicality: 0,
    durability: 0,
    adjDurability: 0,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 0,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  } as unknown as Profile;
}

function createLiveCharacter(name: string, ref = 2, mov = 4, items: any[] = []): Character {
  return new Character(makeProfile(name, ref, mov, items));
}

function createConfig(): GameConfig {
  return {
    missionId: 'QAI_11',
    missionName: 'Elimination',
    gameSize: GameSize.VERY_SMALL,
    battlefieldWidth: 18,
    battlefieldHeight: 24,
    maxTurns: 6,
    endGameTurn: 4,
    sides: [
      {
        name: 'Alpha',
        bp: 100,
        modelCount: 1,
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Alpha Assembly',
      },
      {
        name: 'Bravo',
        bp: 100,
        modelCount: 1,
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Bravo Assembly',
      },
    ],
    densityRatio: 0,
    lighting: 'Day, Clear' as any,
    visibilityOrMu: 16,
    maxOrm: 3,
    allowConcentrateRangeExtension: false,
    perCharacterFovLos: false,
    verbose: false,
  };
}

describe('Runner QSR sequence integration', () => {
  afterEach(() => {
    resetRoller();
  });

  async function runWaitReactScenario(options?: {
    activeRef?: number;
    reactorRef?: number;
    reactorOverreach?: boolean;
    activeHidden?: boolean;
  }) {
    setRoller(() => Array(32).fill(6));
    const activeRef = options?.activeRef ?? 2;
    const reactorRef = options?.reactorRef ?? 5;
    const reactorOverreach = options?.reactorOverreach ?? false;
    const activeHidden = options?.activeHidden ?? false;

    const battlefield = new Battlefield(12, 12);
    const active = createLiveCharacter('active', activeRef, 4, [
      {
        name: 'Test Sidearm',
        classification: 'Range',
        class: 'Range',
        type: 'Ranged',
        bp: 0,
        or: 8,
        accuracy: '-',
        impact: 0,
        dmg: '1',
        traits: [],
      },
    ]);
    const reactor = createLiveCharacter('reactor', reactorRef, 4, [
      {
        name: 'Test Rifle',
        classification: 'Range',
        class: 'Range',
        type: 'Ranged',
        bp: 0,
        or: 8,
        accuracy: '-',
        impact: 0,
        dmg: '2',
        traits: [],
      },
    ]);

    active.state.isHidden = activeHidden;
    reactor.state.isWaiting = true;
    reactor.state.isOverreach = reactorOverreach;

    battlefield.placeCharacter(active, { x: 8, y: 6 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });

    const gameManager = new GameManager([active, reactor], battlefield);
    const hiddenInitiativeSpy = vi.spyOn(gameManager, 'checkHiddenAtInitiativeStart');

    const tracker = new StatisticsTracker();
    const profiler = new PerformanceProfiler();
    const log: any[] = [];
    const sideNameByCharacterId = new Map<string, string>([
      [active.id, 'Alpha'],
      [reactor.id, 'Bravo'],
    ]);

    const missionSides = [
      { id: 'Alpha', state: { initiativePoints: 0 } },
      { id: 'Bravo', state: { initiativePoints: 0 } },
    ] as any;

    const buildRuntime = vi.fn(() => ({
      missionState: {
        missionSides,
        missionVpBySide: { Alpha: 0, Bravo: 0 },
        missionRpBySide: { Alpha: 0, Bravo: 0 },
        sideNameByCharacterId,
      },
      runtime: {
        tracker,
        profiler,
        log,
        sanitizeForAudit: (value: unknown) => value,
        syncMissionRuntimeForAttack: () => undefined,
        computeFallbackMovePosition: vi.fn(() => null),
        maximizeClosingMoveDestination: vi.fn((_: unknown, destination: unknown) => destination),
        processReacts: (
          activeModel: Character,
          opponents: Character[],
          manager: GameManager,
          trigger: 'Move' | 'NonMove',
          movedDistance: number,
          reactingToEngaged: boolean,
          visibilityOrMu: number
        ) => processReactsForRunner({
          active: activeModel,
          opponents,
          gameManager: manager,
          trigger,
          movedDistance,
          reactingToEngaged,
          visibilityOrMu,
          trackReactChoiceWindow: () => undefined,
          trackCombatExtras: () => undefined,
          sanitizeForAudit: value => value,
          toOpposedTestAudit: () => ({ pass: true }),
        }),
        trackReactOutcome: () => undefined,
        executeMoveAndTrackOpportunity: vi.fn(() => ({
          moved: false,
          moveResult: { reason: 'unused' },
          opposedTest: undefined,
          details: undefined,
        })),
        executeWaitAction: (
          actor: Character,
          _opponents: Character[],
          _manager: GameManager,
          _visibilityOrMu: number,
          _selectionSource: string | undefined,
          _allowWaitAction: boolean
        ) => {
          actor.state.isWaiting = true;
          return {
            executed: true,
            resultCode: 'wait=true',
            details: { source: 'runner-sequence' },
          };
        },
        buildCombatActionResolutionDeps: () => ({} as any),
        processMoveConcludedPassives: () => undefined,
        actionValidator: {
          validateActionDecision: () => ({ isValid: true, errors: [] }),
        },
      },
    }));

    const runLoop = vi.fn(async (loopParams: any) => {
      if (activeHidden) {
        // Hidden reveal should already be resolved before any decision execution.
        expect(loopParams.character.state.isHidden).toBe(false);
      }

      const stepOutcome = await executeActivationDecisionStepForRunner({
        decision: {
          type: 'wait',
          reason: 'trigger non-move react action',
          priority: 1,
          requiresAP: true,
        } as any,
        apBefore: loopParams.gameManager.getApRemaining(loopParams.character),
        character: loopParams.character,
        allSides: loopParams.allSides,
        allies: [],
        enemies: [reactor],
        battlefield: loopParams.battlefield,
        gameManager: loopParams.gameManager,
        config: loopParams.config,
        sideIndex: loopParams.sideIndex,
        sideName: loopParams.sideName,
        turn: loopParams.turn,
        missionSides: loopParams.missionState.missionSides,
        sideNameByCharacterId: loopParams.missionState.sideNameByCharacterId,
        activationAudit: loopParams.activationAudit,
        tracker: loopParams.runtime.tracker,
        profiler: loopParams.runtime.profiler,
        log: loopParams.runtime.log,
        actionValidator: loopParams.runtime.actionValidator,
        computeFallbackMovePosition: loopParams.runtime.computeFallbackMovePosition,
        maximizeClosingMoveDestination: loopParams.runtime.maximizeClosingMoveDestination,
        executeMoveAndTrackOpportunity: loopParams.runtime.executeMoveAndTrackOpportunity,
        executeWaitAction: loopParams.runtime.executeWaitAction,
        buildCombatActionResolutionDeps: loopParams.runtime.buildCombatActionResolutionDeps,
        processMoveConcludedPassives: loopParams.runtime.processMoveConcludedPassives,
        processReacts: loopParams.runtime.processReacts,
        trackReactOutcome: loopParams.runtime.trackReactOutcome,
        sanitizeForAudit: loopParams.runtime.sanitizeForAudit,
        syncMissionRuntimeForAttack: loopParams.runtime.syncMissionRuntimeForAttack,
        onAttackDecision: () => undefined,
      });

      return { lastKnownAp: stepOutcome.lastKnownAp };
    });

    const result = await resolveCharacterTurnForRunner({
      character: active,
      allSides: [{ characters: [active] }, { characters: [reactor] }],
      battlefield,
      gameManager,
      aiController: {} as any,
      turn: 1,
      sideIndex: 0,
      config: createConfig(),
      tracker,
      profiler,
      log,
      stats: createEmptyStats(),
      missionSides,
      missionVpBySide: { Alpha: 0, Bravo: 0 },
      missionRpBySide: { Alpha: 0, Bravo: 0 },
      missionSideIds: ['Alpha', 'Bravo'],
      eliminatedBPBySide: { Alpha: 0, Bravo: 0 },
      sideNameByCharacterId,
      doctrineByCharacterId: new Map([
        [active.id, TacticalDoctrine.Operative],
        [reactor.id, TacticalDoctrine.Operative],
      ]),
      getFirstBloodAwarded: () => false,
      setFirstBloodAwarded: () => undefined,
      nextActivationSequence: () => 1,
      applyDoctrineLoadoutConfig: () => undefined,
      sanitizeForAudit: value => value,
      syncMissionRuntimeForAttack: () => undefined,
      deps: {
        buildActivationDecisionRuntime: buildRuntime as any,
        runActivationDecisionLoop: runLoop as any,
        },
      });

    return {
      result,
      active,
      reactor,
      hiddenInitiativeSpy,
    };
  }

  it('runs Hidden-at-start reveal, then wait decision, then NonMove ReactAction in one activation', async () => {
    const scenario = await runWaitReactScenario({
      activeRef: 2,
      reactorRef: 5,
      activeHidden: true,
    });

    expect(scenario.hiddenInitiativeSpy).toHaveBeenCalledTimes(1);
    expect(scenario.active.state.isHidden).toBe(false);
    expect(scenario.result).not.toBeNull();
    expect(scenario.result?.steps).toHaveLength(1);
    expect(scenario.result?.steps[0].actionType).toBe('wait');
    expect(scenario.result?.steps[0].success).toBe(true);
    expect(scenario.result?.steps[0].interactions.some(interaction =>
      interaction.kind === 'react'
      && interaction.detail === 'react=true:action:ranged'
    )).toBe(true);
    expect((scenario.result?.steps[0].details as any)?.react?.reactType).toBe('react_action');
    expect((scenario.result?.steps[0].details as any)?.react?.actionMode).toBe('ranged');
    expect((scenario.result?.steps[0].details as any)?.react?.requiredRef).toBe(3); // active REF 2 + abrupt 1
    expect((scenario.result?.steps[0].details as any)?.react?.effectiveRef).toBe(6); // reactor REF 5 + wait 1
  });

  it('blocks NonMove ReactAction when reactor effective REF equals but does not exceed active threshold', async () => {
    const scenario = await runWaitReactScenario({
      activeRef: 4,
      reactorRef: 3, // +1 wait => 4, required is 5
      activeHidden: false,
    });

    expect(scenario.result?.steps[0].interactions.some(interaction =>
      interaction.kind === 'react'
    )).toBe(false);
    expect((scenario.result?.steps[0].details as any)?.react).toBeUndefined();
    expect((scenario.result?.steps[0].details as any)?.reactGate?.executed).toBe(false);
    expect((scenario.result?.steps[0].details as any)?.reactGate?.requiredRef).toBe(5);
    expect((scenario.result?.steps[0].details as any)?.reactGate?.effectiveRef).toBe(4);
    expect((scenario.result?.steps[0].details as any)?.reactGate?.gateReason).toBe('Insufficient REF to React.');
  });

  it('allows NonMove ReactAction when reactor effective REF is higher than active threshold', async () => {
    const scenario = await runWaitReactScenario({
      activeRef: 4,
      reactorRef: 4, // +1 wait => 5, required is 5
      activeHidden: false,
    });

    expect(scenario.result?.steps[0].interactions.some(interaction =>
      interaction.kind === 'react'
      && interaction.detail === 'react=true:action:ranged'
    )).toBe(true);
    expect((scenario.result?.steps[0].details as any)?.react?.requiredRef).toBe(5);
    expect((scenario.result?.steps[0].details as any)?.react?.effectiveRef).toBe(5);
  });

  it('overreach penalty can flip NonMove ReactAction from pass to fail at the same REF band', async () => {
    const scenario = await runWaitReactScenario({
      activeRef: 4,
      reactorRef: 4, // +1 wait => 5, but overreach -1 => 4 < required 5
      reactorOverreach: true,
      activeHidden: false,
    });

    expect(scenario.result?.steps[0].interactions.some(interaction =>
      interaction.kind === 'react'
    )).toBe(false);
    expect((scenario.result?.steps[0].details as any)?.react).toBeUndefined();
    expect((scenario.result?.steps[0].details as any)?.reactGate?.requiredRef).toBe(5);
    expect((scenario.result?.steps[0].details as any)?.reactGate?.effectiveRef).toBe(4);
    expect((scenario.result?.steps[0].details as any)?.reactGate?.gateReason).toBe('Insufficient REF to React.');
  });
});
