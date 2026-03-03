<<<<<<< HEAD
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
=======
import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, role: user.role });
};

export const getMe = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { loans: true } });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, loans: user.loans });
};
>>>>>>> 4fe7ecfe5c39cb943344d7210a4286f1f9f91e66
