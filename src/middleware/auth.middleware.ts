import { Request, Response, NextFunction } from 'express';
<<<<<<< HEAD
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
=======
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded as { userId: string; role: string };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
>>>>>>> 4fe7ecfe5c39cb943344d7210a4286f1f9f91e66
