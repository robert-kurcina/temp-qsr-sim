/**
 * UI Event
 * Events sent from mission runtime to UI
 */
export interface UIEvent {
  /** Event type */
  type: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Timestamp */
  timestamp?: number;
}

/**
 * UI Event Handler
 */
export type UIEventHandler = (event: UIEvent) => void;

/**
 * Mission UI Bridge
 * Connects mission runtime to web UI
 */
export class MissionUIBridge {
  private handlers: Map<string, Set<UIEventHandler>> = new Map();
  private eventQueue: UIEvent[] = [];
  private connected: boolean = false;

  /**
   * Register event handler
   */
  on(eventType: string, handler: UIEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  /**
   * Remove event handler
   */
  off(eventType: string, handler: UIEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Emit event to all handlers
   */
  emit(event: UIEvent): void {
    const timestamp = Date.now();
    const eventWithTime: UIEvent = { ...event, timestamp };

    if (this.connected) {
      // Send to handlers immediately
      const handlers = this.handlers.get(event.type) ?? new Set();
      for (const handler of handlers) {
        handler(eventWithTime);
      }
    } else {
      // Queue event for later
      this.eventQueue.push(eventWithTime);
    }
  }

  /**
   * Connect bridge (start sending events)
   */
  connect(): void {
    this.connected = true;
    
    // Flush queued events
    for (const event of this.eventQueue) {
      const handlers = this.handlers.get(event.type) ?? new Set();
      for (const handler of handlers) {
        handler(event);
      }
    }
    this.eventQueue = [];
  }

  /**
   * Disconnect bridge (queue events)
   */
  disconnect(): void {
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get queued event count
   */
  getQueuedEventCount(): number {
    return this.eventQueue.length;
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * UI Event Type Constants
 */
export const UIEventTypes = {
  // Mission lifecycle
  MISSION_STARTED: 'mission.started',
  MISSION_ENDED: 'mission.ended',
  MISSION_PAUSED: 'mission.paused',
  MISSION_RESUMED: 'mission.resumed',
  
  // Game flow
  GAME_TURN_STARTED: 'game.turn_started',
  GAME_TURN_ENDED: 'game.turn_ended',
  GAME_PHASE_CHANGED: 'game.phase_changed',
  GAME_VP_CHANGED: 'game.vp_changed',
  
  // Combat
  COMBAT_STARTED: 'combat.started',
  COMBAT_ENDED: 'combat.ended',
  COMBAT_HIT_ROLLED: 'combat.hit_rolled',
  COMBAT_WOUND_ROLLED: 'combat.wound_rolled',
  COMBAT_MODEL_ELIMINATED: 'combat.model_eliminated',
  
  // Movement
  MOVEMENT_STARTED: 'movement.started',
  MOVEMENT_ENDED: 'movement.ended',
  MOVEMENT_VALIDATED: 'movement.validated',
  MOVEMENT_INVALID: 'movement.invalid',
  
  // Special rules
  SPECIAL_RULE_TRIGGERED: 'special_rule.triggered',
  SPECIAL_RULE_ALERT_CHANGED: 'special_rule.alert_changed',
  SPECIAL_RULE_THREAT_CHANGED: 'special_rule.threat_changed',
  SPECIAL_RULE_MECHANISM_ACTIVATED: 'special_rule.mechanism_activated',
  SPECIAL_RULE_COMMANDER_DESIGNATED: 'special_rule.commander_designated',
  SPECIAL_RULE_COMMANDER_ELIMINATED: 'special_rule.commander_eliminated',
  SPECIAL_RULE_REINFORCEMENTS_ARRIVED: 'special_rule.reinforcements_arrived',
  SPECIAL_RULE_CACHE_ACQUIRED: 'special_rule.cache_acquired',
  SPECIAL_RULE_CACHE_EXTRACTED: 'special_rule.cache_extracted',
  SPECIAL_RULE_OBJECT_FOUND: 'special_rule.object_found',
  SPECIAL_RULE_OBJECT_IDENTIFIED: 'special_rule.object_identified',
  SPECIAL_RULE_BREAKTHROUGH_TRIGGERED: 'special_rule.breakthrough_triggered',
  
  // Zones
  ZONE_CAPTURED: 'zone.captured',
  ZONE_CONTESTED: 'zone.contested',
  ZONE_CONTROL_CHANGED: 'zone.control_changed',
  
  // Player actions
  PLAYER_ACTION_STARTED: 'player.action_started',
  PLAYER_ACTION_COMPLETED: 'player.action_completed',
  PLAYER_ACTION_INVALID: 'player.action_invalid',
  
  // UI state
  UI_SELECTION_CHANGED: 'ui.selection_changed',
  UI_HOVER_CHANGED: 'ui.hover_changed',
  UI_CAMERA_MOVED: 'ui.camera_moved',
  UI_PANEL_OPENED: 'ui.panel_opened',
  UI_PANEL_CLOSED: 'ui.panel_closed',
  
  // Notifications
  NOTIFICATION_INFO: 'notification.info',
  NOTIFICATION_WARNING: 'notification.warning',
  NOTIFICATION_ERROR: 'notification.error',
  NOTIFICATION_VICTORY: 'notification.victory',
} as const;

/**
 * Create UI event payload helpers
 */
export const UIPayloads = {
  /**
   * Create VP change payload
   */
  vpChanged: (sideId: string, amount: number, total: number, reason?: string) => ({
    sideId,
    amount,
    total,
    reason,
  }),

  /**
   * Create turn payload
   */
  turn: (turn: number, round?: number) => ({
    turn,
    round: round ?? 1,
  }),

  /**
   * Create combat payload
   */
  combat: (attackerId: string, targetId: string, hit?: boolean, wound?: boolean) => ({
    attackerId,
    targetId,
    hit,
    wound,
  }),

  /**
   * Create movement payload
   */
  movement: (modelId: string, from: { x: number; y: number }, to: { x: number; y: number }, valid: boolean) => ({
    modelId,
    from,
    to,
    valid,
  }),

  /**
   * Create zone payload
   */
  zone: (zoneId: string, controller?: string, contested?: boolean) => ({
    zoneId,
    controller,
    contested: contested ?? false,
  }),

  /**
   * Create notification payload
   */
  notification: (message: string, type: 'info' | 'warning' | 'error' | 'victory' = 'info') => ({
    message,
    type,
  }),

  /**
   * Create victory payload
   */
  victory: (winner: string, reason: string, vpStandings?: Array<{ sideId: string; vp: number }>) => ({
    winner,
    reason,
    vpStandings,
  }),
};
