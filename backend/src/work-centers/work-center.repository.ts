import type { PrismaClient, WorkCenter, Shift, MaintenanceWindow } from '@prisma/client';

export type WorkCenterWithRels = WorkCenter & {
  shifts: Shift[];
  maintenanceWindows: MaintenanceWindow[];
};

export interface IWorkCenterRepository {
  findAll(): Promise<WorkCenterWithRels[]>;
}

export class PrismaWorkCenterRepository implements IWorkCenterRepository {
  constructor(private readonly db: PrismaClient) {}

  findAll(): Promise<WorkCenterWithRels[]> {
    return this.db.workCenter.findMany({
      include: { shifts: true, maintenanceWindows: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
