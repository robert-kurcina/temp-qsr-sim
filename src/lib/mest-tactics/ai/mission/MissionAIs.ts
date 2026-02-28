/**
 * Mission-Specific AI Implementations
 * 
 * Phase 5: Mission Specialization
 */

import { MissionAI, MissionAIContext, MissionAIDecision } from './MissionAI';
import { Character } from '../../core/Character';
import { VictoryConditionType, ScoringType } from '../../missions/mission-definitions';

// ============================================================================
// Elimination Mission AI (QAI_11)
// ============================================================================

/**
 * Elimination Mission AI
 *
 * Baseline mission: eliminate all enemy models.
 * Key behaviors:
 * - Prioritize attacks on wounded targets
 * - Push forward to cross midline (Aggression key)
 * - Avoid excessive Wait action selection
 * - Focus fire to secure eliminations and VP
 */
export class EliminationMissionAI extends MissionAI {
  readonly missionId = 'QAI_11';
  readonly missionName = 'Elimination';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const battlefield = context.battlefield;
    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) return undefined;

    const currentTurn = context.currentTurn;
    const scoringContext = context.scoringContext;

    // Priority 1: Attack CRITICALLY wounded enemies (1-2 attacks from elimination)
    // These are priority targets to secure eliminations
    const criticalEnemies = context.enemySides
      .flatMap(s => s.members)
      .filter(m => {
        const enemy = m.character;
        const wounds = enemy.state.wounds ?? 0;
        const siz = enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3;
        // Critical = within 2 wounds of elimination (SIZ+3)
        return wounds >= siz + 1 && !enemy.state.isKOd && !enemy.state.isEliminated;
      })
      .map(m => m.character);

    if (criticalEnemies.length > 0) {
      // Find closest critical enemy
      let closestCritical: Character | null = null;
      let closestDist = Infinity;
      for (const enemy of criticalEnemies) {
        const enemyPos = battlefield.getCharacterPosition(enemy);
        if (!enemyPos) continue;
        const dist = Math.hypot(enemyPos.x - charPos.x, enemyPos.y - charPos.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestCritical = enemy;
        }
      }

      if (closestCritical) {
        const enemyPos = battlefield.getCharacterPosition(closestCritical);
        if (enemyPos) {
          const inRCC = closestDist <= 1.5;
          const inRCRange = closestDist <= (character.finalAttributes.orm ?? 8);

          if (inRCC) {
            return {
              override: {
                type: 'close_combat',
                target: closestCritical,
                reason: 'Finish off critically wounded enemy',
                priority: 6, // Higher than regular wounded
                requiresAP: true,
              },
              context: 'Elimination: Finish off critical',
            };
          } else if (inRCRange) {
            return {
              override: {
                type: 'ranged_combat',
                target: closestCritical,
                reason: 'Finish off critically wounded enemy',
                priority: 6,
                requiresAP: true,
              },
              context: 'Elimination: Finish off critical',
            };
          }
        }
      }
    }

    // Priority 2: Attack wounded enemies (focus fire)
    const woundedEnemies = context.enemySides
      .flatMap(s => s.members)
      .filter(m => {
        const enemy = m.character;
        return enemy.state.wounds > 0 &&
               !enemy.state.isKOd &&
               !enemy.state.isEliminated;
      })
      .map(m => m.character);

    if (woundedEnemies.length > 0) {
      // Find closest wounded enemy
      let closestWounded: Character | null = null;
      let closestDist = Infinity;
      for (const enemy of woundedEnemies) {
        const enemyPos = battlefield.getCharacterPosition(enemy);
        if (!enemyPos) continue;
        const dist = Math.hypot(enemyPos.x - charPos.x, enemyPos.y - charPos.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestWounded = enemy;
        }
      }

      if (closestWounded) {
        const enemyPos = battlefield.getCharacterPosition(closestWounded);
        if (enemyPos) {
          // Check if in range combat range
          const inRCC = closestDist <= 1.5; // Base-to-base contact
          const inRCRange = closestDist <= (character.finalAttributes.orm ?? 8);

          if (inRCC) {
            return {
              override: {
                type: 'close_combat',
                target: closestWounded,
                reason: 'Focus fire on wounded enemy',
                priority: 5,
                requiresAP: true,
              },
              context: 'Elimination: Focus fire wounded',
            };
          } else if (inRCRange) {
            return {
              override: {
                type: 'ranged_combat',
                target: closestWounded,
                reason: 'Focus fire on wounded enemy',
                priority: 5,
                requiresAP: true,
              },
              context: 'Elimination: Focus fire wounded',
            };
          }
        }
      }
    }

    // Priority 2: Push forward for Aggression key (cross midline)
    // Increase pressure as turns progress
    const aggressionTurnThreshold = currentTurn >= 3 ? 1.0 : 0.7;
    const scoringPressure = scoringContext?.amILeading === false ? 1.2 : aggressionTurnThreshold;

    const battlefieldCenter = battlefield.width / 2;
    const deploymentEdge = character.startingPosition?.x ?? 0;
    const movingTowardCenter = deploymentEdge < battlefieldCenter
      ? charPos.x < battlefieldCenter
      : charPos.x > battlefieldCenter;

    if (movingTowardCenter && currentTurn <= 4) {
      // Early turns: advance toward midline
      const advanceTarget = {
        x: battlefieldCenter + (deploymentEdge < battlefieldCenter ? 2 : -2),
        y: charPos.y,
      };
      return {
        override: {
          type: 'move',
          position: advanceTarget,
          reason: 'Advance for Aggression key',
          priority: 4 * scoringPressure,
          requiresAP: true,
        },
        context: 'Elimination: Aggression advance',
      };
    }

    // Priority 3: Late game - be more aggressive if behind on VP
    if (currentTurn >= 5 && scoringContext && !scoringContext.amILeading) {
      // Find any enemy and attack
      const visibleEnemies = context.enemies.filter(e => {
        if (e.state.isEliminated || e.state.isKOd) return false;
        const enemyPos = battlefield.getCharacterPosition(e);
        if (!enemyPos) return false;
        return battlefield.hasLineOfSight(charPos, enemyPos);
      });

      if (visibleEnemies.length > 0) {
        const target = visibleEnemies[0];
        const targetPos = battlefield.getCharacterPosition(target);
        if (targetPos) {
          const dist = Math.hypot(targetPos.x - charPos.x, targetPos.y - charPos.y);
          if (dist <= 1.5) {
            return {
              override: {
                type: 'close_combat',
                target,
                reason: 'Late game desperation attack',
                priority: 5,
                requiresAP: true,
              },
              context: 'Elimination: Late game aggression',
            };
          } else if (dist <= (character.finalAttributes.orm ?? 8)) {
            return {
              override: {
                type: 'ranged_combat',
                target,
                reason: 'Late game desperation attack',
                priority: 5,
                requiresAP: true,
              },
              context: 'Elimination: Late game aggression',
            };
          }
        }
      }
    }

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
      objectives: ['eliminate_enemies', 'cross_midline'],
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
// Assault Mission AI (QAI_13)
// ============================================================================

/**
 * Assault Mission AI
 * 
 * Assault objective markers or harvest resources.
 * Key behaviors:
 * - Prioritize assault actions on markers (3 VP each)
 * - Harvest resources when assault not available (1 VP each)
 * - Disengage before assaulting if engaged
 */
export class AssaultMissionAI extends MissionAI {
  readonly missionId = 'QAI_13';
  readonly missionName = 'Assault';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const markers = context.missionState['markers'] as any[] || [];
    if (markers.length === 0) return undefined;

    // Find unassaulted markers
    const availableMarkers = markers.filter(m => !m.assaulted);
    if (availableMarkers.length === 0) return undefined;

    const charPos = context.battlefield.getCharacterPosition(character);
    if (!charPos) return undefined;

    // Priority 1: Assault nearest marker if in range
    for (const marker of availableMarkers) {
      const dist = Math.hypot(marker.position.x - charPos.x, marker.position.y - charPos.y);
      if (dist <= 1) {
        // In assault range
        const isEngaged = context.battlefield.isEngaged?.(character);
        if (isEngaged) {
          // Need to disengage first
          return {
            override: {
              type: 'disengage',
              reason: 'Disengage to assault marker',
              priority: 4,
              requiresAP: true,
            },
            context: 'Assault: Disengage first',
          };
        }
        
        return {
          override: {
            type: 'hold',
            reason: 'Assault marker',
            priority: 5,
            requiresAP: true,
          },
          context: 'Assault: Assault marker',
        };
      }
    }

    // Priority 2: Move to nearest marker
    const nearest = this.findNearestMarker(character, availableMarkers, context.battlefield);
    if (nearest) {
      return {
        override: {
          type: 'move',
          position: nearest.position,
          reason: 'Move to assault marker',
          priority: 3,
          requiresAP: true,
        },
        context: 'Assault: Move to marker',
      };
    }

    return undefined;
  }

  getStrategicPriorities(context: MissionAIContext): {
    priorityTargets?: string[];
    objectives?: string[];
  } {
    return {
      objectives: ['assault_markers', 'harvest_resources'],
    };
  }

  private findNearestMarker(
    character: Character,
    markers: any[],
    battlefield: Battlefield
  ): any | null {
    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) return null;

    let nearest: any = null;
    let nearestDist = Infinity;

    for (const marker of markers) {
      const dist = Math.hypot(marker.position.x - charPos.x, marker.position.y - charPos.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = marker;
      }
    }

    return nearest;
  }
}

// ============================================================================
// Triumvirate Mission AI (QAI_17)
// ============================================================================

/**
 * Triumvirate Mission AI
 * 
 * Control all three triad zones for instant victory.
 * Key behaviors:
 * - Prioritize zones that complete the triad
 * - Contest enemy-controlled zones
 * - Defend when controlling 2+ zones
 */
export class TriumvirateMissionAI extends MissionAI {
  readonly missionId = 'QAI_17';
  readonly missionName = 'Triumvirate';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const zones = context.missionState['zones'] as any[] || [];
    if (zones.length !== 3) return undefined;

    const controlledBySide = this.getControlledZones(context.side.id, zones);
    const enemyControlled = zones.filter(z => z.controlledBy && z.controlledBy !== context.side.id);
    const uncontrolled = zones.filter(z => !z.controlledBy);

    // Priority 1: Capture zone that completes triad (if we have 2)
    if (controlledBySide.length === 2 && uncontrolled.length > 0) {
      const nearest = this.findNearestZone(character, uncontrolled, context.battlefield);
      if (nearest) {
        return {
          override: {
            type: 'move',
            position: nearest.center,
            reason: 'Complete triad for instant victory',
            priority: 5,
            requiresAP: true,
          },
          context: 'Triumvirate: Complete triad',
        };
      }
    }

    // Priority 2: Contest enemy zones (especially if they have 2)
    if (enemyControlled.length > 0) {
      const nearest = this.findNearestZone(character, enemyControlled, context.battlefield);
      if (nearest) {
        return {
          override: {
            type: 'move',
            position: nearest.center,
            reason: 'Contest enemy triad zone',
            priority: 4,
            requiresAP: true,
          },
          context: 'Triumvirate: Contest zone',
        };
      }
    }

    // Priority 3: Capture uncontrolled zones
    if (uncontrolled.length > 0) {
      const nearest = this.findNearestZone(character, uncontrolled, context.battlefield);
      if (nearest) {
        return {
          override: {
            type: 'move',
            position: nearest.center,
            reason: 'Capture triad zone',
            priority: 3,
            requiresAP: true,
          },
          context: 'Triumvirate: Capture zone',
        };
      }
    }

    // Priority 4: Defend controlled zones
    if (controlledBySide.length > 0) {
      const nearest = this.findNearestZone(character, controlledBySide, context.battlefield);
      if (nearest) {
        return {
          override: {
            type: 'hold',
            reason: 'Defend triad zone',
            priority: 3,
            requiresAP: false,
          },
          context: 'Triumvirate: Defend zone',
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
    const controlledBySide = this.getControlledZones(context.side.id, zones);
    
    // If we have 2 zones, prioritize the third
    if (controlledBySide.length === 2) {
      const uncontrolled = zones.filter(z => !z.controlledBy);
      return {
        priorityZones: uncontrolled.map(z => z.id),
        objectives: ['complete_triad'],
      };
    }

    // Otherwise prioritize all zones
    return {
      priorityZones: zones.map(z => z.id),
      objectives: ['control_triad_zones'],
    };
  }
}

// ============================================================================
// Breach/Switchback Mission AI (QAI_20)
// ============================================================================

/**
 * Breach/Switchback Mission AI
 * 
 * Control markers that switch allegiance on turns 4 and 8.
 * Key behaviors:
 * - Prepare for switch turns (position for captures)
 * - Contest markers before switch
 * - Maximize control after switch
 */
export class BreachMissionAI extends MissionAI {
  readonly missionId = 'QAI_20';
  readonly missionName = 'Breach';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const markers = context.missionState['markers'] as any[] || [];
    const switchTurns = context.missionState['switchTurns'] as number[] || [4, 8];
    const currentTurn = context.currentTurn;

    if (markers.length === 0) return undefined;

    const charPos = context.battlefield.getCharacterPosition(character);
    if (!charPos) return undefined;

    // Check if this is a switch turn (or turn before)
    const isSwitchTurn = switchTurns.includes(currentTurn);
    const isPreSwitch = switchTurns.includes(currentTurn + 1);

    // Priority 1: Position for switch turn capture
    if (isPreSwitch) {
      // Find markers we don't control that will switch
      const enemyMarkers = markers.filter(m => m.controlledBy && m.controlledBy !== context.side.id);
      if (enemyMarkers.length > 0) {
        const nearest = this.findNearestMarker(character, enemyMarkers, context.battlefield);
        if (nearest) {
          return {
            override: {
              type: 'move',
              position: nearest.position,
              reason: 'Position for switch turn capture',
              priority: 4,
              requiresAP: true,
            },
            context: 'Breach: Pre-switch position',
          };
        }
      }
    }

    // Priority 2: Contest enemy markers
    const enemyMarkers = markers.filter(m => m.controlledBy && m.controlledBy !== context.side.id);
    if (enemyMarkers.length > 0) {
      const nearest = this.findNearestMarker(character, enemyMarkers, context.battlefield);
      if (nearest) {
        return {
          override: {
            type: 'move',
            position: nearest.position,
            reason: 'Contest enemy marker',
            priority: 3,
            requiresAP: true,
          },
          context: 'Breach: Contest marker',
        };
      }
    }

    // Priority 3: Capture uncontrolled markers
    const uncontrolled = markers.filter(m => !m.controlledBy);
    if (uncontrolled.length > 0) {
      const nearest = this.findNearestMarker(character, uncontrolled, context.battlefield);
      if (nearest) {
        return {
          override: {
            type: 'move',
            position: nearest.position,
            reason: 'Capture marker',
            priority: 3,
            requiresAP: true,
          },
          context: 'Breach: Capture marker',
        };
      }
    }

    return undefined;
  }

  getStrategicPriorities(context: MissionAIContext): {
    priorityTargets?: string[];
    objectives?: string[];
  } {
    const currentTurn = context.currentTurn;
    const switchTurns = context.missionState['switchTurns'] as number[] || [4, 8];
    
    if (switchTurns.includes(currentTurn + 1)) {
      return {
        objectives: ['position_for_switch'],
      };
    }

    return {
      objectives: ['control_markers', 'contest_enemy'],
    };
  }

  private findNearestMarker(
    character: Character,
    markers: any[],
    battlefield: Battlefield
  ): any | null {
    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) return null;

    let nearest: any = null;
    let nearestDist = Infinity;

    for (const marker of markers) {
      const dist = Math.hypot(marker.position.x - charPos.x, marker.position.y - charPos.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = marker;
      }
    }

    return nearest;
  }
}

// ============================================================================
// Defiance/Last Stand Mission AI (QAI_19)
// ============================================================================

/**
 * Defiance/Last Stand Mission AI
 * 
 * Defend VIP until reinforcements arrive (turn 6).
 * Key behaviors:
 * - Defender: Form defensive perimeter around VIP
 * - Attacker: Focus fire on VIP, eliminate defenders
 */
export class DefianceMissionAI extends MissionAI {
  readonly missionId = 'QAI_19';
  readonly missionName = 'Defiance';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const isDefender = context.side.id === 'Defender';
    const vip = this.findVIP(context.side);
    const currentTurn = context.currentTurn;

    if (!vip) return undefined;

    const vipPos = context.battlefield.getCharacterPosition(vip);
    const charPos = context.battlefield.getCharacterPosition(character);

    if (!vipPos || !charPos) return undefined;

    if (isDefender) {
      // Defender behaviors
      const isVIP = character === vip;

      if (isVIP) {
        // VIP: Stay in fortified position
        return {
          override: {
            type: 'hold',
            reason: 'VIP hold fortified position',
            priority: 4,
            requiresAP: false,
          },
          context: 'Defiance: VIP hold',
        };
      }

      // Guard: Form perimeter around VIP
      const distToVIP = Math.hypot(vipPos.x - charPos.x, vipPos.y - charPos.y);
      const idealPerimeter = 4; // 4 MU from VIP

      if (distToVIP > idealPerimeter + 1) {
        // Move toward VIP to form perimeter
        const perimeterPos = {
          x: vipPos.x + (charPos.x - vipPos.x) / distToVIP * idealPerimeter,
          y: vipPos.y + (charPos.y - vipPos.y) / distToVIP * idealPerimeter,
        };
        return {
          override: {
            type: 'move',
            position: perimeterPos,
            reason: 'Form defensive perimeter',
            priority: 3,
            requiresAP: true,
          },
          context: 'Defiance: Form perimeter',
        };
      }

      // In position: Hold and defend
      return {
        override: {
          type: 'hold',
          reason: 'Hold defensive position',
          priority: 3,
          requiresAP: false,
        },
        context: 'Defiance: Hold position',
      };
    } else {
      // Attacker behaviors
      // Focus fire on VIP
      return {
        override: {
          type: 'ranged_combat',
          target: vip,
          reason: 'Eliminate enemy VIP',
          priority: 5,
          requiresAP: true,
        },
        context: 'Defiance: Attack VIP',
      };
    }
  }

  getCharacterRole(character: Character, context: MissionAIContext): string | undefined {
    const isDefender = context.side.id === 'Defender';
    const isVIP = this.isVIP(character, context.side);

    if (isDefender) {
      return isVIP ? 'VIP' : 'Defender';
    }
    return 'Attacker';
  }

  getStrategicPriorities(context: MissionAIContext): {
    priorityTargets?: string[];
    objectives?: string[];
  } {
    const isDefender = context.side.id === 'Defender';
    const vip = this.findVIP(context.side);

    if (isDefender) {
      return {
        objectives: ['protect_vip', 'hold_until_reinforcements'],
      };
    }

    return {
      priorityTargets: vip ? [vip.id] : [],
      objectives: ['eliminate_vip'],
    };
  }
}

// ============================================================================
// Stealth/Ghost Protocol Mission AI (QAI_18)
// ============================================================================

/**
 * Stealth/Ghost Protocol Mission AI
 * 
 * Extract VIP without detection (15 VP) or after detection (8 VP).
 * Key behaviors:
 * - Infiltrator: Use Hide, avoid detection, reach extraction
 * - Defender: Detect VIP, prevent extraction
 */
export class StealthMissionAI extends MissionAI {
  readonly missionId = 'QAI_18';
  readonly missionName = 'Stealth';

  getDecision(character: Character, context: MissionAIContext): MissionAIDecision | undefined {
    const isInfiltrator = context.side.id === 'Infiltrator';
    const isVIP = this.isVIP(character, context.side);
    const extractionZone = context.missionState['extractionZone'] as any;

    const charPos = context.battlefield.getCharacterPosition(character);
    if (!charPos) return undefined;

    if (isInfiltrator) {
      // Infiltrator behaviors
      if (isVIP) {
        const isDetected = context.missionState['vipDetected'] as boolean || false;

        if (!isDetected) {
          // Not detected: Use stealth
          // Priority 1: Hide if visible to enemies
          const isVisibleToEnemy = this.isVisibleToEnemy(character, context);
          if (isVisibleToEnemy && !character.state.isHidden) {
            return {
              override: {
                type: 'hide',
                reason: 'VIP stay hidden',
                priority: 5,
                requiresAP: true,
              },
              context: 'Stealth: VIP hide',
            };
          }

          // Priority 2: Move to extraction
          if (extractionZone) {
            const dist = Math.hypot(
              extractionZone.center.x - charPos.x,
              extractionZone.center.y - charPos.y
            );
            if (dist > 1) {
              return {
                override: {
                  type: 'move',
                  position: extractionZone.center,
                  reason: 'Move to extraction point',
                  priority: 4,
                  requiresAP: true,
                },
                context: 'Stealth: VIP to extraction',
              };
            }
            
            // At extraction: Extract
            return {
              override: {
                type: 'hold',
                reason: 'Extract VIP',
                priority: 5,
                requiresAP: true,
              },
              context: 'Stealth: VIP extract',
            };
          }
        } else {
          // Detected: Rush to extraction
          if (extractionZone) {
            return {
              override: {
                type: 'move',
                position: extractionZone.center,
                reason: 'Rush to extraction (detected)',
                priority: 5,
                requiresAP: true,
              },
              context: 'Stealth: VIP rush',
            };
          }
        }
      } else {
        // Guard: Protect VIP, clear path
        const vip = this.findVIP(context.side);
        if (vip) {
          const vipPos = context.battlefield.getCharacterPosition(vip);
          if (vipPos) {
            const dist = Math.hypot(vipPos.x - charPos.x, vipPos.y - charPos.y);
            if (dist > 6) {
              return {
                override: {
                  type: 'move',
                  position: { x: vipPos.x, y: vipPos.y },
                  reason: 'Protect VIP',
                  priority: 4,
                  requiresAP: true,
                },
                context: 'Stealth: Guard VIP',
              };
            }
          }
        }
      }
    } else {
      // Defender behaviors
      // Detect hidden VIP
      const infiltratorVIP = this.findEnemyVIP(context);
      if (infiltratorVIP) {
        return {
          override: {
            type: 'detect',
            target: infiltratorVIP,
            reason: 'Detect enemy VIP',
            priority: 5,
            requiresAP: true,
          },
          context: 'Stealth: Detect VIP',
        };
      }

      // Patrol zones
      const zones = context.missionState['stealthZones'] as any[] || [];
      if (zones.length > 0) {
        const nearest = this.findNearestZone(character, zones, context.battlefield);
        if (nearest) {
          return {
            override: {
              type: 'move',
              position: nearest.center,
              reason: 'Patrol stealth zone',
              priority: 3,
              requiresAP: true,
            },
            context: 'Stealth: Patrol',
          };
        }
      }
    }

    return undefined;
  }

  getCharacterRole(character: Character, context: MissionAIContext): string | undefined {
    const isInfiltrator = context.side.id === 'Infiltrator';
    const isVIP = this.isVIP(character, context.side);

    if (isInfiltrator) {
      return isVIP ? 'Ghost VIP' : 'Infiltrator';
    }
    return 'Defender';
  }

  getStrategicPriorities(context: MissionAIContext): {
    priorityTargets?: string[];
    objectives?: string[];
  } {
    const isInfiltrator = context.side.id === 'Infiltrator';

    if (isInfiltrator) {
      return {
        objectives: ['extract_vip_stealth', 'avoid_detection'],
      };
    }

    return {
      objectives: ['detect_vip', 'prevent_extraction'],
    };
  }

  private isVisibleToEnemy(character: Character, context: MissionAIContext): boolean {
    const charPos = context.battlefield.getCharacterPosition(character);
    if (!charPos) return false;

    for (const enemySide of context.enemySides) {
      for (const member of enemySide.members) {
        if (member.character.state.isEliminated || member.character.state.isKOd) continue;
        
        const enemyPos = context.battlefield.getCharacterPosition(member.character);
        if (!enemyPos) continue;

        const dist = Math.hypot(enemyPos.x - charPos.x, enemyPos.y - charPos.y);
        if (dist <= 16) { // Visibility range
          // Check LOS (simplified)
          return true;
        }
      }
    }

    return false;
  }

  private findEnemyVIP(context: MissionAIContext): Character | undefined {
    for (const enemySide of context.enemySides) {
      const vip = this.findVIP(enemySide);
      if (vip) return vip;
    }
    return undefined;
  }
}

export function createMissionAI(missionId: string): MissionAI | undefined {
  switch (missionId) {
    case 'QAI_11':
      return new EliminationMissionAI();
    case 'QAI_12':
      return new ConvergenceMissionAI();
    case 'QAI_13':
      return new AssaultMissionAI();
    case 'QAI_14':
      return new DominionMissionAI();
    case 'QAI_15':
      return new RecoveryMissionAI();
    case 'QAI_16':
      return new EscortMissionAI();
    case 'QAI_17':
      return new TriumvirateMissionAI();
    case 'QAI_18':
      return new StealthMissionAI();
    case 'QAI_19':
      return new DefianceMissionAI();
    case 'QAI_20':
      return new BreachMissionAI();
    // Add more missions as implemented
    default:
      return undefined;
  }
}
