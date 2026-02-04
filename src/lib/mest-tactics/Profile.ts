
import { Item } from './Item';
import { Archetype } from './Archetype';

export interface Profile {
  name: string;
  archetype: { [key: string]: Archetype };
  items: Item[];
  totalBp: number;
  finalTraits: string[];
}
