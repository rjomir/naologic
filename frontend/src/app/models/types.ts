export type WorkOrderStatus = 'open' | 'in-progress' | 'complete' | 'blocked';
export type ZoomLevel = 'day' | 'week' | 'month';
export type PanelMode = 'create' | 'edit';

export interface WorkCenterDocument {
  docId: string;
  docType: 'workCenter';
  data: {
    name: string;
  };
}

export interface WorkOrderDocument {
  docId: string;
  docType: 'workOrder';
  data: {
    name: string;
    workCenterId: string;
    status: WorkOrderStatus;
    startDate: string; // ISO date YYYY-MM-DD
    endDate: string; // ISO date YYYY-MM-DD
  };
}

export interface TimelineColumn {
  key: string;
  label: string;
  date: Date;
}

export interface WorkOrderBarStyle {
  left: number; // px
  width: number; // px
}
