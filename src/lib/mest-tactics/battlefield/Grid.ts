import { Cell } from './Cell';
import { Position } from './Position';

export class Grid {
  private cells: Cell[][] = [];

  constructor(public width: number, public height: number) {
    for (let x = 0; x < width; x++) {
      this.cells[x] = [];
      for (let y = 0; y < height; y++) {
        this.cells[x][y] = new Cell({ x, y });
      }
    }
  }

  getCell(position: Position): Cell | undefined {
    if (this.isValidPosition(position)) {
      return this.cells[position.x][position.y];
    }
    return undefined;
  }

  setOccupant(position: Position, occupantId: string): boolean {
    const cell = this.getCell(position);
    if (cell && !cell.isOccupied()) {
      cell.occupantId = occupantId;
      return true;
    }
    return false;
  }

  removeOccupant(position: Position): void {
    const cell = this.getCell(position);
    if (cell) {
      cell.occupantId = null;
    }
  }

  private isValidPosition(position: Position): boolean {
    return (
      position.x >= 0 &&
      position.x < this.width &&
      position.y >= 0 &&
      position.y < this.height
    );
  }
}
