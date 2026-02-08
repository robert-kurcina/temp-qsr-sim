import { Position } from './Position';
import { Character } from '../character/Character';

export class Cell {
  public occupant: Character | null = null;

  constructor(public position: Position) {}

  isOccupied(): boolean {
    return this.occupant !== null;
  }
}
