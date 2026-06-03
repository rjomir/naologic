import { Router } from 'express';
import type { WorkCenterService } from './work-center.service.js';

export function createWorkCentersRouter(service: WorkCenterService): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json(await service.getAll());
    } catch (err) {
      next(err);
    }
  });

  return router;
}
