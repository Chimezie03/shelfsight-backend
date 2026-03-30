import type { ErrorRequestHandler, Request } from 'express';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { AppError } from '../lib/errors';

export function buildErrorBody(
  statusCode: number,
  code: string,
  message: string,
  details: Record<string, unknown>,
  path: string,
) {
  return {
    success: false as const,
    error: {
      code,
      message,
      details: details ?? {},
    },
    meta: {
      statusCode,
      timestamp: new Date().toISOString(),
      path,
    },
  };
}

const LOAN_SERVICE_CODES = new Set(['NOT_FOUND', 'UNAVAILABLE', 'ALREADY_RETURNED']);

function isLoanServiceError(err: unknown): err is Error & { code: string } {
  if (!(err instanceof Error)) return false;
  const c = (err as Error & { code?: string }).code;
  return typeof c === 'string' && LOAN_SERVICE_CODES.has(c);
}

function logErrorInDevelopment(err: unknown): void {
  if (process.env.NODE_ENV === 'production') return;
  // ARCH DECISION: stderr in non-production only; spec forbids console.log in production paths
  // eslint-disable-next-line no-console
  console.error(err);
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res,
  next,
) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> = {};

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = { ...err.details };
  } else if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        message = 'A record with this value already exists';
        details = { target: err.meta?.target };
        break;
      case 'P2025':
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      case 'P2003':
        statusCode = 409;
        code = 'CONSTRAINT_VIOLATION';
        message = 'Operation conflicts with related records';
        details = { field: err.meta?.field_name };
        break;
      default:
        code = 'DATABASE_ERROR';
        message = 'Database operation failed';
    }
  } else if (err instanceof PrismaClientValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid data for database operation';
  } else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  } else if (
    err instanceof Error &&
    typeof (err as Error & { statusCode?: number }).statusCode === 'number'
  ) {
    const sc = (err as Error & { statusCode: number }).statusCode;
    if (sc >= 400 && sc < 600) {
      statusCode = sc;
      if ((err as Error).name === 'AuthenticationError') {
        code = 'UNAUTHORIZED';
      } else if ((err as Error).name === 'NotFoundError') {
        code = 'NOT_FOUND';
      } else {
        code = 'REQUEST_ERROR';
      }
      message = err.message;
    }
  } else if (isLoanServiceError(err)) {
    switch (err.code) {
      case 'NOT_FOUND':
        statusCode = 404;
        code = 'NOT_FOUND';
        message = err.message;
        break;
      case 'UNAVAILABLE':
        statusCode = 409;
        code = 'RESOURCE_UNAVAILABLE';
        message = err.message;
        break;
      case 'ALREADY_RETURNED':
        statusCode = 409;
        code = 'ALREADY_RETURNED';
        message = err.message;
        break;
      default:
        break;
    }
  } else if (err instanceof Error) {
    message =
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message;
  }

  logErrorInDevelopment(err);

  res.status(statusCode).json(buildErrorBody(statusCode, code, message, details, req.path));
};
