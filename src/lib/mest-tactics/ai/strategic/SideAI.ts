/**
 * SideAI - Strategic Layer AI Controller
 * 
 * Responsible for mission-level coordination:
 * - Victory condition tracking and evaluation
 * - Resource allocation across assemblies
 * - High-level strategy selection
 * - Assembly prioritization and task assignment
 * 
 * Phase 3: Strategic Layer
 */

import { MissionSide } from '../mission/MissionSide';
import { Battlefield } from '../battlefield/Battlefield';
import { Character } from '../core/Character';
import { Assembly } from '../core/Assembly';
import { ActionDecision, AIControllerConfig } from '../core/AIController';

/**
 * Strategic posture for a side
 */
export enum StrategicPosture {
  /** All-out attack, prioritize enemy elimination */
  Aggressive = 'aggressive',
  /** Balanced approach, adapt to situation */
  Balanced = 'balanced',
  /** Defensive, preserve models, hold objectives */
  Defensive = 'defensive',
  /** Stealth-focused, use Hide/Detect tactics */
  Stealth = 'stealth',
}

/**
 * Priority target information
 */
export interface PriorityTarget {
  /** Target character */
  character: Character;
  /** Priority score (higher = more important) */
  priority: number;
  /** Reason for prioritization */
  reason: string;
  /** Assigned attackers (for coordination) */
  assignedAttackers: string[];
}

/**
 * Strategic objective for the side
 */
export interface StrategicObjective {
  /** Objective identifier */
  id: string;
  /** Objective type */
  type: StrategicObjectiveType;
  /** Priority (higher = more important) */
  priority: number;
  /** Target character or position */
  target?: Character | { x: number; y: number };
  /** Assigned assembly/characters */
  assignedUnits: string[];
  /** Completion status */
  isComplete: boolean;
}

export type StrategicObjectiveType =
  | 'eliminate_target'
  | 'hold_position'
  | 'capture_objective'
  | 'protect_vip'
  | 'flank_enemy'
  | 'regroup'
  | 'escape';

/**
 * SideAI configuration
 */
export interface SideAIConfig {
  /** Base aggression 0-1 */
  aggression: number;
  /** Base caution 0-1 */
  caution: number;
  /** Strategic posture */
  posture: StrategicPosture;
  /** Whether to coordinate attacks (focus fire) */
  coordinateAttacks: boolean;
  /** Whether to prioritize VIP protection */
  protectVIP: boolean;
  /** Minimum models to keep in reserve */
  reserveModels: number;
}

/**
 * Default SideAI configuration
 */
export const DEFAULT_SIDE_AI_CONFIG: SideAIConfig = {
  aggression: 0.5,
  caution: 0.5,
  posture: StrategicPosture.Balanced,
  coordinateAttacks: true,
  protectVIP: true,
  reserveModels: 1,
};

/**
 * Strategic assessment of the battlefield
 */
export interface StrategicAssessment {
  /** Current strategic posture recommendation */
  recommendedPosture: StrategicPosture;
  /** Priority targets identified */
  priorityTargets: PriorityTarget[];
  /** Strategic objectives */
  objectives: StrategicObjective[];
  /** Force ratio (friendly/enemy models) */
  forceRatio: number;
  /** BP ratio (friendly/enemy BP) */
  BPRatio: number;
  /** Whether side has advantage */
  hasAdvantage: boolean;
  /** Threat level (0-1) */
  threatLevel: number;
  /** Recommended actions */
  recommendations: string[];
}

/**
 * SideAI Controller
 */
export class SideAI {
  config: SideAIConfig;
  private side: MissionSide;
  private battlefield: Battlefield;
  private enemySide?: MissionSide;

  constructor(
    side: MissionSide,
    battlefield: Battlefield,
    enemySide?: MissionSide,
    config: Partial<SideAIConfig> = {}
  ) {
    this.side = side;
    this.battlefield = battlefield;
    this.enemySide = enemySide;
    this.config = { ...DEFAULT_SIDE_AI_CONFIG, ...config };
  }

  /**
   * Update battlefield reference
   */
  setBattlefield(battlefield: Battlefield): void {
    this.battlefield = battlefield;
  }

  /**
   * Set enemy side for assessment
   */
  setEnemySide(enemySide: MissionSide): void {
    this.enemySide = enemySide;
  }

  /**
   * Get strategic assessment of current situation
   */
  assessSituation(): StrategicAssessment {
    const friendlyModels = this.getActiveModels();
    const enemyModels = this.getEnemyActiveModels();

    const friendlyCount = friendlyModels.length;
    const enemyCount = enemyModels.length;

    const forceRatio = enemyCount > 0 ? friendlyCount / enemyCount : friendlyCount;
    const BPRatio = this.calculateBPRatio();

    const threatLevel = this.calculateThreatLevel(friendlyModels, enemyModels);
    const hasAdvantage = forceRatio > 1.2 || BPRatio > 1.2;

    const recommendedPosture = this.determineRecommendedPosture(
      forceRatio,
      threatLevel,
      hasAdvantage
    );

    const priorityTargets = this.identifyPriorityTargets(enemyModels);
    const objectives = this.generateStrategicObjectives(friendlyModels, priorityTargets);
    const recommendations = this.generateRecommendations(
      recommendedPosture,
      objectives,
      threatLevel
    );

    return {
      recommendedPosture,
      priorityTargets,
      objectives,
      forceRatio,
      BPRatio,
      hasAdvantage,
      threatLevel,
      recommendations,
    };
  }

  /**
   * Get high-level action priorities for all characters
   */
  getActionPriorities(assessment: StrategicAssessment): Map<string, ActionDecision> {
    const priorities = new Map<string, ActionDecision>();

    // Assign targets based on priority
    if (this.config.coordinateAttacks && assessment.priorityTargets.length > 0) {
      this.assignTargetsToUnits(assessment.priorityTargets, priorities);
    }

    // Assign strategic objectives
    for (const objective of assessment.objectives) {
      if (!objective.isComplete && objective.assignedUnits.length > 0) {
        this.assignObjectiveToUnits(objective, priorities);
      }
    }

    return priorities;
  }

  /**
   * Evaluate victory conditions
   */
  evaluateVictoryConditions(): {
    canWin: boolean;
    canLose: boolean;
    victoryProbability: number;
    defeatProbability: number;
  } {
    const friendlyModels = this.getActiveModels();
    const enemyModels = this.getEnemyActiveModels();

    // Simple elimination victory check
    const canWin = enemyModels.length === 0;
    const canLose = friendlyModels.length === 0;

    // Estimate probabilities based on force ratio
    const forceRatio = enemyModels.length > 0 
      ? friendlyModels.length / enemyModels.length 
      : friendlyModels.length;

    const victoryProbability = Math.min(1.0, forceRatio / 2);
    const defeatProbability = 1.0 - victoryProbability;

    return {
      canWin,
      canLose,
      victoryProbability,
      defeatProbability,
    };
  }

  /**
   * Allocate resources (abstract - for future expansion)
   */
  allocateResources(): {
    assemblyPriorities: Map<string, number>;
    targetPriorities: Map<string, number>;
  } {
    const assemblyPriorities = new Map<string, number>();
    const targetPriorities = new Map<string, number>();

    // Prioritize assemblies based on remaining strength
    for (const assembly of this.side.assemblies) {
      const activeCount = this.side.members.filter(
        m => m.assembly === assembly && 
             m.status !== 'Eliminated' && 
             m.status !== 'KO'
      ).length;
      
      // Higher priority for stronger assemblies
      assemblyPriorities.set(assembly.name, activeCount);
    }

    // Prioritize enemy targets
    const enemyModels = this.getEnemyActiveModels();
    for (const enemy of enemyModels) {
      // Priority based on threat (simplified - use wounds as proxy)
      const threat = 1.0 - (enemy.state.wounds / (enemy.finalAttributes.siz ?? 3));
      targetPriorities.set(enemy.id, threat);
    }

    return { assemblyPriorities, targetPriorities };
  }

  /**
   * Get active models on this side
   */
  private getActiveModels(): Character[] {
    return this.side.members
      .filter(m => m.status !== 'Eliminated' && m.status !== 'KO')
      .map(m => m.character);
  }

  /**
   * Get active enemy models
   */
  private getEnemyActiveModels(): Character[] {
    if (!this.enemySide) return [];
    
    return this.enemySide.members
      .filter(m => m.status !== 'Eliminated' && m.status !== 'KO')
      .map(m => m.character);
  }

  /**
   * Calculate BP ratio
   */
  private calculateBPRatio(): number {
    if (!this.enemySide) return this.side.totalBP > 0 ? 1.0 : 0;
    
    const enemyBP = this.enemySide.totalBP;
    if (enemyBP === 0) return this.side.totalBP > 0 ? 1.0 : 0;
    
    return this.side.totalBP / enemyBP;
  }

  /**
   * Calculate threat level based on enemy positions and capabilities
   */
  private calculateThreatLevel(friendly: Character[], enemy: Character[]): number {
    if (enemy.length === 0) return 0;
    if (friendly.length === 0) return 1;

    let totalThreat = 0;

    for (const enemyChar of enemy) {
      // Base threat from attributes
      const cca = enemyChar.finalAttributes.cca ?? 2;
      const rca = enemyChar.finalAttributes.rca ?? 2;
      const baseThreat = (cca + rca) / 6; // Normalize to ~0-1

      // Increase threat if engaged with friendly
      const isEngaged = friendly.some(f => 
        this.battlefield.isEngaged?.(f)
      );

      totalThreat += baseThreat * (isEngaged ? 1.5 : 1);
    }

    return Math.min(1.0, totalThreat / Math.max(friendly.length, 1));
  }

  /**
   * Determine recommended strategic posture
   */
  private determineRecommendedPosture(
    forceRatio: number,
    threatLevel: number,
    hasAdvantage: boolean
  ): StrategicPosture {
    // If heavily outnumbered, be defensive
    if (forceRatio < 0.7) {
      return StrategicPosture.Defensive;
    }

    // If have significant advantage, be aggressive
    if (forceRatio > 1.5 && threatLevel < 0.5) {
      return StrategicPosture.Aggressive;
    }

    // If threat is high but forces are equal, consider stealth
    if (threatLevel > 0.7 && forceRatio >= 0.8 && forceRatio <= 1.2) {
      return StrategicPosture.Stealth;
    }

    // Default to configured posture or balanced
    return this.config.posture;
  }

  /**
   * Identify priority targets among enemy forces
   */
  private identifyPriorityTargets(enemies: Character[]): PriorityTarget[] {
    const targets: PriorityTarget[] = [];

    for (const enemy of enemies) {
      let priority = 0;
      const reasons: string[] = [];

      // Wounded targets are higher priority (finish them off)
      const woundRatio = enemy.state.wounds / (enemy.finalAttributes.siz ?? 3);
      if (woundRatio > 0.5) {
        priority += 3;
        reasons.push('wounded');
      }

      // High CCA/RCA targets are dangerous
      const cca = enemy.finalAttributes.cca ?? 2;
      const rca = enemy.finalAttributes.rca ?? 2;
      if (cca >= 3 || rca >= 3) {
        priority += 2;
        reasons.push('high combat ability');
      }

      // VIP targets (if identifiable)
      // TODO: Check for VIP status when that system is integrated

      // Isolated targets (easier to eliminate)
      const isEngaged = this.battlefield.isEngaged?.(enemy);
      if (!isEngaged) {
        priority += 1;
        reasons.push('isolated');
      }

      targets.push({
        character: enemy,
        priority,
        reason: reasons.join(', '),
        assignedAttackers: [],
      });
    }

    // Sort by priority descending
    return targets.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate strategic objectives based on assessment
   */
  private generateStrategicObjectives(
    friendly: Character[],
    priorityTargets: PriorityTarget[]
  ): StrategicObjective[] {
    const objectives: StrategicObjective[] = [];

    // Elimination objective
    if (priorityTargets.length > 0) {
      objectives.push({
        id: 'eliminate-priority',
        type: 'eliminate_target',
        priority: 5,
        target: priorityTargets[0]?.character,
        assignedUnits: [],
        isComplete: false,
      });
    }

    // VIP protection (if applicable)
    if (this.config.protectVIP) {
      const vipMembers = this.side.members.filter(m => m.isVIP);
      for (const vip of vipMembers) {
        objectives.push({
          id: `protect-vip-${vip.id}`,
          type: 'protect_vip',
          priority: 8,
          target: vip.character,
          assignedUnits: [],
          isComplete: false,
        });
      }
    }

    // Regroup if scattered
    const scatteredCount = this.countScatteredModels(friendly);
    if (scatteredCount > friendly.length * 0.5) {
      objectives.push({
        id: 'regroup',
        type: 'regroup',
        priority: 6,
        assignedUnits: [],
        isComplete: false,
      });
    }

    return objectives;
  }

  /**
   * Count models that are scattered (not in cohesion)
   */
  private countScatteredModels(models: Character[]): number {
    // Simplified: count models not in base-contact with any friendly
    let scattered = 0;
    
    for (const model of models) {
      const isAlone = !models.some(other => 
        other !== model && 
        this.battlefield.isEngaged?.(model)
      );
      
      if (isAlone) {
        scattered++;
      }
    }

    return scattered;
  }

  /**
   * Generate strategic recommendations
   */
  private generateRecommendations(
    posture: StrategicPosture,
    objectives: StrategicObjective[],
    threatLevel: number
  ): string[] {
    const recommendations: string[] = [];

    switch (posture) {
      case StrategicPosture.Aggressive:
        recommendations.push('Focus fire on priority targets');
        recommendations.push('Push forward to maintain pressure');
        break;
      case StrategicPosture.Defensive:
        recommendations.push('Hold position and use cover');
        recommendations.push('Wait for enemy to approach');
        break;
      case StrategicPosture.Stealth:
        recommendations.push('Use Hide actions to gain advantage');
        recommendations.push('Detect hidden enemies before engaging');
        break;
      case StrategicPosture.Balanced:
      default:
        recommendations.push('Adapt to enemy movements');
        recommendations.push('Maintain formation cohesion');
    }

    if (threatLevel > 0.7) {
      recommendations.push('High threat - consider disengaging disadvantaged models');
    }

    return recommendations;
  }

  /**
   * Assign priority targets to units
   */
  private assignTargetsToUnits(
    targets: PriorityTarget[],
    priorities: Map<string, ActionDecision>
  ): void {
    const friendlyModels = this.getActiveModels();
    
    // Assign top priority target to multiple units if coordinating
    if (targets.length > 0 && friendlyModels.length > 0) {
      const primaryTarget = targets[0];
      
      // Assign up to 2-3 attackers per priority target
      const attackersPerTarget = Math.min(
        Math.ceil(friendlyModels.length / targets.length),
        3
      );

      let attackerCount = 0;
      for (const friendly of friendlyModels) {
        if (attackerCount >= attackersPerTarget) break;
        
        priorities.set(friendly.id, {
          type: 'close_combat',
          target: primaryTarget.character,
          reason: `Focus fire: ${primaryTarget.reason}`,
          priority: primaryTarget.priority,
          requiresAP: true,
        });
        
        attackerCount++;
      }
    }
  }

  /**
   * Assign strategic objective to units
   */
  private assignObjectiveToUnits(
    objective: StrategicObjective,
    priorities: Map<string, ActionDecision>
  ): void {
    // Implementation depends on objective type
    switch (objective.type) {
      case 'protect_vip':
        if (objective.target && 'id' in objective.target) {
          // Assign nearby units to protect VIP
          const vipChar = objective.target as Character;
          const nearbyUnits = this.getNearbyUnits(vipChar, 6);
          
          for (const unit of nearbyUnits) {
            priorities.set(unit.id, {
              type: 'hold',
              reason: `Protect VIP (${objective.id})`,
              priority: objective.priority,
              requiresAP: false,
            });
          }
        }
        break;
      
      case 'regroup':
        // Find central position and move units toward it
        const centerPos = this.calculateCenterPosition();
        if (centerPos) {
          const scatteredUnits = this.getScatteredUnits();
          for (const unit of scatteredUnits) {
            priorities.set(unit.id, {
              type: 'move',
              position: centerPos,
              reason: 'Regroup with forces',
              priority: objective.priority,
              requiresAP: true,
            });
          }
        }
        break;
    }
  }

  /**
   * Get units near a character
   */
  private getNearbyUnits(character: Character, range: number): Character[] {
    const charPos = this.battlefield.getCharacterPosition(character);
    if (!charPos) return [];

    return this.getActiveModels().filter(m => {
      if (m === character) return false;
      const mPos = this.battlefield.getCharacterPosition(m);
      if (!mPos) return false;
      
      const dist = Math.hypot(mPos.x - charPos.x, mPos.y - charPos.y);
      return dist <= range;
    });
  }

  /**
   * Calculate center position of friendly forces
   */
  private calculateCenterPosition(): { x: number; y: number } | null {
    const models = this.getActiveModels();
    if (models.length === 0) return null;

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const model of models) {
      const pos = this.battlefield.getCharacterPosition(model);
      if (pos) {
        sumX += pos.x;
        sumY += pos.y;
        count++;
      }
    }

    if (count === 0) return null;

    return {
      x: sumX / count,
      y: sumY / count,
    };
  }

  /**
   * Get scattered units (not in cohesion)
   */
  private getScatteredUnits(): Character[] {
    const models = this.getActiveModels();
    return models.filter(m => {
      const pos = this.battlefield.getCharacterPosition(m);
      if (!pos) return false;

      // Check if any friendly is within cohesion range (8 MU)
      return !models.some(other => {
        if (other === m) return false;
        const otherPos = this.battlefield.getCharacterPosition(other);
        if (!otherPos) return false;
        
        const dist = Math.hypot(otherPos.x - pos.x, otherPos.y - pos.y);
        return dist <= 8;
      });
    });
  }
}

/**
 * Create SideAI for a mission side
 */
export function createSideAI(
  side: MissionSide,
  battlefield: Battlefield,
  enemySide?: MissionSide,
  config?: Partial<SideAIConfig>
): SideAI {
  return new SideAI(side, battlefield, enemySide, config);
}
