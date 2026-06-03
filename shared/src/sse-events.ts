import type { WorkOrderDocument } from './api-types.js';

export type SseEventType =
  | 'connected'
  | 'work-order:created'
  | 'work-order:updated'
  | 'work-order:deleted'
  | 'work-order:reflow';

export interface WorkOrderCreatedEvent {
  workOrder: WorkOrderDocument;
}

export interface WorkOrderUpdatedEvent {
  workOrder: WorkOrderDocument;
}

export interface WorkOrderDeletedEvent {
  docId: string;
}

/** Only the orders whose dates changed — not the full list. */
export interface WorkOrderReflowEvent {
  updates: WorkOrderDocument[];
}
