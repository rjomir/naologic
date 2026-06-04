// ── Primitives ──────────────────────────────────────────────────────────────

export type WorkOrderStatus = 'open' | 'in-progress' | 'complete' | 'blocked';

export interface Shift {
  dayOfWeek: number; // 0=Sunday … 6=Saturday
  startHour: number; // 0-23
  endHour: number; // 0-23
}

export interface MaintenanceWindow {
  startDate: string; // ISO UTC
  endDate: string; // ISO UTC
  reason?: string;
}

// ── API document types (what HTTP endpoints return) ─────────────────────────

export interface WorkCenterData {
  name: string;
  shifts: Shift[];
  maintenanceWindows: MaintenanceWindow[];
}

export interface WorkCenterDocument {
  docId: string;
  docType: 'workCenter';
  data: WorkCenterData;
}

export interface WorkOrderData {
  name: string;
  woNumber: string;
  workCenterId: string;
  manufacturingOrderId: string;
  status: WorkOrderStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationMinutes: number;
  setupTimeMinutes?: number;
  isMaintenance: boolean;
  dependsOnWorkOrderIds: string[];
}

export interface WorkOrderDocument {
  docId: string;
  docType: 'workOrder';
  data: WorkOrderData;
}

export interface ManufacturingOrderData {
  manufacturingOrderNumber: string;
  itemId: string;
  quantity: number;
  dueDate: string; // ISO UTC
}

export interface ManufacturingOrderDocument {
  docId: string;
  docType: 'manufacturingOrder';
  data: ManufacturingOrderData;
}

// ── Reflow contract ─────────────────────────────────────────────────────────

export interface WorkOrderChange {
  docId: string;
  workOrderNumber: string;
  originalStartDate: string;
  originalEndDate: string;
  newStartDate: string;
  newEndDate: string;
  delayMinutes: number;
  reason: string;
}

export interface ReflowResponse {
  changes: WorkOrderChange[];
  explanation: string;
  updatedCount: number;
  totalDelayMinutes: number;
  workCenterUtilization: Record<string, number>;
}

// ── Request DTOs (what the frontend sends) ──────────────────────────────────

export interface CreateWorkOrderDto {
  name: string;
  workCenterId: string;
  status: WorkOrderStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationMinutes?: number;
}

export interface UpdateWorkOrderDto {
  name?: string;
  status?: WorkOrderStatus;
  workCenterId?: string;
  startDate?: string;
  endDate?: string;
  durationMinutes?: number;
}
