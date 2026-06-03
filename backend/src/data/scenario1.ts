/**
 * Scenario 1 – Delay Cascade
 *
 * WO-001 (Extrusion A) runs longer than planned, pushing its end from 16:00 to
 * 18:00 on 2026-06-01. WO-002 (CNC-1) depends on WO-001, so it cascades into
 * the next day. WO-003 depends on WO-002, creating a full cascade chain.
 * Shift: Mon-Fri 08:00-17:00 UTC.
 */

import type { ReflowInput } from '../types.js';

const shifts = [
  { dayOfWeek: 1, startHour: 8, endHour: 17 },
  { dayOfWeek: 2, startHour: 8, endHour: 17 },
  { dayOfWeek: 3, startHour: 8, endHour: 17 },
  { dayOfWeek: 4, startHour: 8, endHour: 17 },
  { dayOfWeek: 5, startHour: 8, endHour: 17 },
];

export const scenario1: ReflowInput = {
  workCenters: [
    {
      docId: 'wc-extrusion-a',
      docType: 'workCenter',
      data: { name: 'Extrusion Line A', shifts, maintenanceWindows: [] },
    },
    {
      docId: 'wc-cnc-1',
      docType: 'workCenter',
      data: { name: 'CNC Machine 1', shifts, maintenanceWindows: [] },
    },
    {
      docId: 'wc-assembly',
      docType: 'workCenter',
      data: { name: 'Assembly Station', shifts, maintenanceWindows: [] },
    },
  ],
  workOrders: [
    {
      docId: 'wo-001',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-001',
        manufacturingOrderId: 'mo-001',
        workCenterId: 'wc-extrusion-a',
        // Originally 08:00-16:00 (480 min). Disruption moved start to 10:00,
        // so it now needs to span into next day.
        startDate: '2026-06-01T10:00:00.000Z',
        endDate: '2026-06-01T18:00:00.000Z', // stale — reflow will fix
        durationMinutes: 480,
        isMaintenance: false,
        dependsOnWorkOrderIds: [],
      },
    },
    {
      docId: 'wo-002',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-002',
        manufacturingOrderId: 'mo-001',
        workCenterId: 'wc-cnc-1',
        startDate: '2026-06-01T16:30:00.000Z',
        endDate: '2026-06-02T09:30:00.000Z', // stale
        durationMinutes: 240,
        isMaintenance: false,
        dependsOnWorkOrderIds: ['wo-001'],
      },
    },
    {
      docId: 'wo-003',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-003',
        manufacturingOrderId: 'mo-001',
        workCenterId: 'wc-assembly',
        startDate: '2026-06-02T09:30:00.000Z',
        endDate: '2026-06-02T11:30:00.000Z', // stale
        durationMinutes: 120,
        isMaintenance: false,
        dependsOnWorkOrderIds: ['wo-002'],
      },
    },
  ],
  manufacturingOrders: [
    {
      docId: 'mo-001',
      docType: 'manufacturingOrder',
      data: {
        manufacturingOrderNumber: 'MO-001',
        itemId: 'item-pipe-32mm',
        quantity: 500,
        dueDate: '2026-06-05T17:00:00.000Z',
      },
    },
  ],
};
