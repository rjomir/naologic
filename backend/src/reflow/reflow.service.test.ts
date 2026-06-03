import { describe, it, expect } from 'vitest';
import { ReflowService } from './reflow.service.js';
import { calculateEndDate, snapToValidWorkTime } from '../utils/date-utils.js';
import { validateSchedule } from './constraint-checker.js';
import { DateTime } from 'luxon';
import type { ReflowInput, Shift, MaintenanceWindow } from '../types.js';

const weekdayShifts: Shift[] = [
  { dayOfWeek: 1, startHour: 8, endHour: 17 },
  { dayOfWeek: 2, startHour: 8, endHour: 17 },
  { dayOfWeek: 3, startHour: 8, endHour: 17 },
  { dayOfWeek: 4, startHour: 8, endHour: 17 },
  { dayOfWeek: 5, startHour: 8, endHour: 17 },
];

const noMaintenance: MaintenanceWindow[] = [];

// ─── date-utils ─────────────────────────────────────────────────────────────

describe('calculateEndDate', () => {
  it('completes within the same shift when enough time remains', () => {
    const start = DateTime.fromISO('2026-06-01T08:00:00.000Z', { zone: 'utc' }); // Monday
    const end = calculateEndDate(start, 60, weekdayShifts, noMaintenance);
    expect(end.toISO()).toBe('2026-06-01T09:00:00.000Z');
  });

  it('pauses at shift end and resumes next morning', () => {
    // 120 min order starting at 16:15 — 45 min left in shift (16:15-17:00),
    // then 75 min on Tuesday starting at 08:00
    const start = DateTime.fromISO('2026-06-01T16:15:00.000Z', { zone: 'utc' });
    const end = calculateEndDate(start, 120, weekdayShifts, noMaintenance);
    // 45 min Mon → shift ends 17:00. Remaining 75 min Tue 08:00 → 09:15
    expect(end.toISO()).toBe('2026-06-02T09:15:00.000Z');
  });

  it('spans over a weekend (Fri afternoon → Mon morning)', () => {
    // 60 min starting Friday 16:30 (30 min left) → remaining 30 min on Monday
    const start = DateTime.fromISO('2026-06-05T16:30:00.000Z', { zone: 'utc' }); // Friday
    const end = calculateEndDate(start, 60, weekdayShifts, noMaintenance);
    expect(end.toISO()).toBe('2026-06-08T08:30:00.000Z'); // Monday
  });

  it('skips a maintenance window mid-order', () => {
    const maintenance: MaintenanceWindow[] = [
      { startDate: '2026-06-03T10:00:00.000Z', endDate: '2026-06-03T12:00:00.000Z' },
    ];
    // 180 min starting 09:00 Wed: 60 min (09-10), maintenance 10-12, 120 min (12-14)
    const start = DateTime.fromISO('2026-06-03T09:00:00.000Z', { zone: 'utc' });
    const end = calculateEndDate(start, 180, weekdayShifts, maintenance);
    expect(end.toISO()).toBe('2026-06-03T14:00:00.000Z');
  });
});

describe('snapToValidWorkTime', () => {
  it('returns the same time when already in a shift', () => {
    const dt = DateTime.fromISO('2026-06-01T10:00:00.000Z', { zone: 'utc' });
    const snapped = snapToValidWorkTime(dt, weekdayShifts, noMaintenance);
    expect(snapped.toISO()).toBe(dt.toISO());
  });

  it('snaps to next shift start when outside shift hours', () => {
    const dt = DateTime.fromISO('2026-06-01T18:00:00.000Z', { zone: 'utc' }); // 18:00 Mon
    const snapped = snapToValidWorkTime(dt, weekdayShifts, noMaintenance);
    expect(snapped.toISO()).toBe('2026-06-02T08:00:00.000Z');
  });

  it('skips over a maintenance window at shift start', () => {
    const maintenance: MaintenanceWindow[] = [
      { startDate: '2026-06-01T08:00:00.000Z', endDate: '2026-06-01T09:00:00.000Z' },
    ];
    const dt = DateTime.fromISO('2026-06-01T08:00:00.000Z', { zone: 'utc' });
    const snapped = snapToValidWorkTime(dt, weekdayShifts, maintenance);
    expect(snapped.toISO()).toBe('2026-06-01T09:00:00.000Z');
  });
});

// ─── reflow service ──────────────────────────────────────────────────────────

describe('ReflowService', () => {
  const service = new ReflowService();

  const baseInput = (): ReflowInput => ({
    workCenters: [
      {
        docId: 'wc-1',
        docType: 'workCenter',
        data: { name: 'Line 1', shifts: weekdayShifts, maintenanceWindows: [] },
      },
      {
        docId: 'wc-2',
        docType: 'workCenter',
        data: { name: 'Line 2', shifts: weekdayShifts, maintenanceWindows: [] },
      },
    ],
    manufacturingOrders: [],
    workOrders: [],
  });

  it('produces no changes for an already-valid schedule', () => {
    const input = baseInput();
    input.workOrders = [
      {
        docId: 'wo-x',
        docType: 'workOrder',
        data: {
          workOrderNumber: 'WO-X',
          manufacturingOrderId: 'mo-x',
          workCenterId: 'wc-1',
          startDate: '2026-06-01T08:00:00.000Z',
          endDate: '2026-06-01T16:00:00.000Z',
          durationMinutes: 480,
          isMaintenance: false,
          dependsOnWorkOrderIds: [],
        },
      },
    ];
    const result = service.reflow(input);
    expect(result.changes).toHaveLength(0);
  });

  it('cascades a delay through a dependency chain', () => {
    const input = baseInput();
    input.workOrders = [
      {
        docId: 'wo-parent',
        docType: 'workOrder',
        data: {
          workOrderNumber: 'WO-PARENT',
          manufacturingOrderId: 'mo-1',
          workCenterId: 'wc-1',
          startDate: '2026-06-01T10:00:00.000Z', // delayed start
          endDate: '2026-06-01T16:00:00.000Z', // stale end
          durationMinutes: 480,
          isMaintenance: false,
          dependsOnWorkOrderIds: [],
        },
      },
      {
        docId: 'wo-child',
        docType: 'workOrder',
        data: {
          workOrderNumber: 'WO-CHILD',
          manufacturingOrderId: 'mo-1',
          workCenterId: 'wc-2',
          startDate: '2026-06-01T16:00:00.000Z', // assumed parent finishes on time
          endDate: '2026-06-01T18:00:00.000Z', // stale
          durationMinutes: 120,
          isMaintenance: false,
          dependsOnWorkOrderIds: ['wo-parent'],
        },
      },
    ];

    const result = service.reflow(input);

    // Parent: 10:00 + 480 min → spans overnight → ends Tue 09:00
    const parent = result.updatedWorkOrders.find(wo => wo.docId === 'wo-parent')!;
    expect(parent.data.startDate).toBe('2026-06-01T10:00:00.000Z');
    expect(parent.data.endDate).toBe('2026-06-02T09:00:00.000Z');

    // Child: must start after parent ends (Tue 09:00) → ends 11:00
    const child = result.updatedWorkOrders.find(wo => wo.docId === 'wo-child')!;
    expect(child.data.startDate).toBe('2026-06-02T09:00:00.000Z');
    expect(child.data.endDate).toBe('2026-06-02T11:00:00.000Z');

    const violations = validateSchedule(result.updatedWorkOrders, input.workCenters);
    expect(violations).toHaveLength(0);
  });

  it('does not move maintenance work orders', () => {
    const input = baseInput();
    input.workOrders = [
      {
        docId: 'wo-maint',
        docType: 'workOrder',
        data: {
          workOrderNumber: 'MAINT-01',
          manufacturingOrderId: 'mo-x',
          workCenterId: 'wc-1',
          startDate: '2026-06-03T10:00:00.000Z',
          endDate: '2026-06-03T12:00:00.000Z',
          durationMinutes: 120,
          isMaintenance: true,
          dependsOnWorkOrderIds: [],
        },
      },
    ];
    const result = service.reflow(input);
    const maint = result.updatedWorkOrders.find(wo => wo.docId === 'wo-maint')!;
    expect(maint.data.startDate).toBe('2026-06-03T10:00:00.000Z');
    expect(maint.data.endDate).toBe('2026-06-03T12:00:00.000Z');
    expect(result.changes).toHaveLength(0);
  });

  it('throws on circular dependencies', () => {
    const input = baseInput();
    input.workOrders = [
      {
        docId: 'wo-a',
        docType: 'workOrder',
        data: {
          workOrderNumber: 'WO-A',
          manufacturingOrderId: '',
          workCenterId: 'wc-1',
          startDate: '2026-06-01T08:00:00.000Z',
          endDate: '2026-06-01T09:00:00.000Z',
          durationMinutes: 60,
          isMaintenance: false,
          dependsOnWorkOrderIds: ['wo-b'],
        },
      },
      {
        docId: 'wo-b',
        docType: 'workOrder',
        data: {
          workOrderNumber: 'WO-B',
          manufacturingOrderId: '',
          workCenterId: 'wc-2',
          startDate: '2026-06-01T08:00:00.000Z',
          endDate: '2026-06-01T09:00:00.000Z',
          durationMinutes: 60,
          isMaintenance: false,
          dependsOnWorkOrderIds: ['wo-a'],
        },
      },
    ];
    expect(() => service.reflow(input)).toThrow('Circular dependency');
  });

  it('resolves a work center conflict between two independent orders', () => {
    const input = baseInput();
    input.workOrders = [
      {
        docId: 'wo-1',
        docType: 'workOrder',
        data: {
          workOrderNumber: 'WO-1',
          manufacturingOrderId: '',
          workCenterId: 'wc-1',
          startDate: '2026-06-01T08:00:00.000Z',
          endDate: '2026-06-01T10:00:00.000Z',
          durationMinutes: 120,
          isMaintenance: false,
          dependsOnWorkOrderIds: [],
        },
      },
      {
        // Same work center, same time — must be pushed after WO-1
        docId: 'wo-2',
        docType: 'workOrder',
        data: {
          workOrderNumber: 'WO-2',
          manufacturingOrderId: '',
          workCenterId: 'wc-1',
          startDate: '2026-06-01T08:00:00.000Z',
          endDate: '2026-06-01T09:00:00.000Z',
          durationMinutes: 60,
          isMaintenance: false,
          dependsOnWorkOrderIds: [],
        },
      },
    ];

    const result = service.reflow(input);
    const violations = validateSchedule(result.updatedWorkOrders, input.workCenters);
    expect(violations).toHaveLength(0);

    const wo2 = result.updatedWorkOrders.find(wo => wo.docId === 'wo-2')!;
    // WO-2 must start at or after WO-1 ends (10:00)
    expect(
      DateTime.fromISO(wo2.data.startDate) >= DateTime.fromISO('2026-06-01T10:00:00.000Z'),
    ).toBe(true);
  });
});
