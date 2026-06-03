import type { Response } from 'express';
import type { SseEventType } from '@naologic/shared';

/**
 * Holds all open SSE client connections and broadcasts typed events.
 * A single instance is created in server.ts and injected into routers
 * that need to push updates (Observer / publish-subscribe pattern).
 */
export class SseService {
  private readonly clients = new Set<Response>();
  private readonly heartbeat: ReturnType<typeof setInterval>;

  constructor() {
    // Keep connections alive through proxies / load-balancers
    this.heartbeat = setInterval(() => {
      this.writeAll(': heartbeat\n\n');
    }, 25_000);
  }

  addClient(res: Response): void {
    this.clients.add(res);
  }

  removeClient(res: Response): void {
    this.clients.delete(res);
  }

  broadcast<T>(event: SseEventType, data: T): void {
    this.writeAll(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  get clientCount(): number {
    return this.clients.size;
  }

  destroy(): void {
    clearInterval(this.heartbeat);
    for (const res of this.clients) {
      res.end();
    }
    this.clients.clear();
  }

  private writeAll(message: string): void {
    for (const res of this.clients) {
      if (!res.writableEnded) {
        res.write(message);
      } else {
        this.clients.delete(res);
      }
    }
  }
}
