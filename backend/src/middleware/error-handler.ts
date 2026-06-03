import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Prisma "not found" → 404
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  const status = err.statusCode ?? 500;
  const message = status < 500 ? err.message : 'Internal server error';

  if (status >= 500) {
    console.error(
      JSON.stringify({ error: err.message, stack: err.stack, ts: new Date().toISOString() }),
    );
  }

  res.status(status).json({ error: message });
}
