/**
 * AssemblyAI - Tactical Coordination Layer
 * 
 * Responsible for squad-level coordination:
 * - Target assignment across characters in assembly
 * - Formation management
 * - Flanking coordination
 * - Focus fire coordination
 * 
 * Phase 3: Strategic Layer
 */

import { Assembly } from '../../core/Assembly';
import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { ActionDecision } from '../core/AIController';
import { MissionSide } from '../../mission/MissionSide';

/**
 * Formation type for squad movement
 */
export enum FormationType {
  /** Linear formation - models spread in a line */
  Line = 'line',
  /** Cluster formation - models grouped tightly */
  Cluster = 'cluster',
  /** Flanking formation - models spread to flank */
  Flank = 'flank',
  /** Column formation - models in a line for movement */
  Column = 'column',
}

/**
 * Role assignment for a character in the assembly
 */
export enum CharacterRole {
  /** Front-line fighter, engages enemy directly */
  Vanguard = 'vanguard',
  /** Ranged support, stays behind front line */
  Support = 'support',
  /** Flanker, moves to enemy sides/rear */
  Flanker = 'flanker',
  /** Protector, stays near VIP/important models */
  Protector = 'protector',
  /** Scout, moves ahead to detect/recon */
  Scout = 'scout',
}

/**
 * Target assignment for coordination
 */
export interface TargetAssignment {
  /** Target character */
  target: Character;
  /** Assigned attackers from this assembly */
  attackers: string[]; // Character IDs
  /** Priority score */
  priority: number;
  /** Attack type recommendation */
  recommendedAttack: 'melee' | 'ranged' | 'mixed';
}

/**
 * Formation state
 */
export interface FormationState {
  /** Current formation type */
  type: FormationType;
  /** Models in formation */
  members: string[]; // Character IDs
  /** Formation center position */
  center?: Position;
  /** Formation spread (MU) */
  spread: number;
}

/**
 * AssemblyAI configuration
 */
export interface AssemblyAIConfig {
  /** Preferred formation type */
  preferredFormation: FormationType;
  /** Whether to coordinate focus fire */
  coordinateFocusFire: boolean;
  /** Whether to attempt flanking maneuvers */
  attemptFlanking: boolean;
  /** Minimum models for flanking group */
  minFlankers: number;
  /** Cohesion range (MU) */
  cohesionRange: number;
}

/**
 * Default AssemblyAI configuration
 */
export const DEFAULT_ASSEMBLY_AI_CONFIG: AssemblyAIConfig = {
  preferredFormation: FormationType.Cluster,
  coordinateFocusFire: true,
  attemptFlanking: true,
  minFlankers: 2,
  cohesionRange: 8,
};

/**
 * AssemblyAI Controller
 */
export class AssemblyAI {
  config: AssemblyAIConfig;
  private assembly: Assembly;
  private side?: MissionSide;
  private battlefield: Battlefield;

  constructor(
    assembly: Assembly,
    battlefield: Battlefield,
    side?: MissionSide,
    config: Partial<AssemblyAIConfig> = {}
  ) {
    this.assembly = assembly;
    this.battlefield = battlefield;
    this.side = side;
    this.config = { ...DEFAULT_ASSEMBLY_AI_CONFIG, ...config };
  }

  /**
   * Get characters in this assembly that are still active
   */
  getActiveCharacters(): Character[] {
    if (!this.side) return [];

    return this.side.members
      .filter(m => 
        m.assembly === this.assembly &&
        m.status !== 'Eliminated' &&
        m.status !== 'KO'
      )
      .map(m => m.character);
  }

  /**
   * Assign roles to characters based on their capabilities
   */
  assignRoles(characters: Character[]): Map<string, CharacterRole> {
    const roles = new Map<string, CharacterRole>();

    for (const character of characters) {
      const role = this.determineCharacterRole(character);
      roles.set(character.id, role);
    }

    return roles;
  }

  /**
   * Coordinate target assignments for focus fire
   */
  coordinateTargets(
    characters: Character[],
    enemies: Character[]
  ): TargetAssignment[] {
    if (!this.config.coordinateFocusFire || enemies.length === 0) {
      return [];
    }

    const assignments: TargetAssignment[] = [];
    const assignedAttackers = new Set<string>();

    // Prioritize wounded enemies
    const sortedEnemies = [...enemies].sort((a, b) => {
      const aWoundRatio = a.state.wounds / (a.finalAttributes.siz ?? 3);
      const bWoundRatio = b.state.wounds / (b.finalAttributes.siz ?? 3);
      return bWoundRatio - aWoundRatio;
    });

    for (const enemy of sortedEnemies) {
      if (assignedAttackers.size >= characters.length) break;

      // Determine how many attackers to assign
      const attackersNeeded = this.calculateAttackersNeeded(enemy, characters);
      const attackers: string[] = [];

      // Select attackers based on role and position
      for (const character of characters) {
        if (attackers.length >= attackersNeeded) break;
        if (assignedAttackers.has(character.id)) continue;

        // Prefer characters in good position to attack
        const canAttack = this.canEffectivelyAttack(character, enemy);
        if (canAttack) {
          attackers.push(character.id);
          assignedAttackers.add(character.id);
        }
      }

      if (attackers.length > 0) {
        assignments.push({
          target: enemy,
          attackers,
          priority: this.calculateTargetPriority(enemy),
          recommendedAttack: this.recommendAttackType(attackers.length, enemy),
        });
      }
    }

    return assignments;
  }

  /**
   * Get formation state for the assembly
   */
  getFormationState(characters: Character[]): FormationState {
    const positions = characters
      .map(c => this.battlefield.getCharacterPosition(c))
      .filter((p): p is Position => p !== undefined);

    if (positions.length === 0) {
      return {
        type: this.config.preferredFormation,
        members: characters.map(c => c.id),
        spread: 0,
      };
    }

    // Calculate center
    const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
    const center: Position = { x: centerX, y: centerY };

    // Calculate spread (average distance from center)
    const distances = positions.map(p => 
      Math.hypot(p.x - center.x, p.y - center.y)
    );
    const spread = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    // Determine current formation type based on spread
    let type = this.config.preferredFormation;
    if (spread < 2) {
      type = FormationType.Cluster;
    } else if (spread > 6) {
      type = FormationType.Flank;
    }

    return {
      type,
      members: characters.map(c => c.id),
      center,
      spread,
    };
  }

  /**
   * Generate coordinated action decisions for assembly members
   */
  generateCoordinatedActions(
    characters: Character[],
    enemies: Character[],
    targetAssignments: TargetAssignment[]
  ): Map<string, ActionDecision> {
    const decisions = new Map<string, ActionDecision>();

    for (const assignment of targetAssignments) {
      for (const attackerId of assignment.attackers) {
        const attacker = characters.find(c => c.id === attackerId);
        if (!attacker) continue;

        // Determine best attack type
        const inMeleeRange = this.isInMeleeRange(attacker, assignment.target);
        
        decisions.set(attackerId, {
          type: inMeleeRange ? 'close_combat' : 'ranged_combat',
          target: assignment.target,
          reason: `Focus fire (priority: ${assignment.priority})`,
          priority: assignment.priority,
          requiresAP: true,
        });
      }
    }

    // Assign actions to unassigned characters
    for (const character of characters) {
      if (decisions.has(character.id)) continue;

      // Find nearest enemy
      const nearestEnemy = this.findNearestEnemy(character, enemies);
      if (nearestEnemy) {
        const inMeleeRange = this.isInMeleeRange(character, nearestEnemy);
        
        decisions.set(character.id, {
          type: inMeleeRange ? 'close_combat' : 'ranged_combat',
          target: nearestEnemy,
          reason: 'Engage nearest enemy',
          priority: 2,
          requiresAP: true,
        });
      } else {
        // No enemies visible, hold position
        decisions.set(character.id, {
          type: 'hold',
          reason: 'No valid targets',
          priority: 0,
          requiresAP: false,
        });
      }
    }

    return decisions;
  }

  /**
   * Check if assembly is maintaining cohesion
   */
  isMaintainingCohesion(characters: Character[]): boolean {
    if (characters.length <= 1) return true;

    const positions = characters
      .map(c => this.battlefield.getCharacterPosition(c))
      .filter((p): p is Position => p !== undefined);

    if (positions.length !== characters.length) return false;

    // Check if all models are within cohesion range of at least one other
    for (let i = 0; i < positions.length; i++) {
      let hasNearbyAlly = false;
      
      for (let j = 0; j < positions.length; j++) {
        if (i === j) continue;
        
        const dist = Math.hypot(
          positions[i].x - positions[j].x,
          positions[i].y - positions[j].y
        );
        
        if (dist <= this.config.cohesionRange) {
          hasNearbyAlly = true;
          break;
        }
      }
      
      if (!hasNearbyAlly) return false;
    }

    return true;
  }

  /**
   * Get flanking opportunities
   */
  identifyFlankingOpportunities(
    characters: Character[],
    enemies: Character[]
  ): { flanker: Character; target: Character; approachPosition: Position }[] {
    if (!this.config.attemptFlanking) return [];

    const opportunities: { flanker: Character; target: Character; approachPosition: Position }[] = [];
    const flankers = characters.filter(c => {
      const role = this.determineCharacterRole(c);
      return role === CharacterRole.Flanker;
    });

    if (flankers.length < this.config.minFlankers) return [];

    for (const enemy of enemies) {
      const enemyPos = this.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      // Check if enemy is engaged with any friendly
      const isEngaged = characters.some(c => 
        this.battlefield.isEngaged?.(c)
      );

      if (isEngaged) {
        // Find good flanking positions
        for (const flanker of flankers) {
          const flankerPos = this.battlefield.getCharacterPosition(flanker);
          if (!flankerPos) continue;

          // Calculate position behind enemy (relative to engaged friendlies)
          const approachPos = this.calculateFlankPosition(enemyPos, flankerPos);
          
          opportunities.push({
            flanker,
            target: enemy,
            approachPosition: approachPos,
          });
        }
      }
    }

    return opportunities;
  }

  /**
   * Determine character role based on attributes and equipment
   */
  private determineCharacterRole(character: Character): CharacterRole {
    const cca = character.finalAttributes.cca ?? 2;
    const rca = character.finalAttributes.rca ?? 2;
    const ref = character.finalAttributes.ref ?? 2;
    const mov = character.finalAttributes.mov ?? 2;

    // High MOV + low CCA = Scout/Flanker
    if (mov >= 4 && ref >= 3) {
      return CharacterRole.Scout;
    }

    // High RCA = Support
    if (rca >= 3 && cca < 3) {
      return CharacterRole.Support;
    }

    // High CCA = Vanguard
    if (cca >= 3) {
      return CharacterRole.Vanguard;
    }

    // Balanced or low stats = default to Vanguard
    return CharacterRole.Vanguard;
  }

  /**
   * Calculate how many attackers needed for a target
   */
  private calculateAttackersNeeded(target: Character, attackers: Character[]): number {
    const targetHealth = target.finalAttributes.siz ?? 3;
    const targetWounds = target.state.wounds;
    const remainingHealth = targetHealth - targetWounds;

    // Estimate damage per attacker (simplified)
    const avgDamage = 1.5; // Average wounds per successful attack
    
    // Add one extra attacker for safety
    return Math.min(
      Math.ceil(remainingHealth / avgDamage) + 1,
      attackers.length
    );
  }

  /**
   * Check if character can effectively attack target
   */
  private canEffectivelyAttack(attacker: Character, target: Character): boolean {
    const attackerPos = this.battlefield.getCharacterPosition(attacker);
    const targetPos = this.battlefield.getCharacterPosition(target);

    if (!attackerPos || !targetPos) return false;

    // Check range for ranged attacks
    const distance = Math.hypot(targetPos.x - attackerPos.x, targetPos.y - attackerPos.y);
    
    // Can always attack in melee if engaged
    if (this.battlefield.isEngaged?.(attacker)) return true;

    // For ranged, check if in reasonable range (simplified OR check)
    const rca = attacker.finalAttributes.rca ?? 2;
    const effectiveRange = 8 + (rca * 2); // Simplified OR calculation

    return distance <= effectiveRange;
  }

  /**
   * Calculate target priority score
   */
  private calculateTargetPriority(target: Character): number {
    let priority = 0;

    // Wounded targets are higher priority
    const woundRatio = target.state.wounds / (target.finalAttributes.siz ?? 3);
    priority += woundRatio * 5;

    // High attribute targets are dangerous
    const cca = target.finalAttributes.cca ?? 2;
    const rca = target.finalAttributes.rca ?? 2;
    priority += (cca + rca) * 0.5;

    return priority;
  }

  /**
   * Recommend attack type based on situation
   */
  private recommendAttackType(attackerCount: number, target: Character): 'melee' | 'ranged' | 'mixed' {
    if (attackerCount === 1) {
      // Single attacker - use whatever is available
      return 'mixed';
    }

    // Multiple attackers - prefer melee for focus fire
    if (attackerCount >= 2) {
      return 'melee';
    }

    return 'ranged';
  }

  /**
   * Check if character is in melee range of target
   */
  private isInMeleeRange(character: Character, target: Character): boolean {
    return this.battlefield.isEngaged?.(character) ?? false;
  }

  /**
   * Find nearest enemy to character
   */
  private findNearestEnemy(character: Character, enemies: Character[]): Character | null {
    const charPos = this.battlefield.getCharacterPosition(character);
    if (!charPos) return null;

    let nearest: Character | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      const enemyPos = this.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const dist = Math.hypot(enemyPos.x - charPos.x, enemyPos.y - charPos.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  /**
   * Calculate flanking position behind enemy
   */
  private calculateFlankPosition(
    enemyPos: Position,
    flankerPos: Position
  ): Position {
    // Calculate vector from enemy to flanker
    const dx = flankerPos.x - enemyPos.x;
    const dy = flankerPos.y - enemyPos.y;

    // Flank position is on the opposite side
    const flankDistance = 2; // 2 MU behind enemy
    const angle = Math.atan2(dy, dx);
    const oppositeAngle = angle + Math.PI;

    return {
      x: enemyPos.x + Math.cos(oppositeAngle) * flankDistance,
      y: enemyPos.y + Math.sin(oppositeAngle) * flankDistance,
    };
  }
}

/**
 * Create AssemblyAI for an assembly
 */
export function createAssemblyAI(
  assembly: Assembly,
  battlefield: Battlefield,
  side?: MissionSide,
  config?: Partial<AssemblyAIConfig>
): AssemblyAI {
  return new AssemblyAI(assembly, battlefield, side, config);
}

/**
 * Create AssemblyAI for all assemblies in a side
 */
export function createSideAssemblyAIs(
  side: MissionSide,
  battlefield: Battlefield,
  config?: Partial<AssemblyAIConfig>
): Map<string, AssemblyAI> {
  const ais = new Map<string, AssemblyAI>();

  for (const assembly of side.assemblies) {
    ais.set(assembly.name, createAssemblyAI(assembly, battlefield, side, config));
  }

  return ais;
}
