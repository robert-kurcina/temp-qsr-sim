import { Action } from './Action';
import { Character } from '../core/Character';
import { GameManager } from '../engine/GameManager';
import { Coordinate } from '../battlefield/spatial';

export class Move extends Action {
  constructor(character: Character) {
    super(character);
  }

  execute(gameManager: GameManager, newPosition: Coordinate): void {
    // In a real implementation, you would have validation here:
    // 1. Check if the character can move that far (based on MOV attribute)
    // 2. Check for collisions with terrain or other characters
    // 3. Use a pathfinding algorithm (like A*) to find a valid path

    // For now, we'll just update the position directly
    this.character.move(newPosition);
  }
}
