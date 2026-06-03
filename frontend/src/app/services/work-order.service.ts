import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  WorkCenterDocument,
  WorkOrderDocument,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  ReflowResponse,
} from '../models/types';

const API = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class WorkOrderService {
  readonly workCenters = signal<WorkCenterDocument[]>([]);
  readonly workOrders = signal<WorkOrderDocument[]>([]);
  readonly loading = signal(false);
  readonly apiError = signal<string | null>(null);

  private readonly http = inject(HttpClient);

  constructor() {
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.loading.set(true);
    this.apiError.set(null);
    try {
      const [wcs, wos] = await Promise.all([
        firstValueFrom(this.http.get<WorkCenterDocument[]>(`${API}/work-centers`)),
        firstValueFrom(this.http.get<WorkOrderDocument[]>(`${API}/work-orders`)),
      ]);
      this.workCenters.set(wcs);
      this.workOrders.set(wos);
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

  async create(dto: CreateWorkOrderDto): Promise<void> {
    const created = await firstValueFrom(
      this.http.post<WorkOrderDocument>(`${API}/work-orders`, dto),
    );
    this.workOrders.update(orders => [...orders, created]);
  }

  async update(docId: string, dto: UpdateWorkOrderDto): Promise<void> {
    const updated = await firstValueFrom(
      this.http.put<WorkOrderDocument>(`${API}/work-orders/${docId}`, dto),
    );
    this.workOrders.update(orders => orders.map(wo => (wo.docId === docId ? updated : wo)));
  }

  async delete(docId: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${API}/work-orders/${docId}`));
    this.workOrders.update(orders => orders.filter(wo => wo.docId !== docId));
  }

  async runReflow(): Promise<{ updatedCount: number }> {
    const data = await firstValueFrom(this.http.post<ReflowResponse>(`${API}/reflow`, {}));
    if (data.updatedCount > 0) {
      const wos = await firstValueFrom(this.http.get<WorkOrderDocument[]>(`${API}/work-orders`));
      this.workOrders.set(wos);
    }
    return { updatedCount: data.updatedCount };
  }
}
