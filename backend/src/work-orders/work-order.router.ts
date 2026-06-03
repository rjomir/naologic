import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { CreateWorkOrderSchema, UpdateWorkOrderSchema } from '../openapi/schemas.js';
import type { WorkOrderService } from './work-order.service.js';
import type { CreateWorkOrderInput, UpdateWorkOrderInput } from '../openapi/schemas.js';

export function createWorkOrdersRouter(service: WorkOrderService): Router {
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
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:docId', async (req, res, next) => {
    try {
      await service.delete(req.params['docId'] as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
