import { Character } from '../core/Character';
import { GameManager } from '../engine/GameManager';

export abstract class Action {
  constructor(public character: Character) {}

  abstract execute(gameManager: GameManager, ...args: any[]): void;
}
