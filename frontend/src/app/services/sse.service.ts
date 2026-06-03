import { Injectable, inject, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../tokens/api-url.token';
import type { SseEventType } from '../models/types';

/**
 * Wraps the browser EventSource API.
 * A single connection is shared across all listeners; the browser
 * auto-reconnects on network interruptions.
 */
@Injectable({ providedIn: 'root' })
export class SseService implements OnDestroy {
  private readonly apiUrl = inject(API_URL);
  private source: EventSource | null = null;

  private getSource(): EventSource {
    if (!this.source || this.source.readyState === EventSource.CLOSED) {
      this.source = new EventSource(`${this.apiUrl}/events`);
    }
    return this.source;
  }

  /** Returns an Observable that emits every time the named SSE event fires. */
  listen<T>(eventType: SseEventType): Observable<T> {
    return new Observable<T>(subscriber => {
      const source = this.getSource();

      const handler = (e: Event): void => {
        try {
          subscriber.next(JSON.parse((e as MessageEvent<string>).data) as T);
        } catch {
          // non-fatal — malformed frame, skip
        }
      };

      source.addEventListener(eventType, handler);

      return () => {
        source.removeEventListener(eventType, handler);
      };
    });
  }

  ngOnDestroy(): void {
    this.source?.close();
    this.source = null;
  }
}
