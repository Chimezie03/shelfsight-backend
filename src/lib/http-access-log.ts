import type { Request, Response, NextFunction } from 'express';

/**
 * Minimal JSON access log in production for CloudWatch metric filters (5xx rate, latency).
 * // ARCH DECISION: dev keeps morgan; prod uses compact JSON lines only.
 */
export function httpAccessLog(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const payload = {
      level: 'info',
      ts: new Date().toISOString(),
      service: 'shelfsight-backend',
      event: 'http_request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    };
    console.log(JSON.stringify(payload));
  });
  next();
}
