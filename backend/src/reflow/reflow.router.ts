import { Router } from 'express';
import type { IWorkCenterRepository } from '../work-centers/work-center.repository.js';
import type { IWorkOrderRepository } from '../work-orders/work-order.repository.js';
import type { IManufacturingOrderRepository } from '../manufacturing-orders/manufacturing-order.repository.js';
import type { ReflowService } from './reflow.service.js';
import type { WorkOrder, WorkCenter, ManufacturingOrder } from '../types.js';
import type { SseService } from '../sse/sse.service.js';
import { toDoc } from '../work-orders/work-order.service.js';

export function createReflowRouter(
  wcRepo: IWorkCenterRepository,
  woRepo: IWorkOrderRepository,
  moRepo: IManufacturingOrderRepository,
  algorithm: ReflowService,
  sse: SseService,
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
          setupTimeMinutes: wo.setupTimeMinutes,
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

        // Broadcast only the rescheduled orders (minimal payload)
        const changedDocIds = new Set(result.changes.map(c => c.docId));
        const updates = woRows
          .filter(wo => changedDocIds.has(wo.docId))
          .map(wo => {
            const change = result.changes.find(c => c.docId === wo.docId)!;
            return toDoc({
              ...wo,
              startDate: new Date(change.newStartDate),
              endDate: new Date(change.newEndDate),
            });
          });

        sse.broadcast('work-order:reflow', { updates });
      }

      res.json({
        changes: result.changes,
        explanation: result.explanation,
        updatedCount: result.changes.length,
        totalDelayMinutes: result.totalDelayMinutes,
        workCenterUtilization: result.workCenterUtilization,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
