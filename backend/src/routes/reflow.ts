import { Router, type IRouter } from 'express';
import prisma from '../db.js';
import { ReflowService } from '../reflow/reflow.service.js';
import type { WorkOrder, WorkCenter, ManufacturingOrder } from '../types.js';

export const reflowRouter: IRouter = Router();

const service = new ReflowService();

// POST /api/reflow
// Runs the reflow algorithm against all current work orders and persists the
// updated schedule back to the database.
reflowRouter.post('/', async (_req, res) => {
  const [workCentersDb, workOrdersDb, moDb] = await Promise.all([
    prisma.workCenter.findMany({ include: { shifts: true, maintenanceWindows: true } }),
    prisma.workOrder.findMany({ include: { workCenter: true, manufacturingOrder: true } }),
    prisma.manufacturingOrder.findMany(),
  ]);

  // Map DB rows to algorithm types
  const workCenters: WorkCenter[] = workCentersDb.map(wc => ({
    docId: wc.docId,
    docType: 'workCenter',
    data: {
      name: wc.name,
      shifts: wc.shifts.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startHour: s.startHour,
        endHour: s.endHour,
      })),
      maintenanceWindows: wc.maintenanceWindows.map(m => ({
        startDate: m.startDate.toISOString(),
        endDate: m.endDate.toISOString(),
        ...(m.reason ? { reason: m.reason } : {}),
      })),
    },
  }));

  const workOrders: WorkOrder[] = workOrdersDb.map(wo => ({
    docId: wo.docId,
    docType: 'workOrder',
    data: {
      workOrderNumber: wo.woNumber,
      manufacturingOrderId: wo.manufacturingOrder.docId,
      workCenterId: wo.workCenter.docId,
      startDate: wo.startDate.toISOString(),
      endDate: wo.endDate.toISOString(),
      durationMinutes: wo.durationMinutes,
      isMaintenance: wo.isMaintenance,
      dependsOnWorkOrderIds: wo.dependsOnWorkOrderIds,
    },
  }));

  const manufacturingOrders: ManufacturingOrder[] = moDb.map(mo => ({
    docId: mo.docId,
    docType: 'manufacturingOrder',
    data: {
      manufacturingOrderNumber: mo.moNumber,
      itemId: mo.itemId,
      quantity: mo.quantity,
      dueDate: mo.dueDate.toISOString(),
    },
  }));

  const result = service.reflow({ workOrders, workCenters, manufacturingOrders });

  // Persist updated schedules back to DB
  await Promise.all(
    result.changes.map(change =>
      prisma.workOrder.update({
        where: { docId: change.docId },
        data: {
          startDate: new Date(change.newStartDate),
          endDate: new Date(change.newEndDate),
        },
      }),
    ),
  );

  res.json({
    changes: result.changes,
    explanation: result.explanation,
    updatedCount: result.changes.length,
  });
});
