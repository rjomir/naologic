/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkOrderService, toDoc } from './work-order.service.js';
import type { IWorkOrderRepository, WorkOrderWithRels } from './work-order.repository.js';
import type { IManufacturingOrderRepository } from '../manufacturing-orders/manufacturing-order.repository.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<WorkOrderWithRels> = {}): WorkOrderWithRels {
  return {
    id: 'internal-id-1',
    docId: 'wo-1',
    woNumber: 'WO-001',
    name: 'Test Order',
    status: 'open',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-06-05'),
    durationMinutes: 480,
    isMaintenance: false,
    dependsOnWorkOrderIds: [],
    setupTimeMinutes: 0,
    workCenterId: 'wc-db-id',
    manufacturingOrderId: 'mo-db-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    workCenter: { id: 'wc-db-id', docId: 'wc-1', name: 'Line 1' } as any,
    manufacturingOrder: { id: 'mo-db-id', docId: 'mo-1' } as any,
    ...overrides,
  } as WorkOrderWithRels;
}

// ── toDoc ─────────────────────────────────────────────────────────────────────

describe('toDoc', () => {
  it('maps a database row to a WorkOrderDocument', () => {
    const doc = toDoc(makeRow());
    expect(doc).toEqual({
      docId: 'wo-1',
      docType: 'workOrder',
      data: {
        name: 'Test Order',
        woNumber: 'WO-001',
        workCenterId: 'wc-1',
        manufacturingOrderId: 'mo-1',
        status: 'open',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        durationMinutes: 480,
        setupTimeMinutes: 0,
        isMaintenance: false,
        dependsOnWorkOrderIds: [],
      },
    });
  });

  it('includes setupTimeMinutes in the document data', () => {
    const doc = toDoc(makeRow({ setupTimeMinutes: 45 }));
    expect(doc.data.setupTimeMinutes).toBe(45);
  });

  it('formats dates as YYYY-MM-DD strings', () => {
    const doc = toDoc(
      makeRow({ startDate: new Date('2026-12-31'), endDate: new Date('2027-01-15') }),
    );
    expect(doc.data.startDate).toBe('2026-12-31');
    expect(doc.data.endDate).toBe('2027-01-15');
  });
});

// ── WorkOrderService ──────────────────────────────────────────────────────────

describe('WorkOrderService', () => {
  let woRepo: IWorkOrderRepository;
  let moRepo: IManufacturingOrderRepository;
  let service: WorkOrderService;

  beforeEach(() => {
    woRepo = {
      findAll: vi.fn(),
      findByDocIdOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      bulkUpdateDates: vi.fn(),
    };
    moRepo = {
      findAll: vi.fn(),
      findFirstOrThrow: vi.fn().mockResolvedValue({ id: 'mo-uuid-1' } as any),
    };
    service = new WorkOrderService(woRepo, moRepo);
  });

  it('getAll returns mapped documents', async () => {
    vi.mocked(woRepo.findAll).mockResolvedValue([makeRow()]);
    const docs = await service.getAll();
    expect(docs).toHaveLength(1);
    expect(docs[0].docId).toBe('wo-1');
    expect(docs[0].docType).toBe('workOrder');
  });

  it('create computes durationMinutes from dates when not provided', async () => {
    const created = makeRow({ durationMinutes: 5760 }); // 4 days = 5760 min
    vi.mocked(woRepo.create).mockResolvedValue(created);

    await service.create({
      name: 'New Order',
      workCenterId: 'wc-1',
      status: 'open',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });

    const callArg = vi.mocked(woRepo.create).mock.calls[0][0];
    // 4 days × 24 × 60 = 5760 minutes
    expect(callArg.durationMinutes).toBe(5760);
  });

  it('create uses the provided durationMinutes instead of computing it', async () => {
    vi.mocked(woRepo.create).mockResolvedValue(makeRow({ durationMinutes: 120 }));

    await service.create({
      name: 'New Order',
      workCenterId: 'wc-1',
      status: 'open',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      durationMinutes: 120,
    });

    const callArg = vi.mocked(woRepo.create).mock.calls[0][0];
    expect(callArg.durationMinutes).toBe(120);
  });

  it('update keeps existing dates when input omits them', async () => {
    const existing = makeRow();
    vi.mocked(woRepo.findByDocIdOrThrow).mockResolvedValue(existing);
    vi.mocked(woRepo.update).mockResolvedValue(existing);

    await service.update('wo-1', { name: 'Renamed' });

    const callArg = vi.mocked(woRepo.update).mock.calls[0][1];
    expect(callArg.startDate).toEqual(existing.startDate);
    expect(callArg.endDate).toEqual(existing.endDate);
  });

  it('update recalculates durationMinutes from new dates when not provided', async () => {
    const existing = makeRow();
    vi.mocked(woRepo.findByDocIdOrThrow).mockResolvedValue(existing);
    vi.mocked(woRepo.update).mockResolvedValue(existing);

    await service.update('wo-1', { startDate: '2026-06-01', endDate: '2026-06-02' });

    const callArg = vi.mocked(woRepo.update).mock.calls[0][1];
    // 1 day = 1440 minutes
    expect(callArg.durationMinutes).toBe(1440);
  });

  it('delete delegates to the repository', async () => {
    vi.mocked(woRepo.delete).mockResolvedValue();
    await service.delete('wo-1');
    expect(woRepo.delete).toHaveBeenCalledWith('wo-1');
  });
});
