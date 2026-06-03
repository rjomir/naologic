import express, { type Express } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import prisma from './db.js';
import { openApiSpec } from './swagger.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';

import { createLruCache } from './cache/lru.cache.js';
import type { WorkCenterDocument } from '@naologic/shared';

import { PrismaWorkCenterRepository } from './work-centers/work-center.repository.js';
import { WorkCenterService } from './work-centers/work-center.service.js';
import { createWorkCentersRouter } from './work-centers/work-center.router.js';

import { PrismaWorkOrderRepository } from './work-orders/work-order.repository.js';
import { WorkOrderService } from './work-orders/work-order.service.js';
import { createWorkOrdersRouter } from './work-orders/work-order.router.js';

import { PrismaManufacturingOrderRepository } from './manufacturing-orders/manufacturing-order.repository.js';

import { ReflowService } from './reflow/reflow.service.js';
import { createReflowRouter } from './reflow/reflow.router.js';

// ── Composition root: wire dependencies ────────────────────────────────────

const wcRepo = new PrismaWorkCenterRepository(prisma);
const wcCache = createLruCache<string, WorkCenterDocument[]>({ max: 1, ttlMs: 5 * 60 * 1000 });
const wcService = new WorkCenterService(wcRepo, wcCache);

const moRepo = new PrismaManufacturingOrderRepository(prisma);

const woRepo = new PrismaWorkOrderRepository(prisma);
const woService = new WorkOrderService(woRepo, moRepo);

const reflowAlgorithm = new ReflowService();

// ── Express app ─────────────────────────────────────────────────────────────

const app: Express = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(requestLogger);

// ── Swagger UI (spec generated from Zod schemas) ────────────────────────────
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'Naologic API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  }),
);

app.get('/api/docs.json', (_req, res) => {
  res.json(openApiSpec);
});

// ── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/work-centers', createWorkCentersRouter(wcService));
app.use('/api/work-orders', createWorkOrdersRouter(woService));
app.use('/api/reflow', createReflowRouter(wcRepo, woRepo, moRepo, reflowAlgorithm));

// ── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

const PORT = Number(process.env['PORT'] ?? 3000);

app.listen(PORT, () => {
  console.log(`Backend API  → http://localhost:${PORT}/api`);
  console.log(`Swagger UI   → http://localhost:${PORT}/api/docs`);
  console.log(`OpenAPI JSON → http://localhost:${PORT}/api/docs.json`);
});

export default app;
