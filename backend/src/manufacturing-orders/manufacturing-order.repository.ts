import type { PrismaClient, ManufacturingOrder } from '@prisma/client';

export interface IManufacturingOrderRepository {
  findAll(): Promise<ManufacturingOrder[]>;
  findFirstOrThrow(): Promise<ManufacturingOrder>;
}

export class PrismaManufacturingOrderRepository implements IManufacturingOrderRepository {
  constructor(private readonly db: PrismaClient) {}

  findAll(): Promise<ManufacturingOrder[]> {
    return this.db.manufacturingOrder.findMany();
  }

  findFirstOrThrow(): Promise<ManufacturingOrder> {
    return this.db.manufacturingOrder.findFirstOrThrow({
      orderBy: { createdAt: 'asc' },
    });
  }
}
