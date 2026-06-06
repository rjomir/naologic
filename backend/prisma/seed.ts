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
  //
  // Dependency chain (Scenario 1 — Delay Cascade):
  //   wo-001 (Pipe Batch #A1)
  //     └─► wo-003 (Shaft Milling) ──► wo-005 (Valve Assembly) ──► wo-007 (Dimensional Check)
  //                                                                      └─► wo-008 (Final Inspection)
  //                                                                               └─► wo-009 (Retail Pack Run)
  //   wo-002 (Pipe Batch #A2) ──► wo-004 (Coupling Finish) ──► wo-006 (Bracket Assembly)
  //
  // wo-005 (Valve Assembly) also sits across the Assembly Station maintenance
  // window (next Wednesday 10-12) — Scenario 2: Shift / Maintenance avoidance.
  //
  // Running Reflow will cascade wo-005's stale dates into wo-007 → wo-008 → wo-009.

  type WoSeed = {
    docId: string;
    woNumber: string;
    name: string;
    wc: string;
    status: string;
    start: number;
    end: number;
    deps: string[];
    setupTimeMinutes?: number;
    isMaintenance?: boolean;
  };

  const woData: WoSeed[] = [
    // ── Extrusion (no upstream deps) ────────────────────────────────────────
    { docId: 'wo-001', woNumber: 'WO-001', name: 'Pipe Batch #A1',    wc: 'wc-extrusion-a', status: 'complete',    start: -75, end: -35, deps: [] },
    { docId: 'wo-002', woNumber: 'WO-002', name: 'Pipe Batch #A2',    wc: 'wc-extrusion-a', status: 'in-progress', start: -20, end: 10,  deps: [] },

    // ── CNC (depends on upstream extrusion batches) ──────────────────────────
    { docId: 'wo-003', woNumber: 'WO-003', name: 'Shaft Milling',     wc: 'wc-cnc-1',       status: 'complete',    start: -34, end:  -5, deps: ['wo-001'], setupTimeMinutes: 30 },
    { docId: 'wo-004', woNumber: 'WO-004', name: 'Coupling Finish',   wc: 'wc-cnc-1',       status: 'open',        start:  12, end:  40, deps: ['wo-002'], setupTimeMinutes: 20 },

    // ── Assembly (depends on CNC; wo-005 intentionally starts too early ──────
    //    so reflow must push it past wo-003's end AND the maintenance window)
    { docId: 'wo-005', woNumber: 'WO-005', name: 'Valve Assembly',    wc: 'wc-assembly',    status: 'in-progress', start:  -8, end:  20, deps: ['wo-003'] },
    { docId: 'wo-006', woNumber: 'WO-006', name: 'Bracket Assembly',  wc: 'wc-assembly',    status: 'blocked',     start:  42, end:  70, deps: ['wo-004'] },

    // ── Quality Control (depends on assembly) ────────────────────────────────
    { docId: 'wo-007', woNumber: 'WO-007', name: 'Dimensional Check', wc: 'wc-quality',     status: 'open',        start:  21, end:  35, deps: ['wo-005'] },
    { docId: 'wo-008', woNumber: 'WO-008', name: 'Final Inspection',  wc: 'wc-quality',     status: 'open',        start:  36, end:  55, deps: ['wo-006', 'wo-007'] },

    // ── Packaging (depends on both quality gates) ────────────────────────────
    { docId: 'wo-009', woNumber: 'WO-009', name: 'Retail Pack Run',   wc: 'wc-packaging',   status: 'open',        start:  56, end:  85, deps: ['wo-008'] },
  ];

  for (const wo of woData) {
    const startDate = daysFrom(now, wo.start);
    const endDate   = daysFrom(now, wo.end);
    const durationMinutes = Math.abs(wo.end - wo.start) * 8 * 60;
    const wc = wcMap.get(wo.wc)!;

    await prisma.workOrder.upsert({
      where:  { docId: wo.docId },
      update: {
        name: wo.name,
        status: wo.status,
        startDate,
        endDate,
        durationMinutes,
        setupTimeMinutes: wo.setupTimeMinutes ?? 0,
        dependsOnWorkOrderIds: wo.deps,
      },
      create: {
        docId: wo.docId,
        woNumber: wo.woNumber,
        name: wo.name,
        workCenterId: wc.id,
        manufacturingOrderId: mo.id,
        startDate,
        endDate,
        durationMinutes,
        setupTimeMinutes: wo.setupTimeMinutes ?? 0,
        isMaintenance: wo.isMaintenance ?? false,
        status: wo.status,
        dependsOnWorkOrderIds: wo.deps,
      },
    });
  }

  console.log(`✓ Seeded ${wcData.length} work centers, ${woData.length} work orders`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
