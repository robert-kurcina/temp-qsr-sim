import { Character } from '../core/Character';
import { CharacterStatus, TurnPhase } from '../core/types';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { getTacticsInitiativeBonus, getTacticsSituationalAwarenessExemption } from '../traits/combat-traits';
import { Item } from '../core/Item';
import { TestContext } from '../utils/TestContext';
import { ActionContextInput, CloseCombatContextInput } from '../battlefield/action-context';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { SpatialRules, type SpatialModel } from '../battlefield/spatial/spatial-rules';
import { LOSOperations } from '../battlefield/LOSOperations';
import { d6, performTest, resolveTest } from '../subroutines/dice-roller';
import type { ResolveTestResult, TestDice } from '../subroutines/dice-roller';
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
import { createGroupActionWrapper, executeGroupCloseCombatAttack, executeGroupRangedAttack } from '../actions/group-actions';
import { hasItemTrait, hasItemTraitOnWeapon } from '../traits/item-traits';
import {
  executeCloseCombatAttack as runCloseCombatAttack,
  executeIndirectAttack as runIndirectAttack,
  executeRangedAttack as runRangedAttack,
} from '../actions/combat-actions';
import { executeOverwatchReact as runOverwatchReact, executeReactAction as runReactAction } from '../actions/react-actions';
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

  public rollInitiative(roller: () => number = Math.random): void {
    const initiativeResults: Array<{
      character: Character;
      initiative: number;
      dicePips: number;
    }> = [];

    for (const character of this.characters) {
      // Tactics X: +X Base dice for Initiative Tests
      const tacticsBonus = getTacticsInitiativeBonus(character);

      // Roll 2 Base dice + Tactics bonus dice
      let initiativeRoll = 0;
      let dicePips = 0;
      const totalDice = 2 + tacticsBonus;
      for (let i = 0; i < totalDice; i++) {
        const roll = Math.floor(roller() * 6) + 1;
        dicePips += roll; // Track total pips for tie-breaker
        // Base dice: 4-5 = 1 success, 6 = 2 successes
        if (roll >= 6) {
          initiativeRoll += 2;
        } else if (roll >= 4) {
          initiativeRoll += 1;
        }
      }

      // QSR Line 715: Initiative Test uses INT attribute
      character.initiative = initiativeRoll + character.attributes.int;
      
      initiativeResults.push({
        character,
        initiative: character.initiative,
        dicePips,
      });
    }

    // Sort by initiative, then by dice pips (QSR tie-breaker)
    this.activationOrder = initiativeResults
      .sort((a, b) => {
        if (b.initiative !== a.initiative) {
          return b.initiative - a.initiative;
        }
        // QSR Line 689: Tie-breaker is highest total pips on dice
        if (b.dicePips !== a.dicePips) {
          return b.dicePips - a.dicePips;
        }
        // If still tied, re-roll tie-breaker with d6
        const aTieBreaker = Math.floor(roller() * 6) + 1;
        const bTieBreaker = Math.floor(roller() * 6) + 1;
        if (bTieBreaker !== aTieBreaker) {
          return bTieBreaker - aTieBreaker;
        }
        // Final fallback: alphabetical by name
        return a.name.localeCompare(b.name);
      })
      .map(result => result.character);
  }

  /**
   * QSR Advanced Rules: Force Initiative
   * Spend 2 IP to move ahead in activation order by 1 position
   */
  public forceInitiative(character: Character): boolean {
    if (!character.forceInitiative()) {
      return false;
    }
    const currentIndex = this.activationOrder.findIndex(c => c.id === character.id);
    if (currentIndex <= 0) {
      // Already first, refund IP
      character.addInitiativePoints(2);
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
   * Spend 1 IP to keep current initiative position next round (not implemented - placeholder)
   */
  public maintainInitiative(character: Character): boolean {
    return character.maintainInitiative();
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

  public getCharacterPosition(character: Character): Position | undefined {
    if (!this.battlefield) return undefined;
    return this.battlefield.getCharacterPosition(character);
  }

  public startTurn(roller: () => number = Math.random): void {
    this.currentRound = 1;
    this.initializeCharacterStatus();
    
    // QSR Line 693: Optimized Initiative - Side with least BP gets +1b on first Turn
    // (Not implemented - would need side tracking)
    
    this.rollInitiative(roller);
    
    // QSR Lines 691-692: Award Initiative Points based on Initiative Test results
    // Winner gets IP equal to difference to lowest Test Score
    // All other players get 1 IP per Base die with carry-over
    // NOTE: For simplicity in 2-player games, we award 1 IP to all Ready, Ordered characters
    // Full IP system would require tracking Initiative Test scores per side
    for (const character of this.characters) {
      if (!character.state.isEliminated && !character.state.isKOd && character.state.isOrdered) {
        character.addInitiativePoints(1);
      }
    }
    
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

  public advancePhase(options: { roller?: () => number; roundsPerTurn?: number } = {}): TurnPhase {
    const roundsPerTurn = Math.max(1, options.roundsPerTurn ?? this.roundsPerTurn);
    const roller = options.roller ?? Math.random;

    switch (this.phase) {
      case TurnPhase.Setup:
        this.startTurn(roller);
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
        this.startTurn(roller);
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
    return runRangedAttack(this.combatActionDeps(), attacker, defender, weapon, options);
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
    return createGroupActionWrapper(leader, members);
  }

  public executeGroupRangedAttack(
    group: GroupAction,
    defender: Character,
    weapon: Item,
    options: Parameters<GameManager['executeRangedAttack']>[3] = {}
  ) {
    return executeGroupRangedAttack(
      {
        executeRangedAttack: (attacker: Character, target: Character, rangedWeapon: Item, actionOptions) =>
          this.executeRangedAttack(attacker, target, rangedWeapon, actionOptions as any),
      },
      group,
      defender,
      weapon,
      options
    );
  }

  public executeGroupCloseCombatAttack(
    group: GroupAction,
    defender: Character,
    weapon: Item,
    options: Parameters<GameManager['executeCloseCombatAttack']>[3] = {}
  ) {
    return executeGroupCloseCombatAttack(
      {
        executeCloseCombatAttack: (attacker: Character, target: Character, meleeWeapon: Item, actionOptions) =>
          this.executeCloseCombatAttack(attacker, target, meleeWeapon, actionOptions as any),
      },
      group,
      defender,
      weapon,
      options
    );
  }

  public executeOverwatchReact(
    reactor: Character,
    target: Character,
    weapon: Item,
    options: { context?: TestContext; visibilityOrMu?: number } = {}
  ) {
    return runOverwatchReact(this.reactActionDeps(), reactor, target, weapon, options);
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
        executeCloseCombatAttack: (attacker: Character, defender: Character, weapon: Item, actionOptions) =>
          this.executeCloseCombatAttack(attacker, defender, weapon, actionOptions as any),
      },
      mover,
      destination,
      options
    );
  }

  public executeRally(
    actor: Character,
    target: Character,
    options: { context?: TestContext; rolls?: number[] } = {}
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

  public executeWait(actor: Character, options: { spendAp?: boolean; maintain?: boolean } = {}) {
    return executeWaitAction(this.simpleActionDeps(), actor, options);
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
    options: Partial<ActionContextInput> & { context?: TestContext; targetCharacter?: Character } = {}
  ) {
    return runIndirectAttack(this.combatActionDeps(), attacker, weapon, orm, options);
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
    return runCloseCombatAttack(this.combatActionDeps(), attacker, defender, weapon, options);
  }

  public executeCounterStrike(
    defender: Character,
    attacker: Character,
    weapon: Item,
    hitTestResult: ResolveTestResult,
    options: { context?: TestContext; requireTrait?: boolean; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
  ): CounterStrikeResult {
    return runCounterStrike(this.counterActionDeps(), defender, attacker, weapon, hitTestResult, options);
  }

  public executeCounterFire(
    defender: Character,
    attacker: Character,
    weapon: Item,
    hitTestResult: ResolveTestResult,
    options: { context?: TestContext; visibilityOrMu?: number; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
  ): CounterFireResult {
    return runCounterFire(this.counterActionDeps(), defender, attacker, weapon, hitTestResult, options);
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
    };
  }

  private simpleActionDeps() {
    return {
      spendAp: (character: Character, cost: number) => this.spendAp(character, cost),
      setWaiting: (character: Character) => this.setWaiting(character),
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
    }>
  ): Record<string, BottleTestResult> {
    return runBottleTests(
      {
        setCharacterStatus: (characterId: string, status: CharacterStatus) => this.setCharacterStatus(characterId, status),
      },
      sides
    );
  }
}
