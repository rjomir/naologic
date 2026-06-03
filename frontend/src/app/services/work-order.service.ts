import { Injectable, signal } from '@angular/core';
import type { WorkCenterDocument, WorkOrderDocument } from '../models/types';
import { WORK_CENTERS, WORK_ORDERS } from '../data/sample-data';

const LS_KEY = 'wo_timeline_orders';

@Injectable({ providedIn: 'root' })
export class WorkOrderService {
  readonly workCenters = signal<WorkCenterDocument[]>(WORK_CENTERS);
  readonly workOrders = signal<WorkOrderDocument[]>(this.loadOrders());

  private loadOrders(): WorkOrderDocument[] {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as WorkOrderDocument[];
    } catch {
      /* ignore */
    }
    return WORK_ORDERS;
  }

  private persist(orders: WorkOrderDocument[]): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(orders));
    } catch {
      /* ignore */
    }
  }

  getOrdersForWorkCenter(workCenterId: string): WorkOrderDocument[] {
    return this.workOrders().filter(o => o.data.workCenterId === workCenterId);
  }

  /** Returns null if valid, or an error message if overlap detected. */
  checkOverlap(
    startDate: string,
    endDate: string,
    workCenterId: string,
    excludeId?: string,
  ): string | null {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    for (const wo of this.getOrdersForWorkCenter(workCenterId)) {
      if (wo.docId === excludeId) continue;
      const wStart = new Date(wo.data.startDate).getTime();
      const wEnd = new Date(wo.data.endDate).getTime();
      if (start < wEnd && end > wStart) {
        return `Overlaps with "${wo.data.name}"`;
      }
    }
    return null;
  }

  create(wo: Omit<WorkOrderDocument, 'docId'>): void {
    const docId = `wo-${Date.now()}`;
    const next = [...this.workOrders(), { ...wo, docId }];
    this.workOrders.set(next);
    this.persist(next);
  }

  update(docId: string, partial: Partial<WorkOrderDocument['data']>): void {
    const next = this.workOrders().map(wo =>
      wo.docId === docId ? { ...wo, data: { ...wo.data, ...partial } } : wo,
    );
    this.workOrders.set(next);
    this.persist(next);
  }

  delete(docId: string): void {
    const next = this.workOrders().filter(wo => wo.docId !== docId);
    this.workOrders.set(next);
    this.persist(next);
  }
}
