import { Character } from './character/Character';
import { CharacterStatus } from './types';
import { Move } from './actions';
import { Coordinate } from './spatial';

export class GameManager {
  public characters: Character[];
  public currentTurn: number = 1;
  public currentRound: number = 1;
  public activationOrder: Character[] = [];

  private characterStatus: Map<string, CharacterStatus> = new Map();

  constructor(characters: Character[]) {
    this.characters = characters;
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

  public performMove(characterId: string, newPosition: Coordinate): void {
    const character = this.characters.find(char => char.id === characterId);
    if (character && this.getCharacterStatus(characterId) === CharacterStatus.Ready) {
      const moveAction = new Move(character);
      moveAction.execute(this, newPosition);
      this.setCharacterStatus(characterId, CharacterStatus.Done);
    } else {
      console.log(`Character ${characterId} cannot move.`);
    }
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
}
