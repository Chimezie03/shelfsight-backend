import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { AppError } from '../lib/errors';
import { normalizeEmail } from '../lib/email';

const VALID_ROLES: Role[] = ['ADMIN', 'STAFF', 'PATRON'];

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && VALID_ROLES.includes(value as Role);
}

export async function getUsersService() {
  return await prisma.user.findMany({
    select: { ...USER_PUBLIC_SELECT },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createUserService(data: Record<string, unknown>) {
  const fieldErrors: Record<string, string> = {};
  if (!data.email || typeof data.email !== 'string') fieldErrors.email = 'Required';
  if (!data.password || typeof data.password !== 'string') fieldErrors.password = 'Required';
  if (!data.name || typeof data.name !== 'string') fieldErrors.name = 'Required';
  if (data.role === undefined || data.role === null || data.role === '') fieldErrors.role = 'Required';

  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', { fieldErrors });
  }

  if (!isValidRole(data.role)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { role: `Must be one of: ${VALID_ROLES.join(', ')}` },
    });
  }

  const email = normalizeEmail(data.email as string);
  if (!email) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { email: 'Required' },
    });
  }

  const name = (data.name as string).trim();
  if (!name) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { name: 'Required' },
    });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'DUPLICATE_ENTRY', 'A user with this email already exists', {
      fieldErrors: { email: 'Email already in use' },
    });
  }

  const passwordHash = await bcrypt.hash(data.password as string, 10);
  return await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: data.role as Role,
    },
    select: { ...USER_PUBLIC_SELECT },
  });
}

export async function updateUserService(id: string, data: Record<string, unknown>) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const updateData: {
    email?: string;
    name?: string;
    role?: Role;
    passwordHash?: string;
  } = {};

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
        fieldErrors: { name: 'Required' },
      });
    }
    updateData.name = data.name.trim();
  }

  if (data.email !== undefined) {
    if (typeof data.email !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
        fieldErrors: { email: 'Invalid' },
      });
    }
    const email = normalizeEmail(data.email);
    if (!email) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
        fieldErrors: { email: 'Required' },
      });
    }
    if (email !== existing.email) {
      const conflict = await prisma.user.findUnique({ where: { email } });
      if (conflict) {
        throw new AppError(409, 'DUPLICATE_ENTRY', 'A user with this email already exists', {
          fieldErrors: { email: 'Email already in use' },
        });
      }
    }
    updateData.email = email;
  }

  if (data.role !== undefined) {
    if (!isValidRole(data.role)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
        fieldErrors: { role: `Must be one of: ${VALID_ROLES.join(', ')}` },
      });
    }
    updateData.role = data.role;
  }

  if (data.password !== undefined && data.password !== null && data.password !== '') {
    if (typeof data.password !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
        fieldErrors: { password: 'Invalid' },
      });
    }
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No fields to update');
  }

  return await prisma.user.update({
    where: { id },
    data: updateData,
    select: { ...USER_PUBLIC_SELECT },
  });
}

export async function deleteUserService(id: string) {
  return await prisma.user.delete({
    where: { id },
  });
}
