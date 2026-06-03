import { Router } from 'express';
import type { SseService } from './sse.service.js';

export function createSseRouter(sse: SseService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    sse.addClient(res);
    res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      sse.removeClient(res);
    });
  });

  return router;
}
