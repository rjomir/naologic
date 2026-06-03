import { z } from 'zod';
import { registry } from './registry.js';
import {
  WorkCenterDocumentSchema,
  WorkOrderDocumentSchema,
  CreateWorkOrderSchema,
  UpdateWorkOrderSchema,
  ReflowResponseSchema,
} from './schemas.js';

// ── /work-centers ────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/work-centers',
  tags: ['Work Centers'],
  summary: 'List all work centers',
  responses: {
    200: {
      description: 'Array of work center documents',
      content: { 'application/json': { schema: z.array(WorkCenterDocumentSchema) } },
    },
  },
});

// ── /work-orders ─────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/work-orders',
  tags: ['Work Orders'],
  summary: 'List all work orders sorted by start date',
  responses: {
    200: {
      description: 'Array of work order documents',
      content: { 'application/json': { schema: z.array(WorkOrderDocumentSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/work-orders',
  tags: ['Work Orders'],
  summary: 'Create a work order',
  request: { body: { content: { 'application/json': { schema: CreateWorkOrderSchema } } } },
  responses: {
    201: {
      description: 'Created work order',
      content: { 'application/json': { schema: WorkOrderDocumentSchema } },
    },
    400: { description: 'Validation failed' },
  },
});

registry.registerPath({
  method: 'put',
  path: '/work-orders/{docId}',
  tags: ['Work Orders'],
  summary: 'Update a work order',
  request: {
    params: z.object({ docId: z.string() }),
    body: { content: { 'application/json': { schema: UpdateWorkOrderSchema } } },
  },
  responses: {
    200: {
      description: 'Updated work order',
      content: { 'application/json': { schema: WorkOrderDocumentSchema } },
    },
    404: { description: 'Not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/work-orders/{docId}',
  tags: ['Work Orders'],
  summary: 'Delete a work order',
  request: { params: z.object({ docId: z.string() }) },
  responses: {
    204: { description: 'Deleted' },
    404: { description: 'Not found' },
  },
});

// ── /reflow ──────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/reflow',
  tags: ['Reflow'],
  summary: 'Run the scheduling reflow algorithm and persist updated dates',
  responses: {
    200: {
      description: 'Reflow result with changes and explanation',
      content: { 'application/json': { schema: ReflowResponseSchema } },
    },
  },
});

// ── /health ───────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'API health check',
  responses: {
    200: {
      description: 'Status ok',
      content: {
        'application/json': {
          schema: z.object({ status: z.string(), timestamp: z.string() }),
        },
      },
    },
  },
});
