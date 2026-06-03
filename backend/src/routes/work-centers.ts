import { Router, type IRouter } from 'express';
import prisma from '../db.js';

export const workCentersRouter: IRouter = Router();

workCentersRouter.get('/', async (_req, res) => {
  const rows = await prisma.workCenter.findMany({
    include: { shifts: true, maintenanceWindows: true },
    orderBy: { createdAt: 'asc' },
  });

  res.json(
    rows.map(wc => ({
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
    })),
  );
});
