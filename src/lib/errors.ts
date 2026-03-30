/**
 * Typed application error for services/controllers to throw; the global
 * error handler serializes these into the universal error envelope.
 */
export class AppError extends Error {
  readonly name = 'AppError';

  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
