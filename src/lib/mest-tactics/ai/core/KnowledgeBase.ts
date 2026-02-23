/**
 * Knowledge Base System
 * 
 * Manages character knowledge about the battlefield.
 * Supports both god-mode (perfect knowledge) and fog-of-war.
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import {
  CharacterKnowledge,
  EnemyInfo,
  TerrainInfo,
  ThreatZone,
  AIContext,
} from './AIController';

/**
 * Knowledge Base configuration
 */
export interface KnowledgeConfig {
  /** God mode - see everything */
  godMode: boolean;
  /** Memory duration (turns to remember unseen enemies) */
  memoryDuration: number;
  /** Vision range multiplier */
  visionRange: number;
}

/**
 * Default knowledge configuration
 */
export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  godMode: true,
  memoryDuration: 3,
  visionRange: 1.0,
};

/**
 * Knowledge Base class
 */
export class KnowledgeBase {
  config: KnowledgeConfig;
  private knowledge: Map<string, CharacterKnowledge> = new Map();

  constructor(config: Partial<KnowledgeConfig> = {}) {
    this.config = { ...DEFAULT_KNOWLEDGE_CONFIG, ...config };
  }

  /**
   * Get or create knowledge for a character
   */
  getKnowledge(characterId: string): CharacterKnowledge {
    let knowledge = this.knowledge.get(characterId);
    if (!knowledge) {
      knowledge = {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: 0,
      };
      this.knowledge.set(characterId, knowledge);
    }
    return knowledge;
  }

  /**
   * Update knowledge for a character based on current battlefield state
   */
  updateKnowledge(
    character: Character,
    allies: Character[],
    enemies: Character[],
    battlefield: Battlefield,
    currentTurn: number
  ): CharacterKnowledge {
    const knowledge = this.getKnowledge(character.id);
    knowledge.lastUpdated = currentTurn;

    if (this.config.godMode) {
      this.updateGodModeKnowledge(knowledge, enemies, currentTurn);
    } else {
      this.updateFogOfWarKnowledge(
        knowledge,
        character,
        allies,
        enemies,
        battlefield,
        currentTurn
      );
    }

    this.updateThreatZones(knowledge, enemies, battlefield);
    this.updateSafeZones(knowledge, character, battlefield);

    return knowledge;
  }

  /**
   * Update knowledge with god-mode (perfect information)
   */
  private updateGodModeKnowledge(
    knowledge: CharacterKnowledge,
    enemies: Character[],
    currentTurn: number
  ): void {
    knowledge.knownEnemies.clear();

    for (const enemy of enemies) {
      const enemyInfo: EnemyInfo = {
        characterId: enemy.id,
        position: { x: 0, y: 0 }, // Will be updated
        wounds: enemy.state.wounds,
        isKOd: enemy.state.isKOd,
        isEliminated: enemy.state.isEliminated,
        isHidden: enemy.state.isHidden,
        lastSeenTurn: currentTurn,
        threatLevel: this.calculateThreatLevel(enemy),
      };
      knowledge.knownEnemies.set(enemy.id, enemyInfo);
    }
  }

  /**
   * Update knowledge with fog-of-war (limited visibility)
   * TODO: Implement full fog-of-war system
   */
  private updateFogOfWarKnowledge(
    knowledge: CharacterKnowledge,
    character: Character,
    allies: Character[],
    enemies: Character[],
    battlefield: Battlefield,
    currentTurn: number
  ): void {
    const characterPos = battlefield.getCharacterPosition(character);
    if (!characterPos) return;

    const visibilityRange = 16 * this.config.visionRange;

    // Update known enemies based on LOS
    for (const enemy of enemies) {
      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const distance = Math.sqrt(
        Math.pow(characterPos.x - enemyPos.x, 2) +
        Math.pow(characterPos.y - enemyPos.y, 2)
      );

      // Check if within range and has LOS
      if (distance <= visibilityRange) {
        const characterModel = {
          id: character.id,
          position: characterPos,
          baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? 3),
          siz: character.finalAttributes.siz ?? 3,
        };
        const enemyModel = {
          id: enemy.id,
          position: enemyPos,
          baseDiameter: getBaseDiameterFromSiz(enemy.finalAttributes.siz ?? 3),
          siz: enemy.finalAttributes.siz ?? 3,
        };

        const hasLOS = SpatialRules.hasLineOfSight(battlefield, characterModel, enemyModel);

        if (hasLOS || enemy.state.isHidden) {
          const enemyInfo: EnemyInfo = {
            characterId: enemy.id,
            position: { ...enemyPos },
            wounds: enemy.state.wounds,
            isKOd: enemy.state.isKOd,
            isEliminated: enemy.state.isEliminated,
            isHidden: enemy.state.isHidden,
            lastSeenTurn: currentTurn,
            threatLevel: this.calculateThreatLevel(enemy),
          };
          knowledge.knownEnemies.set(enemy.id, enemyInfo);
        }
      }
    }

    // Remove stale knowledge
    this.removeStaleKnowledge(knowledge, currentTurn);
  }

  /**
   * Remove knowledge that's too old
   */
  private removeStaleKnowledge(
    knowledge: CharacterKnowledge,
    currentTurn: number
  ): void {
    const staleThreshold = currentTurn - this.config.memoryDuration;

    for (const [id, info] of knowledge.knownEnemies.entries()) {
      if (info.lastSeenTurn < staleThreshold) {
        knowledge.knownEnemies.delete(id);
      }
    }
  }

  /**
   * Update threat zones (areas under enemy fire)
   */
  private updateThreatZones(
    knowledge: CharacterKnowledge,
    enemies: Character[],
    battlefield: Battlefield
  ): void {
    knowledge.threatZones = [];

    for (const enemy of enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;

      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      // Add threat zone for ranged attackers
      if (enemy.finalAttributes.rca >= 2) {
        knowledge.threatZones.push({
          position: { ...enemyPos },
          radius: 16,
          sourceCharacterId: enemy.id,
          threatType: 'ranged',
        });
      }

      // Add threat zone for melee attackers
      if (enemy.finalAttributes.cca >= 2) {
        knowledge.threatZones.push({
          position: { ...enemyPos },
          radius: 2,
          sourceCharacterId: enemy.id,
          threatType: 'melee',
        });
      }
    }
  }

  /**
   * Update safe zones (cover positions)
   */
  private updateSafeZones(
    knowledge: CharacterKnowledge,
    character: Character,
    battlefield: Battlefield
  ): void {
    knowledge.safeZones = [];

    const characterPos = battlefield.getCharacterPosition(character);
    if (!characterPos) return;

    // Sample positions and check for cover
    const sampleRadius = 12;
    for (let x = -sampleRadius; x <= sampleRadius; x += 4) {
      for (let y = -sampleRadius; y <= sampleRadius; y += 4) {
        const pos = {
          x: characterPos.x + x,
          y: characterPos.y + y,
        };

        // Check if position is valid (within bounds)
        if (pos.x >= 0 && pos.x < battlefield.width && pos.y >= 0 && pos.y < battlefield.height) {
          // TODO: Check for actual cover terrain
          knowledge.safeZones.push(pos);
        }
      }
    }
  }

  /**
   * Calculate threat level for an enemy
   */
  private calculateThreatLevel(enemy: Character): number {
    let threat = 0;

    // Attribute-based threat
    threat += enemy.finalAttributes.cca ?? 0;
    threat += enemy.finalAttributes.rca ?? 0;

    // Wound-based threat reduction
    const siz = enemy.finalAttributes.siz ?? 3;
    const healthRatio = 1 - (enemy.state.wounds / siz);
    threat *= healthRatio;

    // Status-based threat
    if (enemy.state.isKOd) threat = 0;
    if (enemy.state.isHidden) threat *= 0.5; // Can't target what you can't see

    return threat;
  }

  /**
   * Check if an enemy position is known
   */
  isEnemyKnown(characterId: string, enemyId: string): boolean {
    const knowledge = this.getKnowledge(characterId);
    return knowledge.knownEnemies.has(enemyId);
  }

  /**
   * Get known enemy info
   */
  getKnownEnemy(characterId: string, enemyId: string): EnemyInfo | undefined {
    const knowledge = this.getKnowledge(characterId);
    return knowledge.knownEnemies.get(enemyId);
  }

  /**
   * Get all known enemies
   */
  getKnownEnemies(characterId: string): EnemyInfo[] {
    const knowledge = this.getKnowledge(characterId);
    return Array.from(knowledge.knownEnemies.values());
  }

  /**
   * Get last known position of an enemy
   */
  getLastKnownPosition(characterId: string, enemyId: string): Position | undefined {
    const knowledge = this.getKnowledge(characterId);
    const info = knowledge.knownEnemies.get(enemyId);
    return info?.position;
  }

  /**
   * Check if a position is in a threat zone
   */
  isInThreatZone(position: Position, characterId: string): boolean {
    const knowledge = this.getKnowledge(characterId);
    for (const zone of knowledge.threatZones) {
      const dist = Math.sqrt(
        Math.pow(position.x - zone.position.x, 2) +
        Math.pow(position.y - zone.position.y, 2)
      );
      if (dist <= zone.radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get nearest safe zone
   */
  getNearestSafeZone(position: Position, characterId: string): Position | undefined {
    const knowledge = this.getKnowledge(characterId);
    if (knowledge.safeZones.length === 0) return undefined;

    let nearest: Position | undefined;
    let nearestDist = Infinity;

    for (const safePos of knowledge.safeZones) {
      const dist = Math.sqrt(
        Math.pow(position.x - safePos.x, 2) +
        Math.pow(position.y - safePos.y, 2)
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = safePos;
      }
    }

    return nearest;
  }

  /**
   * Clear knowledge for a character
   */
  clearKnowledge(characterId: string): void {
    this.knowledge.delete(characterId);
  }

  /**
   * Clear all knowledge
   */
  clearAllKnowledge(): void {
    this.knowledge.clear();
  }
}
