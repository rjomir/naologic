import type { WorkOrderDocument, WorkOrderStatus } from '@naologic/shared';
import type { IWorkOrderRepository, WorkOrderWithRels } from './work-order.repository.js';
import type { IManufacturingOrderRepository } from '../manufacturing-orders/manufacturing-order.repository.js';
import type { CreateWorkOrderInput, UpdateWorkOrderInput } from '../openapi/schemas.js';

export function toDoc(wo: WorkOrderWithRels): WorkOrderDocument {
  return {
    docId: wo.docId,
    docType: 'workOrder',
    data: {
      name: wo.name,
      woNumber: wo.woNumber,
      workCenterId: wo.workCenter.docId,
      manufacturingOrderId: wo.manufacturingOrder.docId,
      status: wo.status as WorkOrderStatus,
      startDate: wo.startDate.toISOString().slice(0, 10),
      endDate: wo.endDate.toISOString().slice(0, 10),
      durationMinutes: wo.durationMinutes,
      isMaintenance: wo.isMaintenance,
      dependsOnWorkOrderIds: wo.dependsOnWorkOrderIds,
    },
  };
}

export class WorkOrderService {
  constructor(
    private readonly repo: IWorkOrderRepository,
    private readonly moRepo: IManufacturingOrderRepository,
  ) {}

  async getAll(): Promise<WorkOrderDocument[]> {
    return (await this.repo.findAll()).map(toDoc);
  }

  async create(input: CreateWorkOrderInput): Promise<WorkOrderDocument> {
    const defaultMo = await this.moRepo.findFirstOrThrow();
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    const wo = await this.repo.create({
      docId: `wo-${Date.now()}`,
      woNumber: `WO-${Date.now()}`,
      name: input.name,
      workCenterDocId: input.workCenterId,
      manufacturingOrderInternalId: defaultMo.id,
      status: input.status,
      startDate: start,
      endDate: end,
      durationMinutes:
        input.durationMinutes ?? Math.round((end.getTime() - start.getTime()) / 60_000),
    });

    return toDoc(wo);
  }

  async update(docId: string, input: UpdateWorkOrderInput): Promise<WorkOrderDocument> {
    const existing = await this.repo.findByDocIdOrThrow(docId);
    const start = input.startDate ? new Date(input.startDate) : existing.startDate;
    const end = input.endDate ? new Date(input.endDate) : existing.endDate;

    const updated = await this.repo.update(docId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.workCenterId !== undefined && { workCenterDocId: input.workCenterId }),
      startDate: start,
      endDate: end,
      durationMinutes:
        input.durationMinutes ?? Math.round((end.getTime() - start.getTime()) / 60_000),
    });

    return toDoc(updated);
  }

  async delete(docId: string): Promise<void> {
    await this.repo.delete(docId);
  }
}
