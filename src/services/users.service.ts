import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import prisma, { forOrg } from '../lib/prisma';
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && VALID_ROLES.includes(value as Role);
}

export async function getUsersService(organizationId: string, page = 1, limit = 50) {
  const MAX_LIMIT = 100;
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  const db = forOrg(organizationId);

  const [users, total] = await db.$transaction([
    db.user.findMany({
      select: { ...USER_PUBLIC_SELECT },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    db.user.count(),
  ]);

  return {
    data: users,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function createUserService(organizationId: string, data: Record<string, unknown>) {
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
  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { email: 'Must be a valid email address' },
    });
  }

  const rawPassword = data.password as string;
  if (rawPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { password: `Must be at least ${MIN_PASSWORD_LENGTH} characters` },
    });
  }

  const name = (data.name as string).trim();
  if (!name) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { name: 'Required' },
    });
  }

  const db = forOrg(organizationId);
  const existing = await db.user.findFirst({ where: { email } });
  if (existing) {
    throw new AppError(409, 'DUPLICATE_ENTRY', 'A user with this email already exists', {
      fieldErrors: { email: 'Email already in use' },
    });
  }

  const passwordHash = await bcrypt.hash(rawPassword, 10);
  return await db.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: data.role as Role,
      // organizationId injected by the scoped client extension
    } as any,
    select: { ...USER_PUBLIC_SELECT },
  });
}

export async function updateUserService(
  organizationId: string,
  id: string,
  data: Record<string, unknown>,
) {
  const db = forOrg(organizationId);
  const existing = await db.user.findFirst({ where: { id } });
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
    if (!EMAIL_PATTERN.test(email)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
        fieldErrors: { email: 'Must be a valid email address' },
      });
    }
    if (email !== existing.email) {
      const conflict = await db.user.findFirst({ where: { email } });
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
    if (data.password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
        fieldErrors: { password: `Must be at least ${MIN_PASSWORD_LENGTH} characters` },
      });
    }
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No fields to update');
  }

  // KAN-45: block role-demotion that would leave an org with zero ADMINs.
  if (updateData.role && existing.role === 'ADMIN' && updateData.role !== 'ADMIN') {
    const otherAdmins = await db.user.count({
      where: { role: 'ADMIN', id: { not: id } },
    });
    if (otherAdmins === 0) {
      throw new AppError(409, 'LAST_ADMIN', 'Cannot demote the last administrator', {
        fieldErrors: { role: 'At least one administrator is required' },
      });
    }
  }

  return await db.user.update({
    where: { id },
    data: updateData,
    select: { ...USER_PUBLIC_SELECT },
  });
}

export async function deleteUserService(organizationId: string, id: string) {
  const db = forOrg(organizationId);
  const target = await db.user.findFirst({ where: { id } });
  if (!target) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  // KAN-45: block deletion that would leave an org with zero ADMINs.
  if (target.role === 'ADMIN') {
    const otherAdmins = await db.user.count({
      where: { role: 'ADMIN', id: { not: id } },
    });
    if (otherAdmins === 0) {
      throw new AppError(409, 'LAST_ADMIN', 'Cannot delete the last administrator');
    }
  }

  return await db.user.delete({ where: { id } });
}

export { prisma };
