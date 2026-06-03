import { DateTime } from 'luxon';
import { calculateEndDate, snapToValidWorkTime } from '../utils/date-utils.js';
import type { ReflowInput, ReflowResult, WorkOrder, WorkOrderChange, Shift } from '../types.js';

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------

function topologicalSort(orders: WorkOrder[]): WorkOrder[] {
  const idToOrder = new Map(orders.map(wo => [wo.docId, wo]));
  const inDegree = new Map(orders.map(wo => [wo.docId, 0]));
  const dependents = new Map<string, string[]>(); // parentId → child ids

  for (const wo of orders) {
    for (const parentId of wo.data.dependsOnWorkOrderIds) {
      if (!idToOrder.has(parentId)) continue;
      inDegree.set(wo.docId, (inDegree.get(wo.docId) ?? 0) + 1);
      const list = dependents.get(parentId) ?? [];
      list.push(wo.docId);
      dependents.set(parentId, list);
    }
  }

  // Seed with nodes that have no dependencies, sorted by original start date
  const ready = orders
    .filter(wo => (inDegree.get(wo.docId) ?? 0) === 0)
    .sort(
      (a, b) =>
        DateTime.fromISO(a.data.startDate).toMillis() -
        DateTime.fromISO(b.data.startDate).toMillis(),
    );

  const result: WorkOrder[] = [];
  const queue = [...ready];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    const children = dependents.get(current.docId) ?? [];
    for (const childId of children) {
      const newDeg = (inDegree.get(childId) ?? 1) - 1;
      inDegree.set(childId, newDeg);
      if (newDeg === 0) {
        const child = idToOrder.get(childId)!;
        // Insert sorted by original start date among ready nodes
        const insertAt = queue.findIndex(
          q =>
            DateTime.fromISO(q.data.startDate).toMillis() >
            DateTime.fromISO(child.data.startDate).toMillis(),
        );
        if (insertAt === -1) queue.push(child);
        else queue.splice(insertAt, 0, child);
      }
    }
  }

  if (result.length !== orders.length) {
    throw new Error('Circular dependency detected: cannot produce a valid topological order');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Reason builder
// ---------------------------------------------------------------------------

function buildReason(
  wo: WorkOrder,
  newStart: DateTime,
  originalStart: DateTime,
  dependencyEndDates: Map<string, DateTime>,
  wcLastEnd: DateTime | undefined,
  updatedOrders: Map<string, WorkOrder>,
): string {
  const reasons: string[] = [];

  if (wo.data.dependsOnWorkOrderIds.length > 0) {
    for (const parentId of wo.data.dependsOnWorkOrderIds) {
      const parentEnd = dependencyEndDates.get(parentId);
      const originalParentEnd = updatedOrders.get(parentId)?.data.endDate;
      if (parentEnd && originalParentEnd) {
        const delay = parentEnd.diff(
          DateTime.fromISO(originalParentEnd, { zone: 'utc' }),
          'minutes',
        ).minutes;
        if (delay > 0) {
          const parent = updatedOrders.get(parentId);
          reasons.push(
            `dependency ${parent?.data.workOrderNumber ?? parentId} delayed by ${delay.toFixed(0)} min`,
          );
        }
      }
    }
  }

  if (wcLastEnd && wcLastEnd > originalStart) {
    reasons.push(`work center occupied until ${wcLastEnd.toISO()}`);
  }

  if (reasons.length === 0) {
    const diffMin = newStart.diff(originalStart, 'minutes').minutes;
    if (diffMin > 0) {
      reasons.push(`rescheduled ${diffMin.toFixed(0)} min later to satisfy constraints`);
    } else {
      reasons.push('end date recalculated to respect shift boundaries');
    }
  }

  return reasons.join('; ');
}

// ---------------------------------------------------------------------------
// Main reflow service
// ---------------------------------------------------------------------------

export class ReflowService {
  reflow(input: ReflowInput): ReflowResult {
    const { workOrders, workCenters } = input;

    const wcMap = new Map(workCenters.map(wc => [wc.docId, wc]));

    // Sort: maintenance orders first (fixed), then by dependency + start date
    const maintenanceOrders = workOrders.filter(wo => wo.data.isMaintenance);
    const movableOrders = workOrders.filter(wo => !wo.data.isMaintenance);

    const sortedMovable = topologicalSort(movableOrders);

    // Track per-work-center last scheduled end time
    // Seed with maintenance order windows so they are treated as blocked slots
    const wcLastEnd = new Map<string, DateTime>();
    for (const maint of maintenanceOrders) {
      const existing = wcLastEnd.get(maint.data.workCenterId);
      const end = DateTime.fromISO(maint.data.endDate, { zone: 'utc' });
      if (!existing || end > existing) {
        wcLastEnd.set(maint.data.workCenterId, end);
      }
    }

    // Mutable copy of all orders (maintenance orders don't move)
    const updatedOrders = new Map<string, WorkOrder>(
      workOrders.map(wo => [wo.docId, { ...wo, data: { ...wo.data } }]),
    );

    const changes: WorkOrderChange[] = [];

    for (const wo of sortedMovable) {
      const wc = wcMap.get(wo.data.workCenterId);
      if (!wc) continue;

      // Earliest possible start = max of all parent end dates
      let earliestStart = DateTime.fromISO(wo.data.startDate, { zone: 'utc' });

      const dependencyEnds = new Map<string, DateTime>();
      for (const parentId of wo.data.dependsOnWorkOrderIds) {
        const parent = updatedOrders.get(parentId);
        if (!parent) continue;
        const parentEnd = DateTime.fromISO(parent.data.endDate, { zone: 'utc' });
        dependencyEnds.set(parentId, parentEnd);
        if (parentEnd > earliestStart) earliestStart = parentEnd;
      }

      // Also respect work center availability
      const wcEnd = wcLastEnd.get(wo.data.workCenterId);
      if (wcEnd && wcEnd > earliestStart) earliestStart = wcEnd;

      // Snap to valid work time (shift + maintenance-aware)
      const newStart = snapToValidWorkTime(
        earliestStart,
        wc.data.shifts,
        wc.data.maintenanceWindows,
      );

      // Calculate end date consuming effective working time (production + setup)
      const effectiveDuration = wo.data.durationMinutes + (wo.data.setupTimeMinutes ?? 0);
      const newEnd = calculateEndDate(
        newStart,
        effectiveDuration,
        wc.data.shifts,
        wc.data.maintenanceWindows,
      );

      // Update work center occupancy
      wcLastEnd.set(wo.data.workCenterId, newEnd);

      const originalStart = wo.data.startDate;
      const originalEnd = wo.data.endDate;
      const newStartStr = newStart.toISO()!;
      const newEndStr = newEnd.toISO()!;

      // Record change if anything moved
      if (newStartStr !== originalStart || newEndStr !== originalEnd) {
        const origEndDt = DateTime.fromISO(originalEnd, { zone: 'utc' });
        const delayMin = newEnd.diff(origEndDt, 'minutes').minutes;
        changes.push({
          docId: wo.docId,
          workOrderNumber: wo.data.workOrderNumber,
          originalStartDate: originalStart,
          originalEndDate: originalEnd,
          newStartDate: newStartStr,
          newEndDate: newEndStr,
          delayMinutes: Math.round(delayMin),
          reason: buildReason(
            wo,
            newStart,
            DateTime.fromISO(originalStart, { zone: 'utc' }),
            dependencyEnds,
            wcEnd,
            updatedOrders,
          ),
        });
      }

      updatedOrders.set(wo.docId, {
        ...wo,
        data: { ...wo.data, startDate: newStartStr, endDate: newEndStr },
      });
    }

    const allUpdated = Array.from(updatedOrders.values());

    // Optimization metrics
    const totalDelayMinutes = changes.reduce((s, c) => s + Math.max(0, c.delayMinutes), 0);

    const workCenterUtilization: Record<string, number> = {};
    for (const wc of workCenters) {
      const wcOrders = allUpdated.filter(wo => wo.data.workCenterId === wc.docId);
      if (wcOrders.length === 0) continue;
      const scheduledMin = wcOrders.reduce(
        (s, wo) => s + wo.data.durationMinutes + (wo.data.setupTimeMinutes ?? 0),
        0,
      );
      const earliest = DateTime.fromISO(wcOrders.map(wo => wo.data.startDate).sort()[0], {
        zone: 'utc',
      });
      const latest = DateTime.fromISO(
        wcOrders
          .map(wo => wo.data.endDate)
          .sort()
          .at(-1)!,
        { zone: 'utc' },
      );
      const available = availableMinutesInRange(earliest, latest, wc.data.shifts);
      workCenterUtilization[wc.docId] = available > 0 ? Math.min(1, scheduledMin / available) : 0;
    }

    return {
      updatedWorkOrders: allUpdated,
      changes,
      explanation: buildExplanation(changes),
      totalDelayMinutes,
      workCenterUtilization,
    };
  }
}

function availableMinutesInRange(from: DateTime, to: DateTime, shifts: Shift[]): number {
  let total = 0;
  let day = from.startOf('day');
  while (day <= to.startOf('day')) {
    const specDay = day.weekday === 7 ? 0 : day.weekday;
    const shift = shifts.find(s => s.dayOfWeek === specDay);
    if (shift) {
      const shiftStart = day.set({ hour: shift.startHour, minute: 0, second: 0, millisecond: 0 });
      const shiftEnd = day.set({ hour: shift.endHour, minute: 0, second: 0, millisecond: 0 });
      const effectiveStart = shiftStart > from ? shiftStart : from;
      const effectiveEnd = shiftEnd < to ? shiftEnd : to;
      if (effectiveEnd > effectiveStart) {
        total += effectiveEnd.diff(effectiveStart, 'minutes').minutes;
      }
    }
    day = day.plus({ days: 1 });
  }
  return total;
}

function buildExplanation(changes: WorkOrderChange[]): string {
  if (changes.length === 0) return 'Schedule is already valid. No changes required.';

  const lines = [
    `Reflow completed. ${changes.length} work order(s) rescheduled:\n`,
    ...changes.map(
      c =>
        `  • ${c.workOrderNumber}: moved ${c.delayMinutes >= 0 ? '+' : ''}${c.delayMinutes} min\n` +
        `    Was: ${c.originalStartDate} → ${c.originalEndDate}\n` +
        `    Now: ${c.newStartDate} → ${c.newEndDate}\n` +
        `    Reason: ${c.reason}`,
    ),
  ];

  return lines.join('\n');
}
