import type { WorkCenterDocument, WorkOrderDocument } from '../models/types';

export const WORK_CENTERS: WorkCenterDocument[] = [
  { docId: 'wc-extrusion-a', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
  { docId: 'wc-cnc-1', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
  { docId: 'wc-assembly', docType: 'workCenter', data: { name: 'Assembly Station' } },
  { docId: 'wc-quality', docType: 'workCenter', data: { name: 'Quality Control' } },
  { docId: 'wc-packaging', docType: 'workCenter', data: { name: 'Packaging Line' } },
];

// Dates relative to today so the timeline always looks populated
function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const WORK_ORDERS: WorkOrderDocument[] = [
  {
    docId: 'wo-001',
    docType: 'workOrder',
    data: {
      name: 'Pipe Batch #A1',
      workCenterId: 'wc-extrusion-a',
      status: 'complete',
      startDate: daysFromToday(-10),
      endDate: daysFromToday(-7),
    },
  },
  {
    docId: 'wo-002',
    docType: 'workOrder',
    data: {
      name: 'Pipe Batch #A2',
      workCenterId: 'wc-extrusion-a',
      status: 'in-progress',
      startDate: daysFromToday(-3),
      endDate: daysFromToday(4),
    },
  },
  {
    docId: 'wo-003',
    docType: 'workOrder',
    data: {
      name: 'Shaft Milling',
      workCenterId: 'wc-cnc-1',
      status: 'complete',
      startDate: daysFromToday(-8),
      endDate: daysFromToday(-5),
    },
  },
  {
    docId: 'wo-004',
    docType: 'workOrder',
    data: {
      name: 'Coupling Finish',
      workCenterId: 'wc-cnc-1',
      status: 'open',
      startDate: daysFromToday(2),
      endDate: daysFromToday(6),
    },
  },
  {
    docId: 'wo-005',
    docType: 'workOrder',
    data: {
      name: 'Valve Assembly',
      workCenterId: 'wc-assembly',
      status: 'in-progress',
      startDate: daysFromToday(-2),
      endDate: daysFromToday(3),
    },
  },
  {
    docId: 'wo-006',
    docType: 'workOrder',
    data: {
      name: 'Bracket Assembly',
      workCenterId: 'wc-assembly',
      status: 'blocked',
      startDate: daysFromToday(5),
      endDate: daysFromToday(9),
    },
  },
  {
    docId: 'wo-007',
    docType: 'workOrder',
    data: {
      name: 'Dimensional Check',
      workCenterId: 'wc-quality',
      status: 'complete',
      startDate: daysFromToday(-6),
      endDate: daysFromToday(-3),
    },
  },
  {
    docId: 'wo-008',
    docType: 'workOrder',
    data: {
      name: 'Final Inspection',
      workCenterId: 'wc-quality',
      status: 'open',
      startDate: daysFromToday(4),
      endDate: daysFromToday(8),
    },
  },
  {
    docId: 'wo-009',
    docType: 'workOrder',
    data: {
      name: 'Retail Pack Run',
      workCenterId: 'wc-packaging',
      status: 'blocked',
      startDate: daysFromToday(-1),
      endDate: daysFromToday(5),
    },
  },
];
