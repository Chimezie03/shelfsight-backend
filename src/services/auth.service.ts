import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { normalizeEmail } from '../lib/email';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
}

export async function authenticateUser(email: string, password: string): Promise<{ token: string; user: AuthPayload }> {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, name: 'AuthenticationError' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, name: 'AuthenticationError' });
  }

  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return { token, user: payload };
}

export function verifyToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    throw Object.assign(new Error('Invalid or expired token'), { statusCode: 401, name: 'AuthenticationError' });
  }
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      loans: {
        include: {
          bookCopy: {
            include: { book: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404, name: 'NotFoundError' });
  }

  return user;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
