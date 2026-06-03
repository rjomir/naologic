import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { z } from 'zod';

export function validateBody<T>(schema: z.ZodType<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.format() });
      return;
    }
    req.body = result.data as Record<string, unknown>;
    next();
  };
}
