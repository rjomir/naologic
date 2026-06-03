import { Injectable, signal } from '@angular/core';
import type { WorkCenterDocument, WorkOrderDocument } from '../models/types';

const API = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class WorkOrderService {
  readonly workCenters = signal<WorkCenterDocument[]>([]);
  readonly workOrders = signal<WorkOrderDocument[]>([]);
  readonly loading = signal(false);
  readonly apiError = signal<string | null>(null);

  constructor() {
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.loading.set(true);
    this.apiError.set(null);
    try {
      const [wcs, wos] = await Promise.all([
        fetch(`${API}/work-centers`).then(r => r.json()),
        fetch(`${API}/work-orders`).then(r => r.json()),
      ]);
      this.workCenters.set(wcs as WorkCenterDocument[]);
      this.workOrders.set(wos as WorkOrderDocument[]);
    } catch {
      this.apiError.set('Could not reach the backend API. Is the server running?');
    } finally {
      this.loading.set(false);
    }
  }

  getOrdersForWorkCenter(workCenterId: string): WorkOrderDocument[] {
    return this.workOrders().filter(o => o.data.workCenterId === workCenterId);
  }

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
      if (start < wEnd && end > wStart) return `Overlaps with "${wo.data.name}"`;
    }
    return null;
  }

  async create(wo: Omit<WorkOrderDocument, 'docId'>): Promise<void> {
    const res = await fetch(`${API}/work-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wo.data),
    });
    if (!res.ok) throw new Error('Failed to create work order');
    const created = (await res.json()) as WorkOrderDocument;
    this.workOrders.update(orders => [...orders, created]);
  }

  async update(docId: string, partial: Partial<WorkOrderDocument['data']>): Promise<void> {
    const res = await fetch(`${API}/work-orders/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (!res.ok) throw new Error('Failed to update work order');
    const updated = (await res.json()) as WorkOrderDocument;
    this.workOrders.update(orders => orders.map(wo => (wo.docId === docId ? updated : wo)));
  }

  async delete(docId: string): Promise<void> {
    const res = await fetch(`${API}/work-orders/${docId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete work order');
    this.workOrders.update(orders => orders.filter(wo => wo.docId !== docId));
  }

  async runReflow(): Promise<{ updatedCount: number }> {
    const res = await fetch(`${API}/reflow`, { method: 'POST' });
    if (!res.ok) throw new Error('Reflow failed');
    const data = (await res.json()) as { updatedCount: number };
    if (data.updatedCount > 0) {
      const wos = await fetch(`${API}/work-orders`).then(r => r.json());
      this.workOrders.set(wos as WorkOrderDocument[]);
    }
    return { updatedCount: data.updatedCount };
  }
}
