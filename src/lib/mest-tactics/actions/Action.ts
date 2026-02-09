import { Character } from '../character/Character';
import { GameManager } from '../GameManager';

export abstract class Action {
  constructor(public character: Character) {}

  abstract execute(gameManager: GameManager, ...args: any[]): void;
}
