import { Injectable, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import type {
  WorkCenterDocument,
  WorkOrderDocument,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  WorkOrderCreatedEvent,
  WorkOrderUpdatedEvent,
  WorkOrderDeletedEvent,
  WorkOrderReflowEvent,
} from '../models/types';
import { WorkOrderApiService } from './work-order-api.service';
import { ScheduleValidatorService } from './schedule-validator.service';
import { SseService } from './sse.service';

/**
 * State facade — owns signals, delegates HTTP to WorkOrderApiService,
 * validation to ScheduleValidatorService, and live updates to SseService.
 * Components only ever inject this class.
 */
@Injectable({ providedIn: 'root' })
export class WorkOrderService {
  readonly workCenters = signal<WorkCenterDocument[]>([]);
  readonly workOrders = signal<WorkOrderDocument[]>([]);
  readonly loading = signal(false);
  readonly apiError = signal<string | null>(null);

  private readonly api = inject(WorkOrderApiService);
  private readonly validator = inject(ScheduleValidatorService);
  private readonly sse = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    void this.loadAll();
    this.subscribeToRealTimeUpdates();
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

  private subscribeToRealTimeUpdates(): void {
    // Another user created an order
    this.sse
      .listen<WorkOrderCreatedEvent>('work-order:created')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ workOrder }) => {
        this.workOrders.update(orders => {
          if (orders.some(o => o.docId === workOrder.docId)) return orders; // own action already applied
          return [...orders, workOrder].sort((a, b) =>
            a.data.startDate.localeCompare(b.data.startDate),
          );
        });
      });

    // Another user updated an order
    this.sse
      .listen<WorkOrderUpdatedEvent>('work-order:updated')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ workOrder }) => {
        this.workOrders.update(orders =>
          orders.map(o => (o.docId === workOrder.docId ? workOrder : o)),
        );
      });

    // Another user deleted an order
    this.sse
      .listen<WorkOrderDeletedEvent>('work-order:deleted')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ docId }) => {
        this.workOrders.update(orders => orders.filter(o => o.docId !== docId));
      });

    // Reflow ran — patch only the rescheduled orders
    this.sse
      .listen<WorkOrderReflowEvent>('work-order:reflow')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ updates }) => {
        const map = new Map(updates.map(wo => [wo.docId, wo]));
        this.workOrders.update(orders => orders.map(o => map.get(o.docId) ?? o));
      });
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
