import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = randomUUID();

  res.on('finish', () => {
    const entry = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ts: new Date().toISOString(),
    };
    if (res.statusCode >= 500) {
      console.error(JSON.stringify(entry));
    } else if (res.statusCode >= 400) {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  });

  next();
}
