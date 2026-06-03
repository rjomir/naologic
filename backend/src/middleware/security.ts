import helmet from 'helmet';
import type { RequestHandler } from 'express';

/**
 * Security headers via helmet.
 * CSP is relaxed to allow Swagger UI inline styles/scripts.
 * All other hardening headers are applied at their defaults:
 *   X-Content-Type-Options: nosniff
 *   X-Frame-Options: SAMEORIGIN
 *   Strict-Transport-Security (HSTS)
 *   X-DNS-Prefetch-Control
 *   Referrer-Policy
 */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: false, // Swagger UI requires inline scripts/styles
  crossOriginEmbedderPolicy: false, // Swagger UI loads external resources
}) as RequestHandler;
