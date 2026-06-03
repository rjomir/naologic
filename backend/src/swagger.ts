import type { OpenAPIV3 } from 'openapi-types';

// ── Reusable schemas ─────────────────────────────────────────────────────────

const Shift: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['dayOfWeek', 'startHour', 'endHour'],
  properties: {
    dayOfWeek: {
      type: 'integer',
      minimum: 0,
      maximum: 6,
      description: '0 = Sunday … 6 = Saturday',
    },
    startHour: { type: 'integer', minimum: 0, maximum: 23 },
    endHour: { type: 'integer', minimum: 0, maximum: 23 },
  },
  example: { dayOfWeek: 1, startHour: 8, endHour: 17 },
};

const MaintenanceWindow: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['startDate', 'endDate'],
  properties: {
    startDate: { type: 'string', format: 'date-time', description: 'ISO UTC' },
    endDate: { type: 'string', format: 'date-time', description: 'ISO UTC' },
    reason: { type: 'string', nullable: true },
  },
  example: {
    startDate: '2026-06-04T10:00:00.000Z',
    endDate: '2026-06-04T12:00:00.000Z',
    reason: 'Scheduled lubrication & calibration',
  },
};

const WorkCenterData: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['name', 'shifts', 'maintenanceWindows'],
  properties: {
    name: { type: 'string', example: 'Extrusion Line A' },
    shifts: { type: 'array', items: { $ref: '#/components/schemas/Shift' } },
    maintenanceWindows: {
      type: 'array',
      items: { $ref: '#/components/schemas/MaintenanceWindow' },
    },
  },
};

const WorkCenterDocument: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['docId', 'docType', 'data'],
  properties: {
    docId: { type: 'string', example: 'wc-extrusion-a' },
    docType: { type: 'string', enum: ['workCenter'] },
    data: { $ref: '#/components/schemas/WorkCenterData' },
  },
};

const WorkOrderData: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'name',
    'workCenterId',
    'status',
    'startDate',
    'endDate',
    'durationMinutes',
    'isMaintenance',
    'dependsOnWorkOrderIds',
  ],
  properties: {
    name: { type: 'string', example: 'Pipe Batch #A1' },
    woNumber: { type: 'string', example: 'WO-001' },
    workCenterId: {
      type: 'string',
      example: 'wc-extrusion-a',
      description: 'docId of the work center',
    },
    manufacturingOrderId: { type: 'string', example: 'mo-default' },
    status: {
      type: 'string',
      enum: ['open', 'in_progress', 'complete', 'blocked'],
      example: 'open',
    },
    startDate: { type: 'string', format: 'date', example: '2026-06-01' },
    endDate: { type: 'string', format: 'date', example: '2026-06-05' },
    durationMinutes: {
      type: 'integer',
      example: 480,
      description: 'Total working time required (source of truth)',
    },
    isMaintenance: {
      type: 'boolean',
      default: false,
      description: 'Maintenance orders cannot be rescheduled by the reflow algorithm',
    },
    dependsOnWorkOrderIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'docIds of work orders that must complete before this one starts',
      example: [],
    },
  },
};

const WorkOrderDocument: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['docId', 'docType', 'data'],
  properties: {
    docId: { type: 'string', example: 'wo-001' },
    docType: { type: 'string', enum: ['workOrder'] },
    data: { $ref: '#/components/schemas/WorkOrderData' },
  },
};

const WorkOrderChange: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'docId',
    'workOrderNumber',
    'originalStartDate',
    'originalEndDate',
    'newStartDate',
    'newEndDate',
    'delayMinutes',
    'reason',
  ],
  properties: {
    docId: { type: 'string' },
    workOrderNumber: { type: 'string', example: 'WO-002' },
    originalStartDate: { type: 'string', format: 'date-time' },
    originalEndDate: { type: 'string', format: 'date-time' },
    newStartDate: { type: 'string', format: 'date-time' },
    newEndDate: { type: 'string', format: 'date-time' },
    delayMinutes: {
      type: 'integer',
      description: 'Positive = later, negative = earlier',
      example: 120,
    },
    reason: { type: 'string', example: 'dependency WO-001 delayed by 120 min' },
  },
};

const ReflowResult: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['changes', 'explanation', 'updatedCount'],
  properties: {
    updatedCount: { type: 'integer', example: 3 },
    explanation: { type: 'string', example: 'Reflow completed. 3 work order(s) rescheduled.' },
    changes: { type: 'array', items: { $ref: '#/components/schemas/WorkOrderChange' } },
  },
};

const CreateWorkOrderBody: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['name', 'workCenterId', 'status', 'startDate', 'endDate'],
  properties: {
    name: { type: 'string', example: 'New Batch Run' },
    workCenterId: { type: 'string', example: 'wc-cnc-1' },
    status: {
      type: 'string',
      enum: ['open', 'in_progress', 'complete', 'blocked'],
      default: 'open',
    },
    startDate: { type: 'string', format: 'date', example: '2026-06-10' },
    endDate: { type: 'string', format: 'date', example: '2026-06-14' },
    durationMinutes: { type: 'integer', description: 'Calculated from date range if omitted' },
  },
};

const UpdateWorkOrderBody: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    workCenterId: { type: 'string' },
    status: { type: 'string', enum: ['open', 'in_progress', 'complete', 'blocked'] },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    durationMinutes: { type: 'integer' },
  },
};

const ErrorResponse: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: {
    error: { type: 'string', example: 'Not found' },
  },
};

// ── Full OpenAPI document ────────────────────────────────────────────────────

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Naologic Production Schedule API',
    version: '1.0.0',
    description: `
REST API for the Naologic manufacturing ERP system.

Manages **Work Centers** (production lines / machines) and **Work Orders** (scheduled production tasks).
Also exposes a **Reflow** endpoint that runs the scheduling algorithm — when disruptions occur,
it reschedules all movable work orders to produce a valid, constraint-satisfying schedule and
persists the result to the database.

### Constraint rules enforced by reflow
- Work orders respect **shift schedules** (pause outside working hours, resume next shift)
- No two work orders overlap on the same **work center**
- All **dependency** parent orders must finish before child starts
- **Maintenance windows** on a work center are blocked time — work pauses and resumes after
- Orders with \`isMaintenance: true\` are **fixed** and never rescheduled
    `.trim(),
    contact: {
      name: 'Naologic Team',
      url: 'https://naologic.com',
    },
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  tags: [
    { name: 'Health', description: 'Server liveness' },
    { name: 'Work Centers', description: 'Production lines, machines, and work areas' },
    { name: 'Work Orders', description: 'Scheduled manufacturing tasks' },
    { name: 'Reflow', description: 'Schedule reflow algorithm' },
  ],
  components: {
    schemas: {
      Shift,
      MaintenanceWindow,
      WorkCenterData,
      WorkCenterDocument,
      WorkOrderData,
      WorkOrderDocument,
      WorkOrderChange,
      ReflowResult,
      CreateWorkOrderBody,
      UpdateWorkOrderBody,
      ErrorResponse,
    },
  },
  paths: {
    // ── Health ──────────────────────────────────────────────────────────────

    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness check',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Work Centers ────────────────────────────────────────────────────────

    '/api/work-centers': {
      get: {
        tags: ['Work Centers'],
        summary: 'List all work centers',
        description:
          'Returns all work centers including their shift schedules and maintenance windows.',
        operationId: 'listWorkCenters',
        responses: {
          '200': {
            description: 'List of work center documents',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/WorkCenterDocument' },
                },
              },
            },
          },
        },
      },
    },

    // ── Work Orders ─────────────────────────────────────────────────────────

    '/api/work-orders': {
      get: {
        tags: ['Work Orders'],
        summary: 'List all work orders',
        description: 'Returns all work orders ordered by start date.',
        operationId: 'listWorkOrders',
        responses: {
          '200': {
            description: 'List of work order documents',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/WorkOrderDocument' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Work Orders'],
        summary: 'Create a work order',
        description:
          'Creates a new work order associated with the given work center. `durationMinutes` is calculated from the date range if not provided.',
        operationId: 'createWorkOrder',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWorkOrderBody' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Work order created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkOrderDocument' },
              },
            },
          },
          '500': {
            description: 'No manufacturing order found to associate with',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },

    '/api/work-orders/{docId}': {
      parameters: [
        {
          name: 'docId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'The `docId` of the work order (e.g. `wo-001`)',
          example: 'wo-001',
        },
      ],
      put: {
        tags: ['Work Orders'],
        summary: 'Update a work order',
        description:
          'Partially updates a work order. Only fields present in the request body are changed.',
        operationId: 'updateWorkOrder',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateWorkOrderBody' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated work order',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkOrderDocument' },
              },
            },
          },
          '404': {
            description: 'Work order not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
      delete: {
        tags: ['Work Orders'],
        summary: 'Delete a work order',
        operationId: 'deleteWorkOrder',
        responses: {
          '204': { description: 'Work order deleted' },
          '404': {
            description: 'Work order not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },

    // ── Reflow ──────────────────────────────────────────────────────────────

    '/api/reflow': {
      post: {
        tags: ['Reflow'],
        summary: 'Run production schedule reflow',
        description: `
Loads all current work orders and work centers from the database, runs the reflow
scheduling algorithm, and persists the updated schedule back to the database.

**Algorithm steps:**
1. Topological sort of work orders by dependency graph (Kahn's algorithm)
2. Greedy forward scheduling — each order scheduled as early as possible after its parents finish
3. Shift-aware end date calculation — working time pauses at shift boundaries and maintenance windows
4. Work center occupancy tracking — no two orders overlap on the same machine

Returns the list of changes (what moved, by how much, and why) and a human-readable explanation.
        `.trim(),
        operationId: 'runReflow',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object', description: 'No body required' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Reflow completed — updated schedule persisted to database',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReflowResult' },
                example: {
                  updatedCount: 2,
                  explanation:
                    'Reflow completed. 2 work order(s) rescheduled:\n  • WO-002: moved +120 min\n    Reason: dependency WO-001 delayed',
                  changes: [
                    {
                      docId: 'wo-002',
                      workOrderNumber: 'WO-002',
                      originalStartDate: '2026-06-02T08:00:00.000Z',
                      originalEndDate: '2026-06-02T10:00:00.000Z',
                      newStartDate: '2026-06-02T10:00:00.000Z',
                      newEndDate: '2026-06-02T12:00:00.000Z',
                      delayMinutes: 120,
                      reason: 'dependency WO-001 delayed by 120 min',
                    },
                  ],
                },
              },
            },
          },
          '500': {
            description: 'Circular dependency or other algorithm error',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
  },
};
