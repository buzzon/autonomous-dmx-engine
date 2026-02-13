import { EventEmitter } from "events";
import { defaultLogger } from "../utils/logger";

export type EventMap = {
  "audio:processed": (metrics: any) => void;
  "brain:state-changed": (state: any) => void;
  "lighting:update": (output: any) => void;
  "system:error": (error: Error) => void;
  "config:reloaded": () => void;
};

export class EventBus extends EventEmitter {
  private logger = defaultLogger.child({ module: "EventBus" });

  constructor() {
    super();
    this.setMaxListeners(20); // Increase limit for complex systems
  }

  public emit<K extends keyof EventMap>(
    event: K,
    ...args: Parameters<EventMap[K]>
  ): boolean {
    // this.logger.debug(`Emitting event: ${event}`);
    return super.emit(event, ...args);
  }

  public on<K extends keyof EventMap>(event: K, listener: EventMap[K]): this {
    return super.on(event, listener);
  }

  public off<K extends keyof EventMap>(event: K, listener: EventMap[K]): this {
    return super.off(event, listener);
  }
}

export const globalEventBus = new EventBus();
