import type { WorkOrderDocument } from '../models/types';

const STORAGE_KEY = 'naologic-work-orders';

export function loadWorkOrdersFromStorage(): WorkOrderDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WorkOrderDocument[];
  } catch {
    return [];
  }
}

export function saveWorkOrdersToStorage(orders: WorkOrderDocument[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // ignore quota errors
  }
}

export function clearWorkOrderStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
