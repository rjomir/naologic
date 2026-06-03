/**
 * Scenario 2 – Shift Boundary + Maintenance Window
 *
 * WO-A starts at 09:00 on 2026-06-03 (Wednesday). The work center has a
 * maintenance window 10:00-12:00, so work pauses and resumes after. A second
 * order WO-B also spans the end-of-shift boundary, demonstrating the
 * pause-and-resume across days.
 */

import type { ReflowInput } from '../types.js';

const shifts = [
  { dayOfWeek: 1, startHour: 8, endHour: 17 },
  { dayOfWeek: 2, startHour: 8, endHour: 17 },
  { dayOfWeek: 3, startHour: 8, endHour: 17 },
  { dayOfWeek: 4, startHour: 8, endHour: 17 },
  { dayOfWeek: 5, startHour: 8, endHour: 17 },
];

export const scenario2: ReflowInput = {
  workCenters: [
    {
      docId: 'wc-assembly',
      docType: 'workCenter',
      data: {
        name: 'Assembly Station',
        shifts,
        maintenanceWindows: [
          {
            startDate: '2026-06-03T10:00:00.000Z',
            endDate: '2026-06-03T12:00:00.000Z',
            reason: 'Scheduled lubrication & calibration',
          },
        ],
      },
    },
    {
      docId: 'wc-quality',
      docType: 'workCenter',
      data: {
        name: 'Quality Control',
        shifts,
        maintenanceWindows: [],
      },
    },
  ],
  workOrders: [
    {
      // Maintenance work order — FIXED, cannot be moved
      docId: 'wo-maint-01',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'MAINT-01',
        manufacturingOrderId: 'mo-002',
        workCenterId: 'wc-assembly',
        startDate: '2026-06-03T10:00:00.000Z',
        endDate: '2026-06-03T12:00:00.000Z',
        durationMinutes: 120,
        isMaintenance: true,
        dependsOnWorkOrderIds: [],
      },
    },
    {
      // 180 min → 60 min before maintenance, 2h maintenance gap, then 120 min after
      docId: 'wo-a',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-A',
        manufacturingOrderId: 'mo-002',
        workCenterId: 'wc-assembly',
        startDate: '2026-06-03T09:00:00.000Z',
        endDate: '2026-06-03T12:00:00.000Z', // stale — misses maintenance gap
        durationMinutes: 180,
        isMaintenance: false,
        dependsOnWorkOrderIds: [],
      },
    },
    {
      // 540 min (9h) starts near end of day — must span into next morning
      docId: 'wo-b',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-B',
        manufacturingOrderId: 'mo-002',
        workCenterId: 'wc-quality',
        startDate: '2026-06-03T13:00:00.000Z',
        endDate: '2026-06-03T22:00:00.000Z', // stale
        durationMinutes: 540,
        isMaintenance: false,
        dependsOnWorkOrderIds: [],
      },
    },
    {
      // Depends on both WO-A and WO-B
      docId: 'wo-c',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-C',
        manufacturingOrderId: 'mo-002',
        workCenterId: 'wc-quality',
        startDate: '2026-06-04T09:00:00.000Z',
        endDate: '2026-06-04T11:00:00.000Z', // stale
        durationMinutes: 120,
        isMaintenance: false,
        dependsOnWorkOrderIds: ['wo-a', 'wo-b'],
      },
    },
  ],
  manufacturingOrders: [
    {
      docId: 'mo-002',
      docType: 'manufacturingOrder',
      data: {
        manufacturingOrderNumber: 'MO-002',
        itemId: 'item-valve-housing',
        quantity: 200,
        dueDate: '2026-06-06T17:00:00.000Z',
      },
    },
  ],
};
