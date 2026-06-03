import type { WorkCenterDocument, WorkOrderDocument } from '../models/types';

export const WORK_CENTERS: WorkCenterDocument[] = [
  {
    docId: 'wc-extrusion-a',
    docType: 'workCenter',
    data: { name: 'Extrusion Line A', shifts: [], maintenanceWindows: [] },
  },
  {
    docId: 'wc-cnc-1',
    docType: 'workCenter',
    data: { name: 'CNC Machine 1', shifts: [], maintenanceWindows: [] },
  },
  {
    docId: 'wc-assembly',
    docType: 'workCenter',
    data: { name: 'Assembly Station', shifts: [], maintenanceWindows: [] },
  },
  {
    docId: 'wc-quality',
    docType: 'workCenter',
    data: { name: 'Quality Control', shifts: [], maintenanceWindows: [] },
  },
  {
    docId: 'wc-packaging',
    docType: 'workCenter',
    data: { name: 'Packaging Line', shifts: [], maintenanceWindows: [] },
  },
];

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function sampleOrder(
  docId: string,
  name: string,
  workCenterId: string,
  status: WorkOrderDocument['data']['status'],
  startOffset: number,
  endOffset: number,
): WorkOrderDocument {
  return {
    docId,
    docType: 'workOrder',
    data: {
      name,
      woNumber: docId.toUpperCase(),
      workCenterId,
      manufacturingOrderId: 'mo-sample',
      status,
      startDate: daysFromToday(startOffset),
      endDate: daysFromToday(endOffset),
      durationMinutes: (endOffset - startOffset) * 8 * 60,
      isMaintenance: false,
      dependsOnWorkOrderIds: [],
    },
  };
}

export const WORK_ORDERS: WorkOrderDocument[] = [
  sampleOrder('wo-001', 'Pipe Batch #A1', 'wc-extrusion-a', 'complete', -10, -7),
  sampleOrder('wo-002', 'Pipe Batch #A2', 'wc-extrusion-a', 'in-progress', -3, 4),
  sampleOrder('wo-003', 'Shaft Milling', 'wc-cnc-1', 'complete', -8, -5),
  sampleOrder('wo-004', 'Coupling Finish', 'wc-cnc-1', 'open', 2, 6),
  sampleOrder('wo-005', 'Valve Assembly', 'wc-assembly', 'in-progress', -2, 3),
  sampleOrder('wo-006', 'Bracket Assembly', 'wc-assembly', 'blocked', 5, 9),
  sampleOrder('wo-007', 'Dimensional Check', 'wc-quality', 'complete', -6, -3),
  sampleOrder('wo-008', 'Final Inspection', 'wc-quality', 'open', 4, 8),
  sampleOrder('wo-009', 'Retail Pack Run', 'wc-packaging', 'blocked', -1, 5),
];
