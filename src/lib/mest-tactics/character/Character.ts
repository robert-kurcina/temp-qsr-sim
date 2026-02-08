import { Item } from './Item';
import { Trait } from './Trait';
import { Coordinate } from '../spatial';

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
  public position: Coordinate;
  public wounds: number = 0;
  public initiative: number = 0;

  constructor(id: string, name: string, attributes: CharacterAttributes, position: Coordinate) {
    this.id = id;
    this.name = name;
    this.attributes = attributes;
    this.position = position;
  }

  public get baseDiameter(): number {
    return this.attributes.SIZ / 3;
  }

  public get meleeRange(): number {
    return this.baseDiameter / 2 + 0.5;
  }

  public getFootprint(): Coordinate[] {
    const points: Coordinate[] = [];
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      points.push({
        x: this.position.x + (this.baseDiameter / 2) * Math.cos(angle),
        y: this.position.y + (this.baseDiameter / 2) * Math.sin(angle),
      });
    }
    return points;
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

  public move(newPosition: Coordinate): void {
    this.position = newPosition;
  }
}
