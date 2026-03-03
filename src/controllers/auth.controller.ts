import { Request, Response, NextFunction } from 'express';
import { authenticateUser, getUserById } from '../services/auth.service';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Email and password are required',
        statusCode: 400,
      });
    }

    const { token, user } = await authenticateUser(email, password);

    // Set JWT as HttpOnly secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('token', { httpOnly: true, path: '/' });
  return res.json({ message: 'Logged out successfully' });
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    // req.user is set by the auth middleware
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'AuthenticationError',
        message: 'Not authenticated',
        statusCode: 401,
      });
    }

    const user = await getUserById(userId);
    return res.json({ user });
  } catch (err) {
    next(err);
  }
}
