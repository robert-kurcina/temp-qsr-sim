import { Position } from './Position';

export class Cell {
  public occupantId: string | null = null;

  constructor(public position: Position) {}

  isOccupied(): boolean {
    return this.occupantId !== null;
  }
}
