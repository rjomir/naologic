import express, { type Express } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { workCentersRouter } from './routes/work-centers.js';
import { workOrdersRouter } from './routes/work-orders.js';
import { reflowRouter } from './routes/reflow.js';
import { openApiSpec } from './swagger.js';

const app: Express = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Swagger UI ─────────────────────────────────────────────────────────────
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

// Expose raw OpenAPI JSON for tooling (Postman, code generators, etc.)
app.get('/api/docs.json', (_req, res) => {
  res.json(openApiSpec);
});

// ── API routes ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/work-centers', workCentersRouter);
app.use('/api/work-orders', workOrdersRouter);
app.use('/api/reflow', reflowRouter);

const PORT = Number(process.env['PORT'] ?? 3000);

app.listen(PORT, () => {
  console.log(`Backend API  → http://localhost:${PORT}/api`);
  console.log(`Swagger UI   → http://localhost:${PORT}/api/docs`);
  console.log(`OpenAPI JSON → http://localhost:${PORT}/api/docs.json`);
});

export default app;
