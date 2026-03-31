import type { Request, Response } from 'express';
import { authenticateUser, getUserById } from '../services/auth.service';
import { AppError } from '../lib/errors';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Email and password are required', {
      fieldErrors: {
        ...(email ? {} : { email: 'Required' }),
        ...(password ? {} : { password: 'Required' }),
      },
    });
  }

  const { token, user } = await authenticateUser(email, password);


  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ user });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('token', { httpOnly: true, path: '/' });
  res.json({ message: 'Logged out successfully' });
}

export async function me(req: Request, res: Response) {
  const userId = (req as any).user?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }

  const user = await getUserById(userId);
  res.json({ user });
}
