import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  WorkCenterDocument,
  WorkOrderDocument,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
} from '../models/types';
import { WorkOrderApiService } from './work-order-api.service';
import { ScheduleValidatorService } from './schedule-validator.service';

/**
 * State facade — owns signals, delegates HTTP to WorkOrderApiService and
 * validation to ScheduleValidatorService. Components only ever inject this.
 */
@Injectable({ providedIn: 'root' })
export class WorkOrderService {
  readonly workCenters = signal<WorkCenterDocument[]>([]);
  readonly workOrders = signal<WorkOrderDocument[]>([]);
  readonly loading = signal(false);
  readonly apiError = signal<string | null>(null);

  private readonly api = inject(WorkOrderApiService);
  private readonly validator = inject(ScheduleValidatorService);

  constructor() {
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.loading.set(true);
    this.apiError.set(null);
    try {
      const [wcs, wos] = await Promise.all([
        firstValueFrom(this.api.getWorkCenters()),
        firstValueFrom(this.api.getWorkOrders()),
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
    return this.validator.checkOverlap(
      this.workOrders(),
      startDate,
      endDate,
      workCenterId,
      excludeId,
    );
  }

  async create(dto: CreateWorkOrderDto): Promise<void> {
    const created = await firstValueFrom(this.api.createWorkOrder(dto));
    this.workOrders.update(orders => [...orders, created]);
  }

  async update(docId: string, dto: UpdateWorkOrderDto): Promise<void> {
    const updated = await firstValueFrom(this.api.updateWorkOrder(docId, dto));
    this.workOrders.update(orders => orders.map(wo => (wo.docId === docId ? updated : wo)));
  }

  async delete(docId: string): Promise<void> {
    await firstValueFrom(this.api.deleteWorkOrder(docId));
    this.workOrders.update(orders => orders.filter(wo => wo.docId !== docId));
  }

  async runReflow(): Promise<{ updatedCount: number }> {
    const data = await firstValueFrom(this.api.runReflow());
    if (data.updatedCount > 0) {
      const wos = await firstValueFrom(this.api.getWorkOrders());
      this.workOrders.set(wos);
    }
    return { updatedCount: data.updatedCount };
  }
}
