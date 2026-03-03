import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';

/**
 * Express middleware that verifies the JWT from the HttpOnly cookie.
 * On success, attaches `req.user` with the token payload.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      error: 'AuthenticationError',
      message: 'Not authenticated',
      statusCode: 401,
    });
  }

  try {
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({
      error: 'AuthenticationError',
      message: 'Invalid or expired token',
      statusCode: 401,
    });
  }
}

/**
 * Role-based access control middleware.
 * Must be used after `requireAuth`.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'ForbiddenError',
        message: 'Insufficient permissions',
        statusCode: 403,
      });
    }

    next();
  };
}
