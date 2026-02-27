import { Character } from '../core/Character';
import { CharacterStatus, TurnPhase } from '../core/types';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { getTacticsInitiativeBonus, getTacticsSituationalAwarenessExemption, resetMultipleAttackTracking } from '../traits/combat-traits';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { ActionContextInput, CloseCombatContextInput } from '../battlefield/action-context';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { SpatialRules, type SpatialModel } from '../battlefield/spatial/spatial-rules';
import { TerrainType as BattlefieldTerrainType } from '../battlefield/terrain/Terrain';
import { LOSOperations } from '../battlefield/LOSOperations';
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
import { BonusActionSelection } from '../actions/bonus-actions';
import { ReactEvent, ReactOption } from '../actions/react-actions';
import { GroupAction } from './group-actions';
import { executeFiddleAction, executeRallyAction, executeReviveAction, executeWaitAction } from '../actions/simple-actions';
import { getActiveToggleOptions, getBonusActionOptions, getPassiveOptions, getReactOptions, getReactOptionsSorted } from '../actions/option-builders';
import { executeMoveAction } from '../actions/move-action';
import { createGroupAction } from '../actions/group-actions';
import { resolveDeclaredWeapon } from '../actions/declared-weapon';
import { hasItemTrait, hasItemTraitOnWeapon } from '../traits/item-traits';
import {
  executeCloseCombatAttack as runCloseCombatAttack,
  executeIndirectAttack as runIndirectAttack,
  executeRangedAttack as runRangedAttack,
} from '../actions/combat-actions';
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

  constructor(characters: Character[], battlefield: Battlefield | null = null, endGameTriggerTurn: number = DEFAULT_END_GAME_TRIGGER_TURN) {
    this.characters = characters;
    this.battlefield = battlefield;
    this.endGameTriggerState = createEndGameTriggerState(endGameTriggerTurn);
    this.initializeCharacterStatus();
  }

  private initializeCharacterStatus(): void {
    for (const character of this.characters) {
      if (character.state.isEliminated || character.state.isKOd) {
        this.characterStatus.set(character.id, CharacterStatus.Done);
      } else {
        this.characterStatus.set(character.id, CharacterStatus.Ready);
      }
      this.apRemaining.set(character.id, this.apPerActivation);
    }
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
        // Final fallback: alphabetical by name or id (generate fallback if both undefined)
        const aId = a.name || a.id || `char-${initiativeResults.indexOf(a)}`;
        const bId = b.name || b.id || `char-${initiativeResults.indexOf(b)}`;
        return aId.localeCompare(bId);
      })
      .map(result => result.character);

    // Award Initiative Points to Sides (QSR: Start of Turn)
    const ipAwarded: { sideId: string; amount: number; reason: 'highest_initiative' | 'carry_over' | 'tie_break' }[] = [];
    
    if (sides && initiativeResults.length > 0) {
      // Find winner (highest initiative)
      const winner = initiativeResults[0];
      this.lastInitiativeWinnerSideId = winner.side?.id ?? null;
      const lowestScore = initiativeResults[initiativeResults.length - 1].initiative;

      // Group results by side
      const sideResults = new Map<MissionSide, Array<typeof winner>>();
      for (const result of initiativeResults) {
        if (result.side) {
          const existing = sideResults.get(result.side) || [];
          existing.push(result);
          sideResults.set(result.side, existing);
        }
      }

      // Award IP to each side
      for (const [side, results] of sideResults.entries()) {
        const sideInitiative = Math.max(...results.map(r => r.initiative));

        if (sideInitiative === winner.initiative && side === winner.side) {
          // Winner: IP = difference between winner and lowest score
          const ipAmount = winner.initiative - lowestScore;
          if (ipAmount > 0) {
            awardInitiativePoints(side, ipAmount);
            ipAwarded.push({
              sideId: side.id,
              amount: ipAmount,
              reason: 'highest_initiative',
            });
          }
        } else {
          // All other sides: 1 IP per carry-over Base die (rolled 6)
          // For simplicity, award 1 IP per character with carry-over
          let carryOverCount = 0;
          for (const result of results) {
            // Count dice that scored 6 (carry-over)
            // This is a simplification - full implementation would track individual dice
            if (result.dicePips >= 12) { // At least one 6 rolled
              carryOverCount++;
            }
          }
          if (carryOverCount > 0) {
            awardInitiativePoints(side, carryOverCount);
            ipAwarded.push({
              sideId: side.id,
              amount: carryOverCount,
              reason: 'carry_over',
            });
          }
        }
      }
    }

    // Build rolls data for logging
    const rolls = sides?.map(side => {
      const sideMembers = initiativeResults.filter(r => r.side === side);
      return {
        sideId: side.id,
        dice: sideMembers.flatMap(r => r.dice),
        successes: sideMembers.reduce((sum, r) => sum + r.initiative - (r.character.attributes.int || 0), 0),
        pips: sideMembers.reduce((sum, r) => sum + r.dicePips, 0),
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
    // Find the side this character belongs to
    const side = this.missionSides?.find(s => 
      s.members.some(m => m.character.id === character.id)
    );
    
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
      const doctrine = tacticalDoctrines?.get(side.id) ?? 'operative';
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
  public updateAllScoringContexts(sideKeyScores: Map<string, Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>>): void {
    if (!this.sideCoordinatorManager) return;
    this.sideCoordinatorManager.updateAllScoringContexts(sideKeyScores, this.currentTurn);
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
  public startTurn(roller: () => number = Math.random, sides?: MissionSide[]): void {
    this.currentRound = 1;
    this.initializeCharacterStatus();

    // QSR: Optimized Initiative - Side with least BP gets +1b on first Turn
    // (Not implemented - would need BP tracking per side)

    // Roll Initiative and award IP to Sides
    this.lastInitiativeTestResults = this.rollInitiative(roller, sides);

    this.refreshUsed.clear();
    this.rallyUsed.clear();
    this.reviveUsed.clear();
    this.reactedThisTurn.clear();
    this.phase = TurnPhase.Activation;

    // R1.5: Update scoring context for all Sides at start of turn
    if (sides && this.sideCoordinatorManager) {
      const sideKeyScores = new Map<string, Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>>();
      for (const side of sides) {
        sideKeyScores.set(side.id, side.state.keyScores);
      }
      this.updateAllScoringContexts(sideKeyScores);
    }
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
    }
    this.phase = TurnPhase.Activation;
  }

  public beginActivation(character: Character): number {
    return runBeginActivation(this.activationDeps(), character);
  }

  public endActivation(character: Character): void {
    runEndActivation(this.activationDeps(), character);
  }

  public setWaiting(character: Character): void {
    runSetWaiting(this.activationDeps(), character);
  }

  public getApRemaining(character: Character): number {
    return runGetApRemaining(this.activationDeps(), character);
  }

  public spendAp(character: Character, amount: number): boolean {
    return runSpendAp(this.activationDeps(), character, amount);
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

  public endTurn(): void {
    this.phase = TurnPhase.TurnEnd;
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
          this.endTurn();
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
    return runRangedAttack(this.combatActionDeps(), attacker, defender, weapon, {
      allowKOdAttacks: this.allowKOdAttacks,
      kodRules: {
        enabled: this.allowKOdAttacks,
        controllerTraits: this.kodControllerTraitsByCharacterId?.[attacker.id],
        coordinatorTraits: this.kodCoordinatorTraitsByCharacterId?.[attacker.id],
      },
      ...options,
    });
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
    options: { opponents?: Character[]; allowOpportunityAttack?: boolean; opportunityWeapon?: Item } = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    return executeMoveAction(
      {
        getCharacterPosition: (character: Character) => this.getCharacterPosition(character),
        moveCharacter: (character: Character, position: Position) => this.moveCharacter(character, position),
        getTerrainAt: (position: Position) => {
          const terrain = this.battlefield!.getTerrainAt(position).type;
          if (terrain === BattlefieldTerrainType.Obstacle) {
            return 'Impassable';
          }
          return terrain as 'Clear' | 'Rough' | 'Difficult' | 'Impassable';
        },
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
      options
    );
  }

  public executeRally(
    actor: Character,
    target: Character,
    options: { context?: TestContext; rolls?: number[]; side?: MissionSide } = {}
  ) {
    return executeRallyAction(this.simpleActionDeps(), actor, target, options);
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
      knownAtInitiativeStart?: boolean;
      spotters?: Character[];
      spotterCohesionRangeMu?: number;
      blindScatterDistanceRoll?: number;
      blindScatterDistanceRng?: () => number;
    } = {}
  ) {
    return runIndirectAttack(this.combatActionDeps(), attacker, weapon, orm, {
      allowKOdAttacks: this.allowKOdAttacks,
      kodRules: {
        enabled: this.allowKOdAttacks,
        controllerTraits: this.kodControllerTraitsByCharacterId?.[attacker.id],
        coordinatorTraits: this.kodCoordinatorTraitsByCharacterId?.[attacker.id],
      },
      ...options,
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

  private activationDeps() {
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
      applyRefresh: (character: Character) => this.applyRefresh(character),
      applyKOCleanup: (character: Character) => this.applyKOCleanup(character),
    };
  }

  private reactActionDeps() {
    return {
      battlefield: this.battlefield,
      reactingNow: this.reactingNow,
      reactedThisTurn: this.reactedThisTurn,
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
      eliminations: 0,
      kos: 0,
    };

    // Create AI controller map by side
    const aiBySide = new Map<string, typeof aiConfigs[0]>();
    for (const config of aiConfigs) {
      aiBySide.set(config.sideId, config);
    }

    // Get sides from mission adapter
    const sides = missionAdapter.sides;

    // Build ally/enemy maps for each side
    const alliesBySide = new Map<string, Character[]>();
    const enemiesBySide = new Map<string, Character[]>();
    for (const side of sides) {
      const sideChars = side.members.map(m => m.character);
      const enemyChars = sides
        .filter(s => s.id !== side.id)
        .flatMap(s => s.members.map(m => m.character));
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
        const characterSide = sides.find(s => s.members.some(m => m.character.id === character.id));
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
            config: DEFAULT_CHARACTER_AI_CONFIG,
          }),
          config: DEFAULT_CHARACTER_AI_CONFIG,
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
                    decision.decision.weapon,
                    { isCharge: decision.decision.isCharge }
                  );
                  stats.closeCombats++;
                  stats.attacks++;
                  if (result.damageResolution?.defenderKOd) stats.kos++;
                  if (result.damageResolution?.defenderEliminated) stats.eliminations++;
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
                  if (result.damageResolution?.defenderKOd) stats.kos++;
                  if (result.damageResolution?.defenderEliminated) stats.eliminations++;
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
    const sideRemaining = sides.map(side => ({
      sideId: side.id,
      remaining: side.members.filter(m => 
        !m.character.state.isEliminated && !m.character.state.isKOd
      ).length,
    }));

    const maxRemaining = Math.max(...sideRemaining.map(s => s.remaining));
    const winners = sideRemaining.filter(s => s.remaining === maxRemaining);

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
      getCharacterStatus: (id: string) => this.getCharacterStatus(id),
    }, character);
  }

  public executeDisengageAction(
    disengager: Character,
    opponent: Character
  ): void {
    executeDisengageAction(
      {
        battlefield: this.battlefield!,
        getCharacterStatus: (id: string) => this.getCharacterStatus(id),
        setCharacterStatus: (id: string, status: CharacterStatus) => this.setCharacterStatus(id, status),
      },
      disengager,
      opponent
    );
  }
}
