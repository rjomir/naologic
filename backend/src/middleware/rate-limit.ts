import rateLimit from 'express-rate-limit';

/** 100 req/min per IP across all API endpoints. */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later' },
});

/** 10 reflow runs/min per IP — algorithm is expensive. */
export const reflowRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Reflow rate limit exceeded' },
});
