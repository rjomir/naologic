/**
 * Scenario 3 – Complex Multi-Constraint
 *
 * Multiple work centers with different shift schedules, a long dependency
 * chain (WO-P → WO-Q → WO-R → WO-S), a maintenance window mid-chain, and
 * competing independent orders on the same work center that create
 * resource conflicts.
 *
 * Shifts:
 *  - Extrusion A:  Mon-Fri 06:00-14:00
 *  - CNC Machine 2: Mon-Fri 14:00-22:00  (evening shift)
 *  - Packaging:    Mon-Sat 08:00-16:00
 */

import type { ReflowInput } from '../types.js';

const morningShifts = [
  { dayOfWeek: 1, startHour: 6, endHour: 14 },
  { dayOfWeek: 2, startHour: 6, endHour: 14 },
  { dayOfWeek: 3, startHour: 6, endHour: 14 },
  { dayOfWeek: 4, startHour: 6, endHour: 14 },
  { dayOfWeek: 5, startHour: 6, endHour: 14 },
];

const eveningShifts = [
  { dayOfWeek: 1, startHour: 14, endHour: 22 },
  { dayOfWeek: 2, startHour: 14, endHour: 22 },
  { dayOfWeek: 3, startHour: 14, endHour: 22 },
  { dayOfWeek: 4, startHour: 14, endHour: 22 },
  { dayOfWeek: 5, startHour: 14, endHour: 22 },
];

const packagingShifts = [
  { dayOfWeek: 1, startHour: 8, endHour: 16 },
  { dayOfWeek: 2, startHour: 8, endHour: 16 },
  { dayOfWeek: 3, startHour: 8, endHour: 16 },
  { dayOfWeek: 4, startHour: 8, endHour: 16 },
  { dayOfWeek: 5, startHour: 8, endHour: 16 },
  { dayOfWeek: 6, startHour: 8, endHour: 16 }, // Saturday included
];

export const scenario3: ReflowInput = {
  workCenters: [
    {
      docId: 'wc-extrusion-a',
      docType: 'workCenter',
      data: {
        name: 'Extrusion Line A',
        shifts: morningShifts,
        maintenanceWindows: [
          {
            // Unplanned breakdown blocks the morning of June 4
            startDate: '2026-06-04T06:00:00.000Z',
            endDate: '2026-06-04T10:00:00.000Z',
            reason: 'Unplanned bearing replacement',
          },
        ],
      },
    },
    {
      docId: 'wc-cnc-2',
      docType: 'workCenter',
      data: {
        name: 'CNC Machine 2',
        shifts: eveningShifts,
        maintenanceWindows: [],
      },
    },
    {
      docId: 'wc-packaging',
      docType: 'workCenter',
      data: {
        name: 'Packaging Line',
        shifts: packagingShifts,
        maintenanceWindows: [],
      },
    },
  ],
  workOrders: [
    // Chain: WO-P → WO-Q → WO-R → WO-S
    {
      docId: 'wo-p',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-P',
        manufacturingOrderId: 'mo-003',
        workCenterId: 'wc-extrusion-a',
        // Start delayed to 08:00 — but maintenance runs 06:00-10:00 on June 4
        // so the reflow must push it to 10:00 on June 4
        startDate: '2026-06-04T08:00:00.000Z',
        endDate: '2026-06-04T14:00:00.000Z', // stale
        durationMinutes: 240,
        isMaintenance: false,
        dependsOnWorkOrderIds: [],
      },
    },
    {
      // Depends on WO-P, evening shift only
      docId: 'wo-q',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-Q',
        manufacturingOrderId: 'mo-003',
        workCenterId: 'wc-cnc-2',
        startDate: '2026-06-04T14:00:00.000Z',
        endDate: '2026-06-04T18:00:00.000Z', // stale
        durationMinutes: 240,
        isMaintenance: false,
        dependsOnWorkOrderIds: ['wo-p'],
      },
    },
    {
      // Independent order on CNC-2 — competes with WO-Q for the work center
      docId: 'wo-independent',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-IND',
        manufacturingOrderId: 'mo-004',
        workCenterId: 'wc-cnc-2',
        startDate: '2026-06-04T14:00:00.000Z',
        endDate: '2026-06-04T17:00:00.000Z',
        durationMinutes: 180,
        isMaintenance: false,
        dependsOnWorkOrderIds: [],
      },
    },
    {
      docId: 'wo-r',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-R',
        manufacturingOrderId: 'mo-003',
        workCenterId: 'wc-extrusion-a',
        startDate: '2026-06-05T06:00:00.000Z',
        endDate: '2026-06-05T10:00:00.000Z', // stale
        durationMinutes: 240,
        isMaintenance: false,
        dependsOnWorkOrderIds: ['wo-q'],
      },
    },
    {
      docId: 'wo-s',
      docType: 'workOrder',
      data: {
        workOrderNumber: 'WO-S',
        manufacturingOrderId: 'mo-003',
        workCenterId: 'wc-packaging',
        startDate: '2026-06-05T08:00:00.000Z',
        endDate: '2026-06-05T12:00:00.000Z', // stale
        durationMinutes: 240,
        isMaintenance: false,
        dependsOnWorkOrderIds: ['wo-r'],
      },
    },
  ],
  manufacturingOrders: [
    {
      docId: 'mo-003',
      docType: 'manufacturingOrder',
      data: {
        manufacturingOrderNumber: 'MO-003',
        itemId: 'item-pipe-bundle',
        quantity: 1000,
        dueDate: '2026-06-08T17:00:00.000Z',
      },
    },
    {
      docId: 'mo-004',
      docType: 'manufacturingOrder',
      data: {
        manufacturingOrderNumber: 'MO-004',
        itemId: 'item-coupling',
        quantity: 50,
        dueDate: '2026-06-05T17:00:00.000Z',
      },
    },
  ],
};
