import { Injectable } from '@angular/core';
import type { WorkOrderDocument } from '../models/types';

/** Pure scheduling validation — no HTTP, no state, easily unit-tested. */
@Injectable({ providedIn: 'root' })
export class ScheduleValidatorService {
  checkOverlap(
    orders: WorkOrderDocument[],
    startDate: string,
    endDate: string,
    workCenterId: string,
    excludeId?: string,
  ): string | null {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    for (const wo of orders.filter(o => o.data.workCenterId === workCenterId)) {
      if (wo.docId === excludeId) continue;
      const wStart = new Date(wo.data.startDate).getTime();
      const wEnd = new Date(wo.data.endDate).getTime();
      if (start < wEnd && end > wStart) return `Overlaps with "${wo.data.name}"`;
    }
    return null;
  }
}
