import { Position } from '../';
import { Character } from '../../core/Character';

export class Cell {
  public occupant: Character | null = null;

  constructor(public position: Position) {}

  isOccupied(): boolean {
    return this.occupant !== null;
  }
}
