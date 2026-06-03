import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const weekdayShifts = [
  { dayOfWeek: 1, startHour: 8, endHour: 17 },
  { dayOfWeek: 2, startHour: 8, endHour: 17 },
  { dayOfWeek: 3, startHour: 8, endHour: 17 },
  { dayOfWeek: 4, startHour: 8, endHour: 17 },
  { dayOfWeek: 5, startHour: 8, endHour: 17 },
];

function daysFrom(now: Date, offset: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  d.setHours(8, 0, 0, 0);
  return d;
}

async function main() {
  console.log('Seeding database…');

  // ── Work Centers ──────────────────────────────────────────────────────────
  const wcData = [
    { docId: 'wc-extrusion-a', name: 'Extrusion Line A' },
    { docId: 'wc-cnc-1',       name: 'CNC Machine 1' },
    { docId: 'wc-assembly',    name: 'Assembly Station' },
    { docId: 'wc-quality',     name: 'Quality Control' },
    { docId: 'wc-packaging',   name: 'Packaging Line' },
  ];

  const workCenters = await Promise.all(
    wcData.map(async ({ docId, name }) => {
      const wc = await prisma.workCenter.upsert({
        where: { docId },
        update: { name },
        create: { docId, name },
      });

      // Re-create shifts (idempotent)
      await prisma.shift.deleteMany({ where: { workCenterId: wc.id } });
      await prisma.shift.createMany({
        data: weekdayShifts.map(s => ({ workCenterId: wc.id, ...s })),
      });

      return wc;
    }),
  );

  const wcMap = new Map(workCenters.map(wc => [wc.docId, wc]));

  // Assembly Station gets a maintenance window next Wednesday
  const now = new Date();
  const nextWed = new Date(now);
  nextWed.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7));

  await prisma.maintenanceWindow.deleteMany({
    where: { workCenterId: wcMap.get('wc-assembly')!.id },
  });
  await prisma.maintenanceWindow.create({
    data: {
      workCenterId: wcMap.get('wc-assembly')!.id,
      startDate: new Date(new Date(nextWed).setHours(10, 0, 0, 0)),
      endDate:   new Date(new Date(nextWed).setHours(12, 0, 0, 0)),
      reason: 'Scheduled lubrication & calibration',
    },
  });

  // ── Manufacturing Order ───────────────────────────────────────────────────
  const mo = await prisma.manufacturingOrder.upsert({
    where: { docId: 'mo-default' },
    update: {},
    create: {
      docId: 'mo-default',
      moNumber: 'MO-DEFAULT',
      itemId: 'item-general',
      quantity: 1,
      dueDate: new Date(now.getFullYear(), now.getMonth() + 3, 1),
    },
  });

  // ── Work Orders ───────────────────────────────────────────────────────────
  const woData = [
    { docId: 'wo-001', woNumber: 'WO-001', name: 'Pipe Batch #A1',   wc: 'wc-extrusion-a', status: 'complete',    start: -10, end: -7  },
    { docId: 'wo-002', woNumber: 'WO-002', name: 'Pipe Batch #A2',   wc: 'wc-extrusion-a', status: 'in_progress', start: -3,  end: 4   },
    { docId: 'wo-003', woNumber: 'WO-003', name: 'Shaft Milling',    wc: 'wc-cnc-1',       status: 'complete',    start: -8,  end: -5  },
    { docId: 'wo-004', woNumber: 'WO-004', name: 'Coupling Finish',  wc: 'wc-cnc-1',       status: 'open',        start: 2,   end: 6   },
    { docId: 'wo-005', woNumber: 'WO-005', name: 'Valve Assembly',   wc: 'wc-assembly',    status: 'in_progress', start: -2,  end: 3   },
    { docId: 'wo-006', woNumber: 'WO-006', name: 'Bracket Assembly', wc: 'wc-assembly',    status: 'blocked',     start: 5,   end: 9   },
    { docId: 'wo-007', woNumber: 'WO-007', name: 'Dimensional Check',wc: 'wc-quality',     status: 'complete',    start: -6,  end: -3  },
    { docId: 'wo-008', woNumber: 'WO-008', name: 'Final Inspection', wc: 'wc-quality',     status: 'open',        start: 4,   end: 8   },
    { docId: 'wo-009', woNumber: 'WO-009', name: 'Retail Pack Run',  wc: 'wc-packaging',   status: 'blocked',     start: -1,  end: 5   },
  ];

  for (const wo of woData) {
    const startDate = daysFrom(now, wo.start);
    const endDate   = daysFrom(now, wo.end);
    const durationMinutes = Math.abs(wo.end - wo.start) * 8 * 60;
    const wc = wcMap.get(wo.wc)!;

    await prisma.workOrder.upsert({
      where: { docId: wo.docId },
      update: { name: wo.name, status: wo.status, startDate, endDate, durationMinutes },
      create: {
        docId: wo.docId,
        woNumber: wo.woNumber,
        name: wo.name,
        workCenterId: wc.id,
        manufacturingOrderId: mo.id,
        startDate,
        endDate,
        durationMinutes,
        isMaintenance: false,
        status: wo.status,
        dependsOnWorkOrderIds: [],
      },
    });
  }

  console.log(`✓ Seeded ${wcData.length} work centers, ${woData.length} work orders`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
