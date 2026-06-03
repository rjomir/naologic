import type { LRUCache } from 'lru-cache';
import type { WorkCenterDocument } from '@naologic/shared';
import type { IWorkCenterRepository, WorkCenterWithRels } from './work-center.repository.js';

const CACHE_KEY = 'all';

function toDoc(wc: WorkCenterWithRels): WorkCenterDocument {
  return {
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
  };
}

export class WorkCenterService {
  constructor(
    private readonly repo: IWorkCenterRepository,
    private readonly cache: LRUCache<string, WorkCenterDocument[]>,
  ) {}

  async getAll(): Promise<WorkCenterDocument[]> {
    const cached = this.cache.get(CACHE_KEY);
    if (cached) return cached;

    const rows = await this.repo.findAll();
    const docs = rows.map(toDoc);
    this.cache.set(CACHE_KEY, docs);
    return docs;
  }

  invalidateCache(): void {
    this.cache.delete(CACHE_KEY);
  }
}
