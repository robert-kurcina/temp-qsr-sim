import { Character } from './Character';

export interface Assembly {
  name: string;
  characters: Character[];
  totalBP: number;
  totalCharacters: number;
}
