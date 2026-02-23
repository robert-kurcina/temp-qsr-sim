/**
 * Battle Report System
 * 
 * Generates comprehensive JSON battle reports for completed missions.
 * Includes all configuration, statistics, and turn-by-turn summaries.
 */

import { MissionSide } from '../mission/MissionSide';
import { MissionFlowState } from '../missions/mission-flow';
import { MissionScoreResult } from '../missions/mission-scoring';
import { Assembly } from '../core/Assembly';
import { Profile } from '../core/Profile';
import { Character } from '../core/Character';
import { TacticalDoctrine } from '../ai/stratagems';

// ============================================================================
// Battle Report Types
// ============================================================================

/**
 * Complete Battle Report structure
 */
export interface BattleReport {
  /** Report metadata */
  metadata: ReportMetadata;
  /** Game configuration */
  configuration: GameConfiguration;
  /** Participating sides */
  sides: SideReport[];
  /** Mission details */
  mission: MissionReport;
  /** Turn-by-turn summary */
  turnSummary: TurnSummary[];
  /** Final statistics */
  statistics: BattleStatistics;
  /** Outcome */
  outcome: BattleOutcome;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  /** Report generation timestamp (ISO 8601) */
  generatedAt: string;
  /** Report format version */
  formatVersion: string;
  /** Unique battle ID */
  battleId: string;
}

/**
 * Game configuration
 */
export interface GameConfiguration {
  /** Game size (VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE) */
  gameSize: string;
  /** Battlefield dimensions */
  battlefield: {
    width: number;
    height: number;
    terrainCount: number;
  };
  /** Maximum turns */
  maxTurns: number;
  /** End game trigger turn */
  endGameTriggerTurn: number;
  /** Whether end game dice rolled */
  endGameDieRolled: boolean;
  /** End game die result (if rolled) */
  endGameDieResult?: number;
}

/**
 * Side report
 */
export interface SideReport {
  /** Side ID */
  id: string;
  /** Side name */
  name: string;
  /** Total BP */
  totalBP: number;
  /** Total models */
  totalModels: number;
  /** Tactical Doctrine (if AI) */
  tacticalDoctrine?: TacticalDoctrine;
  /** Whether side is AI-controlled */
  isAI: boolean;
  /** Assemblies */
  assemblies: AssemblyReport[];
  /** Final VP */
  victoryPoints: number;
  /** Initiative Points held at game end */
  initiativePoints: number;
}

/**
 * Assembly report
 */
export interface AssemblyReport {
  /** Assembly name */
  name: string;
  /** Total BP */
  totalBP: number;
  /** Total characters */
  totalCharacters: number;
  /** Profiles */
  profiles: ProfileReport[];
}

/**
 * Profile report
 */
export interface ProfileReport {
  /** Profile name */
  name: string;
  /** Archetype name */
  archetypeName: string;
  /** Total BP */
  totalBP: number;
  /** Adjusted BP */
  adjustedBP: number;
  /** Items */
  items: string[];
  /** Traits */
  traits: string[];
  /** Attributes */
  attributes: {
    cca: number;
    rca: number;
    ref: number;
    int: number;
    pow: number;
    str: number;
    for: number;
    mov: number;
    siz: number;
  };
}

/**
 * Mission report
 */
export interface MissionReport {
  /** Mission ID */
  missionId: string;
  /** Mission name */
  missionName: string;
  /** Mission description */
  description: string;
  /** Keys to Victory achieved */
  keysToVictory: KeyToVictoryReport[];
  /** Objective Markers */
  objectiveMarkers: ObjectiveMarkerReport[];
  /** Zones */
  zones: ZoneReport[];
}

/**
 * Key to Victory report
 */
export interface KeyToVictoryReport {
  /** Key name */
  key: string;
  /** VP awarded */
  vpAwarded: number;
  /** Side that achieved it */
  sideId?: string;
  /** Turn achieved */
  turnAchieved?: number;
}

/**
 * Objective Marker report
 */
export interface ObjectiveMarkerReport {
  /** Marker ID */
  id: string;
  /** Marker type */
  type: string;
  /** VP value */
  vpValue: number;
  /** Current holder (if any) */
  holderSideId?: string;
  /** Scored */
  scored: boolean;
  /** Side that scored (if scored) */
  scoredBySideId?: string;
}

/**
 * Zone report
 */
export interface ZoneReport {
  /** Zone ID */
  id: string;
  /** Zone name */
  name: string;
  /** Zone type */
  type: string;
  /** Controller side ID (if any) */
  controllerSideId?: string;
  /** VP per turn */
  vpPerTurn: number;
}

/**
 * Turn summary
 */
export interface TurnSummary {
  /** Turn number */
  turn: number;
  /** Round number */
  round: number;
  /** Initiative winner side ID */
  initiativeWinner?: string;
  /** Initiative Points awarded */
  initiativePointsAwarded: {
    sideId: string;
    points: number;
  }[];
  /** Significant events */
  events: TurnEvent[];
  /** End of turn state */
  endOfTurnState: {
    modelsRemaining: {
      sideId: string;
      count: number;
    }[];
    bottleTestPerformed: boolean;
    bottleTestFailed: string[];
  };
}

/**
 * Turn event
 */
export interface TurnEvent {
  /** Event type */
  type: 'model_ko' | 'model_eliminated' | 'model_revived' | 'objective_captured' | 'zone_controlled' | 'key_achieved' | 'bottle_test' | 'end_game_die';
  /** Side ID (if applicable) */
  sideId?: string;
  /** Character/model ID (if applicable) */
  characterId?: string;
  /** Description */
  description: string;
  /** Turn occurred */
  turn: number;
  /** Round occurred */
  round: number;
  /** Additional data */
  data?: Record<string, any>;
}

/**
 * Battle statistics
 */
export interface BattleStatistics {
  /** Total turns played */
  totalTurns: number;
  /** Total rounds played */
  totalRounds: number;
  /** Total actions taken */
  totalActions: number;
  /** Total moves */
  totalMoves: number;
  /** Total attacks */
  totalAttacks: number;
  /** Total close combats */
  totalCloseCombats: number;
  /** Total ranged combats */
  totalRangedCombats: number;
  /** Total wounds generated */
  totalWoundsGenerated: number;
  /** Models KO'd */
  modelsKOd: {
    sideId: string;
    count: number;
  }[];
  /** Models Eliminated by wounds */
  modelsEliminatedByWounds: {
    sideId: string;
    count: number;
  }[];
  /** Models Eliminated by Fear */
  modelsEliminatedByFear: {
    sideId: string;
    count: number;
  }[];
  /** Bottle Tests performed */
  bottleTestsPerformed: number;
  /** Bottle Tests failed */
  bottleTestsFailed: number;
  /** End game die rolls */
  endGameDieRolls: number;
}

/**
 * Battle outcome
 */
export interface BattleOutcome {
  /** Winner side ID */
  winnerSideId?: string;
  /** Winner side name */
  winnerName?: string;
  /** Victory margin (VP difference) */
  victoryMargin: number;
  /** End reason */
  endReason: string;
  /** Final VP standings */
  vpStandings: {
    sideId: string;
    sideName: string;
    vp: number;
    rank: number;
  }[];
}

// ============================================================================
// Battle Report Generator
// ============================================================================

/**
 * Generate a complete battle report from game state
 */
export function generateBattleReport(
  sides: MissionSide[],
  missionState: MissionFlowState,
  scoreResult: MissionScoreResult,
  turnSummaries: TurnSummary[],
  statistics: BattleStatistics,
  configuration: GameConfiguration
): BattleReport {
  const now = new Date();
  
  // Determine winner
  const vpStandings = sides
    .map(side => ({
      sideId: side.id,
      sideName: side.name,
      vp: side.state.victoryPoints,
    }))
    .sort((a, b) => b.vp - a.vp)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  const winner = vpStandings[0];
  
  return {
    metadata: {
      generatedAt: now.toISOString(),
      formatVersion: '1.0.0',
      battleId: generateBattleId(now, sides),
    },
    configuration,
    sides: sides.map(side => generateSideReport(side)),
    mission: generateMissionReport(missionState, scoreResult),
    turnSummary: turnSummaries,
    statistics,
    outcome: {
      winnerSideId: winner?.sideId,
      winnerName: winner?.sideName,
      victoryMargin: vpStandings.length > 1 ? vpStandings[0].vp - vpStandings[1].vp : vpStandings[0].vp,
      endReason: missionState.endReason || 'Turn limit reached',
      vpStandings,
    },
  };
}

/**
 * Generate side report
 */
function generateSideReport(side: MissionSide): SideReport {
  return {
    id: side.id,
    name: side.name,
    totalBP: side.totalBP,
    totalModels: side.members.length,
    isAI: true, // Assuming AI for now
    assemblies: side.members.reduce((assemblies, member) => {
      // Group by assembly
      const existingAssembly = assemblies.find(a => a.name === member.assembly.name);
      if (existingAssembly) {
        existingAssembly.profiles.push(generateProfileReport(member.profile));
        existingAssembly.totalCharacters++;
      } else {
        assemblies.push({
          name: member.assembly.name,
          totalBP: member.assembly.totalBP,
          totalCharacters: 1,
          profiles: [generateProfileReport(member.profile)],
        });
      }
      return assemblies;
    }, [] as AssemblyReport[]),
    victoryPoints: side.state.victoryPoints,
    initiativePoints: side.state.initiativePoints,
  };
}

/**
 * Generate profile report
 */
function generateProfileReport(profile: Profile): ProfileReport {
  return {
    name: profile.name,
    archetypeName: typeof profile.archetype === 'string' ? profile.archetype : profile.archetype?.name || 'Unknown',
    totalBP: profile.totalBp,
    adjustedBP: profile.adjustedBp,
    items: (profile.items || []).map(item => item.name),
    traits: profile.allTraits || profile.finalTraits || [],
    attributes: {
      cca: profile.archetype && typeof profile.archetype !== 'string' ? profile.archetype.attributes?.cca || 2 : 2,
      rca: profile.archetype && typeof profile.archetype !== 'string' ? profile.archetype.attributes?.rca || 2 : 2,
      ref: profile.archetype && typeof profile.archetype !== 'string' ? profile.archetype.attributes?.ref || 2 : 2,
      int: profile.archetype && typeof profile.archetype !== 'string' ? profile.archetype.attributes?.int || 2 : 2,
      pow: profile.archetype && typeof profile.archetype !== 'string' ? profile.archetype.attributes?.pow || 2 : 2,
      str: profile.archetype && typeof profile.archetype !== 'string' ? profile.archetype.attributes?.str || 2 : 2,
      for: profile.archetype && typeof profile.archetype !== 'string' ? profile.archetype.attributes?.for || 2 : 2,
      mov: profile.archetype && typeof profile.archetype !== 'string' ? profile.archetype.attributes?.mov || 2 : 2,
      siz: profile.archetype && typeof profile.archetype !== 'string' ? profile.archetype.attributes?.siz || 3 : 3,
    },
  };
}

/**
 * Generate mission report
 */
function generateMissionReport(
  missionState: MissionFlowState,
  scoreResult: MissionScoreResult
): MissionReport {
  return {
    missionId: missionState.missionId || 'unknown',
    missionName: missionState.missionName || 'Unknown Mission',
    description: '',
    keysToVictory: (scoreResult.keysToVictory || []).map(key => ({
      key: key.key,
      vpAwarded: key.vpAwarded,
      sideId: key.sideId,
      turnAchieved: key.turn,
    })),
    objectiveMarkers: [], // Would need marker state
    zones: [], // Would need zone state
  };
}

/**
 * Generate unique battle ID
 */
function generateBattleId(timestamp: Date, sides: MissionSide[]): string {
  const sideNames = sides.map(s => s.name).sort().join('-');
  return `battle-${timestamp.toISOString().slice(0, 10)}-${sideNames.slice(0, 20)}`;
}

/**
 * Create turn event helper
 */
export function createTurnEvent(
  type: TurnEvent['type'],
  description: string,
  turn: number,
  round: number,
  options?: {
    sideId?: string;
    characterId?: string;
    data?: Record<string, any>;
  }
): TurnEvent {
  return {
    type,
    description,
    turn,
    round,
    sideId: options?.sideId,
    characterId: options?.characterId,
    data: options?.data,
  };
}

/**
 * Create battle statistics tracker
 */
export function createBattleStatisticsTracker(): BattleStatisticsTracker {
  return new BattleStatisticsTracker();
}

/**
 * Battle statistics tracker class
 */
export class BattleStatisticsTracker {
  private stats: BattleStatistics = {
    totalTurns: 0,
    totalRounds: 0,
    totalActions: 0,
    totalMoves: 0,
    totalAttacks: 0,
    totalCloseCombats: 0,
    totalRangedCombats: 0,
    totalWoundsGenerated: 0,
    modelsKOd: [],
    modelsEliminatedByWounds: [],
    modelsEliminatedByFear: [],
    bottleTestsPerformed: 0,
    bottleTestsFailed: 0,
    endGameDieRolls: 0,
  };

  /**
   * Record action
   */
  recordAction(actionType: 'move' | 'attack' | 'close_combat' | 'ranged_combat') {
    this.stats.totalActions++;
    switch (actionType) {
      case 'move':
        this.stats.totalMoves++;
        break;
      case 'attack':
        this.stats.totalAttacks++;
        break;
      case 'close_combat':
        this.stats.totalCloseCombats++;
        this.stats.totalAttacks++;
        break;
      case 'ranged_combat':
        this.stats.totalRangedCombats++;
        this.stats.totalAttacks++;
        break;
    }
  }

  /**
   * Record wound
   */
  recordWound() {
    this.stats.totalWoundsGenerated++;
  }

  /**
   * Record KO
   */
  recordKO(sideId: string) {
    const existing = this.stats.modelsKOd.find(k => k.sideId === sideId);
    if (existing) {
      existing.count++;
    } else {
      this.stats.modelsKOd.push({ sideId, count: 1 });
    }
  }

  /**
   * Record elimination
   */
  recordElimination(sideId: string, byFear: boolean = false) {
    const list = byFear
      ? this.stats.modelsEliminatedByFear
      : this.stats.modelsEliminatedByWounds;
    
    const existing = list.find(e => e.sideId === sideId);
    if (existing) {
      existing.count++;
    } else {
      list.push({ sideId, count: 1 });
    }
  }

  /**
   * Record bottle test
   */
  recordBottleTest(failed: boolean) {
    this.stats.bottleTestsPerformed++;
    if (failed) {
      this.stats.bottleTestsFailed++;
    }
  }

  /**
   * Record end game die roll
   */
  recordEndGameDie() {
    this.stats.endGameDieRolls++;
  }

  /**
   * Update turn/round
   */
  updateTurn(turn: number, round: number) {
    this.stats.totalTurns = turn;
    this.stats.totalRounds = round;
  }

  /**
   * Get final statistics
   */
  getStatistics(): BattleStatistics {
    return { ...this.stats };
  }
}
