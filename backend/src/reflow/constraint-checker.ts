import { DateTime } from 'luxon';
import type { WorkOrder, WorkCenter } from '../types.js';

export interface ConstraintViolation {
  type: 'overlap' | 'dependency' | 'maintenance' | 'outside-shift' | 'circular-dependency';
  message: string;
  workOrderIds: string[];
}

/** Check that no two non-maintenance orders on the same work center overlap. */
function checkOverlaps(orders: WorkOrder[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const byCenter = new Map<string, WorkOrder[]>();

  for (const wo of orders) {
    const list = byCenter.get(wo.data.workCenterId) ?? [];
    list.push(wo);
    byCenter.set(wo.data.workCenterId, list);
  }

  for (const [, group] of byCenter) {
    const sorted = [...group].sort(
      (a, b) =>
        DateTime.fromISO(a.data.startDate).toMillis() -
        DateTime.fromISO(b.data.startDate).toMillis(),
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const aEnd = DateTime.fromISO(a.data.endDate, { zone: 'utc' });
      const bStart = DateTime.fromISO(b.data.startDate, { zone: 'utc' });

      if (aEnd > bStart) {
        violations.push({
          type: 'overlap',
          message: `${a.data.workOrderNumber} and ${b.data.workOrderNumber} overlap on work center ${a.data.workCenterId}`,
          workOrderIds: [a.docId, b.docId],
        });
      }
    }
  }

  return violations;
}

/** Check that all dependency end dates precede dependent start dates. */
function checkDependencies(orders: WorkOrder[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const byId = new Map(orders.map(wo => [wo.docId, wo]));

  for (const wo of orders) {
    for (const parentId of wo.data.dependsOnWorkOrderIds) {
      const parent = byId.get(parentId);
      if (!parent) continue;

      const parentEnd = DateTime.fromISO(parent.data.endDate, { zone: 'utc' });
      const childStart = DateTime.fromISO(wo.data.startDate, { zone: 'utc' });

      if (parentEnd > childStart) {
        violations.push({
          type: 'dependency',
          message: `${wo.data.workOrderNumber} starts before its dependency ${parent.data.workOrderNumber} ends`,
          workOrderIds: [parentId, wo.docId],
        });
      }
    }
  }

  return violations;
}

export function validateSchedule(
  orders: WorkOrder[],
  _workCenters: WorkCenter[],
): ConstraintViolation[] {
  return [...checkOverlaps(orders), ...checkDependencies(orders)];
}
