import { Character } from '../core/Character';
import { CharacterStatus, TurnPhase } from '../core/types';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { getTacticsInitiativeBonus, getTacticsSituationalAwarenessExemption, resetMultipleAttackTracking, getThreatRange } from '../traits/combat-traits';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { ActionContextInput, CloseCombatContextInput } from '../battlefield/validation/action-context';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { SpatialRules, type SpatialModel } from '../battlefield/spatial/spatial-rules';
import { TerrainType as BattlefieldTerrainType } from '../battlefield/terrain/Terrain';
import { LOSOperations } from '../battlefield/los/LOSOperations';
import { d6, performTest, resolveTest } from '../subroutines/dice-roller';
import type { ResolveTestResult, TestDice } from '../subroutines/dice-roller';
import { MissionSide } from '../mission/MissionSide';
import { awardInitiativePoints, spendInitiativePoints } from '../mission/MissionSide';
import { ObjectiveMarker, MarkerTransferOptions } from '../mission/objective-markers';
import {
  attemptHide,
  attemptDetect,
  evaluateHide,
  resolveHiddenExposure,
  resolveWaitReveal,
  HideOptions,
  DetectOptions,
  RevealExposureOptions,
} from '../status/concealment';
import { MoraleOptions } from '../status/morale';
import { BottleTestResult } from '../status/bottle-tests';
import { getCharacterTraitLevel } from '../status/status-system';
import { PassiveEvent, ActiveToggleOption, PassiveOption } from '../status/passive-options';
import { DamageResolution } from '../subroutines/damage-test';
import { BonusActionSelection, buildBonusActionOptions } from '../actions/bonus-actions';
import { ReactEvent, ReactOption } from '../actions/react-actions';
import { executeFiddleAction, executeRallyAction, executeReviveAction, executeWaitAction, executeStowItem, executeUnstowItem, executeSwapItem } from '../actions/simple-actions';
import { performPushing } from '../actions/pushing-and-maneuvers';
import { getActiveToggleOptions, getBonusActionOptions, getPassiveOptions, getReactOptions, getReactOptionsSorted } from '../actions/option-builders';
import { executeMoveAction } from '../actions/move-action';
import { createGroupAction, type GroupAction } from '../actions/group-actions';
import { resolveDeclaredWeapon } from '../actions/declared-weapon';
import { hasItemTrait, hasItemTraitOnWeapon } from '../traits/item-traits';
import {
  executeCloseCombatAttack as runCloseCombatAttack,
  executeIndirectAttack as runIndirectAttack,
  executeRangedAttack as runRangedAttack,
} from '../actions/combat-actions';
import {
  calculateROFMarkerPositions,
  getEffectiveROFLevel,
  getROFDiceBonus,
  ROFMarker,
  SuppressionMarker,
} from '../traits/rof-suppression-spatial';
import { executeStandardReact as runStandardReact, executeReactAction as runReactAction } from '../actions/react-actions';
import { executeDisengageAction } from '../actions/disengage-action';
import { executeCombinedAction as runCombinedAction } from '../actions/combined-action';
import { executeTransfixAction as runTransfixAction } from '../actions/transfix-action';
import { resolveBottleTests as runBottleTests } from '../actions/bottle-tests';
import {
  executeCounterAction as runCounterAction,
  executeCounterCharge as runCounterCharge,
  executeCounterFire as runCounterFire,
  executeCounterStrike as runCounterStrike,
} from '../actions/counter-actions';
import { applyInterruptCost as runInterruptCost, applyPassiveOptionCost as runPassiveCost, applyRefresh as runRefresh } from '../actions/interrupt-costs';
import { applyKOCleanup as runKOCleanup, applyOngoingStatusEffects as runOngoingStatus } from '../actions/status-cleanup';
import { buildSpatialModel as runBuildSpatialModel, normalizeVector as runNormalizeVector, resolveEngagePosition as runResolveEngage } from '../battlefield/spatial-helpers';
import {
  beginActivation as runBeginActivation,
  endActivation as runEndActivation,
  getApRemaining as runGetApRemaining,
  setWaiting as runSetWaiting,
  spendAp as runSpendAp,
} from '../actions/activation';
import {
  EndGameTriggerState,
  EndGameTriggerResult,
  createEndGameTriggerState,
  rollEndGameTrigger,
  DEFAULT_END_GAME_TRIGGER_TURN,
} from './end-game-trigger';
import { MissionRuntimeAdapter } from '../missions/mission-runtime-adapter';
import { SideCoordinatorManager } from '../ai/core/SideAICoordinator';
import { AuditService, ModelStateAudit, AuditVector, ModelEffectAudit } from '../audit/AuditService';
import { identifyDesignatedLeader } from '../core/leader-identification';

export interface CounterStrikeResult {
  executed: boolean;
  reason?: string;
  damageResolution?: DamageResolution;
  bonusActionEligible?: boolean;
  removedWait?: boolean;
  delayAdded?: boolean;
}

export interface CounterFireResult {
  executed: boolean;
  reason?: string;
  damageResolution?: DamageResolution;
  bonusActionEligible?: boolean;
  removedWait?: boolean;
  delayAdded?: boolean;
}

export interface CounterActionResult {
  executed: boolean;
  reason?: string;
  bonusActionCascades?: number;
  carryOverDice?: TestDice;
  removedWait?: boolean;
  delayAdded?: boolean;
}

export interface CounterChargeResult {
  executed: boolean;
  reason?: string;
  moved?: boolean;
  newPosition?: Position;
  removedWait?: boolean;
  delayAdded?: boolean;
}

export class GameManager {
  public characters: Character[];
  public battlefield: Battlefield | null;
  public currentTurn: number = 1;
  public currentRound: number = 1;
  public activationOrder: Character[] = [];
  public apPerActivation: number = 2;
  public roundsPerTurn: number = 1;
  public phase: TurnPhase = TurnPhase.Setup;
  public lastInitiativeWinnerSideId: string | null = null;
  public lastInitiativeTestResults: {
    rolls: { sideId: string; dice: number[]; successes: number; pips: number }[];
    winner: string | null;
    ipAwarded: { sideId: string; amount: number; reason: 'highest_initiative' | 'carry_over' | 'tie_break' }[];
  } | null = null;
  public allowKOdAttacks: boolean = false;
  public kodControllerTraitsByCharacterId?: Record<string, string[]>;
  public kodCoordinatorTraitsByCharacterId?: Record<string, string[]>;

  private characterStatus: Map<string, CharacterStatus> = new Map();
  private activeCharacterId: string | null = null;
  private apRemaining: Map<string, number> = new Map();
  private transfixUsed: Set<string> = new Set();
  private refreshUsed: Set<string> = new Set();
  private rallyUsed: Set<string> = new Set();
  private reviveUsed: Set<string> = new Set();
  private freeFiddleUsed: Set<string> = new Set();
  private reactedThisTurn: Set<string> = new Set();
  private reactingNow: Set<string> = new Set();
  private endGameTriggerState: EndGameTriggerState;
  private missionRuntimeAdapter: MissionRuntimeAdapter | null = null;
  private sideCoordinatorManager: SideCoordinatorManager | null = null;
  private auditService: AuditService | null = null;
  private sides: MissionSide[] = [];
  // Backward compatibility alias for missionSides
  public get missionSides(): MissionSide[] {
    return this.sides;
  }
  public set missionSides(value: MissionSide[]) {
    this.sides = value;
  }
  // Max turns configuration (backward compatibility)
  public maxTurns: number = 10;
  private rofMarkers: ROFMarker[] = [];
  private suppressionMarkers: SuppressionMarker[] = [];
  private rofMarkerSequence = 0;
  private suppressionMarkerSequence = 0;

  constructor(
    characters: Character[],
    battlefield: Battlefield | null = null,
    endGameTriggerTurn: number = DEFAULT_END_GAME_TRIGGER_TURN,
    auditService?: AuditService,
    sides?: MissionSide[]
  ) {
    this.characters = characters;
    this.battlefield = battlefield;
    this.endGameTriggerState = createEndGameTriggerState(endGameTriggerTurn);
    this.auditService = auditService || null;
    this.sides = sides || [];
    this.initializeCharacterStatus();
  }

  private selectInitiativeLeader(
    side: MissionSide,
    visibilityOrMu: number
  ): Character | null {
    const eligibleMembers = side.members.filter(member =>
      !member.character.state.isKOd
      && !member.character.state.isEliminated
      && member.character.state.isOrdered
    );
    if (eligibleMembers.length === 0) {
      return null;
    }

    const eligibleSide = {
      ...side,
      members: eligibleMembers,
    } as MissionSide;

    return identifyDesignatedLeader(
      eligibleSide,
      'initiative',
      this.battlefield,
      visibilityOrMu
    ) ?? eligibleMembers[0].character;
  }

  private initializeCharacterStatus(): void {
    for (const character of this.characters) {
      if (character.state.isEliminated || character.state.isKOd) {
        this.characterStatus.set(character.id, CharacterStatus.Done);
      } else {
        this.characterStatus.set(character.id, CharacterStatus.Ready);
      }
      character.state.fearTestsThisTurn = 0;
      this.apRemaining.set(character.id, this.apPerActivation);
    }
  }

  private getMissionSideForCharacter(character: Character): MissionSide | undefined {
    return this.missionSides?.find(side =>
      side.members.some(member => member.character.id === character.id)
    );
  }

  private getFriendlySideChecker(character: Character): ((candidate: Character) => boolean) | undefined {
    const side = this.getMissionSideForCharacter(character);
    if (!side) {
      return undefined;
    }
    const memberIds = new Set(side.members.map(member => member.character.id));
    return (candidate: Character) => memberIds.has(candidate.id);
  }

  private getROFTraitLevel(weapon: Item): number {
    for (const trait of weapon.traits ?? []) {
      const match = trait.match(/ROF\s*(\d+)/i);
      if (match) {
        return Math.max(0, parseInt(match[1], 10));
      }
    }
    return 0;
  }

  private getSuppressTraitLevel(weapon: Item): number {
    for (const trait of weapon.traits ?? []) {
      const match = trait.match(/Suppress\s*(\d+)/i);
      if (match) {
        return Math.max(0, parseInt(match[1], 10));
      }
    }
    return 0;
  }

  private nextROFMarkerId(creatorId: string): string {
    this.rofMarkerSequence += 1;
    return `rof:${creatorId}:${this.currentTurn}:${this.currentRound}:${this.rofMarkerSequence}`;
  }

  private nextSuppressionMarkerId(creatorId: string): string {
    this.suppressionMarkerSequence += 1;
    return `sup:${creatorId}:${this.currentTurn}:${this.currentRound}:${this.suppressionMarkerSequence}`;
  }

  private getInPlayCharacters(): Character[] {
    return this.characters.filter(character => !character.state.isKOd && !character.state.isEliminated);
  }

  private getMarkerRangeOccupants(position: Position, rangeMu: number): Character[] {
    return this.getInPlayCharacters().filter(character => {
      const modelPos = this.getCharacterPosition(character);
      if (!modelPos) return false;
      const distance = Math.hypot(modelPos.x - position.x, modelPos.y - position.y);
      return distance <= rangeMu;
    });
  }

  private shouldSkipFlipForDoneRange(position: Position, rangeMu: number): boolean {
    const occupants = this.getMarkerRangeOccupants(position, rangeMu);
    if (occupants.length === 0) {
      return false;
    }
    return occupants.every(character => this.getCharacterStatus(character.id) === CharacterStatus.Done);
  }

  private prepareROFMarkersForAttack(attacker: Character, defender: Character, weapon: Item): {
    placedMarkers: ROFMarker[];
    rofBonusWild: number;
    effectiveROF: number;
  } {
    if (!this.battlefield) {
      return { placedMarkers: [], rofBonusWild: 0, effectiveROF: 0 };
    }

    const baseROF = this.getROFTraitLevel(weapon);
    if (baseROF <= 0) {
      return { placedMarkers: [], rofBonusWild: 0, effectiveROF: 0 };
    }

    const priorUses = Number(attacker.state.statusTokens['rofUsesThisInitiative'] ?? 0);
    const effectiveROF = getEffectiveROFLevel(baseROF, priorUses);
    attacker.state.statusTokens['rofUsesThisInitiative'] = priorUses + 1;

    if (effectiveROF <= 0) {
      return { placedMarkers: [], rofBonusWild: 0, effectiveROF };
    }

    const markerPositions = calculateROFMarkerPositions(
      attacker,
      this.battlefield,
      effectiveROF,
      defender,
      4,
      this.characters
    );

    const placedMarkers: ROFMarker[] = markerPositions.map(position => ({
      id: this.nextROFMarkerId(attacker.id),
      position: { ...position },
      creatorId: attacker.id,
      initiativeCreated: this.currentRound,
      isSuppression: false,
    }));
    this.rofMarkers.push(...placedMarkers);

    const rofBonusWild = getROFDiceBonus(defender, this.battlefield, placedMarkers);
    return {
      placedMarkers,
      rofBonusWild,
      effectiveROF,
    };
  }

  private placeAdditionalROFMarkersForSuppression(
    attacker: Character,
    baseMarkers: ROFMarker[],
    additionalCount: number
  ): ROFMarker[] {
    if (!this.battlefield || additionalCount <= 0) {
      return [];
    }

    const attackerPos = this.getCharacterPosition(attacker);
    if (!attackerPos) {
      return [];
    }

    const seedPositions = baseMarkers.length > 0
      ? baseMarkers.map(marker => marker.position)
      : [attackerPos];

    const created: ROFMarker[] = [];
    for (let index = 0; index < additionalCount; index += 1) {
      const seed = seedPositions[index % seedPositions.length];
      const angle = (index * 60) * (Math.PI / 180);
      const candidate: Position = {
        x: seed.x + Math.cos(angle) * 0.75,
        y: seed.y + Math.sin(angle) * 0.75,
      };
      const position = this.battlefield.isWithinBounds(candidate, 0) ? candidate : { ...seed };
      const marker: ROFMarker = {
        id: this.nextROFMarkerId(attacker.id),
        position,
        creatorId: attacker.id,
        initiativeCreated: this.currentRound,
        isSuppression: false,
      };
      created.push(marker);
      this.rofMarkers.push(marker);
      seedPositions.push(position);
    }

    return created;
  }

  private finalizeROFMarkersAfterAttack(attacker: Character, attackMarkers: ROFMarker[]): {
    removedNearAttacker: number;
    flippedToSuppression: number;
    retainedAsROF: number;
  } {
    if (!this.battlefield || attackMarkers.length === 0) {
      return { removedNearAttacker: 0, flippedToSuppression: 0, retainedAsROF: 0 };
    }

    const attackerPos = this.getCharacterPosition(attacker);
    const attackIds = new Set(attackMarkers.map(marker => marker.id));
    let removedNearAttacker = 0;
    let flippedToSuppression = 0;
    let retainedAsROF = 0;

    const remainingRofMarkers: ROFMarker[] = [];
    for (const marker of this.rofMarkers) {
      if (!attackIds.has(marker.id)) {
        remainingRofMarkers.push(marker);
        continue;
      }

      if (attackerPos) {
        const distanceToAttacker = Math.hypot(marker.position.x - attackerPos.x, marker.position.y - attackerPos.y);
        if (distanceToAttacker <= 1) {
          removedNearAttacker += 1;
          continue;
        }
      }

      if (this.shouldSkipFlipForDoneRange(marker.position, 1)) {
        retainedAsROF += 1;
        remainingRofMarkers.push(marker);
        continue;
      }

      this.suppressionMarkers.push({
        id: this.nextSuppressionMarkerId(marker.creatorId),
        position: { ...marker.position },
        range: 1,
        creatorId: marker.creatorId,
      });
      flippedToSuppression += 1;
    }

    this.rofMarkers = remainingRofMarkers;
    return { removedNearAttacker, flippedToSuppression, retainedAsROF };
  }

  private placeExplosionSuppressionFromHit(
    attacker: Character,
    defender: Character,
    weapon: Item,
    attackHit: boolean
  ): number {
    if (!this.battlefield || !attackHit || !hasItemTraitOnWeapon(weapon, 'Explosion')) {
      return 0;
    }

    const attackerModel = this.buildSpatialModel(attacker);
    const defenderModel = this.buildSpatialModel(defender);
    if (!attackerModel || !defenderModel) {
      return 0;
    }

    if (!SpatialRules.hasLineOfSight(this.battlefield, attackerModel, defenderModel)) {
      return 0;
    }

    this.suppressionMarkers.push({
      id: this.nextSuppressionMarkerId(attacker.id),
      position: { ...defenderModel.position },
      range: 1,
      creatorId: attacker.id,
    });
    return 1;
  }

  private flipAllROFMarkersToSuppression(): number {
    if (this.rofMarkers.length === 0) {
      return 0;
    }

    for (const marker of this.rofMarkers) {
      this.suppressionMarkers.push({
        id: this.nextSuppressionMarkerId(marker.creatorId),
        position: { ...marker.position },
        range: 1,
        creatorId: marker.creatorId,
      });
    }
    const flipped = this.rofMarkers.length;
    this.rofMarkers = [];
    return flipped;
  }

  private cullSuppressionMarkers(): void {
    if (!this.battlefield || this.suppressionMarkers.length === 0) {
      return;
    }

    this.suppressionMarkers = this.suppressionMarkers.filter(marker =>
      this.getMarkerRangeOccupants(marker.position, marker.range).length > 0
    );
  }

  public getCharacterStatus(characterId: string): CharacterStatus | undefined {
    return this.characterStatus.get(characterId);
  }

  public setCharacterStatus(characterId: string, status: CharacterStatus): void {
    this.characterStatus.set(characterId, status);
  }

  /**
   * Roll Initiative for all characters and award Initiative Points to Sides
   * QSR: Start of Turn - Initiative Tests and Initiative Points
   *
   * @param roller - Random number generator (default: Math.random)
   * @param sides - Optional array of sides to award IP to (if not provided, IP not awarded)
   * @returns Initiative test results for logging
   */
  public rollInitiative(roller: () => number = Math.random, sides?: MissionSide[]): {
    rolls: { sideId: string; dice: number[]; successes: number; pips: number }[];
    winner: string | null;
    ipAwarded: { sideId: string; amount: number; reason: 'highest_initiative' | 'carry_over' | 'tie_break' }[];
  } {
    return this.rollInitiativeWithOptions(roller, sides);
  }

  public rollInitiativeWithOptions(
    roller: () => number = Math.random,
    sides?: MissionSide[],
    options?: {
      missionAttackerSideId?: string;
      missionAttackerWinsTie?: boolean;
      visibilityOrMu?: number;
    }
  ): {
    rolls: { sideId: string; dice: number[]; successes: number; pips: number }[];
    winner: string | null;
    ipAwarded: { sideId: string; amount: number; reason: 'highest_initiative' | 'carry_over' | 'tie_break' }[];
  } {
    const initiativeResults: Array<{
      character: Character;
      initiative: number;
      dice: number[];
      dicePips: number;
      side?: MissionSide;
    }> = [];

    // Build a map of character ID to side for IP awarding
    const characterToSide = new Map<string, MissionSide>();
    if (sides) {
      for (const side of sides) {
        for (const member of side.members) {
          characterToSide.set(member.character.id, side);
        }
      }
    }

    for (const character of this.characters) {
      // Tactics X: +X Base dice for Initiative Tests
      const tacticsBonus = getTacticsInitiativeBonus(character);

      // Roll 2 Base dice + Tactics bonus dice
      let initiativeRoll = 0;
      let dicePips = 0;
      const dice: number[] = [];
      const totalDice = 2 + tacticsBonus;
      for (let i = 0; i < totalDice; i++) {
        const roll = Math.floor(roller() * 6) + 1;
        dice.push(roll);
        dicePips += roll; // Track total pips for tie-breaker
        // Base dice: 4-5 = 1 success, 6 = 2 successes
        if (roll >= 6) {
          initiativeRoll += 2;
        } else if (roll >= 4) {
          initiativeRoll += 1;
        }
      }

      // QSR: Initiative Test uses INT attribute
      character.initiative = initiativeRoll + character.attributes.int;

      const side = characterToSide.get(character.id);
      initiativeResults.push({
        character,
        initiative: character.initiative,
        dice,
        dicePips,
        side,
      });
    }

    // Sort by initiative, then by dice pips (QSR tie-breaker)
    this.activationOrder = initiativeResults
      .sort((a, b) => {
        if (b.initiative !== a.initiative) {
          return b.initiative - a.initiative;
        }
        // QSR: Tie-breaker is highest total pips on dice
        if (b.dicePips !== a.dicePips) {
          return b.dicePips - a.dicePips;
        }
        // If still tied, re-roll tie-breaker with d6
        const aTieBreaker = Math.floor(roller() * 6) + 1;
        const bTieBreaker = Math.floor(roller() * 6) + 1;
        if (bTieBreaker !== aTieBreaker) {
          return bTieBreaker - aTieBreaker;
        }
        // Final fallback: alphabetical by character name or id
        const aId = a.character.profile.name || a.character.id;
        const bId = b.character.profile.name || b.character.id;
        return aId.localeCompare(bId);
      })
      .map(result => result.character);

    // Award Initiative Points to Sides (QSR: Start of Turn)
    const ipAwarded: { sideId: string; amount: number; reason: 'highest_initiative' | 'carry_over' | 'tie_break' }[] = [];
    
    if (sides && initiativeResults.length > 0) {
      const visibilityOrMu = options?.visibilityOrMu ?? 16;
      const resultByCharacterId = new Map(
        initiativeResults.map(result => [result.character.id, result] as const)
      );
      const sideInitiativeResults = sides.map(side => {
        const leader = this.selectInitiativeLeader(side, visibilityOrMu);
        const leaderResult = leader ? resultByCharacterId.get(leader.id) : undefined;
        const dice = leaderResult?.dice ?? [];
        return {
          side,
          leader,
          initiative: leaderResult?.initiative ?? 0,
          dice,
          baseDice: dice.slice(0, 2),
          dicePips: leaderResult?.dicePips ?? 0,
        };
      });

      const highestInitiative = Math.max(...sideInitiativeResults.map(result => result.initiative));
      let tieCandidates = sideInitiativeResults.filter(result => result.initiative === highestInitiative);

      const highestPips = Math.max(...tieCandidates.map(result => result.dicePips));
      tieCandidates = tieCandidates.filter(result => result.dicePips === highestPips);

      const missionAttackerTieWinner = options?.missionAttackerWinsTie && options.missionAttackerSideId
        ? tieCandidates.find(result => result.side.id === options.missionAttackerSideId)
        : undefined;
      const winnerGetsZeroIpFromTie = tieCandidates.length > 1 && !!missionAttackerTieWinner;

      let winnerResult = missionAttackerTieWinner ?? tieCandidates[0];
      if (tieCandidates.length > 1 && !missionAttackerTieWinner) {
        let unresolved = [...tieCandidates];
        while (unresolved.length > 1) {
          const rerolls = unresolved.map(result => ({
            result,
            roll: Math.floor(roller() * 6) + 1,
          }));
          const topRoll = Math.max(...rerolls.map(entry => entry.roll));
          unresolved = rerolls
            .filter(entry => entry.roll === topRoll)
            .map(entry => entry.result);
        }
        winnerResult = unresolved[0];
      }

      this.lastInitiativeWinnerSideId = winnerResult.side.id;
      const lowestScore = Math.min(...sideInitiativeResults.map(result => result.initiative));

      if (winnerGetsZeroIpFromTie) {
        ipAwarded.push({
          sideId: winnerResult.side.id,
          amount: 0,
          reason: 'tie_break',
        });
      } else {
        const winnerIp = winnerResult.initiative - lowestScore;
        if (winnerIp > 0) {
          awardInitiativePoints(winnerResult.side, winnerIp);
          ipAwarded.push({
            sideId: winnerResult.side.id,
            amount: winnerIp,
            reason: 'highest_initiative',
          });
        }
      }

      for (const sideResult of sideInitiativeResults) {
        if (sideResult.side.id === winnerResult.side.id) continue;
        const carryOverCount = sideResult.baseDice.filter(die => die === 6).length;
        if (carryOverCount > 0) {
          awardInitiativePoints(sideResult.side, carryOverCount);
          ipAwarded.push({
            sideId: sideResult.side.id,
            amount: carryOverCount,
            reason: 'carry_over',
          });
        }
      }
    }

    // Build rolls data for logging
    const rolls = sides?.map(side => {
      const leader = this.selectInitiativeLeader(side, options?.visibilityOrMu ?? 16);
      const leaderResult = leader
        ? initiativeResults.find(result => result.character.id === leader.id)
        : undefined;
      return {
        sideId: side.id,
        dice: leaderResult?.dice ?? [],
        successes: leaderResult
          ? leaderResult.initiative - (leader?.attributes.int || 0)
          : 0,
        pips: leaderResult?.dicePips ?? 0,
      };
    }) || [];

    return {
      rolls,
      winner: this.lastInitiativeWinnerSideId,
      ipAwarded,
    };
  }

  /**
   * QSR Advanced Rules: Force Initiative
   * Spend 2 IP from Side to move character ahead in activation order by 1 position
   * QSR: Spending Initiative Points - Force Initiative costs 1 IP (not 2)
   */
  public forceInitiative(character: Character, side?: MissionSide): boolean {
    // Find the side for this character if not provided
    let targetSide = side;
    if (!targetSide) {
      // Side not provided, cannot spend IP
      return false;
    }

    // Spend 1 IP from Side (QSR: Force Initiative costs 1 IP)
    if (!spendInitiativePoints(targetSide, 1)) {
      return false; // Insufficient IP
    }

    const currentIndex = this.activationOrder.findIndex(c => c.id === character.id);
    if (currentIndex <= 0) {
      // Already first, refund IP
      awardInitiativePoints(targetSide, 1);
      return false;
    }
    // Swap with character ahead
    const temp = this.activationOrder[currentIndex - 1];
    this.activationOrder[currentIndex - 1] = character;
    this.activationOrder[currentIndex] = temp;
    return true;
  }

  /**
   * QSR Advanced Rules: Maintain Initiative
   * Spend 1 IP from Side to activate another model from same Side
   * QSR: Spending Initiative Points - Maintain Initiative costs 1 IP
   */
  public maintainInitiative(side: MissionSide): boolean {
    return spendInitiativePoints(side, 1);
  }

  /**
   * QSR Advanced Rules: Refresh
   * Spend 1 IP from Side to remove a Delay token from a model
   * QSR: Spending Initiative Points - Refresh costs 1 IP
   */
  public refresh(character: Character, side: MissionSide): boolean {
    if (!spendInitiativePoints(side, 1)) {
      return false;
    }
    // Remove one Delay token from character
    if (character.state.delayTokens > 0) {
      character.state.delayTokens--;
      return true;
    }
    // Refund IP if no Delay token to remove
    awardInitiativePoints(side, 1);
    return false;
  }

  /**
   * Refresh: Spend 1 IP to remove Delay token (finds side automatically)
   * QSR: Spending Initiative Points - Refresh costs 1 IP
   */
  public refreshForCharacter(character: Character): boolean {
    const side = this.getMissionSideForCharacter(character);
    
    if (!side) {
      return false;
    }
    
    return this.refresh(character, side);
  }

  public getNextToActivate(): Character | undefined {
    return this.activationOrder.find(char => this.getCharacterStatus(char.id) === CharacterStatus.Ready);
  }

  public setBattlefield(battlefield: Battlefield): void {
    this.battlefield = battlefield;
  }

  public placeCharacter(character: Character, position: Position): boolean {
    if (!this.battlefield) return false;
    return this.battlefield.placeCharacter(character, position);
  }

  public moveCharacter(character: Character, position: Position): boolean {
    if (!this.battlefield) return false;
    return this.battlefield.moveCharacter(character, position);
  }

  public setMissionRuntimeAdapter(adapter: MissionRuntimeAdapter | null): void {
    this.missionRuntimeAdapter = adapter;
  }

  public getMissionRuntimeAdapter(): MissionRuntimeAdapter | null {
    return this.missionRuntimeAdapter;
  }

  public getObjectiveMarkers(): ObjectiveMarker[] {
    return this.missionRuntimeAdapter?.getObjectiveMarkers() ?? [];
  }

  // ============================================================================
  // Side AI Coordinator Management (R1.5: God Mode AI Coordination)
  // ============================================================================

  /**
   * Initialize Side AI Coordinator Manager
   * Called when mission sides are set up
   */
  public initializeSideCoordinators(sides: MissionSide[], tacticalDoctrines?: Map<string, import('../ai/stratagems/AIStratagems').TacticalDoctrine>): void {
    this.sideCoordinatorManager = new SideCoordinatorManager();
    for (const side of sides) {
      const doctrine = tacticalDoctrines?.get(side.id) ?? ('operative' as any);
      this.sideCoordinatorManager.getCoordinator(side.id, doctrine);
    }
  }

  /**
   * Get Side Coordinator Manager
   */
  public getSideCoordinatorManager(): SideCoordinatorManager | null {
    return this.sideCoordinatorManager;
  }

  /**
   * Update scoring context for all Sides at start of turn
   * Called from startTurn() after mission state is updated
   */
  public updateAllScoringContexts(
    sideKeyScores: Map<string, Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>>,
    missionConfig: import('../ai/stratagems/PredictedScoringIntegration').MissionVPConfig
  ): void {
    if (!this.sideCoordinatorManager) return;
    this.sideCoordinatorManager.updateAllScoringContexts(sideKeyScores, this.currentTurn, missionConfig);
  }

  /**
   * Get strategic advice for all Sides (for battle reports)
   */
  public getSideStrategies(): Record<string, { doctrine: string; advice: string[]; context: import('../ai/stratagems/PredictedScoringIntegration').ScoringContext | null }> {
    const strategies: Record<string, { doctrine: string; advice: string[]; context: import('../ai/stratagems/PredictedScoringIntegration').ScoringContext | null }> = {};
    if (!this.sideCoordinatorManager) return strategies;

    for (const coordinator of this.sideCoordinatorManager.getAllCoordinators()) {
      strategies[coordinator.getSideId()] = {
        doctrine: coordinator.getTacticalDoctrine(),
        advice: coordinator.getStrategicAdvice(),
        context: coordinator.getScoringContext(),
      };
    }
    return strategies;
  }

  public getCharacterPosition(character: Character): Position | undefined {
    if (!this.battlefield) return undefined;
    return this.battlefield.getCharacterPosition(character);
  }

  /**
   * Start a new Turn
   * QSR: Start of Turn sequence
   *
   * @param roller - Random number generator
   * @param sides - Optional array of sides for IP awarding
   */
  /**
   * Start a new turn
   * @param roller - Random number generator (default: Math.random)
   * @param sides - Optional array of sides for IP awarding
   * @param missionId - Optional mission ID for audit
   * @param missionName - Optional mission name for audit
   * @param lighting - Optional lighting condition for audit
   * @param visibilityOrMu - Optional visibility OR for audit
   * @param maxOrm - Optional max ORM for audit
   * @param battlefieldWidth - Optional battlefield width for audit
   * @param battlefieldHeight - Optional battlefield height for audit
   */
  public startTurn(
    roller: () => number = Math.random,
    sides?: MissionSide[],
    options?: {
      missionId?: string;
      missionName?: string;
      lighting?: string;
      visibilityOrMu?: number;
      maxOrm?: number;
      battlefieldWidth?: number;
      battlefieldHeight?: number;
      missionConfig?: import('../ai/stratagems/PredictedScoringIntegration').MissionVPConfig;
    }
  ): void {
    this.currentRound = 1;
    this.initializeCharacterStatus();
    this.flipAllROFMarkersToSuppression();
    this.cullSuppressionMarkers();

    // Initialize audit service on turn 1
    if (this.currentTurn === 1 && this.auditService && options) {
      this.auditService.initialize({
        missionId: options.missionId || 'unknown',
        missionName: options.missionName || 'Unknown Mission',
        lighting: options.lighting || 'Day, Clear',
        visibilityOrMu: options.visibilityOrMu || 16,
        maxOrm: options.maxOrm || 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: options.battlefieldWidth || 24,
        battlefieldHeight: options.battlefieldHeight || 24,
      });
    }

    // Start turn audit
    if (this.auditService) {
      this.auditService.startTurn(this.currentTurn);
    }

    // R1.5: Update scoring context for all Sides at start of turn
    if (sides && this.sideCoordinatorManager) {
      const sideKeyScores = new Map<string, Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>>();
      for (const side of sides) {
        sideKeyScores.set(side.id, side.state.keyScores as any);
      }
      // Default mission config if not provided (Elimination mission defaults)
      const missionConfig = options?.missionConfig ?? {
        totalVPPool: 5,  // Default: Elimination VP pool
        hasRPToVPConversion: false,
        currentTurn: this.currentTurn,
        maxTurns: 10,  // Default max turns
      };
      this.updateAllScoringContexts(sideKeyScores, missionConfig);
    }

    // Roll Initiative and award IP to Sides
    this.lastInitiativeTestResults = this.rollInitiative(roller, sides);

    this.refreshUsed.clear();
    this.rallyUsed.clear();
    this.reviveUsed.clear();
    this.reactedThisTurn.clear();
    this.phase = TurnPhase.Activation;
  }

  public startRound(): void {
    this.currentRound += 1;
    for (const character of this.characters) {
      if (character.state.isEliminated || character.state.isKOd) {
        this.characterStatus.set(character.id, CharacterStatus.Done);
        continue;
      }
      if (this.characterStatus.get(character.id) === CharacterStatus.Done) {
        this.characterStatus.set(character.id, CharacterStatus.Ready);
      }
      this.apRemaining.set(character.id, this.apPerActivation);
      character.resetInitiativeState();
      // Reset Multiple Attack Penalty tracking at start of each round (new Initiative)
      resetMultipleAttackTracking(character);
      delete character.state.statusTokens['rofUsesThisInitiative'];
      delete character.state.statusTokens['indirectAttacksThisInitiative'];
    }
    this.cullSuppressionMarkers();
    this.phase = TurnPhase.Activation;
  }

  public beginActivation(character: Character): number {
    return runBeginActivation(this.activationDeps(), character);
  }

  public endActivation(character: Character): void {
    runEndActivation(this.activationDeps(), character);
    this.cullSuppressionMarkers();
  }

  public setWaiting(character: Character): void {
    runSetWaiting(this.activationDeps(), character);
  }

  public getApRemaining(character: Character): number {
    return runGetApRemaining(this.activationDeps(), character);
  }

  public getActiveCharacterId(): string | null {
    return this.activeCharacterId;
  }

  public spendAp(character: Character, amount: number): boolean {
    return runSpendAp(this.activationDeps(), character, amount);
  }

  public executePushing(character: Character) {
    return performPushing(this.activationDeps(), character);
  }

  public nextRound(): void {
    this.startRound();
  }

  public nextTurn(): void {
    this.currentTurn += 1;
    this.startTurn();
  }

  public endRound(): void {
    this.phase = TurnPhase.RoundEnd;
  }

  public endTurn(sides?: MissionSide[]): void {
    this.phase = TurnPhase.TurnEnd;

    if (sides && sides.length > 0) {
      const bottleSides = sides.map(side => {
        const sideCharacters = side.members.map(member => member.character);
        const orderedCandidate = sideCharacters.find(character =>
          character.state.isOrdered
          && !character.state.isKOd
          && !character.state.isEliminated
        ) ?? null;
        const opposingCount = sides
          .filter(opposingSide => opposingSide.id !== side.id)
          .reduce((total, opposingSide) =>
            total + opposingSide.members.filter(member =>
              !member.character.state.isKOd && !member.character.state.isEliminated
            ).length,
          0);
        return {
          id: side.id,
          characters: sideCharacters,
          orderedCandidate,
          opposingCount,
          side,
        };
      });
      this.resolveBottleTests(bottleSides, this.battlefield);
    }

    // End turn audit
    if (this.auditService && sides) {
      const sideSummaries = sides.map(side => ({
        sideName: side.name,
        activeModelsStart: side.members.filter(m => !m.character.state.isEliminated && !m.character.state.isKOd).length,
        activeModelsEnd: side.members.filter(m => !m.character.state.isEliminated && !m.character.state.isKOd).length,
      }));
      this.auditService.endTurn(sideSummaries);
    }
  }

  /**
   * QSR: Check for end-game trigger at the end of a turn
   * Roll end-game dice if at or past the trigger turn
   */
  public checkEndGameTrigger(roller: () => number = Math.random): EndGameTriggerResult {
    const result = rollEndGameTrigger(
      this.endGameTriggerState,
      this.currentTurn,
      roller
    );
    
    // Update state with new dice count
    this.endGameTriggerState.endDice = result.endDice;
    
    if (result.gameEnded) {
      this.endGameTriggerState.gameEnded = true;
      this.endGameTriggerState.endReason = result.reason;
    }
    
    return result;
  }

  /**
   * Get the current end-game trigger state
   */
  public getEndGameTriggerState(): EndGameTriggerState {
    return { ...this.endGameTriggerState };
  }

  /**
   * Check if game has ended
   */
  public isGameEnded(): boolean {
    return this.endGameTriggerState.gameEnded;
  }

  /**
   * Get the reason for game end
   */
  public getGameEndReason(): string | undefined {
    return this.endGameTriggerState.endReason;
  }

  public setSides(sides: MissionSide[]): void {
    this.missionSides = sides;
  }

  public advancePhase(options: { roller?: () => number; roundsPerTurn?: number; sides?: MissionSide[] } = {}): TurnPhase {
    const roundsPerTurn = Math.max(1, options.roundsPerTurn ?? this.roundsPerTurn);
    const roller = options.roller ?? Math.random;
    const sides = options.sides ?? this.missionSides;

    switch (this.phase) {
      case TurnPhase.Setup:
        this.startTurn(roller, sides);
        return this.phase;
      case TurnPhase.Activation:
        if (!this.isTurnOver()) {
          return this.phase;
        }
        if (this.currentRound >= roundsPerTurn) {
          this.endTurn(sides);
          return this.phase;
        }
        this.endRound();
        this.startRound();
        return this.phase;
      case TurnPhase.RoundEnd:
        this.startRound();
        return this.phase;
      case TurnPhase.TurnEnd:
        // QSR: Check for end-game trigger dice at end of turn
        const endGameResult = this.checkEndGameTrigger(roller);
        if (endGameResult.gameEnded) {
          return this.phase; // Game ended, stay in TurnEnd phase
        }
        this.nextTurn();
        return this.phase;
      default:
        this.startTurn(roller, sides);
        return this.phase;
    }
  }

  public isTurnOver(): boolean {
    return this.characters.every(char => {
      const status = this.getCharacterStatus(char.id);
      return status === CharacterStatus.Done || status === CharacterStatus.Waiting;
    });
  }

  public executeRangedAttack(
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: Partial<ActionContextInput> & {
      optimalRangeMu?: number;
      orm?: number;
      context?: TestContext;
      moraleAllies?: Character[];
      moraleOptions?: MoraleOptions;
      allowTakeCover?: boolean;
      takeCoverPosition?: Position;
      defend?: boolean;
      allowBonusActions?: boolean;
      bonusAction?: BonusActionSelection;
      bonusActionOpponents?: Character[];
    } = {}
  ) {
    const rofPrep = this.prepareROFMarkersForAttack(attacker, defender, weapon);
    const contextWithRof = rofPrep.rofBonusWild > 0
      ? {
        ...(options.context ?? {}),
        rofBonusWild: (options.context?.rofBonusWild ?? 0) + rofPrep.rofBonusWild,
      }
      : options.context;

    const outcome = runRangedAttack(this.combatActionDeps(), attacker, defender, weapon, {
      allowKOdAttacks: this.allowKOdAttacks,
      kodRules: {
        enabled: this.allowKOdAttacks,
        controllerTraits: this.kodControllerTraitsByCharacterId?.[attacker.id],
        coordinatorTraits: this.kodCoordinatorTraitsByCharacterId?.[attacker.id],
      },
      ...options,
      context: contextWithRof,
    });

    const suppressTraitExtra = this.getSuppressTraitLevel(weapon);
    const suppressTraitMarkers = this.placeAdditionalROFMarkersForSuppression(
      attacker,
      rofPrep.placedMarkers,
      suppressTraitExtra
    );
    const rofFinalize = this.finalizeROFMarkersAfterAttack(
      attacker,
      [...rofPrep.placedMarkers, ...suppressTraitMarkers]
    );
    const explosionSuppressionPlaced = this.placeExplosionSuppressionFromHit(
      attacker,
      defender,
      weapon,
      outcome.result.hit
    );
    this.cullSuppressionMarkers();

    return {
      ...outcome,
      rof: {
        effectiveROF: rofPrep.effectiveROF,
        rofBonusWild: rofPrep.rofBonusWild,
        baseMarkersPlaced: rofPrep.placedMarkers.length,
        suppressTraitMarkersPlaced: suppressTraitMarkers.length,
        removedNearAttacker: rofFinalize.removedNearAttacker,
        flippedToSuppression: rofFinalize.flippedToSuppression,
        retainedAsROF: rofFinalize.retainedAsROF,
      },
      suppression: {
        explosionMarkersPlaced: explosionSuppressionPlaced,
        activeSuppressionMarkers: this.suppressionMarkers.length,
      },
    };
  }

  public executeSuppressAction(
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: Partial<ActionContextInput> & {
      optimalRangeMu?: number;
      orm?: number;
      context?: TestContext;
      moraleAllies?: Character[];
      moraleOptions?: MoraleOptions;
      allowTakeCover?: boolean;
      takeCoverPosition?: Position;
      defend?: boolean;
      allowBonusActions?: boolean;
      bonusAction?: BonusActionSelection;
      bonusActionOpponents?: Character[];
      costMode?: 'two_ap' | 'one_ap_plus_delay';
    } = {}
  ): {
    executed: boolean;
    reason?: string;
    apSpent: number;
    delayAdded: number;
    baseMarkersPlaced: number;
    bonusMarkersPlaced: number;
    rofBonusWild: number;
    attack?: ReturnType<GameManager['executeRangedAttack']>;
  } {
    const baseROF = this.getROFTraitLevel(weapon);
    if (baseROF <= 0) {
      return {
        executed: false,
        reason: 'Suppression Attack requires a weapon with ROF X.',
        apSpent: 0,
        delayAdded: 0,
        baseMarkersPlaced: 0,
        bonusMarkersPlaced: 0,
        rofBonusWild: 0,
      };
    }

    const costMode = options.costMode ?? 'two_ap';
    const apCost = costMode === 'one_ap_plus_delay' ? 1 : 2;
    if (!this.spendAp(attacker, apCost)) {
      return {
        executed: false,
        reason: `Not enough AP for Suppression Attack (${apCost} AP required).`,
        apSpent: 0,
        delayAdded: 0,
        baseMarkersPlaced: 0,
        bonusMarkersPlaced: 0,
        rofBonusWild: 0,
      };
    }

    let delayAdded = 0;
    if (costMode === 'one_ap_plus_delay') {
      attacker.state.delayTokens += 1;
      attacker.refreshStatusFlags();
      delayAdded = 1;
    }

    const rofPrep = this.prepareROFMarkersForAttack(attacker, defender, weapon);
    const contextWithRof = rofPrep.rofBonusWild > 0
      ? {
        ...(options.context ?? {}),
        rofBonusWild: (options.context?.rofBonusWild ?? 0) + rofPrep.rofBonusWild,
      }
      : options.context;

    const attackOutcome = runRangedAttack(this.combatActionDeps(), attacker, defender, weapon, {
      allowKOdAttacks: this.allowKOdAttacks,
      kodRules: {
        enabled: this.allowKOdAttacks,
        controllerTraits: this.kodControllerTraitsByCharacterId?.[attacker.id],
        coordinatorTraits: this.kodCoordinatorTraitsByCharacterId?.[attacker.id],
      },
      ...options,
      context: contextWithRof,
    });

    const suppressTraitExtra = this.getSuppressTraitLevel(weapon);
    const suppressActionBonus = 1 + Math.floor(rofPrep.placedMarkers.length / 2);
    const bonusMarkers = this.placeAdditionalROFMarkersForSuppression(
      attacker,
      rofPrep.placedMarkers,
      suppressActionBonus + suppressTraitExtra
    );
    this.finalizeROFMarkersAfterAttack(attacker, [...rofPrep.placedMarkers, ...bonusMarkers]);
    this.placeExplosionSuppressionFromHit(attacker, defender, weapon, attackOutcome.result.hit);
    this.cullSuppressionMarkers();

    return {
      executed: true,
      apSpent: apCost,
      delayAdded,
      baseMarkersPlaced: rofPrep.placedMarkers.length,
      bonusMarkersPlaced: bonusMarkers.length,
      rofBonusWild: rofPrep.rofBonusWild,
      attack: {
        ...attackOutcome,
        rof: {
          effectiveROF: rofPrep.effectiveROF,
          rofBonusWild: rofPrep.rofBonusWild,
          baseMarkersPlaced: rofPrep.placedMarkers.length,
          suppressTraitMarkersPlaced: suppressTraitExtra,
          suppressActionBonusMarkersPlaced: bonusMarkers.length,
        },
      } as any,
    };
  }

  public getROFMarkers(): ROFMarker[] {
    return this.rofMarkers.map(marker => ({
      ...marker,
      position: { ...marker.position },
    }));
  }

  public getSuppressionMarkers(): SuppressionMarker[] {
    return this.suppressionMarkers.map(marker => ({
      ...marker,
      position: { ...marker.position },
    }));
  }

  public clearAdvancedMarkerState(): void {
    this.rofMarkers = [];
    this.suppressionMarkers = [];
  }

  public getPassiveOptions(event: PassiveEvent): PassiveOption[] {
    return getPassiveOptions(event);
  }

  public getActiveToggleOptions(params: { attacker: Character; weapon?: Item; isEngaged?: boolean }): ActiveToggleOption[] {
    return getActiveToggleOptions(params);
  }

  public getBonusActionOptions(context: Parameters<typeof buildBonusActionOptions>[0]) {
    return getBonusActionOptions(context);
  }

  public getReactOptions(event: ReactEvent): ReactOption[] {
    return getReactOptions(event);
  }

  public getReactOptionsSorted(event: ReactEvent): ReactOption[] {
    return getReactOptionsSorted(event);
  }

  public createGroupAction(leader: Character, members: Character[]): GroupAction {
    return createGroupAction(leader, members);
  }

  public executeGroupRangedAttack(
    group: GroupAction,
    defender: Character,
    weapon: Item,
    options: Parameters<GameManager['executeRangedAttack']>[3] = {}
  ) {
    // TODO: Implement group ranged attack
    // Rules Reference: rules-combat.md - Concentrated Attacks
    // This would allow multiple models to coordinate ranged attacks on a single target
    throw new Error('Group ranged attack not implemented');
  }

  public executeGroupCloseCombatAttack(
    group: GroupAction,
    defender: Character,
    weapon: Item,
    options: Parameters<GameManager['executeCloseCombatAttack']>[3] = {}
  ) {
    // TODO: Implement group close combat attack
    // Rules Reference: rules-situational-modifiers.md - Assist (+1 Impact per extra model)
    // rules-multiple.md - Multiple Weapons and coordinated attacks
    throw new Error('Group close combat attack not implemented');
  }

  public executeStandardReact(
    reactor: Character,
    target: Character,
    weapon: Item,
    options: { context?: TestContext; visibilityOrMu?: number } = {}
  ) {
    return runStandardReact(this.reactActionDeps(), reactor, target, weapon, options);
  }

  public executeReactAction(
    reactor: Character,
    action: () => unknown
  ) {
    return runReactAction(this.reactActionDeps(), reactor, action);
  }

  public executeDisengage(
    disengager: Character,
    defender: Character,
    defenderWeapon: Item,
    options: {
      context?: TestContext;
      moveEnd?: Position;
      allowBonusActions?: boolean;
      bonusAction?: BonusActionSelection;
      bonusActionOpponents?: Character[];
    } = {}
  ) {
    return executeDisengageAction(
      {
        battlefield: this.battlefield,
        getCharacterPosition: (character: Character) => this.getCharacterPosition(character),
        moveCharacter: (character: Character, position: Position) => this.moveCharacter(character, position),
        applyRefresh: (character: Character) => this.applyRefresh(character),
      },
      disengager,
      defender,
      defenderWeapon,
      options
    );
  }

  public executeMove(
    mover: Character,
    destination: Position,
    options: {
      opponents?: Character[];
      allowOpportunityAttack?: boolean;
      opportunityWeapon?: Item;
      isMovingStraight?: boolean;
      isAtStartOrEndOfMovement?: boolean;
      path?: Position[];
      swapTarget?: Character;
      isFriendlyToMover?: (candidate: Character) => boolean;
    } = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    const derivedFriendlyChecker = this.getFriendlySideChecker(mover);
    const isFriendlyToMover = options.isFriendlyToMover ?? derivedFriendlyChecker;
    const effectiveOpponents = options.opponents
      ?? (isFriendlyToMover
        ? this.characters.filter(candidate =>
          candidate.id !== mover.id
          && !isFriendlyToMover(candidate)
          && !candidate.state.isEliminated
          && !candidate.state.isKOd
        )
        : []);

    if (effectiveOpponents.length > 0) {
      const moverModel = this.buildSpatialModel(mover);
      if (moverModel) {
        const engagedToOpposing = effectiveOpponents.some(opponent => {
          const opponentModel = this.buildSpatialModel(opponent);
          return opponentModel ? SpatialRules.isEngaged(moverModel, opponentModel) : false;
        });
        if (engagedToOpposing) {
          return {
            moved: false,
            reason: 'Engaged models must Disengage before moving',
          };
        }
      }
    }

    return executeMoveAction(
      {
        getCharacterPosition: (character: Character) => this.getCharacterPosition(character),
        moveCharacter: (character: Character, position: Position) => this.moveCharacter(character, position),
        swapCharacters: (first: Character, second: Character) => {
          const firstPosition = this.getCharacterPosition(first);
          const secondPosition = this.getCharacterPosition(second);
          if (!firstPosition || !secondPosition) {
            return false;
          }

          const removedFirst = this.battlefield!.removeCharacter(first);
          const removedSecond = this.battlefield!.removeCharacter(second);
          if (!removedFirst || !removedSecond) {
            if (removedFirst) {
              this.battlefield!.placeCharacter(first, firstPosition);
            }
            if (removedSecond) {
              this.battlefield!.placeCharacter(second, secondPosition);
            }
            return false;
          }

          const placedFirst = this.battlefield!.placeCharacter(first, secondPosition);
          const placedSecond = this.battlefield!.placeCharacter(second, firstPosition);
          if (placedFirst && placedSecond) {
            return true;
          }

          if (placedFirst) {
            this.battlefield!.removeCharacter(first);
          }
          if (placedSecond) {
            this.battlefield!.removeCharacter(second);
          }
          this.battlefield!.placeCharacter(first, firstPosition);
          this.battlefield!.placeCharacter(second, secondPosition);
          return false;
        },
        spendApForSwap: (character: Character, amount: number) => this.spendAp(character, amount),
        getTerrainAt: (position: Position) => {
          const terrain = this.battlefield!.getTerrainAt(position).type;
          if (terrain === BattlefieldTerrainType.Obstacle) {
            return 'Impassable';
          }
          return terrain as 'Clear' | 'Rough' | 'Difficult' | 'Impassable';
        },
        isWithinBounds: (position: Position, baseDiameter: number) => this.battlefield!.isWithinBounds(position, baseDiameter),
        eliminateOnFearExit: (character: Character) => {
          character.state.isEliminated = true;
          character.state.eliminatedByFear = true;
          character.refreshStatusFlags();
          this.setCharacterStatus(character.id, CharacterStatus.Done);
          this.battlefield?.removeCharacter(character);
        },
        canOccupy: (position: Position, baseDiameter: number) => this.battlefield!.canOccupy(position, baseDiameter),
        executeCloseCombatAttack: (attacker: Character, defender: Character, weapon: Item, actionOptions) =>
          this.executeCloseCombatAttack(attacker, defender, weapon, actionOptions as any),
        findPathCost: (start: Position, end: Position) => {
          // Simple terrain cost calculation for straight-line movement
          // Check terrain along the path and apply cost multipliers
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const distance = Math.hypot(dx, dy);
          
          if (distance === 0) return 0;
          
          // Sample terrain along the path
          const samples = Math.ceil(distance * 2); // Sample every 0.5 MU
          let totalCost = 0;
          
          for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const samplePos = { x: start.x + dx * t, y: start.y + dy * t };
            const terrainFeature = this.battlefield!.getTerrainAt(samplePos);
            
            let costMultiplier = 1;
            if (terrainFeature.type === BattlefieldTerrainType.Rough) {
              costMultiplier = 2;
            } else if (terrainFeature.type === BattlefieldTerrainType.Difficult) {
              costMultiplier = 3;
            } else if (terrainFeature.type === BattlefieldTerrainType.Obstacle) {
              return null; // Blocked
            }
            
            const segmentCost = (distance / samples) * costMultiplier;
            totalCost += segmentCost;
          }
          
          return totalCost;
        },
      },
      mover,
      destination,
      {
        ...options,
        opponents: effectiveOpponents,
        isFriendlyToMover,
      }
    );
  }

  public executeRally(
    actor: Character,
    target: Character,
    options: {
      context?: TestContext;
      rolls?: number[];
      side?: MissionSide;
      allies?: Character[];
      opponents?: Character[];
      cohesionRangeMu?: number;
      visibilityOrMu?: number;
    } = {}
  ) {
    const side = options.side ?? this.getMissionSideForCharacter(actor);
    const sideAllies = side?.members
      ?.map(member => member.character)
      .filter(character => !character.state.isEliminated && !character.state.isKOd) ?? [];
    const allies = options.allies ?? (sideAllies.length > 0 ? sideAllies : [actor]);
    const allyIds = new Set(allies.map(character => character.id));
    const opponents = options.opponents ?? this.characters.filter(character =>
      !allyIds.has(character.id) && !character.state.isEliminated && !character.state.isKOd
    );

    return executeRallyAction(this.simpleActionDeps(), actor, target, {
      ...options,
      side,
      battlefield: this.battlefield,
      allies,
      opponents,
    });
  }

  public executeRevive(
    actor: Character,
    target: Character,
    options: { context?: TestContext; rolls?: number[] } = {}
  ) {
    return executeReviveAction(this.simpleActionDeps(), actor, target, options);
  }

  public executeFiddle(
    actor: Character,
    options: {
      attribute?: keyof Character['finalAttributes'];
      difficulty?: number;
      spendAp?: boolean;
      rolls?: number[];
      opponentRolls?: number[];
      usesOneLessHand?: boolean;
    } = {}
  ) {
    return executeFiddleAction(this.simpleActionDeps(), actor, options);
  }

  public executeStowItem(
    actor: Character,
    options: {
      itemIndex?: number;
      itemName?: string;
    } = {}
  ) {
    return executeStowItem(this.simpleActionDeps(), actor, options);
  }

  public executeUnstowItem(
    actor: Character,
    options: {
      itemIndex?: number;
      itemName?: string;
    } = {}
  ) {
    return executeUnstowItem(this.simpleActionDeps(), actor, options);
  }

  public executeSwapItem(
    actor: Character,
    options: {
      stowItemIndex?: number;
      stowItemName?: string;
      drawItemIndex?: number;
      drawItemName?: string;
    } = {}
  ) {
    return executeSwapItem(this.simpleActionDeps(), actor, options);
  }

  public executeAcquireObjectiveMarker(
    actor: Character,
    markerId: string,
    sideId: string,
    options: {
      spendAp?: boolean;
      isFree?: boolean;
      opposingInBaseContact?: boolean;
      isAttentive?: boolean;
      isOrdered?: boolean;
      isAnimal?: boolean;
      keyIdsInHand?: string[];
    } = {}
  ) {
    if (!this.missionRuntimeAdapter) {
      return { success: false, reason: 'Mission runtime not configured' };
    }

    const apCost = this.missionRuntimeAdapter.getObjectiveMarkerAcquireApCost(markerId);
    const spendAp = options.spendAp ?? true;
    if (spendAp && apCost > 0 && this.getApRemaining(actor) < apCost) {
      return { success: false, reason: `Insufficient AP (${apCost} required)` };
    }

    const actorPosition = this.getCharacterPosition(actor);
    const modelPositions: Array<{ id: string; position: Position }> = [];
    for (const candidate of this.characters) {
      const candidatePosition = this.getCharacterPosition(candidate);
      if (!candidatePosition) continue;
      modelPositions.push({ id: candidate.id, position: candidatePosition });
    }
    const result = this.missionRuntimeAdapter.acquireObjectiveMarker(markerId, actor.id, sideId, {
      ...options,
      actorPosition,
      modelPositions,
    });
    if (!result.success) return result;
    if (spendAp && result.apCost > 0) {
      this.spendAp(actor, result.apCost);
    }
    return result;
  }

  public executeShareIdeaObjectiveMarker(
    actor: Character,
    markerId: string,
    toModelId: string,
    sideId: string,
    options: { spendAp?: boolean; hindrance?: number } = {}
  ) {
    if (!this.missionRuntimeAdapter) {
      return { success: false, reason: 'Mission runtime not configured', apCost: 0 };
    }

    const hindrance = options.hindrance ?? 0;
    const expectedCost = 1 + Math.max(0, hindrance);
    const spendAp = options.spendAp ?? true;
    if (spendAp && this.getApRemaining(actor) < expectedCost) {
      return { success: false, reason: `Insufficient AP (${expectedCost} required)`, apCost: expectedCost };
    }

    const result = this.missionRuntimeAdapter.shareIdeaObjectiveMarker(markerId, actor.id, toModelId, sideId, hindrance);
    if (!result.success) return result;
    if (spendAp && result.apCost > 0) {
      this.spendAp(actor, result.apCost);
    }
    return result;
  }

  public executeTransferObjectiveMarker(
    actor: Character,
    markerId: string,
    toModelId: string,
    sideId: string,
    options: MarkerTransferOptions & { spendAp?: boolean } = {}
  ) {
    if (!this.missionRuntimeAdapter) {
      return { success: false, reason: 'Mission runtime not configured', apCost: 0 };
    }

    const expectedCost = options.isStunnedOrDisorderedOrDistracted ? 2 : 1;
    const spendAp = options.spendAp ?? true;
    if (spendAp && this.getApRemaining(actor) < expectedCost) {
      return { success: false, reason: `Insufficient AP (${expectedCost} required)`, apCost: expectedCost };
    }

    const transfer = this.missionRuntimeAdapter.transferObjectiveMarker(markerId, toModelId, sideId, options);
    if (!transfer.success) return transfer;
    if (spendAp && transfer.apCost > 0) {
      this.spendAp(actor, transfer.apCost);
    }
    return transfer;
  }

  public executeDestroyObjectiveMarker(
    actor: Character,
    markerId: string,
    options: { spendAp?: boolean; allowDestroySwitch?: boolean } = {}
  ) {
    if (!this.missionRuntimeAdapter) {
      return { success: false, reason: 'Mission runtime not configured', apCost: 0 };
    }

    const expectedCost = 1;
    const spendAp = options.spendAp ?? true;
    if (spendAp && this.getApRemaining(actor) < expectedCost) {
      return { success: false, reason: `Insufficient AP (${expectedCost} required)`, apCost: expectedCost };
    }

    const result = this.missionRuntimeAdapter.destroyObjectiveMarker(markerId, options);
    if (!result.success) return result;
    if (spendAp && result.apCost > 0) {
      this.spendAp(actor, result.apCost);
    }
    return result;
  }

  public executeWait(
    actor: Character,
    options: {
      spendAp?: boolean;
      maintain?: boolean;
      opponents?: Character[];
      visibilityOrMu?: number;
      allowRevealReposition?: boolean;
    } = {}
  ) {
    const wait = executeWaitAction(this.simpleActionDeps(), actor, options);
    if (!wait.success || !this.battlefield || !options.opponents || options.opponents.length === 0) {
      return wait;
    }

    const reveal = resolveWaitReveal(this.battlefield, actor, options.opponents, {
      allowReposition: options.allowRevealReposition ?? false,
      visibilityOrMu: options.visibilityOrMu,
    });

    return {
      ...wait,
      revealedCount: reveal.revealed.length,
      revealedOpponents: reveal.revealed.map(opponent => ({
        id: opponent.id,
        name: opponent.profile.name,
      })),
    };
  }

  public buildConcentrateContext(target: 'hit' | 'damage' | 'any' = 'hit'): TestContext {
    return { isConcentrating: true, concentrateTarget: target };
  }

  public getAttackApCost(attacker: Character, weapon: Item): number {
    if (!this.battlefield) return 1;
    if (!hasItemTraitOnWeapon(weapon, 'Awkward')) return 1;
    const attackerPos = this.getCharacterPosition(attacker);
    if (!attackerPos) return 1;
    const attackerModel = {
      id: attacker.id,
      position: attackerPos,
      baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3),
      siz: attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3,
    };
    const blockers = this.battlefield.getModelBlockers([attacker.id]);
    const engaged = blockers.some(blocker =>
      SpatialRules.isEngaged(attackerModel, blocker)
    );
    return engaged ? 2 : 1;
  }

  public executeCombinedAction(
    actor: Character,
    moveEnd: Position,
    action: () => unknown,
    options: { spendAp?: boolean } = {}
  ) {
    return runCombinedAction(
      {
        spendAp: (character: Character, amount: number) => this.spendAp(character, amount),
        moveCharacter: (character: Character, position: Position) => this.moveCharacter(character, position),
      },
      actor,
      moveEnd,
      action,
      options
    );
  }

  public executeIndirectAttack(
    attacker: Character,
    weapon: Item,
    orm: number,
    options: Partial<ActionContextInput> & {
      context?: TestContext;
      targetCharacter?: Character;
      directionRoll?: number;
      scatterBias?: 'biased' | 'unbiased';
      scatterWeights?: number[];
      scatterDesiredDirection?: Position;
      scrambleMoves?: Record<string, Position>;
      allowScramble?: boolean;
      knownAtInitiativeStart?: boolean;
      spotters?: Character[];
      isFriendlySpotter?: (spotter: Character) => boolean;
      isSpotterFree?: (spotter: Character) => boolean;
      spotterCohesionRangeMu?: number;
      blindScatterDistanceRoll?: number;
      blindScatterDistanceRng?: () => number;
      enforceArcValidation?: boolean;
    } = {}
  ) {
    const derivedFriendlySpotter = this.getFriendlySideChecker(attacker);
    return runIndirectAttack(this.combatActionDeps(), attacker, weapon, orm, {
      allowKOdAttacks: this.allowKOdAttacks,
      kodRules: {
        enabled: this.allowKOdAttacks,
        controllerTraits: this.kodControllerTraitsByCharacterId?.[attacker.id],
        coordinatorTraits: this.kodCoordinatorTraitsByCharacterId?.[attacker.id],
      },
      ...options,
      isFriendlySpotter: options.isFriendlySpotter ?? derivedFriendlySpotter,
      isSpotterFree: options.isSpotterFree ?? ((spotter: Character) => this.isFreeFromEngagement(spotter)),
    });
  }

  public executeTransfixAction(
    source: Character,
    targets: Character[],
    options: { rating?: number; testRolls?: Record<string, number[]>; spendDelay?: boolean } = {}
  ) {
    return runTransfixAction(
      {
        battlefield: this.battlefield,
        getCharacterPosition: (character: Character) => this.getCharacterPosition(character),
        transfixUsed: this.transfixUsed,
      },
      source,
      targets,
      options
    );
  }

  public executeCloseCombatAttack(
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: Partial<CloseCombatContextInput> & {
      context?: TestContext;
      moraleAllies?: Character[];
      moraleOptions?: MoraleOptions;
      defend?: boolean;
      allowBonusActions?: boolean;
      bonusAction?: BonusActionSelection;
      bonusActionOpponents?: Character[];
    } = {}
  ) {
    return runCloseCombatAttack(this.combatActionDeps(), attacker, defender, weapon, {
      allowKOdAttacks: this.allowKOdAttacks,
      kodRules: {
        enabled: this.allowKOdAttacks,
        controllerTraits: this.kodControllerTraitsByCharacterId?.[attacker.id],
        coordinatorTraits: this.kodCoordinatorTraitsByCharacterId?.[attacker.id],
      },
      ...options,
    });
  }

  public executeCounterStrike(
    defender: Character,
    attacker: Character,
    weapon: Item,
    hitTestResult: ResolveTestResult,
    options: { context?: TestContext; requireTrait?: boolean; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
  ): CounterStrikeResult {
    const resolved = resolveDeclaredWeapon(defender, weapon);
    return runCounterStrike(this.counterActionDeps(), defender, attacker, resolved.weapon, hitTestResult, options);
  }

  public executeCounterFire(
    defender: Character,
    attacker: Character,
    weapon: Item,
    hitTestResult: ResolveTestResult,
    options: { context?: TestContext; visibilityOrMu?: number; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
  ): CounterFireResult {
    const resolved = resolveDeclaredWeapon(defender, weapon);
    return runCounterFire(this.counterActionDeps(), defender, attacker, resolved.weapon, hitTestResult, options);
  }

  public executeCounterAction(
    defender: Character,
    attacker: Character,
    hitTestResult: ResolveTestResult,
    options: { attackType?: 'melee' | 'ranged'; carryOverRolls?: number[] } = {}
  ): CounterActionResult {
    return runCounterAction(this.counterActionDeps(), defender, attacker, hitTestResult, options);
  }

  public executeCounterCharge(
    observer: Character,
    target: Character,
    options: { visibilityOrMu?: number; moveApSpent?: number; moveEnd?: Position } = {}
  ): CounterChargeResult {
    return runCounterCharge(this.counterActionDeps(), observer, target, options);
  }

  private buildSpatialModel(character: Character): SpatialModel | null {
    return runBuildSpatialModel(this.battlefield, (target: Character) => this.getCharacterPosition(target), character);
  }

  private getOtherActiveCharacters(character: Character): Character[] {
    return this.characters.filter(
      candidate => candidate.id !== character.id && !candidate.state.isEliminated && !candidate.state.isKOd
    );
  }

  private isFreeFromEngagement(character: Character): boolean {
    if (!this.battlefield) return true;
    const actor = this.buildSpatialModel(character);
    if (!actor) return true;
    const blockers = this.battlefield.getModelBlockers([character.id]);
    return !blockers.some(blocker => SpatialRules.isEngaged(actor, blocker));
  }

  private isOutnumberedForWait(character: Character): boolean {
    if (!this.battlefield) return false;
    const actor = this.buildSpatialModel(character);
    if (!actor) return false;
    const blockers = this.battlefield.getModelBlockers([character.id]);
    const engagedCount = blockers.filter(blocker => SpatialRules.isEngaged(actor, blocker)).length;
    return engagedCount > 1;
  }

  private hasCoverAgainstOpposition(character: Character, opponents: Character[]): boolean {
    if (!this.battlefield) return false;
    const actor = this.buildSpatialModel(character);
    if (!actor) return false;
    for (const opponent of opponents) {
      const other = this.buildSpatialModel(opponent);
      if (!other) continue;
      const cover = SpatialRules.getCoverResult(this.battlefield, other, actor);
      if (cover.hasLOS && (cover.hasDirectCover || cover.hasInterveningCover)) {
        return true;
      }
    }
    return false;
  }

  private hasLosAgainst(character: Character, other: Character): boolean {
    if (!this.battlefield) return false;
    const actor = this.buildSpatialModel(character);
    const target = this.buildSpatialModel(other);
    if (!actor || !target) return false;
    return SpatialRules.hasLineOfSight(this.battlefield, actor, target);
  }

  private applyInterruptCost(character: Character): { removedWait: boolean; delayAdded: boolean } {
    return runInterruptCost(this.interruptDeps(), character);
  }

  private applyPassiveOptionCost(character: Character): { removedWait: boolean; delayAdded: boolean } {
    return runPassiveCost(this.interruptDeps(), character);
  }

  private applyRefresh(character: Character): boolean {
    return runRefresh(this.interruptDeps(), character);
  }

  private normalizeVector(vec: { x: number; y: number }): { x: number; y: number } | null {
    return runNormalizeVector(vec);
  }

  private hasItemTrait(character: Character, trait: string): boolean {
    return hasItemTrait(character, trait);
  }

  private hasItemTraitOnWeapon(weapon: Item, trait: string): boolean {
    return hasItemTraitOnWeapon(weapon, trait);
  }

  private resolveEngagePosition(
    mover: SpatialModel,
    target: SpatialModel,
    moveLimit: number
  ): Position | null {
    return runResolveEngage(mover, target, moveLimit);
  }

  private countDice(dice: TestDice): number {
    return (dice.base ?? 0) + (dice.modifier ?? 0) + (dice.wild ?? 0);
  }

  private resolveCarryOverSuccesses(dice: TestDice, rolls?: number[]): number {
    const total = this.countDice(dice);
    if (total <= 0) return 0;
    const finalRolls = rolls ?? Array.from({ length: total }, d6);
    const result = performTest(dice, 0, finalRolls);
    return result.score;
  }

  private applyKOCleanup(character: Character): void {
    runKOCleanup(this.statusCleanupDeps(), character);
  }

  private applyOngoingStatusEffects(character: Character): void {
    runOngoingStatus(this.statusCleanupDeps(), character);
  }

  private counterActionDeps() {
    return {
      battlefield: this.battlefield,
      buildSpatialModel: (character: Character) => this.buildSpatialModel(character),
      resolveEngagePosition: (mover: SpatialModel, target: SpatialModel, moveLimit: number) =>
        this.resolveEngagePosition(mover, target, moveLimit),
      moveCharacter: (character: Character, position: Position) => this.moveCharacter(character, position),
      applyInterruptCost: (character: Character) => this.applyInterruptCost(character),
      applyKOCleanup: (character: Character) => this.applyKOCleanup(character),
      countDice: (dice: TestDice) => this.countDice(dice),
      resolveCarryOverSuccesses: (dice: TestDice, rolls?: number[]) => this.resolveCarryOverSuccesses(dice, rolls),
    };
  }

  private interruptDeps() {
    return {
      setCharacterStatus: (characterId: string, status: CharacterStatus) => this.setCharacterStatus(characterId, status),
      refreshUsed: this.refreshUsed,
    };
  }

  private statusCleanupDeps() {
    return {
      setCharacterStatus: (characterId: string, status: CharacterStatus) => this.setCharacterStatus(characterId, status),
    };
  }

  public activationDeps() {
    return {
      apPerActivation: this.apPerActivation,
      getCharacterStatus: (characterId: string) => this.getCharacterStatus(characterId),
      setCharacterStatus: (characterId: string, status: CharacterStatus) => this.setCharacterStatus(characterId, status),
      setActiveCharacterId: (characterId: string | null) => { this.activeCharacterId = characterId; },
      applyOngoingStatusEffects: (character: Character) => this.applyOngoingStatusEffects(character),
      clearTransfixUsed: (characterId: string) => { this.transfixUsed.delete(characterId); },
      clearFiddleUsed: (characterId: string) => { this.freeFiddleUsed.delete(characterId); },
      getApRemaining: (characterId: string) => this.apRemaining.get(characterId) ?? 0,
      setApRemaining: (characterId: string, value: number) => { this.apRemaining.set(characterId, value); },
      getCharacterPosition: (character: Character) => this.getCharacterPosition(character),
      isBehindCover: (character: Character) => this.hasCoverAgainstOpposition(character, this.getOtherActiveCharacters(character)),
      isInLos: (character: Character, opposingCharacter: Character) => this.hasLosAgainst(character, opposingCharacter),
      getOpposingCharacters: () => this.characters.filter(
        candidate => candidate.id !== this.activeCharacterId && !candidate.state.isEliminated && !candidate.state.isKOd
      ),
      isFreeFromEngagement: (character: Character) => this.isFreeFromEngagement(character),
    };
  }

  private simpleActionDeps() {
    return {
      spendAp: (character: Character, cost: number) => this.spendAp(character, cost),
      setWaiting: (character: Character) => this.setWaiting(character),
      isOutnumberedForWait: (character: Character) => this.isOutnumberedForWait(character),
      getCharacterPosition: (character: Character) => this.getCharacterPosition(character),
      getTwoApMovementRange: (character: Character) => getThreatRange(character) * 2,
      setCharacterStatus: (characterId: string, status: CharacterStatus) => this.setCharacterStatus(characterId, status),
      markRallyUsed: (characterId: string) => { this.rallyUsed.add(characterId); },
      markReviveUsed: (characterId: string) => { this.reviveUsed.add(characterId); },
      markFiddleUsed: (characterId: string) => { this.freeFiddleUsed.add(characterId); },
      hasRallyUsed: (characterId: string) => this.rallyUsed.has(characterId),
      hasReviveUsed: (characterId: string) => this.reviveUsed.has(characterId),
      hasFiddleUsed: (characterId: string) => this.freeFiddleUsed.has(characterId),
    };
  }

  private combatActionDeps() {
    return {
      battlefield: this.battlefield,
      characters: this.characters,
      getCharacterPosition: (character: Character) => this.getCharacterPosition(character),
      moveCharacter: (character: Character, position: Position) => this.moveCharacter(character, position),
      buildSpatialModel: (character: Character) => this.buildSpatialModel(character),
      applyPassiveOptionCost: (character: Character) => this.applyPassiveOptionCost(character),
      canUsePassiveReact: (character: Character) =>
        !this.reactingNow.has(character.id) && !this.reactedThisTurn.has(character.id),
      markPassiveReactUsed: (character: Character) => { this.reactedThisTurn.add(character.id); },
      applyRefresh: (character: Character) => this.applyRefresh(character),
      applyKOCleanup: (character: Character) => this.applyKOCleanup(character),
    };
  }

  private reactActionDeps() {
    return {
      battlefield: this.battlefield,
      reactingNow: this.reactingNow,
      reactedThisTurn: this.reactedThisTurn,
      getActiveCharacterId: () => this.activeCharacterId,
      setActiveCharacterId: (characterId: string | null) => { this.activeCharacterId = characterId; },
      getCharacterPosition: (character: Character) => this.getCharacterPosition(character),
      applyInterruptCost: (character: Character) => this.applyInterruptCost(character),
      executeRangedAttack: (
        attacker: Character,
        defender: Character,
        weapon: Item,
        actionOptions: { attacker: SpatialModel; target: SpatialModel; context?: TestContext }
      ) => this.executeRangedAttack(attacker, defender, weapon, actionOptions as any),
    };
  }

  public evaluateHide(
    character: Character,
    opponents: Character[],
    options: HideOptions = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    return evaluateHide(this.battlefield, character, opponents, options);
  }

  public attemptHide(
    character: Character,
    opponents: Character[],
    options: HideOptions = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    return attemptHide(this.battlefield, character, opponents, amount => this.spendAp(character, amount), options);
  }

  public attemptDetect(
    attacker: Character,
    target: Character,
    opponents: Character[],
    options: DetectOptions = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    return attemptDetect(this.battlefield, attacker, target, opponents, options);
  }

  public resolveHiddenExposure(
    character: Character,
    opponents: Character[],
    options: RevealExposureOptions = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    return resolveHiddenExposure(this.battlefield, character, opponents, options);
  }

  public resolveWaitReveal(
    waitingCharacter: Character,
    opponents: Character[],
    options: RevealExposureOptions = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    return resolveWaitReveal(this.battlefield, waitingCharacter, opponents, options);
  }

  public resolveBottleTests(
    sides: Array<{
      id: string;
      characters: Character[];
      orderedCandidate: Character | null;
      opposingCount: number;
      rolls?: number[];
      side?: MissionSide;
    }>,
    battlefield: Battlefield | null = null
  ): Record<string, BottleTestResult> {
    const results = runBottleTests(
      {
        setCharacterStatus: (characterId: string, status: CharacterStatus) => this.setCharacterStatus(characterId, status),
      },
      sides,
      battlefield
    );

    // Store bottle test results for logging
    this.lastBottleTestResults = results;

    return results;
  }
  
  public lastBottleTestResults: Record<string, BottleTestResult> | null = null;

  // ============================================================================
  // Game Loop - Full Battle Execution
  // ============================================================================

  /**
   * Run a complete game from start to finish with AI controllers
   * 
   * @param missionAdapter - Mission runtime adapter for scoring and objectives
   * @param aiConfigs - AI controller configurations for each side
   * @returns Battle result with winner, statistics, and turn count
   */
  public async runGame(
    missionAdapter: MissionRuntimeAdapter,
    aiConfigs: Array<{
      sideId: string;
      characterAI: import('../ai/core/CharacterAI').CharacterAI;
      tacticalDoctrine?: import('../ai/stratagems/AIStratagems').TacticalDoctrine;
    }>
  ): Promise<{
    winner: string | null;
    turnsCompleted: number;
    stats: {
      totalActions: number;
      moves: number;
      attacks: number;
      closeCombats: number;
      rangedCombats: number;
      disengages: number;
      eliminations: number;
      kos: number;
    };
  }> {
    const { CharacterAI } = await import('../ai/core/CharacterAI');
    const { TacticalDoctrine } = await import('../ai/stratagems/AIStratagems');
    const { DEFAULT_CHARACTER_AI_CONFIG } = await import('../ai/core/CharacterAI');

    if (!this.battlefield) {
      throw new Error('Battlefield not set');
    }

    // Set mission runtime adapter
    this.setMissionRuntimeAdapter(missionAdapter);

    // Initialize statistics tracking
    const stats = {
      totalActions: 0,
      moves: 0,
      attacks: 0,
      closeCombats: 0,
      rangedCombats: 0,
      disengages: 0,
      waits: 0,
      eliminations: 0,
      kos: 0,
    };

    // Create AI controller map by side
    const aiBySide = new Map<string, typeof aiConfigs[0]>();
    for (const config of aiConfigs) {
      aiBySide.set(config.sideId, config);
    }

    // Get sides from mission adapter (access private property via any)
    const sides = (missionAdapter as any).sides;

    // Build ally/enemy maps for each side
    const alliesBySide = new Map<string, Character[]>();
    const enemiesBySide = new Map<string, Character[]>();
    for (const side of sides) {
      const sideChars = side.members.map((m: any) => m.character);
      const enemyChars = sides
        .filter((s: any) => s.id !== side.id)
        .flatMap((s: any) => s.members.map((m: any) => m.character));
      alliesBySide.set(side.id, sideChars);
      enemiesBySide.set(side.id, enemyChars);
    }

    // Main game loop
    while (!this.isGameEnded() && this.currentTurn <= 10) {
      // Start turn (roll initiative, etc.)
      this.startTurn(Math.random, sides);

      // Process activations until turn is over
      while (!this.isTurnOver()) {
        // Get next character to activate
        const character = this.getNextToActivate();
        if (!character) break;

        // Find AI controller for this character's side
        const characterSide = sides.find((s: any) => s.members.some((m: any) => m.character.id === character.id));
        if (!characterSide) continue;

        const aiConfig = aiBySide.get(characterSide.id);
        if (!aiConfig) continue;

        // Begin activation
        this.beginActivation(character);
        const apRemaining = this.getApRemaining(character);

        // Build AI context
        const allies = alliesBySide.get(characterSide.id) || [];
        const enemies = enemiesBySide.get(characterSide.id) || [];

        const aiContext: import('../ai/core/AIController').AIContext = {
          character,
          allies,
          enemies,
          battlefield: this.battlefield,
          currentTurn: this.currentTurn,
          currentRound: this.currentRound,
          apRemaining,
          sideId: characterSide.id,
          objectiveMarkers: [],
          knowledge: aiConfig.characterAI.updateKnowledge({
            character,
            allies,
            enemies,
            battlefield: this.battlefield,
            currentTurn: this.currentTurn,
            currentRound: this.currentRound,
            apRemaining,
            sideId: characterSide.id,
            objectiveMarkers: [],
            knowledge: {} as any,
            config: {
              ...DEFAULT_CHARACTER_AI_CONFIG,
              aggression: 0.5,
              caution: 0.5,
              accuracyModifier: 0,
              godMode: true,
            } as any,
          }),
          config: {
            ...DEFAULT_CHARACTER_AI_CONFIG,
            aggression: 0.5,
            caution: 0.5,
            accuracyModifier: 0,
            godMode: true,
          } as any,
        };

        // Get AI decision
        const decision = aiConfig.characterAI.decideAction(aiContext);

        // Execute action
        if (decision && decision.decision && decision.decision.type !== 'none' && decision.decision.type !== 'hold') {
          stats.totalActions++;
          
          try {
            switch (decision.decision.type) {
              case 'move':
              case 'charge':
                if (decision.decision.position) {
                  this.moveCharacter(character, decision.decision.position);
                  stats.moves++;
                }
                break;

              case 'close_combat':
                if (decision.decision.target && decision.decision.weapon) {
                  const result = this.executeCloseCombatAttack(
                    character,
                    decision.decision.target,
                    decision.decision.weapon
                  );
                  stats.closeCombats++;
                  stats.attacks++;
                  if ((result as any).damageResolution?.defenderKOd) stats.kos++;
                  if ((result as any).damageResolution?.defenderEliminated) stats.eliminations++;
                }
                break;

              case 'ranged_combat':
                if (decision.decision.target && decision.decision.weapon) {
                  const result = this.executeRangedAttack(
                    character,
                    decision.decision.target,
                    decision.decision.weapon,
                    {}
                  );
                  stats.rangedCombats++;
                  stats.attacks++;
                  if ((result as any).damageResolution?.defenderKOd) stats.kos++;
                  if ((result as any).damageResolution?.defenderEliminated) stats.eliminations++;
                }
                break;

              case 'disengage':
                if (decision.decision.target) {
                  this.executeDisengageAction(character, decision.decision.target);
                  stats.disengages++;
                }
                break;

              case 'wait':
                this.executeWaitAction(character);
                stats.waits++;
                break;
                
              case 'rally':
              case 'revive':
              case 'fiddle':
              case 'reload':
                // These actions are handled but not tracked in basic stats
                break;
            }
          } catch (error) {
            console.error(`Error executing action for ${character.name}:`, error);
          }
        }

        // End activation
        this.endActivation(character);
      }

      // End turn (check end-game trigger)
      this.endTurn();
      this.advancePhase({ roller: Math.random });
    }

    // Determine winner
    let winner: string | null = null;
    const sideRemaining = sides.map((side: any) => ({
      sideId: side.id,
      remaining: side.members.filter((m: any) =>
        !m.character.state.isEliminated && !m.character.state.isKOd
      ).length,
    }));

    const maxRemaining = Math.max(...sideRemaining.map((s: any) => s.remaining));
    const winners = sideRemaining.filter((s: any) => s.remaining === maxRemaining);

    if (winners.length === 1) {
      winner = winners[0].sideId;
    }

    return {
      winner,
      turnsCompleted: this.currentTurn,
      stats,
    };
  }

  // Helper methods for action execution
  private executeWaitAction(character: Character): void {
    executeWaitAction({
      setCharacterStatus: (id: string, status: CharacterStatus) => this.setCharacterStatus(id, status),
    } as any, character);
  }

  public executeDisengageAction(
    disengager: Character,
    opponent: Character
  ): void {
    const weapon = opponent.profile.equipment?.find((item: any) => item.classification === 'Melee') || opponent.profile.equipment?.[0];
    if (!weapon) return;
    executeDisengageAction(
      {
        battlefield: this.battlefield!,
        getCharacterStatus: (id: string) => this.getCharacterStatus(id),
        setCharacterStatus: (id: string, status: CharacterStatus) => this.setCharacterStatus(id, status),
      } as any,
      disengager,
      opponent,
      weapon
    );
  }
}
