import { Router, type IRouter } from 'express';
import type { WorkCenter, ManufacturingOrder, WorkOrder } from '@prisma/client';
import prisma from '../db.js';

export const workOrdersRouter: IRouter = Router();

type WorkOrderWithRels = WorkOrder & {
  workCenter: WorkCenter;
  manufacturingOrder: ManufacturingOrder;
};

function toDoc(wo: WorkOrderWithRels) {
  return {
    docId: wo.docId,
    docType: 'workOrder',
    data: {
      name: wo.name,
      woNumber: wo.woNumber,
      workCenterId: wo.workCenter.docId,
      manufacturingOrderId: wo.manufacturingOrder.docId,
      status: wo.status,
      startDate: wo.startDate.toISOString().slice(0, 10),
      endDate: wo.endDate.toISOString().slice(0, 10),
      durationMinutes: wo.durationMinutes,
      isMaintenance: wo.isMaintenance,
      dependsOnWorkOrderIds: wo.dependsOnWorkOrderIds,
    },
  };
}

// GET /api/work-orders
workOrdersRouter.get('/', async (_req, res) => {
  const rows = await prisma.workOrder.findMany({
    include: { workCenter: true, manufacturingOrder: true },
    orderBy: { startDate: 'asc' },
  });
  res.json(rows.map(toDoc));
});

// POST /api/work-orders
workOrdersRouter.post('/', async (req, res) => {
  const { name, workCenterId, status, startDate, endDate, durationMinutes } = req.body as {
    name: string;
    workCenterId: string;
    status: string;
    startDate: string;
    endDate: string;
    durationMinutes?: number;
  };

  const wc = await prisma.workCenter.findUniqueOrThrow({ where: { docId: workCenterId } });

  // Default MO for FE-created orders
  const defaultMo = await prisma.manufacturingOrder.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!defaultMo) {
    res.status(500).json({ error: 'No manufacturing order found to associate with' });
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const duration = durationMinutes ?? Math.round((end.getTime() - start.getTime()) / 60000);

  const wo = await prisma.workOrder.create({
    data: {
      docId: `wo-${Date.now()}`,
      woNumber: `WO-${Date.now()}`,
      name,
      workCenterId: wc.id,
      manufacturingOrderId: defaultMo.id,
      status: status ?? 'open',
      startDate: start,
      endDate: end,
      durationMinutes: duration,
      isMaintenance: false,
      dependsOnWorkOrderIds: [],
    },
    include: { workCenter: true, manufacturingOrder: true },
  });

  res.status(201).json(toDoc(wo));
});

// PUT /api/work-orders/:docId
workOrdersRouter.put('/:docId', async (req, res) => {
  const { name, status, startDate, endDate, durationMinutes, workCenterId } = req.body as {
    name?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    durationMinutes?: number;
    workCenterId?: string;
  };

  const existing = await prisma.workOrder.findUniqueOrThrow({
    where: { docId: req.params['docId'] },
    include: { workCenter: true },
  });

  let workCenterDbId = existing.workCenterId;
  if (workCenterId) {
    const wc = await prisma.workCenter.findUniqueOrThrow({ where: { docId: workCenterId } });
    workCenterDbId = wc.id;
  }

  const start = startDate ? new Date(startDate) : existing.startDate;
  const end = endDate ? new Date(endDate) : existing.endDate;

  const updated = await prisma.workOrder.update({
    where: { docId: req.params['docId'] },
    data: {
      ...(name && { name }),
      ...(status && { status }),
      startDate: start,
      endDate: end,
      workCenterId: workCenterDbId,
      durationMinutes: durationMinutes ?? Math.round((end.getTime() - start.getTime()) / 60000),
    },
    include: { workCenter: true, manufacturingOrder: true },
  });

  res.json(toDoc(updated));
});

// DELETE /api/work-orders/:docId
workOrdersRouter.delete('/:docId', async (req, res) => {
  await prisma.workOrder.delete({ where: { docId: req.params['docId'] } });
  res.status(204).send();
});
