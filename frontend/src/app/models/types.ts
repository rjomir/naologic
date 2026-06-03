// Re-export API contract types from the shared package — single source of truth
export type {
  WorkCenterDocument,
  WorkOrderDocument,
  WorkOrderStatus,
  WorkOrderChange,
  ReflowResponse,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  SseEventType,
  WorkOrderCreatedEvent,
  WorkOrderUpdatedEvent,
  WorkOrderDeletedEvent,
  WorkOrderReflowEvent,
} from '@naologic/shared';

// ── UI-only types (not shared with backend) ─────────────────────────────────

export type PanelMode = 'create' | 'edit';

export interface TimelineColumn {
  key: string;
  label: string;
  date: Date;
}
