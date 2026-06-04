import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  loadWorkOrdersFromStorage,
  saveWorkOrdersToStorage,
  clearWorkOrderStorage,
} from './local-storage';
import type { WorkOrderDocument } from '../models/types';

// ── localStorage mock ────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) delete store[k];
  }),
};
vi.stubGlobal('localStorage', localStorageMock);

// ── fixtures ─────────────────────────────────────────────────────────────────

function makeOrder(docId: string): WorkOrderDocument {
  return {
    docId,
    docType: 'workOrder',
    data: {
      name: `Order ${docId}`,
      woNumber: docId,
      workCenterId: 'wc-1',
      manufacturingOrderId: 'mo-1',
      status: 'open',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      durationMinutes: 480,
      isMaintenance: false,
      dependsOnWorkOrderIds: [],
    },
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('loadWorkOrdersFromStorage', () => {
  beforeEach(() => localStorageMock.clear());

  it('returns an empty array when storage is empty', () => {
    expect(loadWorkOrdersFromStorage()).toEqual([]);
  });

  it('returns an empty array when the stored value is not an array', () => {
    localStorageMock.setItem('naologic-work-orders', JSON.stringify({ not: 'an array' }));
    expect(loadWorkOrdersFromStorage()).toEqual([]);
  });

  it('returns an empty array when the stored value is invalid JSON', () => {
    localStorageMock.setItem('naologic-work-orders', 'not-json{{{');
    expect(loadWorkOrdersFromStorage()).toEqual([]);
  });

  it('returns persisted work orders', () => {
    const orders = [makeOrder('wo-1'), makeOrder('wo-2')];
    saveWorkOrdersToStorage(orders);
    expect(loadWorkOrdersFromStorage()).toEqual(orders);
  });
});

describe('saveWorkOrdersToStorage', () => {
  beforeEach(() => localStorageMock.clear());

  it('serialises orders to localStorage under the correct key', () => {
    const orders = [makeOrder('wo-1')];
    saveWorkOrdersToStorage(orders);
    const raw = localStorageMock.getItem('naologic-work-orders');
    expect(JSON.parse(raw!)).toEqual(orders);
  });

  it('overwrites a previous value when called again', () => {
    saveWorkOrdersToStorage([makeOrder('wo-1')]);
    saveWorkOrdersToStorage([makeOrder('wo-2')]);
    const loaded = loadWorkOrdersFromStorage();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].docId).toBe('wo-2');
  });
});

describe('clearWorkOrderStorage', () => {
  beforeEach(() => localStorageMock.clear());

  it('removes the key from storage', () => {
    saveWorkOrdersToStorage([makeOrder('wo-1')]);
    clearWorkOrderStorage();
    expect(loadWorkOrdersFromStorage()).toEqual([]);
  });
});
