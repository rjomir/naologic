import type { PrismaClient, WorkOrder, WorkCenter, ManufacturingOrder } from '@prisma/client';

export type WorkOrderWithRels = WorkOrder & {
  workCenter: WorkCenter;
  manufacturingOrder: ManufacturingOrder;
};

/** Data passed to create — uses business docIds for relations; Prisma `connect` handles FK resolution */
export interface CreateWorkOrderData {
  docId: string;
  woNumber: string;
  name: string;
  workCenterDocId: string; // business identifier; repository connects via docId
  manufacturingOrderInternalId: string; // DB UUID (obtained by caller from MO repo)
  status: string;
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  setupTimeMinutes?: number;
}

/** Partial update — only provided fields are written */
export interface UpdateWorkOrderData {
  name?: string;
  status?: string;
  workCenterDocId?: string; // business identifier; repository connects via docId
  startDate?: Date;
  endDate?: Date;
  durationMinutes?: number;
  setupTimeMinutes?: number;
}

export interface IWorkOrderRepository {
  findAll(): Promise<WorkOrderWithRels[]>;
  findByDocIdOrThrow(docId: string): Promise<WorkOrderWithRels>;
  create(data: CreateWorkOrderData): Promise<WorkOrderWithRels>;
  update(docId: string, data: UpdateWorkOrderData): Promise<WorkOrderWithRels>;
  delete(docId: string): Promise<void>;
  bulkUpdateDates(updates: Array<{ docId: string; startDate: Date; endDate: Date }>): Promise<void>;
}

const INCLUDE_RELS = { workCenter: true, manufacturingOrder: true } as const;

export class PrismaWorkOrderRepository implements IWorkOrderRepository {
  constructor(private readonly db: PrismaClient) {}

  findAll(): Promise<WorkOrderWithRels[]> {
    return this.db.workOrder.findMany({
      include: INCLUDE_RELS,
      orderBy: { startDate: 'asc' },
    });
  }

  findByDocIdOrThrow(docId: string): Promise<WorkOrderWithRels> {
    return this.db.workOrder.findUniqueOrThrow({
      where: { docId },
      include: INCLUDE_RELS,
    });
  }

  create(data: CreateWorkOrderData): Promise<WorkOrderWithRels> {
    return this.db.workOrder.create({
      data: {
        docId: data.docId,
        woNumber: data.woNumber,
        name: data.name,
        workCenter: { connect: { docId: data.workCenterDocId } },
        manufacturingOrder: { connect: { id: data.manufacturingOrderInternalId } },
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        durationMinutes: data.durationMinutes,
        setupTimeMinutes: data.setupTimeMinutes ?? 0,
        isMaintenance: false,
        dependsOnWorkOrderIds: [],
      },
      include: INCLUDE_RELS,
    });
  }

  update(docId: string, data: UpdateWorkOrderData): Promise<WorkOrderWithRels> {
    return this.db.workOrder.update({
      where: { docId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.workCenterDocId !== undefined && {
          workCenter: { connect: { docId: data.workCenterDocId } },
        }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
        ...(data.setupTimeMinutes !== undefined && { setupTimeMinutes: data.setupTimeMinutes }),
      },
      include: INCLUDE_RELS,
    });
  }

  async delete(docId: string): Promise<void> {
    await this.db.workOrder.delete({ where: { docId } });
  }

  async bulkUpdateDates(
    updates: Array<{ docId: string; startDate: Date; endDate: Date }>,
  ): Promise<void> {
    await Promise.all(
      updates.map(u =>
        this.db.workOrder.update({
          where: { docId: u.docId },
          data: { startDate: u.startDate, endDate: u.endDate },
        }),
      ),
    );
  }
}
