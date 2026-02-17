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

export class GameManager {
  public characters: Character[];
  public battlefield: Battlefield | null;
  public currentTurn: number = 1;
  public currentRound: number = 1;
  public activationOrder: Character[] = [];

  private characterStatus: Map<string, CharacterStatus> = new Map();

  constructor(characters: Character[], battlefield: Battlefield | null = null) {
    this.characters = characters;
    this.battlefield = battlefield;
    this.initializeCharacterStatus();
  }

  private initializeCharacterStatus(): void {
    for (const character of this.characters) {
      this.characterStatus.set(character.id, CharacterStatus.Ready);
    }
  }

  public getCharacterStatus(characterId: string): CharacterStatus | undefined {
    return this.characterStatus.get(characterId);
  }

  public setCharacterStatus(characterId: string, status: CharacterStatus): void {
    this.characterStatus.set(characterId, status);
  }

  public rollInitiative(): void {
    for (const character of this.characters) {
      character.initiative = Math.floor(Math.random() * 10) + 1 + character.attributes.REF;
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

  public nextRound(): void {
    this.currentRound++;
    // a new round a character is ready again
    this.initializeCharacterStatus();
  }

  public nextTurn(): void {
    this.currentTurn++;
    this.currentRound = 1;
    this.initializeCharacterStatus();
    this.rollInitiative();
  }

  public isTurnOver(): boolean {
    return this.characters.every(char => this.getCharacterStatus(char.id) === CharacterStatus.Done);
  }

  public executeRangedAttack(
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: Partial<ActionContextInput> & { optimalRangeMu?: number; orm?: number; context?: TestContext } = {}
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

    const result = makeRangedCombatAttack(attacker, defender, weapon, options.orm ?? 0, mergedContext, spatial);
    return { result, context: mergedContext, friendlyFire };
  }

  public executeIndirectAttack(
    attacker: Character,
    weapon: Item,
    orm: number,
    options: Partial<ActionContextInput> & { context?: TestContext } = {}
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
    return makeIndirectRangedAttack(attacker, weapon, orm, mergedContext, null, spatial);
  }

  public executeCloseCombatAttack(
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: Partial<CloseCombatContextInput> & { context?: TestContext } = {}
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
    return makeCloseCombatAttack(attacker, defender, weapon, mergedContext);
  }
}
