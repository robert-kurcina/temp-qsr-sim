import { Item } from './Item';
import { Trait } from './Trait';
import { Position } from './battlefield/Position';

export interface CharacterAttributes {
  CCA: number; // Close Combat Ability
  RCA: number; // Range Combat Ability
  REF: number; // Reflexes
  INT: number; // Intellect
  POW: number; // Willpower
  STR: number; // Strength
  FOR: number; // Fortitude
  MOV: number; // Movement
  SIZ: number; // Size
}

export class Character {
  public id: string;
  public name: string;
  public attributes: CharacterAttributes;
  public traits: Trait[] = [];
  public items: Item[] = [];
  public position: Position;
  public wounds: number = 0;

  constructor(id: string, name: string, attributes: CharacterAttributes, position: Position) {
    this.id = id;
    this.name = name;
    this.attributes = attributes;
    this.position = position;
  }

  public isKnockedOut(): boolean {
    return this.wounds >= this.attributes.SIZ;
  }

  public isEliminated(): boolean {
    return this.wounds >= this.attributes.SIZ * 2;
  }

  public takeWound(): void {
    this.wounds++;
  }

  public move(newPosition: Position): void {
    this.position = newPosition;
  }
}
