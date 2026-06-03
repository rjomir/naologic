import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { CreateWorkOrderSchema, UpdateWorkOrderSchema } from '../openapi/schemas.js';
import type { WorkOrderService } from './work-order.service.js';
import type { CreateWorkOrderInput, UpdateWorkOrderInput } from '../openapi/schemas.js';
import type { SseService } from '../sse/sse.service.js';

export function createWorkOrdersRouter(service: WorkOrderService, sse: SseService): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json(await service.getAll());
    } catch (err) {
      next(err);
    }
  });

  router.post('/', validateBody(CreateWorkOrderSchema), async (req, res, next) => {
    try {
      const doc = await service.create(req.body as CreateWorkOrderInput);
      res.status(201).json(doc);
      sse.broadcast('work-order:created', { workOrder: doc });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:docId', validateBody(UpdateWorkOrderSchema), async (req, res, next) => {
    try {
      const doc = await service.update(
        req.params['docId'] as string,
        req.body as UpdateWorkOrderInput,
      );
      res.json(doc);
      sse.broadcast('work-order:updated', { workOrder: doc });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:docId', async (req, res, next) => {
    try {
      const docId = req.params['docId'] as string;
      await service.delete(docId);
      res.status(204).send();
      sse.broadcast('work-order:deleted', { docId });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
