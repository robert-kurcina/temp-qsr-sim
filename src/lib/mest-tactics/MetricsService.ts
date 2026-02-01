
// src/lib/mest-tactics/MetricsService.ts

interface GameEvent {
  eventName: string;
  timestamp: number;
  data: object;
}

class MetricsService {
  private static instance: MetricsService;
  private events: GameEvent[] = [];

  private constructor() {}

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  public logEvent(eventName: string, data: object): void {
    const event: GameEvent = {
      eventName,
      timestamp: Date.now(),
      data,
    };
    this.events.push(event);
  }

  public getEvents(): GameEvent[] {
    return this.events;
  }

  public getEventsByName(name: string): GameEvent[] {
    return this.events.filter(e => e.eventName === name);
  }

  public clearEvents(): void {
    this.events = [];
  }
}

// Export a singleton instance
export const metricsService = MetricsService.getInstance();
