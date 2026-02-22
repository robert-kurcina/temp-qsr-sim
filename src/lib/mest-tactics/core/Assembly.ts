
export interface Assembly {
  name: string;
  characters: string[]; // Changed to store character IDs
  totalBP: number;
  totalCharacters: number;
  config?: {
    bpLimitMin: number;
    bpLimitMax: number;
    characterLimitMin: number;
    characterLimitMax: number;
    gameSize: string;
  };
}
