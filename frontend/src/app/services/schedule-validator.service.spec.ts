import { describe, it, expect } from 'vitest';
import { ScheduleValidatorService } from './schedule-validator.service';
import type { WorkOrderDocument } from '../models/types';

const svc = new ScheduleValidatorService();

function makeOrder(
  docId: string,
  workCenterId: string,
  startDate: string,
  endDate: string,
): WorkOrderDocument {
  return {
    docId,
    docType: 'workOrder',
    data: {
      name: `Order ${docId}`,
      woNumber: docId,
      workCenterId,
      manufacturingOrderId: 'mo-1',
      status: 'open',
      startDate,
      endDate,
      durationMinutes: 480,
      isMaintenance: false,
      dependsOnWorkOrderIds: [],
    },
  };
}

describe('ScheduleValidatorService.checkOverlap', () => {
  it('returns null when there are no orders', () => {
    expect(svc.checkOverlap([], '2026-06-01', '2026-06-05', 'wc-1')).toBeNull();
  });

  it('returns null when the existing order is on a different work center', () => {
    const orders = [makeOrder('wo-1', 'wc-2', '2026-06-01', '2026-06-10')];
    expect(svc.checkOverlap(orders, '2026-06-01', '2026-06-10', 'wc-1')).toBeNull();
  });

  it('returns null when new order ends exactly when existing starts (touching boundary)', () => {
    const orders = [makeOrder('wo-1', 'wc-1', '2026-06-05', '2026-06-10')];
    // end === wStart → (end > wStart) is false → no overlap
    expect(svc.checkOverlap(orders, '2026-06-01', '2026-06-05', 'wc-1')).toBeNull();
  });

  it('returns null when new order starts exactly when existing ends (touching boundary)', () => {
    const orders = [makeOrder('wo-1', 'wc-1', '2026-06-01', '2026-06-05')];
    // start === wEnd → (start < wEnd) is false → no overlap
    expect(svc.checkOverlap(orders, '2026-06-05', '2026-06-10', 'wc-1')).toBeNull();
  });

  it('returns null when orders are completely non-overlapping', () => {
    const orders = [makeOrder('wo-1', 'wc-1', '2026-06-01', '2026-06-03')];
    expect(svc.checkOverlap(orders, '2026-06-05', '2026-06-10', 'wc-1')).toBeNull();
  });

  it('returns error string when ranges partially overlap', () => {
    const orders = [makeOrder('wo-1', 'wc-1', '2026-06-01', '2026-06-10')];
    const result = svc.checkOverlap(orders, '2026-06-05', '2026-06-15', 'wc-1');
    expect(result).toBe('Overlaps with "Order wo-1"');
  });

  it('returns error string when new order fully contains an existing order', () => {
    const orders = [makeOrder('wo-1', 'wc-1', '2026-06-03', '2026-06-05')];
    const result = svc.checkOverlap(orders, '2026-06-01', '2026-06-10', 'wc-1');
    expect(result).not.toBeNull();
  });

  it('returns null for the excluded docId (self-edit case)', () => {
    const orders = [makeOrder('wo-1', 'wc-1', '2026-06-01', '2026-06-10')];
    expect(svc.checkOverlap(orders, '2026-06-01', '2026-06-10', 'wc-1', 'wo-1')).toBeNull();
  });

  it('still detects conflict with other orders when one is excluded', () => {
    const orders = [
      makeOrder('wo-1', 'wc-1', '2026-06-01', '2026-06-10'),
      makeOrder('wo-2', 'wc-1', '2026-06-05', '2026-06-15'),
    ];
    // wo-1 is excluded (self); wo-2 still overlaps
    const result = svc.checkOverlap(orders, '2026-06-01', '2026-06-10', 'wc-1', 'wo-1');
    expect(result).not.toBeNull();
  });
});
