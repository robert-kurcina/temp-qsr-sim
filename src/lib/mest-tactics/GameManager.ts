import { Character } from './Character';
import { CharacterStatus } from './types';
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
import { SpatialRules } from './battlefield/spatial-rules';
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

export class GameManager {
  public characters: Character[];
  public battlefield: Battlefield | null;
  public currentTurn: number = 1;
  public currentRound: number = 1;
  public activationOrder: Character[] = [];
  public apPerActivation: number = 2;

  private characterStatus: Map<string, CharacterStatus> = new Map();
  private activeCharacterId: string | null = null;
  private apRemaining: Map<string, number> = new Map();

  constructor(characters: Character[], battlefield: Battlefield | null = null) {
    this.characters = characters;
    this.battlefield = battlefield;
    this.initializeCharacterStatus();
  }

  private initializeCharacterStatus(): void {
    for (const character of this.characters) {
      if (character.state.isEliminated) {
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
    this.activationOrder = [...this.characters].sort((a, b) => b.initiative - a.initiative);
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
  }

  public startRound(): void {
    this.currentRound += 1;
    for (const character of this.characters) {
      if (character.state.isEliminated) {
        this.characterStatus.set(character.id, CharacterStatus.Done);
        continue;
      }
      if (this.characterStatus.get(character.id) === CharacterStatus.Done) {
        this.characterStatus.set(character.id, CharacterStatus.Ready);
      }
      this.apRemaining.set(character.id, this.apPerActivation);
    }
  }

  public beginActivation(character: Character): number {
    const status = this.getCharacterStatus(character.id);
    if (status !== CharacterStatus.Ready) {
      return 0;
    }
    this.activeCharacterId = character.id;
    if (character.state.isWaiting) {
      character.state.isWaiting = false;
    }

    const delayTokens = character.state.delayTokens;
    const apAvailable = Math.max(0, this.apPerActivation - delayTokens);
    const remainingDelay = Math.max(0, delayTokens - this.apPerActivation);
    character.state.delayTokens = remainingDelay;
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
    options: Partial<ActionContextInput> & { optimalRangeMu?: number; orm?: number; context?: TestContext; moraleAllies?: Character[]; moraleOptions?: MoraleOptions } = {}
  ) {
    if (!this.battlefield) {
      throw new Error('Battlefield not set.');
    }
    const attackerPos = options.attacker?.position ?? this.getCharacterPosition(attacker);
    const defenderPos = options.target?.position ?? this.getCharacterPosition(defender);
    if (!attackerPos || !defenderPos) {
      throw new Error('Missing attacker or defender position.');
    }

    const spatial: ActionContextInput = {
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
          isAttentive: true,
          isOrdered: true,
        };
      })
    );

    const context = buildRangedActionContext(spatial);
    const mergedContext: TestContext = { ...context, ...(options.context ?? {}) };
    if (attacker.state.isHidden && mergedContext.hasSuddenness !== false) {
      mergedContext.hasSuddenness = true;
    }
    if (defender.state.isHidden && !mergedContext.forceHit) {
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
    }
    return { result, context: mergedContext, friendlyFire };
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
    }
    return result;
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
