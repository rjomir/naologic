export type WorkOrderStatus = 'open' | 'in-progress' | 'complete' | 'blocked';

export interface Shift {
  dayOfWeek: number; // 0=Sunday, 1=Monday ... 6=Saturday
  startHour: number; // 0-23
  endHour: number; // 0-23
}

export interface MaintenanceWindow {
  startDate: string; // ISO UTC
  endDate: string; // ISO UTC
  reason?: string;
}

export interface WorkOrderData {
  workOrderNumber: string;
  manufacturingOrderId: string;
  workCenterId: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  setupTimeMinutes?: number;
  isMaintenance: boolean;
  dependsOnWorkOrderIds: string[];
}

export interface WorkCenterData {
  name: string;
  shifts: Shift[];
  maintenanceWindows: MaintenanceWindow[];
}

export interface ManufacturingOrderData {
  manufacturingOrderNumber: string;
  itemId: string;
  quantity: number;
  dueDate: string;
}

export interface WorkOrder {
  docId: string;
  docType: 'workOrder';
  data: WorkOrderData;
}

export interface WorkCenter {
  docId: string;
  docType: 'workCenter';
  data: WorkCenterData;
}

export interface ManufacturingOrder {
  docId: string;
  docType: 'manufacturingOrder';
  data: ManufacturingOrderData;
}

export interface ReflowInput {
  workOrders: WorkOrder[];
  workCenters: WorkCenter[];
  manufacturingOrders: ManufacturingOrder[];
}

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

export interface ReflowResult {
  updatedWorkOrders: WorkOrder[];
  changes: WorkOrderChange[];
  explanation: string;
  /** Sum of all positive delay minutes across rescheduled orders */
  totalDelayMinutes: number;
  /** Per-work-center ratio of scheduled working minutes to available shift minutes */
  workCenterUtilization: Record<string, number>;
}
