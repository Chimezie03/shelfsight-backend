import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';
import { AppError } from '../lib/errors';

/**
 * Express middleware that verifies the JWT from the HttpOnly cookie.
 * On success, attaches `req.user` with the token payload.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}

/**
 * Role-based access control middleware. Must be used after `requireAuth`.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
    }

    next();
  };
}

// Alias for backward compatibility with routes using the old name
export const authenticateJWT = requireAuth;
