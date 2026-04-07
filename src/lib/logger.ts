/**
 * Structured JSON logs for production (CloudWatch Logs / ECS / Render log drains).
 * // ARCH DECISION: stdout JSON lines — no extra deps; compatible with metric filters & alarms.
 */

export type LogLevel = 'error' | 'warn' | 'info';

function writeLine(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload));
}

export function logInfo(event: string, details: Record<string, unknown> = {}): void {
  writeLine({
    level: 'info',
    ts: new Date().toISOString(),
    service: 'shelfsight-backend',
    event,
    ...details,
  });
}

/**
 * Production error logging (never includes response bodies or secrets).
 */
export function logError(
  err: unknown,
  context: Record<string, unknown> = {},
): void {
  const base: Record<string, unknown> = {
    level: 'error',
    ts: new Date().toISOString(),
    service: 'shelfsight-backend',
    event: 'unhandled_error',
    ...context,
  };

  if (err instanceof Error) {
    base.name = err.name;
    base.message = err.message;
    if (process.env.NODE_ENV !== 'production' && err.stack) {
      base.stack = err.stack;
    } else if (process.env.NODE_ENV === 'production' && err.stack) {
      // Truncate stack for log size / PII safety in centralized logs
      base.stackPreview = err.stack.split('\n').slice(0, 8).join('\n');
    }
  } else {
    base.message = String(err);
  }

  console.error(JSON.stringify(base));
}
