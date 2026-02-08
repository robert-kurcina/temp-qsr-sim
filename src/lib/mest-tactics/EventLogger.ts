export enum GameEvent {
  // Navigation and Movement
  PATH_REQUESTED = 'PATH_REQUESTED',
  PATH_FOUND = 'PATH_FOUND',
  PATH_NOT_FOUND = 'PATH_NOT_FOUND',
  MOVE_ACTION_QUEUED = 'MOVE_ACTION_QUEUED',

  // Combat
  ATTACK_DECLARED = 'ATTACK_DECLARED',
  DAMAGE_DEALT = 'DAMAGE_DEALT',
  CHARACTER_DEFEATED = 'CHARACTER_DEFEATED',

  // Turn Management
  TURN_STARTED = 'TURN_STARTED',
  TURN_ENDED = 'TURN_ENDED',
}

export interface EventLog {
  type: GameEvent;
  payload: any;
  timestamp: number;
}

export class EventLogger {
  private static instance: EventLogger;
  private log: EventLog[] = [];

  private constructor() {}

  public static getInstance(): EventLogger {
    if (!EventLogger.instance) {
      EventLogger.instance = new EventLogger();
    }
    return EventLogger.instance;
  }

  public logEvent(type: GameEvent, payload: any): void {
    const timestamp = Date.now();
    this.log.push({ type, payload, timestamp });
  }

  public getLog(): EventLog[] {
    return this.log;
  }

  public clearLog(): void {
    this.log = [];
  }
}
