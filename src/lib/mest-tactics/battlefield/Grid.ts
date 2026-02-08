import { Cell } from './Cell';
import { Position } from './Position';
import { Character } from '../character/Character';

export class Grid {
  private cells: Cell[][] = [];

  constructor(public width: number, public height: number) {
    for (let y = 0; y < height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < width; x++) {
        this.cells[y][x] = new Cell({ x, y });
      }
    }
  }

  getCell(position: Position): Cell | undefined {
    if (this.isValid(position)) {
      return this.cells[position.y][position.x];
    }
    return undefined;
  }

  setOccupant(position: Position, occupant: Character | null): boolean {
    const cell = this.getCell(position);
    if (cell && !cell.isOccupied()) {
      cell.occupant = occupant;
      return true;
    }
    return false;
  }

  isValid(position: Position): boolean {
    return position.x >= 0 && position.x < this.width &&
           position.y >= 0 && position.y < this.height;
  }
}
