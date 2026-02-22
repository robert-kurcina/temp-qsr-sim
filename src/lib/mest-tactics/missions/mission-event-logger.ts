/**
 * Event Log Entry
 */
export interface EventLogEntry {
  /** Event type */
  type: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Turn number when event occurred */
  turn?: number;
  /** Event data */
  data: Record<string, unknown>;
}

/**
 * Complete Event Log
 */
export interface EventLog {
  /** Mission ID */
  missionId: string;
  /** Start timestamp */
  startedAt: number;
  /** End timestamp */
  endedAt?: number;
  /** All events */
  events: EventLogEntry[];
  /** Final state summary */
  summary?: {
    winner?: string;
    totalTurns: number;
    vpBySide: Record<string, number>;
  };
}

/**
 * Mission Event Logger
 * Records all mission events for replay and analysis
 */
export class MissionEventLogger {
  private events: EventLogEntry[] = [];
  private missionId: string = '';
  private startedAt: number = 0;
  private endedAt?: number;

  /**
   * Set mission ID
   */
  setMissionId(missionId: string): void {
    this.missionId = missionId;
  }

  /**
   * Start logging
   */
  start(): void {
    this.startedAt = Date.now();
    this.events = [];
    
    this.log({
      type: 'system.start',
      timestamp: this.startedAt,
      data: { missionId: this.missionId },
    });
  }

  /**
   * End logging
   */
  end(summary?: EventLog['summary']): void {
    this.endedAt = Date.now();
    
    this.log({
      type: 'system.end',
      timestamp: this.endedAt,
      data: { summary },
    });
  }

  /**
   * Log an event
   */
  log(entry: Omit<EventLogEntry, 'turn'> & { turn?: number }): void {
    this.events.push({
      ...entry,
      turn: entry.turn,
    });
  }

  /**
   * Get complete event log
   */
  getLog(): EventLog {
    return {
      missionId: this.missionId,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      events: [...this.events],
    };
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string): EventLogEntry[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get events for a specific turn
   */
  getEventsForTurn(turn: number): EventLogEntry[] {
    return this.events.filter(e => e.turn === turn);
  }

  /**
   * Export log as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.getLog(), null, 2);
  }

  /**
   * Import log from JSON
   */
  importJSON(json: string): void {
    const log = JSON.parse(json) as EventLog;
    this.missionId = log.missionId;
    this.startedAt = log.startedAt;
    this.endedAt = log.endedAt;
    this.events = log.events;
  }

  /**
   * Get replay summary
   */
  getSummary(): {
    totalEvents: number;
    totalTurns: number;
    duration: number;
    eventTypes: Record<string, number>;
  } {
    const eventTypes = this.events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const turns = this.events.map(e => e.turn ?? 0).filter(t => t > 0);
    const maxTurn = Math.max(...turns, 0);

    return {
      totalEvents: this.events.length,
      totalTurns: maxTurn,
      duration: (this.endedAt ?? Date.now()) - this.startedAt,
      eventTypes,
    };
  }
}

/**
 * Event Type Constants
 */
export const EventTypes = {
  // System events
  SYSTEM_START: 'system.start',
  SYSTEM_END: 'system.end',
  SYSTEM_INIT: 'system.init',
  
  // Game flow events
  GAME_START: 'game.start',
  GAME_END: 'game.end',
  GAME_TURN_START: 'game.turn_start',
  GAME_TURN_END: 'game.turn_end',
  GAME_VP_AWARDED: 'game.vp_awarded',
  GAME_VP_CHANGED: 'game.vp_changed',
  
  // Combat events
  COMBAT_MODEL_ELIMINATED: 'combat.model_eliminated',
  COMBAT_HIT: 'combat.hit',
  COMBAT_WOUND: 'combat.wound',
  
  // Special rule events
  SPECIAL_RULE_EVENT: 'special_rule.event',
  SPECIAL_RULE_REINFORCEMENT: 'special_rule.reinforcement',
  SPECIAL_RULE_ALERT: 'special_rule.alert',
  SPECIAL_RULE_THREAT: 'special_rule.threat',
  SPECIAL_RULE_COURIER: 'special_rule.courier',
  SPECIAL_RULE_MECHANISM: 'special_rule.mechanism',
  SPECIAL_RULE_COMMANDER: 'special_rule.commander',
  SPECIAL_RULE_TIME_PRESSURE: 'special_rule.time_pressure',
  SPECIAL_RULE_HARVEST: 'special_rule.harvest',
  SPECIAL_RULE_HIDDEN_OBJECT: 'special_rule.hidden_object',
  SPECIAL_RULE_BREAKTHROUGH: 'special_rule.breakthrough',
  SPECIAL_RULE_VIGILANCE: 'special_rule.vigilance',
  
  // Movement events
  MOVE_MODEL: 'move.model',
  MOVE_ENGAGEMENT: 'move.engagement',
  
  // Zone events
  ZONE_CAPTURED: 'zone.captured',
  ZONE_CONTESTED: 'zone.contested',
  ZONE_CONTROLLED: 'zone.controlled',
} as const;
