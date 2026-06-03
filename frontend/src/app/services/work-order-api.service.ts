import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type {
  WorkCenterDocument,
  WorkOrderDocument,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  ReflowResponse,
} from '../models/types';
import { API_URL } from '../tokens/api-url.token';

/**
 * Thin HTTP layer — returns Observables, owns no state.
 * WorkOrderService is the state facade that delegates here.
 */
@Injectable({ providedIn: 'root' })
export class WorkOrderApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  getWorkCenters(): Observable<WorkCenterDocument[]> {
    return this.http.get<WorkCenterDocument[]>(`${this.apiUrl}/work-centers`);
  }

  getWorkOrders(): Observable<WorkOrderDocument[]> {
    return this.http.get<WorkOrderDocument[]>(`${this.apiUrl}/work-orders`);
  }

  createWorkOrder(dto: CreateWorkOrderDto): Observable<WorkOrderDocument> {
    return this.http.post<WorkOrderDocument>(`${this.apiUrl}/work-orders`, dto);
  }

  updateWorkOrder(docId: string, dto: UpdateWorkOrderDto): Observable<WorkOrderDocument> {
    return this.http.put<WorkOrderDocument>(`${this.apiUrl}/work-orders/${docId}`, dto);
  }

  deleteWorkOrder(docId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/work-orders/${docId}`);
  }

  runReflow(): Observable<ReflowResponse> {
    return this.http.post<ReflowResponse>(`${this.apiUrl}/reflow`, {});
  }
}
