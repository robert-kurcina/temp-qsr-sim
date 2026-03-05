import { Character } from '../../core/Character';
import { Position } from '../Position';
import { SpatialModel } from './spatial-rules';
import { ModelRegistry, MeasurementUtils } from './model-registry';
import { LOFOperations } from '../los/LOFOperations';
import { Item } from '../../core/Item';
import { getCharacterTraitLevel } from '../../status/status-system';
import { getReachExtension, hasPerimeter } from '../../traits/combat-traits';

/**
 * Engagement state between two models
 */
export interface EngagementPair {
  modelA: string;
  modelB: string;
  distance: number;
  inBaseContact: boolean;
  inMeleeReach: boolean;
}

/**
 * Engagement query result
 */
export interface EngagementQueryResult {
  isEngaged: boolean;
  engagedModels: string[];
  engagementPairs: EngagementPair[];
  isCornered: boolean;
  isFlanked: boolean;
  isSurrounded: boolean;
  engagedCount: number;
}

/**
 * Melee reach calculation result
 */
export interface MeleeReachResult {
  baseReach: number;
  weaponReach: number;
  totalReach: number;
  canReach: boolean;
  edgeDistance: number;
}

/**
 * EngagementManager tracks and queries engagement state between models
 */
export class EngagementManager {
  private registry: ModelRegistry;

  constructor(registry: ModelRegistry) {
    this.registry = registry;
  }

  /**
   * Check if two models are engaged (in base contact)
   * Perimeter trait: models with Perimeter can only be engaged by Attentive models using Agility
   */
  isEngaged(modelAId: string, modelBId: string, characterA?: Character, characterB?: Character): boolean {
    const modelA = this.registry.getModel(modelAId);
    const modelB = this.registry.getModel(modelBId);
    if (!modelA || !modelB) return false;
    
    // Check Perimeter trait - models with Perimeter can only be engaged by Attentive models
    if (characterA && hasPerimeter(characterA)) {
      // Character A has Perimeter - can only be engaged by Attentive models
      if (!characterB || !characterB.state.isAttentive) {
        return false;
      }
    }
    if (characterB && hasPerimeter(characterB)) {
      // Character B has Perimeter - can only be engaged by Attentive models
      if (!characterA || !characterA.state.isAttentive) {
        return false;
      }
    }
    
    return MeasurementUtils.isBaseContact(modelA, modelB);
  }

  /**
   * Get all models engaged with a specific model
   * Perimeter trait: models with Perimeter can only be engaged by Attentive models
   */
  getEngagedModels(modelId: string, opposingIds?: Set<string>, character?: Character, allCharacters?: Map<string, Character>): string[] {
    const model = this.registry.getModel(modelId);
    if (!model) return [];

    const allModels = this.registry.getAllModels();
    const engaged: string[] = [];

    for (const other of allModels) {
      if (other.id === modelId) continue;
      if (opposingIds && !opposingIds.has(other.id)) continue;
      
      // Check Perimeter trait
      const otherCharacter = allCharacters?.get(other.id);
      if (character && hasPerimeter(character)) {
        // This model has Perimeter - can only be engaged by Attentive models
        if (!otherCharacter || !otherCharacter.state.isAttentive) {
          continue;
        }
      }
      if (otherCharacter && hasPerimeter(otherCharacter)) {
        // Other model has Perimeter - requires this model to be Attentive
        if (!character || !character.state.isAttentive) {
          continue;
        }
      }
      
      if (MeasurementUtils.isBaseContact(model, other)) {
        engaged.push(other.id);
      }
    }

    return engaged;
  }

  /**
   * Get detailed engagement information for a model
   */
  queryEngagement(modelId: string, opposingIds?: Set<string>): EngagementQueryResult {
    const model = this.registry.getModel(modelId);
    if (!model) {
      return {
        isEngaged: false,
        engagedModels: [],
        engagementPairs: [],
        isCornered: false,
        isFlanked: false,
        isSurrounded: false,
        engagedCount: 0,
      };
    }

    const engagedModels = this.getEngagedModels(modelId, opposingIds);
    const pairs: EngagementPair[] = engagedModels.map(id => {
      const other = this.registry.getModel(id)!;
      return {
        modelA: modelId,
        modelB: id,
        distance: MeasurementUtils.edgeToEdge(model, other),
        inBaseContact: true,
        inMeleeReach: MeasurementUtils.canReachInMelee(model, other),
      };
    });

    const isEngaged = engagedModels.length > 0;
    const isSurrounded = engagedModels.length >= 2;
    const isCornered = this.isCornered(model, engagedModels);
    const isFlanked = this.isFlanked(model, engagedModels);

    return {
      isEngaged,
      engagedModels,
      engagementPairs: pairs,
      isCornered,
      isFlanked,
      isSurrounded,
      engagedCount: engagedModels.length,
    };
  }

  /**
   * Check if a model is cornered (engaged with blocking terrain behind)
   */
  isCornered(model: SpatialModel, engagedModelIds: string[]): boolean {
    if (engagedModelIds.length === 0) return false;
    // Simplified: check if model has enemies on multiple sides
    // Full implementation would check terrain behind
    return engagedModelIds.length >= 2;
  }

  /**
   * Check if a model is flanked (enemies on opposite sides)
   */
  isFlanked(model: SpatialModel, engagedModelIds: string[]): boolean {
    if (engagedModelIds.length < 2) return false;

    const models = engagedModelIds
      .map(id => this.registry.getModel(id))
      .filter((m): m is SpatialModel => m !== undefined);

    if (models.length < 2) return false;

    // Check if any pair of engaged models are on opposite sides
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        if (MeasurementUtils.isFlankingConfiguration(models[i], models[j], model)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate melee reach for a character with a specific weapon
   * Reach trait: extends melee range by X × 1 MU
   */
  calculateMeleeReach(character: Character, weapon?: Item): MeleeReachResult {
    const model = this.registry.getModel(character.id);
    if (!model) {
      return {
        baseReach: 0,
        weaponReach: 0,
        totalReach: 0,
        canReach: false,
        edgeDistance: 0,
      };
    }

    const baseReach = model.baseDiameter / 2;
    const weaponReach = this.getWeaponReachModifier(weapon);
    
    // Reach trait: character-based reach extension (X × 1 MU)
    const reachTraitExtension = getReachExtension(character);
    
    const totalReach = baseReach + weaponReach + reachTraitExtension;

    return {
      baseReach,
      weaponReach,
      totalReach,
      canReach: totalReach > 0,
      edgeDistance: 0,
    };
  }

  /**
   * Check if attacker can reach target in melee
   */
  canAttackInMelee(attackerId: string, targetId: string, weapon?: Item): boolean {
    const attacker = this.registry.getModel(attackerId);
    const target = this.registry.getModel(targetId);
    if (!attacker || !target) return false;

    const reach = this.calculateMeleeReachForModel(attacker, weapon);
    const edgeDistance = MeasurementUtils.edgeToEdge(attacker, target);

    return edgeDistance <= reach;
  }

  /**
   * Get weapon reach modifier from item traits
   */
  private getWeaponReachModifier(weapon?: Item): number {
    if (!weapon) return 0;

    // Check for reach-granting traits
    const reachTraits = ['Reach', 'Impale', 'Pike', 'Spear', 'Lance'];
    for (const trait of weapon.traits || []) {
      for (const reachTrait of reachTraits) {
        if (trait.toLowerCase().includes(reachTrait.toLowerCase())) {
          return 0.5; // Standard reach bonus
        }
      }
    }

    // Check for natural weapons (claws, teeth, etc.)
    const naturalTraits = ['Natural', 'Claws', 'Teeth', 'Horns'];
    for (const trait of weapon.traits || []) {
      for (const natural of naturalTraits) {
        if (trait.toLowerCase().includes(natural.toLowerCase())) {
          return 0; // Natural weapons don't add reach
        }
      }
    }

    return 0;
  }

  /**
   * Calculate melee reach for a spatial model
   */
  private calculateMeleeReachForModel(model: SpatialModel, weapon?: Item): number {
    const baseReach = model.baseDiameter / 2;
    const weaponReach = this.getWeaponReachModifier(weapon);
    return baseReach + weaponReach;
  }

  /**
   * Get all engagement pairs on the battlefield
   */
  getAllEngagements(opposingSideIds?: Set<string>[]): EngagementPair[] {
    const models = this.registry.getAllModels();
    const pairs: EngagementPair[] = [];
    const seen = new Set<string>();

    for (const modelA of models) {
      for (const modelB of models) {
        if (modelA.id >= modelB.id) continue;

        const pairKey = `${modelA.id}-${modelB.id}`;
        if (seen.has(pairKey)) continue;

        // Check opposing sides if specified
        if (opposingSideIds && opposingSideIds.length >= 2) {
          const inSideA = opposingSideIds[0].has(modelA.id);
          const inSideB = opposingSideIds[1].has(modelB.id);
          const inSideA2 = opposingSideIds[0].has(modelB.id);
          const inSideB2 = opposingSideIds[1].has(modelA.id);

          if (!((inSideA && inSideB) || (inSideA2 && inSideB2))) {
            continue;
          }
        }

        const inBaseContact = MeasurementUtils.isBaseContact(modelA, modelB);
        if (inBaseContact) {
          pairs.push({
            modelA: modelA.id,
            modelB: modelB.id,
            distance: MeasurementUtils.edgeToEdge(modelA, modelB),
            inBaseContact: true,
            inMeleeReach: MeasurementUtils.canReachInMelee(modelA, modelB),
          });
          seen.add(pairKey);
        }
      }
    }

    return pairs;
  }

  /**
   * Check if a position is within any model's melee threat zone
   */
  isInAnyThreatZone(position: Position, weaponReach = 0): { modelId: string; distance: number } | null {
    const models = this.registry.getAllModels();

    for (const model of models) {
      if (MeasurementUtils.isInThreatZone(model, position, weaponReach)) {
        return {
          modelId: model.id,
          distance: MeasurementUtils.edgeToEdge(
            model,
            { id: 'temp', position, baseDiameter: 0 }
          ),
        };
      }
    }

    return null;
  }

  /**
   * Get models that would be engaged if a model moves to a position
   */
  getPotentialEngagements(modelId: string, newPosition: Position): string[] {
    const model = this.registry.getModel(modelId);
    if (!model) return [];

    const engaged: string[] = [];
    const allModels = this.registry.getAllModels();

    // Create a temporary model at the new position
    const tempModel: SpatialModel = {
      ...model,
      position: newPosition,
    };

    for (const other of allModels) {
      if (other.id === modelId) continue;
      if (MeasurementUtils.isBaseContact(tempModel, other)) {
        engaged.push(other.id);
      }
    }

    return engaged;
  }

  /**
   * Check if a move would break engagement
   */
  wouldBreakEngagement(modelId: string, newPosition: Position): boolean {
    const currentEngaged = this.getEngagedModels(modelId);
    if (currentEngaged.length === 0) return false;

    const potentialEngaged = this.getPotentialEngagements(modelId, newPosition);

    // If any currently engaged model won't be engaged after the move
    for (const engagedId of currentEngaged) {
      if (!potentialEngaged.includes(engagedId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a move is a disengage move (moving away from all engaged models)
   */
  isDisengageMove(modelId: string, newPosition: Position): boolean {
    const currentEngaged = this.getEngagedModels(modelId);
    if (currentEngaged.length === 0) return false;

    const potentialEngaged = this.getPotentialEngagements(modelId, newPosition);

    // Disengage if no longer engaged with any previously engaged model
    return potentialEngaged.length === 0;
  }
}

/**
 * Helper function to create engagement manager from character data
 */
export function createEngagementManager(
  characters: Character[],
  positions: Map<string, Position>
): EngagementManager {
  const registry = new ModelRegistry();

  for (const character of characters) {
    const position = positions.get(character.id);
    if (position) {
      registry.register(character, position);
    }
  }

  return new EngagementManager(registry);
}
