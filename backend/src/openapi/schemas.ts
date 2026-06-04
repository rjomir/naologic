import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { registry } from './registry.js';

extendZodWithOpenApi(z);

// ── Primitive schemas ────────────────────────────────────────────────────────

export const WorkOrderStatusSchema = z
  .enum(['open', 'in-progress', 'complete', 'blocked'])
  .openapi({ description: 'Lifecycle status of a work order' });

export const ShiftSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6).openapi({ description: '0=Sunday … 6=Saturday' }),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
  })
  .openapi('Shift');

export const MaintenanceWindowSchema = z
  .object({
    startDate: z.string().openapi({ description: 'ISO UTC timestamp' }),
    endDate: z.string().openapi({ description: 'ISO UTC timestamp' }),
    reason: z.string().optional(),
  })
  .openapi('MaintenanceWindow');

// ── Document schemas (API responses) ────────────────────────────────────────

export const WorkCenterDocumentSchema = z
  .object({
    docId: z.string(),
    docType: z.literal('workCenter'),
    data: z.object({
      name: z.string(),
      shifts: z.array(ShiftSchema),
      maintenanceWindows: z.array(MaintenanceWindowSchema),
    }),
  })
  .openapi('WorkCenterDocument');

export const WorkOrderDocumentSchema = z
  .object({
    docId: z.string(),
    docType: z.literal('workOrder'),
    data: z.object({
      name: z.string(),
      woNumber: z.string(),
      workCenterId: z.string(),
      manufacturingOrderId: z.string(),
      status: WorkOrderStatusSchema,
      startDate: z.string().openapi({ description: 'YYYY-MM-DD' }),
      endDate: z.string().openapi({ description: 'YYYY-MM-DD' }),
      durationMinutes: z.number().int().nonnegative(),
      setupTimeMinutes: z.number().int().nonnegative(),
      isMaintenance: z.boolean(),
      dependsOnWorkOrderIds: z.array(z.string()),
    }),
  })
  .openapi('WorkOrderDocument');

export const WorkOrderChangeSchema = z
  .object({
    docId: z.string(),
    workOrderNumber: z.string(),
    originalStartDate: z.string(),
    originalEndDate: z.string(),
    newStartDate: z.string(),
    newEndDate: z.string(),
    delayMinutes: z.number(),
    reason: z.string(),
  })
  .openapi('WorkOrderChange');

export const ReflowResponseSchema = z
  .object({
    changes: z.array(WorkOrderChangeSchema),
    explanation: z.string(),
    updatedCount: z.number().int().nonnegative(),
  })
  .openapi('ReflowResponse');

// ── Request DTO schemas ─────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = () =>
  z.string().regex(ISO_DATE_RE, 'Must be YYYY-MM-DD').openapi({ example: '2025-07-15' });

export const CreateWorkOrderSchema = z
  .object({
    name: z.string().min(1),
    workCenterId: z.string().min(1),
    status: WorkOrderStatusSchema.default('open'),
    startDate: isoDate(),
    endDate: isoDate(),
    durationMinutes: z.number().int().positive().optional(),
  })
  .openapi('CreateWorkOrderDto');

export const UpdateWorkOrderSchema = z
  .object({
    name: z.string().min(1).optional(),
    workCenterId: z.string().min(1).optional(),
    status: WorkOrderStatusSchema.optional(),
    startDate: isoDate().optional(),
    endDate: isoDate().optional(),
    durationMinutes: z.number().int().positive().optional(),
  })
  .openapi('UpdateWorkOrderDto');

// ── Register schemas in the OpenAPI registry ─────────────────────────────────

registry.register('WorkCenterDocument', WorkCenterDocumentSchema);
registry.register('WorkOrderDocument', WorkOrderDocumentSchema);
registry.register('WorkOrderChange', WorkOrderChangeSchema);
registry.register('ReflowResponse', ReflowResponseSchema);
registry.register('CreateWorkOrderDto', CreateWorkOrderSchema);
registry.register('UpdateWorkOrderDto', UpdateWorkOrderSchema);

// ── Inferred DTO types ───────────────────────────────────────────────────────

export type CreateWorkOrderInput = z.infer<typeof CreateWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof UpdateWorkOrderSchema>;
