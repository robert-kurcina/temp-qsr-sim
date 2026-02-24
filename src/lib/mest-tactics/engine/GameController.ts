import { Character } from '../core/Character';
import { GameManager } from './GameManager';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { Item } from '../core/Item';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { buildLOSResultContext, ActionContextInput } from '../battlefield/validation/action-context';
import { TurnPhase } from '../core/types';
import { getCharacterTraitLevel } from '../status/status-system';
import { MissionSide } from '../mission/MissionSide';
import {
  MissionFlowOptions,
  MissionFlowState,
  advanceEndGameState,
  computeMissionOutcome,
  initMissionFlow,
  mergeMissionDelta,
  recordBottleResults,
  recordFirstBlood,
} from '../missions/mission-flow';
import { MissionScoreResult } from '../missions/mission-scoring';
import { BottleTestResult } from '../status/bottle-tests';
import { MissionModel } from '../missions/mission-keys';
import { createAIGameLoop, AIGameLoopConfig } from '../ai/executor/AIGameLoop';
import { createMissionRuntimeAdapter } from '../missions/mission-runtime-adapter';

export interface ControllerLogEntry {
  turn: number;
  round: number;
  actor: string;
  action: string;
  detail?: string;
}

export interface SkirmishConfig {
  maxTurns?: number;
  rng?: () => number;
  roundsPerTurn?: number;
  enableTransfix?: boolean;
  enableTakeCover?: boolean;
  /** Optional: allow attacks against KO'd models (Basic/Intro default false) */
  enableKOdAttacks?: boolean;
  /** Optional: controller traits for Puppet KO'd rules */
  kodControllerTraitsByCharacterId?: Record<string, string[]>;
  /** Optional: coordinator traits for Puppet KO'd rules */
  kodCoordinatorTraitsByCharacterId?: Record<string, string[]>;
}

export interface MissionRunConfig extends SkirmishConfig, MissionFlowOptions {
  endDieRolls?: number[];
  missionId?: string;
  /** Enable AI control for all sides */
  enableAI?: boolean;
  /** AI configuration (only used if enableAI is true) */
  aiConfig?: Partial<AIGameLoopConfig>;
  /** Optional: initiative-card holder wins final ties (default false) */
  initiativeCardTieBreakerOnTie?: boolean;
  /** @deprecated use initiativeCardTieBreakerOnTie */
  suddenDeathOnTie?: boolean;
  /** Initiative Card holder for sudden death tie-breaker (optional) */
  initiativeCardHolderSideId?: string;
}

export interface MissionRunResult {
  log: ControllerLogEntry[];
  state: MissionFlowState;
  outcome: MissionScoreResult;
}

interface AttackResolutionState {
  wounds: number;
  isKOd: boolean;
  isEliminated: boolean;
}

interface TurnExecutionHooks {
  onTurnStart?: (turn: number, round: number) => void;
  onAttackResolved?: (event: {
    attacker: Character;
    target: Character;
    attackerSideId?: string;
    targetSideId?: string;
    priorTargetState: AttackResolutionState;
    woundsAdded: number;
  }) => void;
}

export class GameController {
  private manager: GameManager;
  private battlefield: Battlefield;
  private log: ControllerLogEntry[] = [];

  constructor(manager: GameManager, battlefield: Battlefield) {
    this.manager = manager;
    this.battlefield = battlefield;
  }

  runSkirmish(sideA: Character[], sideB: Character[], config: SkirmishConfig = {}): ControllerLogEntry[] {
    this.runTurns([sideA, sideB], config, undefined, ['SideA', 'SideB']);
    return this.log;
  }

  /**
   * Run a mission-based game with MissionSide objects.
   *
   * Note: This is a simplified implementation. Full mission features
   * (objective markers, POI control, VIP system, etc.) are handled
   * by the mission-flow system in ../missions/mission-flow.ts
   *
   * @param sides - The mission sides
   * @param config - Mission configuration
   * @returns Mission run result with log, state, and outcome
   */
  runMission(sides: MissionSide[], config: MissionRunConfig = {}): MissionRunResult {
    if (sides.length < 2 || sides.length > 4) {
      throw new Error('runMission supports 2-4 sides.');
    }

    // Check if AI control is enabled
    if (config.enableAI) {
      return this.runMissionWithAI(sides, config);
    }

    const missionRuntime = createMissionRuntimeAdapter(config.missionId, sides);
    this.manager.setMissionRuntimeAdapter(missionRuntime);

    try {
    // Initialize mission flow state
    let state = initMissionFlow(sides, config);

    // Extract characters from sides for gameplay
    const sideCharacters = sides.map(side => side.members.map(member => member.character));
    const sideIds = sides.map(side => side.id);

    let ended = false;

    // Run turns with mission scoring
    this.runTurns(sideCharacters, config, bottleResults => {
      const runtimeTurnUpdate = missionRuntime.onTurnEnd(this.manager.currentTurn, this.buildMissionModels(sides));
      state = mergeMissionDelta(state, runtimeTurnUpdate.delta);
      if (runtimeTurnUpdate.firstBloodSideId) {
        state = recordFirstBlood(state, runtimeTurnUpdate.firstBloodSideId);
      }
      if (runtimeTurnUpdate.immediateWinnerSideId) {
        ended = true;
        this.log.push({
          turn: this.manager.currentTurn,
          round: this.manager.currentRound,
          actor: '-',
          action: 'EndGame',
          detail: `mission-immediate:${runtimeTurnUpdate.immediateWinnerSideId}`,
        });
        return true;
      }

      // Record bottle test results
      state = recordBottleResults(state, bottleResults);

      // Check for game end
      const advance = advanceEndGameState(state, config.endDieRolls);
      state = advance.state;
      if (advance.ended) {
        this.log.push({
          turn: this.manager.currentTurn,
          round: this.manager.currentRound,
          actor: '-',
          action: 'EndGame',
          detail: advance.reason ?? 'end-die',
        });
      }
      ended = advance.ended;
      return ended;
    }, sideIds, {
      onTurnStart: (turn) => {
        const update = missionRuntime.onTurnStart(turn, this.buildMissionModels(sides));
        state = mergeMissionDelta(state, update.delta);
        if (update.firstBloodSideId) {
          state = recordFirstBlood(state, update.firstBloodSideId);
        }
        if (update.immediateWinnerSideId) {
          ended = true;
          this.log.push({
            turn: this.manager.currentTurn,
            round: this.manager.currentRound,
            actor: '-',
            action: 'EndGame',
            detail: `mission-immediate:${update.immediateWinnerSideId}`,
          });
        }
      },
      onAttackResolved: ({ attacker, target, attackerSideId, priorTargetState, woundsAdded }) => {
        const attackUpdate = missionRuntime.recordAttack(attackerSideId, woundsAdded);
        if (attackUpdate.firstBloodSideId) {
          state = recordFirstBlood(state, attackUpdate.firstBloodSideId);
        }

        const becameKOd = !priorTargetState.isKOd && target.state.isKOd;
        const becameEliminated = !priorTargetState.isEliminated && target.state.isEliminated;
        if (!becameKOd && !becameEliminated) {
          return;
        }

        const targetPosition = this.manager.getCharacterPosition(target);
        if (targetPosition) {
          missionRuntime.onCarrierDown(target.id, targetPosition, becameEliminated);
        }

        if (!becameEliminated) return;

        const eliminationUpdate = missionRuntime.onModelEliminated(target.id, attacker.id);
        state = mergeMissionDelta(state, eliminationUpdate.delta);
        if (eliminationUpdate.firstBloodSideId) {
          state = recordFirstBlood(state, eliminationUpdate.firstBloodSideId);
        }
        if (eliminationUpdate.immediateWinnerSideId) {
          ended = true;
          this.log.push({
            turn: this.manager.currentTurn,
            round: this.manager.currentRound,
            actor: '-',
            action: 'EndGame',
            detail: `mission-immediate:${eliminationUpdate.immediateWinnerSideId}`,
          });
        }
      },
    });

    const finalUpdate = missionRuntime.finalize(this.buildMissionModels(sides));
    state = mergeMissionDelta(state, finalUpdate.delta);
    if (finalUpdate.firstBloodSideId) {
      state = recordFirstBlood(state, finalUpdate.firstBloodSideId);
    }

    // Calculate final scores
    const outcome = this.calculateMissionOutcome(sides, state);
    this.applyInitiativeCardTieBreakerIfEnabled(
      outcome,
      config.initiativeCardTieBreakerOnTie ?? config.suddenDeathOnTie ?? false,
      config.initiativeCardHolderSideId
    );

    return { log: this.log, state, outcome };
    } finally {
      this.manager.setMissionRuntimeAdapter(null);
    }
  }

  /**
   * Run a mission with AI control for all sides
   */
  private runMissionWithAI(sides: MissionSide[], config: MissionRunConfig): MissionRunResult {
    const missionRuntime = createMissionRuntimeAdapter(config.missionId, sides);
    this.manager.setMissionRuntimeAdapter(missionRuntime);

    try {
    // Initialize mission flow state
    let state = initMissionFlow(sides, config);
    this.manager.allowKOdAttacks = config.enableKOdAttacks ?? false;
    this.manager.kodControllerTraitsByCharacterId = config.kodControllerTraitsByCharacterId;
    this.manager.kodCoordinatorTraitsByCharacterId = config.kodCoordinatorTraitsByCharacterId;

    // Create AI game loop
    const aiConfig: Partial<AIGameLoopConfig> = {
      enableStrategic: true,
      enableTactical: true,
      enableCharacterAI: true,
      enableValidation: true,
      enableReplanning: true,
      verboseLogging: false,
      allowKOdAttacks: config.enableKOdAttacks ?? false,
      kodControllerTraitsByCharacterId: config.kodControllerTraitsByCharacterId,
      kodCoordinatorTraitsByCharacterId: config.kodCoordinatorTraitsByCharacterId,
      onTurnEnd: (turn) => {
        const update = missionRuntime.onTurnEnd(turn, this.buildMissionModels(sides));
        state = mergeMissionDelta(state, update.delta);
        if (update.firstBloodSideId) {
          state = recordFirstBlood(state, update.firstBloodSideId);
        }
      },
      ...config.aiConfig,
    };

    const aiLoop = createAIGameLoop(this.manager, this.battlefield, sides, aiConfig);

    // Run AI game
    const aiResult = aiLoop.runGame(config.maxTurns ?? 10);

    // Update mission state with AI results
    state.turn = aiResult.finalTurn;

    const finalUpdate = missionRuntime.finalize(this.buildMissionModels(sides));
    state = mergeMissionDelta(state, finalUpdate.delta);
    if (finalUpdate.firstBloodSideId) {
      state = recordFirstBlood(state, finalUpdate.firstBloodSideId);
    }

    // Log AI game summary
    this.log.push({
      turn: aiResult.finalTurn,
      round: 0,
      actor: 'AI',
      action: 'GameComplete',
      detail: `Actions: ${aiResult.totalActions}, Success: ${aiResult.successfulActions}, Failed: ${aiResult.failedActions}, Replanned: ${aiResult.replannedActions}`,
    });

    if (aiResult.endReason) {
      this.log.push({
        turn: aiResult.finalTurn,
        round: 0,
        actor: 'AI',
        action: 'EndGame',
        detail: aiResult.endReason,
      });
    }

    // Calculate final scores
    const outcome = this.calculateMissionOutcome(sides, state);
    this.applyInitiativeCardTieBreakerIfEnabled(
      outcome,
      config.initiativeCardTieBreakerOnTie ?? config.suddenDeathOnTie ?? false,
      config.initiativeCardHolderSideId
    );

    return { log: this.log, state, outcome };
    } finally {
      this.manager.setMissionRuntimeAdapter(null);
    }
  }

  /**
   * Calculate mission outcome from final game state
   */
  private calculateMissionOutcome(sides: MissionSide[], state: MissionFlowState): MissionScoreResult {
    return computeMissionOutcome(sides, state);
  }

  private applyInitiativeCardTieBreakerIfEnabled(
    outcome: MissionScoreResult,
    enabled: boolean,
    initiativeCardHolderSideId?: string
  ): void {
    if (!enabled || !outcome.tie) return;

    const tieCandidates = outcome.tieSideIds.length > 0
      ? outcome.tieSideIds
      : Object.entries(outcome.vpBySide)
        .sort((a, b) => b[1] - a[1])
        .filter(([, vp], index, items) => index === 0 || vp === items[0][1])
        .map(([sideId]) => sideId);
    if (tieCandidates.length <= 1) return;

    const preferredWinner = initiativeCardHolderSideId ?? this.manager.lastInitiativeWinnerSideId ?? undefined;
    if (!preferredWinner || !tieCandidates.includes(preferredWinner)) return;

    outcome.winnerSideId = preferredWinner;
    outcome.tie = false;
    outcome.tieSideIds = [];
    outcome.winnerReason = 'initiative-card';
    outcome.tieBreakMethod = 'initiative-card';
    outcome.suddenDeathApplied = true;
  }

  private runTurns(
    sides: Character[][],
    config: SkirmishConfig,
    onTurnEnd?: (bottleResults: Record<string, BottleTestResult>) => boolean,
    sideIds: string[] = [],
    hooks: TurnExecutionHooks = {}
  ): void {
    const maxTurns = config.maxTurns ?? 3;
    const rng = config.rng ?? Math.random;
    const enableTransfix = config.enableTransfix ?? false;
    const enableTakeCover = config.enableTakeCover ?? false;
    this.manager.roundsPerTurn = config.roundsPerTurn ?? this.manager.roundsPerTurn;
    this.manager.allowKOdAttacks = config.enableKOdAttacks ?? false;
    this.manager.kodControllerTraitsByCharacterId = config.kodControllerTraitsByCharacterId;
    this.manager.kodCoordinatorTraitsByCharacterId = config.kodCoordinatorTraitsByCharacterId;
    this.manager.phase = TurnPhase.Setup;

    while (this.manager.currentTurn <= maxTurns) {
      const currentPhase: TurnPhase = this.manager.phase as TurnPhase;
      if (currentPhase === TurnPhase.Setup || currentPhase === TurnPhase.TurnEnd) {
        this.manager.advancePhase({ roller: rng, roundsPerTurn: this.manager.roundsPerTurn });
        if (this.manager.currentTurn > maxTurns) break;
        this.log.push({ turn: this.manager.currentTurn, round: this.manager.currentRound, actor: '-', action: 'TurnStart' });
        hooks.onTurnStart?.(this.manager.currentTurn, this.manager.currentRound);
      }

      const phaseAfterAdvance: TurnPhase = this.manager.phase as TurnPhase;
      if (phaseAfterAdvance !== TurnPhase.Activation) {
        this.manager.advancePhase({ roller: rng, roundsPerTurn: this.manager.roundsPerTurn });
        continue;
      }

      while (!this.manager.isTurnOver()) {
        const active = this.manager.getNextToActivate();
        if (!active) break;
        if (active.state.isEliminated) {
          this.manager.endActivation(active);
          continue;
        }

        const ap = this.manager.beginActivation(active);
        if (ap <= 0) {
          this.manager.endActivation(active);
          continue;
        }

        const activeSideIndex = sides.findIndex(side => side.some(member => member.id === active.id));
        const sideEnemies = sides
          .filter((_, index) => index !== activeSideIndex)
          .flat();
        const activePos = this.manager.getCharacterPosition(active);
        if (!activePos) {
          this.manager.endActivation(active);
          continue;
        }

        const targetInfo = this.pickClosestTarget(activePos, sideEnemies);
        if (!targetInfo) {
          this.manager.endActivation(active);
          continue;
        }

        if (enableTransfix) {
          const transfixLevel = getCharacterTraitLevel(active, 'Transfix');
          if (transfixLevel > 0) {
            const results = this.manager.executeTransfixAction(active, sideEnemies, { rating: transfixLevel });
            const applied = results.filter(result => result.misses > 0);
            if (applied.length > 0) {
              const detail = applied.map(result => `${result.targetId} misses=${result.misses}`).join(', ');
              this.log.push({
                turn: this.manager.currentTurn,
                round: this.manager.currentRound,
                actor: active.name,
                action: 'Transfix',
                detail,
              });
            }
          }
        }

        const { target, position: targetPos } = targetInfo;
        const rangedWeapon = this.findWeapon(active, 'ranged');
        const meleeWeapon = this.findWeapon(active, 'melee');
        const attackerSideId = sideIds[activeSideIndex];
        const targetSideIndex = sides.findIndex(side => side.some(member => member.id === target.id));
        const targetSideId = targetSideIndex >= 0 ? sideIds[targetSideIndex] : undefined;

        const spatial = this.buildActionInput(active, target, activePos, targetPos);
        const los = buildLOSResultContext(spatial);

        if (rangedWeapon && los.hasLOS && this.manager.spendAp(active, 1)) {
          const priorTargetState: AttackResolutionState = {
            wounds: target.state.wounds,
            isKOd: target.state.isKOd,
            isEliminated: target.state.isEliminated,
          };
          const takeCoverPosition = enableTakeCover
            ? this.findTakeCoverPosition(target, active, targetPos, spatial)
            : null;
          const result = this.manager.executeRangedAttack(active, target, rangedWeapon, {
            ...spatial,
            allowTakeCover: Boolean(takeCoverPosition),
            takeCoverPosition: takeCoverPosition ?? undefined,
          });
          this.log.push({
            turn: this.manager.currentTurn,
            round: this.manager.currentRound,
            actor: active.name,
            action: 'RangedAttack',
            detail: `${active.name} -> ${target.name} hit=${result.result.hit}`,
          });
          const damageResolution = result.result.damageResolution;
          const woundsAdded = damageResolution
            ? (damageResolution.woundsAdded + damageResolution.stunWoundsAdded)
            : 0;
          hooks.onAttackResolved?.({
            attacker: active,
            target,
            attackerSideId,
            targetSideId,
            priorTargetState,
            woundsAdded,
          });
        } else if (meleeWeapon && this.isInBaseContact(active, target, activePos, targetPos) && this.manager.spendAp(active, 1)) {
          const priorTargetState: AttackResolutionState = {
            wounds: target.state.wounds,
            isKOd: target.state.isKOd,
            isEliminated: target.state.isEliminated,
          };
          const result = this.manager.executeCloseCombatAttack(active, target, meleeWeapon, {
            ...spatial,
            moveStart: activePos,
            moveEnd: activePos,
            movedOverClear: false,
            wasFreeAtStart: true,
            opposingModels: sideEnemies.map(enemy => {
              const pos = this.manager.getCharacterPosition(enemy);
              return pos ? this.buildSpatialModel(enemy, pos) : null;
            }).filter(Boolean) as any,
          });
          this.log.push({
            turn: this.manager.currentTurn,
            round: this.manager.currentRound,
            actor: active.name,
            action: 'CloseCombat',
            detail: `${active.name} -> ${target.name} hit=${result.hit}`,
          });
          const damageResolution = result.damageResolution;
          const woundsAdded = damageResolution
            ? (damageResolution.woundsAdded + damageResolution.stunWoundsAdded)
            : 0;
          hooks.onAttackResolved?.({
            attacker: active,
            target,
            attackerSideId,
            targetSideId,
            priorTargetState,
            woundsAdded,
          });
        } else if (this.manager.spendAp(active, 1)) {
          const step = this.stepToward(activePos, targetPos);
          const moved = this.manager.moveCharacter(active, step);
          this.log.push({
            turn: this.manager.currentTurn,
            round: this.manager.currentRound,
            actor: active.name,
            action: 'Move',
            detail: `${active.name} to (${step.x}, ${step.y}) ${moved ? '' : '(blocked)'}`,
          });
        }

        this.manager.endActivation(active);
      }

      const bottleResults = this.manager.resolveBottleTests(
        sides.map((side, index) => ({
          id: sideIds[index] ?? `Side${index + 1}`,
          characters: side,
          orderedCandidate: this.pickOrderedCandidate(side),
          opposingCount: this.countRemaining(sides.filter((_, i) => i !== index).flat()),
        }))
      );
      for (const [sideId, result] of Object.entries(bottleResults)) {
        if (result.bottledOut) {
          this.log.push({ turn: this.manager.currentTurn, round: this.manager.currentRound, actor: sideId, action: 'BottleOut' });
        }
      }

      if (onTurnEnd?.(bottleResults)) {
        break;
      }

      this.manager.advancePhase({ roller: rng, roundsPerTurn: this.manager.roundsPerTurn });
    }
  }

  private pickClosestTarget(start: Position, enemies: Character[]): { target: Character; position: Position; distance: number } | null {
    let closest: { target: Character; position: Position; distance: number } | null = null;
    for (const enemy of enemies) {
      if (enemy.state.isEliminated) continue;
      const pos = this.manager.getCharacterPosition(enemy);
      if (!pos) continue;
      const distance = Math.hypot(pos.x - start.x, pos.y - start.y);
      if (!closest || distance < closest.distance) {
        closest = { target: enemy, position: pos, distance };
      }
    }
    return closest;
  }

  private findWeapon(character: Character, kind: 'ranged' | 'melee'): Item | null {
    const equipment = character.profile.equipment || character.profile.items || [];
    for (const item of equipment) {
      if (!item) continue;
      const classification = item.classification || item.class || '';
      if (kind === 'melee' && classification.toLowerCase().includes('melee')) {
        return item;
      }
      if (kind === 'ranged' && !classification.toLowerCase().includes('melee') && item.or && item.dmg) {
        return item;
      }
    }
    return null;
  }

  private buildSpatialModel(character: Character, position: Position) {
    const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
    return {
      id: character.id,
      position,
      baseDiameter: getBaseDiameterFromSiz(siz),
      siz,
    };
  }

  private buildActionInput(attacker: Character, target: Character, attackerPos: Position, targetPos: Position): ActionContextInput {
    return {
      battlefield: this.battlefield,
      attacker: this.buildSpatialModel(attacker, attackerPos),
      target: this.buildSpatialModel(target, targetPos),
    };
  }

  private isInBaseContact(a: Character, b: Character, aPos: Position, bPos: Position): boolean {
    const aBase = getBaseDiameterFromSiz(a.finalAttributes.siz ?? a.attributes.siz ?? 3);
    const bBase = getBaseDiameterFromSiz(b.finalAttributes.siz ?? b.attributes.siz ?? 3);
    const distance = Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y);
    return distance <= (aBase + bBase) / 2;
  }

  private stepToward(start: Position, target: Position): Position {
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
    return { x: start.x + stepX, y: start.y + stepY };
  }

  private findTakeCoverPosition(
    defender: Character,
    attacker: Character,
    defenderPos: Position,
    spatial: ActionContextInput
  ): Position | null {
    if (!defender.state.isAttentive || !defender.state.isOrdered) return null;
    const moveLimit = defender.finalAttributes.mov ?? defender.attributes.mov ?? 0;
    if (moveLimit <= 0) return null;

    const directions: Position[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 },
    ];

    const scale = Math.min(1, moveLimit);
    let best: Position | null = null;
    let bestCover = 0;

    for (const dir of directions) {
      const candidate = {
        x: defenderPos.x + dir.x * scale,
        y: defenderPos.y + dir.y * scale,
      };
      if (candidate.x < 0 || candidate.y < 0 || candidate.x > this.battlefield.width || candidate.y > this.battlefield.height) {
        continue;
      }
      const cover = buildLOSResultContext({
        ...spatial,
        target: {
          ...spatial.target,
          position: candidate,
        },
      });
      const coverScore = (cover.hasDirectCover ? 2 : 0) + (cover.hasInterveningCover ? 1 : 0) + (!cover.hasLOS ? 3 : 0);
      if (coverScore > bestCover) {
        bestCover = coverScore;
        best = candidate;
      }
    }

    return bestCover > 0 ? best : null;
  }

  private countRemaining(characters: Character[]): number {
    return characters.filter(char => !char.state.isEliminated && !char.state.isKOd).length;
  }

  private pickOrderedCandidate(characters: Character[]): Character | null {
    return characters.find(char =>
      !char.state.isEliminated
      && !char.state.isKOd
      && char.state.isOrdered
      && char.state.isAttentive
    ) ?? null;
  }

  private buildMissionModels(sides: MissionSide[]): MissionModel[] {
    const models: MissionModel[] = [];
    for (const side of sides) {
      for (const member of side.members) {
        const character = member.character;
        const position = this.manager.getCharacterPosition(character);
        if (!position) continue;
        models.push({
          id: member.id,
          sideId: side.id,
          position,
          bp: member.profile?.totalBp ?? 0,
          isKOd: character.state.isKOd,
          isEliminated: character.state.isEliminated,
          isOrdered: character.state.isOrdered,
          isAttentive: character.state.isAttentive,
        });
      }
    }
    return models;
  }
}
