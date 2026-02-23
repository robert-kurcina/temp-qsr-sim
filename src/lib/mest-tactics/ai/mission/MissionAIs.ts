/**
 * Mission-Specific AI Implementations
 * 
 * Phase 5: Mission Specialization
 */

import { MissionAI, MissionAIContext, MissionAIDecision } from './MissionAI';
import { Character } from '../../core/Character';
import { VictoryConditionType, ScoringType } from '../../missions/mission-definitions';

// ============================================================================
// Elimination Mission AI (QAI_1)
// ============================================================================

/**
 * Elimination Mission AI
 * 
 * Baseline mission: eliminate all enemy models.
 * Standard AI behavior is sufficient, but we can optimize for:
 * - Focus fire on wounded targets
 * - Avoid risky actions when winning
 * - Push advantage when ahead
 */
export class EliminationMissionAI extends MissionAI {
  readonly missionId = 'QAI_1';
  readonly missionName = 'Elimination';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    // Standard AI is sufficient for Elimination
    // Could add optimization for focus fire on wounded targets
    return undefined;
  }

  getStrategicPriorities(context: MissionAIContext): {
    priorityTargets?: string[];
    objectives?: string[];
  } {
    // Priority: eliminate wounded enemies first
    const woundedEnemies = context.enemySides
      .flatMap(s => s.members)
      .filter(m => m.character.state.wounds > 0 && !m.character.state.isKOd && !m.character.state.isEliminated)
      .map(m => m.character.id);

    return {
      priorityTargets: woundedEnemies,
      objectives: ['eliminate_enemies'],
    };
  }
}

// ============================================================================
// Convergence Mission AI (QAI_12)
// ============================================================================

/**
 * Convergence Mission AI
 * 
 * Control convergence zones to score VP.
 * Key behaviors:
 * - Prioritize zone control over kills
 * - Contest enemy-controlled zones
 * - Defend controlled zones
 */
export class ConvergenceMissionAI extends MissionAI {
  readonly missionId = 'QAI_12';
  readonly missionName = 'Convergence';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const zones = context.missionState['zones'] as any[] || [];
    if (zones.length === 0) return undefined;

    const controlledZones = this.getControlledZones(context.side.id, zones);
    const contestedZones = this.getContestedZones(zones);
    const uncontrolledZones = zones.filter(
      z => !z.controlledBy && !z.contested
    );

    // Priority 1: Contest enemy-controlled zones
    if (controlledZones.length > 0) {
      const nearestEnemyZone = this.findNearestZone(character, controlledZones, context.battlefield);
      if (nearestEnemyZone) {
        return {
          override: {
            type: 'move',
            position: nearestEnemyZone.center,
            reason: 'Contest enemy zone',
            priority: 4,
            requiresAP: true,
          },
          context: 'Convergence: Contest enemy zone',
        };
      }
    }

    // Priority 2: Capture uncontrolled zones
    if (uncontrolledZones.length > 0) {
      const nearestUncontrolled = this.findNearestZone(character, uncontrolledZones, context.battlefield);
      if (nearestUncontrolled) {
        return {
          override: {
            type: 'move',
            position: nearestUncontrolled.center,
            reason: 'Capture uncontrolled zone',
            priority: 3,
            requiresAP: true,
          },
          context: 'Convergence: Capture zone',
        };
      }
    }

    // Priority 3: Reinforce contested zones
    if (contestedZones.length > 0) {
      const nearestContested = this.findNearestZone(character, contestedZones, context.battlefield);
      if (nearestContested) {
        return {
          override: {
            type: 'move',
            position: nearestContested.center,
            reason: 'Reinforce contested zone',
            priority: 3,
            requiresAP: true,
          },
          context: 'Convergence: Contest zone',
        };
      }
    }

    return undefined;
  }

  getStrategicPriorities(context: MissionAIContext): {
    priorityZones?: string[];
    objectives?: string[];
  } {
    const zones = context.missionState['zones'] as any[] || [];
    
    // Priority zones: uncontrolled or enemy-controlled
    const priorityZones = zones
      .filter(z => !z.controlledBy || z.controlledBy !== context.side.id)
      .map(z => z.id);

    return {
      priorityZones,
      objectives: ['control_zones', 'contest_enemy_zones'],
    };
  }
}

// ============================================================================
// Dominion Mission AI (QAI_14)
// ============================================================================

/**
 * Dominion Mission AI
 * 
 * Control dominance zones for VP. Similar to Convergence but with
 * different scoring (1 VP per zone at end of turn).
 */
export class DominionMissionAI extends MissionAI {
  readonly missionId = 'QAI_14';
  readonly missionName = 'Dominion';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const zones = context.missionState['zones'] as any[] || [];
    if (zones.length === 0) return undefined;

    // Dominion: steady VP accumulation, less rush than Convergence
    const controlledZones = this.getControlledZones(context.side.id, zones);
    
    // If we control zones, defend them
    if (controlledZones.length > 0) {
      // Check if character is near a controlled zone
      const nearbyControlled = controlledZones.find(z => {
        const charPos = context.battlefield.getCharacterPosition(character);
        if (!charPos) return false;
        const dist = Math.hypot(z.center.x - charPos.x, z.center.y - charPos.y);
        return dist <= 6; // Within 6 MU
      });

      if (nearbyControlled) {
        return {
          override: {
            type: 'hold',
            reason: 'Defend controlled zone',
            priority: 3,
            requiresAP: false,
          },
          context: 'Dominion: Hold zone',
        };
      }
    }

    // Otherwise, capture uncontrolled zones
    const uncontrolledZones = zones.filter(z => !z.controlledBy);
    if (uncontrolledZones.length > 0) {
      const nearest = this.findNearestZone(character, uncontrolledZones, context.battlefield);
      if (nearest) {
        return {
          override: {
            type: 'move',
            position: nearest.center,
            reason: 'Capture dominance zone',
            priority: 3,
            requiresAP: true,
          },
          context: 'Dominion: Capture zone',
        };
      }
    }

    return undefined;
  }
}

// ============================================================================
// Recovery Mission AI (QAI_15)
// ============================================================================

/**
 * Recovery Mission AI
 * 
 * Extract IC (Important Characters) from battlefield edges.
 * Key behaviors:
 * - VIP: Move to edge and extract
 * - Guards: Protect VIP and clear path
 */
export class RecoveryMissionAI extends MissionAI {
  readonly missionId = 'QAI_15';
  readonly missionName = 'Recovery';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const isVIP = this.isVIP(character, context.side);
    const battlefield = context.battlefield;
    const charPos = battlefield.getCharacterPosition(character);
    
    if (!charPos) return undefined;

    if (isVIP) {
      // VIP: Move to nearest edge
      const edgePos = this.findNearestEdge(charPos, battlefield);
      if (edgePos) {
        const dist = Math.hypot(edgePos.x - charPos.x, edgePos.y - charPos.y);
        if (dist <= 1) {
          // At edge, extract
          return {
            override: {
              type: 'hold',
              reason: 'Extract at edge',
              priority: 5,
              requiresAP: false,
            },
            context: 'Recovery: VIP extraction',
          };
        }
        
        return {
          override: {
            type: 'move',
            position: edgePos,
            reason: 'Move to extraction point',
            priority: 5,
            requiresAP: true,
          },
          context: 'Recovery: VIP to edge',
        };
      }
    } else {
      // Guard: Protect VIP and clear path
      const vip = this.findVIP(context.side);
      if (vip) {
        const vipPos = battlefield.getCharacterPosition(vip);
        if (vipPos) {
          // Move toward VIP to protect
          const dist = Math.hypot(vipPos.x - charPos.x, vipPos.y - charPos.y);
          if (dist > 4) {
            return {
              override: {
                type: 'move',
                position: { x: vipPos.x, y: vipPos.y },
                reason: 'Protect VIP',
                priority: 4,
                requiresAP: true,
              },
              context: 'Recovery: Guard VIP',
            };
          }
        }
      }
    }

    return undefined;
  }

  getCharacterRole(character: Character, context: MissionAIContext): string | undefined {
    if (this.isVIP(character, context.side)) {
      return 'IC';
    }
    return 'Guard';
  }

  private findNearestEdge(
    pos: Position,
    battlefield: Battlefield
  ): Position | null {
    const width = battlefield.width;
    const height = battlefield.height;

    // Find nearest edge
    const distances = [
      { x: 0, y: pos.y, dist: pos.x }, // Left edge
      { x: width - 1, y: pos.y, dist: width - 1 - pos.x }, // Right edge
      { x: pos.x, y: 0, dist: pos.y }, // Top edge
      { x: pos.x, y: height - 1, dist: height - 1 - pos.y }, // Bottom edge
    ];

    distances.sort((a, b) => a.dist - b.dist);
    const nearest = distances[0];

    return { x: nearest.x, y: nearest.y };
  }
}

// ============================================================================
// Escort Mission AI (QAI_16)
// ============================================================================

/**
 * Escort Mission AI
 * 
 * VIP must survive until turn limit (Defender) or be eliminated (Attacker).
 * Key behaviors:
 * - Defender: Protect VIP, form defensive perimeter
 * - Attacker: Focus fire on VIP
 */
export class EscortMissionAI extends MissionAI {
  readonly missionId = 'QAI_16';
  readonly missionName = 'Escort';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const isVIP = this.isVIP(character, context.side);
    const isAttacker = context.side.id === 'Attacker';

    if (isVIP) {
      if (isAttacker) {
        // Attacker VIP: Stay hidden, avoid combat
        return {
          override: {
            type: 'hide',
            reason: 'VIP stay hidden',
            priority: 4,
            requiresAP: true,
          },
          context: 'Escort: Attacker VIP hide',
        };
      } else {
        // Defender VIP: Stay near center, avoid edges
        return {
          override: {
            type: 'hold',
            reason: 'VIP hold position',
            priority: 3,
            requiresAP: false,
          },
          context: 'Escort: Defender VIP hold',
        };
      }
    }

    // Non-VIP characters
    const vip = this.findVIP(context.side);
    if (!vip) return undefined;

    const vipPos = context.battlefield.getCharacterPosition(vip);
    const charPos = context.battlefield.getCharacterPosition(character);
    
    if (!vipPos || !charPos) return undefined;

    if (isAttacker) {
      // Attacker: Focus fire on enemy VIP
      return {
        override: {
          type: 'ranged_combat',
          target: vip,
          reason: 'Assassinate VIP',
          priority: 5,
          requiresAP: true,
        },
        context: 'Escort: Attack VIP',
      };
    } else {
      // Defender: Protect VIP
      const dist = Math.hypot(vipPos.x - charPos.x, vipPos.y - charPos.y);
      if (dist > 4) {
        return {
          override: {
            type: 'move',
            position: { x: vipPos.x, y: vipPos.y },
            reason: 'Protect VIP',
            priority: 4,
            requiresAP: true,
          },
          context: 'Escort: Move to VIP',
        };
      }
    }

    return undefined;
  }

  getCharacterRole(character: Character, context: MissionAIContext): string | undefined {
    if (this.isVIP(character, context.side)) {
      return 'VIP';
    }
    return context.side.id === 'Attacker' ? 'Assassin' : 'Guard';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createMissionAI(missionId: string): MissionAI | undefined {
  switch (missionId) {
    case 'QAI_1':
      return new EliminationMissionAI();
    case 'QAI_12':
      return new ConvergenceMissionAI();
    case 'QAI_14':
      return new DominionMissionAI();
    case 'QAI_15':
      return new RecoveryMissionAI();
    case 'QAI_16':
      return new EscortMissionAI();
    // Add more missions as implemented
    default:
      return undefined;
  }
}
