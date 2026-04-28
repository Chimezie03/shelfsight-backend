import type { Request, Response } from 'express';
import {
  authenticateUser,
  getUserById,
  signupOrganization,
  acceptInvite,
  getInvitePreview,
} from '../services/auth.service';
import { AppError } from '../lib/errors';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

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
  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({ user });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('token', { httpOnly: true, path: '/' });
  res.json({ message: 'Logged out successfully' });
}

export async function me(req: Request, res: Response) {
  const userId = req.user?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }

  const user = await getUserById(userId);
  res.json({ user });
}

export async function signup(req: Request, res: Response) {
  const { orgName, name, email, password } = req.body ?? {};
  const { token, user } = await signupOrganization({ orgName, name, email, password });
  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(201).json({ user });
}

export async function acceptInviteController(req: Request, res: Response) {
  const { token: inviteToken, name, password } = req.body ?? {};
  const { token, user } = await acceptInvite({
    token: inviteToken,
    name,
    password,
  });
  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(201).json({ user });
}

export async function getInvitePreviewController(req: Request, res: Response) {
  const preview = await getInvitePreview(req.params.token);
  res.json(preview);
}
