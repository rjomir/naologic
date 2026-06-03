import { PrismaClient } from '@prisma/client';

// Singleton Prisma client — reuse across the application
const prisma = new PrismaClient({
  log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
