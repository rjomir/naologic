import { Router } from 'express';
import type { IWorkCenterRepository } from '../work-centers/work-center.repository.js';
import type { IWorkOrderRepository } from '../work-orders/work-order.repository.js';
import type { IManufacturingOrderRepository } from '../manufacturing-orders/manufacturing-order.repository.js';
import type { ReflowService } from './reflow.service.js';
import type { WorkOrder, WorkCenter, ManufacturingOrder } from '../types.js';

export function createReflowRouter(
  wcRepo: IWorkCenterRepository,
  woRepo: IWorkOrderRepository,
  moRepo: IManufacturingOrderRepository,
  algorithm: ReflowService,
): Router {
  const router = Router();

  router.post('/', async (_req, res, next) => {
    try {
      const [wcRows, woRows, moRows] = await Promise.all([
        wcRepo.findAll(),
        woRepo.findAll(),
        moRepo.findAll(),
      ]);

      const workCenters: WorkCenter[] = wcRows.map(wc => ({
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
            ...(m.reason !== null && m.reason !== undefined ? { reason: m.reason } : {}),
          })),
        },
      }));

      const workOrders: WorkOrder[] = woRows.map(wo => ({
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

      const manufacturingOrders: ManufacturingOrder[] = moRows.map(mo => ({
        docId: mo.docId,
        docType: 'manufacturingOrder',
        data: {
          manufacturingOrderNumber: mo.moNumber,
          itemId: mo.itemId,
          quantity: mo.quantity,
          dueDate: mo.dueDate.toISOString(),
        },
      }));

      const result = algorithm.reflow({ workOrders, workCenters, manufacturingOrders });

      if (result.changes.length > 0) {
        await woRepo.bulkUpdateDates(
          result.changes.map(c => ({
            docId: c.docId,
            startDate: new Date(c.newStartDate),
            endDate: new Date(c.newEndDate),
          })),
        );
      }

      res.json({
        changes: result.changes,
        explanation: result.explanation,
        updatedCount: result.changes.length,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
