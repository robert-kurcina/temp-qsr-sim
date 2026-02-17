import { Character } from './Character';
import { CharacterStatus, TurnPhase } from './types';
import { Battlefield } from './battlefield/Battlefield';
import { Position } from './battlefield/Position';
import { Item } from './Item';
import { TestContext } from './TestContext';
import { makeRangedCombatAttack } from './ranged-combat';
import { makeIndirectRangedAttack } from './indirect-ranged-combat';
import { makeCloseCombatAttack } from './close-combat';
import {
  ActionContextInput,
  CloseCombatContextInput,
  buildRangedActionContext,
  buildCloseCombatActionContext,
  resolveFriendlyFire,
} from './battlefield/action-context';
import { getBaseDiameterFromSiz } from './battlefield/size-utils';
import { SpatialRules, type SpatialModel } from './battlefield/spatial-rules';
import { LOSOperations } from './battlefield/LOSOperations';
import { d6, performTest } from './dice-roller';
import type { ResolveTestResult, TestDice } from './dice-roller';
import {
  attemptHide,
  attemptDetect,
  evaluateHide,
  resolveHiddenExposure,
  resolveWaitReveal,
  HideOptions,
  DetectOptions,
  RevealExposureOptions,
} from './concealment';
import { applyFearFromWounds, applyFearFromAllyKO, MoraleOptions } from './morale';
import { resolveBottleForSide, BottleTestResult } from './bottle-tests';
import { resolveTransfixEffect, TransfixTarget, promotePendingStatusTokens, getCharacterTraitLevel } from './status-system';
import { buildActiveToggleOptions, buildPassiveOptions, PassiveEvent, ActiveToggleOption, PassiveOption } from './passive-options';
import { resolveDamage, DamageResolution } from './subroutines/damage-test';

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

  constructor(characters: Character[], battlefield: Battlefield | null = null) {
    this.characters = characters;
    this.battlefield = battlefield;
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
    for (const character of this.characters) {
      character.initiative = Math.floor(roller() * 10) + 1 + character.attributes.ref;
    }
    this.activationOrder = [...this.characters].sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      const refDiff = (b.attributes.ref ?? 0) - (a.attributes.ref ?? 0);
      if (refDiff !== 0) return refDiff;
      return a.name.localeCompare(b.name);
    });
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
    this.rollInitiative(roller);
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
    }
    this.phase = TurnPhase.Activation;
  }

  public beginActivation(character: Character): number {
    const status = this.getCharacterStatus(character.id);
    if (status !== CharacterStatus.Ready) {
      return 0;
    }
    this.activeCharacterId = character.id;
    this.transfixUsed.delete(character.id);
    this.applyOngoingStatusEffects(character);
    if (character.state.isWaiting) {
      character.state.isWaiting = false;
    }

    const delayTokens = character.state.delayTokens;
    const apAvailable = Math.max(0, this.apPerActivation - delayTokens);
    const remainingDelay = Math.max(0, delayTokens - this.apPerActivation);
    character.state.delayTokens = remainingDelay;
    character.refreshStatusFlags();
    this.apRemaining.set(character.id, apAvailable);
    return apAvailable;
  }

  public endActivation(character: Character): void {
    this.activeCharacterId = null;
    this.characterStatus.set(character.id, CharacterStatus.Done);
  }

  public setWaiting(character: Character): void {
    character.state.isWaiting = true;
    this.characterStatus.set(character.id, CharacterStatus.Waiting);
  }

  public getApRemaining(character: Character): number {
    return this.apRemaining.get(character.id) ?? 0;
  }

  public spendAp(character: Character, amount: number): boolean {
    const current = this.getApRemaining(character);
    if (amount <= 0 || current < amount) return false;
    this.apRemaining.set(character.id, current - amount);
    return true;
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
    } = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    const attackerPos = options.attacker?.position ?? this.getCharacterPosition(attacker);
    let defenderPos = options.target?.position ?? this.getCharacterPosition(defender);
    if (!attackerPos || !defenderPos) {
      throw new Error('Missing attacker or defender position.');
    }

    let spatial: ActionContextInput = {
      battlefield: this.battlefield,
      attacker: {
        id: attacker.id,
        position: attackerPos,
        baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz),
        siz: attacker.finalAttributes.siz,
      },
      target: {
        id: defender.id,
        position: defenderPos,
        baseDiameter: getBaseDiameterFromSiz(defender.finalAttributes.siz),
        siz: defender.finalAttributes.siz,
      },
      optimalRangeMu: options.optimalRangeMu,
      orm: options.orm,
      attackerEngagedOverride: options.attackerEngagedOverride,
      isLeaning: options.isLeaning,
      isTargetLeaning: options.isTargetLeaning,
      lofWidthMu: options.lofWidthMu,
    };

    let takeCoverResult: { applied: boolean; cancelled: boolean; moved: boolean } | null = null;
    if (options.allowTakeCover && options.takeCoverPosition) {
      const engaged = SpatialRules.isEngaged(spatial.attacker, spatial.target);
      const defenderRef = defender.finalAttributes.ref ?? defender.attributes.ref ?? 0;
      const attackerRef = attacker.finalAttributes.ref ?? attacker.attributes.ref ?? 0;
      if (!engaged && defender.state.isAttentive && defender.state.isOrdered && defenderRef >= attackerRef) {
        const moveLimit = defender.finalAttributes.mov ?? defender.attributes.mov ?? 0;
        const moveDistance = LOSOperations.distance(defenderPos, options.takeCoverPosition);
        if (moveDistance <= moveLimit) {
          const moved = this.moveCharacter(defender, options.takeCoverPosition);
          if (moved) {
            defenderPos = options.takeCoverPosition;
            spatial = {
              ...spatial,
              target: {
                ...spatial.target,
                position: defenderPos,
              },
            };
            const coverAfter = SpatialRules.getCoverResult(this.battlefield, spatial.attacker, spatial.target);
            const behindCover = coverAfter.hasDirectCover || coverAfter.hasInterveningCover || !coverAfter.hasLOS;
            takeCoverResult = { applied: behindCover, cancelled: behindCover && !coverAfter.hasLOS, moved: true };
          }
        }
      }
    }

    const friendlyFire = resolveFriendlyFire(
      spatial,
      this.characters.map(character => {
        const pos = this.getCharacterPosition(character);
        return {
          id: character.id,
          position: pos ?? attackerPos,
          baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz),
          siz: character.finalAttributes.siz,
          isFriendly: false,
          isAttentive: character.state.isAttentive,
          isOrdered: character.state.isOrdered,
        };
      })
    );

    const context = buildRangedActionContext(spatial);
    const mergedContext: TestContext = { ...context, ...(options.context ?? {}) };
    if (!attacker.state.isAttentive) {
      mergedContext.isOverreach = false;
      mergedContext.isLeaning = false;
    }
    if (!defender.state.isAttentive) {
      mergedContext.isTargetLeaning = false;
    }
    if (attacker.state.isHidden && mergedContext.hasSuddenness !== false) {
      mergedContext.hasSuddenness = true;
    }
    if (defender.state.isHidden && !mergedContext.forceHit) {
      mergedContext.forceMiss = true;
    }

    if (takeCoverResult?.cancelled) {
      mergedContext.forceMiss = true;
    }

    const result = makeRangedCombatAttack(attacker, defender, weapon, options.orm ?? 0, mergedContext, spatial);
    if (weapon.traits?.includes('[Reveal]')) {
      const cover = SpatialRules.getCoverResult(spatial.battlefield, spatial.attacker, spatial.target);
      if (cover.hasLOS) {
        attacker.state.isHidden = false;
      }
    }
    if (result.damageResolution) {
      const woundsAdded = result.damageResolution.woundsAdded + result.damageResolution.stunWoundsAdded;
      applyFearFromWounds(defender, woundsAdded);
      if (result.damageResolution.defenderState.isKOd || result.damageResolution.defenderState.isEliminated) {
        if (this.battlefield && options.moraleAllies) {
          applyFearFromAllyKO(this.battlefield, defender, options.moraleAllies, options.moraleOptions);
        }
      }
      this.applyKOCleanup(defender);
    }
    return { result, context: mergedContext, friendlyFire, takeCover: takeCoverResult };
  }

  public getPassiveOptions(event: PassiveEvent): PassiveOption[] {
    return buildPassiveOptions(event);
  }

  public getActiveToggleOptions(params: { attacker: Character; weapon?: Item; isEngaged?: boolean }): ActiveToggleOption[] {
    return buildActiveToggleOptions(params);
  }

  public executeIndirectAttack(
    attacker: Character,
    weapon: Item,
    orm: number,
    options: Partial<ActionContextInput> & { context?: TestContext; targetCharacter?: Character } = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    const attackerPos = options.attacker?.position ?? this.getCharacterPosition(attacker);
    if (!attackerPos || !options.target?.position) {
      throw new Error('Missing attacker or target position.');
    }
    const spatial: ActionContextInput = {
      battlefield: this.battlefield,
      attacker: {
        id: attacker.id,
        position: attackerPos,
        baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz),
        siz: attacker.finalAttributes.siz,
      },
      target: options.target,
      optimalRangeMu: options.optimalRangeMu,
      orm,
      attackerEngagedOverride: options.attackerEngagedOverride,
      isLeaning: options.isLeaning,
      isTargetLeaning: options.isTargetLeaning,
      lofWidthMu: options.lofWidthMu,
    };

    const context = buildRangedActionContext(spatial);
    const mergedContext: TestContext = { ...context, ...(options.context ?? {}) };
    return makeIndirectRangedAttack(attacker, weapon, orm, mergedContext, null, spatial, options.targetCharacter);
  }

  public executeTransfixAction(
    source: Character,
    targets: Character[],
    options: { rating?: number; testRolls?: Record<string, number[]>; spendDelay?: boolean } = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    const sourcePos = this.getCharacterPosition(source);
    if (!sourcePos) {
      throw new Error('Missing source position.');
    }
    if (!source.state.isAttentive || !source.state.isOrdered) {
      return [];
    }
    if (this.transfixUsed.has(source.id)) {
      return [];
    }
    if (options.spendDelay ?? true) {
      source.state.delayTokens += 1;
      source.refreshStatusFlags();
    }
    this.transfixUsed.add(source.id);

    const targetModels: TransfixTarget[] = targets
      .map(target => {
        const pos = this.getCharacterPosition(target);
        if (!pos) return null;
        return {
          character: target,
          position: pos,
          baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz),
        };
      })
      .filter(Boolean) as TransfixTarget[];

    return resolveTransfixEffect(
      this.battlefield,
      {
        id: source.id,
        character: source,
        position: sourcePos,
        baseDiameter: getBaseDiameterFromSiz(source.finalAttributes.siz),
        siz: source.finalAttributes.siz,
      },
      targetModels,
      { rating: options.rating, testRolls: options.testRolls }
    );
  }

  public executeCloseCombatAttack(
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: Partial<CloseCombatContextInput> & { context?: TestContext; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    const attackerPos = options.attacker?.position ?? this.getCharacterPosition(attacker);
    const defenderPos = options.target?.position ?? this.getCharacterPosition(defender);
    if (!attackerPos || !defenderPos) {
      throw new Error('Missing attacker or defender position.');
    }
    const spatial: CloseCombatContextInput = {
      battlefield: this.battlefield,
      attacker: {
        id: attacker.id,
        position: attackerPos,
        baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz),
        siz: attacker.finalAttributes.siz,
      },
      target: {
        id: defender.id,
        position: defenderPos,
        baseDiameter: getBaseDiameterFromSiz(defender.finalAttributes.siz),
        siz: defender.finalAttributes.siz,
      },
      moveStart: options.moveStart,
      moveEnd: options.moveEnd,
      movedOverClear: options.movedOverClear,
      wasFreeAtStart: options.wasFreeAtStart,
      imprecisionMu: options.imprecisionMu,
      attackerElevationMu: options.attackerElevationMu,
      targetElevationMu: options.targetElevationMu,
      attackerBaseHeightMu: options.attackerBaseHeightMu,
      targetBaseHeightMu: options.targetBaseHeightMu,
      opposingModels: options.opposingModels,
    };

    const context = buildCloseCombatActionContext(spatial);
    const mergedContext: TestContext = { ...context, ...(options.context ?? {}) };
    if (!attacker.state.isAttentive) {
      mergedContext.isOverreach = false;
      mergedContext.isLeaning = false;
    }
    if (!defender.state.isAttentive) {
      mergedContext.isTargetLeaning = false;
      mergedContext.isDefending = false;
    }
    if (attacker.state.isHidden && mergedContext.hasSuddenness !== false) {
      mergedContext.hasSuddenness = true;
    }
    if (defender.state.isHidden && !mergedContext.forceHit) {
      mergedContext.forceMiss = true;
    }
    const result = makeCloseCombatAttack(attacker, defender, weapon, mergedContext);
    if (weapon.traits?.includes('[Reveal]')) {
      attacker.state.isHidden = false;
    }
    if (result.damageResolution) {
      const woundsAdded = result.damageResolution.woundsAdded + result.damageResolution.stunWoundsAdded;
      applyFearFromWounds(defender, woundsAdded);
      if (result.damageResolution.defenderState.isKOd || result.damageResolution.defenderState.isEliminated) {
        if (this.battlefield && options.moraleAllies) {
          applyFearFromAllyKO(this.battlefield, defender, options.moraleAllies, options.moraleOptions);
        }
      }
      this.applyKOCleanup(defender);
    }
    return result;
  }

  public executeCounterStrike(
    defender: Character,
    attacker: Character,
    weapon: Item,
    hitTestResult: ResolveTestResult,
    options: { context?: TestContext; requireTrait?: boolean; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
  ): CounterStrikeResult {
    if (!this.battlefield) {
      return { executed: false, reason: 'Battlefield not set.' };
    }
    if (!defender.state.isAttentive || !defender.state.isOrdered) {
      return { executed: false, reason: 'Requires Attentive+Ordered defender.' };
    }
    const requireTrait = options.requireTrait ?? true;
    const hasTrait = getCharacterTraitLevel(defender, 'Counter-strike!') > 0
      || getCharacterTraitLevel(defender, 'Counter-strike') > 0;
    if (requireTrait && !hasTrait) {
      return { executed: false, reason: 'Requires Counter-strike! trait.' };
    }
    if (hitTestResult.score > 0) {
      return { executed: false, reason: 'Hit Test did not fail.' };
    }

    const defenderModel = this.buildSpatialModel(defender);
    const attackerModel = this.buildSpatialModel(attacker);
    if (!defenderModel || !attackerModel) {
      return { executed: false, reason: 'Missing positions.' };
    }
    if (!SpatialRules.isEngaged(attackerModel, defenderModel)) {
      return { executed: false, reason: 'Requires melee engagement.' };
    }

    const cost = this.applyInterruptCost(defender);
    const carryOverDice = hitTestResult.p2Result?.carryOverDice ?? {};
    const counterHitResult = { carryOverDice } as unknown as ResolveTestResult;

    const damageResolution = resolveDamage(defender, attacker, weapon, counterHitResult, options.context ?? {});
    attacker.state.wounds = damageResolution.defenderState.wounds;
    attacker.state.delayTokens = damageResolution.defenderState.delayTokens;
    attacker.state.isKOd = damageResolution.defenderState.isKOd;
    attacker.state.isEliminated = damageResolution.defenderState.isEliminated;
    if (damageResolution) {
      const woundsAdded = damageResolution.woundsAdded + damageResolution.stunWoundsAdded;
      applyFearFromWounds(attacker, woundsAdded);
      if (damageResolution.defenderState.isKOd || damageResolution.defenderState.isEliminated) {
        if (this.battlefield && options.moraleAllies) {
          applyFearFromAllyKO(this.battlefield, attacker, options.moraleAllies, options.moraleOptions);
        }
      }
      this.applyKOCleanup(attacker);
    }

    return {
      executed: true,
      damageResolution,
      bonusActionEligible: Boolean(damageResolution.damageTestResult?.pass),
      removedWait: cost.removedWait,
      delayAdded: cost.delayAdded,
    };
  }

  public executeCounterFire(
    defender: Character,
    attacker: Character,
    weapon: Item,
    hitTestResult: ResolveTestResult,
    options: { context?: TestContext; visibilityOrMu?: number; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
  ): CounterFireResult {
    if (!this.battlefield) {
      return { executed: false, reason: 'Battlefield not set.' };
    }
    if (!defender.state.isAttentive || !defender.state.isOrdered) {
      return { executed: false, reason: 'Requires Attentive+Ordered defender.' };
    }
    if (hitTestResult.score > 0) {
      return { executed: false, reason: 'Hit Test did not fail.' };
    }
    const defenderModel = this.buildSpatialModel(defender);
    const attackerModel = this.buildSpatialModel(attacker);
    if (!defenderModel || !attackerModel) {
      return { executed: false, reason: 'Missing positions.' };
    }
    if (SpatialRules.isEngaged(attackerModel, defenderModel)) {
      return { executed: false, reason: 'Requires defender to be Free.' };
    }
    if (attacker.state.isHidden) {
      return { executed: false, reason: 'Requires Revealed attacker.' };
    }
    const hasLOS = SpatialRules.hasLineOfSight(this.battlefield, defenderModel, attackerModel);
    if (!hasLOS) {
      return { executed: false, reason: 'Requires LOS.' };
    }
    const visibilityOrMu = options.visibilityOrMu ?? 16;
    const edgeDistance = SpatialRules.distanceEdgeToEdge(defenderModel, attackerModel);
    if (edgeDistance > visibilityOrMu) {
      return { executed: false, reason: 'Requires target within Visibility.' };
    }
    const defenderRef = defender.finalAttributes.ref ?? defender.attributes.ref ?? 0;
    const attackerRef = attacker.finalAttributes.ref ?? attacker.attributes.ref ?? 0;
    if (defenderRef < attackerRef) {
      return { executed: false, reason: 'Requires defender REF >= attacker REF.' };
    }

    const cost = this.applyInterruptCost(defender);
    const carryOverDice = hitTestResult.p2Result?.carryOverDice ?? {};
    const counterHitResult = { carryOverDice } as unknown as ResolveTestResult;

    const damageResolution = resolveDamage(defender, attacker, weapon, counterHitResult, options.context ?? {});
    attacker.state.wounds = damageResolution.defenderState.wounds;
    attacker.state.delayTokens = damageResolution.defenderState.delayTokens;
    attacker.state.isKOd = damageResolution.defenderState.isKOd;
    attacker.state.isEliminated = damageResolution.defenderState.isEliminated;
    if (damageResolution) {
      const woundsAdded = damageResolution.woundsAdded + damageResolution.stunWoundsAdded;
      applyFearFromWounds(attacker, woundsAdded);
      if (damageResolution.defenderState.isKOd || damageResolution.defenderState.isEliminated) {
        if (this.battlefield && options.moraleAllies) {
          applyFearFromAllyKO(this.battlefield, attacker, options.moraleAllies, options.moraleOptions);
        }
      }
      this.applyKOCleanup(attacker);
    }

    return {
      executed: true,
      damageResolution,
      bonusActionEligible: Boolean(damageResolution.damageTestResult?.pass),
      removedWait: cost.removedWait,
      delayAdded: cost.delayAdded,
    };
  }

  public executeCounterAction(
    defender: Character,
    attacker: Character,
    hitTestResult: ResolveTestResult,
    options: { attackType?: 'melee' | 'ranged'; carryOverRolls?: number[] } = {}
  ): CounterActionResult {
    if (!defender.state.isAttentive || !defender.state.isOrdered) {
      return { executed: false, reason: 'Requires Attentive+Ordered defender.' };
    }
    if (hitTestResult.score > 0) {
      return { executed: false, reason: 'Hit Test did not fail.' };
    }
    const carryOverDice = hitTestResult.p2Result?.carryOverDice ?? {};
    const carryOverCount = this.countDice(carryOverDice);
    if (carryOverCount <= 0) {
      return { executed: false, reason: 'Requires carry-over from the failed Hit Test.', carryOverDice };
    }
    if (options.attackType === 'ranged') {
      const defenderRef = defender.finalAttributes.ref ?? defender.attributes.ref ?? 0;
      const attackerRef = attacker.finalAttributes.ref ?? attacker.attributes.ref ?? 0;
      if (defenderRef < attackerRef) {
        return { executed: false, reason: 'Requires defender REF >= attacker REF.', carryOverDice };
      }
    }

    const cost = this.applyInterruptCost(defender);
    const bonusActionCascades = this.resolveCarryOverSuccesses(carryOverDice, options.carryOverRolls);

    return {
      executed: true,
      bonusActionCascades,
      carryOverDice,
      removedWait: cost.removedWait,
      delayAdded: cost.delayAdded,
    };
  }

  public executeCounterCharge(
    observer: Character,
    target: Character,
    options: { visibilityOrMu?: number; moveApSpent?: number; moveEnd?: Position } = {}
  ): CounterChargeResult {
    if (!this.battlefield) {
      return { executed: false, reason: 'Battlefield not set.' };
    }
    if (!observer.state.isAttentive || !observer.state.isOrdered) {
      return { executed: false, reason: 'Requires Attentive+Ordered observer.' };
    }
    const observerModel = this.buildSpatialModel(observer);
    const targetModel = this.buildSpatialModel(target);
    if (!observerModel || !targetModel) {
      return { executed: false, reason: 'Missing positions.' };
    }
    const hasLOS = SpatialRules.hasLineOfSight(this.battlefield, observerModel, targetModel);
    if (!hasLOS) {
      return { executed: false, reason: 'Requires LOS.' };
    }
    const visibilityOrMu = options.visibilityOrMu ?? 16;
    const edgeDistance = SpatialRules.distanceEdgeToEdge(observerModel, targetModel);
    if (edgeDistance > visibilityOrMu) {
      return { executed: false, reason: 'Requires target within Visibility.' };
    }

    const observerRef = observer.finalAttributes.ref ?? observer.attributes.ref ?? 0;
    const targetMov = target.finalAttributes.mov ?? target.attributes.mov ?? 0;
    const requiredAp = observerRef > targetMov ? 1 : 2;
    const moveApSpent = options.moveApSpent ?? 2;
    if (moveApSpent < requiredAp) {
      return { executed: false, reason: 'Requires target to spend enough AP on movement.' };
    }

    const moveLimit = observer.finalAttributes.mov ?? observer.attributes.mov ?? 0;
    const desiredPosition = options.moveEnd ?? this.resolveEngagePosition(observerModel, targetModel, moveLimit);
    if (!desiredPosition) {
      return { executed: false, reason: 'Unable to reach engagement.' };
    }
    const moved = this.moveCharacter(observer, desiredPosition);
    if (!moved) {
      return { executed: false, reason: 'Move blocked.' };
    }

    const updatedObserver = this.buildSpatialModel(observer);
    if (!updatedObserver || !SpatialRules.isEngaged(updatedObserver, targetModel)) {
      return { executed: false, reason: 'Move did not engage target.' };
    }

    const cost = this.applyInterruptCost(observer);
    return {
      executed: true,
      moved: true,
      newPosition: desiredPosition,
      removedWait: cost.removedWait,
      delayAdded: cost.delayAdded,
    };
  }

  private buildSpatialModel(character: Character): SpatialModel | null {
    if (!this.battlefield) return null;
    const position = this.getCharacterPosition(character);
    if (!position) return null;
    const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
    return {
      id: character.id,
      position,
      baseDiameter: getBaseDiameterFromSiz(siz),
      siz,
    };
  }

  private applyInterruptCost(character: Character): { removedWait: boolean; delayAdded: boolean } {
    if (character.state.isWaiting) {
      character.state.isWaiting = false;
      this.characterStatus.set(character.id, CharacterStatus.Done);
      character.refreshStatusFlags();
      return { removedWait: true, delayAdded: false };
    }
    character.state.delayTokens += 1;
    character.refreshStatusFlags();
    return { removedWait: false, delayAdded: true };
  }

  private resolveEngagePosition(
    mover: SpatialModel,
    target: SpatialModel,
    moveLimit: number
  ): Position | null {
    const distance = LOSOperations.distance(mover.position, target.position);
    const baseContact = (mover.baseDiameter + target.baseDiameter) / 2;
    const requiredMove = Math.max(0, distance - baseContact);
    if (requiredMove > moveLimit || distance === 0) {
      return null;
    }
    const dx = target.position.x - mover.position.x;
    const dy = target.position.y - mover.position.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      return mover.position;
    }
    const ratio = requiredMove / length;
    return {
      x: mover.position.x + dx * ratio,
      y: mover.position.y + dy * ratio,
    };
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
    if (!character.state.isKOd && !character.state.isEliminated) {
      character.refreshStatusFlags();
      return;
    }
    if (character.state.isKOd) {
      character.state.delayTokens = 0;
      character.state.fearTokens = 0;
      character.state.isWaiting = false;
      character.state.isHidden = false;
      this.characterStatus.set(character.id, CharacterStatus.Done);
    }
    if (character.state.isEliminated) {
      character.state.delayTokens = 0;
      character.state.fearTokens = 0;
      character.state.isWaiting = false;
      character.state.isHidden = false;
      character.state.statusTokens = {};
      character.state.statusEffects = [];
      this.characterStatus.set(character.id, CharacterStatus.Done);
    }
    character.refreshStatusFlags();
  }

  private applyOngoingStatusEffects(character: Character): void {
    if (character.state.isKOd || character.state.isEliminated) {
      character.refreshStatusFlags();
      return;
    }
    promotePendingStatusTokens(character);
    const poison = character.state.statusTokens.Poison ?? 0;
    const burn = character.state.statusTokens.Burn ?? 0;
    const acid = character.state.statusTokens.Acid ?? 0;
    const totalWounds = poison + burn + acid;
    if (totalWounds <= 0) {
      character.refreshStatusFlags();
      return;
    }

    character.state.wounds += totalWounds;
    const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
    if (character.state.wounds >= siz) {
      character.state.isKOd = true;
    }
    if (character.state.wounds >= siz + 3) {
      character.state.isEliminated = true;
    }
    this.applyKOCleanup(character);
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
    const results: Record<string, BottleTestResult> = {};
    for (const side of sides) {
      const result = resolveBottleForSide(side.characters, side.orderedCandidate, side.opposingCount, side.rolls);
      results[side.id] = result;
      if (result.bottledOut) {
        for (const character of side.characters) {
          character.state.isEliminated = true;
          this.setCharacterStatus(character.id, CharacterStatus.Done);
        }
      }
    }
    return results;
  }
}
